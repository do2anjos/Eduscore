# Documentação de Cálculo de Métricas e Gráficos

Esta documentação descreve como os principais cards e gráficos do sistema são calculados e alimentados pelos endpoints do backend, e como são exibidos no frontend.

## Sumário
- Home (Dashboard)
  - Alunos Ativos (Total de Alunos)
  - Progresso Mensal (Média mensal agregada)
  - Retenção por Disciplina (Médias por disciplina)
- Relatório Geral
  - Métricas principais
  - Média de Acertos por Disciplina (geral/por etapa)
  - Filtro por Etapa
- Relatório Individual
  - Métricas do aluno
  - Desempenho ao longo do tempo
  - Desempenho por simulado (gabarito)
  - Desempenho por disciplina do aluno

---

## Home (Dashboard)

### 1) Alunos Ativos (Total de Alunos)
- Frontend: `public/home.html` – card “Alunos Ativos”.
- Origem de dados: `GET /api/alunos`.
- Cálculo: total de registros retornados no array `alunos`.
- Exibição: número absoluto (sem porcentagem), legenda “alunos cadastrados”.

### 2) Progresso Mensal (Média mensal agregada)
- Frontend: `public/home.html` – card “Progresso Mensal”.
- Origem de dados: `GET /api/relatorios/estatisticas-mensal`.
- Backend: `backend/routes/relatorios.js`.
  - Query:
    - Agrupa por mês usando `strftime('%Y-%m', g.criado_em)` (data de criação do simulado).
    - Considera últimos 6 meses (incluindo o mês corrente):
      - `WHERE g.criado_em >= date('now', 'start of month', '-5 months')`
    - Média mensal: `AVG(CASE WHEN r.acertou = 1 THEN 100 ELSE 0 END)`.
- Exibição: gráfico de barras com rótulos no formato `MMM/YY` e valores em `%`.
- Observações:
  - Mesmo com um único mês de dados, ele é exibido.
  - Caso não haja respostas em algum mês, a média pode ser 0.

### 3) Retenção por Disciplina (Médias por disciplina)
- Frontend: `public/home.html` – card “Retenção por Disciplina” (horizontal).
- Origem de dados: `GET /api/relatorios/estatisticas-gerais`.
- Backend: `backend/routes/relatorios.js`.
  - Query (geral / com filtro de etapa):
    - Junta `disciplinas` → `questoes` → `respostas`.
    - Para cada disciplina:
      - `media`: `AVG(CASE WHEN r.acertou = 1 THEN 100 ELSE 0 END)`.
      - Também são retornados `total_questoes`, `total_respostas`, `acertos` (auxiliares).
- Exibição: gráfico de barras com valores de `media` (0–100%).

---

## Relatório Geral

### Endpoint: `GET /api/relatorios/estatisticas-gerais`
- Backend: `backend/routes/relatorios.js`.
- Campos calculados:
  - `total_questoes`: `COUNT(DISTINCT q.id)` apenas de gabaritos que possuem respostas.
  - `total_acertos`: `COUNT(*)` em `respostas` com `acertou = 1`.
  - `media_geral`: `AVG(CASE WHEN acertou = 1 THEN 100 ELSE 0 END)` em `respostas`.
  - `media_por_disciplina` (array por disciplina):
    - `media`: média em % por disciplina (vide cálculo acima).
    - `total_questoes`: `COUNT(DISTINCT q.id)` por disciplina.
    - `total_respostas`: `COUNT(r.id)` por disciplina.
    - `acertos`: `SUM(CASE WHEN r.acertou = 1 THEN 1 ELSE 0 END)`.
  - `por_etapa` (array por etapa/turma):
    - `total_questoes`: `COUNT(DISTINCT q.id)` do simulado (não multiplica por alunos).
    - `total_respostas`: `COUNT(DISTINCT r.id)`.
    - `acertos`: soma de acertos por etapa.
    - `media`: média de acertos % por etapa.
- Filtro por etapa (`?etapa=X`): aplica nas queries para retornar métricas específicas.

### Gráfico: Média de Acertos por Disciplina
- Frontend: `public/RelatorioGeral.html`.
- Dados: `estatisticas.media_por_disciplina`.
- Lógica:
  - Ordena por `media` (descendente).
  - Trunca nomes longos para melhor leitura.
  - Atualiza dinamicamente ao mudar `filtroTurma` (consulta com query param `etapa`).

---

## Relatório Individual

### Endpoint: `GET /api/relatorios/estatisticas-individual/:aluno_id`
- Backend: `backend/routes/relatorios.js`.
- Campos calculados (somente para o aluno):
  - `total_questoes`: `COUNT(*)` de respostas do aluno.
  - `total_acertos`: `COUNT(*)` de respostas do aluno com `acertou = 1`.
  - `taxa_acertos`: `AVG(CASE WHEN acertou = 1 THEN 100 ELSE 0 END)` do aluno.
  - `maior_media_disciplina` / `menor_media_disciplina`: nome das disciplinas extremas.
  - `media_por_disciplina` (array por disciplina do aluno):
    - `total_respostas`: total de respostas do aluno na disciplina.
    - `acertos`: acertos do aluno na disciplina.
    - `media`: média de acertos do aluno na disciplina.
  - `desempenho_tempo` (array por data):
    - Agrupa por `strftime('%Y-%m-%d', r.data_resposta)` do aluno.
    - Traz `total_questoes`, `acertos`, `media` por dia.
  - `desempenho_por_gabarito` (array por simulado):
    - Para cada gabarito respondido pelo aluno: `nome`, `etapa`, `total_questoes`, `acertos`, `media`, `data` da última resposta.

### Gráficos e Cards (Individual)
- Frontend: `public/GerarRelatorio.html`.
- Cards principais usam os campos: `total_questoes`, `total_acertos`, `taxa_acertos`, `maior_media_disciplina`, `menor_media_disciplina`.
- Gráfico “Desempenho ao Longo do Tempo”:
  - Usa `desempenho_por_gabarito` (prioritário) ou `desempenho_tempo`.
  - Formata datas e plota `media` %.
- Gráfico “Desempenho por Disciplina” (duas barras lado a lado):
  - Totais por disciplina do aluno:
    - `Questões` (total): `total_respostas` (fallback para `total_questoes` se existir).
    - `Acertos`: `acertos`.
  - Sem porcentagens; tooltips exibem valores absolutos.

---

## Decisões e Padrões
- Percentuais sempre calculados sobre respostas: `AVG(CASE WHEN acertou = 1 THEN 100 ELSE 0 END)`.
- Contagem de “Questões Aplicadas” no geral usa `COUNT(DISTINCT q.id)` para não multiplicar pelo número de alunos.
- Filtros por etapa aplicam-se nas queries do relatório geral; o gráfico de disciplinas se atualiza com o filtro.
- Para a evolução mensal, a referência temporal é `gabaritos.criado_em` (data de criação do simulado) para consolidar por mês.
- Sempre que possível, o frontend destrói o gráfico anterior antes de recriar (`chart.destroy()`), evitando erros de canvas.

---

## Endpoints Envolvidos
- `GET /api/alunos` – base para contagem de alunos.
- `GET /api/relatorios/estatisticas-gerais` – dashboard e Relatório Geral.
- `GET /api/relatorios/estatisticas-mensal` – série mensal agregada (home).
- `GET /api/relatorios/estatisticas-individual/:aluno_id` – Relatório Individual.

Se precisar de mais detalhes (ex.: trechos SQL específicos por tabela), posso anexar consultas comentadas por seção.
