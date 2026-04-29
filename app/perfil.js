let arquivoFotoPerfil = null;

document.addEventListener('DOMContentLoaded', () => {
    const navItems = document.querySelectorAll('.sidebar-item, .nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const label = item.innerText || "";
            if (label.includes('Perfil')) {
                carregarPerfil();
            }
        });
    });

    const formPerfil = document.getElementById('form-editar-perfil');
    if (formPerfil) {
        formPerfil.addEventListener('submit', salvarPerfil);
    }
});

async function carregarPerfil() {
    console.log("Carregando perfil...");
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return;

        const { data: membro, error } = await supabaseClient
            .from('membros')
            .select('*')
            .eq('auth_id', user.id)
            .single();

        if (error) throw error;

        // Preenche campos
        document.getElementById('perfil-nome').value = membro.nome || '';
        document.getElementById('perfil-email').value = membro.email || '';
        if (membro.data_nascimento) {
            document.getElementById('perfil-data-nasc').value = membro.data_nascimento;
        }
        document.getElementById('perfil-whatsapp-input').value = membro.telefone || '';
        document.getElementById('perfil-whatsapp').innerText = membro.telefone || '-';

        // Foto
        const fotoPreview = document.getElementById('perfil-foto-preview');
        if (membro.foto_url) {
            if (fotoPreview) fotoPreview.src = membro.foto_url;
            // Atualizar sidebar também se necessário
            const sidebarFoto = document.getElementById('sidebar-usuario-foto');
            if (sidebarFoto) sidebarFoto.src = membro.foto_url;
        } else {
            const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(membro.nome)}&background=2563eb&color=fff`;
            if (fotoPreview) fotoPreview.src = avatarUrl;
        }

        // Link de indicação (Individual)
        const origin = window.location.origin;
        const path = window.location.pathname;
        // Tenta descobrir a pasta raiz (antes de /app)
        let root = "";
        if (path.includes('/app/')) {
            root = path.split('/app/')[0];
        } else if (path.endsWith('/app')) {
            root = path.replace('/app', '');
        }
        
        const baseUrl = origin + root;
        const linkInd = `${baseUrl}/index.html?go_id=${membro.grupo_id}&indicado_por=${membro.id}`;
        
        const elLink = document.getElementById('perfil-link-indicacao');
        if (elLink) elLink.innerText = linkInd;

    } catch (err) {
        console.error("Erro ao carregar perfil:", err);
    }
}

function previewFotoPerfil(event) {
    const file = event.target.files[0];
    if (file) {
        arquivoFotoPerfil = file;
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('perfil-foto-preview').src = e.target.result;
        }
        reader.readAsDataURL(file);
    }
}

async function salvarPerfil(e) {
    e.preventDefault();
    console.log("Iniciando salvamento de perfil...");
    const btn = document.getElementById('btn-salvar-perfil');
    btn.innerText = "Salvando...";
    btn.disabled = true;

    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        
        const nome = document.getElementById('perfil-nome').value;
        const dataNasc = document.getElementById('perfil-data-nasc').value;
        const telefone = document.getElementById('perfil-whatsapp-input').value;
        const novaSenha = document.getElementById('perfil-nova-senha').value;

        // 1. Atualizar Senha no Auth (se preenchida)
        if (novaSenha && novaSenha.trim() !== '') {
            const { error: errAuth } = await supabaseClient.auth.updateUser({ password: novaSenha });
            if (errAuth) throw new Error("Erro ao trocar senha. Talvez exija reautenticação.");
        }

        // 2. Upload de Foto (se houver novo arquivo)
        let fotoUrlUpdate = null;
        if (arquivoFotoPerfil) {
            const fileExt = arquivoFotoPerfil.name.split('.').pop();
            const fileName = `${user.id}-${Math.random()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabaseClient.storage
                .from('avatars')
                .upload(filePath, arquivoFotoPerfil, { upsert: true });

            if (uploadError) {
                console.error("Erro de upload. Bucket configurado?", uploadError);
                // Continua salvando o resto mesmo se falhar a foto
            } else {
                const { data } = supabaseClient.storage.from('avatars').getPublicUrl(filePath);
                fotoUrlUpdate = data.publicUrl;
            }
        }

        // 3. Atualizar tabela Membros
        const updateData = { nome: nome, data_nascimento: dataNasc || null, telefone: telefone || null };
        if (fotoUrlUpdate) updateData.foto_url = fotoUrlUpdate;

        const { error: errMembro } = await supabaseClient
            .from('membros')
            .update(updateData)
            .eq('auth_id', user.id);

        if (errMembro) throw errMembro;

        alert("Perfil atualizado com sucesso!");
        
        // Recarregar dados para garantir consistência
        carregarPerfil();
        
        // Atualizar sidebar se o nome mudou
        const sidebarNome = document.getElementById('sidebar-usuario-nome');
        if (sidebarNome) sidebarNome.innerText = nome;

        document.getElementById('perfil-nova-senha').value = '';
        arquivoFotoPerfil = null;

        if (fotoUrlUpdate) {
            const sidebarFoto = document.getElementById('sidebar-usuario-foto');
            if (sidebarFoto) sidebarFoto.src = fotoUrlUpdate;
        }

    } catch (err) {
        console.error("Erro ao salvar perfil:", err);
        alert(err.message || "Erro ao salvar perfil.");
    } finally {
        btn.innerText = "💾 Salvar Alterações";
        btn.disabled = false;
    }
}

// Expor para o escopo global
window.carregarPerfil = carregarPerfil;
window.previewFotoPerfil = previewFotoPerfil;
window.salvarPerfil = salvarPerfil;
window.copiarLinkIndicacao = copiarLinkIndicacao;

function copiarLinkIndicacao() {
    const text = document.getElementById('perfil-link-indicacao').innerText;
    navigator.clipboard.writeText(text).then(() => {
        if (window.showToast) window.showToast("Link de indicação copiado!");
        else alert("Link de indicação copiado!");
    });
}
