// ==========================================
// SCRIPT PRINCIPAL: APP GO+ (DASHBOARD)
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 GO+ Versão: 2.0 (Deploy Vercel OK)");
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
                    'Resumo': p.resumo
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

                await carregarCoordenadorInfo();

                // RBAC Notícias
                const btnPostarNoticia = document.getElementById('btn-add-aconteceu');
                const btnPostarNoticiaDesk = document.getElementById('desktop-btn-add-aconteceu');
                if (membro.cargo === 'Coordenador' || membro.cargo === 'Ministério de Comunicação') {
                    if (btnPostarNoticia) btnPostarNoticia.style.display = 'block';
                    if (btnPostarNoticiaDesk) btnPostarNoticiaDesk.style.display = 'block';
                }
            } else {
                console.error("Usuário sem perfil de membro. Redirecionando.");
                await supabaseClient.auth.signOut();
                window.location.href = '../index.html';
            }

    } catch (err) {
        console.error("Erro ao carregar perfil:", err);
    }
}

async function carregarIntencoesPresenca(dataGO) {
    if (!dataGO || !window.meuGrupoId) return;
    
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return;
        
        // Quantidade total
        const { count, error } = await supabaseClient
            .from('intencoes_presenca')
            .select('*', { count: 'exact', head: true })
            .eq('grupo_id', window.meuGrupoId)
            .eq('data_reuniao', dataGO);
            
        // Eu já confirmei?
        const { data: minhaIntencao } = await supabaseClient
            .from('intencoes_presenca')
            .select('id')
            .eq('grupo_id', window.meuGrupoId)
            .eq('data_reuniao', dataGO)
            .eq('membro_id', window.meuMembroId)
            .single();

        const btnMob = document.getElementById('mobile-btn-euvou');
        const btnDesk = document.getElementById('desktop-btn-euvou');
        const textMob = document.getElementById('mobile-intencoes-count');
        const textDesk = document.getElementById('desktop-intencoes-count');

        window.userJaConfirmouIntencao = minhaIntencao ? true : false;

        if (btnMob) {
            btnMob.innerText = minhaIntencao ? "✓" : "✋ Eu vou!";
            btnMob.style.setProperty('background-color', minhaIntencao ? '#16a34a' : 'var(--primary-red)', 'important');
            btnMob.style.minWidth = minhaIntencao ? "40px" : "100px";
            btnMob.style.width = minhaIntencao ? "40px" : "auto";
            btnMob.disabled = false;
        }
        if (btnDesk) {
            btnDesk.innerText = minhaIntencao ? "✓" : "✋ Eu vou!";
            btnDesk.style.setProperty('background-color', minhaIntencao ? '#16a34a' : 'var(--primary-red)', 'important');
            btnDesk.style.minWidth = minhaIntencao ? "40px" : "100px";
            btnDesk.style.width = minhaIntencao ? "40px" : "auto";
            btnDesk.disabled = false;
        }

        let txt = "";
        if (count > 0 && minhaIntencao) {
            if (count === 1) {
                txt = `Parabéns! Você foi a primeira pessoa a confirmar presença.`;
            } else {
                txt = `Você e mais ${count - 1} pessoa(s) confirmaram!`;
            }
        }

        if (textMob) textMob.innerText = txt;
        if (textDesk) textDesk.innerText = txt;
    } catch (e) {
        console.error("Erro ao ler intenções", e);
    }
}

window.registrarIntencao = async function() {
    if (!window.proximaDataGO) return;

    const btnMob = document.getElementById('mobile-btn-euvou');
    const btnDesk = document.getElementById('desktop-btn-euvou');
    
    if (btnMob) btnMob.disabled = true;
    if (btnDesk) btnDesk.disabled = true;

    try {
        if (window.userJaConfirmouIntencao) {
            // Cancelar
            const { error } = await supabaseClient
                .from('intencoes_presenca')
                .delete()
                .eq('membro_id', window.meuMembroId)
                .eq('data_reuniao', window.proximaDataGO);
            if (error) throw error;
        } else {
            // Confirmar
            const { error } = await supabaseClient
                .from('intencoes_presenca')
                .insert([{
                    membro_id: window.meuMembroId,
                    grupo_id: window.meuGrupoId,
                    data_reuniao: window.proximaDataGO
                }]);
            if (error && error.code !== '23505') throw error;
        }
        
        carregarIntencoesPresenca(window.proximaDataGO);

    } catch (e) {
        console.error("Erro ao alternar intenção", e);
        alert("Erro ao processar sua confirmação.");
        btnMob.disabled = false;
        btnDesk.disabled = false;
    }
}

