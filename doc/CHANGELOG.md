# Changelog - Histórico de Alterações

Este documento registra todas as alterações significativas realizadas no projeto.

**Última atualização**: 2025-01-21 15:00:00

---

## [2025-01-21] - Melhorias na Interface de Relatórios

### 🎯 Funcionalidade: Sanfona (Accordion) no Relatório Individual por Simulado

#### Problema
- Usuário precisava de uma forma de visualizar detalhes do gabarito e respostas do aluno por simulado
- Não havia uma interface para comparar respostas corretas com respostas capturadas do aluno

#### Solução
- **Arquivo modificado**: `public/GerarRelatorio.html`
- **Funcionalidade implementada**:
  - Célula "Simulado" agora é clicável com ícone ▶/▼
  - Ao clicar, expande uma linha adicional mostrando:
    - Tabela completa com todas as questões
    - Coluna "Questão": número da questão
    - Coluna "Gabarito": resposta correta (A, B, C, D, E)
    - Coluna "Capturada": resposta do aluno
    - Coluna "Status": ✓ Acertou / ✗ Errou / Não respondida
  - Carregamento assíncrono: dados são buscados apenas quando expandido pela primeira vez
  - Visual com cores diferenciadas (verde para acerto, vermelho para erro, cinza para não respondida)
  - Animações suaves de expansão/colapso

#### APIs utilizadas
- `GET /api/questoes/gabarito/:gabarito_id` - Busca questões do gabarito
- `GET /api/respostas?aluno_id=:id&gabarito_id=:id` - Busca respostas do aluno para o gabarito

#### Resultado
- Interface intuitiva para visualizar detalhes por simulado
- Comparação visual entre gabarito e respostas do aluno
- Melhor experiência do usuário ao analisar desempenho detalhado

---

### ⚡ Melhoria: Busca Automática ao Selecionar Aluno

#### Problema
- Ao clicar em um aluno da lista de sugestões, apenas preenchia o campo
- Usuário ainda precisava clicar no botão "Buscar" manualmente

#### Solução
- **Arquivo modificado**: `public/GerarRelatorio.html`
- **Mudança**:
  - Função `selecionarAluno()` agora é `async`
  - Chama automaticamente `buscarRelatorio()` após selecionar o aluno
  - Remove a necessidade de clicar no botão "Buscar"

#### Resultado
- Fluxo mais rápido e intuitivo
- Um único clique seleciona o aluno e busca o relatório automaticamente
- Melhor UX ao reduzir ações desnecessárias

---

## [2025-01-21] - Correções em Cálculos de Relatórios e Gráficos

### 🔧 Correção: Validação de Questões no Upload de CSV

#### Problema
- Questões inválidas (cabeçalhos processados como dados) eram criadas no banco
- Gabarito "DEZ - 1º Ano" mostrava 61 questões em vez de 60
- Questão com número "Questão" (cabeçalho) estava sendo salva

#### Solução
- **Arquivo modificado**: `backend/routes/gabaritos.js`
- **Melhorias implementadas**:
  - Validação de número da questão (deve ser entre 1 e 60)
  - Detecção e filtragem automática de cabeçalhos CSV
  - Validação de resposta (deve ser A, B, C, D ou E)
  - Rejeição de linhas com formato inválido com mensagens claras
- **Questão inválida removida**: Script executado para limpar questão com número inválido

#### Resultado
- Upload de CSV mais robusto e seguro
- Apenas questões válidas são criadas
- Gabaritos sempre têm a quantidade correta de questões

---

### 📊 Correção: Cálculo de Média por Disciplina em Relatórios

#### Problema
- Gráfico "Desempenho por Disciplina" mostrava 100% quando todas as respostas válidas eram corretas
- Questões não respondidas ou invalidadas não eram consideradas no cálculo
- Tooltip mostrava "X de X questões" em vez do total real de questões da disciplina

#### Solução
- **Arquivos modificados**: 
  - `backend/routes/relatorios.js`
  - `public/GerarRelatorio.html`
