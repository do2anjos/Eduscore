/**
 * Middleware de validação comum
 * Funções auxiliares para validação de dados de entrada
 */

/**
 * Valida se um valor é um UUID válido
 * @param {string} value - Valor a ser validado
 * @returns {boolean}
 */
const isValidUUID = (value) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
};

/**
 * Valida se um email é válido
 * @param {string} email - Email a ser validado
 * @returns {boolean}
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Valida se uma data está no formato YYYY-MM-DD
 * @param {string} date - Data a ser validada
 * @returns {boolean}
 */
const isValidDate = (date) => {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) return false;
  
  const d = new Date(date);
  return d instanceof Date && !isNaN(d);
};

/**
 * Valida se uma hora está no formato HH:MM
 * @param {string} time - Hora a ser validada
 * @returns {boolean}
 */
const isValidTime = (time) => {
  const timeRegex = /^\d{2}:\d{2}$/;
  if (!timeRegex.test(time)) return false;
  
  const [hours, minutes] = time.split(':').map(Number);
  return hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60;
};

/**
 * Valida se um número é um inteiro positivo
 * @param {any} value - Valor a ser validado
 * @returns {boolean}
 */
const isPositiveInteger = (value) => {
  const num = Number(value);
  return Number.isInteger(num) && num > 0;
};

/**
 * Valida campos obrigatórios em um objeto
 * @param {Object} data - Objeto com os dados
 * @param {string[]} requiredFields - Array de campos obrigatórios
 * @returns {Object|null} - Objeto com campos faltantes ou null se tudo OK
 */
const validateRequiredFields = (data, requiredFields) => {
  const missing = requiredFields.filter(field => !data[field] && data[field] !== 0);
  if (missing.length > 0) {
    return {
      isValid: false,
      missingFields: missing,
      message: `Campos obrigatórios faltando: ${missing.join(', ')}`
    };
  }
  return { isValid: true };
};

/**
 * Middleware para validar UUID em parâmetros
 * @param {string} paramName - Nome do parâmetro a validar
 */
const validateUUIDParam = (paramName = 'id') => {
  return (req, res, next) => {
    const value = req.params[paramName];
    if (value && !isValidUUID(value)) {
      return res.status(400).json({
        sucesso: false,
        erro: `Parâmetro ${paramName} deve ser um UUID válido`
      });
    }
    next();
  };
};

/**
 * Validação de email institucional (.edu.br)
 * @param {string} email - Email a ser validado
 * @returns {boolean}
 */
const isInstitutionalEmail = (email) => {
  return isValidEmail(email) && email.endsWith('.edu.br');
};

module.exports = {
  isValidUUID,
  isValidEmail,
  isValidDate,
  isValidTime,
  isPositiveInteger,
  validateRequiredFields,
  validateUUIDParam,
  isInstitutionalEmail
};