async function carregarDashboard() {
    if (!window.meuGrupoId) return;

    try {
        // 1. Pegar informações do Grupo
        const { data: grupo } = await supabaseClient.from('grupos').select('*').eq('id', window.meuGrupoId).maybeSingle();
        
        if (grupo) {
            window.infoGO = grupo; // Armazena para o convite
            
            // 2. Contagem Regressiva Inteligente do GO
            let dataGO = null;
            let h = 19, m = 30;

            // --- PRIORIDADE: DATA EXCEPCIONAL ---
            let dataEx = grupo.data_excepcional;
            let horaEx = grupo.hora_excepcional;
            
            if (grupo.local_link_maps && grupo.local_link_maps.startsWith('{')) {
                try {
                    const meta = JSON.parse(grupo.local_link_maps);
                    dataEx = meta.data_ex || dataEx;
                    horaEx = meta.hora_ex || horaEx;
                } catch(e){}
            }

            if (dataEx) {
                const dataExObj = new Date(`${dataEx}T${horaEx || '19:30'}:00`);
                const agora = new Date();
                if (dataExObj > agora) {
                    dataGO = dataExObj;
                }
            }

            // --- SEGUNDA OPÇÃO: LÓGICA SEMANAL HABITUAL ---
            if (!dataGO) {
                const diasSemana = {"Domingo":0, "Segunda-feira":1, "Terça-feira":2, "Quarta-feira":3, "Quinta-feira":4, "Sexta-feira":5, "Sábado":6};
                const targetDay = diasSemana[grupo.dia_reuniao_oracao] !== undefined ? diasSemana[grupo.dia_reuniao_oracao] : 0;
                
                if (grupo.hora_reuniao_oracao && grupo.hora_reuniao_oracao.includes(':')) {
                    [h, m] = grupo.hora_reuniao_oracao.split(':').map(Number);
                }

                let now = new Date();
                let currentDay = now.getDay();
                let currentH = now.getHours();
                let currentM = now.getMinutes();

                let diffDays = targetDay - currentDay;
                
                if (diffDays === 0) {
                    if (currentH > h || (currentH === h && currentM > m)) {
                        diffDays = 7;
                    }
                } else if (diffDays < 0) {
                    diffDays += 7;
                }
                
                dataGO = new Date(now);
                dataGO.setDate(now.getDate() + diffDays);
                dataGO.setHours(h, m, 0, 0);
            }

            const now = new Date();
            const diffMs = dataGO - now;
            const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
            const diffHoras = Math.floor(diffMs / (1000 * 60 * 60));
            const strDataGO = dataGO.toISOString().split('T')[0];
            window.proximaDataGO = strDataGO;

            let textoFaltam = "";
            let color = "var(--primary-blue)";
            if (diffHoras <= 0 && diffMs > -3600000) { // Menos de 1 hora de atraso ainda conta como "É HOJE"
                textoFaltam = "É HOJE!";
                color = "#dc2626"; // Vermelho vibrante
                const horasRestantes = diffHoras > 0 ? `Faltam ${diffHoras}h` : 'Começando!';
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
                    btnP.style.setProperty('background-color', 'var(--primary-blue)', 'important');
                }
            }

            // Busca total de presenças para o contador circular (Desktop)
            const { count: totalPresencas } = await supabaseClient
                .from('presencas')
                .select('*', { count: 'exact', head: true })
                .eq('reuniao_id', resumo.id);
            
            const elTotal = document.getElementById('desktop-presenca-total');
            if (elTotal) elTotal.innerText = totalPresencas || 0;

        } else {
            const resTextoEl = document.getElementById('desktop-resumo-texto');
            if (resTextoEl) resTextoEl.innerText = "Nenhum resumo publicado ainda.";
        }

        // 4. Carregar Mural Aconteceu
        carregarAconteceu();

        // 5. Configurar Área de Pedidos na Home
        const areaPedidoParticipante = document.getElementById('participante-area-pedido');
        const listaPedidosDesk = document.getElementById('desktop-lista-pedidos');
        
        if (areaPedidoParticipante) areaPedidoParticipante.style.display = 'block';
        if (listaPedidosDesk) listaPedidosDesk.style.display = 'none';

        // 6. Carregar Próximos Eventos do Mês
        carregarEventosHome();

        // 7. Verificar Pautas Pendentes
        await window.verificarPautasHome();

        // 8. Verificar Minhas Assinaturas Fraternais (Novo)
        await window.verificarMinhasAssinaturasHome();

        // 9. Verificar Minha Escala no Próximo GO (Novo)
        if (typeof window.verificarMinhaEscalaHome === 'function') {
            await window.verificarMinhaEscalaHome();
        }

        // 10. Carregar Notificações do Sininho (Novo)
        if (typeof window.carregarNotificacoes === 'function') {
            await window.carregarNotificacoes();
        }

    } catch (err) {
        console.error("Erro ao carregar dashboard:", err);
    }
}

