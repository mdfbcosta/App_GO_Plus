// ==========================================
// MÓDULO: PEDIDOS DE ORAÇÃO
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    const navItems = document.querySelectorAll('.sidebar-item, .nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.innerText.includes('Pedidos de Oração')) {
                carregarPedidos();
            }
        });
    });

    const formPedido = document.getElementById('form-pedido');
    if (formPedido) {
        formPedido.addEventListener('submit', salvarPedido);
    }
});

window.filtroPedidos = 'pendentes'; // Padrão para intercessores

window.setFiltroPedidos = function(filtro) {
    window.filtroPedidos = filtro;
    
    // Atualiza visual das pills
    const pills = document.querySelectorAll('#filtros-pedidos .pill');
    pills.forEach(p => {
        p.classList.remove('active');
        if (p.innerText.toLowerCase().includes(filtro)) p.classList.add('active');
    });
    
    carregarPedidos();
}

async function carregarPedidos() {
    if (!window.meuGrupoId) return;

    try {
        let query = supabaseClient
            .from('pedidos_oracao')
            .select(`
                *,
                membros!membro_id (nome, telefone)
            `)
            .eq('grupo_id', window.meuGrupoId)
            .order('criado_em', { ascending: false });

        if (window.minhasPermissoes && window.minhasPermissoes.pedidos === 'proprios') {
            query = query.eq('membro_id', window.meuMembroId);
        }

        const { data: pedidos, error } = await query;

        const lista = document.getElementById('lista-pedidos');
        if (!lista) return;

        if (error) {
            console.error("Erro Supabase:", error);
            lista.innerHTML = `<p style="color:red; text-align:center; font-size:0.8rem;">Erro ao carregar dados: ${error.message}</p>`;
            return;
        }

        // --- FILTRAGEM EM MEMÓRIA ---
        let pedidosFiltrados = pedidos;
        if (window.filtroPedidos === 'pendentes') {
            pedidosFiltrados = pedidos.filter(p => !p.resposta);
        } else if (window.filtroPedidos === 'respondidos') {
            pedidosFiltrados = pedidos.filter(p => p.resposta);
        }

        lista.innerHTML = '';

        if (pedidosFiltrados.length === 0) {
            const msg = window.filtroPedidos === 'pendentes' ? 'Nenhum pedido pendente de resposta. Bom trabalho!' : 'Nenhum pedido encontrado para este filtro.';
            lista.innerHTML = `<p style="font-size:0.85rem; color:var(--text-muted); text-align:center; margin-top: 20px;">${msg}</p>`;
            return;
        }

        pedidosFiltrados.forEach(p => {
            const dataP = new Date(p.criado_em);
            const dataStr = `${dataP.getDate().toString().padStart(2, '0')}/${(dataP.getMonth() + 1).toString().padStart(2, '0')}/${dataP.getFullYear()}`;
            
            // Dados de contato
            const telBruto = p.membros?.telefone ? String(p.membros.telefone).replace(/\D/g, '') : '';
            const linkZap = telBruto ? `https://api.whatsapp.com/send?phone=55${telBruto}` : '#';
            const linkTel = telBruto ? `tel:+55${telBruto}` : '#';
            const telExibicao = p.membros?.telefone || 'Sem número';

            const div = document.createElement('div');
            div.className = 'card';
            div.style.padding = '15px';
            div.style.position = 'relative';
            div.style.marginBottom = '5px';
            div.style.animation = 'fadeIn 0.3s ease';
            
            const cargoAtual = window.meuCargo || '';
            const ehIntercessao = cargoAtual.includes('Intercessão') || cargoAtual.includes('Coordenador') || cargoAtual.includes('Núcleo');

            div.innerHTML = `
                <div class="flex justify-between items-start" style="margin-bottom: 12px;">
                    <div class="flex gap-2 items-center">
                        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(p.membros?.nome || 'Usuário')}&background=facc15&color=fff" style="width:32px; height:32px; border-radius:50%;">
                        <div>
                            <div style="font-size: 0.85rem; font-weight: 700; color: var(--primary-blue);">${p.membros?.nome || 'Usuário'}</div>
                            <div style="font-size: 0.7rem; color: var(--text-muted);">${dataStr}</div>
                        </div>
                    </div>
                    
                    ${ehIntercessao ? `
                    <div class="flex items-center gap-2">
                        <div id="contato-info-${p.id}" class="contato-popover" style="display:none; position:absolute; right:50px; top:10px; background:white; border:1px solid #eee; padding:10px; border-radius:12px; box-shadow:0 8px 20px rgba(0,0,0,0.12); z-index:100; text-align:center; min-width: 120px;">
                            <div style="font-size: 0.8rem; font-weight: 800; color: var(--primary-blue); margin-bottom: 8px;">${telExibicao}</div>
                            <div class="flex gap-4 justify-center">
                                ${telBruto ? `
                                    <a href="${linkZap}" target="_blank" style="text-decoration:none;">
                                        <img src="assets/icons/icon-whatsapp.png" style="width:28px; height:28px;">
                                    </a>
                                    <a href="${linkTel}" style="text-decoration:none;">
                                        <div style="width:28px; height:28px; background:#f1f5f9; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:1rem;">📞</div>
                                    </a>
                                ` : '<span style="font-size:0.6rem; color:#999;">Sem número</span>'}
                            </div>
                        </div>
                        <button onclick="toggleContato('${p.id}', event)" class="btn-contato" style="background:#f8fafc; border:1px solid #e2e8f0; cursor:pointer; width:32px; height:32px; border-radius:8px; display:flex; align-items:center; justify-content:center;">
                            <img src="assets/icons/icon-chat.png" style="width:18px; height:18px; opacity:0.8;">
                        </button>
                    </div>
                    ` : ''}
                </div>
                
                <p style="font-size: 0.9rem; line-height: 1.5; color: #374151; margin-bottom: 15px; padding-left: 5px; border-left: 2px solid #f3f4f6;">${p.texto}</p>

                ${p.resposta ? `
                    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 12px; border-radius: 10px; margin-top: 10px;">
                        <div style="font-size: 0.65rem; color: #166534; font-weight: 800; text-transform: uppercase; margin-bottom: 4px; display: flex; align-items: center; gap: 5px;">
                            <span>🕊️ Resposta da Intercessão:</span>
                        </div>
                        <p style="font-size: 0.85rem; color: #166534; margin: 0; line-height: 1.5; font-style: italic;">"${p.resposta}"</p>
                    </div>
                    ${p.reacao ? `
                        <div style="margin-top: 8px; display: flex; align-items: center; gap: 5px; padding-left: 5px;">
                            <span style="font-size: 0.7rem; color: #64748b; font-weight: 500;">✓ ${p.membros?.nome.split(' ')[0]} marcou como lido</span>
                            <span style="font-size: 1.1rem;">${p.reacao}</span>
                        </div>
                    ` : ''}
                ` : (ehIntercessao ? `
                    <div style="margin-top: 15px; border-top: 1px solid #f1f5f9; padding-top: 12px;">
                        <textarea id="resp-${p.id}" class="input-field" placeholder="Escreva uma palavra de fé..." rows="2" style="font-size: 0.8rem; margin-bottom: 8px; border-color: #e2e8f0;"></textarea>
                        <button class="btn btn-primary" onclick="enviarRespostaPedido('${p.id}')" style="font-size: 0.75rem; padding: 8px 16px; width: auto; background: var(--primary-blue);">Enviar Resposta Fraternal</button>
                    </div>
                ` : '')}
            `;
            lista.appendChild(div);
        });

        // Fechar popovers ao clicar fora
        if (!window.hasPedidoClickEvent) {
            window.addEventListener('click', (e) => {
                if (!e.target.closest('.contato-popover') && !e.target.closest('.btn-contato')) {
                    document.querySelectorAll('.contato-popover').forEach(p => p.style.display = 'none');
                }
            });
            window.hasPedidoClickEvent = true;
        }

    } catch (err) {
        console.error("Erro fatal ao carregar pedidos:", err);
        const lista = document.getElementById('lista-pedidos');
        if (lista) lista.innerHTML = `<p style="color:red; text-align:center; font-size:0.8rem;">Erro interno no sistema.</p>`;
    }
}

