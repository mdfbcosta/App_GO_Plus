// ==========================================
// MÓDULO: GERENCIADOR DE NOTÍCIAS (NÚCLEO)
// ==========================================

let noticiasFotosBase64 = [];
let noticiaModo = 'novo';
let noticiaIdEmEdicao = null;

// --- HUB E NAVEGAÇÃO ---

window.mostrarHubNoticias = async function() {
    console.log("Abrindo Hub de Notícias...");
    const hub = document.getElementById('noticias-hub');
    const container = document.getElementById('form-noticia-container');
    const btnVoltar = document.getElementById('btn-voltar-noticias-hub');
    const btnPub = document.getElementById('btn-publicar-noticia');

    if (hub) hub.style.display = 'flex';
    if (container) container.style.display = 'none';
    if (btnVoltar) btnVoltar.style.display = 'none';
    if (btnPub) btnPub.style.display = 'none';

    if (window.meuGrupoId) {
        try {
            const { data: ult } = await supabaseClient
                .from('aconteceu_go')
                .select('*')
                .eq('grupo_id', window.meuGrupoId)
                .order('criado_em', { ascending: false })
                .limit(1)
                .maybeSingle();
                
            const btnEdit = document.getElementById('hub-noticia-edit');
            if (ult && btnEdit) {
                btnEdit.style.display = 'flex';
                window.ultimaNoticiaCache = ult;
            } else if (btnEdit) {
                btnEdit.style.display = 'none';
            }
        } catch(e) { console.error("Erro ao carregar cache de notícia:", e); }
    }
};

window.prepararFormNoticia = function(modo) {
    console.log("Preparando formulário de notícia:", modo);
    
    try {
        const hub = document.getElementById('noticias-hub');
        const container = document.getElementById('form-noticia-container');
        const btnVoltar = document.getElementById('btn-voltar-noticias-hub');
        const btnPub = document.getElementById('btn-publicar-noticia');

        if (hub) hub.style.display = 'none';
        if (container) container.style.display = 'block';
        if (btnVoltar) btnVoltar.style.display = 'block';
        if (btnPub) {
            btnPub.style.display = 'block';
            btnPub.innerText = modo === 'edit' ? "Salvar Alterações" : "Publicar Notícia";
        }

        const form = document.getElementById('form-noticia');
        if (form) form.reset();
        
        noticiasFotosBase64 = [];
        const previews = document.getElementById('noticia-fotos-previews');
        if (previews) previews.innerHTML = '';
        
        noticiaModo = modo;
        noticiaIdEmEdicao = null;

        if (modo === 'edit' && window.ultimaNoticiaCache) {
            const n = window.ultimaNoticiaCache;
            noticiaIdEmEdicao = n.id;
            
            const inputTitulo = document.getElementById('noticia-titulo-input');
            const inputTexto = document.getElementById('noticia-texto-input');
            
            if (inputTitulo) inputTitulo.value = n.titulo || '';
            if (inputTexto) inputTexto.value = n.texto || '';
            
            let fotos = [];
            try { fotos = typeof n.fotos === 'string' ? JSON.parse(n.fotos) : (n.fotos || []); } catch(e){}
            noticiasFotosBase64 = fotos;
            renderPreviewsNoticia();
        }
        atualizarContadorFotosNoticia();
    } catch(err) {
        console.error("Falha crítica ao preparar formulário:", err);
        alert("Erro ao abrir o editor. Verifique o console.");
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
};

function renderPreviewsNoticia() {
    const c = document.getElementById('noticia-fotos-previews');
    if (!c) return;
    c.innerHTML = '';
    noticiasFotosBase64.forEach((src, i) => {
        const div = document.createElement('div');
        div.style.position = 'relative';
        div.style.width = '80px';
        div.innerHTML = `
            <img src="${src}" style="width:80px; height:80px; object-fit:cover; border-radius:8px; border:2px solid #eee;">
            <button type="button" onclick="removerFotoNoticia(${i})" style="position:absolute; top:-5px; right:-5px; background:white; border:1px solid #ddd; border-radius:50%; width:20px; height:20px; font-size:12px; color:red; cursor:pointer;">&times;</button>
        `;
        c.appendChild(div);
    });
}

window.removerFotoNoticia = function(index) {
    noticiasFotosBase64.splice(index, 1);
    renderPreviewsNoticia();
    atualizarContadorFotosNoticia();
};

window.atualizarContadorFotosNoticia = function() {
    const el = document.getElementById('noticia-fotos-contador');
    if (el) el.innerText = 5 - noticiasFotosBase64.length > 0 ? `Escolha mais ${5 - noticiasFotosBase64.length} fotos` : "Limite atingido";
};

window.publicarNoticia = async function() {
    if (!window.meuGrupoId) return;
    const btn = document.getElementById('btn-publicar-noticia');
    if (!btn) return;

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
        const dados = {
            grupo_id: window.meuGrupoId,
            membro_id: window.meuMembroId,
            titulo: titulo,
            texto: texto,
            fotos: noticiasFotosBase64
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
            iconEl.parentElement.style.color = index > -1 ? '#64748b' : '#ef4444';
        }
        
    } catch (e) { console.error("Erro ao curtir:", e); }
};
