// ==========================================
// SCRIPT PRINCIPAL: APP GO+ (DASHBOARD)
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 GO+ Versão: 2.3 (Deploy Vercel OK)");
    console.log("🕊️ Unidade e Tecnologia a serviço da RCC.");

    // 1. VERIFICAR AUTENTICAÇÃO
    if (!supabaseClient) {
        alert("Erro crítico: Banco de dados não conectado.");
        window.location.href = '../index.html';
        return;
    }

    const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
    
    if (!session) {
        // Redireciona de volta para o login se tentar acessar direto
        window.location.href = '../index.html';
        return;
    }

    const user = session.user;
    console.log("Usuário logado:", user.email);

    // 2. CONFIGURAR NAVEGAÇÃO IMEDIATAMENTE (Para que os botões funcionem mesmo com erro nos dados)
    configurarNavegacao();

    // 3. CARREGAR PERFIL E DASHBOARD (Assíncrono)
    try {
        await carregarPerfilUsuario(user);
        await carregarDashboard();
    } catch (e) {
        console.error("Erro no fluxo de carregamento:", e);
    }
});

// --- FUNÇÕES CORE ---

async function carregarPerfilUsuario(user) {
    try {
        const { data: membro } = await supabaseClient
            .from('membros')
            .select('id, grupo_id, cargo, nome, foto_url')
            .eq('auth_id', user.id)
            .maybeSingle();

        if (membro) {
            window.meuMembroId = membro.id;
            window.meuGrupoId = membro.grupo_id;
            window.meuCargo = membro.cargo;
            window.meuNome = membro.nome;
            
            // Atualizar UI com nome e cargo usando IDs (Novo)
            const elNome = document.getElementById('sidebar-usuario-nome');
            const elCargo = document.getElementById('sidebar-usuario-cargo');
            const elFoto = document.getElementById('sidebar-usuario-foto');
            
            if (elNome) elNome.innerText = membro.nome;
            if (elCargo) elCargo.innerText = membro.cargo;
            if (elFoto && membro.foto_url) elFoto.src = membro.foto_url;
            else if (elFoto) elFoto.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(membro.nome)}&background=facc15&color=fff`;

            // 1. Carregar Nome do Grupo
            const { data: grupo } = await supabaseClient
                .from('grupos')
                .select('nome')
                .eq('id', membro.grupo_id)
                .maybeSingle();

            if (grupo) {
                const elGrupo = document.getElementById('sidebar-grupo-nome');
                const elGrupoMob = document.getElementById('mobile-grupo-nome');
                if (elGrupo) {
                    elGrupo.innerHTML = grupo.nome;
                }
                if (elGrupoMob) {
                    elGrupoMob.innerText = grupo.nome;
                }
            }

            // 2. Aplicar RBAC (Role-Based Access Control) Dinâmico com Múltiplos Cargos
            const listaCargos = (membro.cargo || "Participante").split(', ').map(c => {
                let cb = c.trim();
                if (cb.startsWith('Ministério ')) return 'Coord. Ministério';
                return cb;
            });

            const { data: todasRegras } = await supabaseClient
                .from('cargos_permissoes')
                .select('cargo, permissoes')
                .in('cargo', listaCargos);

            // Merge de permissões
            window.minhasPermissoes = {};
            const niveis = { 'total': 3, 'escrita': 2, 'leitura': 1, 'nenhum': 0 };

            if (todasRegras) {
                todasRegras.forEach(regra => {
                    const p = regra.permissoes;
                    for (const modulo in p) {
                        const nivelAtual = niveis[window.minhasPermissoes[modulo]] || 0;
                        const nivelNovo = niveis[p[modulo]] || 0;
                        if (nivelNovo > nivelAtual) window.minhasPermissoes[modulo] = p[modulo];
                    }
                });
            }

            // Merge finalizado
                
            // Fallback Participante
            if (membro.cargo && membro.cargo.includes('Participante')) {
                const p = window.minhasPermissoes;
                if (!p.resumo) p.resumo = 'nenhum';
                if (!p.ata) p.ata = 'nenhum';
                const cardPresenca = document.getElementById('desktop-card-presenca');
                if (cardPresenca) cardPresenca.style.display = 'none';
            }

                const p = window.minhasPermissoes;

                const mapeamentoSidebar = {
                    'Membros': p.pessoas,
                    'Ata': p.ata,
                    'Configurações': p.configuracoes,
                    'Relatórios': p.metricas,
                    'Eventos': p.eventos,
                    'Escala': p.escala,
                    'Tesouraria': p.tesouraria,
                    'Resumo': p.resumo,
                    'Gerenciar Notícias': (window.meuCargo && (window.meuCargo.includes('Núcleo') || window.meuCargo.includes('Coordenador'))) ? 'total' : 'nenhum'
                };

                const sidebarItems = document.querySelectorAll('.sidebar-item, .menu-mobile-item');
                sidebarItems.forEach(item => {
                    const txt = item.innerText;
                    
                    // Renomeia Pedidos
                    if (txt.includes('Pedidos') && membro.cargo === 'Participante') {
                        const icon = txt.includes('🙏') ? '🙏' : '';
                        item.innerHTML = `${icon} Meus Pedidos`.trim();
                    }

                    for (const [menuName, permissao] of Object.entries(mapeamentoSidebar)) {
                        if (txt.includes(menuName) || (menuName === 'Ata' && txt.includes('Núcleo')) || (menuName === 'Membros' && txt.includes('Membros'))) {
                            if (permissao === 'nenhum') {
                                item.style.display = 'none';
                            } else {
                                item.style.display = (item.classList.contains('sidebar-item')) ? 'flex' : 'block';
                            }
                        }
                    }
                });
        }
    } catch (e) {
        console.error("Erro ao carregar perfil:", e);
    }
}

async function carregarDashboard() {
    console.log("Iniciando carga do Dashboard...");
    
    if (!window.meuGrupoId) {
        console.warn("Grupo ID não encontrado. Carga abortada.");
        return;
    }

    try {
        // 1. Informações do Grupo
        const { data: grupo } = await supabaseClient
            .from('grupos')
            .select('*')
            .eq('id', window.meuGrupoId)
            .maybeSingle();

        if (grupo) {
            window.infoGO = grupo;
            
            // Lógica de Próxima Data
            let dataGO = new Date();
            const dias = { 'Domingo':0,'Segunda-feira':1,'Terça-feira':2,'Quarta-feira':3,'Quinta-feira':4,'Sexta-feira':5,'Sábado':6 };
            const diaDesejado = dias[grupo.dia_reuniao_oracao] || 1;
            
            const diff = (diaDesejado + 7 - dataGO.getDay()) % 7;
            dataGO.setDate(dataGO.getDate() + diff);
            
            // Se tiver data excepcional
            if (grupo.data_excepcional) {
                const exc = new Date(grupo.data_excepcional + 'T00:00:00');
                if (exc >= new Date().setHours(0,0,0,0)) {
                    dataGO = exc;
                }
            }

            const h = parseInt((grupo.hora_reuniao_oracao || "19:30").split(':')[0]);
            const m = parseInt((grupo.hora_reuniao_oracao || "19:30").split(':')[1]);
            dataGO.setHours(h, m, 0, 0);
            
            window.proximaDataGO = dataGO.toISOString().split('T')[0];
            const strDataGO = window.proximaDataGO;

            // Countdown Visual
            const diffMs = dataGO - new Date();
            const diffHoras = diffMs / (1000 * 60 * 60);
            
            let textoFaltam = "";
            let color = "var(--primary-blue)";

            if (diffMs < 0 && diffMs > -7200000) { // Até 2h depois de começar
                textoFaltam = "É AGORA!";
                color = "#dc2626"; // Vermelho vibrante
                const subEl = document.getElementById('desktop-home-countdown-sub');
                if (subEl) subEl.innerHTML = `<strong style="color:#dc2626;">${horasRestantes}</strong> para iniciarmos!`;
            } else if (diffHoras > 0 && diffHoras <= 24) {
                textoFaltam = "É AMANHÃ!";
                color = "#f59e0b"; // Laranja
                const subEl = document.getElementById('desktop-home-countdown-sub');
                if (subEl) subEl.innerText = "Prepare o seu coração!";
            } else if (diffHoras > 24) {
                const diasRestantes = Math.floor(diffHoras / 24);
                textoFaltam = `Faltam ${diasRestantes} ${diasRestantes === 1 ? 'dia' : 'dias'}`;
                const subEl = document.getElementById('desktop-home-countdown-sub');
                if (subEl) subEl.innerText = `para o nosso Grupo de Oração`;
            } else {
                textoFaltam = "Próximo GO";
            }

            const elDeskCount = document.getElementById('desktop-home-countdown');
            if (elDeskCount) {
                elDeskCount.innerText = textoFaltam;
                elDeskCount.style.color = color;
            }

            const labelDia = grupo.data_excepcional && dataGO.toISOString().startsWith(grupo.data_excepcional) ? "Data Especial" : grupo.dia_reuniao_oracao;
            const dataFormatada = `${dataGO.getDate().toString().padStart(2, '0')}/${(dataGO.getMonth() + 1).toString().padStart(2, '0')} às ${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
            document.getElementById('desktop-home-evento').innerText = `${labelDia} • ${dataFormatada}`;

            // Checar Intenções (Eu Vou)
            carregarIntencoesPresenca(strDataGO);

        } else {
            const elDeskCount = document.getElementById('desktop-home-countdown');
            if (elDeskCount) elDeskCount.innerText = "Sem data";
        }

        // 3. Resumo do Último GO
        const { data: ultimosResumos } = await supabaseClient
            .from('reunioes')
            .select('*')
            .eq('grupo_id', window.meuGrupoId)
            .eq('tipo', 'Oração')
            .order('data_reuniao', { ascending: false })
            .limit(1);

        if (ultimosResumos && ultimosResumos.length > 0) {
            const resumo = ultimosResumos[0];
            window.ultimoGoId = resumo.id;
            window.ultimoResumoFull = resumo;
            console.log("Resumo carregado para Home:", resumo);
            
            // 1. Atualizar Data
            const resDataEl = document.getElementById('desktop-resumo-data');
            if (resDataEl && resumo.data_reuniao) {
                const txtData = resumo.data_reuniao.split('-').reverse().join('/');
                resDataEl.innerText = `Referente a ${txtData}`;
            }
            
            // 2. Atualizar Tema e Capa (Lendo do JSON em avisos_finais)
            const temaEl = document.getElementById('desktop-resumo-tema');
            const capaEl = document.getElementById('desktop-resumo-capa');
            
            let meta = {};
            try {
                meta = JSON.parse(resumo.avisos_finais || '{}');
            } catch(e) { console.error("Avisos não é JSON"); }

            if (temaEl) {
                temaEl.innerText = meta.tema || "Encontro de Oração";
            }
            
            if (capaEl) {
                if (meta.fotos && meta.fotos.length > 0) {
                    capaEl.src = meta.fotos[0];
                } else {
                    // Fallback
                    capaEl.src = "https://images.unsplash.com/photo-1544427920-c49ccfb85579?q=80&w=800&auto=format&fit=crop";
                }
            }

            // 3. Checar se o usuário já marcou presença
            const { data: presenca } = await supabaseClient
                .from('presencas')
                .select('id')
                .eq('reuniao_id', resumo.id)
                .eq('membro_id', window.meuMembroId)
                .maybeSingle();
                
            window.userJaConfirmouPresenca = !!presenca;
            const btnP = document.getElementById('desktop-btn-presenca');
            const feedP = document.getElementById('desktop-presenca-feedback');

            if (presenca) {
                if (btnP) { 
                    btnP.innerText = "Você estava lá ✓"; 
                    btnP.style.setProperty('background-color', '#16a34a', 'important');
                }
                if (feedP) { feedP.innerText = "Obrigado! Que bom que esteve lá!"; feedP.style.color = "#16a34a"; }
            } else {
                if (btnP) { 
                    btnP.innerText = "Não estive!"; 
                }
            }
        }

        // 4. Outros Módulos
        carregarAconteceu();
        carregarNotificacoes();
        carregarPedidosDashboard();
        carregarEventosHome();
        carregarCoordenadorInfo();
        verificarAlertasNucleo();

    } catch (e) {
        console.error("Erro ao carregar Dashboard:", e);
    }
}