- **Mudanças na query**:
  - Mudança de `INNER JOIN respostas` para `LEFT JOIN respostas`
  - Agora considera TODAS as questões da disciplina (não apenas as respondidas)
  - Média calculada como: `(acertos válidos / total de questões da disciplina) * 100`
- **Correção do tooltip**:
  - Usa `total_questoes` (total da disciplina) em vez de `total_respostas`
  - Mostra corretamente "X acertos de Y questões"

#### Resultado
- Média reflete corretamente questões não respondidas/inválidas
- Tooltip mostra informações precisas
- Gráficos mais precisos e confiáveis

---

### 📈 Separação entre Média de Acertos e Taxa de Erro

#### Problema
- "Taxa de Erro por Disciplina" e "Média de Acertos por Disciplina" mostravam os mesmos valores
- Ambos usavam o mesmo campo `media` da API
- Cálculo de erro estava incorreto (usava COUNT DISTINCT em vez de COUNT)

#### Solução
- **Arquivos modificados**:
  - `backend/routes/relatorios.js`
  - `public/home.html`
  - `public/RelatorioGeral.html`
- **Mudanças na query**:
  - Campo `media`: Média de Acertos = (Acertos / Total de respostas válidas) * 100
  - Campo `taxa_erro`: Taxa de Erro = (Erros / Total de respostas válidas) * 100
  - Uso de `COUNT(*)` (não COUNT DISTINCT) para contar todas as respostas válidas
- **Atualização dos frontends**:
  - `RelatorioGeral.html` usa `media` (média de acertos)
  - `home.html` usa `taxa_erro` (taxa de erro)

#### Resultado
- Gráficos mostram informações diferentes e complementares
- Média de Acertos + Taxa de Erro = 100%
- Cálculos precisos usando todas as respostas válidas

---

### 📉 Gráfico "Retenção por Disciplina"

#### Problema
- Gráfico chamado "Taxa de Erro por Disciplina" deveria ser "Retenção por Disciplina"
- Ordenação estava do menor para o maior

#### Solução
- **Arquivo modificado**: `public/home.html`
- **Mudanças**:
  - Título alterado para "Retenção por Disciplina"
  - Label do dataset atualizado para "Retenção (%)"
  - Ordenação corrigida: maior taxa de erro (pior retenção) aparece primeiro (no topo)
  - Tooltip mantém informações de erros e total de respostas

#### Resultado
- Nomenclatura correta e consistente
- Ordenação lógica: disciplinas que precisam mais atenção aparecem primeiro
- Visualização clara da retenção por disciplina

---

### 🔍 Correção: Query de Estatísticas Gerais

#### Problema
- Endpoint `/api/relatorios/estatisticas-gerais` estava filtrando por aluno específico
- Query usava `INNER JOIN respostas` com filtro de aluno, mas deveria ser estatística geral
- Modo "Geral" não retornava dados corretos

#### Solução
- **Arquivo modificado**: `backend/routes/relatorios.js`
- **Mudanças**:
  - Removido filtro `AND r.aluno_id = $1` do modo Geral
  - Query agora agrega respostas de TODOS os alunos
  - Correção para calcular estatísticas gerais corretamente

#### Resultado
- Dashboard em `home.html` mostra dados gerais corretos
- Gráfico de retenção funciona corretamente com dados de todos os alunos
- Estatísticas gerais precisas e confiáveis

---

## [2025-11-16 18:30:00] - Correções de UI e Campo de Matrícula

### 🔧 Correção: Flash de Conteúdo na Sidebar

#### Problema
- Conteúdo hardcoded "Coordenador" aparecia brevemente antes dos dados reais carregarem
- Flash of Unstyled Content (FOUC) visível ao atualizar páginas

#### Solução
- **Arquivos modificados**: Todos os arquivos HTML com sidebar (9 arquivos)
  - `public/home.html`
  - `public/CadastrarGabarito.html`
  - `public/Cadastrar.html`
  - `public/AgendarSessao.html`
  - `public/CorrigirSimulado.html`
  - `public/GerarRelatorio.html`
  - `public/RelatorioGeral.html`
  - `public/configuracoes.html`
  - `public/meuperfil.html`

