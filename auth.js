// ==========================================
// CONFIGURAÇÃO DO SUPABASE E AUTH (Fase 5)
// ==========================================

const supabaseUrl = 'https://sbannyzbymosnalrbjmw.supabase.co';
const supabaseKey = 'sb_publishable_J1dhejVFvLa9xe1R0PQXmA_Ly9KHsiZ';

let supabaseClient = null;

if (typeof window.supabase !== 'undefined') {
    supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
    console.log("Supabase GO+ Inicializado.");
} else {
    console.error("Erro: Supabase SDK não foi carregado na página.");
}

let grupoConviteId = null;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Checar redirecionamento automático
    const { data: sessionData } = await supabaseClient.auth.getSession();
    if (sessionData && sessionData.session) {
        // Redireciona apenas se não estiver já dentro da pasta app
        if (!window.location.pathname.includes('/app/')) {
            window.location.href = 'app/index.html';
        }
        return;
    }

    // 2. Checar link de convite na URL
    const urlParams = new URLSearchParams(window.location.search);
    const goId = urlParams.get('go_id');
    const indicadoPorId = urlParams.get('indicado_por'); // Pode ser nulo

    
    if (goId) {
        grupoConviteId = goId;
        try {
            const { data: grupo, error } = await supabaseClient
                .from('grupos')
                .select('nome')
                .eq('id', goId)
                .single();
                
            if (grupo) {
                const titulo = document.getElementById('go-title');
                if (titulo) {
                    titulo.innerText = `Você foi convidado(a) para o GO ${grupo.nome}`;
                    titulo.style.color = "var(--primary-red)";
                }
            }
        } catch (e) {
            console.error("Erro ao buscar GO do link", e);
        }
    } else {
        const aviso = document.getElementById('aviso-link-invalido');
        if (aviso) aviso.style.display = 'block';
    }

    // 3. Listener do Formulário de Login (Entrar)
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-login');
            btn.innerText = "Entrando...";
            btn.disabled = true;

            const email = document.getElementById('login-email').value;
            const senha = document.getElementById('login-senha').value;

            try {
                const { error } = await supabaseClient.auth.signInWithPassword({ email, password: senha });
                if (error) throw error;
                window.location.href = 'app/index.html';
            } catch (err) {
                console.error("Erro no login:", err);
                alert("Falha no login. Verifique seu e-mail e senha.");
                btn.innerText = "Entrar";
                btn.disabled = false;
            }
        });
    }

    // 4. Listener do Cadastro de Participante
    const cadastroForm = document.getElementById('cadastro-form');
    if (cadastroForm) {
        cadastroForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!grupoConviteId) {
                alert("Você precisa do link de convite do seu coordenador para criar uma conta!");
                return;
            }

            const btn = document.getElementById('btn-cadastro');
            btn.innerText = "Cadastrando...";
            btn.disabled = true;

            const nome = document.getElementById('cad-nome').value;
            const email = document.getElementById('cad-email').value;
            const senha = document.getElementById('cad-senha').value;

            try {
                // Criar auth user
                const { data: authData, error: authError } = await supabaseClient.auth.signUp({
                    email: email,
                    password: senha,
                    options: { data: { full_name: nome } }
                });
                
                if (authError) throw authError;

                // O usuário foi criado. Precisamos aguardar 1 segundo para garantir a sessão e então inserir o membro.
                if (authData.user) {
                    const { error: dbError } = await supabaseClient.from('membros').insert([{
                        auth_id: authData.user.id,
                        grupo_id: grupoConviteId,
                        nome: nome,
                        email: email,
                        cargo: 'Participante',
                        status: 'Ativo',
                        indicado_por: indicadoPorId || null
                    }]);
                    
                    if (dbError) throw dbError;
                    
                    alert("Conta criada com sucesso! Bem-vindo(a) ao GO.");
                    window.location.href = 'app/index.html';
                }
            } catch (err) {
                console.error("Erro no cadastro:", err);
                alert("Erro ao criar conta: " + err.message);
                btn.innerText = "Cadastrar-se";
                btn.disabled = false;
            }
        });
    }

    // 5. Listener para Criar um Novo GO
    const formCriarGO = document.getElementById('form-criar-go');
    if (formCriarGO) {
        formCriarGO.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-criar-go');
            btn.innerText = "Configurando seu GO...";
            btn.disabled = true;

            const nomeGO = document.getElementById('novo-go-nome').value;
            const estado = document.getElementById('novo-go-estado').value;
            const cidade = document.getElementById('novo-go-cidade').value;
            const nomeCoord = document.getElementById('novo-coord-nome').value;
            const email = document.getElementById('novo-coord-email').value;
            const senha = document.getElementById('novo-coord-senha').value;

            try {
                // 1. Criar Auth
                const { data: authData, error: authError } = await supabaseClient.auth.signUp({
                    email: email,
                    password: senha,
                    options: { data: { full_name: nomeCoord } }
                });
                if (authError) throw authError;

                if (authData.user) {
                    // 2. Criar Grupo
                    const { data: novoGrupo, error: grupoError } = await supabaseClient.from('grupos').insert([{
                        nome: nomeGO,
                        estado: estado,
                        diocese: cidade // Usando a coluna diocese pra cidade neste MVP
                    }]).select().single();
                    
                    if (grupoError) throw grupoError;

                    // 3. Cadastrar Membro como Coordenador
                    const { error: dbError } = await supabaseClient.from('membros').insert([{
                        auth_id: authData.user.id,
                        grupo_id: novoGrupo.id,
                        nome: nomeCoord,
                        email: email,
                        cargo: 'Coordenador',
                        status: 'Ativo'
                    }]);
                    
                    if (dbError) throw dbError;

                    alert("Seu Grupo de Oração foi criado com sucesso!");
                    window.location.href = 'app/index.html';
                }
            } catch (err) {
                console.error("Erro ao criar GO:", err);
                alert("Falha ao criar Grupo: " + err.message);
                btn.innerText = "Concluir e Criar GO";
                btn.disabled = false;
            }
        });
    }
});
