// ==========================================
// MÓDULO: GERENCIADOR DE NOTÍCIAS (NÚCLEO)
// ==========================================

let noticiasFotosBase64 = [];
let noticiaModo = 'novo';
let noticiaIdEmEdicao = null;
let listaNoticiasCache = [];

// --- HUB E NAVEGAÇÃO ---

window.mostrarHubNoticias = async function() {
    console.log("HUB: Iniciando carregamento...");
    const hub = document.getElementById('noticias-hub');
    const container = document.getElementById('form-noticia-container');
    const btnVoltar = document.getElementById('btn-voltar-noticias-hub');
    const btnForms = document.querySelectorAll('.btn-form-noticia');

    if (hub) hub.style.display = 'flex';
    if (container) container.style.display = 'none';
    if (btnVoltar) btnVoltar.style.display = 'none';
    btnForms.forEach(b => b.style.display = 'none');

    // Verificar Rascunho Local
    const saved = localStorage.getItem('go_plus_noticia_draft');
    const btnDraft = document.getElementById('hub-noticia-draft');
    if (btnDraft) btnDraft.style.display = saved ? 'flex' : 'none';

    await carregarListaNoticiasHub();
};

async function carregarListaNoticiasHub() {
    const container = document.getElementById('hub-lista-noticias');
    if (!container) return;

    try {
        const umMesAtras = new Date();
        umMesAtras.setDate(umMesAtras.getDate() - 30);

        const { data, error } = await supabaseClient
            .from('aconteceu_go')
            .select('*')
            .eq('grupo_id', window.meuGrupoId)
            .gte('criado_em', umMesAtras.toISOString())
            .order('criado_em', { ascending: false });

        if (error) throw error;
        listaNoticiasCache = data || [];

        container.innerHTML = '';
        if (listaNoticiasCache.length === 0) {
            container.innerHTML = '<p style="font-size: 0.8rem; color: var(--text-muted); text-align: center; padding: 20px;">Nenhuma notícia nos últimos 30 dias.</p>';
            return;
        }

        listaNoticiasCache.forEach(n => {
            let dataOcorridoMeta = null;
            try {
                const meta = typeof n.fotos === 'string' ? JSON.parse(n.fotos) : n.fotos;
                if (meta && meta.data_ocorrido) dataOcorridoMeta = meta.data_ocorrido;
            } catch(e){}

            const dataStr = dataOcorridoMeta ? new Date(dataOcorridoMeta + 'T12:00:00').toLocaleDateString('pt-BR') : new Date(n.criado_em).toLocaleDateString('pt-BR');
            
            const item = document.createElement('div');
            item.className = 'noticia-item-hub';
            item.style.display = 'flex';
            item.style.justifyContent = 'space-between';
            item.style.alignItems = 'center';
            item.style.padding = '12px';
            item.style.background = '#f8fafc';
            item.style.borderRadius = '10px';
            item.style.border = '1px solid #e2e8f0';
            item.style.marginBottom = '8px';
            
            item.innerHTML = `
                <div style="flex: 1; min-width: 0;">
                    <div style="font-size: 0.85rem; font-weight: 700; color: var(--primary-blue); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${n.titulo || 'Sem título'}</div>
                    <div style="font-size: 0.7rem; color: var(--text-muted);">📅 ${dataStr}</div>
                </div>
                <div class="flex gap-2" style="margin-left: 10px;">
                    <button type="button" class="btn-edit-noticia" data-id="${n.id}" style="background:none; border:none; color:var(--primary-blue); font-size:1.2rem; cursor:pointer; padding:8px;" title="Editar">✏️</button>
                    <button type="button" class="btn-delete-noticia" data-id="${n.id}" style="background:none; border:none; color:var(--primary-red); font-size:1.2rem; cursor:pointer; padding:8px;" title="Excluir">🗑️</button>
                </div>
            `;
            
            // Event Listeners Diretos (Reforço)
            const bEdit = item.querySelector('.btn-edit-noticia');
            const bDel = item.querySelector('.btn-delete-noticia');
            
            if (bEdit) bEdit.onclick = (e) => { e.preventDefault(); window.prepararEdicaoNoticia(n.id); };
            if (bDel) bDel.onclick = (e) => { e.preventDefault(); window.excluirNoticia(n.id); };

            container.appendChild(item);
        });

    } catch (e) {
        console.error("Erro no Hub:", e);
        container.innerHTML = '<p style="color: var(--primary-red); font-size: 0.8rem; text-align: center;">Erro ao carregar lista.</p>';
    }
}

window.prepararEdicaoNoticia = function(id) {
    console.log("Editando:", id);
    const noticia = listaNoticiasCache.find(n => n.id == id);
    if (!noticia) return;
    window.noticiaParaEditarCache = noticia;
    prepararFormNoticia('edit_specific');
};

