# Documentação de Cálculo de Métricas e Gráficos

**Última atualização**: 2025-01-XX  
**Versão**: 2.0.0

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
- **Endpoints de Disciplinas** (NOVO - 2025-01-XX)
  - Estatísticas gerais de disciplinas
  - Relatório por disciplina específica
- **Critérios de Validação de Respostas** (NOVO - 2025-01-XX)
  - Definição de resposta válida
  - Impacto nos cálculos
- **Modos de Cálculo: Geral vs. Por Etapa** (NOVO - 2025-01-XX)
  - Diferenças fundamentais
  - Quando usar cada modo

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

## Endpoints de Disciplinas

### Endpoint: `GET /api/disciplinas/estatisticas`
- **Backend**: `backend/routes/disciplinas.js`
- **Descrição**: Retorna estatísticas gerais sobre todas as disciplinas
- **Campos calculados**:
  - `total`: `COUNT(*)` de todas as disciplinas cadastradas
  - `mais_ativas` (array): Top 5 disciplinas com mais questões
    - `id`: ID da disciplina
    - `nome`: Nome da disciplina
    - `total_questoes`: `COUNT(q.id)` - Total de questões da disciplina
- **Query SQL**:
  ```sql
  -- Total de disciplinas
  SELECT COUNT(*) FROM disciplinas
  
  -- Disciplinas mais ativas (Top 5)
  SELECT d.id, d.nome, COUNT(q.id) as total_questoes
  FROM disciplinas d
  LEFT JOIN questoes q ON d.id = q.disciplina_id
  GROUP BY d.id
  ORDER BY total_questoes DESC
  LIMIT 5
  ```
- **Observações**:
  - Usa `LEFT JOIN` para incluir disciplinas sem questões (com `total_questoes = 0`)
  - Ordena por `total_questoes` em ordem decrescente
  - Limita a 5 resultados

### Endpoint: `GET /api/disciplinas/:id/relatorio`
- **Backend**: `backend/routes/disciplinas.js`
- **Descrição**: Retorna métricas detalhadas de uma disciplina específica
- **Parâmetros**:
  - `id`: ID da disciplina
- **Campos calculados**:
  - `total_questoes`: `COUNT(q.id)` - Total de questões da disciplina
  - `total_respostas`: `COUNT(DISTINCT r.id)` - Total de respostas únicas
  - `percentual_acertos`: `ROUND(AVG(CASE WHEN r.acertou THEN 1 ELSE 0 END) * 100, 2)`
    - **Fórmula**: Média de acertos convertida para percentual (0-100%)
    - **Observação**: Usa `AVG(...) * 100` ao invés de `AVG(CASE WHEN ... THEN 100 ELSE 0 END)`
- **Query SQL**:
  ```sql
  SELECT
    COUNT(q.id) AS total_questoes,
    COUNT(DISTINCT r.id) AS total_respostas,
    ROUND(
      AVG(CASE WHEN r.acertou THEN 1 ELSE 0 END) * 100, 2
    ) AS percentual_acertos
  FROM questoes q
  LEFT JOIN respostas r ON q.id = r.questao_id
  WHERE q.disciplina_id = $1
  ```
- **Observações**:
  - Usa `LEFT JOIN` para incluir questões sem respostas
  - `COUNT(DISTINCT r.id)` evita contar a mesma resposta múltiplas vezes
  - O percentual é calculado sobre todas as respostas da disciplina, não apenas respostas válidas

---

## Critérios de Validação de Respostas

### Definição de Resposta Válida

Uma resposta é considerada **válida** quando atende **TODOS** os seguintes critérios:

1. **`resposta_aluno IS NOT NULL`**: A resposta não pode ser nula
2. **`resposta_aluno != ''`**: A resposta não pode ser uma string vazia
3. **`resposta_aluno NOT LIKE '%,%'`**: A resposta não pode conter vírgula (indica dupla marcação)

### Impacto nos Cálculos

Os critérios de validação são aplicados em **queries específicas** que precisam considerar apenas respostas válidas:

#### Exemplo: Contagem de Respostas Válidas
```sql
COUNT(CASE 
  WHEN r.resposta_aluno IS NOT NULL 
    AND r.resposta_aluno != '' 
    AND r.resposta_aluno NOT LIKE '%,%'
  THEN 1
  ELSE NULL
END) as total_respostas
```

#### Exemplo: Contagem de Acertos Válidos
```sql
SUM(CASE 
  WHEN r.resposta_aluno IS NOT NULL 
    AND r.resposta_aluno != '' 
    AND r.resposta_aluno NOT LIKE '%,%'
    AND r.acertou = 1 
  THEN 1 
  ELSE 0 
END) as acertos
```

#### Exemplo: Cálculo de Média com Respostas Válidas
```sql
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
) as media
```

### Onde os Critérios São Aplicados

- ✅ **Relatório Geral (Modo Geral)**: Usa respostas válidas para calcular `media` e `taxa_erro`
- ✅ **Relatório Individual**: Usa respostas válidas para calcular médias por disciplina
- ✅ **Relatório Individual por Simulado**: Usa respostas válidas para filtrar por gabarito
- ❌ **Relatório por Disciplina** (`/api/disciplinas/:id/relatorio`): **NÃO** aplica critérios de validação (considera todas as respostas)

### Observações Importantes

- **Dupla Marcação**: Respostas com vírgula (ex: "A,B") são consideradas inválidas e **não** entram nos cálculos
- **Respostas Vazias**: Respostas vazias ou nulas são **ignoradas** nos cálculos de média
- **NULLIF**: Usado para evitar divisão por zero quando não há respostas válidas

