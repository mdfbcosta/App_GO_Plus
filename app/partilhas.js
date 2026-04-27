// ==========================================
// MÓDULO: PARTILHAS
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    const navItems = document.querySelectorAll('.sidebar-item, .nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.innerText.includes('Partilhas')) {
                carregarPartilhas();
            }
        });
    });

    const formPartilha = document.getElementById('form-partilha');
    if (formPartilha) {
        formPartilha.addEventListener('submit', salvarPartilha);
    }
});

async function carregarPartilhas() {
    if (!window.meuGrupoId) return;

    try {
        const { data: partilhas, error } = await supabaseClient
            .from('partilhas')
            .select(`
                *,
                membros (nome)
            `)
            .eq('grupo_id', window.meuGrupoId)
            .order('criado_em', { ascending: false });

        if (error) throw error;

        const lista = document.getElementById('lista-partilhas');
        if (!lista) return;

        lista.innerHTML = '';

        if (partilhas.length === 0) {
            lista.innerHTML = '<p style="font-size:0.85rem; color:var(--text-muted); text-align:center;">Nenhuma partilha ainda. Seja o primeiro!</p>';
            return;
        }

        partilhas.forEach(p => {
            const dataP = new Date(p.criado_em);
            const dataStr = `${dataP.getDate().toString().padStart(2, '0')}/${(dataP.getMonth() + 1).toString().padStart(2, '0')}/${dataP.getFullYear()}`;
            
            const div = document.createElement('div');
            div.style.padding = '15px';
            div.style.background = 'white';
            div.style.borderRadius = 'var(--radius-md)';
            div.style.border = '1px solid var(--border-color)';
            
            div.innerHTML = `
                <div class="flex gap-2" style="margin-bottom: 10px;">
                    <div style="width: 36px; height: 36px; border-radius: 50%; background: #ccc; overflow: hidden;">
                        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(p.membros?.nome || 'Usuário')}&background=facc15&color=fff" style="width:100%;">
                    </div>
                    <div>
                        <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-main);">${p.membros?.nome || 'Usuário'}</div>
                        <div style="font-size: 0.7rem; color: var(--text-muted);">${dataStr}</div>
                    </div>
                </div>
                <p style="font-size: 0.85rem; line-height: 1.4; margin-bottom: 10px;">${p.texto}</p>
                <div class="flex gap-4" style="font-size: 0.75rem; color: var(--text-muted);">
                    <div class="flex items-center gap-2 cursor-pointer" onclick="curtirPartilha('${p.id}', ${p.likes})">
                        <span style="color:var(--primary-red);">❤️</span> ${p.likes}
                    </div>
                </div>
            `;
            lista.appendChild(div);
        });

    } catch (err) {
        console.error("Erro ao carregar partilhas:", err);
    }
}

function abrirModalPartilha() {
    document.getElementById('modal-partilha').style.display = 'flex';
}

function fecharModalPartilha() {
    document.getElementById('modal-partilha').style.display = 'none';
}

async function salvarPartilha(e) {
    e.preventDefault();
    if (!window.meuGrupoId) return;

    const texto = document.getElementById('partilha-texto').value;

    try {
        // Obter meu membro_id
        const { data: membro } = await supabaseClient
            .from('membros')
            .select('id')
            .eq('auth_id', (await supabaseClient.auth.getUser()).data.user.id)
            .single();

        if (!membro) throw new Error("Membro não encontrado");

        const { error } = await supabaseClient
            .from('partilhas')
            .insert([{
                grupo_id: window.meuGrupoId,
                membro_id: membro.id,
                texto: texto
            }]);

        if (error) throw error;

        fecharModalPartilha();
        document.getElementById('form-partilha').reset();
        carregarPartilhas();
        
    } catch (err) {
        console.error("Erro ao publicar partilha:", err);
        alert("Erro ao publicar partilha.");
    }
}

async function curtirPartilha(partilhaId, likesAtuais) {
    try {
        const { error } = await supabaseClient
            .from('partilhas')
            .update({ likes: likesAtuais + 1 })
            .eq('id', partilhaId);
            
        if (!error) {
            carregarPartilhas(); // recarrega a lista
        }
    } catch(err) {
        console.error(err);
    }
}
