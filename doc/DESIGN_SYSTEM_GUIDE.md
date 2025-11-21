# Guia de Design System - EduScore

Este documento serve como referência completa para o design system do EduScore, definindo componentes, padrões de uso e estrutura de páginas.

---

## Índice

1. [Variáveis CSS](#variáveis-css)
2. [Componentes Base](#componentes-base)
3. [Layout](#layout)
4. [Estrutura de Páginas](#estrutura-de-páginas)
5. [Padrões de Uso](#padrões-de-uso)
6. [Exemplos Práticos](#exemplos-práticos)

---

## Variáveis CSS

### Cores

#### Cores Primárias (Azul)
```css
--color-primary: #008cc4;        /* Azul principal */
--color-primary-dark: #0073a6;   /* Azul escuro (hover) */
--color-primary-darker: #003b54; /* Azul muito escuro (textos, headers) */
--color-primary-light: #00a3d9;  /* Azul claro */
```

#### Cores Secundárias (Verde Educacional)
```css
--color-secondary: #10B981;           /* Verde principal */
--color-secondary-dark: #059669;      /* Verde escuro (hover) */
--color-secondary-light: #34D399;    /* Verde claro */
--color-secondary-lighter: #6EE7B7;   /* Verde muito claro */
```

#### Cores Neutras
```css
--color-background: #f5f5f5;      /* Fundo da página */
--color-surface: #ffffff;         /* Superfície (cards, inputs) */
--color-text: #333333;            /* Texto principal */
--color-text-light: #666666;      /* Texto secundário */
--color-text-lighter: #999999;    /* Texto terciário */
--color-border: #d2d2d2;          /* Bordas */
--color-border-light: #e0e0e0;     /* Bordas claras */
```

#### Cores de Estado
```css
--color-success: #28a745;
--color-success-bg: #d4edda;
--color-success-border: #c3e6cb;

--color-error: #dc3545;
--color-error-bg: #f8d7da;
--color-error-border: #f5c6cb;

--color-warning: #ffc107;
--color-warning-bg: #fff3cd;
--color-warning-border: #ffeaa7;

--color-info: #17a2b8;
--color-info-bg: #d1ecf1;
--color-info-border: #bee5eb;
```

### Espaçamentos

```css
--spacing-xs: 4px;    /* Espaçamento muito pequeno */
--spacing-sm: 8px;   /* Espaçamento pequeno */
--spacing-md: 16px;  /* Espaçamento médio */
--spacing-lg: 24px;  /* Espaçamento grande */
--spacing-xl: 32px;  /* Espaçamento extra grande */
--spacing-2xl: 40px; /* Espaçamento muito grande */
--spacing-3xl: 48px; /* Espaçamento enorme */
--spacing-4xl: 64px; /* Espaçamento máximo */
```

### Tipografia

```css
--font-family: 'Atkinson Hyperlegible', 'Segoe UI', 'Roboto', sans-serif;

--font-size-xs: 12px;
--font-size-sm: 14px;
--font-size-base: 15px;
--font-size-md: 16px;
--font-size-lg: 18px;
--font-size-xl: 24px;
--font-size-2xl: 28px;
--font-size-3xl: 36px;
--font-size-4xl: 48px;

--line-height-tight: 1.2;
--line-height-normal: 1.5;
--line-height-relaxed: 1.6;

--letter-spacing-tight: -0.5px;
--letter-spacing-normal: 0;
--letter-spacing-wide: 0.2px;
```

### Border Radius

```css
--radius-sm: 8px;
--radius-md: 12px;
--radius-lg: 20px;
--radius-xl: 24px;
--radius-full: 9999px;
```

### Sombras

```css
--shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 12px rgba(0, 0, 0, 0.08);
--shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.12);
--shadow-xl: 0 12px 32px rgba(0, 0, 0, 0.15);
```

### Transições

```css
--transition-fast: 0.15s ease;
--transition-base: 0.2s ease;
--transition-slow: 0.3s ease;
```

---

## Componentes Base

### Botões

#### Botão Primário
**Quando usar:** Ação principal da página (salvar, enviar, confirmar)

```html
<button type="submit" class="btn-primary">
  Salvar
</button>
```

**Características:**
- Cor azul (`--color-primary`)
- Hover: azul escuro (`--color-primary-dark`)
- Padding: `var(--spacing-md) var(--spacing-xl)`
- Border radius: `var(--radius-md)`

#### Botão Secundário
**Quando usar:** Ação secundária (cancelar, voltar)

```html
<button type="button" class="btn-secondary">
  Cancelar
</button>
```

**Características:**
- Cor verde (`--color-secondary`)
- Hover: verde escuro (`--color-secondary-dark`)
- Mesmo padding e border radius do primário

#### Botão Link
**Quando usar:** Ações que não precisam de destaque (ver mais, detalhes)

```html
<button type="button" class="btn-link">
  Ver mais
</button>
```

---

### Cards

#### Card Básico
**Quando usar:** Container genérico para conteúdo

```html
<div class="card">
  <div class="card-header">
    <h3 class="card-title">Título do Card</h3>
  </div>
  <div class="card-content">
    <!-- Conteúdo aqui -->
  </div>
</div>
```

**Características:**
- Background: `var(--color-surface)`
- Padding: `var(--spacing-lg)`
- Border radius: `var(--radius-md)`
- Box shadow: `var(--shadow-sm)`

#### Metric Card Modern
**Quando usar:** Exibir métricas e estatísticas no dashboard

```html
<div class="metric-card-modern">
  <div class="metric-card-header">
    <h3>Alunos Ativos</h3>
    <span class="metric-icon">👤</span>
  </div>
  <div class="metric-card-content">
    <div class="metric-value">
      <span class="value-number">150</span>
      <span class="value-label">alunos cadastrados</span>
    </div>
  </div>
</div>
```

**Características:**
- Background: gradiente sutil
- Padding: `var(--spacing-lg)`
- Border radius: `var(--radius-lg)`
- Hover: elevação com sombra maior

---

### Formulários

#### Input Group
**Quando usar:** Campos de formulário

```html
<div class="input-group">
  <label for="nome">
    Nome Completo
    <span class="required-field"></span>
  </label>
  <input 
    type="text" 
    id="nome" 
    name="nome" 
    placeholder="Digite o nome"
    required
  />
  <span class="input-hint">Dica ou informação adicional</span>
</div>
```

**Características:**
- Label com cor `var(--color-primary-darker)`
- Input com padding `var(--spacing-sm) var(--spacing-md)`
- Border radius: `var(--radius-sm)`
- Hint abaixo do input em `var(--color-text-light)`

#### Campos Obrigatórios
Use a classe `required-field` no label para mostrar asterisco vermelho:

```html
<label>
  Email
  <span class="required-field"></span>
</label>
```

---

### Navegação

#### Breadcrumb
**Quando usar:** Páginas internas para mostrar localização

```html
<nav class="breadcrumb" aria-label="Breadcrumb">
  <a href="home.html">Home</a>
  <span class="breadcrumb-separator">/</span>
  <span>Página Atual</span>
</nav>
```

#### Sidebar
**Quando usar:** Navegação principal em páginas internas

```html
<aside class="sidebar">
  <div class="profile" id="sidebar-profile">
    <img src="..." alt="Perfil"/>
    <span><!-- Nome do usuário --></span>
  </div>
  <nav class="nav-links">
    <a href="home.html">
      <img src="..." alt="" /> Home
    </a>
    <!-- Mais links -->
  </nav>
</aside>
```

---

## Layout

### Container de Seção
**Quando usar:** Páginas públicas (landing, login)

```html
<section class="features-section">
  <div class="section-container">
    <!-- Conteúdo -->
  </div>
</section>
```

### Home Container
**Quando usar:** Páginas internas (após login)

```html
<div class="home-container">
  <aside class="sidebar"><!-- Sidebar --></aside>
  <main class="content">
    <!-- Conteúdo principal -->
  </main>
</div>
```

---

## Estrutura de Páginas

### Páginas Públicas (Login, Landing, etc.)

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Título - EduScore</title>
  <link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="style.css" />
  <script src="utils.js" defer></script>
</head>
<body>
  <!-- Header -->
  <header class="landing-header" role="banner">
    <div class="landing-header-container">
      <div class="landing-logo">
        <span class="landing-logo-text">EduScore</span>
      </div>
      <nav class="landing-nav" role="navigation" aria-label="Navegação principal">
        <!-- Links -->
      </nav>
    </div>
  </header>

  <!-- Conteúdo -->
  <section class="features-section">
    <div class="section-container">
      <div class="card">
        <!-- Conteúdo -->
      </div>
    </div>
  </section>

  <!-- Footer -->
  <footer class="landing-footer" role="contentinfo">
    <div class="section-container">
      <!-- Footer content -->
    </div>
  </footer>
</body>
</html>
```

### Páginas Internas (Após Login)

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Título - EduScore</title>
  <link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="style.css" />
  <script src="utils.js" defer></script>
</head>
<body>
  <div class="home-container">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="profile" id="sidebar-profile">
        <img src="..." alt="Perfil"/>
        <span style="opacity: 0;"><!-- Carregando... --></span>
      </div>
      <nav class="nav-links" role="navigation" aria-label="Menu principal">
        <!-- Links de navegação -->
      </nav>
    </aside>

    <!-- Conteúdo Principal -->
    <main class="content">
      <!-- Breadcrumb + User Menu -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-xl);">
        <nav class="breadcrumb" aria-label="Breadcrumb" style="margin: 0;">
          <a href="home.html">Home</a>
          <span class="breadcrumb-separator">/</span>
          <span>Página Atual</span>
        </nav>
        <div class="user-profile-menu">
          <!-- Menu do usuário -->
        </div>
      </div>

      <!-- Header da Página -->
      <div class="dashboard-header">
        <div>
          <h2>Título da Página</h2>
          <p class="dashboard-subtitle">Subtítulo ou descrição</p>
        </div>
      </div>

      <!-- Conteúdo Principal -->
      <div class="card">
        <!-- Conteúdo aqui -->
      </div>
    </main>
  </div>
</body>
</html>
```

---

## Padrões de Uso

### Quando Usar Cada Componente

| Componente | Quando Usar | Exemplo |
|------------|-------------|---------|
| `btn-primary` | Ação principal | Salvar, Enviar, Confirmar |
| `btn-secondary` | Ação secundária | Cancelar, Voltar |
| `btn-link` | Ação terciária | Ver mais, Detalhes |
| `card` | Container genérico | Formulários, conteúdo geral |
| `metric-card-modern` | Métricas/Estatísticas | Dashboard, relatórios |
| `input-group` | Campos de formulário | Todos os inputs |
| `breadcrumb` | Navegação hierárquica | Páginas internas |
| `sidebar` | Menu principal | Páginas internas |

### Hierarquia de Cores

1. **Primária (Azul):** Ações principais, links, elementos importantes
2. **Secundária (Verde):** Ações secundárias, sucesso
3. **Neutras:** Textos, fundos, bordas
4. **Estado:** Sucesso (verde), erro (vermelho), aviso (amarelo), info (azul claro)

### Espaçamento Consistente

- **Entre elementos relacionados:** `var(--spacing-sm)` ou `var(--spacing-md)`
- **Entre seções:** `var(--spacing-lg)` ou `var(--spacing-xl)`
- **Padding de cards:** `var(--spacing-lg)` ou `var(--spacing-xl)`
- **Gap em flex/grid:** `var(--spacing-md)` ou `var(--spacing-lg)`

---

## Exemplos Práticos

### Formulário Completo

```html
<div class="card">
  <div class="card-header">
    <h3 class="card-title">Cadastrar Aluno</h3>
  </div>
  <form onsubmit="handleSubmit(event)">
    <div class="input-group">
      <label for="nome">
        Nome Completo
        <span class="required-field"></span>
      </label>
      <input 
        type="text" 
        id="nome" 
        name="nome" 
        placeholder="Digite o nome completo"
        required
      />
      <span class="input-hint">Nome completo conforme documento</span>
    </div>

    <div style="display: flex; gap: var(--spacing-md); margin-top: var(--spacing-lg);">
      <button type="button" class="btn-secondary" style="flex: 1;">
        Cancelar
      </button>
      <button type="submit" class="btn-primary" style="flex: 1;">
        Salvar
      </button>
    </div>
  </form>
</div>
```

### Dashboard com Métricas

```html
<div class="metrics-grid">
  <div class="metric-card-modern">
    <div class="metric-card-header">
      <h3>Alunos Ativos</h3>
      <span class="metric-icon">👤</span>
    </div>
    <div class="metric-card-content">
      <div class="metric-value">
        <span class="value-number">150</span>
        <span class="value-label">alunos cadastrados</span>
      </div>
    </div>
  </div>
  
  <!-- Mais cards de métricas -->
</div>
```

---

## Regras Importantes

### ❌ NUNCA Faça

1. **Não use valores fixos (px, cores hex) diretamente**
   ```css
   /* ❌ ERRADO */
   padding: 24px;
   color: #333333;
   
   /* ✅ CORRETO */
   padding: var(--spacing-lg);
   color: var(--color-text);
   ```

2. **Não crie novas classes sem necessidade**
   - Use componentes existentes
   - Se precisar variar, use variantes ou modificadores

3. **Não misture estilos inline com classes**
   - Prefira classes do design system
   - Use estilos inline apenas para valores dinâmicos

### ✅ SEMPRE Faça

1. **Use variáveis CSS para todos os valores**
2. **Siga a estrutura padrão de páginas**
3. **Adicione ARIA labels em elementos interativos**
4. **Teste responsividade (mobile, tablet, desktop)**
5. **Use componentes do design system**

---

## Referências

- **Guia de Padronização:** `doc/GUIA_PADRONIZACAO.md`
- **Relatório de Inspeção:** `doc/INSPECAO_USABILIDADE_UX_UI.md`
- **Heurísticas de Nielsen:** `doc/HEURISTICAS_NIELSEN.md`
- **CSS Principal:** `public/style.css`

---

**Última atualização:** Janeiro 2025  
**Mantido por:** Equipe de Desenvolvimento

