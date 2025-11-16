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

// POST /api/usuarios/redefinir-senha - Redefinir senha por email (público)
router.post('/redefinir-senha', async (req, res) => {
  try {
    const { email, nova_senha } = req.body;

    if (!email || !nova_senha) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Email e nova senha são obrigatórios'
      });
    }

    // Validar força da senha
    if (!PASSWORD_REGEX.test(nova_senha)) {
      return res.status(400).json({
        sucesso: false,
        erro: 'A senha deve conter: 8+ caracteres, 1 maiúscula, 1 minúscula, 1 número e 1 símbolo (#@$!%*?&)'
      });
    }

    // Buscar usuário por email
    const { rows } = await db.query(
      'SELECT id FROM usuarios WHERE email = $1',
      [email]
    );

    if (rows.length === 0) {
      // Por segurança, não revelar se o email existe ou não
      return res.json({
        sucesso: true,
        mensagem: 'Se o email existir, a senha foi redefinida'
      });
    }

    // Hash da nova senha
    const salt = await bcrypt.genSalt(10);
    const novaSenhaHash = await bcrypt.hash(nova_senha, salt);

    // Atualizar senha
    await db.query(
      'UPDATE usuarios SET senha_hash = $1 WHERE id = $2',
      [novaSenhaHash, rows[0].id]
    );

    return res.json({
      sucesso: true,
      mensagem: 'Senha redefinida com sucesso'
    });

  } catch (err) {
    console.error('Erro ao redefinir senha:', err);
    return res.status(500).json({
      sucesso: false,
      erro: 'Erro interno ao redefinir senha'
    });
  }
});

// Rotas públicas (antes do middleware de autenticação)
// POST /api/usuarios/registro, POST /api/usuarios/login e POST /api/usuarios/redefinir-senha são públicas

// Aplicar autenticação em todas as rotas abaixo
router.use(authenticateToken);

