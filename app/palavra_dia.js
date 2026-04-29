// ==========================================
// MÓDULO: PALAVRA DO DIA (EDITORIAL PREMIUM)
// ==========================================

let palavraIdEmEdicao = null;
let palavraModo = 'novo';
let listaPalavrasCache = [];
let mediaRecorder;
let audioChunks = [];

// --- HUB E NAVEGAÇÃO ---

window.mostrarHubPalavra = async function() {
    console.log("Palavra Hub: Iniciando...");
    const hub = document.getElementById('palavra-hub');
    const container = document.getElementById('form-palavra-container');
    
    if (hub) hub.style.display = 'block';
    if (container) container.style.display = 'none';

    // Verificar Rascunho Local
    const saved = localStorage.getItem('go_plus_palavra_draft');
    const btnDraft = document.getElementById('hub-palavra-draft');
    if (btnDraft) btnDraft.style.display = saved ? 'flex' : 'none';

    await carregarListaPalavrasHub();
};

async function carregarListaPalavrasHub() {
    const container = document.getElementById('hub-lista-palavras');
    if (!container) return;

    try {
        const inicio = new Date();
        inicio.setDate(inicio.getDate() - 7);
        const fim = new Date();
        fim.setDate(fim.getDate() + 30);

        const { data, error } = await supabaseClient
            .from('palavra_dia')
            .select('*')
            .eq('grupo_id', window.meuGrupoId)
            .gte('data_publicacao', inicio.toISOString().split('T')[0])
            .lte('data_publicacao', fim.toISOString().split('T')[0])
            .order('data_publicacao', { ascending: true });

        if (error) throw error;
        listaPalavrasCache = data || [];

        container.innerHTML = '';
        if (listaPalavrasCache.length === 0) {
            container.innerHTML = '<p style="font-size: 0.8rem; color: var(--text-muted); text-align: center; padding: 20px;">Nenhuma publicação agendada para os próximos 30 dias.</p>';
            return;
        }

        listaPalavrasCache.forEach(p => {
            const dataStr = new Date(p.data_publicacao + 'T12:00:00').toLocaleDateString('pt-BR');
            const icones = {
                'texto': '📖',
                'video': '🎥',
                'audio': '🎧',
                'imagem': '🖼️',
                'desafio': '🔥'
            };

            const item = document.createElement('div');
            item.className = 'card';
            item.style.display = 'flex';
            item.style.justifyContent = 'space-between';
            item.style.alignItems = 'center';
            item.style.padding = '12px';
            item.style.background = '#f8fafc';
            item.style.marginBottom = '8px';
            
            item.innerHTML = `
                <div style="flex: 1; min-width: 0;">
                    <div style="font-size: 0.85rem; font-weight: 700; color: var(--primary-blue);">
                        ${icones[p.tipo] || '📝'} ${p.tipo.toUpperCase()}
                    </div>
                    <div style="font-size: 0.7rem; color: var(--text-muted);">
                        📅 ${dataStr} • Status: <span style="color: ${p.status === 'publicado' ? '#16a34a' : '#f59e0b'}">${p.status}</span>
                    </div>
                </div>
                <div class="flex gap-2">
                    <div style="font-size: 0.75rem; color: #16a34a; font-weight: 800; background: #f0fdf4; padding: 2px 8px; border-radius: 10px; display: flex; align-items: center; gap: 4px;" title="Leituras confirmadas">
                        ✅ <span id="palavra-count-${p.id}">...</span>
                    </div>
                    <button onclick="window.prepararEdicaoPalavra('${p.id}')" style="background:none; border:none; color:var(--primary-blue); cursor:pointer; padding:5px;">✏️</button>
                    <button onclick="window.excluirPalavra('${p.id}')" style="background:none; border:none; color:var(--primary-red); cursor:pointer; padding:5px;">🗑️</button>
                </div>
            `;
            container.appendChild(item);
            carregarContadorLeituras(p.id);
        });

    } catch (e) {
        console.error("Erro no Hub Palavra:", e);
        container.innerHTML = '<p style="color: var(--primary-red); font-size: 0.8rem; text-align: center;">Erro ao carregar lista.</p>';
    }
}

