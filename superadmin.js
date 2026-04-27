// ==========================================
// CONFIGURAÇÃO DO SUPABASE (SUPERADMIN)
// ==========================================

const supabaseUrl = 'https://sbannyzbymosnalrbjmw.supabase.co';
const supabaseKey = 'sb_publishable_J1dhejVFvLa9xe1R0PQXmA_Ly9KHsiZ';

let supabaseClient = null;

if (typeof window.supabase !== 'undefined') {
    supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
}

const modulos = ['pessoas', 'ata', 'configuracoes', 'metricas', 'pedidos', 'eventos', 'partilhas', 'resumo', 'escala', 'tesouraria'];

const opcoesGenericas = [
    { value: 'nenhum', text: 'Nenhum' },
    { value: 'visualizar', text: 'Visualizar' },
    { value: 'executar', text: 'Executar' }
];

const opcoesPedidos = [
    { value: 'nenhum', text: 'Nenhum' },
    { value: 'proprios', text: 'Só os Próprios' },
    { value: 'todos', text: 'Todos' }
];

const opcoesEventos = [
    { value: 'nenhum', text: 'Nenhum' },
    { value: 'ver_publicos', text: 'Só Públicos' },
    { value: 'ver', text: 'Ver Todos' },
    { value: 'executar', text: 'Executar' }
];

document.addEventListener('DOMContentLoaded', async () => {
    // Checar Sessão
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        mostrarDashboard();
    }

    // Login Form
    const formLogin = document.getElementById('admin-login-form');
    if (formLogin) {
        formLogin.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-admin-login');
            btn.innerText = "Acessando...";
            
            const email = document.getElementById('admin-email').value;
            const senha = document.getElementById('admin-senha').value;

            // No futuro: Restringir isso apenas a emails específicos (RLS admin level)
            const { error } = await supabaseClient.auth.signInWithPassword({ email, password: senha });
            if (error) {
                alert("Falha no acesso. Verifique as credenciais.");
                btn.innerText = "Acessar Matriz";
            } else {
                mostrarDashboard();
            }
        });
    }
});

async function mostrarDashboard() {
    document.getElementById('admin-login-view').style.display = 'none';
    document.getElementById('admin-dashboard-view').style.display = 'block';
    await carregarMatriz();
}

async function fazerLogout() {
    await supabaseClient.auth.signOut();
    window.location.reload();
}

function atualizarCorSelect(selectElem) {
    selectElem.classList.remove('executar', 'visualizar', 'nenhum');
    if (selectElem.value === 'executar' || selectElem.value === 'todos') {
        selectElem.classList.add('executar');
    } else if (selectElem.value === 'visualizar' || selectElem.value === 'ver' || selectElem.value === 'ver_publicos' || selectElem.value === 'proprios') {
        selectElem.classList.add('visualizar');
    } else {
        selectElem.classList.add('nenhum');
    }
}

async function carregarMatriz() {
    try {
        const { data: regras, error } = await supabaseClient.from('cargos_permissoes').select('*').order('cargo', { ascending: true });
        if (error) throw error;

        const tbody = document.getElementById('matriz-body');
        tbody.innerHTML = '';

        regras.forEach(regra => {
            const tr = document.createElement('tr');
            
            // Coluna 1: Nome do Cargo
            const tdCargo = document.createElement('td');
            tdCargo.innerHTML = `<strong>${regra.cargo}</strong>`;
            tr.appendChild(tdCargo);

            // Colunas dos Módulos
            modulos.forEach(mod => {
                const td = document.createElement('td');
                const select = document.createElement('select');
                select.className = 'perm-select';
                // Salva metadados no elemento para na hora de salvar sabermos quem ele é
                select.setAttribute('data-cargo', regra.cargo);
                select.setAttribute('data-modulo', mod);

                // Define as opções baseadas no módulo
                let list = opcoesGenericas;
                if (mod === 'pedidos') list = opcoesPedidos;
                if (mod === 'eventos') list = opcoesEventos;

                list.forEach(opt => {
                    const option = document.createElement('option');
                    option.value = opt.value;
                    option.text = opt.text;
                    if (regra.permissoes[mod] === opt.value) {
                        option.selected = true;
                    }
                    select.appendChild(option);
                });

                atualizarCorSelect(select);
                select.addEventListener('change', (e) => atualizarCorSelect(e.target));

                td.appendChild(select);
                tr.appendChild(td);
            });

            tbody.appendChild(tr);
        });

    } catch (err) {
        console.error("Erro ao carregar matriz", err);
        document.getElementById('matriz-body').innerHTML = '<tr><td colspan="11">Erro ao carregar dados do banco.</td></tr>';
    }
}

window.salvarTodasPermissoes = async function() {
    const btn = document.querySelector('button[onclick="salvarTodasPermissoes()"]');
    btn.innerText = "Salvando...";
    btn.disabled = true;

    try {
        // Agrupar todos os selects por Cargo
        const selects = document.querySelectorAll('.perm-select');
        const novaMatriz = {};

        selects.forEach(select => {
            const cargo = select.getAttribute('data-cargo');
            const modulo = select.getAttribute('data-modulo');
            const valor = select.value;

            if (!novaMatriz[cargo]) novaMatriz[cargo] = {};
            novaMatriz[cargo][modulo] = valor;
        });

        // Fazer os updates no banco
        const promises = Object.keys(novaMatriz).map(cargo => {
            return supabaseClient.from('cargos_permissoes')
                .update({ permissoes: novaMatriz[cargo], atualizado_em: new Date().toISOString() })
                .eq('cargo', cargo);
        });

        await Promise.all(promises);
        alert("✔️ Matriz de Permissões Global salva com sucesso! O aplicativo já usará estas regras a partir de agora.");
        
    } catch (err) {
        console.error("Erro ao salvar matriz", err);
        alert("Erro ao salvar as configurações.");
    } finally {
        btn.innerText = "💾 Salvar Regras";
        btn.disabled = false;
    }
}