window.enviarRespostaPedido = async function(id) {
    const texto = document.getElementById(`resp-${id}`).value;
    if (!texto) return alert("Por favor, escreva uma resposta.");

    try {
        const { error } = await supabaseClient
            .from('pedidos_oracao')
            .update({ 
                resposta: texto,
                respondedor_id: window.meuMembroId 
            })
            .eq('id', id);

        if (error) throw error;
        carregarPedidos();
    } catch (err) {
        console.error("Erro ao responder pedido:", err);
        alert("Erro ao enviar resposta.");
    }
}

function abrirModalPedido() {
    document.getElementById('modal-pedido').style.display = 'flex';
}

function fecharModalPedido() {
    document.getElementById('modal-pedido').style.display = 'none';
}

async function salvarPedido(e) {
    e.preventDefault();
    if (!window.meuGrupoId) return;

    const texto = document.getElementById('pedido-texto').value;

    try {
        const { error } = await supabaseClient
            .from('pedidos_oracao')
            .insert([{
                grupo_id: window.meuGrupoId,
                membro_id: window.meuMembroId,
                texto: texto
            }]);

        if (error) throw error;

        fecharModalPedido();
        document.getElementById('form-pedido').reset();
        
        // Atualiza apenas a lista que está sendo visualizada
        const viewMeusPedidos = document.getElementById('view-meus-pedidos');
        if (viewMeusPedidos && viewMeusPedidos.style.display !== 'none') {
            if (typeof carregarMeusPedidos === 'function') carregarMeusPedidos();
        } else {
            if (typeof carregarPedidos === 'function') carregarPedidos();
        }
        
        alert('Seu pedido foi enviado confidencialmente para o núcleo.');
        
    } catch (err) {
        console.error("Erro ao publicar pedido:", err);
        alert("Erro ao publicar pedido.");
    }
}

