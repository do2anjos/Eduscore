const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const dbPath = process.env.DB_PATH || path.join(__dirname, '../data/database.sqlite');
const db = new Database(dbPath);

console.log('=== ESTRUTURA DA TABELA SESSOES ===');
const sessoesInfo = db.prepare('PRAGMA table_info(sessoes)').all();
console.log(JSON.stringify(sessoesInfo, null, 2));

console.log('\n=== ESTRUTURA DA TABELA RESPOSTAS ===');
const respostasInfo = db.prepare('PRAGMA table_info(respostas)').all();
console.log(JSON.stringify(respostasInfo, null, 2));

console.log('\n=== ESTRUTURA DA TABELA RELATORIOS ===');
const relatoriosInfo = db.prepare('PRAGMA table_info(relatorios)').all();
console.log(JSON.stringify(relatoriosInfo, null, 2));

db.close();

