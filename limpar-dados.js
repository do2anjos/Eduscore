const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend/.env') });

const dbPath = process.env.DB_PATH || path.join(__dirname, 'database.sqlite');

console.log('🧹 Limpando dados antigos...\n');

try {
  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');

  // Limpar respostas
  const respostas = db.prepare('DELETE FROM respostas').run();
  console.log(`   ✅ ${respostas.changes} respostas removidas`);

  // Limpar questões
  const questoes = db.prepare('DELETE FROM questoes').run();
  console.log(`   ✅ ${questoes.changes} questões removidas`);

  // Limpar gabaritos
  const gabaritos = db.prepare('DELETE FROM gabaritos').run();
  console.log(`   ✅ ${gabaritos.changes} gabaritos removidos`);

  // Limpar alunos (opcional - comentado para manter os 3 alunos)
  // const alunos = db.prepare('DELETE FROM alunos').run();
  // console.log(`   ✅ ${alunos.changes} alunos removidos`);

  console.log('\n✅ Dados limpos com sucesso!\n');
  db.close();

} catch (err) {
  console.error('❌ Erro ao limpar dados:', err.message);
  process.exit(1);
}