async function verificarAlertasNucleo() {
    // 1. Próxima Reunião de Núcleo (Pauta)
    try {
        const { data: pauta } = await supabaseClient
            .from('reunioes')
            .select('*')
            .eq('grupo_id', window.meuGrupoId)
            .eq('tipo', 'Núcleo')
            .order('data_reuniao', { ascending: false })
            .limit(1)
            .maybeSingle();
            
        if (pauta) {
            let meta = {}; try { meta = JSON.parse(pauta.avisos_finais || '{}'); } catch(e){}
            if (meta.status === 'pauta') {
                const el = document.getElementById('home-alerta-pauta');
                const txt = document.getElementById('home-pauta-resumo');
                if (el && txt) {
                    el.style.display = 'block';
                    txt.innerText = `Agendada para ${pauta.data_reuniao.split('-').reverse().join('/')}`;
                }
            }
        }
    } catch(e){}

    // 2. Alertas de Escala (Urgente)
    if (typeof carregarAlertasEscala === 'function') carregarAlertasEscala();
}

// --- AUXILIARES ---

async function carregarIntencoesPresenca(dataStr) {
    try {
        const { data: intencoes } = await supabaseClient
            .from('presencas_intencao')
            .select('membro_id, membros(nome)')
            .eq('grupo_id', window.meuGrupoId)
            .eq('data_reuniao', dataStr);

        const btn = document.getElementById('desktop-btn-euvou');
        const countEl = document.getElementById('desktop-intencoes-count');
        
        const jaVou = intencoes ? intencoes.some(i => i.membro_id === window.meuMembroId) : false;
        
        if (btn) {
            btn.innerText = jaVou ? "Confirmado ✓" : "✋ Eu vou!";
            btn.style.backgroundColor = jaVou ? "#16a34a" : "var(--primary-red)";
        }

        if (countEl) {
            if (!intencoes || intencoes.length === 0) {
                countEl.innerText = "Seja o primeiro a confirmar!";
            } else {
                const outros = intencoes.length - 1;
                if (jaVou) {
                    countEl.innerText = outros > 0 ? `Você e mais ${outros} pessoas confirmaram` : "Só você confirmou por enquanto";
                } else {
                    countEl.innerText = `${intencoes.length} pessoas já confirmaram presença`;
                }
            }
        }
    } catch(e) { console.error(e); }
}