window.excluirNoticia = async function(id) {
    console.log("Excluindo:", id);
    if (!confirm("Confirmar exclusão permanente desta notícia?")) return;

    try {
        const { error } = await supabaseClient
            .from('aconteceu_go')
            .delete()
            .eq('id', id);

        if (error) throw error;
        alert("Notícia removida!");
        await carregarListaNoticiasHub();
        if (window.carregarDashboard) window.carregarDashboard();
    } catch (e) {
        alert("Erro ao excluir. Tente novamente.");
    }
};

window.prepararFormNoticia = function(modo) {
    try {
        const hub = document.getElementById('noticias-hub');
        const container = document.getElementById('form-noticia-container');
        const btnVoltar = document.getElementById('btn-voltar-noticias-hub');
        const btnForms = document.querySelectorAll('.btn-form-noticia');

        if (hub) hub.style.display = 'none';
        if (container) container.style.display = 'block';
        if (btnVoltar) btnVoltar.style.display = 'block';
        btnForms.forEach(b => b.style.display = 'block');

        const btnPub = document.getElementById('btn-publicar-noticia');
        const form = document.getElementById('form-noticia');
        if (form) form.reset();
        
        noticiasFotosBase64 = [];
        const previews = document.getElementById('noticia-fotos-previews');
        if (previews) previews.innerHTML = '';
        
        noticiaModo = 'novo';
        noticiaIdEmEdicao = null;
        if (btnPub) btnPub.innerText = "Publicar Notícia";

        if (modo === 'rascunho') {
            const saved = JSON.parse(localStorage.getItem('go_plus_noticia_draft'));
            if (saved) {
                document.getElementById('noticia-data-input').value = saved.data || '';
                document.getElementById('noticia-titulo-input').value = saved.titulo || '';
                document.getElementById('noticia-texto-input').value = saved.texto || '';
                noticiasFotosBase64 = saved.fotos || [];
                renderPreviewsNoticia();
            }
        } else if (modo === 'edit_specific' && window.noticiaParaEditarCache) {
            const n = window.noticiaParaEditarCache;
            noticiaIdEmEdicao = n.id;
            noticiaModo = 'edit';
            if (btnPub) btnPub.innerText = "Salvar Alterações";
            
            let dataOcorrido = '';
            let fotos = [];
            try {
                const meta = typeof n.fotos === 'string' ? JSON.parse(n.fotos) : n.fotos;
                if (Array.isArray(meta)) {
                    fotos = meta;
                } else if (meta && meta.urls) {
                    fotos = meta.urls;
                    dataOcorrido = meta.data_ocorrido || '';
                }
            } catch(e){}

            document.getElementById('noticia-data-input').value = dataOcorrido;
            document.getElementById('noticia-titulo-input').value = n.titulo || '';
            document.getElementById('noticia-texto-input').value = n.texto || '';
            noticiasFotosBase64 = fotos;
            renderPreviewsNoticia();
        }
        atualizarContadorFotosNoticia();
    } catch(err) {
        console.error(err);
        alert("Erro ao abrir o editor.");
    }
};

window.previewFotosNoticia = async function(event) {
    const files = event.target.files;
    let vagas = 5 - noticiasFotosBase64.length;
    if (vagas <= 0) return;

    for (let i = 0; i < Math.min(files.length, vagas); i++) {
        const reader = new FileReader();
        const base64 = await new Promise(r => {
            reader.onload = (e) => r(e.target.result);
            reader.readAsDataURL(files[i]);
        });
        
        if (window.comprimirImagem) {
            noticiasFotosBase64.push(await window.comprimirImagem(base64));
        } else {
            noticiasFotosBase64.push(base64);
        }
    }
    event.target.value = '';
    renderPreviewsNoticia();
    atualizarContadorFotosNoticia();
    autoSaveNoticiaDraft();
};

function renderPreviewsNoticia() {
    const c = document.getElementById('noticia-fotos-previews');
    if (!c) return;
    c.innerHTML = '';
    noticiasFotosBase64.forEach((src, i) => {
        const div = document.createElement('div');
        div.style.position = 'relative';
        div.style.width = '80px';
        const isCapa = i === 0;
        div.innerHTML = `
            <img src="${src}" style="width:80px; height:80px; object-fit:cover; border-radius:8px; border:2px solid ${isCapa ? 'var(--primary-red)' : '#eee'};">
            <button type="button" onclick="removerFotoNoticia(${i})" style="position:absolute; top:-5px; right:-5px; background:white; border:1px solid #ddd; border-radius:50%; width:20px; height:20px; font-size:12px; color:red; cursor:pointer;">&times;</button>
            ${isCapa ? 
                '<span style="position:absolute; bottom:0; left:0; width:100%; background:var(--primary-red); color:white; font-size:0.5rem; text-align:center; border-radius:0 0 8px 8px; font-weight:800;">CAPA</span>' : 
                `<button type="button" onclick="definirCapaNoticia(${i})" style="position:absolute; bottom:0; left:0; width:100%; background:rgba(255,255,255,0.8); border:none; color:var(--primary-blue); font-size:0.5rem; text-align:center; border-radius:0 0 8px 8px; cursor:pointer;">Capa</button>`
            }
        `;
        c.appendChild(div);
    });
}

