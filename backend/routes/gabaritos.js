const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
const { authenticateToken } = require('../middleware/auth');
const { withTransaction } = require('../utils/transaction');
const { generateUUID } = require('../db');
const { obterDisciplinaIdPorNumero } = require('../utils/disciplinaClassifier');

// Aplicar autenticação em todas as rotas
router.use(authenticateToken);

// Garantir que o diretório de uploads existe
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configuração do multer para upload de arquivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'text/csv') {
      return cb(new Error('Apenas arquivos CSV são permitidos'), false);
    }
    cb(null, true);
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // Limite de 5MB
  }
});

// Rota POST /api/gabaritos - Cadastrar novo gabarito
router.post('/', async (req, res) => {
  const { nome, etapa } = req.body;

  if (!nome || !etapa) {
    return res.status(400).json({ 
      sucesso: false,
      erro: 'Nome e etapa são obrigatórios' 
    });
  }

  try {
    const { rows } = await db.query(
      `INSERT INTO gabaritos (nome, etapa) 
       VALUES ($1, $2) 
       RETURNING id, nome, etapa, criado_em`,
      [nome, etapa]
    );
    
    res.status(201).json({ 
      sucesso: true,
      mensagem: 'Gabarito cadastrado com sucesso',
      gabarito: rows[0]
    });
  } catch (err) {
    console.error('Erro ao cadastrar gabarito:', err);
    res.status(500).json({ 
      sucesso: false,
      erro: 'Erro ao cadastrar gabarito',
      detalhes: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Rota POST /api/gabaritos/upload - Upload de CSV com questões
router.post('/upload', upload.single('file'), async (req, res) => {
  const { gabarito_id } = req.body;

  if (!req.file || !gabarito_id) {
    return res.status(400).json({ 
      sucesso: false,
      erro: 'Arquivo e ID do gabarito são obrigatórios' 
    });
  }

  const filePath = req.file.path;
  const questions = [];

  try {
    // Verificar se gabarito existe
    const gabaritoCheck = await db.query(
      'SELECT id FROM gabaritos WHERE id = $1', 
      [gabarito_id]
    );
    
    if (gabaritoCheck.rows.length === 0) {
      fs.unlinkSync(filePath); // Remove o arquivo
      return res.status(404).json({ 
        sucesso: false,
        erro: 'Gabarito não encontrado' 
      });
    }

    // Função helper para normalizar nomes de colunas (case-insensitive)
    const normalizeColumnName = (row, possibleNames) => {
      // Primeiro tenta busca exata (mais rápido)
      for (const name of possibleNames) {
        if (row.hasOwnProperty(name)) {
          return row[name];
        }
      }
      
      // Se não encontrou, faz busca case-insensitive
      const rowKeys = Object.keys(row);
      const normalizedPossibleNames = possibleNames.map(n => n.toLowerCase().trim());
      
      for (const key of rowKeys) {
        const normalizedKey = key.toLowerCase().trim();
        if (normalizedPossibleNames.includes(normalizedKey)) {
          return row[key];
        }
      }
      
      return null;
    };

    // Detectar o separador do CSV (vírgula ou ponto e vírgula)
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const firstLine = fileContent.split('\n')[0];
    const hasSemicolon = firstLine.includes(';');
    const hasComma = firstLine.includes(',');
    
    // Priorizar ponto e vírgula se ambos existirem (padrão Excel/português)
    const separator = hasSemicolon ? ';' : (hasComma ? ',' : ';');
    
    // Ler os cabeçalhos da primeira linha para mapear índices
    const headers = firstLine.split(separator).map(h => h.trim().replace(/[\r\n]/g, ''));
    console.log('Cabeçalhos detectados:', headers);
    console.log('Separador detectado:', separator);
    
    // Mapear índices de colunas para nomes esperados (fallback se cabeçalhos não forem reconhecidos)
    const getColumnIndex = (searchTerms) => {
      for (const term of searchTerms) {
        const index = headers.findIndex(h => 
          h.toLowerCase().trim() === term.toLowerCase().trim() ||
          h.toLowerCase().trim().includes(term.toLowerCase().trim()) ||
          term.toLowerCase().trim().includes(h.toLowerCase().trim())
        );
        if (index !== -1) return index;
      }
      return -1;
    };
    
    const numeroIndex = getColumnIndex(['questão', 'questao', 'numero', 'número', 'num']);
    const respostaIndex = getColumnIndex(['resposta', 'resposta_correta', 'resp']);
    const disciplinaIndex = getColumnIndex(['disciplina', 'disciplina_id', 'disciplina id']);
    
    console.log('Índices detectados:', { numeroIndex, respostaIndex, disciplinaIndex });
    
    // Processar CSV - aceita tanto cabeçalhos em português quanto em inglês
    // Aceita tanto vírgula (,) quanto ponto e vírgula (;) como separador
    await new Promise((resolve, reject) => {
      let linha = 0;
      fs.createReadStream(filePath)
        .pipe(csv({
          separator: separator,
          skipLinesWithError: false,
          skipEmptyLines: true,
          headers: true,
          mapHeaders: ({ header }) => header.trim().replace(/[\r\n]/g, '') // Remove espaços e quebras de linha
        }))
        .on('data', (row) => {
          linha++;
          
          // Normalizar nomes das colunas (aceita português e inglês, case-insensitive)
          let numero = normalizeColumnName(row, [
            'numero', 'Numero', 'NÚMERO', 'numero_questao',
            'Questão', 'Questao', 'questão', 'questao',
            'Número', 'número'
          ]);
          
          let resposta = normalizeColumnName(row, [
            'resposta_correta', 'Resposta_correta', 'RESPOSTA_CORRETA',
            'Resposta', 'resposta', 'RESPOSTA',
            'respostaCorreta', 'Resposta Correta', 'resposta correta'
          ]);
          
          // Se não encontrou pelos nomes, tenta pelos índices (fallback)
          const rowKeys = Object.keys(row);
          const rowValues = Object.values(row);
          
          if (!numero && numeroIndex >= 0 && rowValues[numeroIndex]) {
            numero = rowValues[numeroIndex];
          } else if (!numero && rowKeys.includes('_0')) {
            numero = row['_0'] || row[0];
          }
          
          if (!resposta && respostaIndex >= 0 && rowValues[respostaIndex]) {
            resposta = rowValues[respostaIndex];
          } else if (!resposta && rowKeys.includes('_1')) {
            resposta = row['_1'] || row[1];
          }
          
          const disciplinaId = normalizeColumnName(row, [
            'disciplina_id', 'Disciplina_id', 'disciplinaId',
            'Disciplina ID', 'disciplina id', 'Disciplina', 'disciplina'
          ]) || (disciplinaIndex >= 0 && rowValues[disciplinaIndex] ? rowValues[disciplinaIndex] : null);
          
          // Validar campos obrigatórios
          if (!numero || !resposta) {
            const camposEncontrados = Object.keys(row).join(', ');
            const valoresEncontrados = Object.values(row).slice(0, 3).join(', ');
            reject(new Error(
              `Formato do CSV inválido na linha ${linha + 1} - cada linha deve ter 'numero' (ou 'Questão') e 'resposta_correta' (ou 'Resposta'). ` +
              `Campos encontrados: ${camposEncontrados}. ` +
              `Primeiros valores: ${valoresEncontrados}. ` +
              `Valores: numero=${numero}, resposta=${resposta}`
            ));
            return;
          }
          
          const numeroQuestao = parseInt(numero) || numero;

          // Armazenar disciplina_id do CSV se fornecido, senão será classificado depois
          questions.push({
            numero: numeroQuestao,
            resposta_correta: resposta.trim().toUpperCase(), // Normalizar para maiúsculas
            disciplina_id: disciplinaId ? parseInt(disciplinaId) : null // Será classificado depois se NULL
          });
        })
        .on('end', () => {
          if (questions.length === 0) {
            reject(new Error('CSV está vazio ou não contém dados válidos'));
            return;
          }

          // Classificar automaticamente questões que não têm disciplina_id
          // Fazer isso de forma assíncrona antes de resolver a Promise
          (async () => {
            try {
              for (const q of questions) {
                if (!q.disciplina_id) {
                  const disciplinaId = await obterDisciplinaIdPorNumero(q.numero);
                  q.disciplina_id = disciplinaId;
                  
                  if (!disciplinaId) {
                    console.warn(`[GABARITO_UPLOAD] Não foi possível classificar automaticamente a questão ${q.numero}. A questão será criada sem disciplina_id.`);
                  } else {
                    // Buscar nome da disciplina para log
                    const disciplinaInfo = await db.query(
                      'SELECT nome FROM disciplinas WHERE id = $1',
                      [disciplinaId]
                    );
                    const nomeDisciplina = disciplinaInfo.rows[0]?.nome || 'Desconhecida';
                    console.log(`[GABARITO_UPLOAD] Questão ${q.numero} classificada automaticamente como: ${nomeDisciplina}`);
                  }
                }
              }
              resolve();
            } catch (err) {
              reject(err);
            }
          })();
        })
        .on('error', (err) => {
          reject(new Error(`Erro ao ler arquivo CSV: ${err.message}`));
        });
    });

    // Inserir questões em transação
    try {
      await withTransaction(async (db) => {
        for (const q of questions) {
          const questaoId = generateUUID();
          try {
            await db.query(
              `INSERT INTO questoes (id, gabarito_id, numero, resposta_correta, disciplina_id)
               VALUES ($1, $2, $3, $4, $5)`,
              [questaoId, gabarito_id, q.numero, q.resposta_correta, q.disciplina_id]
            );
          } catch (insertErr) {
            throw new Error(`Erro ao inserir questão número ${q.numero}: ${insertErr.message}`);
          }
        }
      });
    } catch (transactionErr) {
      throw new Error(`Erro na transação: ${transactionErr.message}`);
    }
    
    res.json({ 
      sucesso: true,
      mensagem: 'Questões importadas com sucesso',
      total: questions.length
    });
  } catch (err) {
    console.error('Erro ao processar CSV:', err);
    console.error('Stack trace:', err.stack);
    
    // Sempre retorna detalhes do erro em desenvolvimento ou para erros de validação
    const isValidationError = err.message.includes('Formato') || err.message.includes('vazio') || err.message.includes('linha');
    
    res.status(500).json({ 
      sucesso: false,
      erro: 'Erro ao processar arquivo CSV',
      detalhes: (process.env.NODE_ENV === 'development' || isValidationError) ? err.message : 'Verifique o formato do arquivo CSV'
    });
  } finally {
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath); // Remove o arquivo após processar
      } catch (unlinkErr) {
        console.error('Erro ao remover arquivo temporário:', unlinkErr);
      }
    }
  }
});

// Rota GET /api/gabaritos - Listar todos os gabaritos
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT g.id, g.nome, g.etapa, g.criado_em, 
              COUNT(q.id) as total_questoes
       FROM gabaritos g
       LEFT JOIN questoes q ON q.gabarito_id = g.id
       GROUP BY g.id
       ORDER BY g.criado_em DESC`
    );
    
    res.json({ 
      sucesso: true,
      total: rows.length,
      gabaritos: rows
    });
  } catch (err) {
    console.error('Erro ao listar gabaritos:', err);
    res.status(500).json({ 
      sucesso: false,
      erro: 'Erro ao listar gabaritos',
      detalhes: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Rota GET /api/gabaritos/:id - Obter gabarito específico
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const gabarito = await db.query(
      `SELECT id, nome, etapa, criado_em 
       FROM gabaritos 
       WHERE id = $1`,
      [id]
    );

    if (gabarito.rows.length === 0) {
      return res.status(404).json({ 
        sucesso: false,
        erro: 'Gabarito não encontrado' 
      });
    }

    const questoes = await db.query(
      `SELECT id, numero, resposta_correta, disciplina_id
       FROM questoes
       WHERE gabarito_id = $1
       ORDER BY numero`,
      [id]
    );

    res.json({
      sucesso: true,
      gabarito: {
        ...gabarito.rows[0],
        questoes: questoes.rows,
        total_questoes: questoes.rows.length
      }
    });
  } catch (err) {
    console.error('Erro ao buscar gabarito:', err);
    res.status(500).json({ 
      sucesso: false,
      erro: 'Erro ao buscar gabarito',
      detalhes: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Rota PUT /api/gabaritos/:id - Atualizar gabarito
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nome, etapa } = req.body;

  if (!nome || !etapa) {
    return res.status(400).json({ 
      sucesso: false,
      erro: 'Nome e etapa são obrigatórios' 
    });
  }

  try {
    const { rows } = await db.query(
      `UPDATE gabaritos 
       SET nome = $1, etapa = $2 
       WHERE id = $3
       RETURNING id, nome, etapa, criado_em`,
      [nome, etapa, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ 
        sucesso: false,
        erro: 'Gabarito não encontrado' 
      });
    }

    res.json({ 
      sucesso: true,
      mensagem: 'Gabarito atualizado com sucesso',
      gabarito: rows[0]
    });
  } catch (err) {
    console.error('Erro ao atualizar gabarito:', err);
    res.status(500).json({ 
      sucesso: false,
      erro: 'Erro ao atualizar gabarito',
      detalhes: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Rota DELETE /api/gabaritos/:id - Remover gabarito
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    let rowCount = 0;
    
    await withTransaction(async (db) => {
      // Primeiro remove as questões associadas
      await db.query(
        'DELETE FROM questoes WHERE gabarito_id = $1',
        [id]
      );
      
      // Depois remove o gabarito
      const result = await db.query(
        'DELETE FROM gabaritos WHERE id = $1',
        [id]
      );
      
      rowCount = result.rowCount;
    });

    if (rowCount === 0) {
      return res.status(404).json({ 
        sucesso: false,
        erro: 'Gabarito não encontrado' 
      });
    }

    res.json({ 
      sucesso: true,
      mensagem: 'Gabarito e questões associadas removidos com sucesso'
    });
  } catch (err) {
    console.error('Erro ao remover gabarito:', err);
    res.status(500).json({ 
      sucesso: false,
      erro: 'Erro ao remover gabarito',
      detalhes: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

module.exports = router;