---

## Modos de Cálculo: Geral vs. Por Etapa

### Modo Geral

**Quando usar**: Visualizar métricas consolidadas de todas as etapas/turmas

**Características**:
- **Contagem de Respostas**: `COUNT(CASE ...)` - Conta **TODAS** as respostas válidas
- **Contagem de Questões**: `COUNT(DISTINCT q.id)` - Conta questões únicas
- **Cálculo de Média**: `(Acertos / Total de respostas válidas) * 100`
- **Filtro**: Não aplica filtro por etapa

**Query Exemplo**:
```sql
SELECT 
  d.id, d.nome,
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
  ) as media
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
```

**Resultado**: Média de acertos considerando **todas as respostas válidas** de todas as etapas

### Modo Por Etapa

**Quando usar**: Visualizar métricas específicas de uma etapa/turma

**Características**:
- **Contagem de Respostas**: `COUNT(DISTINCT CASE ...)` - Conta respostas **únicas** válidas
- **Contagem de Questões**: `COUNT(DISTINCT q.id)` - Conta questões únicas da etapa
- **Cálculo de Média**: `(Acertos / Total de questões da disciplina na etapa) * 100`
- **Filtro**: `WHERE g.etapa = $1` - Aplica filtro por etapa

**Query Exemplo**:
```sql
SELECT 
  d.id, d.nome,
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
LEFT JOIN respostas r ON q.id = r.questao_id AND r.gabarito_id = g.id
WHERE g.etapa = $1
GROUP BY d.id, d.nome
HAVING COUNT(DISTINCT q.id) > 0
ORDER BY media DESC
```

**Resultado**: Média de acertos considerando **questões únicas** da disciplina na etapa específica

### Diferenças Fundamentais

| Aspecto | Modo Geral | Modo Por Etapa |
|---------|------------|----------------|
| **Base de Cálculo** | Total de respostas válidas | Total de questões únicas |
| **Denominador** | `COUNT(CASE ...)` (respostas válidas) | `COUNT(DISTINCT q.id)` (questões) |
| **Filtro** | Nenhum | `WHERE g.etapa = $1` |
| **Interpretação** | Taxa de acertos sobre respostas | Taxa de acertos sobre questões |
| **Uso** | Dashboard geral, comparação entre disciplinas | Análise específica por turma/etapa |

### Exemplo Prático

**Cenário**: Disciplina "Matemática" com 60 questões, 50 respostas válidas, 40 acertos

- **Modo Geral**: `media = (40 / 50) * 100 = 80%` (taxa de acertos sobre respostas)
- **Modo Por Etapa**: `media = (40 / 60) * 100 = 66.67%` (taxa de acertos sobre questões)

**Por que a diferença?**
- Modo Geral considera apenas alunos que responderam (50 respostas)
- Modo Por Etapa considera todas as questões do simulado (60 questões), incluindo não respondidas

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

### Endpoints de Relatórios
- `GET /api/alunos` – base para contagem de alunos.
- `GET /api/relatorios/estatisticas-gerais` – dashboard e Relatório Geral.
- `GET /api/relatorios/estatisticas-mensal` – série mensal agregada (home).
- `GET /api/relatorios/estatisticas-individual/:aluno_id` – Relatório Individual.
- `GET /api/relatorios/estatisticas-individual/:aluno_id/disciplinas/:gabarito_id` – Desempenho por disciplina filtrado por simulado (NOVO - 2025-11-16 17:41:12).

### Endpoints de Disciplinas
- `GET /api/disciplinas/estatisticas` – Estatísticas gerais de disciplinas (NOVO - 2025-01-XX).
- `GET /api/disciplinas/:id/relatorio` – Relatório detalhado de uma disciplina específica (NOVO - 2025-01-XX).

---

## Exemplos de Queries SQL Completas

### Query: Estatísticas Gerais (Modo Geral)
```sql
-- Total de questões aplicadas
SELECT COUNT(DISTINCT q.id) as total 
FROM questoes q
INNER JOIN gabaritos g ON q.gabarito_id = g.id
WHERE g.id IN (
  SELECT DISTINCT gabarito_id 
  FROM respostas
)

-- Total de acertos
SELECT COUNT(*) as total 
FROM respostas r 
WHERE r.acertou = 1

-- Média geral de acertos
SELECT ROUND(AVG(CASE WHEN acertou = 1 THEN 100 ELSE 0 END), 2) as media
FROM respostas

-- Média por disciplina (Modo Geral)
SELECT 
  d.id, d.nome,
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
  ) as media
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
```

### Query: Estatísticas Individuais
```sql
-- Total de questões respondidas pelo aluno
SELECT COUNT(*) as total 
FROM respostas 
WHERE aluno_id = $1

-- Total de acertos do aluno
SELECT COUNT(*) as total 
FROM respostas 
WHERE aluno_id = $1 AND acertou = 1

-- Taxa de acertos geral do aluno
SELECT ROUND(AVG(CASE WHEN acertou = 1 THEN 100 ELSE 0 END), 2) as taxa
FROM respostas 
WHERE aluno_id = $1

-- Média por disciplina do aluno
SELECT 
  d.id, d.nome,
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
```

### Query: Evolução Mensal
```sql
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
```

---

**Última atualização**: 2025-01-XX  
**Versão**: 2.0.0

Se precisar de mais detalhes (ex.: trechos SQL específicos por tabela), consulte as seções acima ou o código-fonte em `backend/routes/relatorios.js` e `backend/routes/disciplinas.js`.