window.prepararFormPalavra = function(modo) {
    const hub = document.getElementById('palavra-hub');
    const container = document.getElementById('form-palavra-container');
    const form = document.getElementById('form-palavra');
    const titulo = document.getElementById('palavra-form-titulo');
    const btnPub = document.getElementById('btn-publicar-palavra');

    if (hub) hub.style.display = 'none';
    if (container) container.style.display = 'block';
    if (form) form.reset();

    palavraIdEmEdicao = null;
    palavraModo = 'novo';
    titulo.innerText = "Nova Palavra do Dia";
    btnPub.innerText = "Publicar Agora";

    if (modo === 'rascunho') {
        const saved = JSON.parse(localStorage.getItem('go_plus_palavra_draft'));
        if (saved) {
            document.getElementById('palavra-data-input').value = saved.data || '';
            document.getElementById('palavra-tipo-select').value = saved.tipo || 'texto';
            window.alternarCamposPalavra(saved.conteudo);
        }
    } else {
        window.alternarCamposPalavra();
    }
};

window.prepararEdicaoPalavra = function(id) {
    const palavra = listaPalavrasCache.find(p => p.id === id);
    if (!palavra) return;

    palavraIdEmEdicao = id;
    palavraModo = 'edit';
    
    document.getElementById('palavra-hub').style.display = 'none';
    document.getElementById('form-palavra-container').style.display = 'block';
    document.getElementById('palavra-form-titulo').innerText = "Editar Palavra do Dia";
    document.getElementById('btn-publicar-palavra').innerText = "Salvar Alterações";

    document.getElementById('palavra-data-input').value = palavra.data_publicacao;
    document.getElementById('palavra-tipo-select').value = palavra.tipo;
    window.alternarCamposPalavra(palavra.conteudo);
};

window.alternarCamposPalavra = function(conteudoExistente = null) {
    const tipo = document.getElementById('palavra-tipo-select').value;
    const container = document.getElementById('campos-palavra-dinamicos');
    container.innerHTML = '';

    const createField = (label, id, type = 'text', placeholder = '', isTextarea = false) => {
        const val = conteudoExistente ? conteudoExistente[id] || '' : '';
        const wrapper = document.createElement('div');
        wrapper.innerHTML = `
            <label style="font-size:0.7rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">${label}</label>
            ${isTextarea ? 
                `<textarea id="${id}" class="input-field" style="min-height:100px;" placeholder="${placeholder}" oninput="window.autoSavePalavraDraft()">${val}</textarea>` : 
                `<input type="${type}" id="${id}" class="input-field" placeholder="${placeholder}" value="${val}" oninput="window.autoSavePalavraDraft()">`
            }
        `;
        return wrapper;
    };

    if (tipo === 'texto') {
        container.appendChild(createField('Versículo / Texto', 'texto', 'text', 'Ex: Tudo posso naquele que me fortalece.', true));
        container.appendChild(createField('Referência Bíblica', 'referencia', 'text', 'Ex: Filipenses 4,13'));
    } else if (tipo === 'video') {
        container.innerHTML += `
            <div class="card" style="padding:10px; background:#f1f5f9; margin-bottom:10px;">
                <label style="font-size:0.65rem; font-weight:800; color:var(--primary-blue);">OPÇÃO 1: LINK YOUTUBE/VIMEO</label>
                <input type="url" id="url" class="input-field" placeholder="https://youtube.com/..." value="${conteudoExistente?.url || ''}" oninput="window.autoSavePalavraDraft()">
                <hr style="margin:10px 0; border:none; border-top:1px solid #cbd5e1;">
                <label style="font-size:0.65rem; font-weight:800; color:var(--primary-blue);">OPÇÃO 2: UPLOAD ARQUIVO (MP4)</label>
                <input type="file" id="file-upload" class="input-field" accept="video/*" onchange="window.uploadArquivoMidia(this)">
                <input type="hidden" id="upload-url" value="${conteudoExistente?.upload_url || ''}">
            </div>
        `;
        container.appendChild(createField('Legenda Opcional', 'legenda', 'text', '', true));
    } else if (tipo === 'audio') {
        container.innerHTML += `
            <div class="card" style="padding:15px; background:#f1f5f9; margin-bottom:10px; text-align:center;">
                <label style="font-size:0.65rem; font-weight:800; color:var(--primary-blue); display:block; margin-bottom:10px;">GRAVAR ÁUDIO AGORA</label>
                <div class="flex justify-center gap-4">
                    <button id="btn-mic-start" class="btn" style="background:#ef4444; color:white; width:50px; height:50px; border-radius:50%; display:flex; align-items:center; justify-content:center;" onclick="window.iniciarGravacaoAudio()">🎤</button>
                    <button id="btn-mic-stop" class="btn" style="background:#1e293b; color:white; width:50px; height:50px; border-radius:50%; display:none; align-items:center; justify-content:center;" onclick="window.pararGravacaoAudio()">⏹️</button>
                </div>
                <div id="mic-timer" style="font-size:0.8rem; font-weight:700; margin-top:5px; display:none;">00:00</div>
                <audio id="audio-preview" controls style="display:none; width:100%; margin-top:10px;"></audio>
                <hr style="margin:15px 0; border:none; border-top:1px solid #cbd5e1;">
                <label style="font-size:0.65rem; font-weight:800; color:var(--primary-blue);">OU UPLOAD DE MP3</label>
                <input type="file" id="file-upload-audio" class="input-field" accept="audio/*" onchange="window.uploadArquivoMidia(this)">
                <input type="hidden" id="upload-url" value="${conteudoExistente?.upload_url || ''}">
            </div>
        `;
        container.appendChild(createField('Título do Áudio', 'titulo', 'text', 'Ex: Podcast de hoje'));
    } else if (tipo === 'imagem') {
        container.innerHTML += `
            <div class="card" style="padding:10px; background:#f1f5f9; margin-bottom:10px;">
                <label style="font-size:0.65rem; font-weight:800; color:var(--primary-blue);">UPLOAD DA IMAGEM</label>
                <input type="file" id="file-upload-img" class="input-field" accept="image/*" onchange="window.uploadArquivoMidia(this)">
                <input type="hidden" id="upload-url" value="${conteudoExistente?.upload_url || ''}">
            </div>
        `;
        container.appendChild(createField('Legenda', 'legenda', 'text', '', true));
    } else if (tipo === 'desafio') {
        container.appendChild(createField('O Desafio', 'desafio_titulo', 'text', 'Ex: Jejum de Redes Sociais'));
        container.appendChild(createField('Descrição do Desafio', 'descricao', 'text', 'Explique o que fazer hoje...', true));
    }
};

