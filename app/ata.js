// ==========================================
// MÓDULO: GESTÃO DE REUNIÕES PROFISSIONAL (FIX)
// ==========================================

let pautaIdAtual = null;
let ataEmEdicao = null;

document.addEventListener('DOMContentLoaded', () => {
    // Escuta cliques nos menus para carregar as reuniões
    document.body.addEventListener('click', (e) => {
        const target = e.target.closest('.sidebar-item, .menu-mobile-item, .nav-item');
        if (target && (target.innerText.includes('Reunião') || target.innerText.includes('Ata'))) {
            setTimeout(carregarAtas, 300);
        }
    });
    
    // Fechar modais ao clicar fora
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });

    // Inicia verificações
    setTimeout(() => {
        verificarAssinaturasPendentes();
        if (typeof window.verificarPautasHome === 'function') window.verificarPautasHome();
        if (typeof window.verificarMinhasAssinaturasHome === 'function') window.verificarMinhasAssinaturasHome();
    }, 2000);
});

// --- CARREGAMENTO E SEPARAÇÃO ---

async function carregarAtas() {
    if (!window.meuGrupoId) return;
    try {
        const { data: reunioes, error } = await supabaseClient
            .from('reunioes')
            .select('*')
            .eq('grupo_id', window.meuGrupoId)
            .eq('tipo', 'Núcleo')
            .order('data_reuniao', { ascending: false });

        if (error) throw error;

        const lista = document.getElementById('lista-atas');
        const listaPendentes = document.getElementById('lista-atas-pendentes');
        const containerPendentes = document.getElementById('container-atas-pendentes');
        const containerBtn = document.getElementById('container-btn-proxima-reuniao');
        const btnDataText = document.getElementById('btn-pauta-data');
        
        if (lista) lista.innerHTML = '';
        if (listaPendentes) listaPendentes.innerHTML = '';
        if (containerBtn) {
            containerBtn.style.display = 'none';
            // Limpa botões antigos se houver um container de lista dentro dele
            const listArea = document.getElementById('lista-proximas-reunioes');
            if (listArea) listArea.innerHTML = '';
        }
        if (containerPendentes) containerPendentes.style.display = 'none';
        pautaIdAtual = null;

        const agora = new Date();

        reunioes.forEach(ata => {
            let dados = {}; 
            try { dados = JSON.parse(ata.resumo_pregacao || '{}'); } catch(e) { dados = { desenvolvimento: ata.resumo_pregacao, status: 'finalizada' }; }

            if (dados.status === 'pauta') {
                if (containerBtn) {
                    containerBtn.style.display = 'block';
                    exibirBotaoPautaDinamico(ata);
                }
            } else {
                // ... resto da lógica de pendentes e histórico (não muda)
                const nPresentes = (dados.presentes || []).length;
                const nAssinaturas = Object.keys(dados.assinaturas || {}).length;
                const dataFinal = new Date(dados.data_finalizacao || ata.data_reuniao);
                const diasPassados = (agora - dataFinal) / (1000 * 60 * 60 * 24);

                if ((nAssinaturas < nPresentes && diasPassados < 3) || dados.status === 'em_revisao') {
                    exibirAtaPendente(ata, dados);
                    if (containerPendentes) containerPendentes.style.display = 'block';
                } else {
                    exibirAtaNoHistorico(ata, dados);
                }
            }
        });
    } catch (err) { console.error(err); }
}

