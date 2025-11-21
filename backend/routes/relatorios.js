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

// GET /api/relatorios/estatisticas-gerais - Estatísticas gerais para o dashboard
router.get('/estatisticas-gerais', authenticateToken, async (req, res) => {
  try {
    const { etapa } = req.query; // Filtro opcional por etapa

    // Construir filtro de etapa para as queries
    let filtroEtapa = '';
    let paramsEtapa = [];
    if (etapa && etapa !== 'Geral') {
      filtroEtapa = 'AND g.etapa = $1';
      paramsEtapa = [etapa];
    }

    // 1. Total de questões aplicadas (contar questões únicas por gabarito que foi respondido)
    // Se 3 simulados foram aplicados, cada um com 60 questões = 180 questões totais
    // Não multiplica por número de alunos, apenas conta questões dos simulados aplicados
    // Conta questões únicas de gabaritos que têm pelo menos uma resposta
    let totalQuestoesQuery;
    if (etapa && etapa !== 'Geral') {
      // Modo por etapa: contar questões de gabaritos que têm respostas da etapa específica
      totalQuestoesQuery = `
        SELECT COUNT(DISTINCT q.id) as total 
        FROM questoes q
        INNER JOIN gabaritos g ON q.gabarito_id = g.id
        WHERE g.etapa = $1
          AND g.id IN (
            SELECT DISTINCT r.gabarito_id 
            FROM respostas r
            INNER JOIN gabaritos g2 ON r.gabarito_id = g2.id
            WHERE g2.etapa = $1
          )
      `;
    } else {
      // Modo Geral: contar questões de todos os gabaritos que têm respostas
      totalQuestoesQuery = `
        SELECT COUNT(DISTINCT q.id) as total 
        FROM questoes q
        INNER JOIN gabaritos g ON q.gabarito_id = g.id
        WHERE g.id IN (
          SELECT DISTINCT gabarito_id 
          FROM respostas
        )
      `;
    }
    const totalQuestoes = await db.query(totalQuestoesQuery, paramsEtapa);

    // 2. Total de acertos (com filtro de etapa se aplicável)
    // IMPORTANTE: Considerar apenas respostas válidas (não vazias e sem dupla marcação)
    let totalAcertosQuery;
    if (etapa && etapa !== 'Geral') {
      totalAcertosQuery = `
        SELECT COUNT(*) as total 
        FROM respostas r
        INNER JOIN gabaritos g ON r.gabarito_id = g.id
        WHERE r.acertou = 1 
          AND g.etapa = $1
          AND r.resposta_aluno IS NOT NULL 
          AND r.resposta_aluno != '' 
          AND r.resposta_aluno NOT LIKE '%,%'
      `;
    } else {
      totalAcertosQuery = `
        SELECT COUNT(*) as total 
        FROM respostas r 
        WHERE r.acertou = 1
          AND r.resposta_aluno IS NOT NULL 
          AND r.resposta_aluno != '' 
          AND r.resposta_aluno NOT LIKE '%,%'
      `;
    }
    const totalAcertos = await db.query(totalAcertosQuery, paramsEtapa);

    // 3. Média geral de acertos (com filtro de etapa se aplicável)
    // IMPORTANTE: Considerar apenas respostas válidas (não vazias e sem dupla marcação)
    let mediaGeralQuery;
    if (etapa && etapa !== 'Geral') {
      mediaGeralQuery = `
        SELECT ROUND(AVG(CASE 
          WHEN r.resposta_aluno IS NOT NULL 
            AND r.resposta_aluno != '' 
            AND r.resposta_aluno NOT LIKE '%,%'
            AND r.acertou = 1 
          THEN 100 
          ELSE 0 
        END), 2) as media
        FROM respostas r
        INNER JOIN gabaritos g ON r.gabarito_id = g.id
        WHERE g.etapa = $1
          AND r.resposta_aluno IS NOT NULL 
          AND r.resposta_aluno != '' 
          AND r.resposta_aluno NOT LIKE '%,%'
      `;
    } else {
      mediaGeralQuery = `
        SELECT ROUND(AVG(CASE 
          WHEN resposta_aluno IS NOT NULL 
            AND resposta_aluno != '' 
            AND resposta_aluno NOT LIKE '%,%'
            AND acertou = 1 
          THEN 100 
          ELSE 0 
        END), 2) as media
        FROM respostas
        WHERE resposta_aluno IS NOT NULL 
          AND resposta_aluno != '' 
          AND resposta_aluno NOT LIKE '%,%'
      `;
    }
    const mediaGeral = await db.query(mediaGeralQuery, paramsEtapa);

    // 4. Média por disciplina (contar questões únicas por gabarito, com filtro de etapa se aplicável)
    // IMPORTANTE: Para modo "Geral", considerar TODAS as questões dos gabaritos que o aluno respondeu
    // Para modo por etapa, considerar TODAS as questões da disciplina nessa etapa
    let mediaPorDisciplinaQuery;
    
    if (etapa && etapa !== 'Geral') {
      // Modo por etapa: contar todas as questões da disciplina nesta etapa
      // Mas contar como acerto apenas respostas válidas
      mediaPorDisciplinaQuery = `
        SELECT 
          d.id,
          d.nome,
          COUNT(DISTINCT q.id) as total_questoes,
          COUNT(DISTINCT CASE 
            WHEN r.resposta_aluno IS NOT NULL 
            AND r.resposta_aluno != '' 
            AND r.resposta_aluno NOT LIKE '%,%'
            THEN r.id
            ELSE NULL
          END) as total_respostas,
          SUM(CASE 
            WHEN r.resposta_aluno IS NOT NULL 
            AND r.resposta_aluno != '' 
            AND r.resposta_aluno NOT LIKE '%,%'
            AND r.acertou = 1 
            THEN 1 
            ELSE 0 
          END) as acertos,
          ROUND(
            (SUM(CASE 
              WHEN r.resposta_aluno IS NOT NULL 
              AND r.resposta_aluno != '' 
              AND r.resposta_aluno NOT LIKE '%,%'
              AND r.acertou = 1 
              THEN 1 
              ELSE 0 
            END) * 100.0) / NULLIF(COUNT(DISTINCT CASE 
              WHEN r.resposta_aluno IS NOT NULL 
              AND r.resposta_aluno != '' 
              AND r.resposta_aluno NOT LIKE '%,%'
              THEN r.id
              ELSE NULL
            END), 0),
            2
          ) as media
        FROM disciplinas d
        INNER JOIN questoes q ON d.id = q.disciplina_id
        INNER JOIN gabaritos g ON q.gabarito_id = g.id
        LEFT JOIN respostas r ON q.id = r.questao_id AND r.gabarito_id = g.id
        WHERE g.etapa = $1
          AND EXISTS (
            SELECT 1 FROM respostas r2 
            WHERE r2.gabarito_id = g.id 
              AND r2.resposta_aluno IS NOT NULL 
              AND r2.resposta_aluno != '' 
              AND r2.resposta_aluno NOT LIKE '%,%'
          )
        GROUP BY d.id, d.nome
        HAVING COUNT(DISTINCT CASE 
          WHEN r.resposta_aluno IS NOT NULL 
          AND r.resposta_aluno != '' 
          AND r.resposta_aluno NOT LIKE '%,%'
          THEN r.id
          ELSE NULL
        END) > 0
        ORDER BY media DESC
      `;
    } else {
      // Modo Geral: calcular MÉDIA DE ACERTOS e TAXA DE ERRO por Disciplina
      // IMPORTANTE: Usar COUNT(*) (não COUNT DISTINCT) para contar TODAS as respostas válidas
      // Similar ao cálculo de "Acertos Totais": COUNT(*) WHERE acertou = 1
      // media = Média de Acertos = (Acertos / Total de respostas válidas) * 100 (para RelatorioGeral.html)
      // taxa_erro = Taxa de Erro = (Erros / Total de respostas válidas) * 100 (para home.html)
      mediaPorDisciplinaQuery = `
        SELECT 
          d.id,
          d.nome,
          COUNT(DISTINCT q.id) as total_questoes,
          COUNT(CASE 
            WHEN r.resposta_aluno IS NOT NULL 
            AND r.resposta_aluno != '' 
            AND r.resposta_aluno NOT LIKE '%,%'
            THEN 1
            ELSE NULL
          END) as total_respostas,
          SUM(CASE 
            WHEN r.resposta_aluno IS NOT NULL 
            AND r.resposta_aluno != '' 
            AND r.resposta_aluno NOT LIKE '%,%'
            AND r.acertou = 1 
            THEN 1 
            ELSE 0 
          END) as acertos,
          SUM(CASE 
            WHEN r.resposta_aluno IS NOT NULL 
            AND r.resposta_aluno != '' 
            AND r.resposta_aluno NOT LIKE '%,%'
            AND r.acertou = 0 
            THEN 1 
            ELSE 0 
          END) as erros,
          -- Média de Acertos (para RelatorioGeral.html)
          ROUND(
            (SUM(CASE 
              WHEN r.resposta_aluno IS NOT NULL 
              AND r.resposta_aluno != '' 
              AND r.resposta_aluno NOT LIKE '%,%'
              AND r.acertou = 1 
              THEN 1 
              ELSE 0 
            END) * 100.0) / NULLIF(COUNT(CASE 
              WHEN r.resposta_aluno IS NOT NULL 
              AND r.resposta_aluno != '' 
              AND r.resposta_aluno NOT LIKE '%,%'
              THEN 1
              ELSE NULL
            END), 0),
            2
          ) as media,
          -- Taxa de Erro (para home.html)
          ROUND(
            (SUM(CASE 
              WHEN r.resposta_aluno IS NOT NULL 
              AND r.resposta_aluno != '' 
              AND r.resposta_aluno NOT LIKE '%,%'
              AND r.acertou = 0 
              THEN 1 
              ELSE 0 
            END) * 100.0) / NULLIF(COUNT(CASE 
              WHEN r.resposta_aluno IS NOT NULL 
              AND r.resposta_aluno != '' 
              AND r.resposta_aluno NOT LIKE '%,%'
              THEN 1
              ELSE NULL
            END), 0),
            2
          ) as taxa_erro
        FROM disciplinas d
        INNER JOIN questoes q ON d.id = q.disciplina_id
        INNER JOIN gabaritos g ON q.gabarito_id = g.id
        LEFT JOIN respostas r ON q.id = r.questao_id 
          AND r.gabarito_id = g.id
        WHERE EXISTS (
          SELECT 1 FROM respostas r2 
          WHERE r2.gabarito_id = g.id 
          AND r2.resposta_aluno IS NOT NULL 
          AND r2.resposta_aluno != '' 
          AND r2.resposta_aluno NOT LIKE '%,%'
        )
        GROUP BY d.id, d.nome
        HAVING COUNT(CASE 
          WHEN r.resposta_aluno IS NOT NULL 
          AND r.resposta_aluno != '' 
          AND r.resposta_aluno NOT LIKE '%,%'
          THEN 1
          ELSE NULL
        END) > 0
        ORDER BY media DESC
      `;
    }
    
    const mediaPorDisciplina = await db.query(mediaPorDisciplinaQuery, paramsEtapa);

    // 5. Disciplina com maior e menor média (garantir contagem correta sem duplicação)
    let disciplinasOrdenadasQuery;
    if (etapa && etapa !== 'Geral') {
      // Modo por etapa: filtrar por etapa
      disciplinasOrdenadasQuery = `
        SELECT 
          d.id,
          d.nome,
          ROUND(AVG(CASE WHEN r.acertou = 1 THEN 100 ELSE 0 END), 2) as media
        FROM disciplinas d
        INNER JOIN questoes q ON d.id = q.disciplina_id
        INNER JOIN gabaritos g ON q.gabarito_id = g.id
        INNER JOIN respostas r ON q.id = r.questao_id AND r.gabarito_id = g.id
        WHERE g.etapa = $1
        GROUP BY d.id, d.nome
        HAVING COUNT(DISTINCT r.id) > 0
        ORDER BY media DESC
      `;
    } else {
      // Modo Geral: todas as disciplinas
      disciplinasOrdenadasQuery = `
        SELECT 
          d.id,
          d.nome,
          ROUND(AVG(CASE WHEN r.acertou = 1 THEN 100 ELSE 0 END), 2) as media
        FROM disciplinas d
        INNER JOIN questoes q ON d.id = q.disciplina_id
        INNER JOIN respostas r ON q.id = r.questao_id
        GROUP BY d.id, d.nome
        HAVING COUNT(DISTINCT r.id) > 0
        ORDER BY media DESC
      `;
    }
    const disciplinasOrdenadas = await db.query(disciplinasOrdenadasQuery, paramsEtapa);

    const maiorMedia = disciplinasOrdenadas.rows[0] || { nome: 'N/A', media: 0 };
    const menorMedia = disciplinasOrdenadas.rows[disciplinasOrdenadas.rows.length - 1] || { nome: 'N/A', media: 0 };

    // 6. Estatísticas por etapa (turma) - contar questões únicas por gabarito
    // IMPORTANTE: Considerar apenas gabaritos que têm respostas válidas
    const estatisticasPorEtapa = await db.query(`
      SELECT 
        g.etapa,
        COUNT(DISTINCT q.id) as total_questoes,
        COUNT(DISTINCT CASE 
          WHEN r.resposta_aluno IS NOT NULL 
            AND r.resposta_aluno != '' 
            AND r.resposta_aluno NOT LIKE '%,%'
          THEN r.id
          ELSE NULL
        END) as total_respostas,
        SUM(CASE 
          WHEN r.resposta_aluno IS NOT NULL 
            AND r.resposta_aluno != '' 
            AND r.resposta_aluno NOT LIKE '%,%'
            AND r.acertou = 1 
          THEN 1 
          ELSE 0 
        END) as acertos,
        ROUND(AVG(CASE 
          WHEN r.resposta_aluno IS NOT NULL 
            AND r.resposta_aluno != '' 
            AND r.resposta_aluno NOT LIKE '%,%'
            AND r.acertou = 1 
          THEN 100 
          ELSE 0 
        END), 2) as media
      FROM gabaritos g
      LEFT JOIN questoes q ON g.id = q.gabarito_id
      LEFT JOIN respostas r ON q.id = r.questao_id AND r.gabarito_id = g.id
      WHERE g.etapa IS NOT NULL 
        AND g.etapa != ''
        AND EXISTS (
          SELECT 1 FROM respostas r2 
          WHERE r2.gabarito_id = g.id 
            AND r2.resposta_aluno IS NOT NULL 
            AND r2.resposta_aluno != '' 
            AND r2.resposta_aluno NOT LIKE '%,%'
        )
      GROUP BY g.etapa
      HAVING COUNT(DISTINCT q.id) > 0
    `);

    // 7. Total de simulados aplicados (gabaritos únicos que têm respostas)
    const totalSimuladosAplicados = await db.query(`
      SELECT COUNT(DISTINCT g.id) as total
      FROM gabaritos g
      WHERE EXISTS (
        SELECT 1 FROM respostas r WHERE r.gabarito_id = g.id
      )
    `);

    res.json({
      sucesso: true,
      estatisticas: {
        total_questoes: Number(totalQuestoes.rows[0].total) || 0,
        total_acertos: Number(totalAcertos.rows[0].total) || 0,
        media_geral: Number(mediaGeral.rows[0].media) || 0,
        total_simulados_aplicados: Number(totalSimuladosAplicados.rows[0].total) || 0,
        maior_media_disciplina: maiorMedia.nome,
        menor_media_disciplina: menorMedia.nome,
        media_por_disciplina: mediaPorDisciplina.rows.map(row => ({
          id: row.id,
          nome: row.nome,
          media: Number(row.media) || 0, // Média de Acertos (para RelatorioGeral.html)
          taxa_erro: Number(row.taxa_erro) || 0, // Taxa de Erro (para home.html)
          total_questoes: Number(row.total_questoes) || 0,
          total_respostas: Number(row.total_respostas) || 0,
          acertos: Number(row.acertos) || 0,
          erros: Number(row.erros) || 0
        })),
        por_etapa: estatisticasPorEtapa.rows.map(row => ({
          etapa: row.etapa,
          total_questoes: Number(row.total_questoes) || 0,
          total_respostas: Number(row.total_respostas) || 0,
          acertos: Number(row.acertos) || 0,
          media: Number(row.media) || 0
        }))
      }
    });

  } catch (err) {
    console.error('Erro ao buscar estatísticas gerais:', err);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno ao buscar estatísticas'
    });
  }
});

