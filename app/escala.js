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
    if (!alertaBox || !window.meuNome) return;

    try {
        // Busca a última ata finalizada ou planejamento (pauta) que tenha escala
        const { data: reunioes } = await supabaseClient
            .from('reunioes')
            .select('*')
            .eq('grupo_id', window.meuGrupoId)
            .eq('tipo', 'Núcleo')
            .order('data_reuniao', { ascending: false });

        if (!reunioes) return;

        // Procura a reunião mais recente (pauta ou finalizada) que tenha escala preenchida
        let reuniaoComEscala = reunioes.find(r => {
            try {
                const d = JSON.parse(r.resumo_pregacao);
                return d.escala && (d.escala.pregacao || d.escala.conducao || d.escala.acolhida);
            } catch(e) { return false; }
        });

        if (reuniaoComEscala) {
            const dados = JSON.parse(reuniaoComEscala.resumo_pregacao);
            const escala = dados.escala;
            const meuNomeCurto = window.meuNome.toLowerCase();
            
            let missao = "";
            if (escala.pregacao && escala.pregacao.toLowerCase().includes(meuNomeCurto)) missao = "🔥 Pregação";
            else if (escala.conducao && escala.conducao.toLowerCase().includes(meuNomeCurto)) missao = "🛡️ Condução da Oração";
            else if (escala.acolhida && escala.acolhida.toLowerCase().includes(meuNomeCurto)) missao = "🤝 Acolhida";

            if (missao) {
                // Formatação da Data (Anti-Fuso)
                const pura = reuniaoComEscala.data_reuniao.substring(0, 10);
                const [ano, mes, dia] = pura.split('-');
                
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
        // 1. Busca a reunião atual
        const { data: ata } = await supabaseClient.from('reunioes').select('*').eq('id', window.reuniaoEscalaAtualId).single();
        let dados = JSON.parse(ata.resumo_pregacao);

        // 2. Adiciona a solicitação nas "Sugestões de Mudança" (para o Secretário ver)
        if (!dados.solicitacoes) dados.solicitacoes = [];
        dados.solicitacoes.push({
            membro: window.meuNome,
            texto: `🚩 SOLICITAÇÃO DE TROCA DE ESCALA: ${motivo}`,
            data: new Date().toISOString()
        });

        // 3. Marca como "Em Revisão" se necessário
        dados.status = 'em_revisao';

        await supabaseClient.from('reunioes').update({ resumo_pregacao: JSON.stringify(dados) }).eq('id', ata.id);
        
        alert("Sua solicitação foi enviada! O núcleo foi notificado via sistema. 🙏");
        window.carregarEscalaDetalhada();
    } catch(e) { console.error("Erro ao solicitar mudança:", e); }
};
