/**
 * Migration: Adicionar tabela imagens_cartoes
 * Esta tabela associa imagens de cartões a alunos e gabaritos
 * Execute: node backend/migrations/add_imagens_cartoes.js
 */

const db = require('../db').db;

async function addImagensCartoesTable() {
  console.log('🔧 Adicionando tabela imagens_cartoes...\n');

  try {
    // Habilitar foreign keys
    await db.pragma('foreign_keys = ON');

    // Criar tabela imagens_cartoes
    await db.exec(`
      CREATE TABLE IF NOT EXISTS imagens_cartoes (
        id TEXT PRIMARY KEY,
        aluno_id TEXT NOT NULL,
        gabarito_id TEXT NOT NULL,
        caminho_imagem TEXT NOT NULL,
        nome_imagem TEXT NOT NULL,
        criado_em TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (aluno_id) REFERENCES alunos(id) ON DELETE CASCADE,
        FOREIGN KEY (gabarito_id) REFERENCES gabaritos(id) ON DELETE CASCADE,
        UNIQUE(aluno_id, gabarito_id, criado_em)
      )
    `);
    console.log('   ✅ Tabela imagens_cartoes criada\n');

    // Criar índice para melhor performance
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_imagens_cartoes_aluno_gabarito 
      ON imagens_cartoes(aluno_id, gabarito_id);
    `);
    console.log('   ✅ Índice criado\n');

    console.log('✅ Migration concluída com sucesso!\n');

  } catch (err) {
    console.error('❌ Erro ao executar migration:', err.message);
    console.error('Stack:', err.stack);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  addImagensCartoesTable().then(() => {
    process.exit(0);
  }).catch(err => {
    console.error('Erro:', err);
    process.exit(1);
  });
}

module.exports = { addImagensCartoesTable };