function exibirBotaoPautaDinamico(ata) {
    const listArea = document.getElementById('lista-proximas-reunioes');
    if (!listArea) return;
    
    // SOLUÇÃO DEFINITIVA: Pegar dia e mês diretamente do texto (AAAA-MM-DD)
    const pura = ata.data_reuniao.substring(0, 10);
    const [ano, mes, dia] = pura.split('-');
    const dataBr = `${dia}/${mes}`;
    
    // Pega a hora de forma robusta via Regex
    let hora = "00:00";
    const matchHora = ata.data_reuniao.match(/(\d{2}:\d{2})/);
    if (matchHora) hora = matchHora[1];

    const div = document.createElement('div');
    // Estilo ultra-reforçado para evitar sobreposição
    div.style.cssText = "display: block !important; width: 100% !important; margin-bottom: 25px !important; position: relative !important; clear: both !important; float: none !important;";
    div.innerHTML = `
        <div style="padding: 15px; border: 2px solid #3b82f6; background: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <button class="btn btn-primary flex justify-between items-center" style="width:100%; padding:15px; border-radius:8px; margin-bottom: 12px;" onclick="window.pautaIdAtual='${ata.id}'; window.iniciarReuniaoAgora('${ata.id}');">
                <div class="text-left">
                    <div style="font-size:1rem; font-weight:800;">Reunião: ${dataBr} às ${hora}</div>
                    <div style="font-size:0.65rem; opacity:0.9; text-transform:uppercase; font-weight:700;">▶️ Iniciar Reunião de Núcleo</div>
                </div>
                <span style="font-size:1.5rem;">📝</span>
            </button>
            <div class="flex gap-2">
                <button class="btn btn-outline" style="flex:1; font-size: 0.75rem; background:#f0f7ff; padding:10px; border-radius:8px; font-weight:700; border: 1px solid #3b82f6;" onclick="window.pautaIdAtual='${ata.id}'; window.editarPauta();">✏️ Editar</button>
                <button class="btn btn-outline" style="color:#ef4444; border-color:#fee2e2; background:#fff1f2; flex:0.3; font-size: 0.8rem; padding:10px; border-radius:8px;" onclick="window.pautaIdAtual='${ata.id}'; window.cancelarPauta();">🗑️</button>
            </div>
        </div>
    `;
    listArea.appendChild(div);
}

function exibirAtaPendente(ata, dados) {
    const lista = document.getElementById('lista-atas-pendentes');
    if (!lista) return;
    const div = document.createElement('div');
    div.className = 'card';
    const emRevisao = dados.status === 'em_revisao';
    div.style.cssText = `padding:15px; border-left:5px solid ${emRevisao ? '#ef4444' : '#fbbf24'}; background:${emRevisao ? '#fef2f2' : '#fffdf5'};`;

    const dataFormatada = new Date(ata.data_reuniao).toLocaleDateString('pt-BR');
    const nPresentes = (dados.presentes || []).length;
    const nAssinaturas = Object.keys(dados.assinaturas || {}).length;

    div.innerHTML = `
        <div class="flex justify-between items-center" style="margin-bottom:10px;">
            <div style="font-weight:800; color:${emRevisao ? '#991b1b' : '#92400e'}; font-size:0.9rem;">
                ${emRevisao ? '🚨 EM REVISÃO' : '⏳ AGUARDANDO'} - ${dataFormatada}
            </div>
            <span style="font-size:0.65rem; background:${emRevisao ? '#fee2e2' : '#fef3c7'}; color:${emRevisao ? '#991b1b' : '#92400e'}; padding:4px 8px; border-radius:20px; font-weight:700;">
                ${nAssinaturas}/${nPresentes} assinaturas
            </span>
        </div>
        <p style="font-size:0.75rem; color:${emRevisao ? '#b91c1c' : '#b45309'}; margin-bottom:12px;">
            ${emRevisao ? 'Sugestões enviadas. Secretário revisando...' : 'Disponível para leitura e assinatura.'}
        </p>
        <div class="flex gap-2">
            <button class="btn btn-outline" style="flex:1; font-size: 0.7rem;" onclick="visualizarAtaCompleta('${ata.id}')">🔍 Ler Documento</button>
            ${(window.meuCargo !== 'Participante') ? `<button class="btn btn-primary" style="flex:1; font-size:0.7rem;" onclick="iniciarReuniaoAgora('${ata.id}')">✏️ Editar</button>` : ''}
        </div>
    `;
    lista.appendChild(div);
}

