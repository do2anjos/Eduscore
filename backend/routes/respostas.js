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

// Diretório temporário para imagens (antes de finalizar correção)
const imagensTempDir = path.join(uploadsDir, 'imagens', 'temp');
if (!fs.existsSync(imagensTempDir)) {
  fs.mkdirSync(imagensTempDir, { recursive: true });
}

// Diretório permanente para imagens (após finalizar correção)
const imagensPermanenteDir = path.join(uploadsDir, 'imagens');
if (!fs.existsSync(imagensPermanenteDir)) {
  fs.mkdirSync(imagensPermanenteDir, { recursive: true });
}

// Configuração do multer para upload de imagens TEMPORÁRIAS
const storageImagensTemp = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, imagensTempDir);
  },
  filename: (req, file, cb) => {
    // Adicionar prefixo "temp_" e timestamp para identificar facilmente
    cb(null, `temp_resposta_${Date.now()}${path.extname(file.originalname)}`);
  }
});

// Configuração do multer para upload de imagens PERMANENTES (caso precise)
const storageImagens = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, imagensPermanenteDir);
  },
  filename: (req, file, cb) => {
    cb(null, `resposta_${Date.now()}${path.extname(file.originalname)}`);
  }
});

const uploadImagemTemp = multer({
  storage: storageImagensTemp,
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

// Rota GET /api/respostas/imagem/:aluno_id/:gabarito_id - Busca a imagem do cartão do aluno para um gabarito
// IMPORTANTE: Retorna APENAS imagens confirmadas (permanentes). 
// Imagens temporárias não são retornadas até que a correção seja finalizada.
router.get('/imagem/:aluno_id/:gabarito_id', async (req, res) => {
  try {
    const { aluno_id, gabarito_id } = req.params;

    // 1. Buscar a imagem confirmada na tabela imagens_cartoes (apenas imagens de correções finalizadas)
    const imagemQuery = await db.query(
      `SELECT caminho_imagem, nome_imagem, criado_em
       FROM imagens_cartoes 
       WHERE aluno_id = $1 AND gabarito_id = $2 
       ORDER BY criado_em DESC 
       LIMIT 1`,
      [aluno_id, gabarito_id]
    );

    if (imagemQuery.rows.length > 0) {
      const imagem = imagemQuery.rows[0];

      // Verificar se o arquivo permanente ainda existe
      const caminhoCompleto = path.join(__dirname, '../../', imagem.caminho_imagem);
      if (fs.existsSync(caminhoCompleto)) {
        // Retornar o caminho relativo da imagem
        const imagemPath = imagem.caminho_imagem.startsWith('/')
          ? imagem.caminho_imagem
          : `/uploads/imagens/${imagem.nome_imagem}`;

        return res.json({
          sucesso: true,
          imagem: imagemPath,
          nome: imagem.nome_imagem,
          criado_em: imagem.criado_em,
          confirmada: true // Imagem confirmada (correção finalizada)
        });
      } else {
        console.warn(`[IMAGEM] Arquivo permanente não encontrado: ${caminhoCompleto}`);
      }
    }

    // 2. Fallback: Buscar resposta mais recente e tentar encontrar imagem permanente pelo timestamp
    // Isso ajuda em casos onde a imagem foi movida mas não está na tabela ainda
    const respostaQuery = await db.query(
      `SELECT data_resposta 
       FROM respostas 
       WHERE aluno_id = $1 AND gabarito_id = $2 
       ORDER BY data_resposta DESC 
       LIMIT 1`,
      [aluno_id, gabarito_id]
    );

    if (respostaQuery.rows.length === 0) {
      return res.status(404).json({
        sucesso: false,
        erro: 'Nenhuma resposta encontrada para este aluno e gabarito'
      });
    }

    const dataResposta = respostaQuery.rows[0].data_resposta;
    const timestamp = new Date(dataResposta).getTime();

    // Buscar APENAS no diretório permanente (não no temporário)
    // Imagens temporárias NÃO devem aparecer até que a correção seja finalizada
    const imagensDir = path.join(uploadsDir, 'imagens');

    if (!fs.existsSync(imagensDir)) {
      return res.status(404).json({
        sucesso: false,
        erro: 'Diretório de imagens não encontrado'
      });
    }

    // Listar apenas imagens permanentes (sem prefixo temp_)
    const arquivos = fs.readdirSync(imagensDir);
    const imagens = arquivos.filter(arquivo =>
      arquivo.startsWith('resposta_') && // Sem prefixo temp_
      !arquivo.startsWith('temp_') && // Garantir que não é temporária
      /\.(jpg|jpeg|png|gif|webp)$/i.test(arquivo)
    );

    if (imagens.length === 0) {
      return res.status(404).json({
        sucesso: false,
        erro: 'Nenhuma imagem confirmada encontrada. A correção pode não ter sido finalizada ainda.'
      });
    }

    // Encontrar a imagem permanente mais próxima do timestamp da resposta
    let imagemMaisProxima = null;
    let menorDiferenca = Infinity;

    imagens.forEach(imagem => {
      const match = imagem.match(/resposta_(\d+)/);
      if (match) {
        const timestampImagem = parseInt(match[1]);
        const diferenca = Math.abs(timestampImagem - timestamp);

        // Considerar imagens processadas até 1 hora antes ou depois da resposta
        if (diferenca < 3600000 && diferenca < menorDiferenca) {
          menorDiferenca = diferenca;
          imagemMaisProxima = imagem;
        }
      }
    });

    if (!imagemMaisProxima) {
      return res.status(404).json({
        sucesso: false,
        erro: 'Nenhuma imagem confirmada encontrada próxima à data da resposta. A correção pode não ter sido finalizada ainda.'
      });
    }

    // Retornar o caminho relativo da imagem permanente
    const imagemPath = `/uploads/imagens/${imagemMaisProxima}`;

    res.json({
      sucesso: true,
      imagem: imagemPath,
      nome: imagemMaisProxima,
      confirmada: true // Imagem confirmada (permanente)
    });

  } catch (err) {
    console.error('Erro ao buscar imagem do cartão:', err);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro ao buscar imagem do cartão',
      detalhes: err.message
    });
  }
});

