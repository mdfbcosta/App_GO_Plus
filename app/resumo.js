// ==========================================
// MÓDULO: RESUMO DO GO (HUB DE EDIÇÃO)
// ==========================================

let fotosBase64 = []; 
let galeriaFotosCache = [];
let fotoAtualIndex = 0;
let resumoModo = 'novo'; 
let resumoIdEmEdicao = null;

const reacoesDisponiveis = [
    { type: 'emoji', value: '❤️' },
    { type: 'emoji', value: '🥹' },
    { type: 'emoji', value: '🙏' },
    { type: 'emoji', value: '🙌' },
    { type: 'image', value: 'assets/emojis/fogo.png', label: 'fogo' },
    { type: 'image', value: 'assets/emojis/pombinha.png', label: 'pombinha' },
    { type: 'image', value: 'assets/emojis/linguas.png', label: 'linguas' },
    { type: 'image', value: 'assets/emojis/intercessao.png', label: 'intercessao' }
];

let longPressTimer;

// --- COMPRESSÃO ---
function comprimirImagem(base64, maxWidth = 500, maxHeight = 500, quality = 0.4) {
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

// --- HUB E NAVEGAÇÃO ---

document.addEventListener('click', (e) => {
    if (e.target && e.target.classList.contains('ver-mais-link')) {
        if (typeof window.abrirModalResumoDetalhe === 'function') window.abrirModalResumoDetalhe();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    document.body.addEventListener('click', (e) => {
        const target = e.target.closest('.sidebar-item, .menu-mobile-item, .nav-item');
        if (target && target.innerText.includes('Resumo do GO')) { 
            if (typeof window.alternarView === 'function') window.alternarView('view-resumo-go');
            setTimeout(mostrarHubResumo, 100); 
        }
    });
});

window.mostrarHubResumo = async function() {
    document.getElementById('resumo-hub').style.display = 'flex';
    document.getElementById('form-resumo-container').style.display = 'none';
    document.getElementById('btn-voltar-resumo-hub').style.display = 'none';
    const btnForms = document.querySelectorAll('.btn-form-resumo');
    btnForms.forEach(b => b.style.display = 'none');

    const saved = localStorage.getItem('go_plus_resumo_draft');
    document.getElementById('hub-btn-rascunho').style.display = saved ? 'flex' : 'none';

    if (window.meuGrupoId) {
        const { data: ult } = await supabaseClient.from('reunioes').select('*').eq('grupo_id', window.meuGrupoId).eq('tipo', 'Oração').order('data_reuniao', {ascending: false}).limit(1).maybeSingle();
        if (ult) {
            document.getElementById('hub-btn-publicado').style.display = 'flex';
            window.resumoPublicadoCache = ult;
        } else {
            document.getElementById('hub-btn-publicado').style.display = 'none';
        }
    }
};

window.prepararFormResumo = function(modo) {
    document.getElementById('resumo-hub').style.display = 'none';
    document.getElementById('form-resumo-container').style.display = 'block';
    document.getElementById('btn-voltar-resumo-hub').style.display = 'block';
    const btnForms = document.querySelectorAll('.btn-form-resumo');
    btnForms.forEach(b => b.style.display = 'block');

    const form = document.getElementById('form-resumo');
    form.reset(); fotosBase64 = []; document.getElementById('resumo-fotos-previews').innerHTML = '';
    
    const btnPub = document.getElementById('btn-publicar-resumo');
    resumoModo = 'novo'; resumoIdEmEdicao = null; btnPub.innerText = "Publicar Resumo";

    if (modo === 'rascunho') {
        const saved = JSON.parse(localStorage.getItem('go_plus_resumo_draft'));
        carregarDadosNoForm(saved);
    } else if (modo === 'publicado' && window.resumoPublicadoCache) {
        const r = window.resumoPublicadoCache;
        resumoModo = 'edit'; resumoIdEmEdicao = r.id; btnPub.innerText = "Salvar Alterações";
        let meta = {}; try { meta = JSON.parse(r.avisos_finais || '{}'); } catch(e){}
        carregarDadosNoForm({ data: r.data_reuniao, tema: meta.tema, texto: r.resumo_pregacao, musicas: meta.musicas, fotos: meta.fotos, avisos: meta.avisos });
        document.getElementById('resumo-avisos').value = meta.avisos || '';
    }
    validarDataPublicacao(); atualizarContadorFotos();
};

function carregarDadosNoForm(dados) {
    if (!dados) return;
    document.getElementById('resumo-data').value = dados.data || '';
    document.getElementById('resumo-tema-input').value = dados.tema || '';
    document.getElementById('resumo-texto').value = dados.texto || '';
    document.getElementById('resumo-musicas-input').value = dados.musicas || '';
    if (dados.fotos) { fotosBase64 = dados.fotos; renderPreviews(); }
}

window.previewFotosResumo = async function(event) {
    const files = event.target.files;
    let vagas = 5 - fotosBase64.length; if (vagas <= 0) return;
    for (let i = 0; i < Math.min(files.length, vagas); i++) {
        const reader = new FileReader();
        const base64 = await new Promise(r => { reader.onload = (e) => r(e.target.result); reader.readAsDataURL(files[i]); });
        fotosBase64.push(await comprimirImagem(base64));
    }
    event.target.value = ''; renderPreviews(); atualizarContadorFotos(); autoSaveDraft();
};

function renderPreviews() {
    const c = document.getElementById('resumo-fotos-previews'); c.innerHTML = '';
    fotosBase64.forEach((src, i) => {
        const div = document.createElement('div'); div.style.position = 'relative'; div.style.width = '80px';
        div.innerHTML = `<img src="${src}" style="width:80px; height:80px; object-fit:cover; border-radius:8px; border:2px solid ${i===0?'var(--primary-red)':'#eee'};"><button onclick="removerFotoResumo(${i})" style="position:absolute; top:-5px; right:-5px; background:white; border:1px solid #ddd; border-radius:50%; width:20px; height:20px; font-size:12px; color:red;">&times;</button>${i===0?'<span style="position:absolute; bottom:0; left:0; width:100%; background:var(--primary-red); color:white; font-size:0.5rem; text-align:center; border-radius:0 0 8px 8px;">CAPA</span>':`<button onclick="definirCapaResumo(${i})" style="position:absolute; bottom:0; left:0; width:100%; background:rgba(255,255,255,0.8); border:none; color:var(--primary-blue); font-size:0.5rem; text-align:center; border-radius:0 0 8px 8px;">Capa</button>`}`;
        c.appendChild(div);
    });
}

window.removerFotoResumo = function(index) { fotosBase64.splice(index, 1); renderPreviews(); atualizarContadorFotos(); autoSaveDraft(); };
window.definirCapaResumo = function(index) { const f = fotosBase64.splice(index, 1)[0]; fotosBase64.unshift(f); renderPreviews(); autoSaveDraft(); };
window.atualizarContadorFotos = function() { const el = document.getElementById('resumo-fotos-contador'); if (el) el.innerText = 5 - fotosBase64.length > 0 ? `Escolha mais ${5 - fotosBase64.length} fotos` : "Limite atingido"; };

window.autoSaveDraft = function() {
    if (resumoModo === 'edit') return;
    const draft = { data: document.getElementById('resumo-data').value, tema: document.getElementById('resumo-tema-input').value, texto: document.getElementById('resumo-texto').value, musicas: document.getElementById('resumo-musicas-input').value, fotos: fotosBase64, avisos: document.getElementById('resumo-avisos').value };
    localStorage.setItem('go_plus_resumo_draft', JSON.stringify(draft));
    const st = document.getElementById('draft-status'); if (st) st.innerText = `Salvo: ${new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;
};

window.publicarResumo = async function() {
    if (!window.meuGrupoId) return;
    const btn = document.getElementById('btn-publicar-resumo'); btn.disabled = true; const originalText = btn.innerText; btn.innerText = "Salvando...";
    try {
        const meta = { tema: document.getElementById('resumo-tema-input').value, fotos: fotosBase64, musicas: document.getElementById('resumo-musicas-input').value, avisos: document.getElementById('resumo-avisos').value };
        const dados = { grupo_id: window.meuGrupoId, tipo: 'Oração', data_reuniao: document.getElementById('resumo-data').value, resumo_pregacao: document.getElementById('resumo-texto').value, avisos_finais: JSON.stringify(meta) };

        if (resumoModo === 'edit' && resumoIdEmEdicao) {
            const { error } = await supabaseClient.from('reunioes').update(dados).eq('id', resumoIdEmEdicao);
            if (error) throw error;
            alert("Alterações salvas!");
        } else {
            const { data: v } = await supabaseClient.from('reunioes').select('id').eq('grupo_id', window.meuGrupoId).eq('tipo', 'Oração').order('data_reuniao', {ascending: false}).limit(1).maybeSingle();
            if (v) { await supabaseClient.from('testemunhos_go').delete().eq('reuniao_id', v.id); await supabaseClient.from('reunioes').delete().eq('id', v.id); }
            const { error } = await supabaseClient.from('reunioes').insert([dados]);
            if (error) throw error;
            alert("Publicado!"); localStorage.removeItem('go_plus_resumo_draft');
        }
        mostrarHubResumo(); if (window.carregarDashboard) window.carregarDashboard();
    } catch (err) { alert("Erro: " + err.message); } finally { btn.disabled = false; btn.innerText = originalText; }
};

window.validarDataPublicacao = function() {
    const dataGo = document.getElementById('resumo-data').value; const btn = document.getElementById('btn-publicar-resumo'); if (!dataGo || !btn) return;
    const hoje = new Date(); hoje.setHours(0,0,0,0); const sel = new Date(dataGo); sel.setHours(23,59,59,999);
    btn.disabled = sel > hoje; btn.style.opacity = sel > hoje ? "0.5" : "1";
};

// --- MODAL DETALHADO ---

window.abrirModalResumoDetalhe = function() {
    const r = window.ultimoResumoFull; if (!r) return;
    let meta = {}; try { meta = JSON.parse(r.avisos_finais || '{}'); } catch(e){}
    document.getElementById('detalhe-tema').innerText = meta.tema || "Resumo";
    document.getElementById('detalhe-texto').innerText = r.resumo_pregacao || "";
    document.getElementById('detalhe-avisos').innerText = meta.avisos || "Sem avisos.";
    document.getElementById('detalhe-avisos-box').style.display = 'none';
    galeriaFotosCache = meta.fotos || []; fotoAtualIndex = 0; atualizarImagemGaleria();
    const ml = document.getElementById('detalhe-musicas-lista'); if (ml && meta.musicas) {
        ml.innerHTML = '';
        meta.musicas.split('\n').forEach(l => { if (l.includes('|')) { const [n, link] = l.split('|'); ml.innerHTML += `<div class="song-item"><span>${n}</span><a href="${link}" target="_blank" class="song-link">▶️ Ouvir</a></div>`; } });
    }
    const modal = document.getElementById('modal-resumo-detalhe'); if (modal) { modal.style.display = 'flex'; carregarTestemunhos(r.id); }
};

window.fecharModalResumoDetalhe = () => {
    document.getElementById('modal-resumo-detalhe').style.display = 'none';
    const pickers = document.querySelectorAll('.emoji-picker-overlay'); pickers.forEach(p => p.remove());
};

window.toggleAvisosDetalhe = function() {
    const box = document.getElementById('detalhe-avisos-box'); box.style.display = box.style.display === 'none' ? 'block' : 'none';
};

window.navegarGaleria = function(dir) {
    if (galeriaFotosCache.length === 0) return;
    fotoAtualIndex += dir; if (fotoAtualIndex >= galeriaFotosCache.length) fotoAtualIndex = 0; if (fotoAtualIndex < 0) fotoAtualIndex = galeriaFotosCache.length - 1;
    atualizarImagemGaleria();
};

function atualizarImagemGaleria() {
    const c = document.getElementById('detalhe-fotos-container'); const ind = document.getElementById('galeria-indicador');
    if (!c || galeriaFotosCache.length === 0) { c.innerHTML = '<img src="https://images.unsplash.com/photo-1544427920-c49ccfb85579?q=80&w=800&auto=format&fit=crop">'; ind.innerText = "0/0"; return; }
    c.innerHTML = `<img src="${galeriaFotosCache[fotoAtualIndex]}">`; ind.innerText = `${fotoAtualIndex + 1}/${galeriaFotosCache.length}`;
}

// --- MURAL DE TESTEMUNHOS ---

async function carregarTestemunhos(reuniaoId) {
    const container = document.getElementById('testemunhos-lista'); if (!container) return;
    container.innerHTML = '<p style="font-size:0.7rem; text-align:center;">Carregando...</p>';
    try {
        const { data: testes } = await supabaseClient.from('testemunhos_go').select('*, membros(nome, foto_url)').eq('reuniao_id', reuniaoId).order('criado_em', { ascending: true });
        container.innerHTML = '';
        if (!testes || testes.length === 0) { container.innerHTML = '<p style="font-size:0.7rem; color:var(--text-muted); text-align:center; padding:10px;">Nenhum testemunho ainda.</p>'; return; }
        
        testes.forEach(t => {
            const foto = t.membros?.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(t.membros?.nome || 'U')}&background=1E3A8A&color=fff`;
            const div = document.createElement('div'); 
            div.className = 'testemunho-item';
            div.style.cssText = 'background:white; padding:10px; border-radius:15px; margin-bottom:15px; box-shadow:0 1px 3px rgba(0,0,0,0.1); position:relative;';
            
            let reacoesHtml = '';
            const reacoes = t.reacoes || [];
            if (reacoes.length > 0) {
                const agrupado = reacoes.reduce((acc, r) => { acc[r.value] = (acc[r.value] || 0) + 1; return acc; }, {});
                reacoesHtml = `<div class="flex gap-1" style="margin-top:10px;">${Object.entries(agrupado).map(([val, qtd]) => {
                    const rDef = reacoesDisponiveis.find(rd => rd.value === val);
                    const content = rDef && rDef.type === 'image' ? `<img src="${val}" style="width:16px; height:16px; object-fit:contain;">` : val;
                    return `<div class="reacao-pill">${content} <b>${qtd}</b></div>`;
                }).join('')}</div>`;
            }

            div.innerHTML = `
                <div class="flex items-center gap-2" style="margin-bottom:5px;">
                    <img src="${foto}" style="width:18px; height:18px; border-radius:50%;">
                    <span style="font-size:0.7rem; font-weight:700; color:var(--primary-blue);">${t.membros?.nome || 'Membro'}</span>
                </div>
                <div class="testemunho-texto" onclick="toggleExpandir(this)">${t.texto}</div>
                <button class="emoji-trigger" onclick="abrirSeletorEmoji(event, '${t.id}')" style="position:absolute; right:5px; top:5px; background:none; border:none; cursor:pointer; font-size:1.1rem; display:none;">😀</button>
                ${reacoesHtml}
            `;
            div.addEventListener('touchstart', (e) => { longPressTimer = setTimeout(() => { e.preventDefault(); abrirSeletorEmoji(e, t.id); }, 600); }, {passive:false});
            div.addEventListener('touchend', () => { clearTimeout(longPressTimer); });
            div.addEventListener('contextmenu', (e) => { e.preventDefault(); abrirSeletorEmoji(e, t.id); });
            container.appendChild(div);
        });
        container.scrollTop = container.scrollHeight;
    } catch (e) { console.error(e); }
}