function exibirAtaNoHistorico(ata, dados) {
    const lista = document.getElementById('lista-atas');
    if (!lista) return;
    const div = document.createElement('div');
    div.className = 'card';
    div.style.cssText = 'padding:15px; margin-bottom:10px; border-left:4px solid #16a34a; opacity: 0.9;';
    const dataFormatada = new Date(ata.data_reuniao).toLocaleDateString('pt-BR');

    div.innerHTML = `
        <div class="flex justify-between items-center" style="margin-bottom:8px;">
            <div style="font-weight:700; color:#166534; font-size:0.85rem;">Reunião de ${dataFormatada}</div>
            <span style="font-size:0.6rem; color:#16a34a; font-weight:700;">✅ CONCLUÍDA</span>
        </div>
        <button class="btn btn-outline" style="width:100%; font-size:0.7rem; padding:6px;" onclick="visualizarAtaCompleta('${ata.id}')">Abrir Documento</button>
    `;
    lista.appendChild(div);
}

// --- GESTÃO DE PAUTAS E EXECUÇÃO ---

window.abrirModalPauta = function() {
    pautaIdAtual = null;
    document.getElementById('modal-pauta-titulo').innerText = "Planejar Reunião";
    document.getElementById('pauta-data').value = "";
    document.getElementById('pauta-topicos').value = "";
    document.getElementById('modal-pauta').style.display = 'flex';
};

window.editarPauta = async function() {
    if (!window.pautaIdAtual) return;
    try {
        const { data: ata } = await supabaseClient.from('reunioes').select('*').eq('id', window.pautaIdAtual).single();
        let dados = JSON.parse(ata.resumo_pregacao);
        
        // CORREÇÃO ROBUSTA ANTI-FUSO
        let dataStr = ata.data_reuniao || "";
        if (dataStr.includes(' ')) dataStr = dataStr.replace(' ', 'T');
        
        // Se a data vier sem hora (apenas 10 caracteres), adiciona T00:00
        if (dataStr.length === 10) dataStr += "T00:00";
        
        const finalData = dataStr.substring(0, 16); // Garante formato AAAA-MM-DDTHH:mm
        
        document.getElementById('pauta-data').value = finalData;
        document.getElementById('pauta-local').value = dados.local || "";
        document.getElementById('pauta-topicos').value = dados.pautas || "";
        document.getElementById('modal-pauta-titulo').innerText = "Editar Planejamento";
        document.getElementById('modal-pauta').style.display = 'flex';
    } catch(e) { console.error("Erro ao editar pauta:", e); }
};

window.salvarPauta = async function() {
    const dataVal = document.getElementById('pauta-data').value;
    const pautasVal = document.getElementById('pauta-topicos').value;
    if (!dataVal) return alert("Escolha a data e hora.");

    const dados = { 
        status: 'pauta', 
        pautas: pautasVal, 
        presentes: [], 
        assinaturas: {}, 
        mocoes_go: "", 
        mocoes_proxima: "", 
        avaliacao_go: "", 
        informativos: "", 
        local: "", 
        horarios: {inicio:"", fim:""},
        escala: { pregacao: "", conducao: "", acolhida: "" }
    };

    try {
        const localVal = document.getElementById('pauta-local').value;
        dados.local = localVal;

        if (window.pautaIdAtual) {
            await supabaseClient.from('reunioes').update({ data_reuniao: dataVal, resumo_pregacao: JSON.stringify(dados) }).eq('id', window.pautaIdAtual);
        } else {
            await supabaseClient.from('reunioes').insert([{ grupo_id: window.meuGrupoId, tipo: 'Núcleo', data_reuniao: dataVal, resumo_pregacao: JSON.stringify(dados) }]);
        }
        
        fecharModalPauta();
        alert("Reunião planejada!");
        
        // Pequeno delay para garantir sincronia com o banco
        setTimeout(() => {
            carregarAtas();
            if (typeof window.verificarPautasHome === 'function') window.verificarPautasHome();
        }, 500);
        
    } catch(e) { console.error("Erro ao salvar pauta:", e); }
};

