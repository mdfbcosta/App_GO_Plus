// ==========================================
// MÓDULO: EVENTOS DO GRUPO (DESCOBERTA DINÂMICA)
// ==========================================

let arteEventoBase64 = null;
let eventoModo = 'novo'; 
let eventoIdEmEdicao = null;
let COLUNA_DATA_DETECTADA = 'data_evento'; // Valor padrão inicial
let mesAtivoEventos = new Date().getMonth();
let discoveryDone = false;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Descobrir o nome correto da coluna antes de tudo
    await descobrirColunaData();

    const formEvento = document.getElementById('form-evento');
    if (formEvento) { formEvento.addEventListener('submit', salvarEvento); }

    document.body.addEventListener('click', (e) => {
        const target = e.target.closest('.sidebar-item, .nav-item');
        if (target && target.innerText.includes('Eventos')) { carregarMesesTabs(); }
    });
});

async function descobrirColunaData() {
    if (discoveryDone) return;
    try {
        const { data, error } = await supabaseClient.from('eventos').select('*').limit(1);
        if (data && data.length > 0) {
            const colunas = Object.keys(data[0]);
            console.log("Colunas detectadas em 'eventos':", colunas);
            // Procura por nomes comuns de data
            if (colunas.includes('data_evento')) COLUNA_DATA_DETECTADA = 'data_evento';
            else if (colunas.includes('data')) COLUNA_DATA_DETECTADA = 'data';
            else if (colunas.includes('data_hora')) COLUNA_DATA_DETECTADA = 'data_hora';
            else if (colunas.includes('data_inicio')) COLUNA_DATA_DETECTADA = 'data_inicio';
            else if (colunas.includes('data_reuniao')) COLUNA_DATA_DETECTADA = 'data_reuniao';
            else {
                // Pega a primeira coluna que tenha "data" no nome
                const detectada = colunas.find(c => c.toLowerCase().includes('data'));
                if (detectada) COLUNA_DATA_DETECTADA = detectada;
            }
            discoveryDone = true;
        }
    } catch (e) { console.error("Erro na descoberta de colunas:", e); }
}

// --- AUXILIARES ---

function comprimirImagemEvento(base64, maxWidth = 600, maxHeight = 600, quality = 0.5) {
    return new Promise((resolve) => {
        const img = new Image(); img.src = base64;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width; let height = img.height;
            if (width > height) { if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; } }
            else { if (height > maxHeight) { width *= maxHeight / height; height = maxHeight; } }
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
    });
}

window.previewArtEvento = async function(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    const base64 = await new Promise(r => { reader.onload = (e) => r(e.target.result); reader.readAsDataURL(file); });
    arteEventoBase64 = await comprimirImagemEvento(base64);
    const preview = document.getElementById('evento-art-preview');
    preview.innerHTML = `<img src="${arteEventoBase64}" style="width:100%; height:100%; object-fit:cover;">`;
    autoSaveDraftEvento();
};

// --- RASCUNHOS ---