window.verificarPautasHome = async function() {
    const alertaBox = document.getElementById('home-alerta-pauta');
    const resumoText = document.getElementById('home-pauta-resumo');
    // DEBUG: Log para diagnóstico
    console.log("DEBUG: Iniciando verificação de pautas para home...");
    console.log("DEBUG: Grupo ID:", window.meuGrupoId);
    console.log("DEBUG: Cargo:", window.meuCargo);

    try {
        console.log("Verificando pautas para home na tabela reunioes...");
        const { data: reunioes } = await supabaseClient
            .from('reunioes')
            .select('*')
            .eq('grupo_id', window.meuGrupoId)
            .eq('tipo', 'Núcleo')
            .order('data_reuniao', { ascending: false });

        let pauta = (reunioes || []).find(reu => {
            try { 
                const d = JSON.parse(reu.resumo_pregacao);
                return d.status === 'pauta'; 
            } catch(e) { return false; }
        });

        if (pauta) {
            console.log("DEBUG: Pauta encontrada para Home!", pauta);
            const dados = JSON.parse(pauta.resumo_pregacao);
            
            // Formatação Anti-Fuso (Texto Puro)
            const pura = pauta.data_reuniao.substring(0, 10);
            const [ano, mes, dia] = pura.split('-');
            
            // Backup: Se o banco zerar a hora, tentamos pegar do JSON
            let dataReferencia = String(dados.data_hora_planejada || pauta.data_reuniao || "");
            let hora = "00:00";
            if (dataReferencia) {
                const matchHora = dataReferencia.match(/(\d{2}:\d{2})/);
                if (matchHora) hora = matchHora[1];
            }
            
            const dataAt = `${dia}/${mes} às ${hora}`;
            
            const topico = (dados.pautas || "Assuntos gerais").split('\n')[0];
            resumoText.innerText = `Próxima Reunião: ${dataAt} • Tópico: ${topico}...`;
            alertaBox.style.display = 'block';
        } else {
            console.log("DEBUG: Nenhuma pauta (status: pauta) encontrada no banco.");
            alertaBox.style.display = 'none';
        }
    } catch(e) { 
        console.error("Erro ao verificar pauta home:", e); 
        alertaBox.style.display = 'none';
    }
}

