/**
 * Middleware centralizado de tratamento de erros
 * Padroniza o formato de resposta de erro em toda a aplicação
 */

/**
 * Formato padronizado de resposta de erro
 * @param {Object} res - Objeto de resposta do Express
 * @param {number} statusCode - Código HTTP de status
 * @param {string} message - Mensagem de erro
 * @param {string|Object} [details] - Detalhes adicionais do erro (opcional)
 */
const sendError = (res, statusCode, message, details = null) => {
  const response = {
    sucesso: false,
    erro: message
  };

  // Adicionar detalhes apenas em desenvolvimento ou se explicitamente fornecido
  if (details && (process.env.NODE_ENV === 'development' || typeof details === 'object')) {
    response.detalhes = details;
  }

  return res.status(statusCode).json(response);
};

/**
 * Middleware de tratamento de erros do Express
 * Deve ser usado como último middleware
 */
const errorHandler = (err, req, res, next) => {
  console.error('Erro capturado:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method
  });

  // Erro de validação (400)
  if (err.name === 'ValidationError') {
    return sendError(res, 400, 'Erro de validação', err.message);
  }

  // Erro de autenticação (401)
  if (err.name === 'UnauthorizedError' || err.status === 401) {
    return sendError(res, 401, 'Não autorizado', err.message);
  }

  // Erro de permissão (403)
  if (err.status === 403) {
    return sendError(res, 403, 'Acesso negado', err.message);
  }

  // Erro de recurso não encontrado (404)
  if (err.status === 404) {
    return sendError(res, 404, 'Recurso não encontrado', err.message);
  }

  // Erro de conflito (409)
  if (err.status === 409) {
    return sendError(res, 409, 'Conflito', err.message);
  }

  // Erro de payload muito grande (413)
  if (err.type === 'entity.too.large') {
    return sendError(res, 413, 'Arquivo muito grande. Limite de 10MB.');
  }

  // Erro de banco de dados
  if (err.code && err.code.startsWith('23')) {
    // Códigos 23xxx são erros de integridade do PostgreSQL
    if (err.code === '23505') {
      return sendError(res, 400, 'Dados duplicados', 'Registro já existe');
    }
    if (err.code === '23514') {
      return sendError(res, 400, 'Violação de regra de negócio', 'Valores inválidos');
    }
    if (err.code === '23503') {
      return sendError(res, 400, 'Violação de chave estrangeira', 'Referência inválida');
    }
  }

  // Erro genérico (500)
  return sendError(
    res,
    500,
    'Erro interno no servidor',
    process.env.NODE_ENV === 'development' ? err.message : undefined
  );
};

/**
 * Wrapper para funções assíncronas que captura erros automaticamente
 * @param {Function} fn - Função assíncrona
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  sendError,
  errorHandler,
  asyncHandler
};

