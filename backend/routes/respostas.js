const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const { authenticateToken } = require('../middleware/auth');
const { generateUUID } = require('../db');
const { garantirDisciplinaQuestao } = require('../utils/disciplinaClassifier');

const execAsync = promisify(exec);

/**
 * @swagger
 * tags:
 *   name: Respostas
 *   description: Gerenciamento de respostas dos alunos
 */

// Aplicar autenticação em todas as rotas
router.use(authenticateToken);

// Garantir que o diretório de uploads de imagens existe
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configuração do multer para upload de imagens
const storageImagens = multer.diskStorage({
  destination: (req, file, cb) => {
    const imagensDir = path.join(uploadsDir, 'imagens');
    if (!fs.existsSync(imagensDir)) {
      fs.mkdirSync(imagensDir, { recursive: true });
    }
    cb(null, imagensDir);
  },
  filename: (req, file, cb) => {
    cb(null, `resposta_${Date.now()}${path.extname(file.originalname)}`);
  }
});

const uploadImagem = multer({ 
  storage: storageImagens,
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Apenas arquivos de imagem são permitidos'), false);
    }
    cb(null, true);
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // Limite de 10MB para imagens
  }
});

// Rota GET /api/respostas - Lista todas as respostas
router.get('/', async (req, res) => {
  try {
    const { aluno_id, gabarito_id, questao_id } = req.query;
    let query = `
      SELECT id, aluno_id, questao_id, gabarito_id, resposta_aluno, acertou, data_resposta
      FROM respostas
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (aluno_id) {
      query += ` AND aluno_id = $${paramIndex++}`;
      params.push(aluno_id);
    }
    if (gabarito_id) {
      query += ` AND gabarito_id = $${paramIndex++}`;
      params.push(gabarito_id);
    }
    if (questao_id) {
      query += ` AND questao_id = $${paramIndex++}`;
      params.push(questao_id);
    }

    query += ` ORDER BY data_resposta DESC`;

    const { rows } = await db.query(query, params);
    res.status(200).json({
      sucesso: true,
      total: rows.length,
      respostas: rows
    });
  } catch (err) {
    console.error('Erro ao buscar respostas:', err);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro ao buscar respostas',
      detalhes: err.message
    });
  }
});

// Rota POST /api/respostas - Cria uma nova resposta
router.post('/', async (req, res) => {
  const { aluno_id, questao_id, gabarito_id, resposta_aluno, acertou } = req.body;

  // Validação dos campos obrigatórios
  // resposta_aluno pode ser string vazia (indica não marcado)
  // acertou deve ser boolean
  if (!aluno_id || !questao_id || !gabarito_id || resposta_aluno === undefined || typeof acertou !== 'boolean') {
    return res.status(400).json({ 
      sucesso: false,
      erro: 'Dados incompletos',
      detalhes: 'Todos os campos são obrigatórios (aluno_id, questao_id, gabarito_id, resposta_aluno, acertou). resposta_aluno pode ser string vazia para indicar não marcado.'
    });
  }
  
  // Normalizar resposta_aluno (garantir string, mesmo que vazia)
  const respostaNormalizada = resposta_aluno !== null && resposta_aluno !== undefined 
    ? String(resposta_aluno).trim() 
    : '';

  // Validar dupla marcação: se resposta contém vírgula, é dupla marcação
  const temDuplaMarcacao = respostaNormalizada.includes(',');
  const estaVazia = respostaNormalizada === '';
  
  // Se houver dupla marcação, garantir que acertou seja false (inválida)
  // Se estiver vazia, também é false (não marcado)
  let acertouValidado = acertou;
  if (temDuplaMarcacao || estaVazia) {
    acertouValidado = false;
  }

  // Converter acertou para inteiro (SQLite armazena como INTEGER: 0 ou 1)
  const acertouInt = acertouValidado ? 1 : 0;

  try {
    // Garantir que a questão tem disciplina_id (classificar automaticamente se necessário)
    const questaoInfo = await db.query(
      `SELECT numero, disciplina_id FROM questoes WHERE id = $1`,
      [questao_id]
    );

    if (questaoInfo.rows.length === 0) {
      return res.status(404).json({
        sucesso: false,
        erro: 'Questão não encontrada'
      });
    }

    const numeroQuestao = questaoInfo.rows[0].numero;
    const disciplinaIdAtual = questaoInfo.rows[0].disciplina_id;

    // Se a questão não tem disciplina_id, classificar automaticamente
    if (!disciplinaIdAtual) {
      await garantirDisciplinaQuestao(questao_id, numeroQuestao);
      console.log(`[RESPOSTAS] Disciplina classificada automaticamente para questão ${numeroQuestao} (ID: ${questao_id})`);
    }

    // Verificar se já existe uma resposta para esta combinação
    const existing = await db.query(
      `SELECT id FROM respostas 
       WHERE aluno_id = $1 AND questao_id = $2 AND gabarito_id = $3`,
      [aluno_id, questao_id, gabarito_id]
    );

    let rows;
    
    if (existing.rows.length > 0) {
      // Atualizar resposta existente
      const respostaId = existing.rows[0].id;
      await db.query(
        `UPDATE respostas 
         SET resposta_aluno = $1, acertou = $2, data_resposta = datetime('now')
         WHERE id = $3`,
        [respostaNormalizada, acertouInt, respostaId]
      );
      // Buscar resposta atualizada (SQLite não suporta RETURNING em UPDATE)
      rows = await db.query(
        `SELECT id, aluno_id, questao_id, gabarito_id, resposta_aluno, acertou, data_resposta
         FROM respostas
         WHERE id = $1`,
        [respostaId]
      );
    } else {
      // Inserir nova resposta
      const respostaId = generateUUID();
      rows = await db.query(
        `INSERT INTO respostas 
         (id, aluno_id, questao_id, gabarito_id, resposta_aluno, acertou, data_resposta)
         VALUES ($1, $2, $3, $4, $5, $6, datetime('now'))
         RETURNING id, aluno_id, questao_id, gabarito_id, resposta_aluno, acertou, data_resposta`,
        [respostaId, aluno_id, questao_id, gabarito_id, respostaNormalizada, acertouInt]
      );
    }

    res.status(201).json({
      sucesso: true,
      resposta: rows.rows[0]
    });
  } catch (err) {
    console.error('Erro ao criar resposta:', err);
    console.error('Detalhes do erro:', {
      aluno_id,
      questao_id,
      gabarito_id,
      resposta_aluno: respostaNormalizada,
      acertou: acertouInt,
      erro: err.message,
      stack: err.stack
    });
    res.status(500).json({
      sucesso: false,
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
      return res.status(404).json({ 
        sucesso: false,
        erro: 'Resposta não encontrada' 
      });
    }

    res.status(200).json({
      sucesso: true,
      resposta: rows[0]
    });
  } catch (err) {
    console.error('Erro ao buscar resposta:', err);
    res.status(500).json({
      sucesso: false,
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
      sucesso: false,
      erro: 'Dados incompletos',
      detalhes: 'resposta_aluno e acertou são obrigatórios'
    });
  }

  try {
    const { rows } = await db.query(
      `UPDATE respostas
       SET resposta_aluno = $1, acertou = $2, data_resposta = datetime('now')
       WHERE id = $3
       RETURNING id, aluno_id, questao_id, gabarito_id, resposta_aluno, acertou, data_resposta`,
      [resposta_aluno, acertou, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ 
        sucesso: false,
        erro: 'Resposta não encontrada' 
      });
    }

    res.status(200).json({
      sucesso: true,
      resposta: rows[0]
    });
  } catch (err) {
    console.error('Erro ao atualizar resposta:', err);
    res.status(500).json({
      sucesso: false,
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
      return res.status(404).json({ 
        sucesso: false,
        erro: 'Resposta não encontrada' 
      });
    }

    res.status(200).json({ 
      sucesso: true, 
      mensagem: 'Resposta removida com sucesso',
      resposta: rows[0]
    });
  } catch (err) {
    console.error('Erro ao remover resposta:', err);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro ao remover resposta',
      detalhes: err.message
    });
  }
});

/**
 * Função auxiliar para detectar o tipo de imagem (processada ou original)
 */
async function detectarTipoImagem(imagemPath) {
  const scriptDetecao = path.join(__dirname, '../scripts/detectar_tipo_imagem.py');
  
  if (!fs.existsSync(scriptDetecao)) {
    console.log('[PROCESSAR-IMAGEM] Script de detecção não encontrado, usando script original por padrão');
    return 'original'; // Fallback: assume que precisa de processamento
  }

  try {
    const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';
    const scriptPathNormalizado = path.resolve(scriptDetecao).replace(/\\/g, '/');
    const imagemPathNormalizado = path.resolve(imagemPath).replace(/\\/g, '/');
    
    const comando = `${pythonCommand} "${scriptPathNormalizado}" "${imagemPathNormalizado}"`;
    
    const { stdout, stderr } = await execAsync(comando, {
      maxBuffer: 10 * 1024 * 1024,
      encoding: 'utf8'
    });

    if (stderr && stderr.trim()) {
      console.log('[PROCESSAR-IMAGEM] Stderr da detecção:', stderr);
    }

    // Parsear JSON retornado
    const jsonMatch = stdout.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const resultado = JSON.parse(jsonMatch[0]);
      if (resultado.sucesso && resultado.tipo) {
        console.log(`[PROCESSAR-IMAGEM] Imagem detectada como: ${resultado.tipo}`);
        return resultado.tipo;
      }
    }
    
    console.log('[PROCESSAR-IMAGEM] Detecção falhou, usando script original por padrão');
    return 'original'; // Fallback
  } catch (error) {
    console.error('[PROCESSAR-IMAGEM] Erro ao detectar tipo de imagem:', error.message);
    console.log('[PROCESSAR-IMAGEM] Usando script original por padrão');
    return 'original'; // Fallback: em caso de erro, usa o script completo
  }
}

/**
 * Função auxiliar para executar o script de processamento
 */
async function executarScriptProcessamento(scriptPath, imagemPath) {
  const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';
  const scriptPathNormalizado = path.resolve(scriptPath).replace(/\\/g, '/');
  const imagemPathNormalizado = path.resolve(imagemPath).replace(/\\/g, '/');
  
  const comando = `${pythonCommand} "${scriptPathNormalizado}" "${imagemPathNormalizado}"`;
  
  const { stdout, stderr } = await execAsync(comando, {
    maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    encoding: 'utf8'
  });
  
  // Processar stderr
  if (stderr && stderr.trim()) {
    console.log('[PROCESSAR-IMAGEM] Stderr do Python:', stderr);
  }

  // Parsear JSON retornado pelo script
  const jsonMatch = stdout.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Resposta do Python não contém JSON válido');
  }
  
  const resultadoPython = JSON.parse(jsonMatch[0]);
  
  if (!resultadoPython.sucesso) {
    throw new Error(resultadoPython.erro || 'Erro no processamento Python');
  }
  
  return resultadoPython;
}

/**
 * Rota POST /api/respostas/processar-imagem
 * Processa uma imagem de folha de resposta e extrai as marcações
 * 
 * A detecção automática decide qual script usar:
 * - processar_respostas_Imagem_original.py: para imagens que precisam de correção de perspectiva
 * - processar_respostas_imagem_processadas.py: para imagens já processadas
 */
router.post('/processar-imagem', uploadImagem.single('imagem'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        sucesso: false,
        erro: 'Imagem é obrigatória' 
      });
    }

    const imagemPath = req.file.path;
    const imagemFilename = req.file.filename;

    // 1. Detectar o tipo de imagem (processada ou original)
    console.log('[PROCESSAR-IMAGEM] Detectando tipo de imagem...');
    const tipoImagem = await detectarTipoImagem(imagemPath);

    // 2. Escolher o script apropriado baseado na detecção
    let scriptPath;
    if (tipoImagem === 'processada') {
      scriptPath = path.join(__dirname, '../scripts/processar_respostas_imagem_processadas.py');
      console.log('[PROCESSAR-IMAGEM] Usando script para imagens processadas');
    } else {
      scriptPath = path.join(__dirname, '../scripts/processar_respostas_Imagem_original.py');
      console.log('[PROCESSAR-IMAGEM] Usando script para imagens originais (com correção de perspectiva)');
    }

    // 3. Verificar se o script existe
    if (!fs.existsSync(scriptPath)) {
      throw new Error(`Script de processamento Python não encontrado em: ${scriptPath}`);
    }

    let respostasExtraidas = [];
    let detalhesProcessamento = {};

    try {
      // 4. Executar o script de processamento apropriado
      const resultadoPython = await executarScriptProcessamento(scriptPath, imagemPath);

      // 5. Extrair respostas do formato retornado
      respostasExtraidas = resultadoPython.respostas || [];
      detalhesProcessamento = {
        total_bolhas_detectadas: resultadoPython.total_bolhas_detectadas || 0,
        questoes_com_dupla_marcacao: resultadoPython.questoes_com_dupla_marcacao || 0,
        questoes_sem_marcacao: resultadoPython.questoes_sem_marcacao || 0,
        questoes_validas: resultadoPython.questoes_validas || 0,
        questoes_invalidas_detalhes: resultadoPython.questoes_invalidas_detalhes || [],
        avisos: resultadoPython.avisos || [],
        tipo_imagem_detectado: tipoImagem,
        script_utilizado: tipoImagem === 'processada' ? 'processar_respostas_imagem_processadas.py' : 'processar_respostas_Imagem_original.py'
      };

    } catch (execError) {
      console.error('[PROCESSAR-IMAGEM] Erro ao executar script Python:', execError);
      
      // Se for erro de execução (Python não encontrado, etc.)
      if (execError.code === 'ENOENT' || execError.message.includes('python')) {
        throw new Error('Python não encontrado. Certifique-se de que Python está instalado e no PATH.');
      }
      
      // Se for erro de processamento (arquivo não encontrado, etc.)
      if (execError.stderr || execError.message.includes('Erro')) {
        const erroPython = execError.stderr || execError.message;
        throw new Error(`Erro no processamento da imagem: ${erroPython}`);
      }
      
      throw execError;
    }
    
    // Construir mensagem com informações sobre dupla marcação e questões em branco
    let mensagem = respostasExtraidas.length > 0 
      ? `Imagem processada com sucesso! ${respostasExtraidas.length} respostas extraídas.`
      : 'Imagem processada, mas nenhuma resposta foi encontrada.';
    
    if (detalhesProcessamento.questoes_com_dupla_marcacao > 0) {
      mensagem += ` ⚠ ${detalhesProcessamento.questoes_com_dupla_marcacao} questão(ões) com dupla marcação (inválidas).`;
    }
    
    if (detalhesProcessamento.questoes_sem_marcacao > 0) {
      mensagem += ` ○ ${detalhesProcessamento.questoes_sem_marcacao} questão(ões) em branco.`;
    }

    // Retornar resposta com as respostas extraídas
    res.status(200).json({
      sucesso: true,
      mensagem: mensagem,
      imagem: {
        nome: imagemFilename,
        caminho: imagemPath,
        tamanho: req.file.size
      },
      respostas: respostasExtraidas,
      total_respostas: respostasExtraidas.length,
      detalhes: detalhesProcessamento
    });

  } catch (err) {
    console.error('Erro ao processar imagem:', err);
    
    // Limpar arquivo se houver erro
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkErr) {
        console.error('Erro ao remover arquivo:', unlinkErr);
      }
    }

    res.status(500).json({
      sucesso: false,
      erro: 'Erro ao processar imagem',
      detalhes: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

module.exports = router;