window.uploadArquivoMidia = async function(input) {
    const file = input.files[0];
    if (!file) return;
    const btn = document.getElementById('btn-publicar-palavra');
    btn.disabled = true;
    btn.innerText = "Subindo arquivo...";

    try {
        const ext = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
        const filePath = `${window.meuGrupoId}/${fileName}`;
        const { error } = await supabaseClient.storage.from('palavra_dia').upload(filePath, file);
        if (error) throw error;
        const { data: { publicUrl } } = supabaseClient.storage.from('palavra_dia').getPublicUrl(filePath);
        document.getElementById('upload-url').value = publicUrl;
        window.showToast("Arquivo pronto!");
    } catch (e) {
        alert("Erro no upload: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerText = palavraIdEmEdicao ? "Salvar Alterações" : "Publicar Agora";
    }
};

window.iniciarGravacaoAudio = async function() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/mp3' });
            const file = new File([audioBlob], "gravacao.mp3", { type: "audio/mp3" });
            await window.uploadArquivoMidia({ files: [file] });
            const preview = document.getElementById('audio-preview');
            if (preview) { preview.src = URL.createObjectURL(audioBlob); preview.style.display = 'block'; }
        };
        mediaRecorder.start();
        document.getElementById('btn-mic-start').style.display = 'none';
        document.getElementById('btn-mic-stop').style.display = 'flex';
        document.getElementById('mic-timer').style.display = 'block';
        let sec = 0;
        window.micTimerInterval = setInterval(() => {
            sec++;
            const m = Math.floor(sec/60).toString().padStart(2,'0');
            const s = (sec%60).toString().padStart(2,'0');
            document.getElementById('mic-timer').innerText = `${m}:${s}`;
        }, 1000);
    } catch (e) { alert("Erro microfone: " + e.message); }
};

window.pararGravacaoAudio = function() {
    if (mediaRecorder) mediaRecorder.stop();
    clearInterval(window.micTimerInterval);
    document.getElementById('btn-mic-start').style.display = 'flex';
    document.getElementById('btn-mic-stop').style.display = 'none';
};

window.autoSavePalavraDraft = function() {
    if (palavraModo === 'edit') return;
    const conteudo = {};
    const campos = document.querySelectorAll('#campos-palavra-dinamicos .input-field');
    campos.forEach(c => conteudo[c.id] = c.value);
    const draft = {
        data: document.getElementById('palavra-data-input').value,
        tipo: document.getElementById('palavra-tipo-select').value,
        conteudo: conteudo
    };
    localStorage.setItem('go_plus_palavra_draft', JSON.stringify(draft));
};