// GET /api/usuarios/me - Get current user data
router.get('/me', async (req, res) => {
  try {
    const userId = req.user.userId;

    const { rows } = await db.query(
      `SELECT 
        id, nome, email, matricula, telefone, 
        foto_perfil, perfil, criado_em, tipo_usuario
       FROM usuarios
       WHERE id = $1`,
      [userId]
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
    console.error('Erro ao buscar dados do usuário:', err);
    return res.status(500).json({
      sucesso: false,
      erro: 'Erro interno ao buscar dados do usuário'
    });
  }
});

// GET /api/usuarios/:id/foto - Get user profile picture as image
router.get('/:id/foto', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar se o usuário está acessando sua própria foto ou é admin
    if (id !== req.user.userId && req.user.perfil !== 'admin') {
      return res.status(403).json({
        sucesso: false,
        erro: 'Você não tem permissão para acessar esta foto'
      });
    }

    const { rows } = await db.query(
      'SELECT foto_perfil FROM usuarios WHERE id = $1',
      [id]
    );

    console.log(`[DEBUG] Buscando foto para usuário ${id}`);
    console.log(`[DEBUG] Linhas encontradas: ${rows.length}`);
    
    if (rows.length === 0) {
      console.log(`[DEBUG] Usuário não encontrado`);
      return res.status(404).json({
        sucesso: false,
        erro: 'Usuário não encontrado'
      });
    }

    if (!rows[0].foto_perfil) {
      console.log(`[DEBUG] Foto não encontrada (NULL ou vazio)`);
      return res.status(404).json({
        sucesso: false,
        erro: 'Foto não encontrada'
      });
    }

    const fotoPerfil = rows[0].foto_perfil.trim();
    console.log(`[DEBUG] Foto encontrada. Tamanho: ${fotoPerfil.length} caracteres. Tipo: ${fotoPerfil.startsWith('data:') ? 'data URL' : fotoPerfil.length > 1000 ? 'base64 sem prefixo' : 'URL'}`);
    
    // Se for base64, converter para buffer e servir como imagem
    if (fotoPerfil.startsWith('data:image/')) {
      try {
        const base64Data = fotoPerfil.split(',')[1];
        if (!base64Data) {
          console.log('[DEBUG] Erro: base64Data vazio após split');
          return res.status(500).json({
            sucesso: false,
            erro: 'Erro ao processar foto'
          });
        }
        const buffer = Buffer.from(base64Data, 'base64');
        
        // Detectar tipo MIME
        let contentType = 'image/jpeg';
        if (fotoPerfil.includes('image/png')) {
          contentType = 'image/png';
        } else if (fotoPerfil.includes('image/gif')) {
          contentType = 'image/gif';
        } else if (fotoPerfil.includes('image/webp')) {
          contentType = 'image/webp';
        }
        
        console.log(`[DEBUG] Servindo foto como ${contentType}. Tamanho do buffer: ${buffer.length} bytes`);
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache por 1 hora
        return res.send(buffer);
      } catch (err) {
        console.error('[DEBUG] Erro ao processar base64:', err);
        return res.status(500).json({
          sucesso: false,
          erro: 'Erro ao processar foto'
        });
      }
    } 
    // Se for base64 sem prefixo, assumir JPEG
    else if (fotoPerfil.length > 1000 && !fotoPerfil.includes('/') && !fotoPerfil.includes('http') && !fotoPerfil.startsWith('/')) {
      try {
        const buffer = Buffer.from(fotoPerfil, 'base64');
        console.log(`[DEBUG] Servindo foto como JPEG (base64 sem prefixo). Tamanho do buffer: ${buffer.length} bytes`);
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.send(buffer);
      } catch (err) {
        console.error('[DEBUG] Erro ao processar base64 sem prefixo:', err);
        return res.status(500).json({
          sucesso: false,
          erro: 'Erro ao processar foto'
        });
      }
    }
    // Se for URL de arquivo, redirecionar ou servir arquivo
    else {
      // Se começa com /uploads, servir como arquivo estático
      if (fotoPerfil.startsWith('/uploads/') || fotoPerfil.startsWith('uploads/')) {
        const path = require('path');
        const fs = require('fs');
        const filePath = path.join(__dirname, '../../uploads', fotoPerfil.replace(/^\/?uploads\//, ''));
        
        if (fs.existsSync(filePath)) {
          return res.sendFile(filePath);
        }
      }
      
      return res.status(404).json({
        sucesso: false,
        erro: 'Foto não encontrada'
      });
    }

  } catch (err) {
    console.error('Erro ao buscar foto de perfil:', err);
    return res.status(500).json({
      sucesso: false,
      erro: 'Erro interno ao buscar foto de perfil'
    });
  }
});

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

// PUT /api/usuarios/:id/senha - Change user password (deve vir antes de /:id)
router.put('/:id/senha', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const { senha_atual, nova_senha } = req.body;

    // Verificar se o usuário está alterando sua própria senha ou é admin
    if (id !== userId && req.user.perfil !== 'admin') {
      return res.status(403).json({
        sucesso: false,
        erro: 'Você não tem permissão para alterar esta senha'
      });
    }

    // Permitir redefinição sem senha atual se for flag de redefinição
    const { redefinicao } = req.body;
    
    if (!redefinicao && !senha_atual) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Senha atual é obrigatória'
      });
    }

    if (!nova_senha) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Nova senha é obrigatória'
      });
    }

    // Validar força da nova senha
    if (!PASSWORD_REGEX.test(nova_senha)) {
      return res.status(400).json({
        sucesso: false,
        erro: 'A senha deve conter: 8+ caracteres, 1 maiúscula, 1 minúscula, 1 número e 1 símbolo (#@$!%*?&)'
      });
    }

    // Buscar usuário
    const { rows } = await db.query(
      'SELECT senha_hash FROM usuarios WHERE id = $1',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        sucesso: false,
        erro: 'Usuário não encontrado'
      });
    }

    // Verificar senha atual (exceto para admin ou redefinição)
    if (!redefinicao && req.user.perfil !== 'admin') {
      const match = await bcrypt.compare(senha_atual, rows[0].senha_hash);
      if (!match) {
        return res.status(401).json({
          sucesso: false,
          erro: 'Senha atual incorreta'
        });
      }
    }

    // Hash da nova senha
    const salt = await bcrypt.genSalt(10);
    const novaSenhaHash = await bcrypt.hash(nova_senha, salt);

    // Atualizar senha
    await db.query(
      'UPDATE usuarios SET senha_hash = $1 WHERE id = $2',
      [novaSenhaHash, id]
    );

    return res.json({
      sucesso: true,
      mensagem: 'Senha alterada com sucesso'
    });

  } catch (err) {
    console.error('Erro ao alterar senha:', err);
    return res.status(500).json({
      sucesso: false,
      erro: 'Erro interno ao alterar senha'
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

// PUT /api/usuarios/:id - Update user profile
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar se req.user existe (middleware de autenticação)
    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        sucesso: false,
        erro: 'Token de autenticação inválido ou expirado'
      });
    }
    
    const userId = req.user.userId;
    
    // Verificar se o usuário está atualizando seu próprio perfil ou é admin
    if (id !== userId && req.user.perfil !== 'admin') {
      return res.status(403).json({
        sucesso: false,
        erro: 'Você não tem permissão para atualizar este perfil'
      });
    }

    const { nome, telefone, foto_perfil } = req.body;
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (nome !== undefined) {
      updates.push(`nome = $${paramIndex++}`);
      values.push(nome);
    }

    if (telefone !== undefined) {
      updates.push(`telefone = $${paramIndex++}`);
      values.push(telefone);
    }

    if (foto_perfil !== undefined) {
      // Validar tamanho da foto base64 (máximo 300KB para evitar erro 431)
      const MAX_BASE64_SIZE = 300 * 1024; // 300KB
      
      // Se for base64 (começa com data: ou é string muito longa)
      if (typeof foto_perfil === 'string') {
        let base64Data = foto_perfil;
        
        // Se começa com data:image/, extrair apenas a parte base64
        if (foto_perfil.startsWith('data:image/')) {
          const commaIndex = foto_perfil.indexOf(',');
          if (commaIndex !== -1) {
            base64Data = foto_perfil.substring(commaIndex + 1);
          }
        }
        
        // Validar tamanho
        if (base64Data.length > MAX_BASE64_SIZE) {
          return res.status(400).json({
            sucesso: false,
            erro: 'A imagem é muito grande. Por favor, selecione uma imagem menor que 300KB.'
          });
        }
      }
      
      updates.push(`foto_perfil = $${paramIndex++}`);
      values.push(foto_perfil);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Nenhum campo para atualizar'
      });
    }

    values.push(id);

    // Debug: log para verificar o ID sendo usado
    console.log(`[DEBUG] Atualizando usuário com ID: ${id} (tipo: ${typeof id}), userId do token: ${userId} (tipo: ${typeof userId})`);
    console.log(`[DEBUG] Valores a serem atualizados:`, values);
    console.log(`[DEBUG] Query SQL: UPDATE usuarios SET ${updates.join(', ')} WHERE id = $${paramIndex}`);

    // Verificar se o usuário existe antes de tentar atualizar
    const checkUser = await db.query(
      'SELECT id FROM usuarios WHERE id = $1',
      [id]
    );
    
    if (checkUser.rows.length === 0) {
      console.log(`[DEBUG] Usuário com ID ${id} não encontrado no banco antes do UPDATE`);
      return res.status(404).json({
        sucesso: false,
        erro: `Usuário não encontrado. ID fornecido: ${id}`
      });
    }
    
    console.log(`[DEBUG] Usuário encontrado no banco. ID no banco: ${checkUser.rows[0].id}`);

    const { rows } = await db.query(
      `UPDATE usuarios 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, nome, email, matricula, telefone, foto_perfil, perfil, criado_em, tipo_usuario`,
      values
    );

    // Debug: verificar se foto_perfil foi atualizada
    if (foto_perfil !== undefined) {
      console.log(`[DEBUG] Foto_perfil sendo atualizada. Tamanho: ${foto_perfil.length} caracteres (${Math.round(foto_perfil.length / 1024)}KB)`);
      console.log(`[DEBUG] Primeiros 50 caracteres: ${foto_perfil.substring(0, 50)}...`);
    } else {
      console.log(`[DEBUG] Foto_perfil NÃO está sendo atualizada (undefined)`);
    }

    if (rows.length === 0) {
      // Verificar se o usuário existe antes de retornar 404
      const checkUser = await db.query(
        'SELECT id FROM usuarios WHERE id = $1',
        [id]
      );
      
      if (checkUser.rows.length === 0) {
        console.log(`[DEBUG] Usuário com ID ${id} não encontrado no banco de dados`);
        return res.status(404).json({
          sucesso: false,
          erro: 'Usuário não encontrado. Verifique se o ID está correto.'
        });
      } else {
        // Se o usuário existe mas o UPDATE não retornou linhas, pode ser um problema com os campos
        console.log(`[DEBUG] Usuário existe mas UPDATE não retornou linhas. Updates: ${updates.join(', ')}`);
        return res.status(500).json({
          sucesso: false,
          erro: 'Erro ao atualizar perfil. Tente novamente.'
        });
      }
    }

    // Debug: verificar se foto_perfil está na resposta
    if (rows[0].foto_perfil) {
      console.log(`[DEBUG] Foto_perfil retornada na resposta. Tamanho: ${rows[0].foto_perfil.length} caracteres (${Math.round(rows[0].foto_perfil.length / 1024)}KB)`);
      console.log(`[DEBUG] Primeiros 50 caracteres: ${rows[0].foto_perfil.substring(0, 50)}...`);
    } else {
      console.log(`[DEBUG] Foto_perfil NÃO está na resposta (NULL ou vazio)`);
    }

    return res.json({
      sucesso: true,
      mensagem: 'Perfil atualizado com sucesso',
      usuario: rows[0]
    });

  } catch (err) {
    console.error('Erro ao atualizar usuário:', err);
    console.error('Stack:', err.stack);
    console.error('Mensagem:', err.message);
    
    // Verificar se é erro de tamanho de campo no SQLite
    if (err.message && (err.message.includes('too large') || err.message.includes('string too long'))) {
      return res.status(400).json({
        sucesso: false,
        erro: 'A imagem é muito grande para ser armazenada. Por favor, selecione uma imagem menor.'
      });
    }
    
    // Verificar se é erro de tipo de dados
    if (err.message && (err.message.includes('type') || err.message.includes('datatype'))) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Erro ao processar os dados. Verifique os campos informados.'
      });
    }
    
    return res.status(500).json({
      sucesso: false,
      erro: process.env.NODE_ENV === 'development' 
        ? `Erro interno ao atualizar perfil: ${err.message}` 
        : 'Erro interno ao atualizar perfil. Tente novamente.'
    });
  }
});

