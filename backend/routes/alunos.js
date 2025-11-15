const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Aplicar autenticação em todas as rotas
router.use(authenticateToken);

// GET /api/alunos - listar todos os alunos
router.get('/', async (req, res) => {
  try {
    // Consulta corrigida com base nas colunas da tabela
    const { rows } = await db.query('SELECT id, nome_completo, email, telefone_responsavel, data_nascimento, etapa, matricula FROM alunos');
    res.json({ sucesso: true, total: rows.length, alunos: rows });
  } catch (err) {
    console.error('Erro ao buscar alunos:', err);
    res.status(500).json({ sucesso: false, erro: 'Erro ao buscar alunos' });
  }
});

// POST /api/alunos - cadastrar novo aluno
router.post('/', async (req, res) => {
  const { nome_completo, email, telefone_responsavel, data_nascimento, etapa, matricula } = req.body;
  try {
    const { rows } = await db.query(
      `INSERT INTO alunos (nome_completo, email, telefone_responsavel, data_nascimento, etapa, matricula)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [nome_completo, email, telefone_responsavel, data_nascimento, etapa, matricula]
    );
    res.status(201).json({ sucesso: true, aluno: rows[0] });
  } catch (err) {
    console.error('Erro ao cadastrar aluno:', err);
    res.status(500).json({ sucesso: false, erro: 'Erro ao cadastrar aluno', detalhes: err.message });
  }
});

// PUT /api/alunos/:id - atualizar aluno
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nome_completo, email, telefone_responsavel, data_nascimento, etapa, matricula } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE alunos SET nome_completo = $1, email = $2, telefone_responsavel = $3, data_nascimento = $4, etapa = $5, matricula = $6
       WHERE id = $7 RETURNING *`,
      [nome_completo, email, telefone_responsavel, data_nascimento, etapa, matricula, id]
    );
    if (rows.length === 0) return res.status(404).json({ erro: 'Aluno não encontrado' });
    res.json({ sucesso: true, aluno: rows[0] });
  } catch (err) {
    console.error('Erro ao atualizar aluno:', err);
    res.status(500).json({ sucesso: false, erro: 'Erro ao atualizar aluno', detalhes: err.message });
  }
});

// DELETE /api/alunos/:id - deletar aluno
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await db.query('DELETE FROM alunos WHERE id = $1', [id]);
    if (rowCount === 0) return res.status(404).json({ erro: 'Aluno não encontrado' });
    res.json({ sucesso: true, mensagem: 'Aluno removido com sucesso' });
  } catch (err) {
    console.error('Erro ao deletar aluno:', err);
    res.status(500).json({ sucesso: false, erro: 'Erro ao deletar aluno', detalhes: err.message });
  }
});

module.exports = router;
