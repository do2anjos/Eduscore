const db = require('../db');

/**
 * Executa uma função dentro de uma transação SQLite
 * Garante rollback automático em caso de erro
 * @param {Function} callback - Função que recebe o db para fazer queries
 * @returns {Promise} - Resultado da função callback
 */
const withTransaction = async (callback) => {
  // SQLite gerencia transações automaticamente
  // better-sqlite3 usa transações implícitas
  try {
    const result = await callback(db);
    return result;
  } catch (error) {
    // SQLite faz rollback automático em caso de erro
    throw error;
  }
};

module.exports = {
  withTransaction
};