// GET /api/usuarios/me/configuracoes - Get user settings
router.get('/me/configuracoes', async (req, res) => {
  try {
    const userId = req.user.userId;

    // Buscar configurações do usuário (pode ser uma tabela separada ou JSON no banco)
    // Por enquanto, vamos retornar valores padrão
    const { rows } = await db.query(
      `SELECT configuracoes FROM usuarios WHERE id = $1`,
      [userId]
    );

    let configuracoes = {
      notificacoesEmail: false,
      notificacoesRelatorios: true,
      notificacoesSessoes: true,
      tema: 'claro',
      idioma: 'pt-BR',
      itensPorPagina: 25,
      doisFatores: false
    };

    // Se houver configurações salvas, fazer parse
    if (rows.length > 0 && rows[0].configuracoes) {
      try {
        const saved = typeof rows[0].configuracoes === 'string' 
          ? JSON.parse(rows[0].configuracoes) 
          : rows[0].configuracoes;
        configuracoes = { ...configuracoes, ...saved };
      } catch (e) {
        console.error('Erro ao fazer parse das configurações:', e);
      }
    }

    return res.json({
      sucesso: true,
      configuracoes
    });

  } catch (err) {
    console.error('Erro ao buscar configurações:', err);
    return res.status(500).json({
      sucesso: false,
      erro: 'Erro interno ao buscar configurações'
    });
  }
});

