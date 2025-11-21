/**
 * Script para excluir todos os alunos exceto o aluno com matrícula 2024008
 * 
 * USO:
 * Execute: node excluir_alunos.js
 * 
 * ATENÇÃO: Esta ação não pode ser desfeita!
 * Os dados relacionados (respostas, sessões, relatórios) serão deletados automaticamente
 * devido às foreign keys com ON DELETE CASCADE.
 */

const db = require('../backend/db');

// ============================================
// CONFIGURAÇÃO - MATRÍCULA DO ALUNO A MANTER
// ============================================
const MATRICULA_MANTER = '2024008';

// ============================================
// NÃO ALTERE O CÓDIGO ABAIXO
// ============================================

async function excluirAlunos() {
  try {
    console.log('🔍 Verificando alunos no banco de dados...\n');

    // 1. Verificar se o aluno a manter existe
    const alunoManter = await db.query(
      'SELECT id, nome_completo, matricula FROM alunos WHERE matricula = ?',
      [MATRICULA_MANTER]
    );

    if (alunoManter.rows.length === 0) {
      console.log(`❌ Aluno com matrícula ${MATRICULA_MANTER} não encontrado!`);
      console.log('\n⚠️  Não é possível continuar sem o aluno a ser mantido.');
      console.log('\nVerificando alunos cadastrados...');
      const todosAlunos = await db.query('SELECT matricula, nome_completo FROM alunos ORDER BY matricula');
      if (todosAlunos.rows.length > 0) {
        console.log('\nAlunos disponíveis:');
        todosAlunos.rows.forEach(a => {
          console.log(`  - ${a.matricula}: ${a.nome_completo}`);
        });
      }
      process.exit(1);
    }

    console.log('✅ Aluno a manter encontrado:');
    console.log(`   ID: ${alunoManter.rows[0].id}`);
    console.log(`   Nome: ${alunoManter.rows[0].nome_completo}`);
    console.log(`   Matrícula: ${alunoManter.rows[0].matricula}\n`);

    // 2. Listar todos os alunos
    const todosAlunos = await db.query(
      'SELECT id, nome_completo, matricula FROM alunos ORDER BY matricula'
    );

    console.log(`📊 Total de alunos no banco: ${todosAlunos.rows.length}`);

    // 3. Filtrar alunos a deletar (todos exceto o que será mantido)
    const alunosParaDeletar = todosAlunos.rows.filter(
      aluno => aluno.matricula !== MATRICULA_MANTER
    );

    if (alunosParaDeletar.length === 0) {
      console.log('\n✅ Não há alunos para deletar. Apenas o aluno a manter está cadastrado.');
      process.exit(0);
    }

    console.log(`\n⚠️  ATENÇÃO: Você está prestes a deletar ${alunosParaDeletar.length} aluno(s)!`);
    console.log(`\nAlunos que serão DELETADOS:`);
    alunosParaDeletar.forEach((aluno, index) => {
      console.log(`   ${index + 1}. ${aluno.matricula}: ${aluno.nome_completo}`);
    });

    console.log(`\nAluno que será MANTIDO:`);
    console.log(`   ✅ ${alunoManter.rows[0].matricula}: ${alunoManter.rows[0].nome_completo}`);

    console.log('\n⚠️  Esta ação não pode ser desfeita!');
    console.log('   Todos os dados relacionados (respostas, sessões, relatórios)');
    console.log('   serão deletados automaticamente devido às foreign keys com CASCADE.\n');

    // 5. Deletar os alunos
    console.log('🗑️  Deletando alunos...\n');
    
    let alunosDeletados = 0;
    for (const aluno of alunosParaDeletar) {
      const resultado = await db.query(
        'DELETE FROM alunos WHERE id = ?',
        [aluno.id]
      );
      
      if (resultado.rowCount > 0) {
        alunosDeletados++;
        console.log(`   ✅ Deletado: ${aluno.matricula} - ${aluno.nome_completo}`);
      }
    }

    // 6. Resumo final
    console.log(`\n✅ Processo concluído!`);
    console.log(`\n📋 Resumo:`);
    console.log(`   Alunos deletados: ${alunosDeletados}`);
    console.log(`   (Respostas, sessões e relatórios relacionados foram deletados automaticamente)`);
    console.log(`\n✅ Aluno mantido:`);
    console.log(`   ${alunoManter.rows[0].matricula}: ${alunoManter.rows[0].nome_completo}`);

    // 7. Verificar resultado final
    const alunosRestantes = await db.query('SELECT COUNT(*) as total FROM alunos');
    const totalFinal = alunosRestantes.rows[0].total || 0;
    
    if (totalFinal === 1) {
      console.log(`\n✅ Sucesso! Resta apenas 1 aluno no banco de dados.`);
    } else {
      console.log(`\n⚠️  Atenção: Restam ${totalFinal} aluno(s) no banco de dados.`);
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erro ao excluir alunos:', error);
    console.error('\nDetalhes do erro:');
    console.error(error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Executar o script
excluirAlunos();

