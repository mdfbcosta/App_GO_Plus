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

async function carregarPedidos() {
    if (!window.meuGrupoId) return;

    try {
        let query = supabaseClient
            .from('pedidos_oracao')
            .select(`
                *,
                membros (nome)
            `)
            .eq('grupo_id', window.meuGrupoId)
            .order('criado_em', { ascending: false });

        if (window.minhasPermissoes && window.minhasPermissoes.pedidos === 'proprios') {
            query = query.eq('membro_id', window.meuMembroId);
        }

        const { data: pedidos, error } = await query;

        if (error) throw error;

        const lista = document.getElementById('lista-pedidos');
        if (!lista) return;

        lista.innerHTML = '';

        if (pedidos.length === 0) {
            lista.innerHTML = '<p style="font-size:0.85rem; color:var(--text-muted); text-align:center;">Nenhum pedido de oração.</p>';
            return;
        }

        pedidos.forEach(p => {
            const dataP = new Date(p.criado_em);
            const dataStr = `${dataP.getDate().toString().padStart(2, '0')}/${(dataP.getMonth() + 1).toString().padStart(2, '0')}/${dataP.getFullYear()}`;
            
            const div = document.createElement('div');
            div.style.padding = '15px';
            div.style.background = 'white';
            div.style.borderRadius = 'var(--radius-md)';
            div.style.border = '1px solid var(--border-color)';
            
            div.innerHTML = `
                <div class="flex gap-2 items-center" style="margin-bottom: 10px;">
                    <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(p.membros?.nome || 'Usuário')}&background=facc15&color=fff" style="width:28px; border-radius:50%;">
                    <div>
                        <div style="font-size: 0.8rem; font-weight: 600;">${p.membros?.nome || 'Usuário'}</div>
                        <div style="font-size: 0.7rem; color: var(--text-muted);">${dataStr}</div>
                    </div>
                </div>
                <p style="font-size: 0.85rem; line-height: 1.4;">${p.texto}</p>
            `;
            lista.appendChild(div);
        });

    } catch (err) {
        console.error("Erro ao carregar pedidos:", err);
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

