const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, 'backend/.env') });

// Caminho do banco de dados
const dbPath = process.env.DB_PATH || path.join(__dirname, 'database.sqlite');

console.log('🌱 Populando banco de dados com dados de teste heterogêneos...\n');

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

  console.log('📝 Criando dados de teste heterogêneos...\n');

  // 1. Criar ou buscar Disciplinas (estrutura SIS/UEA)
  console.log('1️⃣  Criando/buscando disciplinas (estrutura SIS/UEA)...');
  const disciplinasNomes = [
    'Língua Portuguesa e Artes',
    'Língua Estrangeira',
    'História, Filosofia e Educação Física',
    'Geografia',
    'Biologia',
    'Química',
    'Física',
    'Matemática'
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

  // 2. Criar 10 Alunos heterogêneos
  console.log('\n2️⃣  Criando alunos heterogêneos...');
  const alunosData = [
    {
      nome_completo: 'Ana Beatriz Silva',
      email: 'ana.beatriz@escola.edu.br',
      telefone_responsavel: '(92) 99999-1111',
      data_nascimento: '2008-03-15',
      etapa: '3º Ano',
      matricula: '2024001'
    },
    {
      nome_completo: 'Carlos Eduardo Santos',
      email: 'carlos.santos@escola.edu.br',
      telefone_responsavel: '(92) 99999-2222',
      data_nascimento: '2008-07-22',
      etapa: '3º Ano',
      matricula: '2024002'
    },
    {
      nome_completo: 'Juliana Costa Lima',
      email: 'juliana.costa@escola.edu.br',
      telefone_responsavel: '(92) 99999-3333',
      data_nascimento: '2009-05-10',
      etapa: '2º Ano',
      matricula: '2024003'
    },
    {
      nome_completo: 'Rafael Oliveira Martins',
      email: 'rafael.oliveira@escola.edu.br',
      telefone_responsavel: '(92) 99999-4444',
      data_nascimento: '2009-11-30',
      etapa: '2º Ano',
      matricula: '2024004'
    },
    {
      nome_completo: 'Mariana Souza Ferreira',
      email: 'mariana.souza@escola.edu.br',
      telefone_responsavel: '(92) 99999-5555',
      data_nascimento: '2010-01-18',
      etapa: '1º Ano',
      matricula: '2024005'
    },
    {
      nome_completo: 'Lucas Henrique Alves',
      email: 'lucas.alves@escola.edu.br',
      telefone_responsavel: '(92) 99999-6666',
      data_nascimento: '2008-09-05',
      etapa: '3º Ano',
      matricula: '2024006'
    },
    {
      nome_completo: 'Fernanda Rodrigues',
      email: 'fernanda.rodrigues@escola.edu.br',
      telefone_responsavel: '(92) 99999-7777',
      data_nascimento: '2009-12-20',
      etapa: '2º Ano',
      matricula: '2024007'
    },
    {
      nome_completo: 'Gabriel Pereira',
      email: 'gabriel.pereira@escola.edu.br',
      telefone_responsavel: '(92) 99999-8888',
      data_nascimento: '2010-04-25',
      etapa: '1º Ano',
      matricula: '2024008'
    },
    {
      nome_completo: 'Isabela Barbosa',
      email: 'isabela.barbosa@escola.edu.br',
      telefone_responsavel: '(92) 99999-9999',
      data_nascimento: '2008-06-12',
      etapa: '3º Ano',
      matricula: '2024009'
    },
    {
      nome_completo: 'Thiago Nascimento',
      email: 'thiago.nascimento@escola.edu.br',
      telefone_responsavel: '(92) 99999-0000',
      data_nascimento: '2009-02-28',
      etapa: '2º Ano',
      matricula: '2024010'
    }
  ];

  const alunos = [];
  alunosData.forEach(alunoData => {
    const id = generateUUID();
    execute(
      'INSERT INTO alunos (id, nome_completo, email, telefone_responsavel, data_nascimento, etapa, matricula) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, alunoData.nome_completo, alunoData.email, alunoData.telefone_responsavel, alunoData.data_nascimento, alunoData.etapa, alunoData.matricula]
    );
    alunos.push({ id, ...alunoData });
    console.log(`   ✅ ${alunoData.nome_completo} - ${alunoData.etapa} (Matrícula: ${alunoData.matricula})`);
  });

  // 3. Criar Gabaritos para SET, OUT e NOV (cada um com diferentes etapas)
  console.log('\n3️⃣  Criando simulados para SET, OUT e NOV...');
  
  // Datas base para cada mês (meio do mês de 2024)
  const datasSimulados = {
    'SET': '2024-09-15',
    'OUT': '2024-10-15',
    'NOV': '2024-11-15'
  };

  const etapas = ['1º Ano', '2º Ano', '3º Ano'];
  const gabaritos = [];
  
  Object.keys(datasSimulados).forEach(mes => {
    etapas.forEach(etapa => {
      const id = generateUUID();
      const nome = `Simulado ${mes} - ${etapa}`;
      const dataCriacao = datasSimulados[mes];
      execute(
        'INSERT INTO gabaritos (id, nome, etapa, criado_em) VALUES (?, ?, ?, ?)',
        [id, nome, etapa, dataCriacao]
      );
      gabaritos.push({ id, nome, etapa, mes, dataCriacao });
      console.log(`   ✅ ${nome}`);
    });
  });

  // 4. Criar Questões para os Gabaritos (60 questões por gabarito)
  console.log('\n4️⃣  Criando questões (60 questões por simulado)...');
  let totalQuestoes = 0;

  // Estrutura SIS/UEA: distribuição de questões por área
  const estruturaSIS = [
    { disciplina: 'Língua Portuguesa e Artes', quantidade: 8 },
    { disciplina: 'Língua Estrangeira', quantidade: 4 },
    { disciplina: 'História, Filosofia e Educação Física', quantidade: 8 },
    { disciplina: 'Geografia', quantidade: 8 },
    { disciplina: 'Biologia', quantidade: 8 },
    { disciplina: 'Química', quantidade: 8 },
    { disciplina: 'Física', quantidade: 8 },
    { disciplina: 'Matemática', quantidade: 8 }
  ];

  // Gerar questões para cada gabarito
  gabaritos.forEach(gabarito => {
    let numeroQuestao = 1;
    
    estruturaSIS.forEach(area => {
      const disciplina = disciplinas.find(d => d.nome === area.disciplina);
      if (!disciplina) {
        console.log(`   ⚠️  Disciplina "${area.disciplina}" não encontrada!`);
        return;
      }

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

  // 5. Criar Respostas dos Alunos com dados heterogêneos
  console.log('\n5️⃣  Criando respostas dos alunos (dados heterogêneos)...');
  let totalRespostas = 0;

  // Buscar todas as questões criadas
  const todasQuestoes = query('SELECT id, gabarito_id, numero, resposta_correta, disciplina_id FROM questoes ORDER BY gabarito_id, numero');

  // Função para gerar desempenho variado (30% a 95%)
  const gerarDesempenho = (min = 0.30, max = 0.95) => {
    return min + (Math.random() * (max - min));
  };

  // Função para calcular dias a partir da data do simulado
  const calcularDiasAtras = (dataSimulado) => {
    const hoje = new Date();
    const dataSim = new Date(dataSimulado);
    const diffTime = Math.abs(hoje - dataSim);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // TODOS os alunos fazem TODOS os simulados da sua etapa (obrigatório)
  alunos.forEach((aluno) => {
    // Buscar gabaritos da mesma etapa do aluno (SET, OUT, NOV)
    const gabaritosEtapa = gabaritos.filter(g => g.etapa === aluno.etapa);
    
    // Ordenar por mês: SET, OUT, NOV (ordem de aplicação)
    const ordemMeses = { 'SET': 1, 'OUT': 2, 'NOV': 3 };
    gabaritosEtapa.sort((a, b) => (ordemMeses[a.mes] || 999) - (ordemMeses[b.mes] || 999));
    
    // Garantir que temos exatamente 3 simulados por etapa
    if (gabaritosEtapa.length !== 3) {
      console.log(`   ⚠️  Atenção: ${aluno.etapa} tem ${gabaritosEtapa.length} simulados (esperado: 3)`);
    }

    // Desempenho base do aluno (único para este aluno, entre 35% e 90%)
    const desempenhoBase = gerarDesempenho(0.35, 0.90);
    
    // TODOS os alunos fazem TODOS os 3 simulados da sua etapa
    gabaritosEtapa.forEach((gabarito, simIndex) => {
      // Variação de desempenho entre simulados (pode melhorar ou piorar um pouco)
      // Ordenar por mês: SET (primeiro), OUT (segundo), NOV (terceiro)
      const variacaoPorSimulado = [0, 0.05, -0.05][simIndex] || (Math.random() - 0.5) * 0.10; // ±5%
      const desempenhoAluno = Math.max(0.30, Math.min(0.95, desempenhoBase + variacaoPorSimulado));

      const questoesGabarito = todasQuestoes.filter(q => q.gabarito_id === gabarito.id);
      let respostasAluno = 0;
      let acertos = 0;

      // Calcular dias atrás baseado na data do simulado
      const diasAtrasBase = calcularDiasAtras(gabarito.dataCriacao);
      
      questoesGabarito.forEach((questao) => {
        let respostaAluno = questao.resposta_correta;
        let acertou = 1;
        
        // Usar desempenho específico deste aluno neste simulado
        if (Math.random() > desempenhoAluno) {
          const alternativas = ['A', 'B', 'C', 'D'];
          const alternativasErradas = alternativas.filter(a => a !== questao.resposta_correta);
          respostaAluno = alternativasErradas[Math.floor(Math.random() * alternativasErradas.length)];
          acertou = 0;
        } else {
          acertos++;
        }
        
        // Variação de data: ±1 dia da data base do simulado
        const variacaoDias = Math.floor(Math.random() * 3) - 1; // -1 a +1 dia
        const daysAgo = Math.max(0, diasAtrasBase + variacaoDias);
        
        execute(
          'INSERT INTO respostas (id, aluno_id, questao_id, gabarito_id, resposta_aluno, acertou, data_resposta) VALUES (?, ?, ?, ?, ?, ?, datetime(\'now\', \'-\' || ? || \' days\'))',
          [generateUUID(), aluno.id, questao.id, gabarito.id, respostaAluno, acertou, daysAgo]
        );
        respostasAluno++;
        totalRespostas++;
      });

      const percentualAcertos = respostasAluno > 0 ? Math.round((acertos / respostasAluno) * 100) : 0;
      console.log(`   ✅ ${aluno.nome_completo} - ${gabarito.nome}: ${respostasAluno} respostas (${percentualAcertos}% de acertos)`);
    });
  });

  console.log(`\n   ✅ Total de ${totalRespostas} respostas criadas`);

  // Resumo final
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMO DA POPULAÇÃO:\n');
  console.log(`   👥 Alunos: ${alunos.length}`);
  console.log(`   📚 Disciplinas: ${disciplinas.length}`);
  console.log(`   📝 Gabaritos (Simulados): ${gabaritos.length} (SET, OUT e NOV)`);
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
