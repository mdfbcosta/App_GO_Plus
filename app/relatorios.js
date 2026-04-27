// ==========================================
// MÓDULO: RELATÓRIOS
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    const navItems = document.querySelectorAll('.sidebar-item, .nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.innerText.includes('Relatórios')) {
                carregarRelatorios();
            }
        });
    });
});

async function carregarRelatorios() {
    if (!window.meuGrupoId) return;

    try {
        // 1. Total de Membros
        const { count: totalMembros, error: errMembros } = await supabaseClient
            .from('membros')
            .select('*', { count: 'exact', head: true })
            .eq('grupo_id', window.meuGrupoId);
        
        if (errMembros) throw errMembros;
        document.getElementById('relatorio-membros').innerText = totalMembros || 0;

        // 2. Caixa
        const { data: movs, error: errFinanceiro } = await supabaseClient
            .from('financeiro')
            .select('tipo, valor')
            .eq('grupo_id', window.meuGrupoId);
        
        if (errFinanceiro) throw errFinanceiro;
        
        let saldo = 0;
        movs.forEach(m => {
            const val = parseFloat(m.valor);
            if (m.tipo === 'Entrada' || m.tipo === 'Mensalidade') saldo += val;
            else saldo -= val;
        });
        document.getElementById('relatorio-caixa').innerText = `R$ ${saldo.toFixed(2).replace('.', ',')}`;

        // 3. Frequência Média (Últimas 4 Reuniões)
        const { data: reunioes, error: errReunioes } = await supabaseClient
            .from('reunioes')
            .select('id, data_reuniao, tipo')
            .eq('grupo_id', window.meuGrupoId)
            .order('data_reuniao', { ascending: false })
            .limit(4);

        if (errReunioes) throw errReunioes;

        const containerGrafico = document.getElementById('grafico-frequencia');
        containerGrafico.innerHTML = '';

        if (!reunioes || reunioes.length === 0 || totalMembros === 0) {
            document.getElementById('relatorio-presenca').innerText = '0%';
            containerGrafico.innerHTML = '<p style="font-size: 0.8rem; color: var(--text-muted); width: 100%; text-align: center;">Nenhuma reunião registrada.</p>';
            return;
        }

        let somaPercentuais = 0;
        let qtdeValida = 0;

        // Inverter para mostrar da mais antiga pra mais nova no gráfico
        reunioes.reverse();

        for (const reu of reunioes) {
            const { count: presencas, error: errP } = await supabaseClient
                .from('presencas')
                .select('*', { count: 'exact', head: true })
                .eq('reuniao_id', reu.id);

            if (!errP) {
                const percentual = Math.round((presencas / totalMembros) * 100) || 0;
                somaPercentuais += percentual;
                qtdeValida++;

                // Desenhar barra do gráfico
                const col = document.createElement('div');
                col.style.flex = '1';
                col.style.display = 'flex';
                col.style.flexDirection = 'column';
                col.style.alignItems = 'center';
                col.style.gap = '5px';

                const barHeight = percentual > 0 ? percentual : 1; // min 1% para aparecer uma linha
                
                const dataFormatada = reu.data_reuniao.split('-').reverse().slice(0, 2).join('/');

                col.innerHTML = `
                    <div style="font-size: 0.7rem; font-weight: 600; color: var(--primary-blue);">${percentual}%</div>
                    <div style="width: 100%; max-width: 40px; height: ${barHeight}px; background-color: var(--primary-blue); border-radius: 4px 4px 0 0; transition: height 0.5s;"></div>
                    <div style="font-size: 0.65rem; color: var(--text-muted); text-align: center;">${dataFormatada}<br>${reu.tipo}</div>
                `;
                containerGrafico.appendChild(col);
            }
        }

        const mediaGeral = qtdeValida > 0 ? Math.round(somaPercentuais / qtdeValida) : 0;
        document.getElementById('relatorio-presenca').innerText = `${mediaGeral}%`;

        // 4. Métrica de Intenção vs Realidade (Última Reunião)
        const ultimaReuniao = reunioes[reunioes.length - 1]; // Após o reverse(), a última fica no final
        if (ultimaReuniao) {
            // Conta as intenções para esta data
            const { count: qtdIntencoes } = await supabaseClient
                .from('intencoes_presenca')
                .select('*', { count: 'exact', head: true })
                .eq('grupo_id', window.meuGrupoId)
                .eq('data_reuniao', ultimaReuniao.data_reuniao);
            
            // Conta as presenças reais
            const { count: qtdPresencasReais } = await supabaseClient
                .from('presencas')
                .select('*', { count: 'exact', head: true })
                .eq('reuniao_id', ultimaReuniao.id);

            const i = qtdIntencoes || 0;
            const r = qtdPresencasReais || 0;
            let abs = i - r;
            if (abs < 0) abs = 0; // Se foram mais que prometeram, abstenção = 0
            
            const elInt = document.getElementById('relatorio-intencoes');
            const elReal = document.getElementById('relatorio-presencas-reais');
            const elAbs = document.getElementById('relatorio-abstencao');

            if (elInt) elInt.innerText = i;
            if (elReal) elReal.innerText = r;
            if (elAbs) elAbs.innerText = abs;
        }

        // 5. Aniversariantes da Semana
        const { data: membrosNasc } = await supabaseClient
            .from('membros')
            .select('nome, data_nascimento, telefone, foto_url')
            .eq('grupo_id', window.meuGrupoId)
            .not('data_nascimento', 'is', null);
            
        const listaNasc = document.getElementById('lista-aniversariantes');
        if (listaNasc && membrosNasc) {
            listaNasc.innerHTML = '';
            
            const hoje = new Date();
            const atualAno = hoje.getFullYear();
            
            // Inicio da semana (Domingo) e fim (Sábado)
            const semanaComeco = new Date(hoje);
            semanaComeco.setDate(hoje.getDate() - hoje.getDay());
            semanaComeco.setHours(0,0,0,0);
            
            const semanaFim = new Date(semanaComeco);
            semanaFim.setDate(semanaComeco.getDate() + 6);
            semanaFim.setHours(23,59,59,999);
            
            let temAniversariante = false;
            
            membrosNasc.forEach(m => {
                const dataNParts = m.data_nascimento.split('-');
                if (dataNParts.length === 3) {
                    const dataN = new Date(atualAno, parseInt(dataNParts[1]) - 1, parseInt(dataNParts[2]));
                    
                    if (dataN >= semanaComeco && dataN <= semanaFim) {
                        temAniversariante = true;
                        
                        const f = m.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.nome)}&background=2563eb&color=fff`;
                        const div = document.createElement('div');
                        div.className = "flex items-center justify-between";
                        div.style.background = "var(--bg-light)";
                        div.style.padding = "10px";
                        div.style.borderRadius = "var(--radius-sm)";
                        
                        let linkWpp = "";
                        if (m.telefone) {
                            const tel = m.telefone.replace(/\\D/g, ''); // só números
                            const msg = encodeURIComponent(`Paz e bem, ${m.nome}! Feliz aniversário! Que o Espírito Santo renove suas forças hoje e sempre. Um abraço do nosso Grupo de Oração!`);
                            linkWpp = `<a href="https://wa.me/55${tel}?text=${msg}" target="_blank" class="btn btn-primary" style="padding: 4px 10px; font-size: 0.75rem; background: #25D366; border-color: #25D366; text-decoration:none;">💬 Whats</a>`;
                        } else {
                            linkWpp = `<span style="font-size:0.7rem; color:var(--text-muted);">Sem contato</span>`;
                        }
                        
                        div.innerHTML = `
                            <div class="flex items-center gap-2">
                                <img src="${f}" style="width:30px; height:30px; border-radius:50%; object-fit:cover;">
                                <div>
                                    <div style="font-size:0.85rem; font-weight:600;">${m.nome}</div>
                                    <div style="font-size:0.7rem; color:var(--text-muted);">${dataN.getDate().toString().padStart(2,'0')}/${(dataN.getMonth()+1).toString().padStart(2,'0')}</div>
                                </div>
                            </div>
                            <div>${linkWpp}</div>
                        `;
                        listaNasc.appendChild(div);
                    }
                }
            });
            
            if (!temAniversariante) {
                listaNasc.innerHTML = '<p style="font-size:0.8rem; color:var(--text-muted); text-align:center;">Nenhum aniversariante nesta semana.</p>';
            }
        }

    } catch (err) {
        console.error("Erro ao carregar relatórios:", err);
    }
}
