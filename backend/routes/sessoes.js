const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Função para formatar a resposta das sessões
const formatSession = (session) => ({
  id: session.id,
  etapa: session.etapa,
  data: session.data,
  hora: session.hora,
  aluno: {
    id: session.aluno_id,
    nome: session.aluno_nome || 'Aluno não encontrado'
  },
  disciplina: {
    id: session.disciplina_id,
    nome: session.disciplina_nome || 'Disciplina não encontrada'
  },
  coordenador: {
    id: session.usuario_id,
    nome: session.coordenador_nome || 'Coordenador não especificado'
  }
});

// Middleware para validar coordenador
const validateCoordenador = async (usuario_id) => {
  const result = await db.query(
    'SELECT id FROM usuarios WHERE id = $1 AND tipo_usuario = $2',
    [usuario_id, 'coordenador']
  );
  return result.rows.length > 0;
};

// GET /api/sessoes - Listar sessões com filtros (público para consulta)
router.get('/', async (req, res) => {
  try {
    const { 
      etapa, 
      aluno_id, 
      disciplina_id, 
      usuario_id,
      data_inicio, 
      data_fim,
      hora_inicio,
      hora_fim,
      limit = 100,
      offset = 0
    } = req.query;

    // Query principal com INNER JOIN para usuários
    let query = `
      SELECT 
        s.id, 
        s.etapa, 
        s.data,
        s.hora,
        s.aluno_id, 
        a.nome_completo AS aluno_nome,
        s.disciplina_id, 
        d.nome AS disciplina_nome,
        s.usuario_id, 
        u.nome AS coordenador_nome
      FROM sessoes s
      LEFT JOIN alunos a ON s.aluno_id = a.id
      LEFT JOIN disciplinas d ON s.disciplina_id = d.id
      LEFT JOIN usuarios u ON s.usuario_id = u.id
    `;

    const filters = [];
    const params = [];
    let paramIndex = 1;

    // Construção dinâmica dos filtros
    if (etapa) {
      filters.push(`s.etapa = $${paramIndex++}`);
      params.push(etapa);
    }
    if (aluno_id) {
      filters.push(`s.aluno_id = $${paramIndex++}`);
      params.push(aluno_id);
    }
    if (disciplina_id) {
      filters.push(`s.disciplina_id = $${paramIndex++}`);
      params.push(disciplina_id);
    }
    if (usuario_id) {
      filters.push(`s.usuario_id = $${paramIndex++}`);
      params.push(usuario_id);
    }
    if (data_inicio) {
      filters.push(`s.data >= $${paramIndex++}`);
      params.push(data_inicio);
    }
    if (data_fim) {
      filters.push(`s.data <= $${paramIndex++}`);
      params.push(data_fim);
    }
    if (hora_inicio) {
      filters.push(`s.hora >= $${paramIndex++}`);
      params.push(hora_inicio);
    }
    if (hora_fim) {
      filters.push(`s.hora <= $${paramIndex++}`);
      params.push(hora_fim);
    }

    if (filters.length > 0) {
      query += ` WHERE ${filters.join(' AND ')}`;
    }

    query += ` ORDER BY s.data DESC, s.hora DESC`;
    query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(parseInt(limit), parseInt(offset));

    // Query para contar o total de registros
    let countQuery = `SELECT COUNT(*) FROM sessoes s`;
    if (filters.length > 0) {
      countQuery += ` WHERE ${filters.join(' AND ')}`;
    }

    const [sessoesResult, countResult] = await Promise.all([
      db.query(query, params),
      db.query(countQuery, params.slice(0, -2))
    ]);

    res.json({
      sucesso: true,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset),
      sessoes: sessoesResult.rows.map(formatSession)
    });

  } catch (err) {
    console.error('Erro ao listar sessões:', err);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno ao listar sessões',
      detalhes: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// GET /api/sessoes/:id - Get a specific session by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await db.query(
      `SELECT 
        s.id, s.etapa, 
        s.data,
        s.hora,
        s.aluno_id, 
        a.nome_completo AS aluno_nome,
        s.disciplina_id, 
        d.nome AS disciplina_nome,
        s.usuario_id, 
        u.nome AS coordenador_nome
       FROM sessoes s
       LEFT JOIN alunos a ON s.aluno_id = a.id
       LEFT JOIN disciplinas d ON s.disciplina_id = d.id
       LEFT JOIN usuarios u ON s.usuario_id = u.id
       WHERE s.id = $1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        sucesso: false,
        erro: 'Sessão não encontrada'
      });
    }

    return res.json({
      sucesso: true,
      sessao: formatSession(rows[0])
    });

  } catch (err) {
    console.error('Erro ao buscar sessão:', err);
    return res.status(500).json({
      sucesso: false,
      erro: 'Erro interno ao buscar sessão'
    });
  }
});

// POST /api/sessoes - Criar nova sessão (requer autenticação)
router.post('/', authenticateToken, async (req, res) => {
  const { aluno_id, etapa, disciplina_id, data, hora, usuario_id } = req.body;

  // Validação dos campos obrigatórios
  const camposObrigatorios = { aluno_id, etapa, disciplina_id, data, hora, usuario_id };
  const camposFaltantes = Object.entries(camposObrigatorios)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (camposFaltantes.length > 0) {
    return res.status(400).json({
      sucesso: false,
      erro: `Campos obrigatórios faltando: ${camposFaltantes.join(', ')}`
    });
  }

  try {
    // Validar se o usuário é coordenador
    if (!await validateCoordenador(usuario_id)) {
      return res.status(403).json({
        sucesso: false,
        erro: 'Apenas coordenadores podem criar sessões'
      });
    }

    // Verificar se a data é válida
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Formato de data inválido. Use YYYY-MM-DD'
      });
    }

    // Verificar se a hora é válida
    if (!/^\d{2}:\d{2}$/.test(hora)) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Formato de hora inválido. Use HH:MM'
      });
    }

    // Verificar conflitos de horário
    const conflito = await db.query(
      `SELECT id FROM sessoes 
       WHERE data = $1 AND hora = $2
       AND (aluno_id = $3 OR disciplina_id = $4)`,
      [data, hora, aluno_id, disciplina_id]
    );

    if (conflito.rows.length > 0) {
      return res.status(409).json({
        sucesso: false,
        erro: 'Conflito de horário: aluno ou disciplina já possui sessão neste horário'
      });
    }

    // Inserir a nova sessão
    const { rows } = await db.query(
      `INSERT INTO sessoes 
       (aluno_id, etapa, disciplina_id, data, hora, usuario_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [aluno_id, etapa, disciplina_id, data, hora, usuario_id]
    );

    // Obter os detalhes completos da sessão criada
    const sessaoCompleta = await db.query(
      `SELECT 
         s.id, s.etapa, 
         s.data,
         s.hora,
         s.aluno_id, 
         a.nome_completo AS aluno_nome,
         s.disciplina_id, 
         d.nome AS disciplina_nome,
         s.usuario_id, 
         u.nome AS coordenador_nome
       FROM sessoes s
       LEFT JOIN alunos a ON s.aluno_id = a.id
       LEFT JOIN disciplinas d ON s.disciplina_id = d.id
       LEFT JOIN usuarios u ON s.usuario_id = u.id
       WHERE s.id = $1`,
      [rows[0].id]
    );

    res.status(201).json({
      sucesso: true,
      sessao: formatSession(sessaoCompleta.rows[0])
    });

  } catch (err) {
    console.error('Erro ao criar sessão:', err);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno ao criar sessão',
      detalhes: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// PUT /api/sessoes/:id - Update session (requer autenticação)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { aluno_id, etapa, disciplina_id, data, hora } = req.body;

    // Verificar se a sessão existe
    const sessaoCheck = await db.query(
      'SELECT usuario_id FROM sessoes WHERE id = $1',
      [id]
    );

    if (sessaoCheck.rows.length === 0) {
      return res.status(404).json({
        sucesso: false,
        erro: 'Sessão não encontrada'
      });
    }

    // Verificar permissões
    const usuarioAutorizado = await db.query(
      'SELECT id FROM usuarios WHERE id = $1 AND (tipo_usuario = $2 OR tipo_usuario = $3)',
      [req.user.userId, 'coordenador', 'admin']
    );

    if (usuarioAutorizado.rows.length === 0) {
      return res.status(403).json({
        sucesso: false,
        erro: 'Apenas coordenadores ou administradores podem editar sessões'
      });
    }

    // Construir query de atualização dinamicamente
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (aluno_id !== undefined) {
      updates.push(`aluno_id = $${paramIndex++}`);
      values.push(aluno_id);
    }
    if (etapa !== undefined) {
      updates.push(`etapa = $${paramIndex++}`);
      values.push(etapa);
    }
    if (disciplina_id !== undefined) {
      updates.push(`disciplina_id = $${paramIndex++}`);
      values.push(disciplina_id);
    }
    if (data !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
        return res.status(400).json({
          sucesso: false,
          erro: 'Formato de data inválido. Use YYYY-MM-DD'
        });
      }
      updates.push(`data = $${paramIndex++}`);
      values.push(data);
    }
    if (hora !== undefined) {
      if (!/^\d{2}:\d{2}$/.test(hora)) {
        return res.status(400).json({
          sucesso: false,
          erro: 'Formato de hora inválido. Use HH:MM'
        });
      }
      updates.push(`hora = $${paramIndex++}`);
      values.push(hora);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Nenhum campo para atualizar'
      });
    }

    values.push(id);

    await db.query(
      `UPDATE sessoes SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      values
    );

    // Buscar sessão atualizada
    const sessaoAtualizada = await db.query(
      `SELECT 
        s.id, s.etapa, 
        s.data,
        s.hora,
        s.aluno_id, 
        a.nome_completo AS aluno_nome,
        s.disciplina_id, 
        d.nome AS disciplina_nome,
        s.usuario_id, 
        u.nome AS coordenador_nome
       FROM sessoes s
       LEFT JOIN alunos a ON s.aluno_id = a.id
       LEFT JOIN disciplinas d ON s.disciplina_id = d.id
       LEFT JOIN usuarios u ON s.usuario_id = u.id
       WHERE s.id = $1`,
      [id]
    );

    return res.json({
      sucesso: true,
      mensagem: 'Sessão atualizada com sucesso',
      sessao: formatSession(sessaoAtualizada.rows[0])
    });

  } catch (err) {
    console.error('Erro ao atualizar sessão:', err);
    return res.status(500).json({
      sucesso: false,
      erro: 'Erro interno ao atualizar sessão'
    });
  }
});

// DELETE /api/sessoes/:id - Remover sessão (requer autenticação)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar se a sessão existe
    const sessao = await db.query(
      'SELECT usuario_id FROM sessoes WHERE id = $1',
      [id]
    );
    
    if (sessao.rows.length === 0) {
      return res.status(404).json({
        sucesso: false,
        erro: 'Sessão não encontrada'
      });
    }

    // Verificar se o usuário atual é o coordenador da sessão ou admin
    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        sucesso: false,
        erro: 'Informações de usuário não disponíveis'
      });
    }

    const usuarioAutorizado = await db.query(
      'SELECT id FROM usuarios WHERE id = $1 AND (tipo_usuario = $2 OR tipo_usuario = $3)',
      [req.user.userId, 'coordenador', 'admin']
    );

    if (usuarioAutorizado.rows.length === 0) {
      return res.status(403).json({
        sucesso: false,
        erro: 'Apenas o coordenador responsável ou administrador podem remover esta sessão'
      });
    }

    const { rowCount } = await db.query(
      'DELETE FROM sessoes WHERE id = $1',
      [id]
    );

    res.json({
      sucesso: true,
      mensagem: 'Sessão removida com sucesso'
    });

  } catch (err) {
    console.error('Erro ao remover sessão:', err);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno ao remover sessão',
      detalhes: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

module.exports = router;