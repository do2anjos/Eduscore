/**
 * Script para limpar TODOS os registros de um aluno específico
 * 
 * Este script remove:
 * - Todas as respostas do aluno
 * - Todas as sessões do aluno
 * - Todos os relatórios do aluno
 * 
 * O registro do aluno na tabela 'alunos' será MANTIDO.
 * 
 * USO:
 * 1. Altere a variável MATRICULA abaixo com a matrícula do aluno desejado
 * 2. Execute: node limpar_registros_aluno.js
 */

const db = require('../backend/db');

// ============================================
// CONFIGURAÇÃO - ALTERE AQUI A MATRÍCULA
// ============================================
const MATRICULA = '2024008'; // <-- ALTERE AQUI A MATRÍCULA DO ALUNO

// ============================================
// NÃO ALTERE O CÓDIGO ABAIXO
// ============================================

async function limparRegistrosAluno() {
  try {
    console.log('🔍 Buscando aluno...\n');

    // 1. Encontrar o aluno pela matrícula
    const aluno = await db.query(
      'SELECT id, nome_completo, matricula FROM alunos WHERE matricula = ?',
      [MATRICULA]
    );

    if (aluno.rows.length === 0) {
      console.log(`❌ Aluno com matrícula ${MATRICULA} não encontrado!`);
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

    console.log('✅ Aluno encontrado:');
    console.log(`   ID: ${aluno.rows[0].id}`);
    console.log(`   Nome: ${aluno.rows[0].nome_completo}`);
    console.log(`   Matrícula: ${aluno.rows[0].matricula}\n`);

    const alunoId = aluno.rows[0].id;

    // 2. Contar registros existentes
    console.log('📊 Verificando registros existentes...\n');

    const respostas = await db.query(
      'SELECT COUNT(*) as total FROM respostas WHERE aluno_id = ?',
      [alunoId]
    );
    const totalRespostas = respostas.rows[0].total || respostas.rows[0]['COUNT(*)'] || 0;

    // Para sessões, precisamos verificar se a coluna existe
    let totalSessoes = 0;
    try {
      const sessoes = await db.query(
        'SELECT COUNT(*) as total FROM sessoes WHERE aluno_id = ?',
        [alunoId]
      );
      totalSessoes = sessoes.rows[0].total || sessoes.rows[0]['COUNT(*)'] || 0;
    } catch (err) {
      console.log('   ⚠️  Não foi possível contar sessões (tabela pode não ter aluno_id)');
    }

    // Para relatórios, precisamos buscar através de sessões
    let totalRelatorios = 0;
    try {
      const relatorios = await db.query(
        `SELECT COUNT(*) as total FROM relatorios r 
         INNER JOIN sessoes s ON r.sessao_id = s.id 
         WHERE s.aluno_id = ?`,
        [alunoId]
      );
      totalRelatorios = relatorios.rows[0].total || relatorios.rows[0]['COUNT(*)'] || 0;
    } catch (err) {
      console.log('   ⚠️  Não foi possível contar relatórios');
    }

    console.log(`   📝 Respostas: ${totalRespostas}`);
    console.log(`   📅 Sessões: ${totalSessoes}`);
    console.log(`   📊 Relatórios: ${totalRelatorios}`);

    const totalRegistros = totalRespostas + totalSessoes + totalRelatorios;

    if (totalRegistros === 0) {
      console.log('\n⚠️  Nenhum registro encontrado para deletar.');
      console.log('   O aluno não possui registros relacionados.');
      process.exit(0);
    }

    // 3. Confirmar antes de deletar
    console.log(`\n⚠️  ATENÇÃO: Você está prestes a deletar ${totalRegistros} registro(s)!`);
    console.log(`   Aluno: ${aluno.rows[0].nome_completo} (${aluno.rows[0].matricula})`);
    console.log(`   - Respostas: ${totalRespostas}`);
    console.log(`   - Sessões: ${totalSessoes}`);
    console.log(`   - Relatórios: ${totalRelatorios}`);
    console.log('\n   Esta ação não pode ser desfeita!');
    console.log('   O registro do aluno será MANTIDO na tabela alunos.\n');

    // 4. Deletar os registros
    console.log('🗑️  Deletando registros...\n');

    let respostasDeletadas = 0;
    let sessoesDeletadas = 0;
    let relatoriosDeletados = 0;

    // Deletar respostas
    if (totalRespostas > 0) {
      const resultadoRespostas = await db.query(
        'DELETE FROM respostas WHERE aluno_id = ?',
        [alunoId]
      );
      respostasDeletadas = resultadoRespostas.rowCount || totalRespostas;
      console.log(`   ✅ ${respostasDeletadas} resposta(s) deletada(s)`);
    }

    // Deletar sessões
    if (totalSessoes > 0) {
      try {
        const resultadoSessoes = await db.query(
          'DELETE FROM sessoes WHERE aluno_id = ?',
          [alunoId]
        );
        sessoesDeletadas = resultadoSessoes.rowCount || totalSessoes;
        console.log(`   ✅ ${sessoesDeletadas} sessão(ões) deletada(s)`);
      } catch (err) {
        console.log(`   ⚠️  Erro ao deletar sessões: ${err.message}`);
      }
    }

    // Deletar relatórios (através de sessões)
    if (totalRelatorios > 0) {
      try {
        const resultadoRelatorios = await db.query(
          `DELETE FROM relatorios 
           WHERE sessao_id IN (SELECT id FROM sessoes WHERE aluno_id = ?)`,
          [alunoId]
        );
        relatoriosDeletados = resultadoRelatorios.rowCount || totalRelatorios;
        console.log(`   ✅ ${relatoriosDeletados} relatório(s) deletado(s)`);
      } catch (err) {
        console.log(`   ⚠️  Erro ao deletar relatórios: ${err.message}`);
      }
    }

    // 5. Resumo final
    console.log(`\n✅ Processo concluído!`);
    console.log(`\n📋 Resumo:`);
    console.log(`   Aluno: ${aluno.rows[0].nome_completo} (${aluno.rows[0].matricula})`);
    console.log(`   Respostas deletadas: ${respostasDeletadas}`);
    console.log(`   Sessões deletadas: ${sessoesDeletadas}`);
    console.log(`   Relatórios deletados: ${relatoriosDeletados}`);
    console.log(`   Total: ${respostasDeletadas + sessoesDeletadas + relatoriosDeletados} registro(s)`);
    console.log(`\n✅ O registro do aluno foi mantido na tabela alunos.`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erro ao limpar registros:', error);
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
limparRegistrosAluno();

