const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data/database.sqlite');
console.log('📂 Abrindo banco de dados em:', dbPath);

try {
    const db = new Database(dbPath);
    console.log('✅ Conexão com banco de dados estabelecida.');

    // Verificar tabela usuarios
    try {
        const stmt = db.prepare('SELECT * FROM usuarios');
        const rows = stmt.all();

        console.log('📊 Status da tabela usuarios:');
        console.log('   - Tipo de retorno:', typeof rows);
        console.log('   - É array?', Array.isArray(rows));
        console.log('   - Quantidade de registros:', rows.length);

        if (rows.length > 0) {
            console.log('   - Exemplo de registro:', JSON.stringify(rows[0], null, 2));
        } else {
            console.log('   - Tabela vazia.');
        }
    } catch (err) {
        if (err.message.includes('no such table')) {
            console.log('❌ Tabela usuarios não existe! Execute as migrações.');
        } else {
            console.error('❌ Erro ao consultar tabela usuarios:', err);
        }
    }

} catch (err) {
    console.error('❌ Erro fatal ao abrir o banco de dados:', err);
}