window.registrarIntencao = async function() {
    if (!window.proximaDataGO) return;
    const btn = document.getElementById('desktop-btn-euvou');
    if (btn) btn.disabled = true;

    try {
        const dataStr = window.proximaDataGO;
        const { data: jaExiste } = await supabaseClient
            .from('presencas_intencao')
            .select('id')
            .eq('membro_id', window.meuMembroId)
            .eq('data_reuniao', dataStr)
            .maybeSingle();

        if (jaExiste) {
            await supabaseClient.from('presencas_intencao').delete().eq('id', jaExiste.id);
        } else {
            await supabaseClient.from('presencas_intencao').insert([{
                grupo_id: window.meuGrupoId,
                membro_id: window.meuMembroId,
                data_reuniao: dataStr
            }]);
        }
        carregarIntencoesPresenca(dataStr);
    } catch(e) { console.error(e); }
    finally { if (btn) btn.disabled = false; }
};

window.toggleMenuMobile = function() {
    const menu = document.getElementById('menu-mobile-overlay');
    const overlay = document.getElementById('app-overlay');
    if (menu.style.display === 'flex') {
        menu.style.display = 'none';
        overlay.style.display = 'none';
        document.body.style.overflow = 'auto';
    } else {
        menu.style.display = 'flex';
        overlay.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }
};

