const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, 'backend/.env') });

// Caminho do banco de dados
const dbPath = process.env.DB_PATH || path.join(__dirname, 'database.sqlite');

console.log('🌱 Populando banco de dados com dados de teste...\n');

try {
  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');

  // Função helper para gerar UUID (mesmo método usado no db.js)
  const generateUUID = () => {
    return crypto.randomUUID ? crypto.randomUUID() : 
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
  };

  // Função helper para executar queries
  const execute = (sql, params = []) => {
    const stmt = db.prepare(sql);
    return stmt.run(...params);
  };

  // Função helper para buscar dados
  const query = (sql, params = []) => {
    const stmt = db.prepare(sql);
    return stmt.all(...params);
  };

  console.log('📝 Criando dados de teste...\n');

  // 1. Criar ou buscar Disciplinas (estrutura SIS/UEA)
  console.log('1️⃣  Criando/buscando disciplinas (estrutura SIS/UEA)...');
  const disciplinasNomes = [
    'Língua Portuguesa e Artes',
    'Língua Estrangeira',
    'Matemática',
    'História, Filosofia e Educação Física',
    'Geografia e Literatura',
    'Biologia',
    'Química',
    'Física'
  ];
  const disciplinas = [];

  disciplinasNomes.forEach(nome => {
    // Verificar se já existe
    const existente = query('SELECT id FROM disciplinas WHERE nome = ?', [nome]);
    if (existente.length > 0) {
      disciplinas.push({ id: existente[0].id, nome });
      console.log(`   ✅ ${nome} (já existe)`);
    } else {
      const id = generateUUID();
      execute('INSERT INTO disciplinas (id, nome) VALUES (?, ?)', [id, nome]);
      disciplinas.push({ id, nome });
      console.log(`   ✅ ${nome} (criado)`);
    }
  });

  // 2. Criar ou buscar 3 Alunos (um para cada etapa)
  console.log('\n2️⃣  Criando/buscando alunos...');
  const alunosData = [
    {
      nome_completo: 'João Silva Santos',
      email: 'joao.silva@escola.edu.br',
      telefone_responsavel: '(92) 99999-1111',
      data_nascimento: '2010-05-15',
      etapa: '1º Ano',
      matricula: '2024001'
    },
    {
      nome_completo: 'Maria Oliveira Costa',
      email: 'maria.oliveira@escola.edu.br',
      telefone_responsavel: '(92) 99999-2222',
      data_nascimento: '2009-08-20',
      etapa: '2º Ano',
      matricula: '2024002'
    },
    {
      nome_completo: 'Pedro Almeida Souza',
      email: 'pedro.almeida@escola.edu.br',
      telefone_responsavel: '(92) 99999-3333',
      data_nascimento: '2008-03-10',
      etapa: '3º Ano',
      matricula: '2024003'
    }
  ];

  const alunos = [];
  alunosData.forEach(alunoData => {
    // Verificar se já existe pela matrícula
    const existente = query('SELECT id FROM alunos WHERE matricula = ?', [alunoData.matricula]);
    if (existente.length > 0) {
      alunos.push({ id: existente[0].id, ...alunoData });
      console.log(`   ✅ ${alunoData.nome_completo} - ${alunoData.etapa} (Matrícula: ${alunoData.matricula}) - já existe`);
    } else {
      const id = generateUUID();
      execute(
        'INSERT INTO alunos (id, nome_completo, email, telefone_responsavel, data_nascimento, etapa, matricula) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, alunoData.nome_completo, alunoData.email, alunoData.telefone_responsavel, alunoData.data_nascimento, alunoData.etapa, alunoData.matricula]
      );
      alunos.push({ id, ...alunoData });
      console.log(`   ✅ ${alunoData.nome_completo} - ${alunoData.etapa} (Matrícula: ${alunoData.matricula}) - criado`);
    }
  });

  // 3. Criar Gabaritos (estrutura SIS/UEA - 60 questões por etapa)
  console.log('\n3️⃣  Criando gabaritos (estrutura SIS/UEA)...');
  const gabaritos = [
    { id: generateUUID(), nome: 'Simulado SIS/UEA - 1º Ano', etapa: '1º Ano' },
    { id: generateUUID(), nome: 'Simulado SIS/UEA - 2º Ano', etapa: '2º Ano' },
    { id: generateUUID(), nome: 'Simulado SIS/UEA - 3º Ano', etapa: '3º Ano' }
  ];

  gabaritos.forEach(gab => {
    execute('INSERT INTO gabaritos (id, nome, etapa, criado_em) VALUES (?, ?, ?, datetime(\'now\'))', [gab.id, gab.nome, gab.etapa]);
    console.log(`   ✅ ${gab.nome} - ${gab.etapa}`);
  });

  // 4. Criar Questões para os Gabaritos (estrutura SIS/UEA - 60 questões por gabarito)
  console.log('\n4️⃣  Criando questões (estrutura SIS/UEA - 60 questões por simulado)...');
  let totalQuestoes = 0;

  // Estrutura SIS/UEA: distribuição de questões por área
  const estruturaSIS = [
    { disciplina: 'Língua Portuguesa e Artes', quantidade: 8 },
    { disciplina: 'Língua Estrangeira', quantidade: 4 },
    { disciplina: 'Matemática', quantidade: 8 },
    { disciplina: 'História, Filosofia e Educação Física', quantidade: 8 },
    { disciplina: 'Geografia e Literatura', quantidade: 8 },
    { disciplina: 'Biologia', quantidade: 8 },
    { disciplina: 'Química', quantidade: 8 },
    { disciplina: 'Física', quantidade: 8 }
  ];

  // Gerar questões para cada gabarito (cada etapa)
  gabaritos.forEach(gabarito => {
    let numeroQuestao = 1;
    
    estruturaSIS.forEach(area => {
      const disciplina = disciplinas.find(d => d.nome === area.disciplina);
      if (!disciplina) {
        console.log(`   ⚠️  Disciplina "${area.disciplina}" não encontrada!`);
        return;
      }

      // Gerar respostas corretas aleatórias para as questões desta área
      const alternativas = ['A', 'B', 'C', 'D'];
      
      for (let i = 0; i < area.quantidade; i++) {
        const respostaCorreta = alternativas[Math.floor(Math.random() * alternativas.length)];
        execute(
          'INSERT INTO questoes (id, gabarito_id, numero, resposta_correta, disciplina_id) VALUES (?, ?, ?, ?, ?)',
          [generateUUID(), gabarito.id, numeroQuestao, respostaCorreta, disciplina.id]
        );
        numeroQuestao++;
        totalQuestoes++;
      }
    });
    
    console.log(`   ✅ ${gabarito.nome}: 60 questões criadas`);
  });

  console.log(`\n   ✅ Total de ${totalQuestoes} questões criadas`);

  // 5. Criar Respostas dos Alunos (cada aluno responde ao simulado da sua etapa - 60 questões)
  console.log('\n5️⃣  Criando respostas dos alunos...');
  let totalRespostas = 0;

  // Buscar todas as questões criadas
  const todasQuestoes = query('SELECT id, gabarito_id, numero, resposta_correta, disciplina_id FROM questoes ORDER BY gabarito_id, numero');

  // Função para gerar desempenho aleatório mais realista
  const gerarDesempenhoAleatorio = () => {
    // Desempenhos variam entre 45% e 95% (mais realista)
    const desempenhos = [0.45, 0.50, 0.55, 0.60, 0.65, 0.70, 0.75, 0.80, 0.85, 0.90, 0.95];
    return desempenhos[Math.floor(Math.random() * desempenhos.length)];
  };

  // Aluno 1 (1º Ano) - Responde ao simulado do 1º Ano (60 questões)
  const aluno1 = alunos[0];
  const gabaritoAluno1 = gabaritos.find(g => g.etapa === aluno1.etapa);
  let respostasAluno1 = 0;
  const desempenhoAluno1 = gerarDesempenhoAleatorio(); // Desempenho aleatório entre 45% e 95%
  
  if (gabaritoAluno1) {
    const questoesGabarito = todasQuestoes.filter(q => q.gabarito_id === gabaritoAluno1.id);
    // Embaralhar questões para mais aleatoriedade
    const questoesEmbaralhadas = [...questoesGabarito].sort(() => Math.random() - 0.5);
    
    // Data base aleatória para o simulado (entre 5 e 60 dias atrás)
    const diasAtrasBase = Math.floor(Math.random() * 55) + 5;
    
    questoesEmbaralhadas.forEach((questao, index) => {
      let respostaAluno = questao.resposta_correta;
      let acertou = 1;
      
      // Usar desempenho aleatório específico deste aluno
      if (Math.random() > desempenhoAluno1) {
        const alternativas = ['A', 'B', 'C', 'D'];
        const alternativasErradas = alternativas.filter(a => a !== questao.resposta_correta);
        respostaAluno = alternativasErradas[Math.floor(Math.random() * alternativasErradas.length)];
        acertou = 0;
      }
      
      // Variação de data: ±2 dias da data base (simula que respondeu em dias diferentes)
      const variacaoDias = Math.floor(Math.random() * 5) - 2; // -2 a +2 dias
      const daysAgo = Math.max(0, diasAtrasBase + variacaoDias);
      
      execute(
        'INSERT INTO respostas (id, aluno_id, questao_id, gabarito_id, resposta_aluno, acertou, data_resposta) VALUES (?, ?, ?, ?, ?, ?, datetime(\'now\', \'-\' || ? || \' days\'))',
        [generateUUID(), aluno1.id, questao.id, gabaritoAluno1.id, respostaAluno, acertou, daysAgo]
      );
      respostasAluno1++;
      totalRespostas++;
    });
  }
  console.log(`   ✅ ${aluno1.nome_completo} (${aluno1.etapa}): ${respostasAluno1} respostas (~${Math.round(desempenhoAluno1 * 100)}% de acertos)`);

  // Aluno 2 (2º Ano) - Responde ao simulado do 2º Ano (60 questões)
  const aluno2 = alunos[1];
  const gabaritoAluno2 = gabaritos.find(g => g.etapa === aluno2.etapa);
  let respostasAluno2 = 0;
  const desempenhoAluno2 = gerarDesempenhoAleatorio(); // Desempenho aleatório diferente
  
  if (gabaritoAluno2) {
    const questoesGabarito = todasQuestoes.filter(q => q.gabarito_id === gabaritoAluno2.id);
    const questoesEmbaralhadas = [...questoesGabarito].sort(() => Math.random() - 0.5);
    const diasAtrasBase = Math.floor(Math.random() * 55) + 5;
    
    questoesEmbaralhadas.forEach((questao) => {
      let respostaAluno = questao.resposta_correta;
      let acertou = 1;
      
      if (Math.random() > desempenhoAluno2) {
        const alternativas = ['A', 'B', 'C', 'D'];
        const alternativasErradas = alternativas.filter(a => a !== questao.resposta_correta);
        respostaAluno = alternativasErradas[Math.floor(Math.random() * alternativasErradas.length)];
        acertou = 0;
      }
      
      const variacaoDias = Math.floor(Math.random() * 5) - 2;
      const daysAgo2 = Math.max(0, diasAtrasBase + variacaoDias);
      
      execute(
        'INSERT INTO respostas (id, aluno_id, questao_id, gabarito_id, resposta_aluno, acertou, data_resposta) VALUES (?, ?, ?, ?, ?, ?, datetime(\'now\', \'-\' || ? || \' days\'))',
        [generateUUID(), aluno2.id, questao.id, gabaritoAluno2.id, respostaAluno, acertou, daysAgo2]
      );
      respostasAluno2++;
      totalRespostas++;
    });
  }
  console.log(`   ✅ ${aluno2.nome_completo} (${aluno2.etapa}): ${respostasAluno2} respostas (~${Math.round(desempenhoAluno2 * 100)}% de acertos)`);

  // Aluno 3 (3º Ano) - Responde ao simulado do 3º Ano (60 questões)
  const aluno3 = alunos[2];
  const gabaritoAluno3 = gabaritos.find(g => g.etapa === aluno3.etapa);
  let respostasAluno3 = 0;
  const desempenhoAluno3 = gerarDesempenhoAleatorio(); // Desempenho aleatório diferente
  
  if (gabaritoAluno3) {
    const questoesGabarito = todasQuestoes.filter(q => q.gabarito_id === gabaritoAluno3.id);
    const questoesEmbaralhadas = [...questoesGabarito].sort(() => Math.random() - 0.5);
    const diasAtrasBase = Math.floor(Math.random() * 55) + 5;
    
    questoesEmbaralhadas.forEach((questao) => {
      let respostaAluno = questao.resposta_correta;
      let acertou = 1;
      
      if (Math.random() > desempenhoAluno3) {
        const alternativas = ['A', 'B', 'C', 'D'];
        const alternativasErradas = alternativas.filter(a => a !== questao.resposta_correta);
        respostaAluno = alternativasErradas[Math.floor(Math.random() * alternativasErradas.length)];
        acertou = 0;
      }
      
      const variacaoDias = Math.floor(Math.random() * 5) - 2;
      const daysAgo3 = Math.max(0, diasAtrasBase + variacaoDias);
      
      execute(
        'INSERT INTO respostas (id, aluno_id, questao_id, gabarito_id, resposta_aluno, acertou, data_resposta) VALUES (?, ?, ?, ?, ?, ?, datetime(\'now\', \'-\' || ? || \' days\'))',
        [generateUUID(), aluno3.id, questao.id, gabaritoAluno3.id, respostaAluno, acertou, daysAgo3]
      );
      respostasAluno3++;
      totalRespostas++;
    });
  }
  console.log(`   ✅ ${aluno3.nome_completo} (${aluno3.etapa}): ${respostasAluno3} respostas (~${Math.round(desempenhoAluno3 * 100)}% de acertos)`);

  console.log(`\n   ✅ Total de ${totalRespostas} respostas criadas`);

  // Resumo final
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMO DA POPULAÇÃO:\n');
  console.log(`   👥 Alunos: ${alunos.length}`);
  console.log(`   📚 Disciplinas: ${disciplinas.length}`);
  console.log(`   📝 Gabaritos: ${gabaritos.length}`);
  console.log(`   ❓ Questões: ${totalQuestoes}`);
  console.log(`   ✅ Respostas: ${totalRespostas}`);
  console.log('\n✅ Banco de dados populado com sucesso!\n');
  console.log('💡 Agora você pode testar os relatórios em:');
  console.log('   - Relatório Geral: RelatorioGeral.html');
  console.log('   - Relatório Individual: GerarRelatorio.html\n');

  db.close();

} catch (err) {
  console.error('❌ Erro ao popular banco de dados:', err.message);
  console.error('\nDetalhes:', err);
  process.exit(1);
}

