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

    // Fechar popovers ao clicar fora
    window.addEventListener('click', (e) => {
        if (!e.target.closest('.contato-popover') && !e.target.closest('.btn-contato')) {
            document.querySelectorAll('.contato-popover').forEach(p => p.style.display = 'none');
        }
    });
});

window.toggleContato = function(id, event) {
    if (event) event.stopPropagation();
    const el = document.getElementById(`contato-info-${id}`);
    const isVisible = el.style.display === 'block';
    
    // Fecha todos
    document.querySelectorAll('.contato-popover').forEach(p => p.style.display = 'none');
    
    // Se não estava visível, abre este
    if (!isVisible) {
        el.style.display = 'block';
    }
}

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
            card.style.marginBottom = '0';
            card.style.position = 'relative';
            
            const foto = m.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.nome)}&background=1E3A8A&color=fff`;

            // Lógica de Núcleo e Abreviação
            let cargoExibicao = m.cargo || 'Participante';
            
            // Abbreviate Ministério -> M.
            cargoExibicao = cargoExibicao.replace(/Ministério/g, 'M.');

            // Identificar se é núcleo
            const funcoesNucleo = ["Coordenador", "Secretário", "Tesoureiro"];
            const roles = (m.cargo || "").split(', ');
            const ehNucleo = roles.some(r => funcoesNucleo.includes(r) || r.startsWith('Ministério'));

            if (ehNucleo) {
                cargoExibicao = `<b>Núcleo</b>, ${cargoExibicao}`;
                card.style.background = '#fffbeb'; // Amarelo bem clarinho
                card.style.borderLeft = '4px solid #facc15'; // Borda amarela/ouro
            }

            // Formatação do Telefone e Links de Contato
            const telBruto = m.telefone ? m.telefone.replace(/\D/g, '') : '';
            const linkZap = telBruto ? `https://api.whatsapp.com/send?phone=55${telBruto}` : '#';
            const linkTel = telBruto ? `tel:+55${telBruto}` : '#';
            const telExibicao = m.telefone || 'Sem número';

            const ehServo = m.cargo && m.cargo !== 'Participante';

            card.innerHTML = `
                <div class="flex items-center gap-3">
                    <img src="${foto}" style="width:40px; height:40px; border-radius:50%; object-fit:cover; border: 2px solid ${ehNucleo ? '#facc15' : '#f1f5f9'};">
                    <div>
                        <div style="font-weight: 700; color: var(--primary-blue); font-size: 0.95rem;">${m.nome}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">${cargoExibicao}</div>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <div id="contato-info-${m.id}" class="contato-popover" style="display:none; position:absolute; right:60px; background:white; border:1px solid #eee; padding:10px; border-radius:12px; box-shadow:0 8px 20px rgba(0,0,0,0.12); z-index:100; text-align:center; min-width: 120px;">
                        <div style="font-size: 0.8rem; font-weight: 800; color: var(--primary-blue); margin-bottom: 8px;">${telExibicao}</div>
                        <div class="flex gap-4 justify-center">
                            ${telBruto ? `
                                <a href="${linkZap}" target="_blank" style="text-decoration:none;">
                                    <img src="assets/icons/icon-whatsapp.png" style="width:28px; height:28px; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
                                </a>
                                <a href="${linkTel}" style="text-decoration:none;">
                                    <div style="width:28px; height:28px; background:#f1f5f9; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:1rem;">📞</div>
                                </a>
                            ` : '<span style="font-size:0.6rem; color:#999;">Sem número</span>'}
                        </div>
                    </div>
                    <button onclick="toggleContato('${m.id}', event)" class="btn-contato"
                            style="background:#f8fafc; border:1px solid #e2e8f0; cursor:pointer; width:40px; height:40px; border-radius:12px; display:flex; align-items:center; justify-content:center; transition: all 0.2s;" 
                            onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='#f8fafc'">
                        <img src="assets/icons/icon-chat.png" style="width:24px; height:24px; opacity: 0.8;">
                    </button>
                    <button onclick="removerMembro('${m.id}', '${m.nome}')" style="background:none; border:none; color:var(--primary-red); cursor:pointer; font-size:1.1rem; padding: 5px; opacity: 0.6;" title="Remover">🗑️</button>
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