window.clickMenuMobile = function(viewId) {
    toggleMenuMobile(); // Fecha o menu
    alternarView(viewId); // Muda a view
};

// Gerenciador de Scroll do Carrossel (Pontinhos)
window.handleCarouselScroll = function(id, dotsCount) {
    const el = document.getElementById(`carousel-${id}`);
    if (!el) return;
    const index = Math.round(el.scrollLeft / el.offsetWidth);
    for (let i = 0; i < dotsCount; i++) {
        const dot = document.getElementById(`dot-${id}-${i}`);
        if (dot) dot.classList.toggle('active', i === index);
    }
};

window.expandirNoticia = function(id) {
    const txt = document.getElementById(`noticia-texto-${id}`);
    const btn = document.getElementById(`btn-mais-${id}`);
    if (txt) {
        const isExpanded = txt.style.webkitLineClamp === "unset";
        if (isExpanded) {
            txt.style.webkitLineClamp = "4";
            txt.style.display = "-webkit-box";
            if (btn) btn.innerText = "... mais";
        } else {
            txt.style.webkitLineClamp = "unset";
            txt.style.display = "block";
            if (btn) btn.innerText = " recolher";
        }
    }
};

window.showToast = function(mensagem) {
    const toast = document.getElementById('go-toast');
    if (!toast) return;
    toast.innerText = mensagem;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
};

window.compartilharNoticia = function(id) {
    if (navigator.share) {
        navigator.share({
            title: 'Notícia do GO+',
            text: 'Confira essa novidade no App GO+!',
            url: window.location.href
        }).catch(() => {});
    } else {
        navigator.clipboard.writeText(window.location.href);
        window.showToast("Link copiado!");
    }
};

// Helper: Confirmação Customizada Assíncrona
window.confirmarAcao = function(titulo, texto, icon = '⚠️') {
    return new Promise((resolve) => {
        const modal = document.getElementById('modal-confirm');
        const t = document.getElementById('confirm-title');
        const p = document.getElementById('confirm-text');
        const ic = document.getElementById('confirm-icon');
        const btnYes = document.getElementById('btn-confirm-yes');
        const btnNo = document.getElementById('btn-confirm-cancel');

        if (!modal) return resolve(confirm(texto)); // Fallback

        t.innerText = titulo;
        p.innerText = texto;
        ic.innerText = icon;
        modal.style.display = 'flex';

        const handleYes = () => {
            modal.style.display = 'none';
            cleanup();
            resolve(true);
        };
        const handleNo = () => {
            modal.style.display = 'none';
            cleanup();
            resolve(false);
        };
        const cleanup = () => {
            btnYes.removeEventListener('click', handleYes);
            btnNo.removeEventListener('click', handleNo);
        };

        btnYes.addEventListener('click', handleYes);
        btnNo.addEventListener('click', handleNo);
    });
};

// Delegated Listener Global para Notícias
document.addEventListener('click', (e) => {
    // Excluir
    const btnDel = e.target.closest('.btn-delete-noticia');
    if (btnDel) {
        e.preventDefault();
        const id = btnDel.getAttribute('data-id');
        if (typeof window.excluirNoticia === 'function') {
            window.excluirNoticia(id);
        }
        return;
    }

    // Editar
    const btnEdit = e.target.closest('.btn-edit-noticia');
    if (btnEdit) {
        e.preventDefault();
        const id = btnEdit.getAttribute('data-id');
        if (typeof window.prepararEdicaoNoticia === 'function') {
            window.prepararEdicaoNoticia(id);
        }
        return;
    }
});

