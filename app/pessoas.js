document.addEventListener('DOMContentLoaded', () => {
    // Escutar eventos da aba de Pessoas
    const navItems = document.querySelectorAll('.sidebar-item, .nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.innerText.includes('Pessoas')) {
                carregarPessoas();
            }
        });
    });

    const formPessoa = document.getElementById('form-pessoa');
    if (formPessoa) {
        formPessoa.addEventListener('submit', salvarPessoa);
    }
});

async function carregarPessoas() {
    if (!window.meuGrupoId) return;

    try {
        const { data: membros, error } = await supabaseClient
            .from('membros')
            .select('*')
            .eq('grupo_id', window.meuGrupoId)
            .order('nome', { ascending: true });

        if (error) throw error;

        const lista = document.getElementById('lista-pessoas');
        if (!lista) return;

        lista.innerHTML = '';

        if (membros.length === 0) {
            lista.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--text-muted);">Nenhum membro cadastrado.</td></tr>';
            return;
        }

        membros.forEach(m => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--border-color)';
            
            const foto = m.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.nome)}&background=1E3A8A&color=fff`;

            tr.innerHTML = `
                <td style="padding: 12px 10px;">
                    <div class="flex items-center gap-2">
                        <img src="${foto}" style="width:30px; height:30px; border-radius:50%; object-fit:cover;">
                        <span style="font-weight: 500;">${m.nome}</span>
                    </div>
                </td>
                <td style="padding: 12px 10px; color: var(--text-muted); font-size: 0.85rem;">${m.cargo}</td>
                <td style="padding: 12px 10px;">
                    <span style="background: #dcfce7; color: #166534; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 500;">
                        ${m.status}
                    </span>
                </td>
                <td style="padding: 12px 10px; text-align:right;">
                    <button onclick="removerMembro('${m.id}', '${m.nome}')" style="background:none; border:none; color:var(--primary-red); cursor:pointer; font-size:1.1rem;" title="Remover">🗑️</button>
                </td>
            `;
            lista.appendChild(tr);
        });

    } catch (err) {
        console.error("Erro ao carregar pessoas:", err);
        alert("Não foi possível carregar os membros.");
    }
}

window.abrirModalPessoa = function() {
    document.getElementById('modal-pessoa').style.display = 'flex';
}

window.fecharModalPessoa = function() {
    document.getElementById('modal-pessoa').style.display = 'none';
}

async function salvarPessoa(e) {
    e.preventDefault();
    if (!window.meuGrupoId) return;

    const nome = document.getElementById('pessoa-nome').value;
    const email = document.getElementById('pessoa-email').value;
    const telefone = document.getElementById('pessoa-telefone').value;
    const cargo = document.getElementById('pessoa-cargo').value;

    try {
        const { error } = await supabaseClient
            .from('membros')
            .insert([{
                grupo_id: window.meuGrupoId,
                nome: nome,
                email: email || null,
                telefone: telefone || null,
                cargo: cargo,
                status: 'Ativo'
            }]);

        if (error) throw error;

        alert("Membro cadastrado com sucesso!");
        fecharModalPessoa();
        document.getElementById('form-pessoa').reset();
        carregarPessoas();

    } catch (err) {
        console.error("Erro ao salvar pessoa:", err);
        alert("Erro ao cadastrar membro.");
    }
}

window.removerMembro = async function(id, nome) {
    if (!confirm(`Deseja realmente remover ${nome} do grupo?`)) return;

    try {
        const { error } = await supabaseClient
            .from('membros')
            .delete()
            .eq('id', id);

        if (error) throw error;

        alert("Membro removido.");
        carregarPessoas();
    } catch (err) {
        console.error("Erro ao remover membro:", err);
        alert("Não foi possível remover o membro.");
    }
}