window.autoSaveDraftEvento = function() {
    if (eventoModo === 'edit') return;
    const titulo = document.getElementById('evento-titulo').value;
    const desc = document.getElementById('evento-desc').value;
    
    if (titulo.length < 3 && desc.length < 3) return; // Evita salvar rascunhos vazios

    const draft = {
        id: eventoIdEmEdicao || 'draft_' + Date.now(),
        titulo: titulo,
        data_ini: document.getElementById('evento-data').value,
        data_fim: document.getElementById('evento-data-fim').value,
        local: document.getElementById('evento-local').value,
        desc: desc,
        link: document.getElementById('evento-link').value,
        visib: document.getElementById('evento-visibilidade').value,
        foto: arteEventoBase64,
        salvo_em: new Date().toISOString()
    };
    
    let drafts = JSON.parse(localStorage.getItem('go_plus_eventos_drafts') || '[]');
    // Remove versão anterior se existir (mesmo ID ou mesmo título recente)
    drafts = drafts.filter(d => d.id !== draft.id && d.titulo !== draft.titulo);
    drafts.unshift(draft);
    // Limita a 10 rascunhos
    if (drafts.length > 10) drafts.pop();
    
    localStorage.setItem('go_plus_eventos_drafts', JSON.stringify(drafts));
    const st = document.getElementById('evento-draft-status');
    if (st) st.innerText = `Rascunho salvo às ${new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;
};

// --- NAVEGAÇÃO ---

window.carregarMesesTabs = function(mesDesejado = null, eventoIdParaFocar = null) {
    const container = document.getElementById('meses-tabs'); if (!container) return;
    const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const mesAtual = mesDesejado !== null ? mesDesejado : new Date().getMonth();
    container.innerHTML = '';
    meses.forEach((nome, index) => {
        const btn = document.createElement('button');
        btn.innerText = nome;
        btn.className = `btn ${index === mesAtual ? 'btn-primary' : 'btn-outline'}`;
        btn.style.cssText = 'padding: 5px 15px; font-size: 0.7rem; border-radius: 20px;';
        btn.onclick = () => {
            container.querySelectorAll('button').forEach(b => b.className = 'btn btn-outline');
            btn.className = 'btn btn-primary';
            carregarEventos(index);
        };
        container.appendChild(btn);
    });
    carregarEventos(mesAtual, eventoIdParaFocar);
};

window.carregarEventos = async function(mesIndex, eventoIdParaFocar = null) {
    if (!window.meuGrupoId) return;
    await descobrirColunaData(); // Garante que a coluna foi detectada antes de buscar
    mesAtivoEventos = mesIndex;
    const btnNovo = document.getElementById('btn-novo-evento');
    const temPermissao = (window.meuCargo && (window.meuCargo.includes('Coordenador') || window.meuCargo.includes('Secretário')));
    if (btnNovo) btnNovo.style.display = temPermissao ? 'block' : 'none';

    try {
        const ano = new Date().getFullYear();
        const dataInicio = new Date(ano, mesIndex, 1).toISOString();
        const dataFim = new Date(ano, mesIndex + 1, 0, 23, 59, 59).toISOString();

        let query = supabaseClient.from('eventos').select('*').eq('grupo_id', window.meuGrupoId).gte(COLUNA_DATA_DETECTADA, dataInicio).lte(COLUNA_DATA_DETECTADA, dataFim).order(COLUNA_DATA_DETECTADA, { ascending: true });
        if (window.meuCargo === 'Participante') query = query.eq('visibilidade', 'Público');

        const { data: eventos, error } = await query;
        if (error) throw error;

        const lista = document.getElementById('lista-eventos'); if (!lista) return;
        lista.innerHTML = '';

        if (!eventos || eventos.length === 0) {
            lista.innerHTML = '<div style="text-align:center; padding:40px; opacity:0.6;"><p>Nenhum evento este mês.</p></div>';
            return;
        }

        eventos.forEach(ev => {
            let meta = {}; try { meta = JSON.parse(ev.descricao || '{}'); } catch(e) { meta = { texto: ev.descricao }; }
            const valData = ev[COLUNA_DATA_DETECTADA];
            const dIni = new Date(valData);
            const dFim = meta.data_fim ? new Date(meta.data_fim) : null;
            
            const card = document.createElement('div');
            card.id = `evento-card-${ev.id}`;
            card.className = 'card';
            card.style.cssText = 'margin-bottom: 15px; overflow: hidden; padding: 0; transition: all 0.5s ease;';
            
            let imgHtml = meta.foto ? `
                <div style="background: #f1f5f9; width:100%; display:flex; justify-content:center; align-items:center;">
                    <img src="${meta.foto}" style="width:100%; max-height:350px; object-fit:contain; display:block;">
                </div>
            ` : '';
            let dataStr = dIni.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'});
            if (dFim) dataStr += ` até ${dFim.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'})}`;

            const textoLimpo = (meta.texto || 'Sem descrição.').replace(/\n/g, '<br>');

            card.innerHTML = `
                ${imgHtml}
                <div style="padding:15px;">
                    <div class="flex justify-between items-start">
                        <h4 style="color:var(--primary-blue); font-weight:700; font-size:1rem;">${ev.titulo}</h4>
                        ${ev.visibilidade === 'Privado' ? '<span style="font-size:0.6rem; background:#fee2e2; color:#b91c1c; padding:2px 6px; border-radius:4px;">Privado</span>' : ''}
                    </div>
                    <p style="font-size:0.75rem; color:var(--text-muted); margin:5px 0;">📅 ${dataStr} • ⏰ ${dIni.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}${dFim ? ' - '+dFim.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : ''}</p>
                    <p style="font-size:0.75rem; color:var(--text-muted); margin-bottom:10px;">📍 ${ev.local_evento || 'Local não definido'}</p>
                    
                    <div id="evento-desc-${ev.id}" style="font-size:0.8rem; line-height:1.5; color:#4a5568; max-height: 80px; overflow: hidden; transition: max-height 0.3s ease;">
                        ${textoLimpo}
                    </div>
                    ${textoLimpo.length > 100 ? `<button id="btn-mais-evento-${ev.id}" onclick="expandirEventoDesc('${ev.id}')" style="background:none; border:none; color:var(--primary-blue); font-size:0.75rem; font-weight:700; padding:0; margin-top:5px; cursor:pointer;">... ler mais</button>` : ''}
                    
                    <div class="flex gap-2" style="margin-top:15px;">
                        ${meta.link ? `<a href="${meta.link}" target="_blank" class="btn btn-primary" style="flex:1; font-size:0.7rem; padding:8px;">🔗 Inscrição / Info</a>` : ''}
                        ${(window.meuCargo && (window.meuCargo.includes('Coordenador') || window.meuCargo.includes('Secretário'))) ? `
                            <button onclick="prepararEdicaoEvento('${ev.id}')" class="btn btn-outline" style="font-size:0.7rem; padding:8px;">✏️ Editar</button>
                            <button onclick="excluirEvento('${ev.id}')" class="btn btn-outline" style="color:red; font-size:0.7rem; padding:8px;">🗑️</button>
                        ` : ''}
                    </div>
                </div>
            `;
            lista.appendChild(card);
        });

        if (eventoIdParaFocar) {
            setTimeout(() => {
                const el = document.getElementById(`evento-card-${eventoIdParaFocar}`);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.style.boxShadow = '0 0 20px rgba(30, 58, 138, 0.5)';
                    el.style.transform = 'scale(1.02)';
                    setTimeout(() => { 
                        el.style.boxShadow = ''; 
                        el.style.transform = 'scale(1)';
                    }, 2000);
                }
            }, 500);
        }
    } catch (err) { console.error(err); }
};

