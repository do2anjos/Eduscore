# Guia Prático de Padronização - EduScore

Este guia fornece exemplos práticos e checklists para padronizar o projeto EduScore.

---

## 📋 Checklist de Padronização por Página

### ✅ Checklist Geral (Aplicar em TODAS as páginas)

- [ ] Usa variáveis CSS (`var(--spacing-*)`, `var(--color-*)`)
- [ ] Tem breadcrumb (páginas internas)
- [ ] Tem feedback visual (loading, toast)
- [ ] Tem validação de formulários
- [ ] Tem ARIA labels em elementos interativos
- [ ] É responsiva (mobile, tablet, desktop)
- [ ] Usa componentes do design system
- [ ] Tem ajuda contextual (botão "?")

---

## 🎨 Padronização de CSS

### ❌ **ERRADO - Valores Fixos**

```css
.card {
  padding: 24px;
  margin-bottom: 20px;
  border-radius: 12px;
  color: #333333;
  background: #ffffff;
}
```

### ✅ **CORRETO - Variáveis CSS**

```css
.card {
  padding: var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
  border-radius: var(--radius-md);
  color: var(--color-text);
  background: var(--color-surface);
}
```

### 📝 **Mapeamento de Valores**

| Valor Fixo | Variável CSS | Quando Usar |
|------------|--------------|-------------|
| `4px` | `var(--spacing-xs)` | Espaçamento muito pequeno |
| `8px` | `var(--spacing-sm)` | Espaçamento pequeno |
| `16px` | `var(--spacing-md)` | Espaçamento médio |
| `24px` | `var(--spacing-lg)` | Espaçamento grande |
| `32px` | `var(--spacing-xl)` | Espaçamento extra grande |
| `40px` | `var(--spacing-2xl)` | Espaçamento muito grande |
| `48px` | `var(--spacing-3xl)` | Espaçamento enorme |
| `64px` | `var(--spacing-4xl)` | Espaçamento máximo |
| `#008cc4` | `var(--color-primary)` | Cor primária |
| `#003b54` | `var(--color-primary-darker)` | Cor primária escura |
| `#10B981` | `var(--color-secondary)` | Cor secundária |
| `#333333` | `var(--color-text)` | Texto principal |
| `#666666` | `var(--color-text-light)` | Texto secundário |
| `12px` | `var(--font-size-sm)` | Texto pequeno |
| `15px` | `var(--font-size-base)` | Texto base |
| `18px` | `var(--font-size-lg)` | Texto grande |
| `24px` | `var(--font-size-xl)` | Texto extra grande |
| `8px` | `var(--radius-sm)` | Border radius pequeno |
| `12px` | `var(--radius-md)` | Border radius médio |
| `20px` | `var(--radius-lg)` | Border radius grande |

---

## 🧩 Componentes Padronizados

### **Botões**

#### ❌ **ERRADO - Estilos Inline**

```html
<button style="background: #008cc4; color: white; padding: 12px 20px; border-radius: 8px;">
  Salvar
</button>
```

#### ✅ **CORRETO - Classes do Design System**

```html
<!-- Ação Principal -->
<button type="submit" class="btn-primary">
  Salvar
</button>

<!-- Ação Secundária -->
<button type="button" class="btn-secondary">
  Cancelar
</button>

<!-- Link Estilizado -->
<button type="button" class="btn-link">
  Ver mais
</button>
```

### **Cards**

#### ❌ **ERRADO - Estrutura Inconsistente**

```html
<div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
  <h3>Título</h3>
  <p>Conteúdo</p>
</div>
```

#### ✅ **CORRETO - Componente Padronizado**

```html
<div class="card">
  <div class="card-header">
    <h3 class="card-title">Título do Card</h3>
  </div>
  <div class="card-content">
    <p>Conteúdo do card</p>
  </div>
</div>
```

### **Formulários**

#### ❌ **ERRADO - Inputs sem Padronização**

```html
<div>
  <label>Nome</label>
  <input type="text" style="width: 100%; padding: 10px; border: 1px solid #ccc;">
</div>
```

#### ✅ **CORRETO - Input Group Padronizado**

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
    placeholder="Digite o nome completo"
    required
    autocomplete="name"
  />
  <span class="input-hint">Nome completo conforme documento de identidade</span>