window.publicarPalavra = async function() {
    const btn = document.getElementById('btn-publicar-palavra');
    const dataPub = document.getElementById('palavra-data-input').value;
    const tipo = document.getElementById('palavra-tipo-select').value;

    if (!dataPub) return alert("Selecione uma data.");

    const conteudo = {};
    const campos = document.querySelectorAll('#campos-palavra-dinamicos .input-field');
    campos.forEach(c => conteudo[c.id] = c.value);
    
    // Pegar URL do upload se houver
    const upUrl = document.getElementById('upload-url')?.value;
    if (upUrl) conteudo.upload_url = upUrl;

    btn.disabled = true;
    const originalText = btn.innerText;
    btn.innerText = "Salvando...";

    try {
        const dados = {
            grupo_id: window.meuGrupoId,
            membro_id: window.meuMembroId,
            data_publicacao: dataPub,
            tipo: tipo,
            conteudo: conteudo,
            status: 'publicado'
        };

        if (palavraIdEmEdicao) {
            const { error } = await supabaseClient.from('palavra_dia').update(dados).eq('id', palavraIdEmEdicao);
            if (error) throw error;
        } else {
            const { error } = await supabaseClient.from('palavra_dia').insert([dados]);
            if (error) throw error;
            localStorage.removeItem('go_plus_palavra_draft');
        }

        alert("Publicado com sucesso!");
        window.mostrarHubPalavra();
        if (window.carregarDashboard) window.carregarDashboard();
    } catch (e) { alert("Erro: " + e.message); }
    finally { btn.disabled = false; btn.innerText = originalText; }
};

window.excluirPalavra = async function(id) {
    const confirmacao = await window.confirmarAcao("Excluir?", "Deseja remover esta Palavra?", "🗑️");
    if (!confirmacao) return;
    try {
        await supabaseClient.from('palavra_dia').delete().eq('id', id);
        alert("Excluído!");
        carregarListaPalavrasHub();
        if (window.carregarDashboard) window.carregarDashboard();
    } catch (e) { alert("Erro: " + e.message); }
};

window.carregarPalavraDiaHome = async function() {
    console.log("Iniciando carga da Palavra do Dia na Home...");
    const container = document.getElementById('palavra-dia-content');
    if (!container) return;
    try {
        // Obter data local no formato YYYY-MM-DD
        const d = new Date();
        const hojeLocal = d.getFullYear() + '-' + 
                         String(d.getMonth() + 1).padStart(2, '0') + '-' + 
                         String(d.getDate()).padStart(2, '0');
        
        console.log("Buscando palavra para data:", hojeLocal);

        const { data: palavra, error } = await supabaseClient
            .from('palavra_dia')
            .select('*')
            .eq('grupo_id', window.meuGrupoId)
            .eq('data_publicacao', hojeLocal)
            .eq('status', 'publicado')
            .maybeSingle();

        if (error) throw error;

        if (!palavra) {
            document.getElementById('home-palavra-dia-container').style.display = 'none';
            return;
        }
        document.getElementById('home-palavra-dia-container').style.display = 'block';
        const { data: lida } = await supabaseClient.from('palavra_dia_lidas').select('id').eq('palavra_id', palavra.id).eq('membro_id', window.meuMembroId).maybeSingle();
        renderPalavraHome(palavra, !!lida);
    } catch (e) { console.error(e); }
};

