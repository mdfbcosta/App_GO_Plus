// ==========================================
// MÓDULO: CONFIGURAÇÕES E MINISTÉRIOS
// ==========================================

const ministeriosRCC = [
    "Secretário",
    "Tesoureiro",
    "Profissionais do Reino",
    "Ministério de Comunicação",
    "Ministério de Formação",
    "Ministério de Intercessão",
    "Ministério de Música e Artes",
    "Ministério de Oração por Cura e Libertação",
    "Ministério de Pregação",
    "Ministério de Promoção Humana",
    "Ministério Fé e Política",
    "Ministério Jovem",
    "Ministério para as Famílias",
    "Ministério para Crianças e Adolescentes",
    "Ministério para Ministros Ordenados",
    "Ministério para Religiosas e Consagradas Celibatárias",
    "Ministério para Seminaristas",
    "Ministério Universidades Renovadas",
    "Membro do Núcleo"
];

document.addEventListener('DOMContentLoaded', () => {
    const navItems = document.querySelectorAll('.sidebar-item, .nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.innerText.includes('Configurações')) {
                carregarConfiguracoes();
            }
        });
    });
});

async function carregarConfiguracoes() {
    if (!window.meuGrupoId) return;

    try {
        // 1. Carregar link de convite do GO
        let path = window.location.pathname;
        let appIndex = path.lastIndexOf('/app');
        if (appIndex !== -1) {
            path = path.substring(0, appIndex);
        } else {
            path = "";
        }
        const linkConvite = `${window.location.origin}${path}/?go_id=${window.meuGrupoId}`;
        const inputLink = document.getElementById('config-link-convite');
        if (inputLink) inputLink.value = linkConvite;

        // 2. Carregar dados do GO
        const { data: grupo } = await supabaseClient.from('grupos').select('*').eq('id', window.meuGrupoId).maybeSingle();
        if (grupo) {
            document.getElementById('config-nome-go').value = grupo.nome || '';
            document.getElementById('config-dia-oracao').value = grupo.dia_reuniao_oracao || 'Domingo';
            document.getElementById('config-hora-oracao').value = grupo.hora_reuniao_oracao || '';
            document.getElementById('config-dia-nucleo').value = grupo.dia_reuniao_nucleo || 'Segunda-feira';
            document.getElementById('config-hora-nucleo').value = grupo.hora_reuniao_nucleo || '';
            
            // Tentar ler link e dados excepcionais de local_link_maps (JSON)
            let linkMaps = grupo.local_link_maps || '';
            let dataEx = grupo.data_excepcional || '';
            let horaEx = grupo.hora_excepcional || '';

            if (linkMaps.startsWith('{')) {
                try {
                    const extra = JSON.parse(linkMaps);
                    linkMaps = extra.link || '';
                    dataEx = extra.data_ex || '';
                    horaEx = extra.hora_ex || '';
                } catch(e) {}
            }

            document.getElementById('config-link-maps').value = linkMaps;
            document.getElementById('config-data-excepcional').value = dataEx;
            document.getElementById('config-hora-excepcional').value = horaEx;
        }

        // 3. Carregar membros do GO para popular os selects
        const { data: membros } = await supabaseClient.from('membros').select('id, nome, cargo').eq('grupo_id', window.meuGrupoId).order('nome', { ascending: true });
        window.membrosCache = membros; // Salva para consulta ao salvar
        
        // Popular Datalist Global
        const datalist = document.getElementById('membros-datalist');
        datalist.innerHTML = '';
        membros.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.nome;
            datalist.appendChild(opt);
        });

        // =====================================
        // MONTAR SEÇÃO: MINISTÉRIOS
        // =====================================
        const minContainer = document.getElementById('lista-ministerios-container');
        minContainer.innerHTML = '';

        const cargosExcluidos = ["Secretário", "Tesoureiro", "Membro do Núcleo"];
        const listaMinisterios = ministeriosRCC.filter(m => !cargosExcluidos.includes(m));

        listaMinisterios.forEach(ministerio => {
            const ocupante = membros.find(m => m.cargo && m.cargo.split(', ').includes(ministerio));
            const val = ocupante ? ocupante.nome : '';

            const div = document.createElement('div');
            div.className = 'flex justify-between items-center';
            div.style.padding = '10px';
            div.style.border = '1px solid var(--border-color)';
            div.style.borderRadius = 'var(--radius-sm)';
            div.style.backgroundColor = ocupante ? '#e0f2fe' : 'transparent';

            div.innerHTML = `
                <div style="font-size: 0.9rem; font-weight: 500;">${ministerio}</div>
                <div>
                    <input list="membros-datalist" class="input-field input-cargo-min" style="width: 200px; padding: 5px;" data-cargo="${ministerio}" placeholder="Buscar..." value="${val}">
                </div>
            `;
            minContainer.appendChild(div);
        });

        // =====================================
        // MONTAR SEÇÃO: NÚCLEO
        // =====================================
        const nucContainer = document.getElementById('lista-nucleo-container');
        nucContainer.innerHTML = '';

        // 1. Secretário e Tesoureiro
        const cargosFixosNuc = ["Secretário", "Tesoureiro"];
        cargosFixosNuc.forEach(cargo => {
            const ocupante = membros.find(m => m.cargo && m.cargo.split(', ').includes(cargo));
            const val = ocupante ? ocupante.nome : '';

            const div = document.createElement('div');
            div.className = 'flex justify-between items-center';
            div.style.padding = '10px';
            div.style.border = '1px solid var(--border-color)';
            div.style.borderRadius = 'var(--radius-sm)';
            div.style.backgroundColor = ocupante ? '#fef9c3' : 'transparent';

            div.innerHTML = `
                <div style="font-size: 0.9rem; font-weight: 500;">${cargo}</div>
                <div>
                    <input list="membros-datalist" class="input-field input-cargo-nuc" style="width: 200px; padding: 5px;" data-cargo="${cargo}" placeholder="Buscar..." value="${val}">
                </div>
            `;
            nucContainer.appendChild(div);
        });

        // 2. Lista automática de Coordenadores de Ministérios
        const coordsAtuais = membros.filter(m => {
            if (!m.cargo) return false;
            const userCargos = m.cargo.split(', ');
            return userCargos.some(c => listaMinisterios.includes(c));
        });
        if (coordsAtuais.length > 0) {
            const divInfo = document.createElement('div');
            divInfo.style.fontSize = '0.8rem';
            divInfo.style.color = 'var(--text-muted)';
            divInfo.style.marginTop = '10px';
            divInfo.innerHTML = `<strong>Coord. de Ministérios (Aut.):</strong> ${coordsAtuais.map(c => c.nome).join(', ')}`;
            nucContainer.appendChild(divInfo);
        }

        // 3. Membros Convidados
        const convidadosDiv = document.createElement('div');
        convidadosDiv.id = 'container-convidados';
        convidadosDiv.style.marginTop = '15px';
        nucContainer.appendChild(convidadosDiv);

        const btnAddConvidado = document.createElement('button');
        btnAddConvidado.className = 'btn btn-outline';
        btnAddConvidado.style.fontSize = '0.8rem';
        btnAddConvidado.style.marginTop = '10px';
        btnAddConvidado.innerText = '+ Adicionar Membro Convidado';
        btnAddConvidado.onclick = adicionarCampoConvidado;
        nucContainer.appendChild(btnAddConvidado);

        // Preencher convidados existentes
        const convidadosAtuais = membros.filter(m => m.cargo === "Membro do Núcleo");
        if (convidadosAtuais.length > 0) {
            convidadosAtuais.forEach(c => adicionarCampoConvidado(c.nome));
        } else {
            adicionarCampoConvidado(); // Um vazio por padrão
        }

    } catch (err) {
        console.error("Erro ao carregar configurações:", err);
    }
}