window.iniciarReuniaoAgora = async function(idAtaManual = null) {
    const id = idAtaManual || pautaIdAtual;
    if (!id) return;
    try {
        const { data: ata } = await supabaseClient.from('reunioes').select('*').eq('id', id).single();
        let dados = JSON.parse(ata.resumo_pregacao);
        ataEmEdicao = ata;

        document.getElementById('ata-pautas-referencia').innerText = dados.pautas || "Sem pautas definidas.";
        document.getElementById('ata-hora-inicio').value = dados.horarios?.inicio || "";
        document.getElementById('ata-hora-fim').value = dados.horarios?.fim || "";
        document.getElementById('ata-local').value = dados.local || "";
        
        // Novos campos de Escuta e Avaliação
        document.getElementById('ata-mocoes-go').value = dados.mocoes_go || "";
        document.getElementById('ata-mocoes-proxima').value = dados.mocoes_proxima || "";
        document.getElementById('ata-avaliacao-go').value = dados.avaliacao_go || "";
        document.getElementById('ata-informativos-decisões').value = dados.informativos || "";

        // Novos campos de Escala
        document.getElementById('ata-escala-pregacao').value = dados.escala?.pregacao || "";
        document.getElementById('ata-escala-conducao').value = dados.escala?.conducao || "";
        document.getElementById('ata-escala-acolhida').value = dados.escala?.acolhida || "";

        const containerRevisao = document.getElementById('container-solicitacoes-revisao');
        const listaRevisao = document.getElementById('lista-solicitacoes-revisao');
        if (containerRevisao && listaRevisao) {
            if (dados.solicitacoes && dados.solicitacoes.length > 0) {
                containerRevisao.style.display = 'block';
                listaRevisao.innerHTML = dados.solicitacoes.map(s => `<div style="background:white; padding:8px; border-radius:4px; border-left:3px solid #ef4444; margin-bottom:5px;"><b>${s.membro}:</b> "${s.texto}"</div>`).join('');
            } else { containerRevisao.style.display = 'none'; }
        }

        const { data: nucleo } = await supabaseClient.from('membros').select('id, nome').eq('grupo_id', window.meuGrupoId).neq('cargo', 'Participante').order('nome');
        const lista = document.getElementById('ata-chamada-lista');
        lista.innerHTML = '';
        if (nucleo) {
            nucleo.forEach(m => {
                const checked = dados.presentes.includes(m.id) ? 'checked' : '';
                lista.innerHTML += `<label style="display:flex; align-items:center; gap:10px; padding:10px; background:#fff; border:1px solid #eee; border-radius:8px; margin-bottom:5px; cursor:pointer;">
                    <input type="checkbox" class="check-presenca" value="${m.id}" ${checked} style="width:18px; height:18px;">
                    <span style="font-size:0.85rem; font-weight:600;">${m.nome}</span>
                </label>`;
            });
        }
        document.getElementById('modal-ata-execucao').style.display = 'flex';
    } catch(e) { console.error(e); }
};

window.finalizarAta = async function() {
    if (!ataEmEdicao) return;
    const dados = {
        status: 'finalizada',
        pautas: JSON.parse(ataEmEdicao.resumo_pregacao).pautas,
        horarios: { inicio: document.getElementById('ata-hora-inicio').value, fim: document.getElementById('ata-hora-fim').value },
        local: document.getElementById('ata-local').value,
        
        mocoes_go: document.getElementById('ata-mocoes-go').value,
        mocoes_proxima: document.getElementById('ata-mocoes-proxima').value,
        avaliacao_go: document.getElementById('ata-avaliacao-go').value,
        informativos: document.getElementById('ata-informativos-decisões').value,
        
        escala: {
            pregacao: document.getElementById('ata-escala-pregacao').value,
            conducao: document.getElementById('ata-escala-conducao').value,
            acolhida: document.getElementById('ata-escala-acolhida').value
        },

        presentes: Array.from(document.querySelectorAll('.check-presenca:checked')).map(c => c.value),
        assinaturas: JSON.parse(ataEmEdicao.resumo_pregacao).assinaturas || {},
        solicitacoes: JSON.parse(ataEmEdicao.resumo_pregacao).solicitacoes || [],
        data_finalizacao: new Date().toISOString()
    };
    try {
        await supabaseClient.from('reunioes').update({ resumo_pregacao: JSON.stringify(dados) }).eq('id', ataEmEdicao.id);
        alert("Ata enviada para assinaturas!");
        fecharModalAta();
        carregarAtas();
        verificarAssinaturasPendentes();
    } catch(e) { console.error(e); }
};

