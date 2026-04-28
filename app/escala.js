// ==========================================
// MÓDULO: GESTÃO DE ESCALAS INTEGRADA (ATA)
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // Inicia verificação após um pequeno delay para garantir que os IDs de grupo e usuário existam
    setTimeout(() => {
        window.verificarMinhaEscalaHome();
        
        // Listener para carregar a escala quando o menu for clicado
        document.body.addEventListener('click', (e) => {
            const target = e.target.closest('.sidebar-item, .menu-mobile-item, .nav-item');
            if (target && target.innerText.includes('Escala do GO')) {
                window.carregarEscalaDetalhada();
            }
        });
    }, 2500);
});

// 1. VERIFICAR ESCALA PARA ALERTA NA HOME
window.verificarMinhaEscalaHome = async function() {
    const alertaBox = document.getElementById('home-alerta-escala-individual');
    const msgText = document.getElementById('home-escala-texto');
    const alertaUrgente = document.getElementById('home-alerta-escala-urgente');
    const msgUrgente = document.getElementById('home-escala-urgente-texto');

    if (!window.meuNome) return;

    try {
        const { data: reunioes } = await supabaseClient
            .from('reunioes')
            .select('*')
            .eq('grupo_id', window.meuGrupoId)
            .eq('tipo', 'Núcleo')
            .order('data_reuniao', { ascending: false });

        if (!reunioes) return;

        // A. VERIFICAR SE HÁ SOLICITAÇÕES URGENTES (Para o Núcleo)
        if (window.meuCargo !== 'Participante') {
            const comUrgencia = (reunioes || []).find(r => {
                try {
                    const d = JSON.parse(r.resumo_pregacao);
                    return d.solicitacoes && d.solicitacoes.some(s => s.texto.includes('🚩 SOLICITAÇÃO DE TROCA'));
                } catch(e) { return false; }
            });

            if (comUrgencia && alertaUrgente) {
                const d = JSON.parse(comUrgencia.resumo_pregacao);
                const ultimaSol = d.solicitacoes.filter(s => s.texto.includes('🚩')).pop();
                msgUrgente.innerHTML = `<b>${ultimaSol.membro}</b> pediu uma troca na escala do próximo GO.`;
                alertaUrgente.style.display = 'block';
            } else if (alertaUrgente) {
                alertaUrgente.style.display = 'none';
            }
        }

        // B. VERIFICAR MINHA ESCALA INDIVIDUAL
        let reuniaoComEscala = reunioes.find(r => {
            try {
                const d = JSON.parse(r.resumo_pregacao);
                return d.escala && (d.escala.pregacao || d.escala.conducao || d.escala.acolhida);
            } catch(e) { return false; }
        });

        if (reuniaoComEscala && alertaBox) {
            const dados = JSON.parse(reuniaoComEscala.resumo_pregacao);
            const escala = dados.escala;
            
            let missao = "";
            if (escala.pregacao === window.meuNome) missao = "🔥 Pregação";
            else if (escala.conducao === window.meuNome) missao = "🛡️ Condução da Oração";
            else if (escala.acolhida === window.meuNome) missao = "🤝 Acolhida";

            if (missao) {
                msgText.innerHTML = `Você está escalado para a <b>${missao}</b> no próximo GO!`;
                alertaBox.style.display = 'block';
            } else {
                alertaBox.style.display = 'none';
            }
        }
    } catch(e) { console.error("Erro ao verificar escala home:", e); }
};

// 2. CARREGAR ESCALA DETALHADA NA VIEW
window.carregarEscalaDetalhada = async function() {
    const containerVisualizar = document.getElementById('container-escala-visualizar');
    const containerVazio = document.getElementById('container-escala-vazia');
    const dataTexto = document.getElementById('escala-data-texto');

    try {
        const { data: reunioes } = await supabaseClient
            .from('reunioes')
            .select('*')
            .eq('grupo_id', window.meuGrupoId)
            .eq('tipo', 'Núcleo')
            .order('data_reuniao', { ascending: false });

        let reuniaoComEscala = (reunioes || []).find(r => {
            try {
                const d = JSON.parse(r.resumo_pregacao);
                return d.escala && (d.escala.pregacao || d.escala.conducao || d.escala.acolhida);
            } catch(e) { return false; }
        });

        if (reuniaoComEscala) {
            const dados = JSON.parse(reuniaoComEscala.resumo_pregacao);
            const escala = dados.escala;
            
            // Data Formatada
            const pura = reuniaoComEscala.data_reuniao.substring(0, 10);
            const [ano, mes, dia] = pura.split('-');
            dataTexto.innerText = `Definida na Reunião de Núcleo (${dia}/${mes})`;

            document.getElementById('escala-ver-pregacao').innerText = escala.pregacao || "Não definido";
            document.getElementById('escala-ver-conducao').innerText = escala.conducao || "Não definido";
            document.getElementById('escala-ver-acolhida').innerText = escala.acolhida || "Não definido";

            containerVisualizar.style.display = 'block';
            containerVazio.style.display = 'none';
            
            // Guarda o ID da reunião para caso de solicitação de mudança
            window.reuniaoEscalaAtualId = reuniaoComEscala.id;

            // Mostra botão de editar apenas para Coordenador ou Secretário
            const btnAdmin = document.getElementById('btn-admin-editar-escala');
            if (btnAdmin) {
                const podeEditar = (window.meuCargo === 'Coordenador' || window.meuCargo === 'Secretário');
                btnAdmin.style.display = podeEditar ? 'block' : 'none';
            }

        } else {
            containerVisualizar.style.display = 'none';
            containerVazio.style.display = 'block';
            dataTexto.innerText = "Aguardando definição na ata de núcleo...";
        }
    } catch(e) { console.error("Erro ao carregar escala detalhada:", e); }
};

