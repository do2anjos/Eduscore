/**
 * Migration: Adicionar campo dia_enem à tabela gabaritos
 * Permite identificar gabaritos do ENEM por dia (1 ou 2)
 * 
 * Executar: node backend/migrations/add_dia_enem.js
 */

const Database = require('better-sqlite3');
const path = require('path');

// Configurar caminho do banco
const dbPath = process.env.DB_PATH || path.join(__dirname, '../../database.sqlite');

console.log(`[MIGRATION] Conectando ao banco: ${dbPath}`);

try {
    // Abrir conexão com banco
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');

    // Verificar se a coluna já existe
    const tableInfo = db.prepare("PRAGMA table_info(gabaritos)").all();
    const colunaExiste = tableInfo.some(col => col.name === 'dia_enem');

    if (colunaExiste) {
        console.log('[MIGRATION] ✓ Coluna dia_enem já existe na tabela gabaritos');
        db.close();
        process.exit(0);
    }

    console.log('[MIGRATION] Adicionando coluna dia_enem...');

    // Adicionar coluna dia_enem
    db.prepare(`
    ALTER TABLE gabaritos 
    ADD COLUMN dia_enem INTEGER NULL
  `).run();

    console.log('[MIGRATION] ✓ Coluna dia_enem adicionada com sucesso!');
    console.log('[MIGRATION] Valores possíveis:');
    console.log('  - NULL: Não é prova ENEM (gabarito padrão)');
    console.log('  - 1: ENEM Dia 1 (questões 1-90)');
    console.log('  - 2: ENEM Dia 2 (questões 91-180)');

    // Fechar conexão
    db.close();

    console.log('[MIGRATION] ✓ Migration concluída com sucesso!');
    process.exit(0);

} catch (error) {
    console.error('[MIGRATION] ✗ Erro na migration:', error.message);
    console.error(error.stack);
    process.exit(1);
}
