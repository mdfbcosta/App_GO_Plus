// ==========================================
// MÓDULO: TESOURARIA E MENSALIDADES
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    const navItems = document.querySelectorAll('.sidebar-item, .nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.innerText.includes('Tesouraria')) {
                carregarFinanceiro();
            }
        });
    });

    const formFinanceiro = document.getElementById('form-financeiro');
    if (formFinanceiro) {
        formFinanceiro.addEventListener('submit', salvarFinanceiro);
    }
});

// --- CONFIGURAÇÃO DE MENSALIDADE ---

window.abrirConfigMensalidade = function() {
    const container = document.getElementById('config-mensalidade-container');
    container.style.display = container.style.display === 'none' ? 'block' : 'none';
    
    // Carrega valores salvos
    document.getElementById('config-valor-mensalidade').value = localStorage.getItem('go_valor_mensalidade') || '30';
    document.getElementById('config-dia-mensalidade').value = localStorage.getItem('go_dia_mensalidade') || '10';
};

window.salvarConfigMensalidade = function() {
    const valor = document.getElementById('config-valor-mensalidade').value;
    const dia = document.getElementById('config-dia-mensalidade').value;
    
    localStorage.setItem('go_valor_mensalidade', valor);
    localStorage.setItem('go_dia_mensalidade', dia);
    
    alert("Configurações de mensalidade salvas!");
    document.getElementById('config-mensalidade-container').style.display = 'none';
    carregarControleMensalidades(); // Atualiza a lista
};

// --- ACORDEÃO MENSALIDADES ---
window.toggleMensalidadesExpandir = function() {
    const container = document.getElementById('controle-mensalidades-container');
    const seta = document.getElementById('seta-mensalidade');
    if (!container) return;
    
    if (container.style.display === 'none') {
        container.style.display = 'block';
        seta.style.transform = 'rotate(180deg)';
    } else {
        container.style.display = 'none';
        seta.style.transform = 'rotate(0deg)';
    }
};

// --- CORE: CARREGAMENTO FINANCEIRO ---