window.toggleExpandir = function(el) {
    const jaExpandido = el.classList.contains('expanded');
    document.querySelectorAll('.testemunho-texto').forEach(t => t.classList.remove('expanded'));
    if (!jaExpandido) el.classList.add('expanded');
};

window.abrirSeletorEmoji = function(event, testemunhoId) {
    event.stopPropagation();
    const antigo = document.querySelector('.emoji-picker-overlay'); if (antigo) antigo.remove();
    const rect = event.target.getBoundingClientRect ? event.target.getBoundingClientRect() : { top: 300, left: 150 };
    const div = document.createElement('div'); div.className = 'emoji-picker-overlay';
    div.style.cssText = `position:fixed; top:${rect.top - 70}px; left:50%; transform:translateX(-50%); background:white; padding:10px 18px; border-radius:35px; box-shadow:0 12px 30px rgba(0,0,0,0.25); display:flex; gap:15px; z-index:11000; animation:modalSlide 0.2s; align-items:center;`;
    
    reacoesDisponiveis.forEach(r => {
        const item = document.createElement('div'); 
        item.style.cssText = 'cursor:pointer; transition:transform 0.1s; display:flex; align-items:center; justify-content:center;';
        if (r.type === 'emoji') {
            item.innerText = r.value; item.style.fontSize = '1.6rem';
        } else {
            item.innerHTML = `<img src="${r.value}" style="width:28px; height:28px; object-fit:contain;">`;
        }
        item.onclick = (e) => { e.stopPropagation(); reagir(testemunhoId, r.value); div.remove(); };
        item.onmouseover = () => item.style.transform = 'scale(1.3)'; item.onmouseout = () => item.style.transform = 'scale(1)';
        div.appendChild(item);
    });
    document.body.appendChild(div);
    setTimeout(() => { document.addEventListener('click', () => div.remove(), { once: true }); }, 100);
};

