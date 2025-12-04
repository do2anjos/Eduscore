const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Detectar se está usando Turso (produção) ou SQLite local (desenvolvimento)
// FORCE_LOCAL=true força o uso do SQLite local mesmo se houver credenciais do Turso
const forceLocal = process.env.FORCE_LOCAL === 'true';
const isTurso = !forceLocal && process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN;

if (forceLocal) {
  console.log('🔧 Modo local forçado (FORCE_LOCAL=true)');
}

let db;
let dbClient; // Para Turso (LibSQL client)
let localDbForQueries; // Para SQLite local (referência original sem wrappers)

if (isTurso) {
  // Configuração para Turso (produção) - usando @libsql/client
  const { createClient } = require('@libsql/client');
  dbClient = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  // Wrapper para Turso que simula a interface do better-sqlite3
  db = {
    // Executar SQL sem retorno (para DDL)
    exec: async (sql) => {
      // Dividir múltiplas statements por ponto e vírgula
      const statements = sql.split(';').filter(s => s.trim());
      for (const stmt of statements) {
        if (stmt.trim()) {
          await dbClient.execute(stmt.trim());
        }
      }
    },

    // Executar PRAGMA
    pragma: async (pragma) => {
      // Turso/LibSQL não suporta todos os PRAGMAs do SQLite
      // Foreign keys são habilitados por padrão no Turso
      if (pragma === 'foreign_keys = ON') {
        // Turso já tem foreign keys habilitadas por padrão
        return;
      }
      // Para outros PRAGMAs, tentar executar como SQL
      await dbClient.execute(`PRAGMA ${pragma}`);
    },

    // Preparar statement (para queries complexas nas migrações)
    prepare: (sql) => {
      return {
        run: async (...params) => {
          const result = await dbClient.execute({
            sql,
            args: params.length > 0 ? params : undefined
          });
          return {
            changes: result.rowsAffected,
            lastInsertRowid: result.lastInsertRowid ? BigInt(result.lastInsertRowid).toString() : null
          };
        },
        all: async (...params) => {
          const result = await dbClient.execute({
            sql,
            args: params.length > 0 ? params : undefined
          });
          // Converter rows do formato LibSQL para objeto JavaScript
          return result.rows.map(row => {
            const obj = {};
            for (const [key, value] of Object.entries(row)) {
              obj[key] = value;
            }
            return obj;
          });
        }
      };
    }
  };

  console.log('✅ Conectado ao Turso (produção)');
} else {
  // Configuração para SQLite local (desenvolvimento)
  const Database = require('better-sqlite3');
  const dbPath = process.env.DB_PATH || path.join(__dirname, '../data/database.sqlite');

  // Garantir que o diretório existe
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // Criar conexão com o banco
  localDbForQueries = new Database(dbPath);
  db = localDbForQueries;

  // Habilitar foreign keys
  db.pragma('foreign_keys = ON');

  // Wrappers async para manter compatibilidade (para migrações)
  const originalExec = db.exec.bind(db);
  const originalPragma = db.pragma.bind(db);

  db.exec = (sql) => {
    return new Promise((resolve, reject) => {
      try {
        originalExec(sql);
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  };

  db.pragma = (pragma) => {
    return new Promise((resolve, reject) => {
      try {
        originalPragma(pragma);
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  };

  // Wrapper para prepare que mantém interface síncrona mas retorna promessas
  const originalPrepare = db.prepare.bind(db);
  db.prepare = (sql) => {
    const stmt = originalPrepare(sql);
    return {
      run: (...params) => {
        return new Promise((resolve, reject) => {
          try {
            resolve(stmt.run(...params));
          } catch (err) {
            reject(err);
          }
        });
      },
      all: (...params) => {
        return new Promise((resolve, reject) => {
          try {
            resolve(stmt.all(...params));
          } catch (err) {
            reject(err);
          }
        });
      }
    };
  };

  console.log('✅ Conectado ao SQLite local (desenvolvimento)');
}

// Função para converter SQL PostgreSQL para SQLite
function convertPostgresToSQLite(sql) {
  let converted = sql;

  // Converter NOW() para datetime('now')
  converted = converted.replace(/NOW\(\)/gi, "datetime('now')");

  // Converter ILIKE para LIKE com UPPER (case-insensitive)
  converted = converted.replace(/(\w+(?:\.\w+)?)\s+ILIKE\s+(\$?\d+|\?|'[^']*')/gi, (match, field, value) => {
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
  query: async (sql, params = []) => {
    try {
      // Converter SQL PostgreSQL para SQLite
      const { sql: sqliteSql, paramMap } = convertPostgresToSQLite(sql);

      // Reordenar parâmetros se necessário
      let reorderedParams = params;
      if (Object.keys(paramMap).length > 0) {
        const originalMatches = sql.match(/\$(\d+)/g);
        if (originalMatches) {
          reorderedParams = originalMatches.map(match => {
            const paramNum = parseInt(match.replace('$', ''));
            return params[paramNum - 1];
          });
        }
      }

      // Determinar tipo de query
      const trimmedSql = sqliteSql.trim().toUpperCase();

      if (isTurso) {
        // Execução no Turso (async nativo)
        if (trimmedSql.startsWith('SELECT')) {
          const result = await dbClient.execute({
            sql: sqliteSql,
            args: reorderedParams.length > 0 ? reorderedParams : undefined
          });

          // Converter rows do formato LibSQL para objeto JavaScript
          // LibSQL retorna rows como array de objetos já prontos
          const rows = result.rows || [];

          // Normalizar COUNT(*)
          const normalizedRows = rows.map(row => {
            const normalized = { ...row };
            Object.keys(normalized).forEach(key => {
              if (key === 'COUNT(*)' || key === 'count(*)') {
                normalized.count = normalized[key];
                delete normalized[key];
              }
            });
            return normalized;
          });

          return { rows: normalizedRows };
        } else if (trimmedSql.startsWith('INSERT')) {
          // Helper para gerar UUID
          const generateUUID = () => {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
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

          const result = await dbClient.execute({
            sql: insertSqlFinal,
            args: finalParams.length > 0 ? finalParams : undefined
          });

          // Se tinha RETURNING, buscar o registro inserido
          if (sql.includes('RETURNING') && tableMatch) {
            const tableName = tableMatch[1];
            const returningMatch = sql.match(/RETURNING\s+(.+)$/i);
            const columns = returningMatch ? returningMatch[1].trim() : '*';

            // Buscar usando o ID gerado ou lastInsertRowid
            const idToUse = generatedId || finalParams[0];
            let rows = [];
            if (idToUse) {
              const selectResult = await dbClient.execute({
                sql: `SELECT ${columns} FROM ${tableName} WHERE id = ?`,
                args: [idToUse]
              });
              rows = selectResult.rows || [];
            }

            return { rows, rowCount: result.rowsAffected };
          } else {
            return { rows: [], rowCount: result.rowsAffected };
          }
        } else {
          // UPDATE ou DELETE
          let finalSql = sqliteSql;
          let hasReturning = false;
          let returningColumns = '*';

          // Verificar se tem RETURNING
          const returningMatch = sql.match(/RETURNING\s+(.+)$/i);
          if (returningMatch) {
            hasReturning = true;
            returningColumns = returningMatch[1].trim();
            finalSql = sqliteSql.replace(/RETURNING.*$/i, '').trim();
          }

          const result = await dbClient.execute({
            sql: finalSql,
            args: reorderedParams.length > 0 ? reorderedParams : undefined
          });

          // Se tinha RETURNING, buscar o registro
          if (hasReturning && result.rowsAffected > 0) {
            const tableMatch = sqliteSql.match(/UPDATE\s+(\w+)/i);
            const whereMatch = finalSql.match(/WHERE\s+(.+)$/i);

            if (tableMatch && whereMatch) {
              const tableName = tableMatch[1];
              const whereClause = whereMatch[1].trim();

              const setMatch = finalSql.match(/SET\s+(.+?)\s+WHERE/i);
              if (setMatch) {
                const setClause = setMatch[1];
                const setParamCount = (setClause.match(/\?/g) || []).length;
                const whereParamCount = (whereClause.match(/\?/g) || []).length;
                const whereParams = reorderedParams.slice(setParamCount, setParamCount + whereParamCount);

                const selectResult = await dbClient.execute({
                  sql: `SELECT ${returningColumns} FROM ${tableName} WHERE ${whereClause}`,
                  args: whereParams.length > 0 ? whereParams : undefined
                });

                const rows = selectResult.rows.map(row => {
                  const obj = {};
                  for (const [key, value] of Object.entries(row)) {
                    obj[key] = value;
                  }
                  return obj;
                });

                return {
                  rows: rows.length > 0 ? rows : [],
                  rowCount: result.rowsAffected
                };
              }
            }
          }

          return {
            rows: [],
            rowCount: result.rowsAffected
          };
        }
      } else {
        // Execução no SQLite local (síncrono, usar Database original sem wrappers async)
        // Usar a conexão já criada no início
        if (trimmedSql.startsWith('SELECT')) {
          const stmt = localDbForQueries.prepare(sqliteSql);
          const rows = await stmt.all(...reorderedParams);

          if (!Array.isArray(rows)) {
            console.error('❌ ERRO CRÍTICO: stmt.all() não retornou um array!', {
              sql: sqliteSql,
              tipoRetorno: typeof rows,
              valorRetorno: rows
            });
            return { rows: [] };
          }

          // Normalizar COUNT(*)
          const normalizedRows = rows.map(row => {
            const normalized = { ...row };
            Object.keys(normalized).forEach(key => {
              if (key === 'COUNT(*)' || key === 'count(*)') {
                normalized.count = normalized[key];
                delete normalized[key];
              }
            });
            return normalized;
          });

          return { rows: normalizedRows };
        } else if (trimmedSql.startsWith('INSERT')) {
          // Helper para gerar UUID
          const generateUUID = () => {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
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

          const stmt = localDbForQueries.prepare(insertSqlFinal);
          const info = await stmt.run(...finalParams);

          // Se tinha RETURNING, buscar o registro inserido
          if (sql.includes('RETURNING') && tableMatch) {
            const tableName = tableMatch[1];
            const returningMatch = sql.match(/RETURNING\s+(.+)$/i);
            const columns = returningMatch ? returningMatch[1].trim() : '*';

            const idToUse = generatedId || finalParams[0] || info.lastInsertRowid;
            const selectStmt = localDbForQueries.prepare(`SELECT ${columns} FROM ${tableName} WHERE id = ? OR rowid = ?`);
            const rows = await selectStmt.all(idToUse, info.lastInsertRowid);
            return { rows, rowCount: info.changes };
          } else {
            return { rows: [], rowCount: info.changes };
          }
        } else {
          // UPDATE ou DELETE
          let finalSql = sqliteSql;
          let hasReturning = false;
          let returningColumns = '*';

          // Verificar se tem RETURNING
          const returningMatch = sql.match(/RETURNING\s+(.+)$/i);
          if (returningMatch) {
            hasReturning = true;
            returningColumns = returningMatch[1].trim();
            finalSql = sqliteSql.replace(/RETURNING.*$/i, '').trim();
          }

          const stmt = localDbForQueries.prepare(finalSql);
          const info = await stmt.run(...reorderedParams);

          // Se tinha RETURNING, buscar o registro atualizado/deletado
          if (hasReturning && info.changes > 0) {
            const tableMatch = sqliteSql.match(/UPDATE\s+(\w+)/i);
            const whereMatch = finalSql.match(/WHERE\s+(.+)$/i);

            if (tableMatch && whereMatch) {
              const tableName = tableMatch[1];
              const whereClause = whereMatch[1].trim();

              const setMatch = finalSql.match(/SET\s+(.+?)\s+WHERE/i);
              if (setMatch) {
                const setClause = setMatch[1];
                const setParamCount = (setClause.match(/\?/g) || []).length;
                const whereParamCount = (whereClause.match(/\?/g) || []).length;
                const whereParams = reorderedParams.slice(setParamCount, setParamCount + whereParamCount);

                const selectStmt = localDbForQueries.prepare(`SELECT ${returningColumns} FROM ${tableName} WHERE ${whereClause}`);
                const rows = await selectStmt.all(...whereParams);
                return {
                  rows: rows.length > 0 ? rows : [],
                  rowCount: info.changes,
                  lastInsertRowid: info.lastInsertRowid
                };
              }
            }
          }

          return {
            rows: [],
            rowCount: info.changes,
            lastInsertRowid: info.lastInsertRowid
          };
        }
      }
    } catch (err) {
      throw err;
    }
  }
};

// Função helper para gerar UUID (SQLite não tem UUID nativo)
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Exportar wrapper e db direto (para casos especiais como migrações)
module.exports = dbWrapper;
module.exports.db = db;
module.exports.generateUUID = generateUUID;
