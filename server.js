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
// CONFIGURAÇÃO DE TRUST PROXY (NECESSÁRIO PARA RENDER)
// =============================================
// Render usa 1 proxy reverso, então confiamos apenas no primeiro proxy
// Isso permite que express-rate-limit identifique corretamente os IPs sem permitir bypass
app.set('trust proxy', 1);

// =============================================
// CONFIGURAÇÕES CRUCIAIS PARA PAYLOAD GRANDE
// =============================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// =============================================
// CONFIGURAÇÕES DE SEGURANÇA E CORS
// =============================================
// CORS: Permitir requisições do mesmo domínio (Render) e localhost (desenvolvimento)
const allowedOrigins = [
  FRONTEND_URL || 'http://localhost:3000',
  'http://localhost:3000',
  'https://eduscore-j49m.onrender.com',
  process.env.RENDER_EXTERNAL_URL // URL dinâmica do Render
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Permitir requisições sem origin (mesmo domínio, mobile apps, Postman)
    if (!origin) return callback(null, true);
    
    // Se a origin está na lista de permitidas
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Permitir requisições do mesmo hostname (mesmo domínio)
    const hostname = origin.replace(/^https?:\/\//, '').split(':')[0];
    const requestHostname = FRONTEND_URL ? new URL(FRONTEND_URL).hostname : hostname;
    
    if (hostname === requestHostname || hostname === 'localhost' || hostname === '127.0.0.1') {
      return callback(null, true);
    }
    
    // Bloquear origem não autorizada
    callback(new Error('Not allowed by CORS'));
  },
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
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false
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
// Servir arquivos de upload (fotos de perfil, etc.)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
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
      '/Simula': 'CorrigirSimulado.html',
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
// INICIALIZAÇÃO DO SERVIDOR E MIGRAÇÕES
// =============================================
const { createSchema } = require('./backend/migrations/create_schema');
const db = require('./backend/db');

// Função para verificar se as tabelas já existem
async function verificarTabelasExistem() {
  try {
    const result = await db.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='usuarios'"
    );
    return result.rows.length > 0;
  } catch (err) {
    // Se der erro, assumir que não existem
    return false;
  }
}

// Executar migrações automaticamente se necessário (apenas uma vez)
async function inicializarBanco() {
  try {
    const tabelasExistem = await verificarTabelasExistem();
    
    if (!tabelasExistem) {
      console.log('📦 Tabelas não encontradas. Executando migrações...');
      await createSchema();
      console.log('✅ Migrações executadas com sucesso!\n');
    } else {
      console.log('✅ Banco de dados já configurado\n');
    }
  } catch (err) {
    console.error('⚠️  Aviso: Erro ao verificar/executar migrações:', err.message);
    console.error('   Você pode executar manualmente: node backend/migrations/create_schema.js\n');
    // Não bloquear o servidor se as migrações falharem
  }
}

// Inicializar banco e depois iniciar servidor
inicializarBanco().then(() => {
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
}).catch(err => {
  console.error('❌ Erro crítico ao inicializar:', err);
  process.exit(1);
});