// GET /api/relatorios/estatisticas-individual/:aluno_id - Estatísticas individuais de um aluno
router.get('/estatisticas-individual/:aluno_id', authenticateToken, async (req, res) => {
  try {
    const { aluno_id } = req.params;

    // Verificar se o aluno existe
    const alunoCheck = await db.query(
      'SELECT id, nome_completo, matricula FROM alunos WHERE id = $1',
      [aluno_id]
    );

    if (alunoCheck.rows.length === 0) {
      return res.status(404).json({
        sucesso: false,
        erro: 'Aluno não encontrado'
      });
    }

    const aluno = alunoCheck.rows[0];

    // 1. Total de questões respondidas pelo aluno
    const totalQuestoes = await db.query(`
      SELECT COUNT(*) as total FROM respostas WHERE aluno_id = $1
    `, [aluno_id]);

    // 2. Total de acertos do aluno
    const totalAcertos = await db.query(`
      SELECT COUNT(*) as total FROM respostas WHERE aluno_id = $1 AND acertou = 1
    `, [aluno_id]);

    // 3. Taxa de acertos geral
    const taxaAcertos = await db.query(`
      SELECT ROUND(AVG(CASE WHEN acertou = 1 THEN 100 ELSE 0 END), 2) as taxa
      FROM respostas WHERE aluno_id = $1
    `, [aluno_id]);

    // 4. Média por disciplina - modo Geral para aluno individual
    // IMPORTANTE: Contar TODAS as questões dos gabaritos que o aluno respondeu
    // Mas contar como acerto apenas respostas válidas (não vazias e sem dupla marcação)
    const mediaPorDisciplina = await db.query(`
      SELECT 
        d.id,
        d.nome,
        COUNT(DISTINCT q.id) as total_questoes,
        COUNT(DISTINCT CASE 
          WHEN r.resposta_aluno IS NOT NULL 
          AND r.resposta_aluno != '' 
          AND r.resposta_aluno NOT LIKE '%,%'
          THEN r.id
          ELSE NULL
        END) as total_respostas,
        SUM(CASE 
          WHEN r.resposta_aluno IS NOT NULL 
          AND r.resposta_aluno != '' 
          AND r.resposta_aluno NOT LIKE '%,%'
          AND r.acertou = 1 
          THEN 1 
          ELSE 0 
        END) as acertos,
        ROUND(
          (SUM(CASE 
            WHEN r.resposta_aluno IS NOT NULL 
            AND r.resposta_aluno != '' 
            AND r.resposta_aluno NOT LIKE '%,%'
            AND r.acertou = 1 
            THEN 1 
            ELSE 0 
          END) * 100.0) / NULLIF(COUNT(DISTINCT q.id), 0),
          2
        ) as media
      FROM disciplinas d
      INNER JOIN questoes q ON d.id = q.disciplina_id
      INNER JOIN gabaritos g ON q.gabarito_id = g.id
      LEFT JOIN respostas r ON q.id = r.questao_id 
        AND r.gabarito_id = g.id
        AND r.aluno_id = $1
      WHERE EXISTS (
        SELECT 1 FROM respostas r2 
        WHERE r2.gabarito_id = g.id 
        AND r2.aluno_id = $1
        AND r2.resposta_aluno IS NOT NULL 
        AND r2.resposta_aluno != '' 
        AND r2.resposta_aluno NOT LIKE '%,%'
      )
      GROUP BY d.id, d.nome
      HAVING COUNT(DISTINCT q.id) > 0
      ORDER BY media DESC
    `, [aluno_id]);

    // 5. Disciplina com maior e menor média (garantir contagem correta sem duplicação)
    const disciplinasOrdenadas = await db.query(`
      SELECT 
        d.id,
        d.nome,
        ROUND(AVG(CASE WHEN r.acertou = 1 THEN 100 ELSE 0 END), 2) as media
      FROM disciplinas d
      INNER JOIN questoes q ON d.id = q.disciplina_id
      INNER JOIN respostas r ON q.id = r.questao_id AND r.aluno_id = $1
      GROUP BY d.id, d.nome
      HAVING COUNT(DISTINCT r.id) > 0
      ORDER BY media DESC
    `, [aluno_id]);

    const maiorMedia = disciplinasOrdenadas.rows[0] || { nome: 'N/A', media: 0 };
    const menorMedia = disciplinasOrdenadas.rows[disciplinasOrdenadas.rows.length - 1] || { nome: 'N/A', media: 0 };

    // 6. Desempenho ao longo do tempo (por data de resposta)
    const desempenhoTempo = await db.query(`
      SELECT 
        strftime('%Y-%m-%d', r.data_resposta) as data,
        COUNT(r.id) as total_questoes,
        SUM(CASE WHEN r.acertou = 1 THEN 1 ELSE 0 END) as acertos,
        ROUND(AVG(CASE WHEN r.acertou = 1 THEN 100 ELSE 0 END), 2) as media
      FROM respostas r
      WHERE r.aluno_id = $1
      GROUP BY strftime('%Y-%m-%d', r.data_resposta)
      ORDER BY data ASC
    `, [aluno_id]);

    // 7. Desempenho por gabarito (simulado)
    // Só mostrar simulados que têm pelo menos uma resposta válida (não vazia e sem dupla marcação)
    const desempenhoPorGabarito = await db.query(`
      SELECT 
        g.id,
        g.nome,
        g.etapa,
        COUNT(DISTINCT q.id) as total_questoes,
        COUNT(r.id) as total_respostas,
        SUM(CASE 
          WHEN r.resposta_aluno IS NOT NULL 
          AND r.resposta_aluno != '' 
          AND r.resposta_aluno NOT LIKE '%,%' 
          THEN 1 
          ELSE 0
        END) as questoes_capturadas,
        SUM(CASE WHEN r.acertou = 1 THEN 1 ELSE 0 END) as acertos,
        ROUND(AVG(CASE WHEN r.acertou = 1 THEN 100 ELSE 0 END), 2) as media,
        MAX(r.data_resposta) as data_ultima_resposta
      FROM gabaritos g
      INNER JOIN questoes q ON g.id = q.gabarito_id
      LEFT JOIN respostas r ON q.id = r.questao_id AND r.gabarito_id = g.id AND r.aluno_id = $1
      WHERE EXISTS (
        SELECT 1 FROM respostas r2 
        WHERE r2.gabarito_id = g.id 
        AND r2.aluno_id = $1
        AND r2.resposta_aluno IS NOT NULL 
        AND r2.resposta_aluno != '' 
        AND r2.resposta_aluno NOT LIKE '%,%'
      )
      GROUP BY g.id, g.nome, g.etapa
      HAVING SUM(CASE 
        WHEN r.resposta_aluno IS NOT NULL 
        AND r.resposta_aluno != '' 
        AND r.resposta_aluno NOT LIKE '%,%' 
        THEN 1 
        ELSE 0
      END) > 0
      ORDER BY data_ultima_resposta ASC
    `, [aluno_id]);

    res.json({
      sucesso: true,
      aluno: {
        id: aluno.id,
        nome: aluno.nome_completo,
        matricula: aluno.matricula
      },
      estatisticas: {
        total_questoes: Number(totalQuestoes.rows[0].total) || 0,
        total_acertos: Number(totalAcertos.rows[0].total) || 0,
        taxa_acertos: Number(taxaAcertos.rows[0].taxa) || 0,
        maior_media_disciplina: maiorMedia.nome,
        menor_media_disciplina: menorMedia.nome,
        media_por_disciplina: mediaPorDisciplina.rows.map(row => ({
          id: row.id,
          nome: row.nome,
          media: Number(row.media) || 0,
          total_questoes: Number(row.total_questoes) || 0,
          total_respostas: Number(row.total_respostas) || 0,
          acertos: Number(row.acertos) || 0
        })),
        desempenho_tempo: desempenhoTempo.rows.map(row => ({
          data: row.data,
          total_questoes: Number(row.total_questoes) || 0,
          acertos: Number(row.acertos) || 0,
          media: Number(row.media) || 0
        })),
        desempenho_por_gabarito: desempenhoPorGabarito.rows.map(row => ({
          id: row.id,
          nome: row.nome,
          etapa: row.etapa,
          total_questoes: Number(row.total_questoes) || 0,
          questoes_capturadas: Number(row.questoes_capturadas) || 0,
          acertos: Number(row.acertos) || 0,
          media: Number(row.media) || 0,
          data: row.data_ultima_resposta
        }))
      }
    });

  } catch (err) {
    console.error('Erro ao buscar estatísticas individuais:', err);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno ao buscar estatísticas'
    });
  }
});