window.abrirModalRascunhos = function() {
    const drafts = JSON.parse(localStorage.getItem('go_plus_eventos_drafts') || '[]');
    const container = document.getElementById('lista-rascunhos-items');
    container.innerHTML = '';

    if (drafts.length === 0) {
        container.innerHTML = '<p style="font-size: 0.85rem; color: var(--text-muted); text-align: center; padding: 20px;">Nenhum rascunho salvo.</p>';
    } else {
        // Ordena por data (mais recente primeiro)
        drafts.sort((a,b) => new Date(b.salvo_em) - new Date(a.salvo_em));
        
        drafts.forEach(d => {
            const item = document.createElement('div');
            item.className = 'card';
            item.style.padding = '12px';
            item.style.marginBottom = '5px';
            item.style.background = '#f8fafc';
            item.innerHTML = `
                <div class="flex justify-between items-center">
                    <div style="flex:1; cursor:pointer;" onclick="restaurarRascunho('${d.id}')">
                        <div style="font-weight:700; color:var(--primary-blue); font-size:0.85rem;">${d.titulo || '(Sem título)'}</div>
                        <div style="font-size:0.65rem; color:var(--text-muted);">Salvo em: ${new Date(d.salvo_em).toLocaleString()}</div>
                    </div>
                    <button class="btn-close" style="font-size:0.7rem; color:red; background:none; border:none;" onclick="excluirRascunho('${d.id}')">🗑️</button>
                </div>
            `;
            container.appendChild(item);
        });
    }
    document.getElementById('modal-rascunhos').style.display = 'flex';
};

window.restaurarRascunho = function(id) {
    const drafts = JSON.parse(localStorage.getItem('go_plus_eventos_drafts') || '[]');
    const d = drafts.find(x => x.id === id);
    if (!d) return;

    eventoModo = 'novo';
    eventoIdEmEdicao = null; // Reinicia o ID para não sobrescrever um rascunho com o outro ao salvar
    document.getElementById('evento-titulo').value = d.titulo || '';
    document.getElementById('evento-data').value = d.data_ini || '';
    document.getElementById('evento-data-fim').value = d.data_fim || '';
    document.getElementById('evento-local').value = d.local || '';
    document.getElementById('evento-desc').value = d.desc || '';
    document.getElementById('evento-link').value = d.link || '';
    document.getElementById('evento-visibilidade').value = d.visib || 'Público';
    
    if (d.foto) {
        arteEventoBase64 = d.foto;
        document.getElementById('evento-art-preview').innerHTML = `<img src="${d.foto}" style="width:100%; height:100%; object-fit:cover;">`;
    }

    document.getElementById('modal-rascunhos').style.display = 'none';
    document.getElementById('modal-evento').style.display = 'flex';
    document.getElementById('modal-evento-titulo').innerText = "Restaurar Rascunho";
};

window.excluirRascunho = function(id) {
    let drafts = JSON.parse(localStorage.getItem('go_plus_eventos_drafts') || '[]');
    drafts = drafts.filter(d => d.id !== id);
    localStorage.setItem('go_plus_eventos_drafts', JSON.stringify(drafts));
    abrirModalRascunhos();
};

window.expandirEventoDesc = function(id) {
    const el = document.getElementById(`evento-desc-${id}`);
    const btn = document.getElementById(`btn-mais-evento-${id}`);
    if (el) {
        if (el.style.maxHeight === 'none') {
            el.style.maxHeight = '80px';
            btn.innerText = "... ler mais";
        } else {
            el.style.maxHeight = 'none';
            btn.innerText = "recolher";
        }
    }
};

