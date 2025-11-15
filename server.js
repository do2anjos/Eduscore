const express = require('express');
const path = require('path');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config({ path: './backend/.env' });

// Validar variáveis de ambiente críticas
if (!process.env.JWT_SECRET) {
  console.error('❌ ERRO CRÍTICO: JWT_SECRET não está definido!');
  console.error('   Defina JWT_SECRET no arquivo backend/.env');
  process.exit(1);
}

const FRONTEND_URL = process.env.FRONTEND_URL;
if (!FRONTEND_URL) {
  console.warn('⚠️  AVISO: FRONTEND_URL não definido. Usando http://localhost:3000');
}

const app = express();
const PORT = process.env.PORT || 3000;

// =============================================
// CONFIGURAÇÕES CRUCIAIS PARA PAYLOAD GRANDE
// =============================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// =============================================
// CONFIGURAÇÕES DE SEGURANÇA E CORS
// =============================================
app.use(cors({
  origin: FRONTEND_URL || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// =============================================
// RATE LIMITING
// =============================================
// Rate limiting geral
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 100, // 100 requisições por minuto
  message: {
    sucesso: false,
    erro: 'Muitas requisições. Tente novamente em alguns instantes.'
  }
});

// Rate limiting para login (mais restritivo)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 tentativas por 15 minutos
  message: {
    sucesso: false,
    erro: 'Muitas tentativas de login. Tente novamente em 15 minutos.'
  },
  skipSuccessfulRequests: true
});

// Rate limiting para uploads
const uploadLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 10, // 10 uploads por minuto
  message: {
    sucesso: false,
    erro: 'Muitos uploads. Tente novamente em alguns instantes.'
  }
});

app.use('/api/', generalLimiter);
app.use('/api/usuarios/login', loginLimiter);
app.use('/api/gabaritos/upload', uploadLimiter);

// =============================================
// MIDDLEWARES ADICIONAIS
// =============================================
app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res, next) => {
  // Log de requisições para debug
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// =============================================
// ROTAS DA API
// =============================================
const alunosRoutes = require('./backend/routes/alunos');
const usuariosRoutes = require('./backend/routes/usuarios');
const disciplinasRoutes = require('./backend/routes/disciplinas');
const gabaritosRoutes = require('./backend/routes/gabaritos');
const questoesRoutes = require('./backend/routes/questoes');
const respostasRoutes = require('./backend/routes/respostas');
const sessoesRoutes = require('./backend/routes/sessoes');
const relatoriosRoutes = require('./backend/routes/relatorios');

app.use('/api/alunos', alunosRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/disciplinas', disciplinasRoutes);
app.use('/api/gabaritos', gabaritosRoutes);
app.use('/api/questoes', questoesRoutes);
app.use('/api/respostas', respostasRoutes);
app.use('/api/sessoes', sessoesRoutes);
app.use('/api/relatorios', relatoriosRoutes);

// =============================================
// ROTAS DE PÁGINAS (HTML)
// =============================================
const staticRoutes = [
  '/', '/login', '/perfil', '/home', 
  '/GerarRelatorio', '/Cadastrar', '/Simula', '/Agendar'
];

staticRoutes.forEach(route => {
  app.get(route, (req, res) => {
    const fileMap = {
      '/': 'index.html',
      '/login': 'login.html',
      '/perfil': 'perfil.html',
      '/home': 'home.html',
      '/GerarRelatorio': 'GerarRelatorio.html',
      '/Cadastrar': 'Cadastrar.html',
      '/Simula': 'Simulado.html',
      '/Agendar': 'AgendarSessao.html'
    };
    res.sendFile(path.join(__dirname, 'public', fileMap[route]));
  });
});

// =============================================
// MANIPULAÇÃO DE ERROS
// =============================================
const { errorHandler } = require('./backend/middleware/errorHandler');
app.use(errorHandler);

// =============================================
// INICIALIZAÇÃO DO SERVIDOR
// =============================================
app.listen(PORT, () => {
  console.log(`
  ============================================
  ✅ Servidor rodando em: http://localhost:${PORT}
  ============================================
  Configurações:
  - Limite de payload: 10MB
  - CORS habilitado para: ${FRONTEND_URL || 'http://localhost:3000'}
  - Modo: ${process.env.NODE_ENV || 'development'}
  - JWT_SECRET: ${process.env.JWT_SECRET ? '✅ Configurado' : '❌ Não configurado'}
  ============================================`);
});