function renderPalavraHome(p, jaLeu) {
    const container = document.getElementById('palavra-dia-content');
    const c = p.conteudo;
    const uploadUrl = c.upload_url;
    let html = '';

    carregarStreaksUI();

    switch (p.tipo) {
        case 'texto':
            html = `<p style="font-size:1rem; font-style:italic; line-height:1.5; color:var(--text-main); margin-bottom:10px;">"${c.texto}"</p><div style="font-size:0.85rem; font-weight:700; color:var(--primary-red);">${c.referencia || ''}</div>`;
            break;
        case 'video':
            const videoSrc = uploadUrl || formatarUrlVideo(c.url);
            html = `<div style="margin-bottom:10px; border-radius:12px; overflow:hidden; background:#000; aspect-ratio:16/9;"><iframe width="100%" height="100%" src="${videoSrc}" frameborder="0" allowfullscreen></iframe></div><p style="font-size:0.85rem; color:var(--text-muted);">${c.legenda || ''}</p>`;
            break;
        case 'audio':
            const audioSrc = uploadUrl || c.url;
            html = `<div style="background:#f1f5f9; padding:15px; border-radius:12px; margin-bottom:15px;"><audio src="${audioSrc}" controls style="width:100%;"></audio></div>`;
            break;
        case 'imagem':
            html = `<img src="${uploadUrl || c.url}" style="width:100%; border-radius:16px; margin-bottom:12px;"><p style="font-size:0.9rem; font-style:italic;">${c.legenda || ''}</p>`;
            break;
        case 'desafio':
            html = `<div style="background:#fff5f5; border:2px solid var(--primary-red); padding:15px; border-radius:12px;"><div style="font-weight:900; color:var(--primary-red); margin-bottom:5px;">🔥 DESAFIO</div><div style="font-weight:800; margin-bottom:5px;">${c.desafio_titulo}</div><p>${c.descricao}</p></div>`;
            break;
    }

    const r = p.reacoes || {"🙏": 0, "🔥": 0, "❤️": 0, "🙌": 0, "🕊️": 0};
    html += `<div style="margin-top:15px; border-top:1px solid #eee; padding-top:10px;"><div class="flex gap-2 mb-3" style="overflow-x:auto;">${Object.entries(r).map(([emoji, count]) => `<button onclick="window.reagirPalavra('${p.id}', '${emoji}')" style="background:white; border:1px solid #ddd; padding:4px 8px; border-radius:15px; font-size:0.8rem;">${emoji} ${count}</button>`).join('')}</div><div style="display:flex; justify-content:space-between; align-items:center;"><div id="palavra-lida-status">${jaLeu ? '<span style="color:#16a34a; font-weight:800;">✓ LIDO</span>' : `<button onclick="window.marcarPalavraLida('${p.id}')" style="background:var(--primary-blue); color:white; border:none; padding:8px 15px; border-radius:20px; font-weight:800;">AMÉM!</button>`}</div><div class="flex gap-2"><div id="streak-badge" style="display:none; background:#fff7ed; padding:2px 8px; border-radius:10px; font-size:0.7rem;">🔥 <span id="streak-count">0</span></div><button onclick="window.compartilharPalavra('${p.id}')">📤</button></div></div></div>`;

    container.innerHTML = html;
}

window.reagirPalavra = async function(id, emoji) {
    try {
        const { data: p } = await supabaseClient.from('palavra_dia').select('reacoes').eq('id', id).single();
        const r = p.reacoes || {"🙏": 0, "🔥": 0, "❤️": 0, "🙌": 0, "🕊️": 0};
        r[emoji] = (r[emoji] || 0) + 1;
        await supabaseClient.from('palavra_dia').update({ reacoes: r }).eq('id', id);
        window.carregarPalavraDiaHome();
    } catch (e) { console.error(e); }
};

window.marcarPalavraLida = async function(id) {
    try {
        await supabaseClient.from('palavra_dia_lidas').insert([{ palavra_id: id, membro_id: window.meuMembroId }]);
        const hoje = new Date().toISOString().split('T')[0];
        const { data: m } = await supabaseClient.from('membros').select('sequencia_diaria, ultima_leitura_palavra').eq('id', window.meuMembroId).single();
        let novaSequencia = 1;
        if (m.ultima_leitura_palavra) {
            const ontem = new Date(); ontem.setDate(ontem.getDate() - 1);
            if (m.ultima_leitura_palavra === ontem.toISOString().split('T')[0]) novaSequencia = (m.sequencia_diaria || 0) + 1;
        }
        await supabaseClient.from('membros').update({ sequencia_diaria: novaSequencia, ultima_leitura_palavra: hoje }).eq('id', window.meuMembroId);
        window.carregarPalavraDiaHome();
    } catch (e) { console.error(e); }
};

async function carregarStreaksUI() {
    try {
        const { data: m } = await supabaseClient.from('membros').select('sequencia_diaria').eq('id', window.meuMembroId).single();
        if (m && m.sequencia_diaria > 0) {
            const el = document.getElementById('streak-badge');
            if (el) { el.style.display = 'flex'; document.getElementById('streak-count').innerText = m.sequencia_diaria; }
        }
    } catch(e){}
}

function formatarUrlVideo(url) {
    if (!url) return '';
    if (url.includes('youtube.com/watch?v=')) return url.replace('watch?v=', 'embed/');
    if (url.includes('youtu.be/')) return 'https://www.youtube.com/embed/' + url.split('youtu.be/')[1];
    return url;
}

async function carregarContadorLeituras(palavraId) {
    const { count } = await supabaseClient.from('palavra_dia_lidas').select('*', { count: 'exact', head: true }).eq('palavra_id', palavraId);
    const el = document.getElementById(`palavra-count-${palavraId}`);
    if (el) el.innerText = count || 0;
}

window.compartilharPalavra = function(id) {
    const texto = "Confira a Palavra do Dia no App GO+! 🙏";
    if (navigator.share) navigator.share({ title: 'Palavra do Dia', text: texto, url: window.location.href });
    else { navigator.clipboard.writeText(window.location.href); window.showToast("Link copiado!"); }
};
