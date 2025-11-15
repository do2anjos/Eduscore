const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Caminho do banco de dados
const dbPath = process.env.DB_PATH || path.join(__dirname, '../database.sqlite');

// Garantir que o diretório existe
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Criar conexão com o banco
const db = new Database(dbPath);

// Habilitar foreign keys
db.pragma('foreign_keys = ON');

// Função para converter SQL PostgreSQL para SQLite
function convertPostgresToSQLite(sql) {
  let converted = sql;
  
  // Converter NOW() para datetime('now')
  converted = converted.replace(/NOW\(\)/gi, "datetime('now')");
  
  // Converter ILIKE para LIKE com UPPER (case-insensitive)
  // SQLite não tem ILIKE, então precisamos usar UPPER() em ambos os lados
  // Padrão: campo ILIKE valor -> UPPER(campo) LIKE UPPER(valor)
  // Suporta múltiplos padrões: campo ILIKE $1, campo ILIKE ?, etc.
  converted = converted.replace(/(\w+(?:\.\w+)?)\s+ILIKE\s+(\$?\d+|\?|'[^']*')/gi, (match, field, value) => {
    // Se o valor já é uma string literal, não precisa de parâmetro
    if (value.startsWith("'")) {
      return `UPPER(${field}) LIKE UPPER(${value})`;
    }
    return `UPPER(${field}) LIKE UPPER(${value})`;
  });
  
  // Converter TO_CHAR para strftime (formatação de data/hora)
  converted = converted.replace(/TO_CHAR\(([^,]+),\s*'YYYY-MM-DD'\)/gi, "strftime('%Y-%m-%d', $1)");
  converted = converted.replace(/TO_CHAR\(([^,]+),\s*'HH24:MI'\)/gi, "strftime('%H:%M', $1)");
  
  // Converter placeholders PostgreSQL ($1, $2) para SQLite (?)
  let paramIndex = 1;
  const paramMap = {};
  converted = converted.replace(/\$(\d+)/g, (match, num) => {
    if (!paramMap[num]) {
      paramMap[num] = paramIndex++;
    }
    return '?';
  });
  
  return { sql: converted, paramMap };
}

// Wrapper para compatibilidade com código existente (async/await)
const dbWrapper = {
  query: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      try {
        // Converter SQL PostgreSQL para SQLite
        const { sql: sqliteSql, paramMap } = convertPostgresToSQLite(sql);
        
        // Reordenar parâmetros se necessário (PostgreSQL usa $1, $2, SQLite usa ? sequencial)
        let reorderedParams = params;
        if (Object.keys(paramMap).length > 0) {
          reorderedParams = Object.keys(paramMap)
            .sort((a, b) => parseInt(a) - parseInt(b))
            .map(key => params[parseInt(key) - 1]);
        }

        // Determinar tipo de query
        const trimmedSql = sqliteSql.trim().toUpperCase();
        
        if (trimmedSql.startsWith('SELECT')) {
          const stmt = db.prepare(sqliteSql);
          const rows = stmt.all(reorderedParams);
          
          // Normalizar nomes de colunas COUNT(*) para 'count' (minúsculo)
          // SQLite retorna COUNT(*) como 'COUNT(*)' mas o código espera 'count'
          const normalizedRows = rows.map(row => {
            const normalized = { ...row };
            Object.keys(normalized).forEach(key => {
              // SQLite pode retornar COUNT(*) de diferentes formas
              if (key === 'COUNT(*)' || key === 'count(*)') {
                normalized.count = normalized[key];
                delete normalized[key];
              }
            });
            return normalized;
          });
          
          resolve({ rows: normalizedRows });
        } else if (trimmedSql.startsWith('INSERT')) {
          // Helper para gerar UUID
          const generateUUID = () => {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
              const r = Math.random() * 16 | 0;
              const v = c === 'x' ? r : (r & 0x3 | 0x8);
              return v.toString(16);
            });
          };
          
          // Verificar se precisa gerar ID automaticamente
          const tableMatch = sql.match(/INTO\s+(\w+)/i);
          const columnsMatch = sql.match(/INSERT\s+INTO\s+\w+\s*\(([^)]+)\)/i);
          
          let finalParams = reorderedParams;
          let insertSqlFinal = sqliteSql;
          let generatedId = null;
          
          // Se a tabela tem coluna 'id' mas não está sendo inserida, gerar UUID
          if (tableMatch && columnsMatch) {
            const columns = columnsMatch[1].split(',').map(c => c.trim());
            if (!columns.includes('id')) {
              // Adicionar id no início
              generatedId = generateUUID();
              insertSqlFinal = insertSqlFinal.replace(
                /INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)/i,
                `INSERT INTO $1 (id, $2)`
              );
              insertSqlFinal = insertSqlFinal.replace(
                /VALUES\s*\(/i,
                `VALUES (?, `
              );
              finalParams = [generatedId, ...reorderedParams];
            }
          }
          
          // Remover RETURNING se existir
          if (insertSqlFinal.includes('RETURNING')) {
            insertSqlFinal = insertSqlFinal.replace(/RETURNING.*$/i, '').trim();
          }
          
          const stmt = db.prepare(insertSqlFinal);
          const info = stmt.run(finalParams);
          
          // Se tinha RETURNING, buscar o registro inserido
          if (sql.includes('RETURNING') && tableMatch) {
            const tableName = tableMatch[1];
            const returningMatch = sql.match(/RETURNING\s+(.+)$/i);
            const columns = returningMatch ? returningMatch[1].trim() : '*';
            
            // Usar o ID gerado ou rowid
            const idToUse = generatedId || finalParams[0] || info.lastInsertRowid;
            const selectStmt = db.prepare(`SELECT ${columns} FROM ${tableName} WHERE id = ? OR rowid = ?`);
            const rows = selectStmt.all([idToUse, info.lastInsertRowid]);
            resolve({ rows, rowCount: info.changes });
          } else {
            resolve({ rows: [], rowCount: info.changes });
          }
        } else {
          const stmt = db.prepare(sqliteSql);
          const info = stmt.run(reorderedParams);
          resolve({ 
            rows: [], 
            rowCount: info.changes,
            lastInsertRowid: info.lastInsertRowid 
          });
        }
      } catch (err) {
        reject(err);
      }
    });
  }
};

// Função helper para gerar UUID (SQLite não tem UUID nativo)
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Exportar wrapper e db direto (para casos especiais)
module.exports = dbWrapper;
module.exports.db = db;
module.exports.generateUUID = generateUUID;
