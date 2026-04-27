async function listarTabelas() {
    console.log("--- DIAGNÓSTICO DE TABELAS ---");
    // Tentativa de ler o schema via RPC ou erro proposital para ver as tabelas
    const { data, error } = await supabaseClient.from('reunioes').select('id').limit(1);
    if (error) console.log("Erro ao ler reunioes:", error.message);
    else console.log("Tabela 'reunioes' existe.");

    const { error: errAtas } = await supabaseClient.from('atas').select('id').limit(1);
    if (errAtas) console.log("Tabela 'atas' NÃO existe (404).");

    const { data: tabelas, error: errSchema } = await supabaseClient.rpc('get_tables'); // Se existir esse RPC
    if (errSchema) console.log("Não foi possível listar via RPC.");
}
listarTabelas();
