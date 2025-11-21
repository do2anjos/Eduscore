const db = require('../backend/db');

async function verificar() {
  try {
    // Listar tabelas
    const tabelas = await db.query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    console.log('Tabelas encontradas:');
    tabelas.rows.forEach(t => console.log(`  - ${t.name}`));
    
    // Verificar estrutura das tabelas relevantes
    console.log('\n=== ESTRUTURA DA TABELA SESSOES ===');
    const sessoesInfo = await db.query('PRAGMA table_info(sessoes)');
    console.log(JSON.stringify(sessoesInfo.rows, null, 2));
    
    console.log('\n=== ESTRUTURA DA TABELA RESPOSTAS ===');
    const respostasInfo = await db.query('PRAGMA table_info(respostas)');
    console.log(JSON.stringify(respostasInfo.rows, null, 2));
    
    console.log('\n=== ESTRUTURA DA TABELA RELATORIOS ===');
    const relatoriosInfo = await db.query('PRAGMA table_info(relatorios)');
    console.log(JSON.stringify(relatoriosInfo.rows, null, 2));
    
    process.exit(0);
  } catch (error) {
    console.error('Erro:', error);
    process.exit(1);
  }
}

verificar();