function adicionarCampoConvidado(nomeValor = '') {
    const container = document.getElementById('container-convidados');
    const div = document.createElement('div');
    div.className = 'flex justify-between items-center';
    div.style.padding = '8px';
    div.style.marginBottom = '5px';
    div.style.border = '1px dashed var(--border-color)';
    div.style.borderRadius = 'var(--radius-sm)';
    
    div.innerHTML = `
        <div style="font-size: 0.85rem; font-weight: 500;">Membro Convidado</div>
        <div>
            <input list="membros-datalist" class="input-field input-cargo-convidado" style="width: 200px; padding: 5px;" data-cargo="Membro do Núcleo" placeholder="Buscar..." value="${nomeValor}">
        </div>
    `;
    container.appendChild(div);
}

window.salvarConfiguracoes = async function() {
    if (!window.meuGrupoId || !window.membrosCache) return;

    try {
        const nome = document.getElementById('config-nome-go').value;
        const diaO = document.getElementById('config-dia-oracao').value;
        const horaO = document.getElementById('config-hora-oracao').value;
        const diaN = document.getElementById('config-dia-nucleo').value;
        const horaN = document.getElementById('config-hora-nucleo').value;
        const linkMaps = document.getElementById('config-link-maps').value;
        const dataEx = document.getElementById('config-data-excepcional').value;
        const horaEx = document.getElementById('config-hora-excepcional').value;

        // Empacota link e dados excepcionais para evitar erro de coluna ausente
        const localMeta = JSON.stringify({
            link: linkMaps,
            data_ex: dataEx,
            hora_ex: horaEx
        });

        const { error: errGrupo } = await supabaseClient.from('grupos')
            .update({ 
                nome: nome, 
                dia_reuniao_oracao: diaO, 
                hora_reuniao_oracao: horaO,
                dia_reuniao_nucleo: diaN,
                hora_reuniao_nucleo: horaN,
                local_link_maps: localMeta
            })
            .eq('id', window.meuGrupoId);
        
        if (errGrupo) throw errGrupo;

        // Resetar cargos (exceto Coordenador)
        await supabaseClient.from('membros')
            .update({ cargo: 'Participante' })
            .eq('grupo_id', window.meuGrupoId)
            .neq('cargo', 'Coordenador');

        // Reunir todos os inputs preenchidos e agrupar por membro
        const inputs = [
            ...document.querySelectorAll('.input-cargo-min'),
            ...document.querySelectorAll('.input-cargo-nuc'),
            ...document.querySelectorAll('.input-cargo-convidado')
        ];

        const cargosPorMembro = {}; // { membroId: [cargo1, cargo2] }

        for (const input of inputs) {
            const cargo = input.getAttribute('data-cargo');
            const nomeDigitado = input.value.trim();

            if (nomeDigitado) {
                const membro = window.membrosCache.find(m => m.nome.toLowerCase() === nomeDigitado.toLowerCase());
                if (membro && membro.cargo !== 'Coordenador') {
                    if (!cargosPorMembro[membro.id]) cargosPorMembro[membro.id] = [];
                    if (!cargosPorMembro[membro.id].includes(cargo)) {
                        cargosPorMembro[membro.id].push(cargo);
                    }
                }
            }
        }

        // Executar atualizações em paralelo para ser mais rápido
        const promises = Object.entries(cargosPorMembro).map(([id, cargos]) => {
            return supabaseClient.from('membros')
                .update({ cargo: cargos.join(', ') })
                .eq('id', id);
        });

        await Promise.all(promises);

        alert("Configurações salvas com sucesso!");
        carregarConfiguracoes(); // Recarrega para atualizar a interface
    } catch (err) {
        console.error("Erro ao salvar configurações:", err);
        alert("Ocorreu um erro ao salvar as configurações.");
    }
}

