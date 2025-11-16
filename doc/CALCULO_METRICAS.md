# Documentação de Cálculo de Métricas e Gráficos

**Última atualização**: 2025-11-16 17:41:12

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
  - **Relatório Individual por Simulado** (NOVO - 2025-11-16)
  - Desempenho por disciplina do aluno
  - **Filtro por Simulado no Gráfico de Disciplinas** (NOVO - 2025-11-16)
  - **Card de Previsão** (NOVO - 2025-11-16)

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
- **Card de Previsão** (NOVO - 2025-11-16 17:41:12):
  - Valor: "N/A" (aguardando implementação do modelo de predição)
  - Legenda: "N° acertos esperado no dia da prova"
  - Elemento: `#previsaoAcertos`

#### Gráfico "Desempenho ao Longo do Tempo"
- Usa `desempenho_por_gabarito` (prioritário) ou `desempenho_tempo`.
- Formata datas e plota `media` %.

#### Tabela "Relatório Individual por Simulado" (NOVO - 2025-11-16 17:41:12)
- **Dados**: `desempenho_por_gabarito` do endpoint de estatísticas individuais
- **Colunas**:
  - Simulado (nome do gabarito)
  - Etapa
  - Questões (total respondidas)
  - Acertos (quantidade)
  - Média (%) com cores condicionais:
    - Verde (≥70%): `#2ecc71`
    - Amarelo (50-69%): `#f1c40f`
    - Vermelho (<50%): `#e74c3c`
  - Data (formato brasileiro DD/MM/YYYY)
- **Ordenação**: Por data (mais recente primeiro)
- **Efeito**: Hover nas linhas da tabela
- **Função**: `atualizarTabelaSimulados()`

#### Gráfico "Desempenho por Disciplina" com Filtro por Simulado (NOVO - 2025-11-16 17:41:12)
- **Filtro Dropdown**: 
  - Opção "Geral" (mostra todas as disciplinas)
  - Opções dinâmicas com simulados já feitos pelo aluno
- **Dados Gerais**: `media_por_disciplina` do endpoint `estatisticas-individual/:aluno_id`
- **Dados por Simulado**: `media_por_disciplina` do endpoint `estatisticas-individual/:aluno_id/disciplinas/:gabarito_id`
- **Cache**: Dados por simulado são cacheados para evitar requisições repetidas
- **Totais por disciplina**:
  - `Questões` (total): `total_respostas` (fallback para `total_questoes` se existir)
  - `Acertos`: `acertos`
- **Sem porcentagens**; tooltips exibem valores absolutos
- **Funções**: `filtrarDisciplinasPorSimulado()`, `popularDropdownSimulados()`, `atualizarGraficoDisciplinas()`

#### Endpoint: `GET /api/relatorios/estatisticas-individual/:aluno_id/disciplinas/:gabarito_id` (NOVO)
- **Adicionado em**: 2025-11-16 17:41:12
- **Backend**: `backend/routes/relatorios.js`
- **Parâmetros**:
  - `aluno_id`: ID do aluno
  - `gabarito_id`: ID do gabarito (simulado)
- **Query SQL**:
  ```sql
  SELECT 
    d.id, d.nome,
    COUNT(r.id) as total_respostas,
    SUM(CASE WHEN r.acertou = 1 THEN 1 ELSE 0 END) as acertos,
    ROUND(AVG(CASE WHEN r.acertou = 1 THEN 100.0 ELSE 0.0 END), 2) as media
  FROM disciplinas d
  INNER JOIN questoes q ON d.id = q.disciplina_id
  INNER JOIN respostas r ON q.id = r.questao_id
  WHERE q.gabarito_id = $2
    AND r.aluno_id = $1
    AND r.gabarito_id = $2
  GROUP BY d.id, d.nome
  ORDER BY media DESC
  ```
- **Retorna**: Array de disciplinas com média, total_respostas e acertos filtrados por simulado

---

## Decisões e Padrões
- Percentuais sempre calculados sobre respostas: `AVG(CASE WHEN acertou = 1 THEN 100 ELSE 0 END)`.
- Contagem de "Questões Aplicadas" no geral usa `COUNT(DISTINCT q.id)` para não multiplicar pelo número de alunos.
- Filtros por etapa aplicam-se nas queries do relatório geral; o gráfico de disciplinas se atualiza com o filtro.
- Para a evolução mensal, a referência temporal é `gabaritos.criado_em` (data de criação do simulado) para consolidar por mês.
- Sempre que possível, o frontend destrói o gráfico anterior antes de recriar (`chart.destroy()`), evitando erros de canvas.
- **Filtro por Simulado** (2025-11-16 17:41:12):
  - Dados por simulado são cacheados no frontend para evitar requisições repetidas
  - Ao selecionar "Geral", usa dados já carregados (sem requisição adicional)
  - Quando não há dados para um simulado específico, retorna array vazio ao invés de erro
  - Reset automático para "Geral" ao carregar novo relatório de aluno
- **Tratamento de Erros** (2025-11-16 17:41:12):
  - Mensagens específicas por tipo de erro (404, 500, conexão)
  - Detecção de erros de conexão com mensagens claras
  - Reset automático de filtros em caso de erro
  - Exibição de detalhes técnicos apenas em modo desenvolvimento
- **Mapeamento de Parâmetros SQL** (2025-11-16 17:41:12):
  - Quando um parâmetro (`$1`, `$2`) é usado múltiplas vezes, o valor correspondente é incluído múltiplas vezes no array de parâmetros SQLite
  - Ordem dos parâmetros segue a ordem de aparição dos placeholders na query original

---

## Endpoints Envolvidos
- `GET /api/alunos` – base para contagem de alunos.
- `GET /api/relatorios/estatisticas-gerais` – dashboard e Relatório Geral.
- `GET /api/relatorios/estatisticas-mensal` – série mensal agregada (home).
- `GET /api/relatorios/estatisticas-individual/:aluno_id` – Relatório Individual.
- `GET /api/relatorios/estatisticas-individual/:aluno_id/disciplinas/:gabarito_id` – Desempenho por disciplina filtrado por simulado (NOVO - 2025-11-16 17:41:12).

Se precisar de mais detalhes (ex.: trechos SQL específicos por tabela), posso anexar consultas comentadas por seção.