// ==========================================
// MÓDULO: NOTÍCIAS (MURAL)
// ==========================================
window.carregarAconteceu = async function() {
    console.log("Iniciando Feed de Notícias UX 3.0...");
    try {
        const { data, error } = await supabaseClient
            .from('aconteceu_go')
            .select(`*, membros(nome, foto_url)`)
            .eq('grupo_id', window.meuGrupoId)
            .order('criado_em', { ascending: false });

        if (error) throw error;

        const container = document.getElementById('lista-aconteceu');
        const listaDesk = document.getElementById('desktop-lista-aconteceu');
        const empty = '<p style="font-size:0.85rem; color:var(--text-muted); text-align:center; padding:20px;">Nenhuma novidade ainda.</p>';

        if (!data || data.length === 0) {
            if (container) container.innerHTML = empty;
            if (listaDesk) listaDesk.innerHTML = empty;
            return;
        }

        let html = '';
        data.forEach(n => {
            let fotosArr = [];
            let dataOcorridoMeta = null;
            try { 
                const meta = typeof n.fotos === 'string' ? JSON.parse(n.fotos) : (n.fotos || []); 
                if (Array.isArray(meta)) {
                    fotosArr = meta;
                } else if (meta && meta.urls) {
                    fotosArr = meta.urls;
                    dataOcorridoMeta = meta.data_ocorrido;
                }
            } catch(e){}

            const dataPub = new Date(n.criado_em).toLocaleDateString('pt-BR');
            const dataOcorridoStr = dataOcorridoMeta ? new Date(dataOcorridoMeta + 'T12:00:00').toLocaleDateString('pt-BR') : dataPub;
            const fotoMembro = n.membros?.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(n.membros?.nome || 'U')}&background=1E3A8A&color=fff`;
            
            const reacoes = n.reacoes || [];
            const userJaCurtiu = reacoes.some(r => r.membro_id === window.meuMembroId);
            
            html += `
            <div class="insta-post" style="background: #fff; border-bottom: 8px solid #f0f2f5; display: block; width: 100%;">
                <!-- Header -->
                <div class="flex items-center gap-3" style="padding: 12px;">
                    <img src="${fotoMembro}" style="width:34px; height:34px; border-radius:50%; object-fit:cover; border: 1px solid #dbdbdb;">
                    <div class="flex flex-col">
                        <span style="font-size: 0.85rem; font-weight:700; color:#262626;">${n.membros?.nome || 'GO+'}</span>
                        <span style="font-size: 0.65rem; color:#8e8e8e;">Publicada em ${dataPub}</span>
                    </div>
                </div>

                <!-- Media Section (Fixed Height for Stability) -->
                <div style="position: relative; width: 100%; height: 350px; background: #fafafa; overflow: hidden; touch-action: pan-y;">
                    ${fotosArr.length > 0 ? `
                        <div id="carousel-${n.id}" class="hide-scrollbar" onscroll="window.handleCarouselScroll('${n.id}', ${fotosArr.length})" style="display: flex; overflow-x: auto; overflow-y: hidden; scroll-snap-type: x mandatory; width: 100%; height: 100%; scroll-behavior: smooth;">
                            ${fotosArr.map(f => `
                                <div style="flex: 0 0 100%; width: 100%; height: 100%; scroll-snap-align: start;">
                                    <img src="${f}" style="width:100%; height:100%; object-fit:cover;">
                                </div>
                            `).join('')}
                        </div>
                        
                        <!-- Selo de Data -->
                        <div style="position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.5); color: #fff; padding: 3px 8px; border-radius: 4px; font-size: 0.6rem; font-weight: 600; z-index: 10; backdrop-filter: blur(4px);">
                            Aconteceu em ${dataOcorridoStr}
                        </div>

                        ${fotosArr.length > 1 ? `
                            <button class="carousel-arrow" onclick="document.getElementById('carousel-${n.id}').scrollBy({left: -document.getElementById('carousel-${n.id}').offsetWidth, behavior: 'smooth'})" style="position: absolute; left: 8px; top: 50%; transform: translateY(-50%); background: rgba(255,255,255,0.8); border: none; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; cursor: pointer; z-index: 11;">&lt;</button>
                            <button class="carousel-arrow" onclick="document.getElementById('carousel-${n.id}').scrollBy({left: document.getElementById('carousel-${n.id}').offsetWidth, behavior: 'smooth'})" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: rgba(255,255,255,0.8); border: none; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; cursor: pointer; z-index: 11;">&gt;</button>
                            
                            <div style="position: absolute; bottom: 10px; left: 0; width: 100%; display: flex; justify-content: center; gap: 4px; z-index: 12;">
                                ${fotosArr.map((_, i) => `<div id="dot-${n.id}-${i}" class="insta-dot ${i === 0 ? 'active' : ''}"></div>`).join('')}
                            </div>
                        ` : ''}
                    ` : `
                        <div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#ccc; font-size:2rem;">🖼️</div>
                    `}
                </div>

                <!-- Actions & Caption -->
                <div style="padding: 12px; background: white;">
                    <div class="flex items-center gap-3" style="margin-bottom: 10px;">
                        <button onclick="window.reagirNoticia('${n.id}')" style="background:none; border:none; padding:0; cursor:pointer; display:flex; align-items:center; gap:5px;">
                            <span id="noticia-like-icon-${n.id}" style="font-size: 1.3rem; color: ${userJaCurtiu ? '#ed4956' : '#262626'}">${userJaCurtiu ? '❤️' : '🤍'}</span>
                            <span id="noticia-like-count-${n.id}" style="font-size: 0.85rem; font-weight: 700; color: #262626;">${reacoes.length}</span>
                        </button>
                        <button onclick="window.compartilharNoticia('${n.id}')" style="background:none; border:none; padding:0; cursor:pointer;">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#262626" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                        </button>
                    </div>

                    <div style="font-size: 0.85rem; line-height: 1.4; color: #262626;">
                        <div id="noticia-texto-${n.id}" style="display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden;">
                            ${n.titulo ? `<strong style="display:block; margin-bottom:4px; font-size: 0.95rem; color: #1e293b;">${n.titulo}</strong>` : ''}${n.texto}
                        </div>
                        ${n.texto.length > 80 ? `<span id="btn-mais-${n.id}" onclick="window.expandirNoticia('${n.id}')" style="color: #8e8e8e; cursor: pointer; font-weight:600; font-size:0.75rem; display: inline-block; margin-top: 4px;">... mais</span>` : ''}
                    </div>
                </div>
            </div>
            `;
        });

        if (container) container.innerHTML = html;
        if (listaDesk) listaDesk.innerHTML = html;

    } catch (err) {
        console.error("Erro ao carregar noticias:", err);
    }
};

window.abrirModalAconteceu = function() {
    document.getElementById('modal-aconteceu').style.display = 'flex';
}

window.fecharModalAconteceu = function() {
    document.getElementById('modal-aconteceu').style.display = 'none';
}

// ==========================================
// OUTROS MÓDULOS (DASHBOARD)
// ==========================================

async function carregarPedidosDashboard() {
    // Apenas quem tem permissão de ver pedidos (RBAC)
    if (!window.minhasPermissoes || window.minhasPermissoes.pedidos === 'nenhum') {
        const cardPedido = document.getElementById('desktop-card-pedidos');
        if (cardPedido) cardPedido.style.display = 'none';
        return;
    }

    try {
        const { data: pedidos } = await supabaseClient
            .from('pedidos_oracao')
            .select(`*, membros (nome, foto_url)`)
            .eq('grupo_id', window.meuGrupoId)
            .order('criado_em', { ascending: false })
            .limit(3);

        const container = document.getElementById('desktop-lista-pedidos');
        if (!container) return;
        container.innerHTML = '';

        if (!pedidos || pedidos.length === 0) {
            container.innerHTML = '<p style="font-size:0.8rem; color:var(--text-muted); text-align:center;">Nenhum pedido pendente.</p>';
            return;
        }

        pedidos.forEach(p => {
            const foto = p.membros?.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.membros?.nome || 'M')}&background=facc15&color=fff`;
            container.innerHTML += `
                <div class="flex gap-2 items-center" style="margin-bottom: 10px;">
                    <img src="${foto}" style="width:28px; height:28px; border-radius:50%; object-fit:cover;">
                    <div>
                        <div style="font-size: 0.8rem; font-weight: 600;">${p.membros?.nome || 'Anônimo'}</div>
                        <div style="font-size: 0.7rem; color: var(--text-muted);">${p.texto.substring(0, 40)}...</div>
                    </div>
                </div>
            `;
        });
    } catch (err) {
        console.error("Erro ao carregar pedidos no dashboard", err);
    }
}

