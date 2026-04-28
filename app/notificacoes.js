// ==========================================
// MÓDULO: CENTRO DE NOTIFICAÇÕES (SININHO)
// ==========================================

window.notificacoes = [];

window.toggleNotifications = function(type) {
    const panel = document.getElementById(`notif-panel-${type}`);
    if (panel.style.display === 'flex') {
        panel.style.display = 'none';
    } else {
        // Fecha outros se estiverem abertos
        document.querySelectorAll('.notification-panel').forEach(p => p.style.display = 'none');
        panel.style.display = 'flex';
        marcarVistoLocal();
    }
};

// Fecha painel ao clicar fora
document.addEventListener('click', (e) => {
    if (!e.target.closest('.notification-container')) {
        document.querySelectorAll('.notification-panel').forEach(p => p.style.display = 'none');
    }
});

window.carregarNotificacoes = async function() {
    try {
        const { data: reunioes } = await supabaseClient
            .from('reunioes')
            .select('id, data_reuniao, resumo_pregacao, criado_em')
            .eq('grupo_id', window.meuGrupoId)
            .order('criado_em', { ascending: false })
            .limit(10);

        let novasNotificacoes = [];

        if (reunioes) {
            reunioes.forEach(r => {
                const dados = JSON.parse(r.resumo_pregacao || '{}');
                const dataReuniao = new Date(r.data_reuniao).toLocaleDateString('pt-BR');
                
                // Notificação: Nova Reunião Planejada
                if (dados.status === 'pauta') {
                    novasNotificacoes.push({
                        id: `pauta-${r.id}`,
                        titulo: "📅 Novo Planejamento",
                        desc: `Uma nova reunião foi agendada para o dia ${dataReuniao}.`,
                        tempo: r.criado_em,
                        link: 'view-ata'
                    });
                }
                
                // Notificação: Ata Finalizada
                if (dados.status === 'finalizada') {
                    novasNotificacoes.push({
                        id: `ata-${r.id}`,
                        titulo: "📋 Ata Publicada",
                        desc: `A ata da reunião do dia ${dataReuniao} está disponível para leitura.`,
                        tempo: r.criado_em,
                        link: 'view-ata'
                    });
                }
            });
        }

        window.notificacoes = novasNotificacoes;
        renderizarNotificacoes();
        atualizarBadge();

    } catch (e) {
        console.error("Erro ao carregar notificações:", e);
    }
};

function renderizarNotificacoes() {
    const listDesktop = document.getElementById('notif-list-desktop');
    const listMobile = document.getElementById('notif-list-mobile');
    
    if (!listDesktop || !listMobile) return;

    if (window.notificacoes.length === 0) {
        const vazio = `<div style="padding:20px; text-align:center; color:var(--text-muted); font-size:0.8rem;">Nenhuma novidade agora.</div>`;
        listDesktop.innerHTML = vazio;
        listMobile.innerHTML = vazio;
        return;
    }

    const html = window.notificacoes.map(n => {
        const dataNotif = n.tempo ? new Date(n.tempo).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : "";
        return `
            <div class="notification-item" onclick="alternarView('${n.link}')">
                <div class="notification-item-title">${n.titulo}</div>
                <div class="notification-item-desc">${n.desc}</div>
                <div class="notification-item-time">${dataNotif}</div>
            </div>
        `;
    }).join('');

    listDesktop.innerHTML = html;
    listMobile.innerHTML = html;
}

function atualizarBadge() {
    const badgeDesktop = document.getElementById('notif-badge-desktop');
    const badgeMobile = document.getElementById('notif-badge-mobile');
    
    const lidas = JSON.parse(localStorage.getItem(`lidas_${window.meuMembroId}`) || '[]');
    const naoLidas = window.notificacoes.filter(n => !lidas.includes(n.id)).length;

    if (naoLidas > 0) {
        badgeDesktop.innerText = naoLidas;
        badgeDesktop.style.display = 'flex';
        badgeMobile.innerText = naoLidas;
        badgeMobile.style.display = 'flex';
    } else {
        badgeDesktop.style.display = 'none';
        badgeMobile.style.display = 'none';
    }
}

function marcarVistoLocal() {
    const lidas = window.notificacoes.map(n => n.id);
    localStorage.setItem(`lidas_${window.meuMembroId}`, JSON.stringify(lidas));
    setTimeout(atualizarBadge, 1000);
}

window.marcarTodasLidas = function() {
    marcarVistoLocal();
    atualizarBadge();
};
