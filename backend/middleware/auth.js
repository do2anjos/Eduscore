const jwt = require('jsonwebtoken');

// Validar JWT_SECRET na inicialização
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('❌ ERRO CRÍTICO: JWT_SECRET não está definido nas variáveis de ambiente!');
  console.error('   Defina JWT_SECRET no arquivo backend/.env');
  console.error('   Gere uma chave segura com: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
  process.exit(1);
}

/**
 * Middleware de autenticação JWT
 * Verifica se o token JWT é válido e adiciona informações do usuário em req.user
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      sucesso: false,
      erro: 'Token de autenticação não fornecido'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({
        sucesso: false,
        erro: 'Token inválido ou expirado'
      });
    }

    // Adiciona informações do usuário decodificado na requisição
    req.user = decoded;
    next();
  });
};

/**
 * Middleware para verificar se o usuário tem um dos perfis permitidos
 * @param {string[]} allowedRoles - Array de perfis permitidos (ex: ['admin', 'coordenador'])
 */
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        sucesso: false,
        erro: 'Autenticação necessária'
      });
    }

    if (!allowedRoles.includes(req.user.perfil)) {
      return res.status(403).json({
        sucesso: false,
        erro: `Acesso negado. Perfis permitidos: ${allowedRoles.join(', ')}`
      });
    }

    next();
  };
};

/**
 * Função auxiliar para gerar token JWT
 * @param {object} payload - Dados do usuário (userId, email, perfil)
 * @param {string} expiresIn - Tempo de expiração (padrão: 1h)
 */
const generateToken = (payload, expiresIn = '1h') => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
};

module.exports = {
  authenticateToken,
  requireRole,
  generateToken,
  JWT_SECRET
};