window.abrirModalPedido = function() {
    document.getElementById('modal-pedido').style.display = 'flex';
}
window.fecharModalPedido = function() {
    document.getElementById('modal-pedido').style.display = 'none';
}

function configurarNavegacao() {
    // 1. Navegação Desktop (Sidebar)
    const sidebarItems = document.querySelectorAll('.sidebar-item');
    sidebarItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const label = e.target.innerText;
            if (label.includes('Início')) alternarView('view-dashboard');
            else if (label.includes('Eventos')) alternarView('view-eventos');
            else if (label.includes('Escala')) alternarView('view-escala');
            else if (label.includes('Resumo')) alternarView('view-resumo-go');
            else if (label.includes('Tesouraria')) alternarView('view-tesouraria');
            else if (label.includes('Ata')) alternarView('view-ata');
            else if (label.includes('Pessoas')) alternarView('view-pessoas');
            else if (label.includes('Pedidos')) {
                if (window.meuCargo === 'Participante') {
                    alternarView('view-meus-pedidos');
                    carregarMeusPedidos();
                } else {
                    alternarView('view-pedidos');
                }
            }
            else if (label.includes('Configurações')) {
                alternarView('view-configuracoes');
                if (typeof carregarConfiguracoes === 'function') carregarConfiguracoes();
            }
            else if (label.includes('Relatórios')) {
                alternarView('view-relatorios');
                if (typeof carregarRelatorios === 'function') carregarRelatorios();
            }
            else if (label.includes('Gerenciar Notícias')) {
                alternarView('view-gerenciar-noticias');
                if (typeof mostrarHubNoticias === 'function') mostrarHubNoticias();
            }
            
            // Marca ativo
            if (!label.includes('Sair')) {
                sidebarItems.forEach(nav => nav.classList.remove('active'));
                e.target.classList.add('active');
            }
        });
    });

    // 2. Navegação Mobile (Bottom Nav)
    const bottomNavItems = document.querySelectorAll('.nav-item');
    bottomNavItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            // alternarView agora cuida de tudo
        });
    });

    // 3. Função Global de Logout (Chamada pelo HTML)
    window.deslogarUsuario = async (e) => {
        if (e) e.preventDefault();
        if (confirm("Deseja realmente sair do sistema?")) {
            await supabaseClient.auth.signOut();
            window.location.href = '../index.html';
        }
    };
}