// 3. SOLICITAR ALTERAÇÃO DE ESCALA
window.solicitarAlteracaoEscala = async function() {
    const motivo = prompt("Por que você precisa de alteração na escala? (Este aviso será enviado para todo o núcleo)");
    if (!motivo) return;

    try {
        const { data: ata } = await supabaseClient.from('reunioes').select('*').eq('id', window.reuniaoEscalaAtualId).single();
        let dados = JSON.parse(ata.resumo_pregacao);

        if (!dados.solicitacoes) dados.solicitacoes = [];
        dados.solicitacoes.push({
            membro: window.meuNome,
            texto: `🚩 SOLICITAÇÃO DE TROCA DE ESCALA: ${motivo}`,
            data: new Date().toISOString()
        });

        await supabaseClient.from('reunioes').update({ resumo_pregacao: JSON.stringify(dados) }).eq('id', ata.id);
        
        alert("Sua solicitação foi enviada! O núcleo foi notificado via sistema. 🙏");
        window.carregarEscalaDetalhada();
        if (typeof window.verificarMinhaEscalaHome === 'function') window.verificarMinhaEscalaHome();
    } catch(e) { console.error("Erro ao solicitar mudança:", e); }
};

// 4. ADMINISTRATIVO: TROCA DE ESCALA (Coordenador/Secretário)
window.abrirModalTrocaEscala = async function() {
    if (!window.reuniaoEscalaAtualId) return;
    try {
        const { data: ata } = await supabaseClient.from('reunioes').select('*').eq('id', window.reuniaoEscalaAtualId).single();
        const dados = JSON.parse(ata.resumo_pregacao);
        const { data: membros } = await supabaseClient.from('membros').select('nome').eq('grupo_id', window.meuGrupoId).order('nome');

        // Popular selects do modal
        const selects = ['escala-edit-conducao', 'escala-edit-acolhida'];
        selects.forEach(sid => {
            const el = document.getElementById(sid);
            el.innerHTML = '<option value="">Selecione um servo...</option>';
            membros.forEach(m => el.innerHTML += `<option value="${m.nome}">${m.nome}</option>`);
        });

        document.getElementById('escala-edit-pregacao').value = dados.escala?.pregacao || "";
        document.getElementById('escala-edit-conducao').value = dados.escala?.conducao || "";
        document.getElementById('escala-edit-acolhida').value = dados.escala?.acolhida || "";

        document.getElementById('modal-editar-escala').style.display = 'flex';
    } catch(e) { console.error(e); }
};

window.salvarTrocaEscala = async function() {
    try {
        const { data: ata } = await supabaseClient.from('reunioes').select('*').eq('id', window.reuniaoEscalaAtualId).single();
        let dados = JSON.parse(ata.resumo_pregacao);

        dados.escala = {
            pregacao: document.getElementById('escala-edit-pregacao').value,
            conducao: document.getElementById('escala-edit-conducao').value,
            acolhida: document.getElementById('escala-edit-acolhida').value
        };

        // Limpa as solicitações de troca ao salvar a nova escala oficial
        dados.solicitacoes = (dados.solicitacoes || []).filter(s => !s.texto.includes('🚩 SOLICITAÇÃO DE TROCA'));

        await supabaseClient.from('reunioes').update({ resumo_pregacao: JSON.stringify(dados) }).eq('id', ata.id);
        
        alert("Escala atualizada com sucesso! Notificações de urgência removidas.");
        document.getElementById('modal-editar-escala').style.display = 'none';
        window.carregarEscalaDetalhada();
        if (typeof window.verificarMinhaEscalaHome === 'function') window.verificarMinhaEscalaHome();
    } catch(e) { console.error(e); }
};
