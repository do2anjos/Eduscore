/**
 * Script para limpar registros de respostas do Simulado DEZ - 1º Ano
 * 
 * USO:
 * 1. Altere a variável MATRICULA abaixo com a matrícula do aluno desejado
 * 2. Execute: node limpar_simulado_dez.js
 */

const db = require('./backend/db');

// ============================================
// CONFIGURAÇÃO - ALTERE AQUI A MATRÍCULA
// ============================================
const MATRICULA = '2024008'; // <-- ALTERE AQUI A MATRÍCULA DO ALUNO

// ============================================
// NÃO ALTERE O CÓDIGO ABAIXO
// ============================================

async function limparSimuladoDez() {
  try {
    console.log('🔍 Buscando aluno e simulado...\n');

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
    console.log(`   Matrícula: ${aluno.rows[0].matricula}`);

    // 2. Encontrar o gabarito pelo nome
    const gabarito = await db.query(
      "SELECT id, nome FROM gabaritos WHERE nome LIKE ?",
      ['%DEZ%1º Ano%']
    );

    if (gabarito.rows.length === 0) {
      console.log('\n❌ Gabarito "DEZ - 1º Ano" não encontrado!');
      console.log('Buscando gabaritos com "DEZ" no nome...');
      const todosGabaritos = await db.query('SELECT id, nome FROM gabaritos WHERE nome LIKE ?', ['%DEZ%']);
      if (todosGabaritos.rows.length > 0) {
        console.log('\nGabaritos encontrados:');
        todosGabaritos.rows.forEach(g => {
          console.log(`  - ${g.id}: ${g.nome}`);
        });
      }
      process.exit(1);
    }

    console.log('\n✅ Gabarito encontrado:');
    console.log(`   ID: ${gabarito.rows[0].id}`);
    console.log(`   Nome: ${gabarito.rows[0].nome}`);

    // 3. Verificar quantas respostas existem
    const respostas = await db.query(
      'SELECT COUNT(*) as total FROM respostas WHERE aluno_id = ? AND gabarito_id = ?',
      [aluno.rows[0].id, gabarito.rows[0].id]
    );

    const totalRespostas = respostas.rows[0].total || respostas.rows[0]['COUNT(*)'] || 0;
    console.log(`\n📊 Total de respostas encontradas: ${totalRespostas}`);

    if (totalRespostas === 0) {
      console.log('\n⚠️  Nenhuma resposta encontrada para deletar.');
      console.log('   O aluno não possui respostas para este simulado.');
      process.exit(0);
    }

    // 4. Confirmar antes de deletar
    console.log(`\n⚠️  ATENÇÃO: Você está prestes a deletar ${totalRespostas} resposta(s)!`);
    console.log(`   Aluno: ${aluno.rows[0].nome_completo} (${aluno.rows[0].matricula})`);
    console.log(`   Simulado: ${gabarito.rows[0].nome}`);
    console.log('\n   Esta ação não pode ser desfeita!');

    // 5. Deletar as respostas
    console.log('\n🗑️  Deletando respostas...');
    const resultado = await db.query(
      'DELETE FROM respostas WHERE aluno_id = ? AND gabarito_id = ?',
      [aluno.rows[0].id, gabarito.rows[0].id]
    );

    const respostasDeletadas = resultado.rowCount || totalRespostas;
    console.log(`\n✅ ${respostasDeletadas} resposta(s) deletada(s) com sucesso!`);
    console.log(`\n📋 Resumo:`);
    console.log(`   Aluno: ${aluno.rows[0].nome_completo} (${aluno.rows[0].matricula})`);
    console.log(`   Simulado: ${gabarito.rows[0].nome}`);
    console.log(`   Respostas deletadas: ${respostasDeletadas}`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erro ao limpar simulado:', error);
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
limparSimuladoDez();