- **Mudanças**:
  - Removido conteúdo hardcoded "Coordenador" da sidebar
  - `<span>` inicia com `opacity: 0` até os dados carregarem
  - CSS adicionado para ocultar até atributo `data-loaded="true"`

- **Melhorias em `public/utils.js`**:
  - `updateUserProfile()` agora marca o perfil como carregado
  - Animação suave ao exibir dados após carregamento
  - Atributo `data-loaded="true"` adicionado após atualização

- **Melhorias em `public/style.css`**:
  - Regra CSS `.sidebar .profile:not([data-loaded]) span` para ocultar até carregar
  - Transição suave de opacidade

#### Resultado
- Flash de conteúdo eliminado completamente
- Perfil só aparece quando dados reais são carregados
- Experiência de usuário melhorada

---

### 📝 Campo de Matrícula no Cadastro de Alunos

#### Implementação
- **Arquivo**: `public/Cadastrar.html`
- **Data**: 2025-11-16 18:30:00

#### Mudanças
- Adicionado campo obrigatório "Matrícula" no formulário
- Posicionado após "Nome Completo" e antes de "E-mail"
- Campo incluído no `formData` enviado para a API
- Hint explicativo: "Matrícula única do aluno na instituição"

#### Compatibilidade
- Backend já suporta campo `matricula` (campo `NOT NULL UNIQUE` no banco)
- Validação automática de duplicatas via constraint do banco
- Integração completa com API `/api/alunos`

---

### 🔌 Melhorias no Consumo de API

#### Arquivo: `public/CadastrarGabarito.html`
- **Data**: 2025-11-16 18:30:00

#### Mudanças
- **POST /api/gabaritos** (Cadastrar gabarito):
  - Verificação de `response.ok` antes de parsear JSON
  - Tratamento de erros HTTP melhorado
  - Validação de `data.sucesso` corrigida
  - Extração de `gabaritoId` melhorada com fallbacks

- **POST /api/gabaritos/upload** (Upload CSV):
  - Verificação de `content-type` antes de parsear JSON
  - Tratamento de erros não bloqueante
  - Logs detalhados para diagnóstico

- **GET /api/gabaritos** (Listar gabaritos):
  - Compatível com formato `{sucesso: true, gabaritos: []}`
  - Fallbacks para diferentes formatos de resposta
  - Tratamento de erros HTTP aprimorado

- **DELETE /api/gabaritos/:id** (Excluir gabarito):
  - Verificação de `response.ok` antes de parsear JSON
  - Uso de `data.mensagem` da resposta da API
  - Validação de `data.sucesso === false`
  - Indentação corrigida

#### Resultado
- Todas as rotas da API agora têm tratamento de erro robusto
- Mensagens de erro mais específicas e informativas
- Compatibilidade total com formato de resposta da API
- Logs detalhados para diagnóstico de problemas

---

### 📊 Resumo das Alterações

#### Arquivos Modificados (16 arquivos)
- **Backend**:
  - `backend/routes/gabaritos.js` - Melhorias de parsing CSV
  - `backend/routes/relatorios.js` - Novas rotas e melhorias

- **Frontend HTML (9 arquivos)**:
  - Remoção de conteúdo hardcoded na sidebar
  - Adição de campo matrícula em `Cadastrar.html`

- **Frontend JavaScript/CSS**:
  - `public/utils.js` - Melhorias no carregamento de perfil
  - `public/style.css` - Estilos para ocultar conteúdo até carregar
  - `public/CadastrarGabarito.html` - Melhorias no consumo de API

- **Scripts**:
  - `limpar-dados.js` - Melhorias
  - `populate-database.js` - Melhorias

#### Funcionalidades
- ✅ Flash de conteúdo na sidebar eliminado
- ✅ Campo de matrícula adicionado ao cadastro
- ✅ Consumo de API robusto e com tratamento de erros
- ✅ Melhor experiência do usuário