window.verificarMinhasAssinaturasHome = async function() {
    const alertaBox = document.getElementById('home-alerta-assinatura-individual');
    const msgText = document.getElementById('home-mensagem-assinatura');
    if (!alertaBox || !window.meuMembroId) return;

    try {
        const { data: atas } = await supabaseClient
            .from('reunioes')
            .select('*')
            .eq('grupo_id', window.meuGrupoId)
            .eq('tipo', 'Núcleo')
            .order('data_reuniao', { ascending: false });

        let pendente = (atas || []).find(ata => {
            try { 
                const d = JSON.parse(ata.resumo_pregacao);
                return d.status === 'finalizada' && d.presentes.includes(window.meuMembroId) && !d.assinaturas[window.meuMembroId];
            } catch(e) { return false; }
        });

        if (pendente) {
            const dataAt = new Date(pendente.data_reuniao).toLocaleDateString('pt-BR');
            msgText.innerHTML = `Olá, <b>${window.meuNome.split(' ')[0]}</b>! Que alegria partilharmos da nossa última reunião de núcleo no dia ${dataAt}. <br><br>
            Para que nossos passos continuem em plena unidade, o registro da ata aguarda sua leitura e assinatura fraternal.<br><br>
            Lembramos com carinho que, após 3 dias, o sistema realizará a confirmação automática para mantermos o fluxo de nossa missão. 
            Após esse prazo, sua ciência será registrada e a ata não poderá mais ser editada.`;
            alertaBox.style.display = 'block';
        } else {
            alertaBox.style.display = 'none';
        }
    } catch(e) { console.error(e); }
}