</div>
```

### **Métricas (Dashboard)**

#### ❌ **ERRADO - Card de Métrica Inconsistente**

```html
<div style="background: white; padding: 20px; border-radius: 12px;">
  <h4>Alunos</h4>
  <p style="font-size: 36px; font-weight: bold;">150</p>
</div>
```

#### ✅ **CORRETO - Metric Card Modern**

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

---

## 🔄 Padronização de JavaScript

### **Requisições HTTP**

#### ❌ **ERRADO - Sem Feedback Visual**

```javascript
async function saveData() {
  const response = await fetch('/api/endpoint', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  const result = await response.json();
  if (result.sucesso) {
    alert('Salvo com sucesso!');
  }
}
```

#### ✅ **CORRETO - Com Feedback Padronizado**

```javascript
async function saveData() {
  // Mostrar loading
  showLoading('Salvando dados...');
  
  try {
    const token = localStorage.getItem('token');
    const response = await fetch('/api/endpoint', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
    
    const result = await response.json();
    
    if (response.ok && result.sucesso) {
      showToast('Dados salvos com sucesso!', 'success');
      // Redirecionar ou atualizar UI
    } else {
      showToast(result.erro || 'Erro ao salvar dados', 'error', 5000);
    }
  } catch (error) {
    console.error('Erro:', error);
    showToast('Erro de conexão. Tente novamente.', 'error', 5000);
  } finally {
    // Sempre esconder loading
    hideLoading();
  }
}
```

### **Validação de Formulários**

#### ❌ **ERRADO - Validação Manual Inconsistente**

```javascript
function validateForm() {
  const nome = document.getElementById('nome').value;
  if (!nome) {
    alert('Nome é obrigatório');
    return false;
  }
  return true;
}
```

#### ✅ **CORRETO - Usando Função Padronizada**

```javascript
async function handleSubmit(event) {
  event.preventDefault();
  
  // Usar função padronizada de validação
  if (!validateForm(event.target)) {
    return;
  }
  
  // Validações específicas adicionais
  const email = document.getElementById('email').value;
  if (!isValidEmail(email)) {
    showToast('Email inválido', 'error');
    return;
  }
  
  // Processar formulário
  await saveData();
}
```

### **Confirmação de Ações Destrutivas**

#### ❌ **ERRADO - Confirm sem Contexto**

```javascript
function deleteItem() {
  if (confirm('Deseja excluir?')) {
    // Excluir
  }
}
```

#### ✅ **CORRETO - Diálogo de Confirmação Padronizado**

```javascript
function deleteItem(id) {
  showConfirmDialog(
    'Deseja realmente excluir este item? Esta ação não pode ser desfeita.',
    () => {
      // Ação de confirmação
      performDelete(id);
    },
    () => {
      // Ação de cancelamento (opcional)
      console.log('Exclusão cancelada');
    }
  );
}
```

---

## 📱 Padronização de Estrutura HTML

### **Páginas Internas (Após Login)**

#### ✅ **Estrutura Padrão**

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Título da Página - EduScore</title>
  <link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="style.css" />
  <script src="utils.js" defer></script>
</head>
<body>
  <div class="home-container">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="profile" id="sidebar-profile">
        <img src="https://img.icons8.com/ios-filled/100/ffffff/user-male-circle.png" alt="Perfil"/>
        <span style="opacity: 0;"><!-- Carregando... --></span>
      </div>
      <nav class="nav-links" role="navigation" aria-label="Menu principal">
        <a href="home.html">
          <img src="https://img.icons8.com/ios-filled/24/ffffff/home-page.png" alt="" /> Home
        </a>
        <!-- Mais links -->
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
          <button class="user-avatar-button" id="user-menu-button" aria-label="Abrir menu do usuário">U</button>
          <div class="dropdown-menu hidden" id="user-dropdown">
            <!-- Menu dropdown -->
          </div>
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

### **Páginas Públicas (Login, Landing, etc.)**

#### ✅ **Estrutura Padrão**

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
        <!-- Links de navegação -->
      </nav>
    </div>
  </header>

  <!-- Conteúdo -->
  <section class="features-section">
    <div class="section-container">
      <div class="card">
        <!-- Conteúdo aqui -->
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

---

## ♿ Padronização de Acessibilidade

### **ARIA Labels**

#### ❌ **ERRADO - Sem ARIA**

```html
<button onclick="save()">
  <img src="save.png" />
  Salvar
</button>
```

#### ✅ **CORRETO - Com ARIA**

```html
<button 
  onclick="save()" 
  aria-label="Salvar alterações"
  aria-describedby="save-hint"
>
  <img src="save.png" alt="Salvar" />
  <span class="sr-only">Salvar</span>
</button>
<span id="save-hint" class="sr-only">Salva as alterações do formulário</span>
```

### **Navegação por Teclado**

#### ✅ **Implementação Padrão**

```javascript
// Já implementado em utils.js
setupKeyboardShortcuts();

// Adicionar navegação por teclado em componentes customizados
element.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    element.click();
  }
});
```

### **Contraste de Cores**

#### ✅ **Verificar Contraste (WCAG AA)**

- Texto normal: mínimo 4.5:1
- Texto grande (18px+): mínimo 3:1
- Elementos interativos: mínimo 3:1

**Ferramenta:** [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)

---

## 📱 Padronização de Responsividade

### **Breakpoints Padrão**

```css
/* Mobile First */
@media (max-width: 768px) {
  /* Estilos para mobile */
}