async function reagir(testemunhoId, valor) {
    try {
        const { data } = await supabaseClient.from('testemunhos_go').select('reacoes').eq('id', testemunhoId).single();
        let lista = data.reacoes || [];
        const index = lista.findIndex(r => r.membro_id === window.meuMembroId);
        if (index > -1) { if (lista[index].value === valor) { lista.splice(index, 1); } else { lista[index].value = valor; } }
        else { lista.push({ membro_id: window.meuMembroId, value: valor }); }
        await supabaseClient.from('testemunhos_go').update({ reacoes: lista }).eq('id', testemunhoId);
        carregarTestemunhos(window.ultimoResumoFull.id);
    } catch (e) { console.error(e); }
}

window.postarTestemunho = async function() {
    const input = document.getElementById('testemunho-input'); const txt = input.value.trim(); if (!txt || !window.ultimoResumoFull) return;
    try {
        const { error } = await supabaseClient.from('testemunhos_go').insert([{ reuniao_id: window.ultimoResumoFull.id, membro_id: window.meuMembroId, grupo_id: window.meuGrupoId, texto: txt, reacoes: [] }]);
        if (error) throw error; input.value = ''; carregarTestemunhos(window.ultimoResumoFull.id);
    } catch (err) { alert("Erro: " + err.message); }
};

const styleInject = document.createElement('style');
styleInject.innerHTML = `.testemunho-item:hover .emoji-trigger { display: block !important; }`;
document.head.appendChild(styleInject);
