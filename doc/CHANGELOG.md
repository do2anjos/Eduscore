# Changelog - Histórico de Alterações

Este documento registra todas as alterações significativas realizadas no projeto.

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

**Card 3 - Simulados Ativos** (NOVO):
- Número destacado: `3`
- Label: "simulados em andamento"
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

**Data da última atualização**: 2024
**Versão**: 1.0.0