// --- VISUALIZAÇÃO E ASSINATURA ---

window.visualizarAtaCompleta = async function(id) {
    const { data: ata } = await supabaseClient.from('reunioes').select('*').eq('id', id).single();
    let dados = JSON.parse(ata.resumo_pregacao);
    window.ataSendoVisualizada = ata;
    document.getElementById('form-ata-nome-grupo').innerText = window.infoGO?.nome || "GRUPO DE ORAÇÃO";
    const dataAt = new Date(ata.data_reuniao).toLocaleDateString('pt-BR');
    
    let html = `
        <div style="margin-bottom:20px; font-size:0.85rem;"><b>1. INFORMAÇÕES GERAIS</b><br>• Data: ${dataAt}<br>• Hora: ${dados.horarios?.inicio || '--'} às ${dados.horarios?.fim || '--'}<br>• Local: ${dados.local || 'Habitual'}<br>• Pautas:<br>${(dados.pautas || "").split('\n').map((p,i) => `&nbsp;&nbsp;${i+1}. ${p}`).join('<br>')}</div>
        <div style="margin-bottom:20px; font-size:0.85rem;"><b>2. PARTICIPANTES</b><br><div id="visualizar-participantes-lista">Carregando...</div></div>
        <div style="margin-bottom:20px; font-size:0.85rem;">
            <b>3. TÓPICOS, AVALIAÇÃO E ESCUTA PROFÉTICA</b><br>
            <div style="padding-left:10px; margin-top:5px;">
                <i>• Moções para o GO:</i><br> ${dados.mocoes_go || "---"}<br><br>
                <i>• Moções para próxima Reunião:</i><br> ${dados.mocoes_proxima || "---"}<br><br>
                <i>• Avaliação do último GO:</i><br> ${dados.avaliacao_go || "---"}<br><br>
                <i>• Informativos e Decisões:</i><br> <b>${dados.informativos || "---"}</b>
            </div>
        </div>
        <div style="margin-bottom:20px; font-size:0.85rem;">
            <b>4. ESCALA DE SERVIÇO</b><br>
            <div style="padding-left:10px; margin-top:5px;">
                • Pregação: ${dados.escala?.pregacao || "---"}<br>
                • Condução: ${dados.escala?.conducao || "---"}<br>
                • Acolhida: ${dados.escala?.acolhida || "---"}
            </div>
        </div>
    `;
    document.getElementById('documento-ata-corpo').innerHTML = html;
    document.getElementById('modal-ver-ata-formatada').style.display = 'flex';

    const { data: membros } = await supabaseClient.from('membros').select('id, nome').in('id', dados.presentes);
    let partHtml = "";
    if (membros) {
        membros.forEach(m => {
            const ass = dados.assinaturas[m.id];
            const statusTexto = (ass || (new Date() - new Date(dados.data_finalizacao)) / (1000*60*60*24) > 3) ? '<span style="color:#16a34a; font-weight:700;">(assinado)</span>' : '<span style="color:#92400e;">(pendente)</span>';
            partHtml += `• ${m.nome} ${statusTexto}<br>`;
        });
        document.getElementById('visualizar-participantes-lista').innerHTML = partHtml;
    }

    const diasPassados = (new Date() - new Date(dados.data_finalizacao)) / (1000 * 60 * 60 * 24);
    const nPresentes = (dados.presentes || []).length;
    const nAssinaturas = Object.keys(dados.assinaturas || {}).length;
    const concluida = (nAssinaturas === nPresentes) || diasPassados >= 3;

    document.getElementById('btn-confirmar-leitura-assinatura').style.display = (concluida || dados.assinaturas[window.meuMembroId]) ? 'none' : 'block';
    const btnMudanca = document.querySelector('[onclick="abrirModalSolicitarMudanca()"]');
    if (btnMudanca) btnMudanca.style.display = concluida ? 'none' : 'block';
};

window.abrirModalSolicitarMudanca = () => { document.getElementById('modal-solicitar-mudanca').style.display = 'flex'; };

