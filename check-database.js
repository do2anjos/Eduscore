const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend/.env') });

// Caminho do banco de dados
const dbPath = process.env.DB_PATH || path.join(__dirname, 'database.sqlite');

console.log('🔍 Verificando banco de dados...\n');
console.log(`📁 Caminho: ${dbPath}\n`);

try {
  const db = new Database(dbPath);

  // Listar todas as tabelas
  console.log('📊 TABELAS NO BANCO:\n');
  const tables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all();

  if (tables.length === 0) {
    console.log('  ⚠️  Nenhuma tabela encontrada!\n');
  } else {
    tables.forEach((table, index) => {
      console.log(`  ${index + 1}. ${table.name}`);
    });
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Para cada tabela, mostrar contagem de registros e alguns dados
  for (const table of tables) {
    const tableName = table.name;
    
    try {
      // Contar registros
      const count = db.prepare(`SELECT COUNT(*) as total FROM ${tableName}`).get();
      
      console.log(`📋 TABELA: ${tableName.toUpperCase()}`);
      console.log(`   Total de registros: ${count.total}\n`);

      // Se tiver registros, mostrar alguns exemplos
      if (count.total > 0 && count.total <= 100) {
        const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
        const columnNames = columns.map(col => col.name);
        
        // Limitar a 5 registros para não poluir o output
        const sample = db.prepare(`SELECT * FROM ${tableName} LIMIT 5`).all();
        
        if (sample.length > 0) {
          console.log('   Exemplos de registros:');
          sample.forEach((row, idx) => {
            console.log(`   [${idx + 1}]`);
            columnNames.forEach(col => {
              const value = row[col];
              if (value !== null && value !== undefined) {
                // Truncar valores muito longos (como base64 de imagens)
                let displayValue = String(value);
                if (displayValue.length > 100) {
                  displayValue = displayValue.substring(0, 100) + '... (truncado)';
                }
                console.log(`      ${col}: ${displayValue}`);
              }
            });
            console.log('');
          });
        }
      } else if (count.total > 100) {
        console.log(`   ⚠️  Tabela muito grande (${count.total} registros). Mostrando apenas estrutura.\n`);
      }

      // Mostrar estrutura da tabela
      const structure = db.prepare(`PRAGMA table_info(${tableName})`).all();
      if (structure.length > 0) {
        console.log('   Estrutura:');
        structure.forEach(col => {
          const nullable = col.notnull === 0 ? 'NULL' : 'NOT NULL';
          const defaultVal = col.dflt_value ? ` DEFAULT ${col.dflt_value}` : '';
          const pk = col.pk === 1 ? ' PRIMARY KEY' : '';
          console.log(`      - ${col.name} (${col.type}) ${nullable}${defaultVal}${pk}`);
        });
      }

      console.log('\n' + '-'.repeat(60) + '\n');
    } catch (err) {
      console.error(`   ❌ Erro ao consultar tabela ${tableName}:`, err.message);
      console.log('');
    }
  }

  // Estatísticas gerais
  console.log('📈 ESTATÍSTICAS GERAIS:\n');
  
  const stats = {
    usuarios: 0,
    alunos: 0,
    disciplinas: 0,
    gabaritos: 0,
    questoes: 0,
    respostas: 0,
    sessoes: 0,
    relatorios: 0
  };

  for (const key of Object.keys(stats)) {
    try {
      const result = db.prepare(`SELECT COUNT(*) as total FROM ${key}`).get();
      stats[key] = result.total;
    } catch (err) {
      // Tabela não existe
      stats[key] = null;
    }
  }

  console.log(`   👥 Usuários: ${stats.usuarios !== null ? stats.usuarios : 'N/A'}`);
  console.log(`   🎓 Alunos: ${stats.alunos !== null ? stats.alunos : 'N/A'}`);
  console.log(`   📚 Disciplinas: ${stats.disciplinas !== null ? stats.disciplinas : 'N/A'}`);
  console.log(`   📝 Gabaritos: ${stats.gabaritos !== null ? stats.gabaritos : 'N/A'}`);
  console.log(`   ❓ Questões: ${stats.questoes !== null ? stats.questoes : 'N/A'}`);
  console.log(`   ✅ Respostas: ${stats.respostas !== null ? stats.respostas : 'N/A'}`);
  console.log(`   📅 Sessões: ${stats.sessoes !== null ? stats.sessoes : 'N/A'}`);
  console.log(`   📊 Relatórios: ${stats.relatorios !== null ? stats.relatorios : 'N/A'}`);

  // Verificar se há dados para relatórios
  if (stats.respostas > 0) {
    console.log('\n   ✅ Há dados de respostas disponíveis para relatórios!');
  } else {
    console.log('\n   ⚠️  Não há dados de respostas. Os relatórios estarão vazios.');
  }

  db.close();
  console.log('\n✅ Consulta concluída!\n');

} catch (err) {
  console.error('❌ Erro ao acessar banco de dados:', err.message);
  console.error('\nDetalhes:', err);
  process.exit(1);
}