// PUT /api/usuarios/me/configuracoes - Update user settings
router.put('/me/configuracoes', async (req, res) => {
  try {
    const userId = req.user.userId;
    const configuracoes = req.body;

    // Validar configurações
    const validConfig = {
      notificacoesEmail: Boolean(configuracoes.notificacoesEmail),
      notificacoesRelatorios: Boolean(configuracoes.notificacoesRelatorios),
      notificacoesSessoes: Boolean(configuracoes.notificacoesSessoes),
      tema: ['claro', 'escuro', 'auto'].includes(configuracoes.tema) ? configuracoes.tema : 'claro',
      idioma: ['pt-BR', 'en-US', 'es-ES'].includes(configuracoes.idioma) ? configuracoes.idioma : 'pt-BR',
      itensPorPagina: [10, 25, 50, 100].includes(parseInt(configuracoes.itensPorPagina)) ? parseInt(configuracoes.itensPorPagina) : 25,
      doisFatores: Boolean(configuracoes.doisFatores)
    };

    // Verificar se a tabela usuarios tem coluna configuracoes
    // Se não tiver, precisamos adicionar (por enquanto vamos usar uma abordagem simples)
    // Para SQLite, vamos salvar como TEXT JSON
    const configJson = JSON.stringify(validConfig);

    await db.query(
      `UPDATE usuarios SET configuracoes = $1 WHERE id = $2`,
      [configJson, userId]
    );

    return res.json({
      sucesso: true,
      mensagem: 'Configurações salvas com sucesso',
      configuracoes: validConfig
    });

  } catch (err) {
    console.error('Erro ao salvar configurações:', err);
    return res.status(500).json({
      sucesso: false,
      erro: 'Erro interno ao salvar configurações'
    });
  }
});

module.exports = router;