window.definirCapaNoticia = function(index) {
    const f = noticiasFotosBase64.splice(index, 1)[0];
    noticiasFotosBase64.unshift(f);
    renderPreviewsNoticia();
    autoSaveNoticiaDraft();
};

window.removerFotoNoticia = function(index) {
    noticiasFotosBase64.splice(index, 1);
    renderPreviewsNoticia();
    atualizarContadorFotosNoticia();
    autoSaveNoticiaDraft();
};

window.atualizarContadorFotosNoticia = function() {
    const el = document.getElementById('noticia-fotos-contador');
    if (el) el.innerText = 5 - noticiasFotosBase64.length > 0 ? `Escolha mais ${5 - noticiasFotosBase64.length} fotos` : "Limite atingido";
};

window.autoSaveNoticiaDraft = function() {
    if (noticiaModo === 'edit') return;
    const draft = {
        data: document.getElementById('noticia-data-input').value,
        titulo: document.getElementById('noticia-titulo-input').value,
        texto: document.getElementById('noticia-texto-input').value,
        fotos: noticiasFotosBase64
    };
    localStorage.setItem('go_plus_noticia_draft', JSON.stringify(draft));
    const st = document.getElementById('noticia-draft-status');
    if (st) st.innerText = `Salvo: ${new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;
};

window.salvarRascunhoNoticia = function() {
    autoSaveNoticiaDraft();
    alert("Rascunho salvo localmente!");
    mostrarHubNoticias();
};

window.publicarNoticia = async function() {
    if (!window.meuGrupoId) return;
    const btn = document.getElementById('btn-publicar-noticia');
    if (!btn) return;

    const dataOcorrido = document.getElementById('noticia-data-input').value;
    const titulo = document.getElementById('noticia-titulo-input').value.trim();
    const texto = document.getElementById('noticia-texto-input').value.trim();

    if (!texto) {
        alert("O conteúdo da notícia é obrigatório.");
        return;
    }

    btn.disabled = true;
    const originalText = btn.innerText;
    btn.innerText = "Salvando...";

    try {
        const meta = {
            urls: noticiasFotosBase64,
            data_ocorrido: dataOcorrido
        };

        const dados = {
            grupo_id: window.meuGrupoId,
            membro_id: window.meuMembroId,
            titulo: titulo,
            texto: texto,
            fotos: JSON.stringify(meta)
        };

        if (noticiaModo === 'edit' && noticiaIdEmEdicao) {
            const { error } = await supabaseClient
                .from('aconteceu_go')
                .update(dados)
                .eq('id', noticiaIdEmEdicao);
            if (error) throw error;
            alert("Notícia atualizada!");
        } else {
            dados.reacoes = [];
            const { error } = await supabaseClient
                .from('aconteceu_go')
                .insert([dados]);
            if (error) throw error;
            alert("Notícia publicada com sucesso!");
            localStorage.removeItem('go_plus_noticia_draft');
        }

        mostrarHubNoticias();
        if (window.carregarDashboard) window.carregarDashboard();
        if (window.alternarView) window.alternarView('view-dashboard');

    } catch (err) {
        alert("Erro ao publicar: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
};

window.reagirNoticia = async function(noticiaId) {
    try {
        const { data } = await supabaseClient
            .from('aconteceu_go')
            .select('reacoes')
            .eq('id', noticiaId)
            .single();
            
        let lista = data.reacoes || [];
        const index = lista.findIndex(r => r.membro_id === window.meuMembroId);
        
        if (index > -1) {
            lista.splice(index, 1);
        } else {
            lista.push({ membro_id: window.meuMembroId, criado_em: new Date() });
        }
        
        await supabaseClient
            .from('aconteceu_go')
            .update({ reacoes: lista })
            .eq('id', noticiaId);
            
        const countEl = document.getElementById(`noticia-like-count-${noticiaId}`);
        const iconEl = document.getElementById(`noticia-like-icon-${noticiaId}`);
        if (countEl) countEl.innerText = lista.length;
        if (iconEl) {
            iconEl.innerText = index > -1 ? '🤍' : '❤️';
            iconEl.style.color = index > -1 ? '#262626' : '#ed4956';
        }
        
    } catch (e) { console.error("Erro ao curtir:", e); }
};
