document.addEventListener('DOMContentLoaded', () => {
    // Escutar eventos da aba de Pessoas
    const navItems = document.querySelectorAll('.sidebar-item, .nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.innerText.includes('Membros')) {
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

        const containerServos = document.getElementById('lista-servos');
        const containerOvelhas = document.getElementById('lista-ovelhas');
        if (!containerServos || !containerOvelhas) return;

        containerServos.innerHTML = '';
        containerOvelhas.innerHTML = '';

        if (membros.length === 0) {
            containerOvelhas.innerHTML = '<div class="card text-center"><p style="color:var(--text-muted);">Nenhum membro cadastrado.</p></div>';
            return;
        }

        membros.forEach(m => {
            const card = document.createElement('div');
            card.className = 'card flex justify-between items-center';
            card.style.padding = '12px 15px';
            card.style.marginBottom = '0'; // Usando gap do flex-col
            
            const foto = m.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.nome)}&background=1E3A8A&color=fff`;

            // Define se é servo ou ovelha
            // É servo se tiver qualquer cargo que NÃO seja 'Participante'
            const ehServo = m.cargo && m.cargo !== 'Participante';

            card.innerHTML = `
                <div class="flex items-center gap-3">
                    <img src="${foto}" style="width:40px; height:40px; border-radius:50%; object-fit:cover; border: 2px solid #f1f5f9;">
                    <div>
                        <div style="font-weight: 700; color: var(--primary-blue); font-size: 0.95rem;">${m.nome}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">${m.cargo || 'Participante'}</div>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <span style="background: ${m.status === 'Ativo' ? '#dcfce7' : '#fee2e2'}; color: ${m.status === 'Ativo' ? '#166534' : '#991b1b'}; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: 700;">
                        ${m.status}
                    </span>
                    <button onclick="removerMembro('${m.id}', '${m.nome}')" style="background:none; border:none; color:var(--primary-red); cursor:pointer; font-size:1.1rem; padding: 5px;" title="Remover">🗑️</button>
                </div>
            `;

            if (ehServo) {
                containerServos.appendChild(card);
            } else {
                containerOvelhas.appendChild(card);
            }
        });

        // Verificação se um dos blocos está vazio
        if (containerServos.innerHTML === '') {
            containerServos.innerHTML = '<p style="font-size:0.8rem; color:var(--text-muted); text-align:center; padding:10px;">Nenhum servo listado.</p>';
        }
        if (containerOvelhas.innerHTML === '') {
            containerOvelhas.innerHTML = '<p style="font-size:0.8rem; color:var(--text-muted); text-align:center; padding:10px;">Nenhuma ovelha listada.</p>';
        }

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
