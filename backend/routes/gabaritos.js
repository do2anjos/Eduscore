const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
const { authenticateToken } = require('../middleware/auth');
const { withTransaction } = require('../utils/transaction');

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

    // Processar CSV
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          if (!row.numero || !row.resposta_correta) {
            reject(new Error('Formato do CSV inválido - cada linha deve ter numero e resposta_correta'));
          }
          questions.push({
            numero: row.numero,
            resposta_correta: row.resposta_correta,
            disciplina_id: row.disciplina_id || null
          });
        })
        .on('end', resolve)
        .on('error', reject);
    });

    // Inserir questões em transação
    await withTransaction(async (db) => {
      for (const q of questions) {
        await db.query(
          `INSERT INTO questoes (gabarito_id, numero, resposta_correta, disciplina_id)
           VALUES ($1, $2, $3, $4)`,
          [gabarito_id, q.numero, q.resposta_correta, q.disciplina_id]
        );
      }
    });
    
    res.json({ 
      sucesso: true,
      mensagem: 'Questões importadas com sucesso',
      total: questions.length
    });
  } catch (err) {
    console.error('Erro ao processar CSV:', err);
    
    res.status(500).json({ 
      sucesso: false,
      erro: 'Erro ao processar arquivo CSV',
      detalhes: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  } finally {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath); // Remove o arquivo após processar
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