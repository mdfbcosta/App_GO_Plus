// Script para popular dados de teste para a Palavra do Dia
// Execute este código no console do navegador estando logado no App GO Plus

async function popularTestesPalavra() {
    if (!window.meuGrupoId || !window.meuMembroId) {
        console.error("❌ Erro: Você precisa estar logado para rodar os testes.");
        return;
    }

    const hoje = new Date().toISOString().split('T')[0];
    const amanha = new Date(); amanha.setDate(amanha.getDate() + 1);
    const dataAmanha = amanha.toISOString().split('T')[0];
    const depois = new Date(); depois.setDate(depois.getDate() + 2);
    const dataDepois = depois.toISOString().split('T')[0];

    const exemplos = [
        {
            grupo_id: window.meuGrupoId,
            membro_id: window.meuMembroId,
            data_publicacao: hoje,
            tipo: 'texto',
            conteudo: {
                texto: "O Senhor é o meu pastor, nada me faltará.",
                referencia: "Salmo 23,1"
            },
            status: 'publicado'
        },
        {
            grupo_id: window.meuGrupoId,
            membro_id: window.meuMembroId,
            data_publicacao: dataAmanha,
            tipo: 'video',
            conteudo: {
                url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                legenda: "Uma mensagem especial em vídeo para o seu dia!"
            },
            status: 'publicado'
        },
        {
            grupo_id: window.meuGrupoId,
            membro_id: window.meuMembroId,
            data_publicacao: dataDepois,
            tipo: 'desafio',
            conteudo: {
                desafio_titulo: "Jejum de Reclamação",
                descricao: "Hoje, o desafio é passar o dia inteiro sem reclamar de nada. Transforme cada reclamação em um agradecimento!"
            },
            status: 'publicado'
        }
    ];

    console.log("⏳ Inserindo exemplos de teste...");

    for (const ex of exemplos) {
        const { error } = await supabaseClient
            .from('palavra_dia')
            .insert([ex]);
        
        if (error) {
            console.error(`❌ Erro ao inserir tipo ${ex.tipo}:`, error.message);
        } else {
            console.log(`✅ Tipo ${ex.tipo} inserido com sucesso para ${ex.data_publicacao}`);
        }
    }

    console.log("✨ Testes finalizados! Recarregue a página para ver o resultado na Home.");
}

popularTestesPalavra();
