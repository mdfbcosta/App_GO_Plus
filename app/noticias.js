// ==========================================
// MÓDULO: GERENCIADOR DE NOTÍCIAS (NÚCLEO)
// ==========================================

let noticiasFotosBase64 = [];
let noticiaModo = 'novo';
let noticiaIdEmEdicao = null;

// --- HUB E NAVEGAÇÃO ---

window.mostrarHubNoticias = async function() {
    document.getElementById('noticias-hub').style.display = 'flex';
    document.getElementById('form-noticia-container').style.display = 'none';
    document.getElementById('btn-voltar-noticias-hub').style.display = 'none';
    document.querySelector('.btn-form-noticia').style.display = 'none';

    if (window.meuGrupoId) {
        const { data: ult } = await supabaseClient
            .from('aconteceu_go')
            .select('*')
            .eq('grupo_id', window.meuGrupoId)
            .order('criado_em', { ascending: false })
            .limit(1)
            .maybeSingle();
            
        if (ult) {
            document.getElementById('hub-noticia-edit').style.display = 'flex';
            window.ultimaNoticiaCache = ult;
        } else {
            document.getElementById('hub-noticia-edit').style.display = 'none';
        }
    }
};

window.prepararFormNoticia = function(modo) {
    document.getElementById('noticias-hub').style.display = 'none';
    document.getElementById('form-noticia-container').style.display = 'block';
    document.getElementById('btn-voltar-noticias-hub').style.display = 'block';
    document.querySelector('.btn-form-noticia').style.display = 'block';

    const form = document.getElementById('form-noticia');
    form.reset();
    noticiasFotosBase64 = [];
    document.getElementById('noticia-fotos-previews').innerHTML = '';
    
    const btnPub = document.getElementById('btn-publicar-noticia');
    noticiaModo = 'novo';
    noticiaIdEmEdicao = null;
    btnPub.innerText = "Publicar Notícia";

    if (modo === 'edit' && window.ultimaNoticiaCache) {
        const n = window.ultimaNoticiaCache;
        noticiaModo = 'edit';
        noticiaIdEmEdicao = n.id;
        btnPub.innerText = "Salvar Alterações";
        
        document.getElementById('noticia-titulo-input').value = n.titulo || '';
        document.getElementById('noticia-texto-input').value = n.texto || '';
        
        let fotos = [];
        try { fotos = typeof n.fotos === 'string' ? JSON.parse(n.fotos) : (n.fotos || []); } catch(e){}
        noticiasFotosBase64 = fotos;
        renderPreviewsNoticia();
    }
    atualizarContadorFotosNoticia();
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
        // Usando a função de compressão do resumo.js se disponível, senão direto
        if (typeof comprimirImagem === 'function') {
            noticiasFotosBase64.push(await comprimirImagem(base64));
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
    c.innerHTML = '';
    noticiasFotosBase64.forEach((src, i) => {
        const div = document.createElement('div');
        div.style.position = 'relative';
        div.style.width = '80px';
        div.innerHTML = `
            <img src="${src}" style="width:80px; height:80px; object-fit:cover; border-radius:8px; border:2px solid #eee;">
            <button onclick="removerFotoNoticia(${i})" style="position:absolute; top:-5px; right:-5px; background:white; border:1px solid #ddd; border-radius:50%; width:20px; height:20px; font-size:12px; color:red; cursor:pointer;">&times;</button>
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
    btn.disabled = true;
    const originalText = btn.innerText;
    btn.innerText = "Salvando...";

    try {
        const titulo = document.getElementById('noticia-titulo-input').value;
        const texto = document.getElementById('noticia-texto-input').value;
        
        const dados = {
            grupo_id: window.meuGrupoId,
            membro_id: window.meuMembroId,
            titulo: titulo,
            texto: texto,
            fotos: noticiasFotosBase64,
            reacoes: noticiaModo === 'novo' ? [] : undefined // Mantém reações se estiver editando
        };

        if (noticiaModo === 'edit' && noticiaIdEmEdicao) {
            const { error } = await supabaseClient
                .from('aconteceu_go')
                .update(dados)
                .eq('id', noticiaIdEmEdicao);
            if (error) throw error;
            alert("Notícia atualizada!");
        } else {
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

// --- INTERAÇÃO (CURTIR) ---

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
            // Remove o like se já existir
            lista.splice(index, 1);
        } else {
            // Adiciona o like
            lista.push({ membro_id: window.meuMembroId, criado_em: new Date() });
        }
        
        await supabaseClient
            .from('aconteceu_go')
            .update({ reacoes: lista })
            .eq('id', noticiaId);
            
        // Atualiza a UI do card no dashboard sem recarregar tudo
        const countEl = document.getElementById(`noticia-like-count-${noticiaId}`);
        const iconEl = document.getElementById(`noticia-like-icon-${noticiaId}`);
        if (countEl) countEl.innerText = lista.length;
        if (iconEl) iconEl.style.color = index > -1 ? '#64748b' : '#ef4444';
        
    } catch (e) {
        console.error("Erro ao curtir:", e);
    }
};
