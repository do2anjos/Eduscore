/**
 * Script para executar migrações no Turso via linha de comando
 * Execute: node executar_migracao_turso.js <TURSO_URL> <TURSO_TOKEN>
 */

const tursoUrl = process.argv[2];
const tursoToken = process.argv[3];

if (!tursoUrl || !tursoToken) {
  console.error('❌ ERRO: URL e Token do Turso são obrigatórios!');
  console.error('   Uso: node executar_migracao_turso.js <TURSO_URL> <TURSO_TOKEN>');
  process.exit(1);
}

// Configurar variáveis de ambiente temporariamente
process.env.TURSO_DATABASE_URL = tursoUrl;
process.env.TURSO_AUTH_TOKEN = tursoToken;

// Executar migrações
const { createSchema } = require('../backend/migrations/create_schema');
const { addImagensCartoesTable } = require('../backend/migrations/add_imagens_cartoes');

async function executarMigracoes() {
  try {
    console.log('🔧 Executando migrações no Turso...\n');
    
    // Criar tabela imagens_cartoes se não existir
    await addImagensCartoesTable();
    
    console.log('✅ Migrações concluídas!\n');
    
  } catch (err) {
    console.error('❌ Erro ao executar migrações:', err.message);
    process.exit(1);
  }
}

executarMigracoes().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Erro:', err);
  process.exit(1);
});

