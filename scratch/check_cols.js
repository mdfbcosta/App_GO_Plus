
async function checkColumns() {
    const { data, error } = await supabaseClient.from('eventos').select('*').limit(1);
    if (error) {
        console.log("Error:", error);
    } else {
        console.log("Sample Data Keys:", Object.keys(data[0] || {}));
    }
}
checkColumns();
