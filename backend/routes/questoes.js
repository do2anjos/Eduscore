const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Aplicar autenticação em todas as rotas
router.use(authenticateToken);

// GET /api/questoes - listar todas as questões
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT id, gabarito_id, numero, resposta_correta FROM questoes ORDER BY gabarito_id, numero');
    res.json({ sucesso: true, total: rows.length, questoes: rows });
  } catch (err) {
    console.error('Erro ao buscar questões:', err);
    res.status(500).json({ sucesso: false, erro: 'Erro ao buscar questões' });
  }
});

// GET /api/questoes/:gabarito_id - listar questões de um gabarito
router.get('/:gabarito_id', async (req, res) => {
  const { gabarito_id } = req.params;
  try {
    const { rows } = await db.query(
      'SELECT id, numero, resposta_correta FROM questoes WHERE gabarito_id = $1 ORDER BY numero',
      [gabarito_id]
    );
    res.json({ sucesso: true, total: rows.length, questoes: rows });
  } catch (err) {
    console.error('Erro ao buscar questões:', err);
    res.status(500).json({ sucesso: false, erro: 'Erro ao buscar questões' });
  }
});

// POST /api/questoes - cadastrar uma nova questão
router.post('/', async (req, res) => {
  const { gabarito_id, numero, resposta_correta } = req.body;
  try {
    const { rows } = await db.query(
      `INSERT INTO questoes (gabarito_id, numero, resposta_correta)
       VALUES ($1, $2, $3) RETURNING *`,
      [gabarito_id, numero, resposta_correta]
    );
    res.status(201).json({ sucesso: true, questao: rows[0] });
  } catch (err) {
    console.error('Erro ao cadastrar questão:', err);
    res.status(500).json({ sucesso: false, erro: 'Erro ao cadastrar questão', detalhes: err.message });
  }
});

// PUT /api/questoes/:id - atualizar uma questão
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { numero, resposta_correta } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE questoes SET numero = $1, resposta_correta = $2 WHERE id = $3 RETURNING *`,
      [numero, resposta_correta, id]
    );
    if (rows.length === 0) return res.status(404).json({ erro: 'Questão não encontrada' });
    res.json({ sucesso: true, questao: rows[0] });
  } catch (err) {
    console.error('Erro ao atualizar questão:', err);
    res.status(500).json({ sucesso: false, erro: 'Erro ao atualizar questão', detalhes: err.message });
  }
});

// DELETE /api/questoes/:id - deletar uma questão
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await db.query('DELETE FROM questoes WHERE id = $1', [id]);
    if (rowCount === 0) return res.status(404).json({ erro: 'Questão não encontrada' });
    res.json({ sucesso: true, mensagem: 'Questão removida com sucesso' });
  } catch (err) {
    console.error('Erro ao deletar questão:', err);
    res.status(500).json({ sucesso: false, erro: 'Erro ao deletar questão', detalhes: err.message });
  }
});

module.exports = router;