async function carregarFinanceiro() {
    if (!window.meuGrupoId) return;

    try {
        const { data: movimentacoes, error } = await supabaseClient
            .from('financeiro')
            .select('*')
            .eq('grupo_id', window.meuGrupoId)
            .order('data_registro', { ascending: false });

        if (error) throw error;

        const lista = document.getElementById('lista-financeiro');
        if (!lista) return;

        lista.innerHTML = '';
        let saldoTotal = 0;
        let entradasMes = 0;
        let saidasMes = 0;
        const hoje = new Date();
        const mesAtual = hoje.getMonth();
        const anoAtual = hoje.getFullYear();

        if (!movimentacoes || movimentacoes.length === 0) {
            lista.innerHTML = '<p style="font-size:0.85rem; color:var(--text-muted); text-align:center; padding:20px;">Nenhuma movimentação registrada.</p>';
        } else {
            movimentacoes.forEach(mov => {
                const valor = parseFloat(mov.valor);
                const dataMov = new Date(mov.data_registro + 'T12:00:00');
                const isEntrada = (mov.tipo === 'Entrada' || mov.tipo === 'Mensalidade');
                
                if (isEntrada) {
                    saldoTotal += valor;
                    if (dataMov.getMonth() === mesAtual && dataMov.getFullYear() === anoAtual) entradasMes += valor;
                } else {
                    saldoTotal -= valor;
                    if (dataMov.getMonth() === mesAtual && dataMov.getFullYear() === anoAtual) saidasMes += valor;
                }

                const div = document.createElement('div');
                div.className = 'flex justify-between items-center';
                div.style.cssText = 'padding: 10px; border-bottom: 1px solid #f1f5f9;';
                
                const corValor = isEntrada ? '#16a34a' : '#dc2626';
                const sinal = isEntrada ? '+' : '-';

                div.innerHTML = `
                    <div style="flex:1;">
                        <div style="font-weight: 600; font-size: 0.85rem; color: var(--primary-blue);">${mov.descricao || mov.tipo}</div>
                        <div style="font-size: 0.7rem; color: var(--text-muted);">${formatarDataBr(mov.data_registro)}</div>
                    </div>
                    <div style="font-weight: 700; font-size: 0.9rem; color: ${corValor};">
                        ${sinal} R$ ${valor.toLocaleString('pt-BR', {minimumFractionDigits:2})}
                    </div>
                `;
                lista.appendChild(div);
            });
        }

        document.getElementById('tesouraria-saldo').innerText = `R$ ${saldoTotal.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
        document.getElementById('tesouraria-entradas').innerText = `R$ ${entradasMes.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
        document.getElementById('tesouraria-saidas').innerText = `R$ ${saidasMes.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;

        // Chama o controle de mensalidades após carregar o financeiro
        carregarControleMensalidades();

    } catch (err) { console.error("Erro ao carregar tesouraria:", err); }
}

// --- CONTROLE DE MENSALIDADES (NÚCLEO) ---

async function carregarControleMensalidades() {
    const lista = document.getElementById('controle-mensalidades-lista');
    const labelMes = document.getElementById('mensalidade-mes-ano');
    if (!lista) return;

    const hoje = new Date();
    const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    labelMes.innerText = `${meses[hoje.getMonth()]}/${hoje.getFullYear()}`;

    try {
        // 1. Pega todos os membros que NÃO são apenas participantes (o Núcleo)
        const { data: membros } = await supabaseClient
            .from('membros')
            .select('id, nome, cargo')
            .eq('grupo_id', window.meuGrupoId)
            .neq('cargo', 'Participante')
            .order('nome');

        // 2. Pega os pagamentos de mensalidade deste mês
        const dataInicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
        const dataFimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0];

        const { data: pagamentos } = await supabaseClient
            .from('financeiro')
            .select('membro_id')
            .eq('grupo_id', window.meuGrupoId)
            .eq('tipo', 'Mensalidade')
            .gte('data_registro', dataInicioMes)
            .lte('data_registro', dataFimMes);

        const idsPagos = (pagamentos || []).map(p => p.membro_id);

        const badge = document.getElementById('mensalidade-badge-pendente');
        const inadimplentes = membros.filter(m => !idsPagos.includes(m.id));
        if (badge) badge.innerText = inadimplentes.length > 0 ? `${inadimplentes.length} Pendentes` : 'Tudo em dia!';

        lista.innerHTML = '';
        
        const pagos = membros.filter(m => idsPagos.includes(m.id));

        // Renderiza Inadimplentes (Vermelho)
        if (inadimplentes.length > 0) {
            const header = document.createElement('div');
            header.innerHTML = `<span style="font-size:0.65rem; font-weight:800; color:#dc2626; text-transform:uppercase;">🔴 Em Aberto (${inadimplentes.length})</span>`;
            lista.appendChild(header);

            inadimplentes.forEach(m => {
                lista.appendChild(criarItemMensalidade(m, false));
            });
        }

        // Divisor
        if (inadimplentes.length > 0 && pagos.length > 0) {
            const hr = document.createElement('hr');
            hr.style.cssText = 'border:none; border-top:1px solid #f1f5f9; margin:5px 0;';
            lista.appendChild(hr);
        }

        // Renderiza Pagos (Verde)
        if (pagos.length > 0) {
            const header = document.createElement('div');
            header.innerHTML = `<span style="font-size:0.65rem; font-weight:800; color:#16a34a; text-transform:uppercase;">🟢 Confirmados (${pagos.length})</span>`;
            lista.appendChild(header);

            pagos.forEach(m => {
                lista.appendChild(criarItemMensalidade(m, true));
            });
        }

        if (membros.length === 0) {
            lista.innerHTML = '<p style="font-size:0.8rem; color:var(--text-muted); text-align:center;">Nenhum membro do núcleo cadastrado.</p>';
        }

    } catch (err) { console.error("Erro no controle de mensalidades:", err); }
}

function criarItemMensalidade(membro, pagou) {
    const div = document.createElement('div');
    div.className = 'flex justify-between items-center';
    div.style.cssText = `padding: 8px 12px; border-radius: 8px; background: ${pagou ? '#f0fdf4' : '#fef2f2'}; border: 1px solid ${pagou ? '#dcfce7' : '#fee2e2'};`;
    
    div.innerHTML = `
        <div style="flex:1;">
            <div style="font-size:0.85rem; font-weight:600; color:${pagou ? '#166534' : '#991b1b'};">${membro.nome}</div>
            <div style="font-size:0.65rem; opacity:0.7; color:${pagou ? '#166534' : '#991b1b'};">${membro.cargo}</div>
        </div>
        <div class="flex items-center gap-2">
            <span style="font-size:0.75rem; font-weight:700;">${pagou ? 'PAGO' : 'PENDENTE'}</span>
            <input type="checkbox" ${pagou ? 'checked' : ''} 
                style="width:18px; height:18px; cursor:pointer;" 
                onchange="alternarStatusPagamento('${membro.id}', '${membro.nome}', this.checked)">
        </div>
    `;
    return div;
}

window.alternarStatusPagamento = async function(membroId, nome, novoStatus) {
    if (!window.meuGrupoId) return;

    try {
        const hoje = new Date();
        const dataRegistro = hoje.toISOString().split('T')[0];
        const valorConfig = parseFloat(localStorage.getItem('go_valor_mensalidade') || '30');

        if (novoStatus) {
            // REGISTRAR PAGAMENTO
            const { error } = await supabaseClient.from('financeiro').insert([{
                grupo_id: window.meuGrupoId,
                tipo: 'Mensalidade',
                valor: valorConfig,
                descricao: `Mensalidade Servo: ${nome}`,
                data_registro: dataRegistro,
                membro_id: membroId
            }]);
            if (error) throw error;
        } else {
            // ESTORNAR PAGAMENTO (Deleta o registro deste mês para este membro)
            const dataInicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
            const dataFimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0];

            const { error } = await supabaseClient.from('financeiro')
                .delete()
                .eq('membro_id', membroId)
                .eq('tipo', 'Mensalidade')
                .gte('data_registro', dataInicioMes)
                .lte('data_registro', dataFimMes);
            
            if (error) throw error;
        }

        carregarFinanceiro(); // Recarrega tudo para atualizar saldos e lista
    } catch (err) {
        alert("Erro ao atualizar pagamento: " + err.message);
        carregarControleMensalidades(); // Volta o check se deu erro
    }
};

// --- MODAL FINANCEIRO COMUM ---

window.abrirModalFinanceiro = async function() {
    document.getElementById('modal-financeiro').style.display = 'flex';
    document.getElementById('financeiro-data').value = new Date().toISOString().split('T')[0];
};

window.fecharModalFinanceiro = () => { document.getElementById('modal-financeiro').style.display = 'none'; };

async function salvarFinanceiro(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;

    try {
        const payload = {
            grupo_id: window.meuGrupoId,
            tipo: document.getElementById('financeiro-tipo').value,
            valor: parseFloat(document.getElementById('financeiro-valor').value),
            descricao: document.getElementById('financeiro-desc').value,
            data_registro: document.getElementById('financeiro-data').value
        };

        const { error } = await supabaseClient.from('financeiro').insert([payload]);
        if (error) throw error;

        alert("Lançamento realizado!");
        fecharModalFinanceiro();
        carregarFinanceiro();
    } catch (err) { alert("Erro ao salvar."); }
    finally { btn.disabled = false; }
}

function formatarDataBr(dataString) {
    if (!dataString) return '';
    const partes = dataString.split('-');
    return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : dataString;
}