// --- CONTROLE DE MENU MOBILE ---
window.toggleMenuMobile = function() {
    const overlay = document.getElementById('mobile-menu-overlay');
    if (!overlay) return;
    
    if (overlay.style.display === 'none') {
        overlay.style.display = 'block';
        document.body.style.overflow = 'hidden'; // Trava scroll do fundo
    } else {
        overlay.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
};

window.clickMenuMobile = function(viewId) {
    toggleMenuMobile(); // Fecha o menu
    alternarView(viewId); // Muda a view
};

// ==========================================
// FIM DO ARQUIVO
// ==========================================
async function carregarAconteceu() {
    try {
        const { data: noticias, error } = await supabaseClient
            .from('aconteceu_go')
            .select(`*, membros (nome, foto_url)`)
            .eq('grupo_id', window.meuGrupoId)
            .order('criado_em', { ascending: false })
            .limit(5);

        if (error) throw error;

        const lista = document.getElementById('lista-aconteceu');
        const listaDesk = document.getElementById('desktop-lista-aconteceu');
        
        if (lista) lista.innerHTML = '';
        if (listaDesk) listaDesk.innerHTML = '';

        if (noticias.length === 0) {
            const empty = '<p style="font-size:0.8rem; color:var(--text-muted); text-align:center;">Nenhuma notícia recente.</p>';
            if (lista) lista.innerHTML = empty;
            if (listaDesk) listaDesk.innerHTML = empty;
        } else {
            noticias.forEach(n => {
                const dataStr = new Date(n.criado_em).toLocaleDateString('pt-BR');
                const foto = n.membros?.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(n.membros?.nome || 'Admin')}&background=1E3A8A&color=fff`;
                
                const itemHtml = `
                    <div style="background: #f8fafc; padding: 10px; border-radius: 8px; border-left: 3px solid var(--primary-blue);">
                        <div class="flex items-center gap-2" style="margin-bottom:5px;">
                            <img src="${foto}" style="width:20px; height:20px; border-radius:50%; object-fit:cover;">
                            <span style="font-size: 0.7rem; font-weight:600; color:var(--primary-blue);">${n.membros?.nome || 'GO+'}</span>
                            <span style="font-size: 0.65rem; color:var(--text-muted);">${dataStr}</span>
                        </div>
                        <p style="font-size: 0.8rem; line-height:1.4; color:var(--text-main);">${n.texto}</p>
                    </div>
                `;
                if (lista) lista.innerHTML += itemHtml;
                if (listaDesk) listaDesk.innerHTML += itemHtml;
            });
        }

        // Permissão para postar (Coordenador, Coord Ministério, Núcleo)
        const btnAdd = document.getElementById('btn-add-aconteceu') || document.getElementById('desktop-btn-add-aconteceu');
        if (btnAdd && ['Coordenador', 'Núcleo', 'Coord. Ministério'].includes(window.meuCargo)) {
            btnAdd.style.display = 'block';
        }

    } catch (e) {
        console.error("Erro ao carregar aconteceu", e);
    }
}

window.abrirModalAconteceu = function() {
    document.getElementById('modal-aconteceu').style.display = 'flex';
}

window.fecharModalAconteceu = function() {
    document.getElementById('modal-aconteceu').style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
    const formAconteceu = document.getElementById('form-aconteceu');
    if (formAconteceu) {
        formAconteceu.addEventListener('submit', async (e) => {
            e.preventDefault();
            const txt = document.getElementById('aconteceu-texto').value;
            try {
                const { error } = await supabaseClient.from('aconteceu_go').insert([{
                    grupo_id: window.meuGrupoId,
                    membro_id: window.meuMembroId,
                    texto: txt
                }]);
                if (error) throw error;
                
                fecharModalAconteceu();
                document.getElementById('form-aconteceu').reset();
                carregarAconteceu();
            } catch (err) {
                console.error("Erro ao postar notícia", err);
                alert("Erro ao postar notícia.");
            }
        });
    }
});

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
        targetView.style.display = 'block'; // Ou grid, mas os cards resolvem
        
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
            'view-tesouraria': ['Tesouraria']
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
            
            // Estado Visual: Não Confirmado
            window.userJaConfirmouPresenca = false;
            if (btn) {
                btn.innerText = "Não estive!";
                btn.style.setProperty('background-color', 'var(--primary-blue)', 'important');
            }
            if (feed) {
                feed.innerText = "Que pena! Estamos te esperando no próximo.";
                feed.style.color = "#dc2626"; // Vermelho
            }
        } else {
            // --- MARCAR ---
            const { error } = await supabaseClient.from('presencas').insert([{
                reuniao_id: window.ultimoGoId,
                membro_id: window.meuMembroId,
                marcado_por_usuario: true
            }]);
            
            if (error) throw error;
            
            // Estado Visual: Confirmado
            window.userJaConfirmouPresenca = true;
            if (btn) {
                btn.innerText = "Você estava lá ✓";
                btn.style.setProperty('background-color', '#16a34a', 'important');
            }
            if (feed) {
                feed.innerText = "Obrigado! Que bom que esteve lá!";
                feed.style.color = "#16a34a"; // Verde
            }
        }
        
        // Atualizar contador de presenças sem recarregar tudo
        const { count } = await supabaseClient
            .from('presencas')
            .select('*', { count: 'exact', head: true })
            .eq('reuniao_id', window.ultimoGoId);
        
        const elTotal = document.getElementById('desktop-presenca-total');
        if (elTotal) elTotal.innerText = count || 0;

    } catch(e) {
        console.error("Erro ao alternar presença:", e);
        alert("Erro ao processar sua presença. Tente novamente.");
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
            const elInfo = document.getElementById('sidebar-coord-info');
            const elNome = document.getElementById('sidebar-coord-nome');
            if (elInfo && elNome) {
                elInfo.style.display = 'block';
                elNome.innerText = coord.nome;
            }
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
            container.innerHTML = `
                <div class="card text-center">
                    <p style="color: var(--text-muted);">Você ainda não enviou nenhum pedido de oração.</p>
                </div>
            `;
            return;
        }

        pedidos.forEach(p => {
            const data = new Date(p.criado_em).toLocaleDateString('pt-BR');
            const div = document.createElement('div');
            div.className = 'card';
            div.style.borderLeft = '4px solid var(--primary-blue)';
            div.style.marginBottom = '10px';
            div.innerHTML = `
                <div class="flex justify-between items-start" style="margin-bottom: 10px;">
                    <span style="font-size: 0.7rem; color: var(--text-muted);">${data}</span>
                    <div class="flex gap-2">
                        <button onclick="editarPedido('${p.id}', '${p.texto.replace(/'/g, "\\'")}')" style="background:none; border:none; color:var(--primary-blue); font-size:0.7rem; cursor:pointer;">✏️ Editar</button>
                        <button onclick="excluirPedido('${p.id}')" style="background:none; border:none; color:var(--primary-red); font-size:0.7rem; cursor:pointer;">🗑️ Excluir</button>
                    </div>
                </div>
                <p style="font-size: 0.9rem; color: var(--text-main); line-height: 1.5;">${p.texto}</p>
            `;
            container.appendChild(div);
        });
    } catch (e) {
        console.error("Erro ao carregar meus pedidos:", e);
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
            const el = document.getElementById('sidebar-coord-nome');
            if (el) el.innerText = coord.nome;
        }
    } catch(e) { console.error(e); }
}

window.excluirPedido = async function(id) {
    if (confirm("Deseja realmente excluir este pedido?")) {
        try {
            const { error } = await supabaseClient.from('pedidos_oracao').delete().eq('id', id);
            if (error) throw error;
            carregarMeusPedidos();
        } catch (e) {
            alert("Erro ao excluir pedido.");
        }
    }
}

window.editarPedido = async function(id, textoAntigo) {
    const novoTexto = prompt("Edite seu pedido de oração:", textoAntigo);
    if (novoTexto && novoTexto !== textoAntigo) {
        try {
            const { error } = await supabaseClient.from('pedidos_oracao').update({ texto: novoTexto }).eq('id', id);
            if (error) throw error;
            carregarMeusPedidos();
        } catch (e) {
            alert("Erro ao editar pedido.");
        }
    }
}

async function carregarEventosHome() {
    const container = document.getElementById('lista-eventos-home');
    if (!container) return;

    try {
        const agora = new Date();
        const primeiroDiaMes = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString();
        const ultimoDiaMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0, 23, 59, 59).toISOString();

        let query = supabaseClient
            .from('eventos')
            .select('*')
            .eq('grupo_id', window.meuGrupoId)
            .gte('data', primeiroDiaMes)
            .lte('data', ultimoDiaMes)
            .order('data', { ascending: true });

        // Se for participante, vê apenas públicos
        if (window.meuCargo === 'Participante') {
            query = query.eq('visibilidade', 'Público');
        }

        const { data: eventos } = await query;
        container.innerHTML = '';

        if (!eventos || eventos.length === 0) {
            container.innerHTML = '<p style="font-size:0.75rem; color:var(--text-muted); text-align:center;">Nenhum evento para este mês.</p>';
            return;
        }

        eventos.forEach(ev => {
            const data = new Date(ev.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            container.innerHTML += `
                <div style="padding: 8px; background: #f8fafc; border-radius: 6px; border-left: 3px solid var(--primary-red);">
                    <div style="font-size: 0.8rem; font-weight: 600; color: var(--primary-blue);">${ev.titulo}</div>
                    <div style="font-size: 0.7rem; color: var(--text-muted);">📅 ${data} • ${ev.local || 'Local não definido'}</div>
                </div>
            `;
        });
    } catch (e) {
        console.error("Erro ao carregar eventos home:", e);
    }
}

window.compartilharConvite = async function() {
    if (!window.infoGO || !window.proximaDataGO) {
        alert("Informações do GO ainda não carregadas.");
        return;
    }

    const g = window.infoGO;
    const dataFormatada = new Date(window.proximaDataGO + 'T12:00:00').toLocaleDateString('pt-BR');
    const horario = g.hora_reuniao_oracao || "19:30";
    
    let localLink = g.local_link_maps || "Local habitual";
    if (localLink && localLink.startsWith('http')) {
        // Já é um link
    } else if (localLink !== "Local habitual") {
        localLink = 'https://' + localLink;
    }

    const mensagem = `Ei! Quero te fazer um convite especial

Vai acontecer o nosso Grupo de Oração *${g.nome}*, e eu gostaria muito que você fosse.
📅 *Data:* ${dataFormatada}
⏰ *Horário:* ${horario}
📍 *Local:* ${localLink}

Vai ser uma alegria ter você lá 🙏
Tenho certeza que vai gostar.

Com carinho,
*${window.meuNome || 'Seu amigo(a)'}*`;

    if (navigator.share) {
        try {
            await navigator.share({
                title: `Convite para o GO ${g.nome}`,
                text: mensagem
            });
        } catch (err) { console.error(err); }
    } else {
        try {
            await navigator.clipboard.writeText(mensagem);
            alert("Convite copiado! Cole no WhatsApp para convidar seus amigos.");
            window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(mensagem)}`, '_blank');
        } catch (err) { alert("Erro ao copiar convite."); }
    }
};