// Função Global para trocar telas
window.alternarView = function(viewId) {
    const views = document.querySelectorAll('.app-view');
    views.forEach(v => {
        v.style.display = 'none';
        v.classList.remove('active');
    });

    const targetView = document.getElementById(viewId);
    if (targetView) {
        targetView.style.display = 'block';
        
        if (viewId === 'view-pedidos' && typeof carregarPedidos === 'function') carregarPedidos();
        if (viewId === 'view-meus-pedidos') carregarMeusPedidos();
        if (viewId === 'view-perfil' && typeof carregarPerfil === 'function') carregarPerfil();
        if (viewId === 'view-eventos' && typeof carregarMesesTabs === 'function') carregarMesesTabs();
        if (viewId === 'view-configuracoes' && typeof carregarConfiguracoes === 'function') carregarConfiguracoes();
        if (viewId === 'view-ata' && typeof carregarAtas === 'function') carregarAtas();

        targetView.classList.add('active');
        
        // Sincronizar classes active nos menus
        const menuLabels = {
            'view-dashboard': ['Início', 'Home'],
            'view-eventos': ['Eventos'],
            'view-partilhas': ['Mural', 'Partilhas'],
            'view-perfil': ['Perfil'],
            'view-pedidos': ['Pedidos'],
            'view-meus-pedidos': ['Pedidos'],
            'view-ata': ['Reunião de Núcleo'],
            'view-resumo-go': ['Resumo do GO'],
            'view-tesouraria': ['Tesouraria'],
            'view-relatorios': ['Relatórios'],
            'view-gerenciar-noticias': ['Gerenciar Notícias']
        };
        const activeLabels = menuLabels[viewId] || [];

        document.querySelectorAll('.sidebar-item, .nav-item').forEach(item => {
            item.classList.remove('active');
            const itemText = item.innerText.trim();
            if (activeLabels.some(label => itemText.includes(label))) {
                item.classList.add('active');
            }
        });

        // Atualiza título do Desktop
        const headerTitle = document.getElementById('header-title');
        if (headerTitle) {
            if (viewId === 'view-dashboard') headerTitle.innerText = 'Início';
            if (viewId === 'view-eventos') headerTitle.innerText = 'Agenda de Eventos';
            if (viewId === 'view-escala') headerTitle.innerText = 'Escala do GO';
            if (viewId === 'view-resumo-go') headerTitle.innerText = 'Resumo do GO (Público)';
            if (viewId === 'view-tesouraria') headerTitle.innerText = 'Tesouraria';
            if (viewId === 'view-ata') headerTitle.innerText = 'Gestão das Reuniões de Núcleo';
            if (viewId === 'view-pessoas') headerTitle.innerText = 'Membros do GO';
            if (viewId === 'view-partilhas') headerTitle.innerText = 'Mural de Partilhas';
            if (viewId === 'view-pedidos') headerTitle.innerText = 'Pedidos de Oração';
            if (viewId === 'view-perfil') headerTitle.innerText = 'Meu Perfil';
            if (viewId === 'view-relatorios') headerTitle.innerText = 'Relatórios Gerenciais';
            if (viewId === 'view-configuracoes') headerTitle.innerText = 'Configurações do GO';
        }
    }
}

// ==========================================
// FUNÇÃO GLOBAL: ESTIVE LÁ
// ==========================================
window.registrarPresencaUltimoGO = async function() {
    if (!window.ultimoGoId) {
        alert("Nenhum GO para marcar presença.");
        return;
    }
    const btn = document.getElementById('desktop-btn-presenca');
    const feed = document.getElementById('desktop-presenca-feedback');

    if (btn) btn.disabled = true;

    try {
        if (window.userJaConfirmouPresenca) {
            // --- DESMARCAR ---
            const { error } = await supabaseClient
                .from('presencas')
                .delete()
                .eq('reuniao_id', window.ultimoGoId)
                .eq('membro_id', window.meuMembroId);
            
            if (error) throw error;
            
            window.userJaConfirmouPresenca = false;
            if (btn) {
                btn.innerText = "Não estive!";
                btn.style.setProperty('background-color', 'var(--primary-blue)', 'important');
            }
            if (feed) {
                feed.innerText = "Que pena! Estamos te esperando no próximo.";
                feed.style.color = "#dc2626";
            }
        } else {
            // --- MARCAR ---
            const { error } = await supabaseClient.from('presencas').insert([{
                reuniao_id: window.ultimoGoId,
                membro_id: window.meuMembroId,
                marcado_por_usuario: true
            }]);
            
            if (error) throw error;
            
            window.userJaConfirmouPresenca = true;
            if (btn) {
                btn.innerText = "Você estava lá ✓";
                btn.style.setProperty('background-color', '#16a34a', 'important');
            }
            if (feed) {
                feed.innerText = "Obrigado! Que bom que esteve lá!";
                feed.style.color = "#16a34a";
            }
        }
        
        const { count } = await supabaseClient
            .from('presencas')
            .select('*', { count: 'exact', head: true })
            .eq('reuniao_id', window.ultimoGoId);
        
        const elTotal = document.getElementById('desktop-presenca-total');
        if (elTotal) elTotal.innerText = count || 0;

    } catch(e) {
        console.error("Erro ao alternar presença:", e);
        alert("Erro ao processar sua presença.");
    } finally {
        if (btn) btn.disabled = false;
    }
}

