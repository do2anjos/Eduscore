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
        // Quando o mesmo parâmetro é usado múltiplas vezes, precisamos duplicar os valores
        let reorderedParams = params;
        if (Object.keys(paramMap).length > 0) {
          // Contar quantas vezes cada parâmetro aparece na query convertida
          const paramCounts = {};
          const matches = sqliteSql.match(/\?/g);
          const totalParams = matches ? matches.length : 0;
          
          // Criar array de parâmetros baseado na ordem de uso
          const sortedKeys = Object.keys(paramMap)
            .sort((a, b) => parseInt(a) - parseInt(b));
          
          // Mapear cada ? para o parâmetro correspondente na ordem que aparecem
          reorderedParams = [];
          const placeholderMatches = sqliteSql.match(/\$/g);
          
          // Para cada placeholder na query original, adicionar o parâmetro correspondente
          if (totalParams > 0) {
            // Extrair a ordem dos parâmetros da query original
            const originalMatches = sql.match(/\$(\d+)/g);
            if (originalMatches) {
              reorderedParams = originalMatches.map(match => {
                const paramNum = parseInt(match.replace('$', ''));
                return params[paramNum - 1];
              });
            } else {
              // Fallback: usar método original
              reorderedParams = sortedKeys.map(key => params[parseInt(key) - 1]);
            }
          } else {
            reorderedParams = sortedKeys.map(key => params[parseInt(key) - 1]);
          }
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
          // UPDATE ou DELETE com possível RETURNING
          let finalSql = sqliteSql;
          let hasReturning = false;
          let returningColumns = '*';
          
          // Verificar se tem RETURNING
          const returningMatch = sql.match(/RETURNING\s+(.+)$/i);
          if (returningMatch) {
            hasReturning = true;
            returningColumns = returningMatch[1].trim();
            // Remover RETURNING do SQL para executar o UPDATE/DELETE
            finalSql = sqliteSql.replace(/RETURNING.*$/i, '').trim();
          }
          
          const stmt = db.prepare(finalSql);
          const info = stmt.run(reorderedParams);
          
          // Se tinha RETURNING, buscar o registro atualizado/deletado
          if (hasReturning && info.changes > 0) {
            // Para UPDATE, precisamos identificar qual registro foi atualizado
            // Extrair a condição WHERE e o nome da tabela do SQL convertido
            const tableMatch = sqliteSql.match(/UPDATE\s+(\w+)/i);
            const whereMatch = finalSql.match(/WHERE\s+(.+)$/i);
            
            if (tableMatch && whereMatch) {
              const tableName = tableMatch[1];
              const whereClause = whereMatch[1].trim();
              
              // Contar quantos parâmetros SET existem (antes do WHERE)
              // O padrão é: UPDATE table SET col1 = ?, col2 = ? WHERE col = ?
              const setMatch = finalSql.match(/SET\s+(.+?)\s+WHERE/i);
              if (setMatch) {
                const setClause = setMatch[1];
                const setParamCount = (setClause.match(/\?/g) || []).length;
                
                // Os parâmetros WHERE são os que vêm depois dos parâmetros SET
                const whereParamCount = (whereClause.match(/\?/g) || []).length;
                const whereParams = reorderedParams.slice(setParamCount, setParamCount + whereParamCount);
                
                // Buscar o registro usando a condição WHERE (já está convertida para ?)
                const selectStmt = db.prepare(`SELECT ${returningColumns} FROM ${tableName} WHERE ${whereClause}`);
                const rows = selectStmt.all(whereParams);
                resolve({ 
                  rows: rows.length > 0 ? rows : [], 
                  rowCount: info.changes,
                  lastInsertRowid: info.lastInsertRowid 
                });
                return;
              }
            }
          }
          
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