// GET /api/relatorios/estatisticas-individual/:aluno_id/disciplinas/:gabarito_id - Desempenho por disciplina filtrado por gabarito
router.get('/estatisticas-individual/:aluno_id/disciplinas/:gabarito_id', authenticateToken, async (req, res) => {
  let aluno_id, gabarito_id;
  try {
    aluno_id = req.params.aluno_id;
    gabarito_id = req.params.gabarito_id;
    
    // Validar parâmetros
    if (!aluno_id || !gabarito_id) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Parâmetros aluno_id e gabarito_id são obrigatórios'
      });
    }

    // Verificar se o aluno existe
    const alunoCheck = await db.query(
      'SELECT id, nome_completo, matricula FROM alunos WHERE id = $1',
      [aluno_id]
    );

    if (alunoCheck.rows.length === 0) {
      return res.status(404).json({
        sucesso: false,
        erro: 'Aluno não encontrado'
      });
    }

    // Verificar se o gabarito existe
    const gabaritoCheck = await db.query(
      'SELECT id, nome, etapa FROM gabaritos WHERE id = $1',
      [gabarito_id]
    );

    if (gabaritoCheck.rows.length === 0) {
      return res.status(404).json({
        sucesso: false,
        erro: 'Gabarito não encontrado'
      });
    }

    // Verificar quantas respostas o aluno tem para este gabarito (para debug)
    const totalRespostasQuery = await db.query(`
      SELECT COUNT(*) as total_respostas
      FROM respostas
      WHERE aluno_id = $1 AND gabarito_id = $2
    `, [aluno_id, gabarito_id]);

    const respostasValidasQuery = await db.query(`
      SELECT COUNT(*) as total_validas
      FROM respostas
      WHERE aluno_id = $1 
        AND gabarito_id = $2
        AND resposta_aluno IS NOT NULL 
        AND resposta_aluno != '' 
        AND resposta_aluno NOT LIKE '%,%'
    `, [aluno_id, gabarito_id]);

    const totalQuestoesQuery = await db.query(`
      SELECT COUNT(*) as total_questoes
      FROM questoes
      WHERE gabarito_id = $1
    `, [gabarito_id]);

    console.log('[DEBUG] Estatísticas do simulado:', {
      aluno_id,
      gabarito_id,
      gabarito_nome: gabaritoCheck.rows[0].nome,
      gabarito_etapa: gabaritoCheck.rows[0].etapa,
      total_questoes_gabarito: totalQuestoesQuery.rows[0]?.total_questoes || 0,
      total_respostas_aluno: totalRespostasQuery.rows[0]?.total_respostas || 0,
      total_respostas_validas: respostasValidasQuery.rows[0]?.total_validas || 0
    });

    // Média por disciplina filtrado por gabarito e aluno
    // IMPORTANTE: Contar TODAS as questões da disciplina no gabarito (incluindo não respondidas/inválidas)
    // Mas contar como acerto apenas respostas válidas (não vazias e sem dupla marcação) que foram acertadas
    // Média = (acertos válidos / total de questões da disciplina) * 100
    const mediaPorDisciplina = await db.query(`
      SELECT 
        d.id,
        d.nome,
        COUNT(DISTINCT q.id) as total_questoes,
        COUNT(DISTINCT CASE 
          WHEN r.resposta_aluno IS NOT NULL 
          AND r.resposta_aluno != '' 
          AND r.resposta_aluno NOT LIKE '%,%'
          THEN r.id
          ELSE NULL
        END) as total_respostas,
        SUM(CASE 
          WHEN r.resposta_aluno IS NOT NULL 
          AND r.resposta_aluno != '' 
          AND r.resposta_aluno NOT LIKE '%,%'
          AND r.acertou = 1 
          THEN 1 
          ELSE 0 
        END) as acertos,
        ROUND(
          (SUM(CASE 
            WHEN r.resposta_aluno IS NOT NULL 
            AND r.resposta_aluno != '' 
            AND r.resposta_aluno NOT LIKE '%,%'
            AND r.acertou = 1 
            THEN 1 
            ELSE 0 
          END) * 100.0) / NULLIF(COUNT(DISTINCT q.id), 0),
          2
        ) as media
      FROM disciplinas d
      INNER JOIN questoes q ON d.id = q.disciplina_id
      LEFT JOIN respostas r ON q.id = r.questao_id 
        AND r.aluno_id = $1
        AND r.gabarito_id = $2
      WHERE q.gabarito_id = $2
      GROUP BY d.id, d.nome
      HAVING COUNT(DISTINCT q.id) > 0
      ORDER BY media DESC
    `, [aluno_id, gabarito_id]);

    console.log('[DEBUG] Disciplinas encontradas:', mediaPorDisciplina.rows.length);

    res.json({
      sucesso: true,
      gabarito: {
        id: gabaritoCheck.rows[0].id,
        nome: gabaritoCheck.rows[0].nome,
        etapa: gabaritoCheck.rows[0].etapa
      },
      media_por_disciplina: (mediaPorDisciplina.rows || []).map(row => ({
        id: row.id,
        nome: row.nome,
        media: Number(row.media) || 0,
        total_questoes: Number(row.total_questoes) || 0,
        total_respostas: Number(row.total_respostas) || 0,
        acertos: Number(row.acertos) || 0
      }))
    });

  } catch (err) {
    console.error('Erro ao buscar desempenho por disciplina:', err);
    console.error('Detalhes do erro:', {
      aluno_id,
      gabarito_id,
      message: err.message,
      stack: err.stack
    });
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno ao buscar desempenho por disciplina',
      detalhes: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// GET /api/relatorios/estatisticas-mensal - Evolução mensal (média de acertos somando todas as etapas)
router.get('/estatisticas-mensal', authenticateToken, async (req, res) => {
  try {
    // Buscar todos os meses que têm simulados e respostas, ordenados por mês
    const resultados = await db.query(`
      SELECT 
        strftime('%Y-%m', g.criado_em) AS mes,
        ROUND(AVG(CASE WHEN r.acertou = 1 THEN 100 ELSE 0 END), 2) AS media
      FROM gabaritos g
      LEFT JOIN respostas r ON r.gabarito_id = g.id
      WHERE g.criado_em IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM respostas r2 
          WHERE r2.gabarito_id = g.id
        )
      GROUP BY strftime('%Y-%m', g.criado_em)
      HAVING COUNT(r.id) > 0
      ORDER BY mes ASC
    `);

    const series = resultados.rows.map(row => ({
      mes: row.mes,
      media: Number(row.media) || 0
    }));

    res.json({ sucesso: true, series });
  } catch (err) {
    console.error('Erro ao buscar estatísticas mensais:', err);
    res.status(500).json({ sucesso: false, erro: 'Erro ao carregar estatísticas mensais' });
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
       VALUES ($1, $2, $3, $4, $5, datetime('now'))
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