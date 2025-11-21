/**
 * Script para migrar dados do SQLite local para o Turso
 * Execute: node migrar_dados_turso.js
 */

require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
const { createClient } = require('@libsql/client');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Verificar se as variáveis do Turso estão configuradas
// Permitir passar via argumentos ou variáveis de ambiente
const tursoUrl = process.argv[2] || process.env.TURSO_DATABASE_URL;
const tursoToken = process.argv[3] || process.env.TURSO_AUTH_TOKEN;

if (!tursoUrl || !tursoToken) {
  console.error('❌ ERRO: TURSO_DATABASE_URL e TURSO_AUTH_TOKEN devem estar definidos!');
  console.error('   Uso: node scripts/migrar_dados_turso.js <TURSO_URL> <TURSO_TOKEN>');
  console.error('   OU configure no arquivo backend/.env:');
  console.error('      TURSO_DATABASE_URL=libsql://...');
  console.error('      TURSO_AUTH_TOKEN=...');
  process.exit(1);
}

// Verificar se o banco SQLite local existe
const dbLocalPath = process.env.DB_PATH || path.join(__dirname, '../data/database.sqlite');
if (!fs.existsSync(dbLocalPath)) {
  console.error(`❌ ERRO: Banco SQLite local não encontrado em: ${dbLocalPath}`);
  process.exit(1);
}

// Conectar ao SQLite local
const dbLocal = new Database(dbLocalPath);

// Conectar ao Turso
const dbTurso = createClient({
  url: tursoUrl,
  authToken: tursoToken,
});

