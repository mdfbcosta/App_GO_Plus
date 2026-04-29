// ==========================================
// MÓDULO: EVENTOS DO GRUPO (DESCOBERTA DINÂMICA)
// ==========================================

let arteEventoBase64 = null;
let eventoModo = 'novo'; 
let eventoIdEmEdicao = null;
let COLUNA_DATA_DETECTADA = 'data_evento'; // Valor padrão inicial

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
    try {
        const { data, error } = await supabaseClient.from('eventos').select('*').limit(1);
        if (data && data.length > 0) {
            const colunas = Object.keys(data[0]);
            console.log("Colunas detectadas em 'eventos':", colunas);
            // Procura por nomes comuns de data
            if (colunas.includes('data_evento')) COLUNA_DATA_DETECTADA = 'data_evento';
            else if (colunas.includes('data')) COLUNA_DATA_DETECTADA = 'data';
            else if (colunas.includes('data_inicio')) COLUNA_DATA_DETECTADA = 'data_inicio';
            else if (colunas.includes('data_reuniao')) COLUNA_DATA_DETECTADA = 'data_reuniao';
            else {
                // Pega a primeira coluna que tenha "data" no nome
                const detectada = colunas.find(c => c.toLowerCase().includes('data'));
                if (detectada) COLUNA_DATA_DETECTADA = detectada;
            }
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

window.autoSaveDraftEvento = function() {
    if (eventoModo === 'edit') return;
    const draft = {
        titulo: document.getElementById('evento-titulo').value,
        data_ini: document.getElementById('evento-data').value,
        data_fim: document.getElementById('evento-data-fim').value,
        local: document.getElementById('evento-local').value,
        desc: document.getElementById('evento-desc').value,
        link: document.getElementById('evento-link').value,
        visib: document.getElementById('evento-visibilidade').value,
        foto: arteEventoBase64
    };
    localStorage.setItem('go_plus_evento_draft', JSON.stringify(draft));
    const st = document.getElementById('evento-draft-status');
    if (st) st.innerText = `Rascunho salvo`;
};

// --- NAVEGAÇÃO ---

window.carregarMesesTabs = function() {
    const container = document.getElementById('meses-tabs'); if (!container) return;
    const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const mesAtual = new Date().getMonth();
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
    carregarEventos(mesAtual);
};

window.carregarEventos = async function(mesIndex) {
    if (!window.meuGrupoId) return;
    const btnNovo = document.getElementById('btn-novo-evento');
    if (btnNovo) btnNovo.style.display = (window.meuCargo === 'Participante') ? 'none' : 'block';

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
            card.className = 'card';
            card.style.cssText = 'margin-bottom: 15px; overflow: hidden; padding: 0;';
            
            let imgHtml = meta.foto ? `<img src="${meta.foto}" style="width:100%; height:150px; object-fit:cover; border-bottom:1px solid #eee;">` : '';
            let dataStr = dIni.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'});
            if (dFim) dataStr += ` até ${dFim.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'})}`;

            card.innerHTML = `
                ${imgHtml}
                <div style="padding:15px;">
                    <div class="flex justify-between items-start">
                        <h4 style="color:var(--primary-blue); font-weight:700; font-size:1rem;">${ev.titulo}</h4>
                        ${ev.visibilidade === 'Privado' ? '<span style="font-size:0.6rem; background:#fee2e2; color:#b91c1c; padding:2px 6px; border-radius:4px;">Privado</span>' : ''}
                    </div>
                    <p style="font-size:0.75rem; color:var(--text-muted); margin:5px 0;">📅 ${dataStr} • ⏰ ${dIni.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}${dFim ? ' - '+dFim.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : ''}</p>
                    <p style="font-size:0.75rem; color:var(--text-muted); margin-bottom:10px;">📍 ${ev.local_evento || 'Local não definido'}</p>
                    <p style="font-size:0.8rem; line-height:1.4;">${meta.texto || 'Sem descrição.'}</p>
                    
                    <div class="flex gap-2" style="margin-top:15px;">
                        ${meta.link ? `<a href="${meta.link}" target="_blank" class="btn btn-primary" style="flex:1; font-size:0.7rem; padding:8px;">🔗 Inscrição / Info</a>` : ''}
                        ${window.meuCargo !== 'Participante' ? `
                            <button onclick="prepararEdicaoEvento('${ev.id}')" class="btn btn-outline" style="font-size:0.7rem; padding:8px;">✏️ Editar</button>
                            <button onclick="excluirEvento('${ev.id}')" class="btn btn-outline" style="color:red; font-size:0.7rem; padding:8px;">🗑️</button>
                        ` : ''}
                    </div>
                </div>
            `;
            lista.appendChild(card);
        });
    } catch (err) { console.error(err); }
};

// --- AÇÕES ---

window.abrirModalEvento = function() {
    eventoModo = 'novo'; eventoIdEmEdicao = null; arteEventoBase64 = null;
    document.getElementById('modal-evento-titulo').innerText = "Novo Evento";
    document.getElementById('btn-salvar-evento').innerText = "Criar Evento";
    document.getElementById('form-evento').reset();
    document.getElementById('evento-art-preview').innerHTML = '<span style="font-size:0.5rem; color:#999;">Sem arte</span>';
    
    const draft = localStorage.getItem('go_plus_evento_draft');
    if (draft) {
        if (confirm("Deseja restaurar o rascunho anterior?")) {
            const d = JSON.parse(draft);
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
        }
    }
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
    } catch (err) { alert("Erro ao carregar: " + err.message); }
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
            alert("Evento atualizado!");
        } else {
            const { error } = await supabaseClient.from('eventos').insert([dados]);
            if (error) throw error;
            alert("Evento criado com sucesso!");
            localStorage.removeItem('go_plus_evento_draft');
        }
        
        fecharModalEvento(); carregarMesesTabs();
    } catch (err) { 
        console.error("Erro no salvamento:", err);
        alert("Erro ao salvar: " + (err.message || "Verifique as colunas") + "\n\nDetectado: " + COLUNA_DATA_DETECTADA); 
    } finally { btn.disabled = false; }
}

window.excluirEvento = async function(id) {
    if (!confirm("Excluir este evento?")) return;
    try {
        const { error } = await supabaseClient.from('eventos').delete().eq('id', id);
        if (error) throw error;
        carregarMesesTabs();
    } catch (err) { alert("Erro ao excluir."); }
};

window.fecharModalEvento = function() { document.getElementById('modal-evento').style.display = 'none'; };