async function carregarCoordenadorInfo() {
    try {
        const { data: coord } = await supabaseClient
            .from('membros')
            .select('nome')
            .eq('grupo_id', window.meuGrupoId)
            .eq('cargo', 'Coordenador')
            .maybeSingle();

        if (coord) {
            const elNome = document.getElementById('sidebar-coord-nome');
            if (elNome) elNome.innerText = coord.nome;
        }
    } catch (e) {
        console.error("Erro ao carregar coord info:", e);
    }
}

async function carregarMeusPedidos() {
    const container = document.getElementById('lista-meus-pedidos');
    if (!container) return;

    try {
        const { data: pedidos } = await supabaseClient
            .from('pedidos_oracao')
            .select('*')
            .eq('membro_id', window.meuMembroId)
            .order('criado_em', { ascending: false });

        container.innerHTML = '';

        if (!pedidos || pedidos.length === 0) {
            container.innerHTML = `<div class="card text-center"><p style="color: var(--text-muted);">Você ainda não enviou nenhum pedido.</p></div>`;
            return;
        }

        pedidos.forEach(p => {
            const data = new Date(p.criado_em).toLocaleDateString('pt-BR');
            const div = document.createElement('div');
            div.className = 'card';
            div.style.borderLeft = '4px solid var(--primary-blue)';
            div.style.marginBottom = '12px';
            div.innerHTML = `
                <div class="flex justify-between items-start" style="margin-bottom: 10px;">
                    <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">${data}</span>
                    <div class="flex gap-2">
                        <button onclick="editarPedido('${p.id}', '${p.texto.replace(/'/g, "\\'")}')" style="background:none; border:none; color:var(--primary-blue); font-size:0.75rem; cursor:pointer;">✏️</button>
                        <button onclick="excluirPedido('${p.id}')" style="background:none; border:none; color:var(--primary-red); font-size:0.75rem; cursor:pointer;">🗑️</button>
                    </div>
                </div>
                <p style="font-size: 0.95rem;">${p.texto}</p>
                ${p.resposta ? `<div style="background: #f8fafc; padding: 10px; border-radius: 8px; margin-top: 10px; font-style: italic;">"${p.resposta}"</div>` : ''}
            `;
            container.appendChild(div);
        });
    } catch (e) { console.error(e); }
}

async function carregarEventosHome() {
    const container = document.getElementById('lista-eventos-home');
    const card = document.getElementById('desktop-card-eventos-home');
    if (!container || !card) return;

    try {
        const agora = new Date();
        const dataInicio = agora.toISOString();
        const daqui15Dias = new Date();
        daqui15Dias.setDate(agora.getDate() + 15);
        const dataFim = daqui15Dias.toISOString();

        // Tentamos usar 'data_hora' (que é o padrão no banco)
        let query = supabaseClient
            .from('eventos')
            .select('*')
            .eq('grupo_id', window.meuGrupoId)
            .gte('data_hora', dataInicio)
            .lte('data_hora', dataFim)
            .order('data_hora', { ascending: true });

        if (window.meuCargo === 'Participante') query = query.eq('visibilidade', 'Público');

        const { data: eventos, error } = await query;
        
        if (error || !eventos || eventos.length === 0) {
            card.style.display = 'none';
            return;
        }

        card.style.display = 'block';
        container.innerHTML = '';

        eventos.forEach(ev => {
            const data = new Date(ev.data_hora).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            container.innerHTML += `
                <div style="padding: 10px; background: #f8fafc; border-radius: 8px; border-left: 4px solid var(--primary-blue); margin-bottom:8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                    <div style="font-size: 0.85rem; font-weight: 700; color: var(--primary-blue);">${ev.titulo}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">📅 ${data} • 📍 ${ev.local_evento || 'GO+'}</div>
                </div>
            `;
        });
    } catch (e) { 
        console.error("Erro ao carregar eventos na home:", e);
        card.style.display = 'none';
    }
}

window.compartilharConvite = async function() {
    if (!window.infoGO || !window.proximaDataGO) return;
    const g = window.infoGO;
    const dataFormatada = new Date(window.proximaDataGO + 'T12:00:00').toLocaleDateString('pt-BR');
    const mensagem = `Ei! Convite para o GO *${g.nome}*\n📅 ${dataFormatada}\n⏰ ${g.hora_reuniao_oracao || "19:30"}`;
    
    if (navigator.share) await navigator.share({ text: mensagem });
    else {
        await navigator.clipboard.writeText(mensagem);
        alert("Copiado!");
    }
};