---

## [2025-11-16 17:41:12] - Relatório Individual: Filtros e Previsão

### 📊 Relatório Individual por Simulado

#### Nova Seção: Tabela de Simulados
- **Arquivo**: `public/GerarRelatorio.html`
- **Data**: 2025-11-16 17:41:12
- **Implementações**:
  - Nova tabela mostrando desempenho do aluno por simulado
  - Colunas: Simulado, Etapa, Questões, Acertos, Média (%), Data
  - Cores condicionais por desempenho:
    - Verde (≥70%): `rgba(46, 204, 113, 0.1)`
    - Amarelo (50-69%): `rgba(241, 196, 15, 0.1)`
    - Vermelho (<50%): `rgba(231, 76, 60, 0.1)`
  - Ordenação por data (mais recente primeiro)
  - Efeito hover nas linhas
  - Mensagem informativa quando não há simulados
- **Função JavaScript**: `atualizarTabelaSimulados()`
- **Posicionamento**: Após o gráfico "Desempenho ao Longo do Tempo"

#### Filtro por Simulado no Gráfico de Disciplinas
- **Arquivo**: `public/GerarRelatorio.html`
- **Data**: 2025-11-16 17:41:12
- **Implementações**:
  - Dropdown no header do gráfico "Desempenho por Disciplina"
  - Opção "Geral" (mostra todas as disciplinas)
  - Opções dinâmicas com simulados já feitos pelo aluno
  - Cache inteligente para evitar requisições repetidas
  - Tratamento de erros aprimorado (404, 500, conexão)
  - Reset automático para "Geral" ao carregar novo relatório
- **Função JavaScript**: `filtrarDisciplinasPorSimulado()`, `popularDropdownSimulados()`
- **Rota API**: `GET /api/relatorios/estatisticas-individual/:aluno_id/disciplinas/:gabarito_id`

#### Novo Card: Previsão
- **Arquivo**: `public/GerarRelatorio.html`
- **Data**: 2025-11-16 17:41:12
- **Implementações**:
  - Card "Previsão" no grid de métricas
  - Valor: "N/A" (aguardando implementação do modelo de predição)
  - Legenda: "N° acertos esperado no dia da prova"
  - Ícone: 🔮
  - ID do elemento: `previsaoAcertos`

#### Melhorias no Backend

##### Nova Rota: Desempenho por Disciplina Filtrado por Gabarito
- **Arquivo**: `backend/routes/relatorios.js`
- **Data**: 2025-11-16 17:41:12
- **Rota**: `GET /api/relatorios/estatisticas-individual/:aluno_id/disciplinas/:gabarito_id`
- **Implementações**:
  - Retorna desempenho por disciplina para um aluno específico filtrado por simulado
  - Validação de parâmetros (aluno_id e gabarito_id)
  - Verificação de existência de aluno e gabarito
  - Tratamento de erros melhorado com detalhes em desenvolvimento
  - Query SQL otimizada com INNER JOIN e filtros WHERE

##### Correção no Mapeamento de Parâmetros SQL
- **Arquivo**: `backend/db.js`
- **Data**: 2025-11-16 17:41:12
- **Problema**: Erro "Too few parameter values were provided" ao usar o mesmo parâmetro múltiplas vezes
- **Solução**:
  - Ajuste na função `convertPostgresToSQLite()` para mapear corretamente parâmetros duplicados
  - Quando `$2` aparece múltiplas vezes, o valor é incluído múltiplas vezes no array de parâmetros
  - Extração da ordem dos parâmetros da query original para garantir correspondência correta

#### Melhorias no Tratamento de Erros
- **Arquivo**: `public/GerarRelatorio.html`
- **Data**: 2025-11-16 17:41:12
- **Implementações**:
  - Mensagens de erro específicas por tipo (404, 500, conexão)
  - Detecção de erros de conexão (`ERR_CONNECTION_REFUSED`, `ERR_CONNECTION_RESET`)
  - Reset automático para "Geral" em caso de erro
  - Exibição de detalhes de erro do servidor em modo desenvolvimento
  - Tratamento gracioso quando não há dados