window.enviarSolicitacaoMudanca = async function() {
    const texto = document.getElementById('texto-solicitacao-mudanca').value;
    if (!texto) return alert("Descreva a mudança.");
    let ata = window.ataSendoVisualizada;
    let dados = JSON.parse(ata.resumo_pregacao);
    if (!dados.solicitacoes) dados.solicitacoes = [];
    dados.solicitacoes.push({ membro: window.meuNome, texto: texto, data: new Date().toISOString() });
    dados.status = 'em_revisao';
    try {
        await supabaseClient.from('reunioes').update({ resumo_pregacao: JSON.stringify(dados) }).eq('id', ata.id);
        alert("Solicitação enviada!");
        document.getElementById('modal-solicitar-mudanca').style.display = 'none';
        document.getElementById('modal-ver-ata-formatada').style.display = 'none';
        carregarAtas();
    } catch(e) { console.error(e); }
};

window.confirmarAssinatura = async function() {
    const senha = document.getElementById('assinatura-senha').value;
    if (!senha) return alert("Digite sua senha.");
    try {
        const { error: authErr } = await supabaseClient.auth.signInWithPassword({
            email: window.meuEmail || (await supabaseClient.auth.getUser()).data.user.email,
            password: senha
        });
        if (authErr) return alert("Senha incorreta.");
        let ata = window.ataParaAssinar;
        let dados = JSON.parse(ata.resumo_pregacao);
        if (!dados.assinaturas) dados.assinaturas = {};
        dados.assinaturas[window.meuMembroId] = { status: 'assinado', data: new Date().toISOString() };
        await supabaseClient.from('reunioes').update({ resumo_pregacao: JSON.stringify(dados) }).eq('id', ata.id);
        alert("Assinatura registrada! 🙏");
        fecharModalAssinatura();
        
        // FORÇA ATUALIZAÇÃO DA HOME IMEDIATAMENTE
        if (typeof window.verificarMinhasAssinaturasHome === 'function') {
            await window.verificarMinhasAssinaturasHome();
        }
        
        carregarAtas();
    } catch(e) { console.error(e); }
};

// --- AUXILIARES ---

window.abrirModalAssinaturaDesdeVer = () => {
    document.getElementById('modal-ver-ata-formatada').style.display = 'none';
    window.ataParaAssinar = window.ataSendoVisualizada;
    document.getElementById('modal-assinatura').style.display = 'flex';
};

window.toggleAccordionAta = (id) => {
    const el = document.getElementById(id);
    const seta = document.getElementById('seta-' + id);
    if (!el) return;
    if (el.style.display === 'none' || el.style.display === '') { el.style.display = 'block'; if(seta) seta.innerText = '▲'; }
    else { el.style.display = 'none'; if(seta) seta.innerText = '▼'; }
};

window.cancelarPauta = async function() {
    if (!window.pautaIdAtual) {
        console.error("Tentativa de excluir sem ID.");
        return alert("Erro: ID da reunião não encontrado.");
    }
    
    if (confirm("Deseja realmente excluir este planejamento?")) {
        try {
            console.log("Iniciando exclusão da pauta:", window.pautaIdAtual);
            const { error } = await supabaseClient.from('reunioes').delete().eq('id', window.pautaIdAtual);
            
            if (error) {
                console.error("Erro Supabase:", error);
                throw error;
            }
            
            window.pautaIdAtual = null;
            alert("Planejamento excluído com sucesso! 🙏");
            fecharModalPauta();
            carregarAtas();
            
            if (typeof window.verificarPautasHome === 'function') window.verificarPautasHome();
        } catch(e) { 
            console.error("Erro catch:", e);
            alert("Erro ao excluir: " + e.message);
        }
    }
};

window.fecharModalAta = () => { document.getElementById('modal-ata-execucao').style.display = 'none'; };
window.fecharModalPauta = () => { document.getElementById('modal-pauta').style.display = 'none'; };
window.fecharModalAssinatura = () => { document.getElementById('modal-assinatura').style.display = 'none'; };

async function verificarAssinaturasPendentes() {
    // Função apenas para manter compatibilidade com chamadas antigas se houver
}
