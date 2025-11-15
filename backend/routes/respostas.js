const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Respostas
 *   description: Gerenciamento de respostas dos alunos
 */

// Aplicar autenticação em todas as rotas
router.use(authenticateToken);

// Rota GET /api/respostas - Lista todas as respostas
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT id, aluno_id, questao_id, gabarito_id, resposta_aluno, acertou, data_resposta
      FROM respostas
      ORDER BY data_resposta DESC
    `);
    res.status(200).json(rows);
  } catch (err) {
    console.error('Erro ao buscar respostas:', err);
    res.status(500).json({
      erro: 'Erro ao buscar respostas',
      detalhes: err.message
    });
  }
});

// Rota POST /api/respostas - Cria uma nova resposta
router.post('/', async (req, res) => {
  const { aluno_id, questao_id, gabarito_id, resposta_aluno, acertou } = req.body;

  // Validação dos campos obrigatórios
  if (!aluno_id || !questao_id || !gabarito_id || !resposta_aluno || typeof acertou !== 'boolean') {
    return res.status(400).json({ 
      erro: 'Dados incompletos',
      detalhes: 'Todos os campos são obrigatórios (aluno_id, questao_id, gabarito_id, resposta_aluno, acertou)'
    });
  }

  try {
    const { rows } = await db.query(
      `INSERT INTO respostas 
       (aluno_id, questao_id, gabarito_id, resposta_aluno, acertou, data_resposta)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id, aluno_id, questao_id, gabarito_id, resposta_aluno, acertou, data_resposta`,
      [aluno_id, questao_id, gabarito_id, resposta_aluno, acertou]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Erro ao criar resposta:', err);
    res.status(500).json({
      erro: 'Erro ao criar resposta',
      detalhes: err.message
    });
  }
});

// Rota GET /api/respostas/:id - Busca uma resposta específica
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const { rows } = await db.query(
      `SELECT id, aluno_id, questao_id, gabarito_id, resposta_aluno, acertou, data_resposta
       FROM respostas
       WHERE id = $1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ erro: 'Resposta não encontrada' });
    }

    res.status(200).json(rows[0]);
  } catch (err) {
    console.error('Erro ao buscar resposta:', err);
    res.status(500).json({
      erro: 'Erro ao buscar resposta',
      detalhes: err.message
    });
  }
});

// Rota PUT /api/respostas/:id - Atualiza uma resposta
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { resposta_aluno, acertou } = req.body;

  if (!resposta_aluno || typeof acertou !== 'boolean') {
    return res.status(400).json({ 
      erro: 'Dados incompletos',
      detalhes: 'resposta_aluno e acertou são obrigatórios'
    });
  }

  try {
    const { rows } = await db.query(
      `UPDATE respostas
       SET resposta_aluno = $1, acertou = $2, data_resposta = NOW()
       WHERE id = $3
       RETURNING id, aluno_id, questao_id, gabarito_id, resposta_aluno, acertou, data_resposta`,
      [resposta_aluno, acertou, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ erro: 'Resposta não encontrada' });
    }

    res.status(200).json(rows[0]);
  } catch (err) {
    console.error('Erro ao atualizar resposta:', err);
    res.status(500).json({
      erro: 'Erro ao atualizar resposta',
      detalhes: err.message
    });
  }
});

// Rota DELETE /api/respostas/:id - Remove uma resposta
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await db.query(
      `DELETE FROM respostas 
       WHERE id = $1
       RETURNING id, aluno_id, questao_id, gabarito_id, resposta_aluno, acertou, data_resposta`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ erro: 'Resposta não encontrada' });
    }

    res.status(200).json({ 
      sucesso: true, 
      mensagem: 'Resposta removida com sucesso',
      resposta: rows[0]
    });
  } catch (err) {
    console.error('Erro ao remover resposta:', err);
    res.status(500).json({
      erro: 'Erro ao remover resposta',
      detalhes: err.message
    });
  }
});

module.exports = router;