async function migrarDados() {
  console.log('🔄 Iniciando migração de dados do SQLite local para o Turso...\n');

  try {
    // 1. Migrar usuários
    console.log('1. Migrando usuários...');
    const usuarios = dbLocal.prepare('SELECT * FROM usuarios').all();
    console.log(`   📊 Encontrados ${usuarios.length} usuários no banco local`);
    
    for (const usuario of usuarios) {
      try {
        await dbTurso.execute({
          sql: `INSERT INTO usuarios (
            id, nome, email, matricula, telefone, senha_hash, 
            foto_perfil, perfil, tipo_usuario, configuracoes, criado_em
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            usuario.id,
            usuario.nome,
            usuario.email,
            usuario.matricula,
            usuario.telefone || null,
            usuario.senha_hash,
            usuario.foto_perfil || null,
            usuario.perfil,
            usuario.tipo_usuario || usuario.perfil,
            usuario.configuracoes || null,
            usuario.criado_em
          ]
        });
        console.log(`   ✅ Usuário migrado: ${usuario.email}`);
      } catch (err) {
        if (err.message && err.message.includes('UNIQUE constraint')) {
          console.log(`   ⚠️  Usuário já existe no Turso: ${usuario.email}`);
        } else {
          console.error(`   ❌ Erro ao migrar usuário ${usuario.email}:`, err.message);
        }
      }
    }

    // 2. Migrar alunos
    console.log('\n2. Migrando alunos...');
    const alunos = dbLocal.prepare('SELECT * FROM alunos').all();
    console.log(`   📊 Encontrados ${alunos.length} alunos no banco local`);
    
    for (const aluno of alunos) {
      try {
        await dbTurso.execute({
          sql: `INSERT INTO alunos (
            id, nome_completo, email, telefone_responsavel, 
            data_nascimento, etapa, matricula
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: [
            aluno.id,
            aluno.nome_completo,
            aluno.email,
            aluno.telefone_responsavel || null,
            aluno.data_nascimento || null,
            aluno.etapa || null,
            aluno.matricula
          ]
        });
        console.log(`   ✅ Aluno migrado: ${aluno.nome_completo}`);
      } catch (err) {
        if (err.message && err.message.includes('UNIQUE constraint')) {
          console.log(`   ⚠️  Aluno já existe no Turso: ${aluno.nome_completo}`);
        } else {
          console.error(`   ❌ Erro ao migrar aluno ${aluno.nome_completo}:`, err.message);
        }
      }
    }

    // 3. Migrar disciplinas
    console.log('\n3. Migrando disciplinas...');
    const disciplinas = dbLocal.prepare('SELECT * FROM disciplinas').all();
    console.log(`   📊 Encontradas ${disciplinas.length} disciplinas no banco local`);
    
    for (const disciplina of disciplinas) {
      try {
        await dbTurso.execute({
          sql: `INSERT INTO disciplinas (id, nome) VALUES (?, ?)`,
          args: [disciplina.id, disciplina.nome]
        });
        console.log(`   ✅ Disciplina migrada: ${disciplina.nome}`);
      } catch (err) {
        if (err.message && err.message.includes('UNIQUE constraint')) {
          console.log(`   ⚠️  Disciplina já existe no Turso: ${disciplina.nome}`);
        } else {
          console.error(`   ❌ Erro ao migrar disciplina ${disciplina.nome}:`, err.message);
        }
      }
    }

    // 4. Migrar gabaritos
    console.log('\n4. Migrando gabaritos...');
    const gabaritos = dbLocal.prepare('SELECT * FROM gabaritos').all();
    console.log(`   📊 Encontrados ${gabaritos.length} gabaritos no banco local`);
    
    for (const gabarito of gabaritos) {
      try {
        await dbTurso.execute({
          sql: `INSERT INTO gabaritos (id, nome, etapa, criado_em) VALUES (?, ?, ?, ?)`,
          args: [
            gabarito.id,
            gabarito.nome,
            gabarito.etapa,
            gabarito.criado_em
          ]
        });
        console.log(`   ✅ Gabarito migrado: ${gabarito.nome}`);
      } catch (err) {
        if (err.message && err.message.includes('UNIQUE constraint')) {
          console.log(`   ⚠️  Gabarito já existe no Turso: ${gabarito.nome}`);
        } else {
          console.error(`   ❌ Erro ao migrar gabarito ${gabarito.nome}:`, err.message);
        }
      }
    }

    // 5. Migrar questões
    console.log('\n5. Migrando questões...');
    const questoes = dbLocal.prepare('SELECT * FROM questoes').all();
    console.log(`   📊 Encontradas ${questoes.length} questões no banco local`);
    
    for (const questao of questoes) {
      try {
        await dbTurso.execute({
          sql: `INSERT INTO questoes (
            id, gabarito_id, numero, resposta_correta, disciplina_id
          ) VALUES (?, ?, ?, ?, ?)`,
          args: [
            questao.id,
            questao.gabarito_id,
            questao.numero,
            questao.resposta_correta,
            questao.disciplina_id || null
          ]
        });
        console.log(`   ✅ Questão ${questao.numero} migrada`);
      } catch (err) {
        if (err.message && err.message.includes('UNIQUE constraint')) {
          console.log(`   ⚠️  Questão já existe no Turso: ${questao.id}`);
        } else {
          console.error(`   ❌ Erro ao migrar questão ${questao.id}:`, err.message);
        }
      }
    }

    // 6. Migrar respostas
    console.log('\n6. Migrando respostas...');
    const respostas = dbLocal.prepare('SELECT * FROM respostas').all();
    console.log(`   📊 Encontradas ${respostas.length} respostas no banco local`);
    
    for (const resposta of respostas) {
      try {
        await dbTurso.execute({
          sql: `INSERT INTO respostas (
            id, aluno_id, questao_id, gabarito_id, 
            resposta_aluno, acertou, data_resposta
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: [
            resposta.id,
            resposta.aluno_id,
            resposta.questao_id,
            resposta.gabarito_id,
            resposta.resposta_aluno,
            resposta.acertou,
            resposta.data_resposta
          ]
        });
      } catch (err) {
        if (err.message && err.message.includes('UNIQUE constraint')) {
          // Ignorar se já existe
        } else {
          console.error(`   ❌ Erro ao migrar resposta ${resposta.id}:`, err.message);
        }
      }
    }
    if (respostas.length > 0) {
      console.log(`   ✅ ${respostas.length} respostas processadas`);
    }

    // 7. Migrar sessões
    console.log('\n7. Migrando sessões...');
    const sessoes = dbLocal.prepare('SELECT * FROM sessoes').all();
    console.log(`   📊 Encontradas ${sessoes.length} sessões no banco local`);
    
    for (const sessao of sessoes) {
      try {
        await dbTurso.execute({
          sql: `INSERT INTO sessoes (
            id, etapa, data, hora, aluno_id, disciplina_id, usuario_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: [
            sessao.id,
            sessao.etapa,
            sessao.data,
            sessao.hora,
            sessao.aluno_id,
            sessao.disciplina_id,
            sessao.usuario_id
          ]
        });
        console.log(`   ✅ Sessão migrada: ${sessao.id}`);
      } catch (err) {
        if (err.message && err.message.includes('UNIQUE constraint')) {
          console.log(`   ⚠️  Sessão já existe no Turso: ${sessao.id}`);
        } else {
          console.error(`   ❌ Erro ao migrar sessão ${sessao.id}:`, err.message);
        }
      }
    }

    // 8. Migrar relatórios
    console.log('\n8. Migrando relatórios...');
    const relatorios = dbLocal.prepare('SELECT * FROM relatorios').all();
    console.log(`   📊 Encontrados ${relatorios.length} relatórios no banco local`);
    
    for (const relatorio of relatorios) {
      try {
        await dbTurso.execute({
          sql: `INSERT INTO relatorios (
            id, sessao_id, etapa, media_geral, 
            grafico_linha, grafico_coluna, data_geracao
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: [
            relatorio.id,
            relatorio.sessao_id,
            relatorio.etapa,
            relatorio.media_geral,
            relatorio.grafico_linha || null,
            relatorio.grafico_coluna || null,
            relatorio.data_geracao
          ]
        });
        console.log(`   ✅ Relatório migrado: ${relatorio.id}`);
      } catch (err) {
        if (err.message && err.message.includes('UNIQUE constraint')) {
          console.log(`   ⚠️  Relatório já existe no Turso: ${relatorio.id}`);
        } else {
          console.error(`   ❌ Erro ao migrar relatório ${relatorio.id}:`, err.message);
        }
      }
    }

    // 9. Migrar imagens_cartoes (se existir)
    try {
      console.log('\n9. Verificando imagens_cartoes...');
      const imagens = dbLocal.prepare('SELECT * FROM imagens_cartoes').all();
      console.log(`   📊 Encontradas ${imagens.length} imagens no banco local`);
      
      for (const imagem of imagens) {
        try {
          await dbTurso.execute({
            sql: `INSERT INTO imagens_cartoes (
              id, aluno_id, gabarito_id, caminho_imagem, nome_imagem, criado_em
            ) VALUES (?, ?, ?, ?, ?, ?)`,
            args: [
              imagem.id,
              imagem.aluno_id,
              imagem.gabarito_id,
              imagem.caminho_imagem,
              imagem.nome_imagem,
              imagem.criado_em
            ]
          });
          console.log(`   ✅ Imagem migrada: ${imagem.nome_imagem}`);
        } catch (err) {
          if (err.message && err.message.includes('UNIQUE constraint')) {
            console.log(`   ⚠️  Imagem já existe no Turso: ${imagem.nome_imagem}`);
          } else {
            console.error(`   ❌ Erro ao migrar imagem ${imagem.id}:`, err.message);
          }
        }
      }
    } catch (err) {
      if (err.message && err.message.includes('no such table')) {
        console.log('   ℹ️  Tabela imagens_cartoes não existe no banco local');
      } else {
        console.error('   ⚠️  Erro ao verificar imagens_cartoes:', err.message);
      }
    }

    console.log('\n✅ Migração concluída com sucesso!');
    console.log('\n📊 Resumo:');
    console.log(`   - Usuários: ${usuarios.length}`);
    console.log(`   - Alunos: ${alunos.length}`);
    console.log(`   - Disciplinas: ${disciplinas.length}`);
    console.log(`   - Gabaritos: ${gabaritos.length}`);
    console.log(`   - Questões: ${questoes.length}`);
    console.log(`   - Respostas: ${respostas.length}`);
    console.log(`   - Sessões: ${sessoes.length}`);
    console.log(`   - Relatórios: ${relatorios.length}`);

  } catch (err) {
    console.error('\n❌ Erro durante a migração:', err);
    console.error('Stack:', err.stack);
    process.exit(1);
  } finally {
    dbLocal.close();
  }
}

// Executar migração
migrarDados().then(() => {
  console.log('\n✅ Processo finalizado!');
  process.exit(0);
}).catch(err => {
  console.error('\n❌ Erro fatal:', err);
  process.exit(1);
});