// Rota POST /api/respostas - Cria uma nova resposta
router.post('/', async (req, res) => {
  const { aluno_id, questao_id, gabarito_id, resposta_aluno, acertou, imagem_caminho, imagem_nome } = req.body;

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

    // Se foi fornecida uma imagem, salvar a associação na tabela imagens_cartoes
    // Apenas salvar na primeira resposta (evitar duplicatas)
    if (imagem_caminho && imagem_nome && aluno_id && gabarito_id) {
      try {
        // Verificar se já existe uma imagem para este aluno/gabarito
        const imagemExistente = await db.query(
          `SELECT id, caminho_imagem FROM imagens_cartoes 
           WHERE aluno_id = $1 AND gabarito_id = $2 
           ORDER BY criado_em DESC LIMIT 1`,
          [aluno_id, gabarito_id]
        );

        // Se não existe ou se a imagem é diferente, criar nova entrada
        if (imagemExistente.rows.length === 0 ||
          !imagemExistente.rows[0].caminho_imagem ||
          imagemExistente.rows[0].caminho_imagem !== imagem_caminho) {
          const imagemId = generateUUID();
          await db.query(
            `INSERT INTO imagens_cartoes 
             (id, aluno_id, gabarito_id, caminho_imagem, nome_imagem, criado_em)
             VALUES ($1, $2, $3, $4, $5, datetime('now'))`,
            [imagemId, aluno_id, gabarito_id, imagem_caminho, imagem_nome]
          );
          console.log(`[RESPOSTAS] Imagem associada: ${imagem_nome} para aluno ${aluno_id} e gabarito ${gabarito_id}`);
        }
      } catch (imgErr) {
        // Não falhar a criação da resposta se houver erro ao salvar a imagem
        // Pode ser que a tabela ainda não exista (em desenvolvimento)
        if (imgErr.message.includes('no such table')) {
          console.warn('[RESPOSTAS] Aviso: Tabela imagens_cartoes não existe. Execute a migration: node backend/migrations/add_imagens_cartoes.js');
        } else {
          console.warn('[RESPOSTAS] Aviso: Erro ao salvar associação de imagem:', imgErr.message);
        }
      }
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
 * A imagem é salva TEMPORARIAMENTE até que a correção seja finalizada.
 * A detecção automática decide qual script usar:
 * - processar_respostas_Imagem_original.py: para imagens que precisam de correção de perspectiva
 * - processar_respostas_imagem_processadas.py: para imagens já processadas
 */
router.post('/processar-imagem', uploadImagemTemp.single('imagem'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Imagem é obrigatória'
      });
    }

    const imagemPath = req.file.path;
    const imagemFilename = req.file.filename;

    // 1. Detectar o tipo de imagem (processada, original, enem_completo, enem_recorte)
    console.log('[PROCESSAR-IMAGEM] Detectando tipo de imagem...');
    const tipoImagem = await detectarTipoImagem(imagemPath);

    // 2. Escolher o script apropriado baseado na detecção
    let scriptPath;
    let isEnem = false;

    if (tipoImagem === 'enem_completo' || tipoImagem === 'enem_recorte') {
      // Folha ENEM detectada - usar script ENEM mobile
      scriptPath = path.join(__dirname, '../scripts/processar_respostas_enem_mobile.py');
      console.log(`[PROCESSAR-IMAGEM] Folha ENEM detectada (${tipoImagem}). Usando script ENEM mobile.`);
      isEnem = true;
    } else if (tipoImagem === 'processada') {
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
    // A imagem está salva temporariamente e será movida para permanente apenas ao finalizar correção
    const response = {
      sucesso: true,
      mensagem: mensagem,
      imagem: {
        nome: imagemFilename, // Nome temporário: temp_resposta_...\n        caminho: imagemPath,  // Caminho temporário: .../temp/temp_resposta_...
        tamanho: req.file.size,
        temporaria: true // Flag indicando que é temporária
      },
      respostas: respostasExtraidas,
      total_respostas: respostasExtraidas.length,
      detalhes: detalhesProcessamento
    };

    // Adicionar informações específicas ENEM se for folha ENEM
    if (isEnem && resultadoPython.dia_detectado) {
      response.dia_detectado = resultadoPython.dia_detectado;
      response.questao_inicial = resultadoPython.questao_inicial;
      response.questao_final = resultadoPython.questao_final;
      response.confianca_ocr = resultadoPython.confianca_ocr;
      response.detalhes.tipo_deteccao = 'enem_mobile';
      response.detalhes.rois_detectadas = resultadoPython.rois_detectadas || {};
    }

    res.status(200).json(response);

  } catch (err) {
    console.error('Erro ao processar imagem:', err);

    // Limpar arquivo temporário se houver erro
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
        console.log('[PROCESSAR-IMAGEM] Arquivo temporário removido após erro');
      } catch (unlinkErr) {
        console.error('Erro ao remover arquivo temporário:', unlinkErr);
      }
    }

    res.status(500).json({
      sucesso: false,
      erro: 'Erro ao processar imagem',
      detalhes: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

/**
 * Rota POST /api/respostas/confirmar-imagem
 * Confirma e move imagem de temporária para permanente após finalizar correção
 * Salva a associação na tabela imagens_cartoes
 */
router.post('/confirmar-imagem', async (req, res) => {
  try {
    const { caminho_imagem_temp, aluno_id, gabarito_id } = req.body;

    if (!caminho_imagem_temp || !aluno_id || !gabarito_id) {
      return res.status(400).json({
        sucesso: false,
        erro: 'caminho_imagem_temp, aluno_id e gabarito_id são obrigatórios'
      });
    }

    // Verificar se a imagem temporária existe
    const caminhoCompleto = path.resolve(caminho_imagem_temp);
    const caminhoDir = path.dirname(caminhoCompleto);

    // Garantir que está no diretório temporário (segurança)
    if (!caminhoDir.includes('temp') || !fs.existsSync(caminhoCompleto)) {
      return res.status(404).json({
        sucesso: false,
        erro: 'Imagem temporária não encontrada'
      });
    }

    // Nome do arquivo temporário
    const nomeTemp = path.basename(caminhoCompleto);

    // Novo nome permanente (remover prefixo "temp_")
    const nomePermanente = nomeTemp.replace(/^temp_/, '');
    const caminhoPermanente = path.join(imagensPermanenteDir, nomePermanente);

    // Mover arquivo de temporário para permanente
    fs.renameSync(caminhoCompleto, caminhoPermanente);
    console.log(`[CONFIRMAR-IMAGEM] Imagem movida de ${nomeTemp} para ${nomePermanente}`);

    const caminhoRelativo = `/uploads/imagens/${nomePermanente}`;

    // Salvar na tabela imagens_cartoes
    try {
      // Verificar se já existe uma imagem para este aluno/gabarito
      const imagemExistente = await db.query(
        `SELECT id, caminho_imagem FROM imagens_cartoes 
         WHERE aluno_id = $1 AND gabarito_id = $2 
         ORDER BY criado_em DESC LIMIT 1`,
        [aluno_id, gabarito_id]
      );

      // Se não existe ou se a imagem é diferente, criar nova entrada
      if (imagemExistente.rows.length === 0 ||
        !imagemExistente.rows[0].caminho_imagem ||
        imagemExistente.rows[0].caminho_imagem !== caminhoRelativo) {
        const imagemId = generateUUID();
        await db.query(
          `INSERT INTO imagens_cartoes 
           (id, aluno_id, gabarito_id, caminho_imagem, nome_imagem, criado_em)
           VALUES ($1, $2, $3, $4, $5, datetime('now'))`,
          [imagemId, aluno_id, gabarito_id, caminhoRelativo, nomePermanente]
        );
        console.log(`[CONFIRMAR-IMAGEM] Imagem associada: ${nomePermanente} para aluno ${aluno_id} e gabarito ${gabarito_id}`);
      }

      res.status(200).json({
        sucesso: true,
        imagem: {
          nome: nomePermanente,
          caminho: caminhoRelativo
        },
        mensagem: 'Imagem confirmada e salva com sucesso'
      });
    } catch (dbErr) {
      // Se falhar ao salvar no banco, tentar reverter o movimento do arquivo
      if (fs.existsSync(caminhoPermanente)) {
        try {
          fs.renameSync(caminhoPermanente, caminhoCompleto);
          console.log('[CONFIRMAR-IMAGEM] Movimento da imagem revertido devido a erro no banco');
        } catch (revertErr) {
          console.error('Erro ao reverter movimento da imagem:', revertErr);
        }
      }

      if (dbErr.message.includes('no such table')) {
        console.warn('[CONFIRMAR-IMAGEM] Tabela imagens_cartoes não existe');
        // Mesmo assim retorna sucesso, pois a imagem foi movida
        return res.status(200).json({
          sucesso: true,
          imagem: {
            nome: nomePermanente,
            caminho: caminhoRelativo
          },
          aviso: 'Imagem salva, mas tabela imagens_cartoes não existe'
        });
      }

      throw dbErr;
    }

  } catch (err) {
    console.error('Erro ao confirmar imagem:', err);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro ao confirmar imagem',
      detalhes: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

/**
 * Rota POST /api/respostas/processar-frame-mobile
 * Live detection rápida - apenas detecção YOLO sem processar bolhas
 * Para feedback em tempo real na interface mobile
 */
router.post('/processar-frame-mobile', uploadImagemTemp.single('frame'), async (req, res) => {
  try {
    console.log('[FRAME-MOBILE] Recebido frame para detecção');

    if (!req.file) {
      console.log('[FRAME-MOBILE] ERRO: Nenhum arquivo enviado');
      return res.status(400).json({
        sucesso: false,
        erro: 'Frame é obrigatório'
      });
    }

    const framePath = req.file.path;
    console.log('[FRAME-MOBILE] Frame salvo em:', framePath);

    // Executar apenas detecção YOLO (rápido, sem processar bolhas)
    const scriptPath = path.join(__dirname, '../scripts/detector_yolo_enem.py');

    if (!fs.existsSync(scriptPath)) {
      console.log('[FRAME-MOBILE] ERRO: Script não encontrado:', scriptPath);
      throw new Error('Script de detecção YOLO não encontrado');
    }

    const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';
    const comando = `${pythonCommand} "${scriptPath}" "${framePath}"`;

    console.log('[FRAME-MOBILE] Executando comando:', comando);

    const { stdout, stderr } = await execAsync(comando, {
      maxBuffer: 10 * 1024 * 1024,
      encoding: 'utf8'
    });

    if (stderr && stderr.trim()) {
      console.log('[FRAME-MOBILE] Stderr:', stderr);
    }

    console.log('[FRAME-MOBILE] Stdout:', stdout.substring(0, 200));

    // Parsear resultado JSON
    const jsonMatch = stdout.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log('[FRAME-MOBILE] ERRO: Resposta Python inválida. Stdout completo:', stdout);
      throw new Error('Resposta do Python inválida');
    }

    const resultado = JSON.parse(jsonMatch[0]);
    console.log('[FRAME-MOBILE] Resultado parseado:', JSON.stringify(resultado, null, 2));

    // Limpar frame temporário
    try {
      fs.unlinkSync(framePath);
    } catch (unlinkErr) {
      console.error('Erro ao remover frame temporário:', unlinkErr);
    }

    // Gerar feedback para UI
    let feedback = 'Procurando folha ENEM...';
    if (resultado.detectado) {
      feedback = '✓ Folha detectada! Capture quando estiver estável.';
      console.log('[FRAME-MOBILE] ✅ Detecção bem-sucedida!');
    } else if (resultado.rois && Object.keys(resultado.rois).length > 0) {
      feedback = 'Centralize melhor a folha';
      console.log('[FRAME-MOBILE] ⚠️ ROIs parciais detectadas');
    } else {
      console.log('[FRAME-MOBILE] ❌ Nenhuma detecção');
    }

    res.status(200).json({
      sucesso: resultado.sucesso,
      detectado: resultado.detectado || false,
      rois: resultado.rois || {},
      feedback: feedback,
      total_deteccoes: resultado.total_deteccoes || 0
    });

  } catch (err) {
    console.error('Erro ao processar frame mobile:', err);

    // Limpar arquivo temporário se houver erro
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkErr) {
        console.error('Erro ao remover frame temporário:', unlinkErr);
      }
    }

    res.status(500).json({
      sucesso: false,
      erro: 'Erro ao processar frame',
      detalhes: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

/**
 * Rota POST /api/respostas/capturar-enem-mobile
 * Processamento completo via HuggingFace: YOLO → OCR day → detecção de bolhas
 * Para captura final no mobile
 */
router.post('/capturar-enem-mobile', uploadImagemTemp.single('imagem'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Imagem é obrigatória'
      });
    }

    const imagemPath = req.file.path;
    const imagemFilename = req.file.filename;
    console.log('[CAPTURAR-ENEM-MOBILE] Processando via HuggingFace...');

    // URL da API HuggingFace
    const HUGGINGFACE_API_URL = process.env.HUGGINGFACE_API_URL || 'https://do2anjos-eduscore-yolo-api.hf.space';

    const FormData = require('form-data');
    const formData = new FormData();
    formData.append('data', fs.createReadStream(imagemPath));
    formData.append('fn_index', '1'); // Full Capture

    const fetch = require('node-fetch');
    const response = await fetch(`${HUGGINGFACE_API_URL}/api/predict`, {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders(),
      timeout: 60000
    });

    if (!response.ok) {
      throw new Error(`HuggingFace retornou ${response.status}`);
    }

    const resultado = await response.json();
    const data = resultado.data && resultado.data[0] ? resultado.data[0] : resultado;

    // Limpar arquivo temporário
    try { fs.unlinkSync(imagemPath); } catch { }

    if (!data.sucesso) {
      return res.status(400).json({ sucesso: false, erro: data.erro });
    }

    const imagemAnexada = {
      nome: imagemFilename,
      caminho: imagemPath,
      caminhoRelativo: `/uploads/imagens/temp/${imagemFilename}`,
      tamanho: req.file.size,
      temporaria: true
    };

    let mensagem = `Captura processada! ${data.total_respostas} respostas. Dia ${data.dia_detectado}.`;
    if (data.questoes_com_dupla_marcacao > 0) mensagem += ` ⚠ ${data.questoes_com_dupla_marcacao} duplas.`;
    if (data.questoes_sem_marcacao > 0) mensagem += ` ○ ${data.questoes_sem_marcacao} em branco.`;

    res.status(200).json({
      sucesso: true,
      mensagem,
      dia_detectado: data.dia_detectado,
      questao_inicial: data.questao_inicial,
      questao_final: data.questao_final,
      imagem: imagemAnexada,
      respostas: data.respostas || [],
      total_respostas: data.total_respostas || 0,
      detalhes: {
        total_bolhas_detectadas: data.total_bolhas_detectadas || 0,
        questoes_com_dupla_marcacao: data.questoes_com_dupla_marcacao || 0,
        questoes_sem_marcacao: data.questoes_sem_marcacao || 0,
        questoes_validas: data.questoes_validas || 0,
        avisos: data.avisos || []
      }
    });

  } catch (err) {
    console.error('[CAPTURAR-ENEM-MOBILE] Erro:', err);
    if (req.file && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch { }
    }
    res.status(500).json({
      sucesso: false,
      erro: 'Erro ao processar captura ENEM',
      detalhes: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

module.exports = router;