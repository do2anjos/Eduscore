/**
 * Script de criação do schema do banco de dados SQLite/Turso
 * Execute: node backend/migrations/create_schema.js
 */

const db = require('../db').db; // Acesso direto ao banco para DDL

async function createSchema() {
  console.log('🔧 Criando schema do banco de dados...\n');

  try {
    // Habilitar foreign keys
    await db.pragma('foreign_keys = ON');

    // 1. Tabela de usuários (professores, coordenadores, admins)
    console.log('1. Criando tabela usuarios...');
    await db.exec(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        matricula TEXT NOT NULL UNIQUE,
        telefone TEXT,
        senha_hash TEXT NOT NULL,
        foto_perfil TEXT,
        perfil TEXT NOT NULL CHECK(perfil IN ('professor', 'coordenador', 'admin')),
        tipo_usuario TEXT NOT NULL CHECK(tipo_usuario IN ('professor', 'coordenador', 'admin', 'usuario')),
        configuracoes TEXT,
        criado_em TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    console.log('   ✅ Tabela usuarios criada\n');

    // 2. Tabela de alunos
    console.log('2. Criando tabela alunos...');
    await db.exec(`
      CREATE TABLE IF NOT EXISTS alunos (
        id TEXT PRIMARY KEY,
        nome_completo TEXT NOT NULL,
        email TEXT NOT NULL,
        telefone_responsavel TEXT,
        data_nascimento TEXT,
        etapa TEXT,
        matricula TEXT NOT NULL UNIQUE
      )
    `);
    console.log('   ✅ Tabela alunos criada\n');

    // 3. Tabela de disciplinas
    console.log('3. Criando tabela disciplinas...');
    await db.exec(`
      CREATE TABLE IF NOT EXISTS disciplinas (
        id TEXT PRIMARY KEY,
        nome TEXT NOT NULL UNIQUE
      )
    `);
    console.log('   ✅ Tabela disciplinas criada\n');

    // 4. Tabela de gabaritos
    console.log('4. Criando tabela gabaritos...');
    await db.exec(`
      CREATE TABLE IF NOT EXISTS gabaritos (
        id TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        etapa TEXT NOT NULL,
        criado_em TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    console.log('   ✅ Tabela gabaritos criada\n');

    // 5. Tabela de questões
    console.log('5. Criando tabela questoes...');
    await db.exec(`
      CREATE TABLE IF NOT EXISTS questoes (
        id TEXT PRIMARY KEY,
        gabarito_id TEXT NOT NULL,
        numero INTEGER NOT NULL,
        resposta_correta TEXT NOT NULL,
        disciplina_id TEXT,
        FOREIGN KEY (gabarito_id) REFERENCES gabaritos(id) ON DELETE CASCADE,
        FOREIGN KEY (disciplina_id) REFERENCES disciplinas(id) ON DELETE SET NULL,
        UNIQUE(gabarito_id, numero)
      )
    `);
    console.log('   ✅ Tabela questoes criada\n');

    // 6. Tabela de respostas
    console.log('6. Criando tabela respostas...');
    await db.exec(`
      CREATE TABLE IF NOT EXISTS respostas (
        id TEXT PRIMARY KEY,
        aluno_id TEXT NOT NULL,
        questao_id TEXT NOT NULL,
        gabarito_id TEXT NOT NULL,
        resposta_aluno TEXT NOT NULL,
        acertou INTEGER NOT NULL CHECK(acertou IN (0, 1)),
        data_resposta TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (aluno_id) REFERENCES alunos(id) ON DELETE CASCADE,
        FOREIGN KEY (questao_id) REFERENCES questoes(id) ON DELETE CASCADE,
        FOREIGN KEY (gabarito_id) REFERENCES gabaritos(id) ON DELETE CASCADE
      )
    `);
    console.log('   ✅ Tabela respostas criada\n');

    // 7. Tabela de sessões
    console.log('7. Criando tabela sessoes...');
    await db.exec(`
      CREATE TABLE IF NOT EXISTS sessoes (
        id TEXT PRIMARY KEY,
        etapa TEXT NOT NULL,
        data TEXT NOT NULL,
        hora TEXT NOT NULL,
        aluno_id TEXT NOT NULL,
        disciplina_id TEXT NOT NULL,
        usuario_id TEXT NOT NULL,
        FOREIGN KEY (aluno_id) REFERENCES alunos(id) ON DELETE CASCADE,
        FOREIGN KEY (disciplina_id) REFERENCES disciplinas(id) ON DELETE CASCADE,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
      )
    `);
    console.log('   ✅ Tabela sessoes criada\n');

    // 8. Tabela de relatórios
    console.log('8. Criando tabela relatorios...');
    await db.exec(`
      CREATE TABLE IF NOT EXISTS relatorios (
        id TEXT PRIMARY KEY,
        sessao_id TEXT NOT NULL,
        etapa TEXT NOT NULL,
        media_geral REAL NOT NULL,
        grafico_linha TEXT,
        grafico_coluna TEXT,
        data_geracao TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (sessao_id) REFERENCES sessoes(id) ON DELETE CASCADE
      )
    `);
    console.log('   ✅ Tabela relatorios criada\n');

    // Criar índices para melhor performance
    console.log('9. Criando índices...');
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
      CREATE INDEX IF NOT EXISTS idx_usuarios_matricula ON usuarios(matricula);
      CREATE INDEX IF NOT EXISTS idx_alunos_matricula ON alunos(matricula);
      CREATE INDEX IF NOT EXISTS idx_questoes_gabarito ON questoes(gabarito_id);
      CREATE INDEX IF NOT EXISTS idx_respostas_aluno ON respostas(aluno_id);
      CREATE INDEX IF NOT EXISTS idx_respostas_questao ON respostas(questao_id);
      CREATE INDEX IF NOT EXISTS idx_sessoes_aluno ON sessoes(aluno_id);
      CREATE INDEX IF NOT EXISTS idx_sessoes_data ON sessoes(data);
      CREATE INDEX IF NOT EXISTS idx_relatorios_sessao ON relatorios(sessao_id);
    `);
    console.log('   ✅ Índices criados\n');

    // Adicionar coluna configuracoes se não existir
    console.log('10. Verificando coluna configuracoes...');
    try {
      await db.exec(`
        ALTER TABLE usuarios ADD COLUMN configuracoes TEXT;
      `);
      console.log('   ✅ Coluna configuracoes adicionada\n');
    } catch (error) {
      if (error.message && error.message.includes('duplicate column')) {
        console.log('   ℹ️  Coluna configuracoes já existe\n');
      } else {
        console.log('   ⚠️  Aviso ao adicionar coluna configuracoes:', error.message, '\n');
      }
    }

    console.log('✅ Schema criado com sucesso!\n');
    console.log('📊 Tabelas criadas:');
    console.log('   - usuarios');
    console.log('   - alunos');
    console.log('   - disciplinas');
    console.log('   - gabaritos');
    console.log('   - questoes');
    console.log('   - respostas');
    console.log('   - sessoes');
    console.log('   - relatorios\n');

  } catch (err) {
    console.error('❌ Erro ao criar schema:', err.message);
    console.error('Stack:', err.stack);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  createSchema().then(() => {
    process.exit(0);
  }).catch(err => {
    console.error('Erro:', err);
    process.exit(1);
  });
}

module.exports = { createSchema };
