const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Função para formatar a resposta dos relatórios
const formatRelatorio = (relatorio) => ({
  id: relatorio.id,
  sessao_id: relatorio.sessao_id,
  etapa: relatorio.etapa,
  media_geral: relatorio.media_geral,
  grafico_linha: relatorio.grafico_linha,
  grafico_coluna: relatorio.grafico_coluna,
  data_geracao: relatorio.data_geracao,
  aluno: {
    id: relatorio.aluno_id,
    nome: relatorio.aluno_nome
  },
  disciplina: {
    id: relatorio.disciplina_id,
    nome: relatorio.disciplina_nome
  }
});

// GET /api/relatorios - Listar relatórios
router.get('/', async (req, res) => {
  try {
    const { sessao_id, etapa, aluno_id, disciplina_id } = req.query;

    let query = `
      SELECT 
        r.id, 
        r.sessao_id, 
        r.etapa, 
        r.media_geral, 
        r.grafico_linha, 
        r.grafico_coluna, 
        r.data_geracao,
        s.aluno_id, 
        a.nome_completo AS aluno_nome,
        s.disciplina_id, 
        d.nome AS disciplina_nome
      FROM relatorios r
      JOIN sessoes s ON r.sessao_id = s.id
      JOIN alunos a ON s.aluno_id = a.id
      JOIN disciplinas d ON s.disciplina_id = d.id
    `;

    const filters = [];
    const params = [];

    if (sessao_id) {
      filters.push(`r.sessao_id = $${params.length + 1}`);
      params.push(sessao_id);
    }
    if (etapa) {
      filters.push(`r.etapa = $${params.length + 1}`);
      params.push(etapa);
    }
    if (aluno_id) {
      filters.push(`s.aluno_id = $${params.length + 1}`);
      params.push(aluno_id);
    }
    if (disciplina_id) {
      filters.push(`s.disciplina_id = $${params.length + 1}`);
      params.push(disciplina_id);
    }

    if (filters.length > 0) {
      query += ` WHERE ${filters.join(' AND ')}`;
    }

    query += ` ORDER BY r.data_geracao DESC`;

    const { rows } = await db.query(query, params);

    res.json({
      sucesso: true,
      total: rows.length,
      relatorios: rows.map(formatRelatorio)
    });

  } catch (err) {
    console.error('Erro ao listar relatórios:', err);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno ao listar relatórios'
    });
  }
});

// POST /api/relatorios - Criar novo relatório (requer autenticação)
router.post('/', authenticateToken, async (req, res) => {
  const { sessao_id, etapa, media_geral, grafico_linha, grafico_coluna } = req.body;

  // Validação dos campos obrigatórios
  if (!sessao_id || !etapa || !media_geral) {
    return res.status(400).json({
      sucesso: false,
      erro: 'Campos obrigatórios faltando: sessao_id, etapa, media_geral'
    });
  }

  try {
    const { rows } = await db.query(
      `INSERT INTO relatorios 
       (sessao_id, etapa, media_geral, grafico_linha, grafico_coluna, data_geracao)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id, sessao_id, etapa, media_geral, grafico_linha, grafico_coluna, data_geracao`,
      [
        sessao_id, 
        etapa, 
        media_geral, 
        grafico_linha || null, 
        grafico_coluna || null
      ]
    );

    // Obter dados completos do relatório
    const relatorioCompleto = await db.query(
      `SELECT 
        r.id, 
        r.sessao_id, 
        r.etapa, 
        r.media_geral, 
        r.grafico_linha, 
        r.grafico_coluna, 
        r.data_geracao,
        s.aluno_id, 
        a.nome_completo AS aluno_nome,
        s.disciplina_id, 
        d.nome AS disciplina_nome
      FROM relatorios r
      JOIN sessoes s ON r.sessao_id = s.id
      JOIN alunos a ON s.aluno_id = a.id
      JOIN disciplinas d ON s.disciplina_id = d.id
      WHERE r.id = $1`,
      [rows[0].id]
    );

    res.status(201).json({
      sucesso: true,
      relatorio: formatRelatorio(relatorioCompleto.rows[0])
    });

  } catch (err) {
    console.error('Erro ao criar relatório:', err);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno ao criar relatório'
    });
  }
});

// DELETE /api/relatorios/:id - Remover relatório (requer autenticação)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { rowCount } = await db.query(
      'DELETE FROM relatorios WHERE id = $1',
      [id]
    );

    if (rowCount === 0) {
      return res.status(404).json({
        sucesso: false,
        erro: 'Relatório não encontrado'
      });
    }

    res.json({
      sucesso: true,
      mensagem: 'Relatório removido com sucesso'
    });

  } catch (err) {
    console.error('Erro ao remover relatório:', err);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno ao remover relatório'
    });
  }
});

module.exports = router;