@media (min-width: 769px) and (max-width: 1024px) {
  /* Estilos para tablet */
}

@media (min-width: 1025px) {
  /* Estilos para desktop */
}
```

### **Sidebar Mobile**

#### ✅ **Implementação Padrão**

```html
<!-- Botão hamburger (mobile apenas) -->
<button class="sidebar-toggle" aria-label="Abrir menu" style="display: none;">
  <span></span>
  <span></span>
  <span></span>
</button>

<script>
// Toggle sidebar em mobile
if (window.innerWidth <= 768px) {
  document.querySelector('.sidebar-toggle').style.display = 'block';
  document.querySelector('.sidebar-toggle').addEventListener('click', () => {
    document.querySelector('.sidebar').classList.toggle('open');
  });
}
</script>
```

---

## ✅ Checklist de Validação por Página

### **Antes de Considerar uma Página "Padronizada":**

- [ ] ✅ Usa apenas variáveis CSS (sem valores fixos)
- [ ] ✅ Usa componentes do design system
- [ ] ✅ Tem breadcrumb (páginas internas)
- [ ] ✅ Tem feedback visual em todas as ações
- [ ] ✅ Tem validação de formulários
- [ ] ✅ Tem ARIA labels em elementos interativos
- [ ] ✅ É responsiva (testada em mobile, tablet, desktop)
- [ ] ✅ Tem ajuda contextual
- [ ] ✅ Mensagens de erro são claras e acionáveis
- [ ] ✅ Loading states em requisições assíncronas
- [ ] ✅ Confirmação em ações destrutivas
- [ ] ✅ Navegação por teclado funciona
- [ ] ✅ Contraste de cores adequado (WCAG AA)

---

## 🔧 Ferramentas Úteis

### **Validação de CSS**
- [CSS Validator](https://jigsaw.w3.org/css-validator/)
- [Autoprefixer](https://autoprefixer.github.io/)

### **Validação de Acessibilidade**
- [WAVE](https://wave.webaim.org/)
- [axe DevTools](https://www.deque.com/axe/devtools/)
- [Lighthouse](https://developers.google.com/web/tools/lighthouse)

### **Validação de Responsividade**
- [Responsive Design Checker](https://responsivedesignchecker.com/)
- Chrome DevTools (Device Toolbar)

### **Validação de Contraste**
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)

---

## 📚 Recursos Adicionais

### **Documentação do Design System**
- Ver: `doc/RELATORIO_DESIGN_SYSTEM.md`
- Ver: `doc/HEURISTICAS_NIELSEN.md`

### **Relatório de Inspeção**
- Ver: `doc/INSPECAO_USABILIDADE_UX_UI.md`

### **Variáveis CSS Disponíveis**
- Ver: `public/style.css` (linhas 4-85)

---

**Última atualização:** Janeiro 2025  
**Mantido por:** Equipe de Desenvolvimento