**Arquivos Afetados**:
- `public/GerarRelatorio.html` (+150 linhas)
- `backend/routes/relatorios.js` (+80 linhas)
- `backend/db.js` (+30 linhas de lógica)

---

## [2024] - Melhorias de UX e Design System

### 🎨 Aplicação das 10 Heurísticas de Nielsen

#### 1. Visibilidade do Status do Sistema
- **Arquivo**: `public/utils.js`, `public/style.css`
- **Implementações**:
  - Sistema de Toast Notifications (sucesso, erro, aviso, info)
  - Loading states em botões e overlay global
  - Progress bars para operações longas
  - Status indicators visuais com cores e ícones
- **Classes CSS**: `.toast`, `.loading-overlay`, `.loading-spinner`, `.status-indicator`
- **Funções JS**: `showToast()`, `showLoading()`, `hideLoading()`

#### 2. Correspondência entre Sistema e Mundo Real
- **Implementações**:
  - Ícones familiares (Icons8) em toda navegação
  - Linguagem clara e natural em português
  - Metáforas visuais conhecidas (home, calendário, relatório)

#### 3. Controle e Liberdade do Usuário
- **Arquivo**: `public/utils.js`, `public/style.css`
- **Implementações**:
  - Botões "Cancelar" em todos os formulários
  - Diálogos de confirmação para ações destrutivas (`showConfirmDialog()`)
  - Botão "Voltar" em processos multi-etapa
  - Breadcrumbs em todas as páginas internas
- **Classes CSS**: `.btn-secondary`, `.confirm-dialog`, `.breadcrumb`

