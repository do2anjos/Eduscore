const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Disciplinas
 *   description: Gestão de disciplinas acadêmicas
 */

// GET /api/disciplinas - Lista básica de disciplinas (público)
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT id, nome 
      FROM disciplinas 
      ORDER BY nome
    `);

    res.json({
      sucesso: true,
      total: rows.length,
      disciplinas: rows
    });

  } catch (err) {
    console.error('Erro ao listar disciplinas:', err);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro ao carregar disciplinas',
      detalhes: process.env.NODE_ENV === 'development' 
        ? err.message 
        : undefined
    });
  }
});

// Aplicar autenticação em rotas de modificação
router.post('/', authenticateToken, async (req, res) => {
  const { nome } = req.body;

  if (!nome) {
    return res.status(400).json({
      sucesso: false,
      erro: 'Nome da disciplina é obrigatório'
    });
  }

  try {
    const { rows } = await db.query(
      `INSERT INTO disciplinas (nome) 
       VALUES ($1) 
       RETURNING id, nome`,
      [nome]
    );

    res.status(201).json({
      sucesso: true,
      disciplina: rows[0]
    });

  } catch (err) {
    console.error('Erro ao criar disciplina:', err);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro ao criar disciplina',
      detalhes: process.env.NODE_ENV === 'development' 
        ? err.message 
        : undefined
    });
  }
});

// GET /api/disciplinas/estatisticas - Estatísticas completas
router.get('/estatisticas', async (req, res) => {
  try {
    // 1. Total de disciplinas
    const totalDisciplinas = await db.query(
      'SELECT COUNT(*) FROM disciplinas'
    );

    // 2. Disciplinas mais ativas (com mais questões)
    const maisAtivas = await db.query(`
      SELECT d.id, d.nome, COUNT(q.id) as total_questoes
      FROM disciplinas d
      LEFT JOIN questoes q ON d.id = q.disciplina_id
      GROUP BY d.id
      ORDER BY total_questoes DESC
      LIMIT 5
    `);

    res.json({
      sucesso: true,
      total: Number(totalDisciplinas.rows[0].count),
      mais_ativas: maisAtivas.rows.map(row => ({
        ...row,
        total_questoes: Number(row.total_questoes)
      }))
    });

  } catch (err) {
    console.error('Erro ao buscar estatísticas:', err);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro ao carregar estatísticas'
    });
  }
});

// GET /api/disciplinas/:id/relatorio - Relatório por disciplina
router.get('/:id/relatorio', async (req, res) => {
  const { id } = req.params;

  try {
    // 1. Verifica se disciplina existe
    const disciplina = await db.query(
      'SELECT id, nome FROM disciplinas WHERE id = $1', 
      [id]
    );

    if (disciplina.rows.length === 0) {
      return res.status(404).json({
        sucesso: false,
        erro: 'Disciplina não encontrada'
      });
    }

    // 2. Busca métricas
    const metricas = await db.query(`
      SELECT
        COUNT(q.id) AS total_questoes,
        COUNT(DISTINCT r.id) AS total_respostas,
        ROUND(
          AVG(CASE WHEN r.acertou THEN 1 ELSE 0 END) * 100, 2
        ) AS percentual_acertos
      FROM questoes q
      LEFT JOIN respostas r ON q.id = r.questao_id
      WHERE q.disciplina_id = $1
    `, [id]);

    res.json({
      sucesso: true,
      disciplina: disciplina.rows[0],
      metricas: {
        ...metricas.rows[0],
        total_questoes: Number(metricas.rows[0].total_questoes),
        total_respostas: Number(metricas.rows[0].total_respostas)
      }
    });

  } catch (err) {
    console.error('Erro no relatório:', err);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro ao gerar relatório'
    });
  }
});

module.exports = router;