window.trocarCoordenacao = async function() {
    const nomeNovo = document.getElementById('novo-coordenador-input').value.trim();
    const senhaStr = document.getElementById('senha-troca-coord').value;

    if (!nomeNovo || !senhaStr) {
        alert("Preencha o novo coordenador e sua senha.");
        return;
    }

    if (!window.membrosCache) return;
    const novoMembro = window.membrosCache.find(m => m.nome.toLowerCase() === nomeNovo.toLowerCase());
    
    if (!novoMembro) {
        alert("Membro não encontrado no grupo.");
        return;
    }

    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) throw new Error("Não autenticado");

        // Validação da senha
        const { error: errAuth } = await supabaseClient.auth.signInWithPassword({
            email: user.email,
            password: senhaStr
        });

        if (errAuth) {
            alert("Senha incorreta. A troca não foi autorizada.");
            return;
        }

        // Se a senha está certa, podemos prosseguir com a troca
        
        // 1. Rebaixar atual para Participante
        await supabaseClient.from('membros')
            .update({ cargo: 'Participante' })
            .eq('id', window.meuMembroId);
            
        // 2. Elevar o novo para Coordenador
        await supabaseClient.from('membros')
            .update({ cargo: 'Coordenador' })
            .eq('id', novoMembro.id);

        alert("Transição concluída com sucesso! Você será deslogado da conta administrativa.");
        await supabaseClient.auth.signOut();
        window.location.href = '../index.html';

    } catch (err) {
        console.error("Erro na transição:", err);
        alert("Erro na troca de coordenação.");
    }
}

window.copiarLinkConvite = function() {
    const copyText = document.getElementById("config-link-convite");
    if (!copyText) return;
    copyText.select();
    copyText.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(copyText.value);
    alert("Link de convite copiado! Envie para o seu grupo.");
}