#### 4. Consistência e Padrões
- **Implementações**:
  - Navegação consistente (sidebar padrão em todas as páginas)
  - Paleta de cores padronizada (#008cc4, #003b54)
  - Botões com estilos consistentes
  - Breadcrumbs em todas as páginas internas

#### 5. Prevenção de Erros
- **Arquivo**: `public/utils.js`, `public/style.css`
- **Implementações**:
  - Validação em tempo real de formulários
  - Função `validateForm()` centralizada
  - Hints e dicas nos campos de entrada
  - Confirmações para ações irreversíveis
  - Formatação automática de telefone
- **Classes CSS**: `.input-hint`, validação CSS (`:invalid`, `:valid`)

#### 6. Reconhecimento ao Invés de Recordação
- **Implementações**:
  - Labels descritivos em todos os campos
  - Placeholders informativos
  - Hints contextuais abaixo dos campos
  - Autocomplete HTML5
- **Classes CSS**: `.input-hint`, `.tooltip`

#### 7. Flexibilidade e Eficiência de Uso
- **Arquivo**: `public/utils.js`
- **Implementações**:
  - Atalhos de teclado:
    - `Ctrl/Cmd + S` para salvar
    - `Esc` para fechar modais
    - `Enter` para submeter formulários
  - Indicadores visuais de atalhos
- **Função JS**: `setupKeyboardShortcuts()`
- **Classes CSS**: `.keyboard-shortcut`

#### 8. Design Estético e Minimalista
- **Arquivo**: `public/style.css`
- **Implementações**:
  - Cards limpos com gradientes sutis
  - Espaçamento consistente
  - Hierarquia visual clara
  - Empty states informativos
- **Classes CSS**: `.card`, `.empty-state`

#### 9. Ajudar Usuários a Reconhecer e Recuperar de Erros
- **Arquivo**: `public/style.css`, `public/utils.js`
- **Implementações**:
  - Mensagens de erro claras e acionáveis
  - Error boxes destacadas
  - Validação visual (campos em vermelho)
  - Sugestões de correção
- **Classes CSS**: `.error-box`, `.error-message`, `.input-hint.error`

#### 10. Ajuda e Documentação
- **Arquivo**: `public/utils.js`, `public/style.css`
- **Implementações**:
  - Botão de ajuda flutuante em todas as páginas
  - Painel de ajuda contextual
  - Tooltips em elementos complexos
  - Atalhos visíveis na interface
- **Funções JS**: `setupHelpButton()`, `getHelpContent()`
- **Classes CSS**: `.help-button`, `.help-panel`, `.tooltip`

---

### 📐 Melhorias na Sidebar

#### Tipografia e Legibilidade
- **Arquivo**: `public/style.css`
- **Alterações**:
  - Largura aumentada: `185px` → `240px`
  - Fonte dos links: `12px` → `15px` (padrão do projeto)
  - Fonte do perfil: `13px` → `16px` (font-weight: 600)
  - Email (small): `10px` → `13px`
  - Ícones: `24px` → `22px` (proporção ajustada)

#### Espaçamento e Layout
- **Alterações**:
  - Padding dos links: `7px 15px` → `14px 16px`
  - Gap entre links: `4px`
  - Padding da sidebar: `20px` → `24px`
  - Espaçamento do perfil: `margin-bottom 40px` → `32px`
  - Margin-left do content: `185px` → `240px`

#### Visual e Interatividade
- **Alterações**:
  - Melhor contraste: email em `#b0d4e8`
  - Efeito hover: `translateX(4px)` e sombra
  - Estado ativo: cor `#007aa3` e `font-weight: 600`
  - Sombra na sidebar: `box-shadow` para profundidade
  - Imagem do perfil: `63px` → `72px` com sombra

#### Dropdown
- **Alterações**:
  - Fonte dos sub-itens: `11px` → `14px`
  - Padding: `5px 8px` → `10px 16px`
  - Melhor contraste e espaçamento

#### Responsividade
- **Alterações**:
  - Ajustes mantidos para mobile
  - Tamanhos proporcionais em telas menores

**Arquivos Afetados**:
- `public/style.css` (seção `.sidebar`, `.nav-links`, `.dropdown`)
- Todos os HTMLs com sidebar (home.html, Cadastrar.html, etc.)

---

### 🏠 Modernização do home.html

#### Remoção de Elementos
- **Removido**: Seção `.notifications` completa
- **Motivo**: Simplificar layout e focar em métricas principais

#### Novo Layout de Cards
- **Arquivo**: `public/home.html`, `public/style.css`
- **Implementações**:
  - Grid responsivo: `metrics-grid` com `grid-template-columns: repeat(auto-fit, minmax(320px, 1fr))`
  - Cards modernos com gradiente sutil e sombras
  - Efeito hover: elevação e sombra mais forte
  - Bordas arredondadas (20px)

#### Cards Reorganizados

**Card 1 - Alunos Ativos**:
- Gráfico gauge (semicírculo) com porcentagem central
- Valor destacado (350) ao lado do gráfico
- Layout lado a lado (gráfico + valor)
- Texto centralizado: "87.5%" e "Taxa de ativos"
- Ajuste de posicionamento para evitar sobreposição com barra

**Card 2 - Progresso Mensal**:
- Gráfico de barras horizontal
- Cores atualizadas para padrão do projeto (#008cc4)
- Tooltips estilizados
- Altura ajustada: `180px`

**Card 3 - Simulados aplicados** (NOVO):
- Número destacado: `3`
- Label: "simulados aplicados"
- Ícone: 📝
- Layout centralizado
- Altura: `200px` (alinhado com Progresso Mensal)

**Card 4 - Retenção por Disciplina** (full-width):
- Ocupa toda a largura (`grid-column: 1 / -1`)
- Cores dinâmicas por faixa de retenção:
  - Verde (≥80%): `#28a745`
  - Azul (≥70%): `#008cc4`
  - Amarelo (<70%): `#ffc107`
- Altura: `320px`

#### Melhorias Visuais
- **Header do Dashboard**:
  - Título maior: `28px` (font-weight: 700)
  - Subtítulo descritivo: "Aqui está um resumo do seu desempenho"
  - Melhor espaçamento: `margin-bottom: 32px`
  - Letter-spacing otimizado: `-0.5px`

- **Tipografia**:
  - Font-weight ajustado (600 para títulos)
  - Letter-spacing otimizado
  - Hierarquia visual clara

- **Cores**:
  - Paleta consistente com projeto
  - Contraste adequado
  - Gradientes sutis

#### Gráficos Atualizados
- **Gauge Alunos**:
  - Cores: `#008cc4` (ativo), `#e0e0e0` (inativo)
  - Cutout: `75%`
  - Texto central: "87.5%" e "Taxa de ativos"
  - Posicionamento ajustado: `height / 2 + 5` (evita sobreposição)

- **Progresso Mensal**:
  - BorderRadius: `8px`
  - Tooltips estilizados
  - Grid lines suaves: `#f0f0f0`

- **Retenção por Disciplina**:
  - BarThickness: `28px`
  - Cores dinâmicas por valor
  - Tooltips informativos

#### Responsividade
- Grid adapta-se automaticamente
- Cards empilham em telas menores
- Alturas dos gráficos ajustadas

**Arquivos Afetados**:
- `public/home.html`
- `public/style.css` (novas classes: `.metrics-grid`, `.metric-card-modern`, `.metric-card-header`, `.metric-icon`, `.metric-value`, `.value-number`, `.value-label`)

---

### 📄 Arquivos Criados

1. **`public/utils.js`**
   - Utilitários JavaScript para implementação das heurísticas
   - Funções: `showToast()`, `showLoading()`, `hideLoading()`, `showConfirmDialog()`, `validateForm()`, `setupKeyboardShortcuts()`, `setupHelpButton()`

2. **`doc/HEURISTICAS_NIELSEN.md`**
   - Documentação completa das 10 heurísticas implementadas
   - Exemplos de uso
   - Guia de implementação

3. **`doc/CHANGELOG.md`** (este arquivo)
   - Histórico completo de alterações

---

### 🔧 Arquivos Modificados

#### HTML
- `public/login.html` - Adicionado validação, toast, loading states
- `public/home.html` - Modernização completa, novo layout de cards
- `public/Cadastrar.html` - Validação, breadcrumbs, botão cancelar
- `public/CadastrarGabarito.html` - Confirmação de exclusão, toast
- `public/AgendarSessao.html` - Validação, confirmação, toast
- `public/perfil.html` - Toast notifications
- `public/redefinir.html` - Validação, loading, toast
- `public/CorrigirSimulado.html` - Toast notifications
- `public/RelatorioGeral.html` - Breadcrumbs
- `public/GerarRelatorio.html` - Breadcrumbs
- `public/Disciplinas.html` - Script utils.js
- `public/index.html` - Script utils.js

#### CSS
- `public/style.css` - +600 linhas de novos estilos:
  - Estilos para heurísticas (toast, loading, dialogs, etc.)
  - Melhorias na sidebar
  - Cards modernos para dashboard
  - Breadcrumbs
  - Tooltips
  - Help panel
  - Acessibilidade (focus-visible, ARIA)

---

### 🎯 Melhorias de Acessibilidade

- **ARIA Labels**: Atributos ARIA em navegação
- **Focus Visible**: Contornos de foco visíveis para navegação por teclado
- **Alt Text**: Textos alternativos em todas as imagens
- **Semantic HTML**: Uso correto de tags semânticas (nav, main, aside)
- **Screen Reader**: Classes `.sr-only` para conteúdo apenas para leitores de tela

---

### 📊 Estatísticas

- **Linhas de CSS adicionadas**: ~600
- **Linhas de JavaScript adicionadas**: ~290
- **Arquivos HTML modificados**: 12
- **Novos componentes**: 15+
- **Heurísticas implementadas**: 10/10

---

### 🚀 Próximos Passos Sugeridos

1. Integração com API real para dados dinâmicos
2. Testes de acessibilidade (WCAG)
3. Otimização de performance
4. Documentação de componentes
5. Testes de usabilidade

---

**Data da última atualização**: 2025-11-16 17:41:12
**Versão**: 1.0.0

