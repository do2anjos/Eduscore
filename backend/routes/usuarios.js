const express = require('express');
const bcrypt = require('bcrypt');
const { generateToken, authenticateToken } = require('../middleware/auth');
const router = express.Router();
const db = require('../db');

// CORS e express.json já estão configurados no server.js
// Não é necessário reconfigurar aqui

// Constants
const VALID_PROFILES = ['professor', 'coordenador', 'admin'];
const PROFILE_TO_USER_TYPE = {
  professor: 'professor',
  coordenador: 'coordenador',
  admin: 'admin'
};
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[#@$!%*?&])[A-Za-z\d#@$!%*?&]{8,}$/;
// JWT_SECRET é validado no middleware/auth.js

// POST /api/usuarios/registro - Register a new user (professor, coordenador, or admin)
router.post('/registro', async (req, res) => {
  try {
    const { nome, email, matricula, telefone, senha, foto_perfil, perfil } = req.body;

    // Validate required fields
    const missingFields = [];
    if (!nome) missingFields.push('nome');
    if (!email) missingFields.push('email');
    if (!matricula) missingFields.push('matricula');
    if (!senha) missingFields.push('senha');
    if (!perfil) missingFields.push('perfil');

    if (missingFields.length > 0) {
      return res.status(400).json({
        sucesso: false,
        erro: `Campos obrigatórios faltando: ${missingFields.join(', ')}`
      });
    }

    // Validate profile
    if (!VALID_PROFILES.includes(perfil)) {
      return res.status(400).json({
        sucesso: false,
        erro: `Perfil inválido. Deve ser um dos: ${VALID_PROFILES.join(', ')}`
      });
    }

    // Validate institutional email
    if (!email.endsWith('.edu.br')) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Por favor, use um e-mail institucional (.edu.br)'
      });
    }

    // Validate password strength
    if (!PASSWORD_REGEX.test(senha)) {
      return res.status(400).json({
        sucesso: false,
        erro: 'A senha deve conter: 8+ caracteres, 1 maiúscula, 1 minúscula, 1 número e 1 símbolo (#@$!%*?&)'
      });
    }

    // Check for existing user
    const existingUser = await db.query(
      'SELECT id FROM usuarios WHERE email = $1 OR matricula = $2 LIMIT 1',
      [email, matricula]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Email ou matrícula já cadastrados'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const senhaHash = await bcrypt.hash(senha, salt);

    // Determine user type based on profile
    const tipo_usuario = PROFILE_TO_USER_TYPE[perfil] || 'usuario';

    // Insert new user
    const { rows } = await db.query(
      `INSERT INTO usuarios (
        nome, email, matricula, telefone,
        senha_hash, foto_perfil, perfil,
        criado_em, tipo_usuario
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, datetime('now'), $8)
      RETURNING id, nome, email, matricula, telefone, foto_perfil, perfil, criado_em`,
      [
        nome,
        email,
        matricula,
        telefone,
        senhaHash,
        foto_perfil || null,
        perfil,
        tipo_usuario
      ]
    );

    return res.status(201).json({
      sucesso: true,
      usuario: rows[0],
      mensagem: 'Usuário cadastrado com sucesso!'
    });

  } catch (err) {
    console.error('Erro ao registrar usuário:', err);

    // Handle specific PostgreSQL errors
    if (err.code === '23514') { // check constraint violation
      return res.status(400).json({
        sucesso: false,
        erro: 'Violação de regra de negócio. Verifique os valores informados.'
      });
    }

    if (err.code === '23505') { // unique violation
      return res.status(400).json({
        sucesso: false,
        erro: 'Dados duplicados (email ou matrícula já existentes)'
      });
    }

    // Generic error response
    return res.status(500).json({
      sucesso: false,
      erro: process.env.NODE_ENV === 'development' ? 
        `${err.message} (${err.code || 'N/A'})` : 
        'Erro interno no servidor'
    });
  }
});

// POST /api/usuarios/login - User authentication
router.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body;

    // 1. Find the user by email
    const { rows } = await db.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    const usuario = rows[0];

    if (!usuario) {
      return res.status(401).json({ sucesso: false, erro: 'Credenciais inválidas' });
    }

    // 2. Compare the provided password with the stored hash
    const match = await bcrypt.compare(senha, usuario.senha_hash);

    if (!match) {
      return res.status(401).json({ sucesso: false, erro: 'Credenciais inválidas' });
    }

    // 3. If passwords match, generate a JWT token
    const token = generateToken(
      { userId: usuario.id, email: usuario.email, perfil: usuario.perfil },
      '1h'
    );

    // 4. Return the user info and the token
    return res.json({
      sucesso: true,
      mensagem: 'Login bem-sucedido!',
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil
      }
    });

  } catch (err) {
    console.error('Erro ao autenticar usuário:', err);
    console.error('Stack:', err.stack);
    return res.status(500).json({
      sucesso: false,
      erro: 'Erro interno do servidor',
      detalhes: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Rotas públicas (antes do middleware de autenticação)
// POST /api/usuarios/registro e POST /api/usuarios/login são públicas

// Aplicar autenticação em todas as rotas abaixo
router.use(authenticateToken);

// GET /api/usuarios - List all users with pagination
router.get('/', async (req, res) => {
  try {
    const { limit = 100, offset = 0, busca = '' } = req.query;

    // Main query with search and pagination
    const usuariosQuery = await db.query(
      `SELECT 
        id, nome, email, matricula, telefone, 
        foto_perfil, perfil, criado_em, tipo_usuario
       FROM usuarios
       WHERE nome ILIKE $1 OR email ILIKE $1 OR matricula ILIKE $1
       ORDER BY criado_em DESC
       LIMIT $2 OFFSET $3`,
      [`%${busca}%`, limit, offset]
    );

    // Count query for pagination
    const countQuery = await db.query(
      'SELECT COUNT(*) FROM usuarios WHERE nome ILIKE $1 OR email ILIKE $1 OR matricula ILIKE $1',
      [`%${busca}%`]
    );

    return res.json({
      sucesso: true,
      total: parseInt(countQuery.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset),
      usuarios: usuariosQuery.rows
    });

  } catch (err) {
    console.error('Erro ao listar usuários:', err);
    return res.status(500).json({
      sucesso: false,
      erro: 'Erro interno ao listar usuários'
    });
  }
});

// GET /api/usuarios/:id - Get a specific user by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await db.query(
      `SELECT 
        id, nome, email, matricula, telefone, 
        foto_perfil, perfil, criado_em, tipo_usuario
       FROM usuarios
       WHERE id = $1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        sucesso: false,
        erro: 'Usuário não encontrado'
      });
    }

    return res.json({
      sucesso: true,
      usuario: rows[0]
    });

  } catch (err) {
    console.error('Erro ao buscar usuário:', err);

    if (err.code === '22P02') { // invalid UUID
      return res.status(400).json({
        sucesso: false,
        erro: 'ID do usuário inválido'
      });
    }

    return res.status(500).json({
      sucesso: false,
      erro: 'Erro interno ao buscar usuário'
    });
  }
});

module.exports = router;
