/**
 * Utilitário para classificar automaticamente disciplinas baseado no número da questão
 * Estrutura SIS/UEA padrão:
 * - Questões 1-8: Língua Portuguesa e Artes
 * - Questões 9-12: Língua Estrangeira
 * - Questões 13-20: História, Filosofia e Educação Física
 * - Questões 21-28: Geografia
 * - Questões 29-36: Biologia
 * - Questões 37-44: Química
 * - Questões 45-52: Física
 * - Questões 53-60: Matemática
 */

const db = require('../db');

// Mapeamento de número da questão para nome da disciplina
const ESTRUTURA_DISCIPLINAS = {
  'Língua Portuguesa e Artes': { inicio: 1, fim: 8 },
  'Língua Estrangeira': { inicio: 9, fim: 12 },
  'História, Filosofia e Educação Física': { inicio: 13, fim: 20 },
  'Geografia': { inicio: 21, fim: 28 },
  'Biologia': { inicio: 29, fim: 36 },
  'Química': { inicio: 37, fim: 44 },
  'Física': { inicio: 45, fim: 52 },
  'Matemática': { inicio: 53, fim: 60 }
};

/**
 * Retorna o nome da disciplina baseado no número da questão
 * @param {number} numeroQuestao - Número da questão (1-60)
 * @returns {string|null} - Nome da disciplina ou null se fora do range
 */
function classificarDisciplinaPorNumero(numeroQuestao) {
  const numero = Number(numeroQuestao);
  
  if (!numero || numero < 1 || numero > 60) {
    return null;
  }

  for (const [disciplina, range] of Object.entries(ESTRUTURA_DISCIPLINAS)) {
    if (numero >= range.inicio && numero <= range.fim) {
      return disciplina;
    }
  }

  return null;
}

/**
 * Busca ou cria o ID da disciplina baseado no número da questão
 * @param {number} numeroQuestao - Número da questão (1-60)
 * @returns {Promise<string|null>} - ID da disciplina ou null se não encontrada
 */
async function obterDisciplinaIdPorNumero(numeroQuestao) {
  const nomeDisciplina = classificarDisciplinaPorNumero(numeroQuestao);
  
  if (!nomeDisciplina) {
    console.warn(`[DISCIPLINA_CLASSIFIER] Número de questão ${numeroQuestao} fora do range esperado (1-60)`);
    return null;
  }

  try {
    // Buscar disciplina no banco
    const resultado = await db.query(
      'SELECT id FROM disciplinas WHERE nome = $1',
      [nomeDisciplina]
    );

    if (resultado.rows.length > 0) {
      return resultado.rows[0].id;
    }

    // Se não encontrou, criar (não deveria acontecer, mas garante consistência)
    console.warn(`[DISCIPLINA_CLASSIFIER] Disciplina "${nomeDisciplina}" não encontrada no banco. Criando...`);
    const { generateUUID } = require('../db');
    const novoId = generateUUID();
    
    await db.query(
      'INSERT INTO disciplinas (id, nome) VALUES ($1, $2)',
      [novoId, nomeDisciplina]
    );

    return novoId;
  } catch (err) {
    console.error(`[DISCIPLINA_CLASSIFIER] Erro ao buscar/criar disciplina "${nomeDisciplina}":`, err);
    return null;
  }
}

/**
 * Atualiza a disciplina_id de uma questão baseado no número da questão
 * @param {string} questaoId - ID da questão
 * @param {number} numeroQuestao - Número da questão (1-60)
 * @returns {Promise<boolean>} - True se atualizou com sucesso
 */
async function atualizarDisciplinaQuestao(questaoId, numeroQuestao) {
  const disciplinaId = await obterDisciplinaIdPorNumero(numeroQuestao);
  
  if (!disciplinaId) {
    return false;
  }

  try {
    await db.query(
      'UPDATE questoes SET disciplina_id = $1 WHERE id = $2',
      [disciplinaId, questaoId]
    );
    
    return true;
  } catch (err) {
    console.error(`[DISCIPLINA_CLASSIFIER] Erro ao atualizar disciplina da questão ${questaoId}:`, err);
    return false;
  }
}

/**
 * Garante que uma questão tem disciplina_id baseado no número
 * Se não tiver, classifica automaticamente
 * @param {string} questaoId - ID da questão
 * @param {number} numeroQuestao - Número da questão (1-60)
 * @returns {Promise<string|null>} - ID da disciplina (mesmo se já existia)
 */
async function garantirDisciplinaQuestao(questaoId, numeroQuestao) {
  try {
    // Verificar se a questão já tem disciplina_id
    const questao = await db.query(
      'SELECT disciplina_id FROM questoes WHERE id = $1',
      [questaoId]
    );

    if (questao.rows.length === 0) {
      console.warn(`[DISCIPLINA_CLASSIFIER] Questão ${questaoId} não encontrada`);
      return null;
    }

    // Se já tem disciplina_id, retornar
    if (questao.rows[0].disciplina_id) {
      return questao.rows[0].disciplina_id;
    }

    // Se não tem, classificar automaticamente
    const disciplinaId = await obterDisciplinaIdPorNumero(numeroQuestao);
    
    if (disciplinaId) {
      await db.query(
        'UPDATE questoes SET disciplina_id = $1 WHERE id = $2',
        [disciplinaId, questaoId]
      );
    }

    return disciplinaId;
  } catch (err) {
    console.error(`[DISCIPLINA_CLASSIFIER] Erro ao garantir disciplina da questão ${questaoId}:`, err);
    return null;
  }
}

module.exports = {
  classificarDisciplinaPorNumero,
  obterDisciplinaIdPorNumero,
  atualizarDisciplinaQuestao,
  garantirDisciplinaQuestao,
  ESTRUTURA_DISCIPLINAS
};