// --- AÇÕES ---

window.abrirModalEvento = function() {
    eventoModo = 'novo'; eventoIdEmEdicao = null; arteEventoBase64 = null;
    document.getElementById('modal-evento-titulo').innerText = "Novo Evento";
    document.getElementById('btn-salvar-evento').innerText = "Criar Evento";
    document.getElementById('form-evento').reset();
    document.getElementById('evento-art-preview').innerHTML = '<span style="font-size:0.5rem; color:#999;">Sem arte</span>';
    document.getElementById('evento-draft-status').innerText = '';
    document.getElementById('modal-evento').style.display = 'flex';
};

window.prepararEdicaoEvento = async function(id) {
    try {
        const { data: ev, error } = await supabaseClient.from('eventos').select('*').eq('id', id).single();
        if (error) throw error;
        
        eventoModo = 'edit'; eventoIdEmEdicao = id;
        document.getElementById('modal-evento-titulo').innerText = "Editar Evento";
        document.getElementById('btn-salvar-evento').innerText = "Salvar Alterações";
        
        let meta = {}; try { meta = JSON.parse(ev.descricao || '{}'); } catch(e) { meta = { texto: ev.descricao }; }
        
        document.getElementById('evento-titulo').value = ev.titulo || '';
        const valData = ev[COLUNA_DATA_DETECTADA];
        document.getElementById('evento-data').value = valData ? valData.substring(0,16) : '';
        document.getElementById('evento-data-fim').value = meta.data_fim ? meta.data_fim.substring(0,16) : '';
        document.getElementById('evento-local').value = ev.local_evento || '';
        document.getElementById('evento-desc').value = meta.texto || '';
        document.getElementById('evento-link').value = meta.link || '';
        document.getElementById('evento-visibilidade').value = ev.visibilidade || 'Público';
        
        if (meta.foto) {
            arteEventoBase64 = meta.foto;
            document.getElementById('evento-art-preview').innerHTML = `<img src="${meta.foto}" style="width:100%; height:100%; object-fit:cover;">`;
        }
        
        document.getElementById('modal-evento').style.display = 'flex';
    } catch (err) { 
        if (window.showToast) window.showToast("Erro ao carregar evento.");
        else alert("Erro ao carregar: " + err.message); 
    }
};

async function salvarEvento(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-salvar-evento'); btn.disabled = true;
    
    try {
        const meta = {
            texto: document.getElementById('evento-desc').value,
            data_fim: document.getElementById('evento-data-fim').value,
            link: document.getElementById('evento-link').value,
            foto: arteEventoBase64
        };
        
        const dataInput = document.getElementById('evento-data').value;
        const dataISO = new Date(dataInput).toISOString();

        const dados = {
            grupo_id: window.meuGrupoId,
            titulo: document.getElementById('evento-titulo').value,
            local_evento: document.getElementById('evento-local').value,
            descricao: JSON.stringify(meta),
            visibilidade: document.getElementById('evento-visibilidade').value
        };

        // Usa a coluna detectada dinamicamente
        dados[COLUNA_DATA_DETECTADA] = dataISO;

        if (eventoModo === 'edit' && eventoIdEmEdicao) {
            const { error } = await supabaseClient.from('eventos').update(dados).eq('id', eventoIdEmEdicao);
            if (error) throw error;
            window.showToast("Evento atualizado! ✨");
        } else {
            const { error } = await supabaseClient.from('eventos').insert([dados]);
            if (error) throw error;
            window.showToast("Evento criado com sucesso! 🔥");
            
            // Limpa rascunho se foi salvo
            let drafts = JSON.parse(localStorage.getItem('go_plus_eventos_drafts') || '[]');
            drafts = drafts.filter(d => d.titulo !== dados.titulo);
            localStorage.setItem('go_plus_eventos_drafts', JSON.stringify(drafts));
        }
        
        const mesParaRecarregar = new Date(dataInput).getMonth();
        fecharModalEvento(); 
        carregarMesesTabs(mesParaRecarregar);
    } catch (err) { 
        console.error("Erro no salvamento:", err);
        window.showToast("Erro ao salvar dados.");
    } finally { btn.disabled = false; }
}

window.excluirEvento = async function(id) {
    const confirmar = await window.confirmarAcao("Excluir Evento", "Tem certeza que deseja apagar este evento permanentemente?", "🗑️");
    if (!confirmar) return;
    
    try {
        const { error } = await supabaseClient.from('eventos').delete().eq('id', id);
        if (error) throw error;
        window.showToast("Evento removido com sucesso.");
        carregarMesesTabs(mesAtivoEventos);
    } catch (err) { 
        window.showToast("Erro ao excluir.");
    }
};

window.fecharModalEvento = function() { document.getElementById('modal-evento').style.display = 'none'; };
