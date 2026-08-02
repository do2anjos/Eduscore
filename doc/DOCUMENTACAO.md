# 📚 Documentação Completa — EduScore

**Última atualização**: 2026-07-11  
**Versão**: 2.0.0

Plataforma integrada de analytics educacional: da digitalização de folhas de resposta à predição de desempenho usando machine learning.

---

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Arquitetura do Sistema](#2-arquitetura-do-sistema)
3. [Estrutura do Projeto](#3-estrutura-do-projeto)
4. [Banco de Dados](#4-banco-de-dados)
5. [API — Endpoints](#5-api--endpoints)
6. [Cálculo de Métricas e Gráficos](#6-cálculo-de-métricas-e-gráficos)
7. [Pipeline de Correção Mobile (YOLO + OCR)](#7-pipeline-de-correção-mobile-yolo--ocr)
8. [Design System](#8-design-system)
9. [Heurísticas de Usabilidade (Nielsen)](#9-heurísticas-de-usabilidade-nielsen)
10. [Deploy e Infraestrutura](#10-deploy-e-infraestrutura)
11. [Changelog Consolidado](#11-changelog-consolidado)
12. [Pendências e Melhorias Futuras](#12-pendências-e-melhorias-futuras)

---

## 1. Visão Geral

O **EduScore** é uma plataforma web de gestão pedagógica que permite:

- Cadastrar alunos, disciplinas e gabaritos (simulados)
- Corrigir simulados via câmera mobile (YOLO + OCR)
- Gerar relatórios gerais e individuais de desempenho
- Visualizar métricas e gráficos de acertos por disciplina, etapa e tempo
- Gerenciar sessões de aplicação de provas

### Stack Tecnológica

| Componente | Tecnologia |
|------------|------------|
| **Backend** | Node.js + Express 4.x |
| **Banco de Dados** | SQLite (local via better-sqlite3) / Turso (produção via @libsql/client) |
| **Frontend** | HTML5 + CSS3 + JavaScript vanilla |
| **IA/ML** | YOLO v11 (ONNX) + Tesseract OCR + OpenCV |
| **Hospedagem IA** | HuggingFace Spaces (GPU gratuita) |
| **Hospedagem App** | Render (Node.js) |
| **Autenticação** | JWT (jsonwebtoken) |
| **Gráficos** | Chart.js |
| **Fonte** | Atkinson Hyperlegible (Google Fonts) |

---

## 2. Arquitetura do Sistema

```
┌──────────────┐     ┌──────────────────────┐     ┌────────────────────────────┐
│   Browser    │────▶│  Render (Node.js)     │────▶│  HuggingFace Space (GPU)   │
│  (Frontend)  │◀────│  Express + SQLite/    │◀────│  Python + YOLO + OCR       │
│              │     │  Turso                │     │  + OpenCV                  │
└──────────────┘     └──────────────────────┘     └────────────────────────────┘
```

### Fluxo Principal

1. **Render (Node.js ~100-150MB RAM)**: Roteamento, API REST, autenticação, regras de negócio
2. **HuggingFace (GPU)**: Processamento pesado de IA (YOLO, OCR, detecção de bolhas)
3. **Browser**: Interface, câmera mobile, gráficos Chart.js

### Detecção Automática de Banco

- **Produção**: Se `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN` estão definidos → usa Turso (LibSQL)
- **Desenvolvimento**: Caso contrário → usa SQLite local (`database.sqlite`)
- Interface unificada: `db.query()` retorna Promise em ambos os casos

---

## 3. Estrutura do Projeto

```
classy-main/
├── server.js                    # Ponto de entrada — Express app
├── package.json                 # Dependências (eduscore v1.0.0)
├── render-build.sh              # Script de build para Render
├── database.sqlite              # Banco local (dev)
│
├── backend/
│   ├── .env                     # Variáveis de ambiente
│   ├── db.js                    # Wrapper unificado SQLite/Turso
│   ├── middleware/
│   │   ├── auth.js              # Middleware de autenticação JWT
│   │   ├── errorHandler.js      # Error handler centralizado
│   │   └── validation.js        # Validações centralizadas
│   ├── migrations/
│   │   ├── create_schema.js     # Schema principal (async/await)
│   │   ├── schema.sql           # SQL do schema
│   │   ├── add_dia_enem.js      # Migração: campo dia ENEM
│   │   └── add_imagens_cartoes.js # Migração: imagens de cartões
│   ├── routes/
│   │   ├── alunos.js            # CRUD alunos
│   │   ├── usuarios.js          # Auth + CRUD usuários
│   │   ├── disciplinas.js       # CRUD + estatísticas disciplinas
│   │   ├── gabaritos.js         # CRUD + upload CSV gabaritos
│   │   ├── questoes.js          # CRUD questões
│   │   ├── respostas.js         # CRUD + processamento mobile
│   │   ├── sessoes.js           # CRUD sessões
│   │   └── relatorios.js        # Estatísticas gerais/individuais
│   ├── utils/
│   │   ├── transaction.js       # Wrapper de transações
│   │   └── disciplinaClassifier.js # Classificador de disciplinas
│   └── scripts/
│       ├── requirements.txt     # Dependências Python
│       ├── detectar_tipo_imagem.py # Roteador de processamento de gabaritos
│       ├── Enem/                # Scripts do fluxo ENEM
│       │   ├── 01_corrigir_perspectiva.py # YOLO + SAM2
│       │   ├── 02_detectar_rois.py        # Detecção YOLO de Regiões
│       │   ├── 03_ocr_dia.py              # Leitura Pytesseract
│       │   ├── 04_processar_bolhas.py     # Leitura OMR
│       │   └── 05_processar_respostas.py  # Orquestrador Final ENEM
│       └── Scripts UEA/         # Scripts do fluxo UEA
│           ├── 01_corrigir_perspectiva_uea.py
│           ├── processar_respostas_imagem_original.py
│           └── processar_respostas_imagem_processadas.py
│
├── public/                      # Frontend (servido estático)
│   ├── index.html               # Página raiz (redirect)
│   ├── landing.html             # Landing page pública
│   ├── login.html               # Login
│   ├── perfil.html              # Perfil público
│   ├── redefinir.html           # Redefinir senha
│   ├── home.html                # Dashboard (após login)
│   ├── Cadastrar.html           # Cadastro de alunos
│   ├── CadastrarGabarito.html   # Cadastro de gabaritos + upload CSV
│   ├── CorrigirSimulado.html    # Correção via câmera/upload
│   ├── RelatorioGeral.html      # Relatório geral
│   ├── GerarRelatorio.html      # Relatório individual
│   ├── AgendarSessao.html       # Agendamento de sessões
│   ├── configuracoes.html       # Configurações
│   ├── meuperfil.html           # Perfil do usuário logado
│   ├── style.css                # CSS principal (~78KB)
│   ├── utils.js                 # Utilitários JS globais (~31KB)
│   ├── script.js                # Script auxiliar
│   └── eduscore.png             # Logo
│
├── huggingface-space/           # Código do HuggingFace Space
│   ├── app.py                   # App Gradio (live + full)
│   ├── detector_yolo_enem.py    # Detector YOLO
│   ├── ocr_day_detector.py      # OCR para dia da prova
│   ├── best_yolo11s_optimized.onnx # Modelo YOLO (ONNX)
│   ├── requirements.txt         # Deps Python HF
│   └── packages.txt             # Pacotes sistema HF
│
├── config/                      # Configurações extras
├── data/                        # Dados auxiliares
├── assets/                      # Assets estáticos
├── uploads/                     # Diretório de uploads
├── scripts/                     # Scripts utilitários
└── doc/                         # Esta documentação
```

### Dependências Principais (package.json)

| Pacote | Versão | Uso |
|--------|--------|-----|
| express | ^4.21.2 | Framework web |
| better-sqlite3 | ^11.7.0 | SQLite local |
| @libsql/client | ^0.15.2 | Turso (produção) |
| bcrypt | ^6.0.0 | Hash de senhas |
| jsonwebtoken | ^9.0.2 | Autenticação JWT |
| cors | ^2.8.5 | CORS |
| express-rate-limit | ^7.4.1 | Rate limiting |
| multer | ^2.0.0 | Upload de arquivos |
| csv-parser | ^3.2.0 | Parsing de CSV |
| dotenv | ^17.2.0 | Variáveis de ambiente |
| @gradio/client | ^2.0.1 | Cliente Gradio (HF) |
| form-data | ^4.0.5 | Envio multipart |
| node-fetch | ^3.3.2 | HTTP client |
| nodemon | ^3.1.10 | Dev: hot reload |

---

## 4. Banco de Dados

### Migração PostgreSQL → SQLite

O projeto migrou de PostgreSQL para SQLite. O wrapper `backend/db.js` converte automaticamente:

| PostgreSQL | SQLite |
|-----------|--------|
| `$1, $2, $3...` | `?` (parâmetros posicionais) |
| `NOW()` | `datetime('now')` |
| `TO_CHAR(data, 'YYYY-MM-DD')` | `strftime('%Y-%m-%d', data)` |
| `ILIKE` | `UPPER(campo) LIKE UPPER(valor)` |
| `INSERT ... RETURNING *` | INSERT + SELECT via rowid |

### Tabelas Principais

- **usuarios** — Professores, coordenadores, admins (JWT auth)
- **alunos** — Alunos cadastrados (matrícula NOT NULL UNIQUE)
- **disciplinas** — Disciplinas/matérias
- **gabaritos** — Templates de prova (simulados)
- **questoes** — Questões dos gabaritos (número, resposta_correta, disciplina_id)
- **respostas** — Respostas dos alunos (resposta_aluno, acertou, gabarito_id)
- **sessoes** — Sessões de aplicação de simulados
- **relatorios** — Relatórios gerados

---

## 5. API — Endpoints

### Base URL

```
http://localhost:3000/api
```

### Autenticação

A maioria das rotas requer JWT no header:

```
Authorization: Bearer <token>
```

### Formato de Resposta

```json
// Sucesso
{ "sucesso": true, "dados": { ... } }

// Erro
{ "sucesso": false, "erro": "Mensagem", "detalhes": "..." }
```

### Rate Limiting

| Endpoint | Limite |
|----------|--------|
| Geral (`/api/`) | 100 req/min |
| Login | 5 tentativas/15 min |
| Upload | 10 uploads/min |

---

### 5.1 Usuários

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| POST | `/usuarios/registro` | ❌ | Registrar (perfis: professor, coordenador, admin) |
| POST | `/usuarios/login` | ❌ | Login (retorna JWT + dados do usuário) |
| GET | `/usuarios?limit=100&offset=0&busca=` | ✅ | Listar usuários |
| GET | `/usuarios/:id` | ✅ | Obter por ID |

### 5.2 Alunos

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/alunos` | ✅ | Listar alunos |
| POST | `/alunos` | ✅ | Criar aluno (nome_completo, email, matricula, etapa...) |
| PUT | `/alunos/:id` | ✅ | Atualizar |
| DELETE | `/alunos/:id` | ✅ | Deletar |

### 5.3 Disciplinas

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/disciplinas` | ❌ | Listar todas |
| POST | `/disciplinas` | ✅ | Criar disciplina |
| GET | `/disciplinas/estatisticas` | ✅ | Top 5 mais ativas + total |
| GET | `/disciplinas/:id/relatorio` | ✅ | Métricas de uma disciplina |

### 5.4 Gabaritos

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/gabaritos` | ✅ | Listar |
| POST | `/gabaritos` | ✅ | Criar (nome, etapa) |
| GET | `/gabaritos/:id` | ✅ | Obter por ID |
| PUT | `/gabaritos/:id` | ✅ | Atualizar |
| DELETE | `/gabaritos/:id` | ✅ | Deletar |
| POST | `/gabaritos/upload` | ✅ | Upload CSV (file + gabarito_id) |

**Formato CSV:**
```csv
numero,resposta_correta,disciplina_id
1,A,<uuid>
2,B,<uuid>
```

**Validações do upload:**
- Número da questão deve ser entre 1 e 60
- Resposta deve ser A, B, C, D ou E
- Cabeçalhos CSV são filtrados automaticamente

### 5.5 Questões

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/questoes` | ✅ | Listar todas |
| GET | `/questoes/:gabarito_id` | ✅ | Listar por gabarito |
| POST | `/questoes` | ✅ | Criar (gabarito_id, numero, resposta_correta) |
| PUT | `/questoes/:id` | ✅ | Atualizar |
| DELETE | `/questoes/:id` | ✅ | Deletar |

### 5.6 Respostas

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/respostas` | ✅ | Listar |
| POST | `/respostas` | ✅ | Criar (aluno_id, questao_id, gabarito_id, resposta_aluno, acertou) |
| GET | `/respostas/:id` | ✅ | Obter por ID |
| PUT | `/respostas/:id` | ✅ | Atualizar |
| DELETE | `/respostas/:id` | ✅ | Deletar |
| POST | `/respostas/processar-frame-mobile` | ✅ | Processamento live de webcam (HuggingFace) |
| POST | `/respostas/capturar-enem-mobile` | ✅ | (Depreciado) Proc. completo via HuggingFace |
| POST | `/respostas/processar-imagem` | ✅ | (Depreciado) Script legacy monolítico |
| POST | `/respostas/identificar-tipo` | ✅ | Roteamento: ENEM ou UEA? |
| POST | `/respostas/etapa-perspectiva` | ✅ | (Passo 1) Correção de Perspectiva |
| POST | `/respostas/etapa-detectar` | ✅ | (Passo 2) Detecção de Áreas (ROIs) |
| POST | `/respostas/etapa-ocr` | ✅ | (Passo 3) Extração do Dia (Tesseract) |
| POST | `/respostas/etapa-bolhas` | ✅ | (Passo 4) Extração de Bolhas OMR e Finalização |

### 5.7 Sessões

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/sessoes?etapa=&aluno_id=&disciplina_id=` | ❌ | Listar (com filtros) |
| POST | `/sessoes` | ✅ | Criar (apenas coordenadores) |
| DELETE | `/sessoes/:id` | ✅ | Deletar (coordenador responsável ou admin) |

### 5.8 Relatórios

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/relatorios/estatisticas-gerais?etapa=` | ✅ | Estatísticas gerais (geral ou por etapa) |
| GET | `/relatorios/estatisticas-mensal` | ✅ | Evolução mensal (últimos 6 meses) |
| GET | `/relatorios/estatisticas-individual/:aluno_id` | ✅ | Estatísticas individuais do aluno |
| GET | `/relatorios/estatisticas-individual/:aluno_id/disciplinas/:gabarito_id` | ✅ | Desempenho por disciplina filtrado por simulado |
| GET | `/relatorios?sessao_id=&etapa=&aluno_id=` | ✅ | Listar relatórios |
| POST | `/relatorios` | ✅ | Criar relatório |
| DELETE | `/relatorios/:id` | ✅ | Deletar relatório |

---

## 6. Cálculo de Métricas e Gráficos

### 6.1 Critérios de Validação de Respostas

Uma resposta é **válida** quando atende TODOS os critérios:

1. `resposta_aluno IS NOT NULL`
2. `resposta_aluno != ''`
3. `resposta_aluno NOT LIKE '%,%'` (sem dupla marcação)

### 6.2 Modos de Cálculo: Geral vs. Por Etapa

| Aspecto | Modo Geral | Modo Por Etapa |
|---------|------------|----------------|
| **Denominador** | Total de respostas válidas | Total de questões únicas |
| **Fórmula** | `(acertos / respostas_válidas) × 100` | `(acertos / total_questões) × 100` |
| **Filtro** | Nenhum | `WHERE g.etapa = ?` |
| **Interpretação** | Taxa de acertos sobre respostas | Taxa de acertos sobre questões |

**Exemplo prático** — 60 questões, 50 respostas válidas, 40 acertos:
- Modo Geral: `(40/50) × 100 = 80%`
- Modo Por Etapa: `(40/60) × 100 = 66.67%`

### 6.3 Dashboard (home.html)

| Card | Fonte de Dados | Cálculo |
|------|---------------|---------|
| **Alunos Ativos** | `GET /api/alunos` | Count de array retornado |
| **Progresso Mensal** | `GET /api/relatorios/estatisticas-mensal` | AVG(acertou) agrupado por mês (últimos 6 meses) |
| **Simulados Aplicados** | `GET /api/gabaritos` | Count de gabaritos |
| **Retenção por Disciplina** | `GET /api/relatorios/estatisticas-gerais` | `taxa_erro` por disciplina (maior = pior retenção) |

### 6.4 Relatório Geral (RelatorioGeral.html)

- **Média de Acertos por Disciplina**: Gráfico de barras usando `media` de `media_por_disciplina`
- **Filtro por Etapa**: Query param `?etapa=X`
- A média considera TODAS as questões dos gabaritos aplicados (não apenas respondidas)

### 6.5 Relatório Individual (GerarRelatorio.html)

- **Cards**: total_questoes, total_acertos, taxa_acertos, maior/menor_media_disciplina
- **Card Previsão**: Valor "N/A" (aguardando modelo de predição)
- **Gráfico "Desempenho ao Longo do Tempo"**: Usa `desempenho_por_gabarito` (linha)
- **Tabela "Relatório por Simulado"**: Cores condicionais (verde ≥70%, amarelo 50-69%, vermelho <50%)
- **Gráfico "Desempenho por Disciplina"**: Com dropdown filtro por simulado (cache inteligente)
- **Sanfona (Accordion)**: Clique no nome do simulado expande detalhes (gabarito vs capturada)

### 6.6 Endpoints de Disciplinas

- `GET /api/disciplinas/estatisticas` — Top 5 disciplinas com mais questões
- `GET /api/disciplinas/:id/relatorio` — total_questoes, total_respostas, percentual_acertos

---

## 7. Pipeline de Correção Mobile (YOLO + OCR)

### Fluxo Completo

```
1. Detecção de dispositivo → detectarDispositivo()
   Mobile: interface de câmera | Desktop: upload de arquivo

2. Live Detection (500-1000ms loop)
   Browser → Render POST /api/respostas/processar-frame-mobile
   → HuggingFace /api/predict (fn_index: 0)
   → YOLOv11n (detecção rápida)
   ← Coordenadas ROIs: day_region, answer_area_enem
   ← Desenha retângulos no canvas (🟩 verde = respostas, 🟦 azul = dia)

3. Captura e Processamento Completo
   Browser → Render POST /api/respostas/capturar-enem-mobile
   → HuggingFace /api/predict (fn_index: 1)
   → YOLOv11 (detecção precisa)
   → Tesseract OCR (dia da prova: 1 ou 2)
   → OpenCV (bolhas preenchidas, dupla marcação, questões em branco)
   ← JSON com respostas: { "1": "A", "2": "C", ... }
```

### Configuração HuggingFace

```
HUGGINGFACE_API_URL=https://do2anjos-eduscore-yolo-api.hf.space
```

### Parâmetros YOLO (detector_yolo_enem.py)

```python
CONFIDENCE_THRESHOLD = 0.25  # Sensível (detecta mais, possíveis falsos positivos)
NMS_THRESHOLD = 0.3          # Permite detecções mais próximas
```

### Memória

| Componente | Antes | Agora |
|-----------|-------|-------|
| Render (Node.js) | ~100MB + Python ~400MB = **CRASH** | ~100-150MB ✅ |
| HuggingFace | — | GPU gratuita ✅ |

---

## 8. Design System

### 8.1 Variáveis CSS

#### Cores

```css
/* Primárias (Azul) */
--color-primary: #008cc4;
--color-primary-dark: #0073a6;
--color-primary-darker: #003b54;
--color-primary-light: #00a3d9;

/* Secundárias (Verde) */
--color-secondary: #10B981;
--color-secondary-dark: #059669;
--color-secondary-light: #34D399;

/* Neutras */
--color-background: #f5f5f5;
--color-surface: #ffffff;
--color-text: #333333;
--color-text-light: #666666;
--color-text-lighter: #999999;
--color-border: #d2d2d2;

/* Estados */
--color-success: #28a745;
--color-error: #dc3545;
--color-warning: #ffc107;
--color-info: #17a2b8;
```

#### Espaçamentos

```css
--spacing-xs: 4px;   --spacing-sm: 8px;   --spacing-md: 16px;
--spacing-lg: 24px;  --spacing-xl: 32px;  --spacing-2xl: 40px;
--spacing-3xl: 48px; --spacing-4xl: 64px;
```

#### Tipografia

```css
--font-family: 'Atkinson Hyperlegible', 'Segoe UI', 'Roboto', sans-serif;
--font-size-xs: 12px;  --font-size-sm: 14px;  --font-size-base: 15px;
--font-size-md: 16px;  --font-size-lg: 18px;  --font-size-xl: 24px;
--font-size-2xl: 28px; --font-size-3xl: 36px; --font-size-4xl: 48px;

--font-weight-normal: 400;  --font-weight-medium: 500;
--font-weight-semibold: 600; --font-weight-bold: 700;
```

#### Outros tokens

```css
--radius-sm: 8px; --radius-md: 12px; --radius-lg: 20px; --radius-xl: 24px;
--shadow-sm: 0 2px 4px rgba(0,0,0,0.05);
--shadow-md: 0 4px 12px rgba(0,0,0,0.08);
--shadow-lg: 0 8px 24px rgba(0,0,0,0.12);
--transition-fast: 0.15s ease; --transition-base: 0.2s ease; --transition-slow: 0.3s ease;
```

### 8.2 Componentes Principais

| Componente | Classe CSS | Uso |
|-----------|-----------|-----|
| Botão primário | `btn-primary` | Ação principal (salvar, enviar) |
| Botão secundário | `btn-secondary` | Ação secundária (cancelar) |
| Card | `card`, `card-header`, `card-title` | Container genérico |
| Card de métrica | `metric-card-modern` | Dashboard, estatísticas |
| Input group | `input-group`, `input-hint` | Campos de formulário |
| Campo obrigatório | `required-field` | Asterisco vermelho |
| Breadcrumb | `breadcrumb` | Navegação hierárquica |
| Sidebar | `sidebar`, `nav-links` | Menu principal (páginas internas) |
| Dropdown | `dropdown`, `dropdown-arrow`, `dropdown-options` | Submenus |

### 8.3 Layouts

**Páginas Públicas** (login, landing, perfil, redefinir):
```html
<header class="landing-header">...</header>
<section class="features-section"><div class="section-container">...</div></section>
<footer class="landing-footer">...</footer>
```

**Páginas Internas** (todas após login):
```html
<div class="home-container">
  <aside class="sidebar">...</aside>
  <main class="content">
    <nav class="breadcrumb">...</nav>
    <div class="dashboard-header"><h2>Título</h2></div>
    <div class="card">...</div>
  </main>
</div>
```

### 8.4 Responsividade

- **Mobile (≤768px)**: Menu hamburger, sidebar slide-in, gráficos com altura reduzida, labels rotacionados 45°, touch targets ≥44px
- **Tablet (769-1024px)**: Layout adaptado
- **Desktop (>1024px)**: Layout completo com sidebar fixa (240px)

### 8.5 Dropdowns da Sidebar

- Seta `▶` sempre visível, rotaciona quando expandido
- **Desktop**: Hover mostra dropdown + link principal navega
- **Mobile**: Accordion (toque expande/colapsa), auto-expansão do dropdown ativo

---

## 9. Heurísticas de Usabilidade (Nielsen)

| # | Heurística | Status | Implementação |
|---|-----------|--------|---------------|
| 1 | Visibilidade do Status | ✅ | Toast notifications, loading states, progress bars |
| 2 | Correspondência com Mundo Real | ✅ | Ícones Icons8, linguagem em PT-BR |
| 3 | Controle e Liberdade | ✅ | Botões cancelar, confirmação para ações destrutivas, breadcrumbs |
| 4 | Consistência e Padrões | ✅ | Sidebar padrão, paleta de cores, botões consistentes |
| 5 | Prevenção de Erros | ✅ | Validação em tempo real, hints, formatação automática (telefone) |
| 6 | Reconhecimento vs. Recordação | ✅ | Labels claros, placeholders, hints contextuais |
| 7 | Flexibilidade e Eficiência | ✅ | Atalhos (Ctrl+S, Esc, Enter) |
| 8 | Design Estético e Minimalista | ✅ | Cards limpos, hierarquia visual, empty states |
| 9 | Recuperação de Erros | ✅ | Mensagens claras, error boxes, validação visual |
| 10 | Ajuda e Documentação | ✅ | Botão "?" flutuante, painel de ajuda contextual, tooltips |

### Funções JS Globais (utils.js)

- `showToast(msg, type, duration)` — Notificação toast
- `showLoading(msg)` / `hideLoading()` — Overlay de loading
- `showConfirmDialog(msg, onConfirm, onCancel)` — Diálogo de confirmação
- `validateForm(formEl)` — Validação centralizada de formulário
- `setupKeyboardShortcuts()` — Atalhos de teclado
- `setupHelpButton()` / `getHelpContent()` — Ajuda contextual
- `updateUserProfile()` — Perfil na sidebar (carregamento com opacity transition)

### Acessibilidade

- Skip links em todas as páginas
- ARIA labels em todos os elementos interativos
- Contraste WCAG AA (texto principal 12.6:1, secundário 5.7:1)
- Foco visual melhorado (outline 3px)
- Classe `.sr-only` para conteúdo de leitor de tela
- Warning ajustado de `#ffc107` → `#b8860b` (4.5:1)

---

## 10. Deploy e Infraestrutura

### 10.1 Variáveis de Ambiente (Render)

```env
TURSO_DATABASE_URL=libsql://eduscore-do2anjos.aws-us-east-1.turso.io
TURSO_AUTH_TOKEN=eyJhbGciOiJFZERTQSIs...
JWT_SECRET=<chave_secreta_forte>
FRONTEND_URL=https://eduscore-j49m.onrender.com
HUGGINGFACE_API_URL=https://do2anjos-eduscore-yolo-api.hf.space
NODE_ENV=production
PORT=3000
```

### 10.2 Build & Start Commands (Render)

```bash
# Build Command
./render-build.sh
# OU: npm install

# Start Command
npm start
```

O `render-build.sh` instala Tesseract OCR no Linux antes do `npm install`.

### 10.3 Segurança Configurada

- **JWT_SECRET**: Obrigatório (server.js valida na inicialização, `process.exit(1)` se ausente)
- **CORS**: Lista de origens permitidas (não usa wildcard `*`)
- **Trust Proxy**: `app.set('trust proxy', 1)` para Render
- **Rate Limiting**: Geral, login e uploads
- **Senhas**: Hash com bcrypt
- **SQL Injection**: Parâmetros preparados (`$1, $2...` → `?`)

### 10.4 HuggingFace Space

- **URL**: `https://huggingface.co/spaces/do2anjos/eduscore-yolo-api`
- **Arquivos**: `app.py`, `detector_yolo_enem.py`, `ocr_day_detector.py`, `best_yolo11s_optimized.onnx`
- **Endpoints**: fn_index 0 = Live Detection, fn_index 1 = Full Processing

### 10.5 Desenvolvimento Local

```bash
npm install
npm run dev          # nodemon com hot reload
npm run dev:local    # nodemon com config local
npm run migrate      # Executar migrações
```

O banco SQLite é criado automaticamente em `database.sqlite` na primeira execução.

---

## 11. Changelog Consolidado

### [2025-01-27] — Dropdowns, Gráficos Mobile, Revisão Design System

- ✅ Dropdowns da sidebar com seta `▶` e accordion mobile em todas as 9 páginas
- ✅ Gráficos Chart.js responsivos (5 gráficos em 3 páginas)
- ✅ Valores fixos substituídos por variáveis CSS (`configuracoes.html`, `CorrigirSimulado.html`)
- ✅ Revisão completa do design system

### [2025-01-21] — Correções de Cálculos e Layout

- ✅ Validação de questões no upload CSV (número 1-60, resposta A-E)
- ✅ Cálculo de média por disciplina corrigido (LEFT JOIN, considera todas as questões)
- ✅ Separação entre Média de Acertos e Taxa de Erro
- ✅ Gráfico "Retenção por Disciplina" renomeado e reordenado
- ✅ Query de estatísticas gerais corrigida (removido filtro por aluno)
- ✅ Card "Nenhum aluno selecionado" descolado da sidebar
- ✅ Sanfona (accordion) no relatório individual por simulado
- ✅ Busca automática ao selecionar aluno

### [2025-11-22] — Padronização Completa

- ✅ Inspeção de tipografia: hierarquia h1-h6, tamanho mínimo 14px (WCAG AA)
- ✅ Variáveis de font-weight padronizadas
- ✅ Responsividade tipográfica implementada
- ✅ Documentação de design system, guia de padronização, cálculo de métricas

### [2025-11-16] — Relatório Individual: Filtros e Previsão

- ✅ Tabela de simulados com cores condicionais
- ✅ Filtro por simulado no gráfico de disciplinas (cache + tratamento de erro)
- ✅ Card de Previsão (N/A — aguardando modelo)
- ✅ Rota `GET /api/relatorios/estatisticas-individual/:aluno_id/disciplinas/:gabarito_id`
- ✅ Correção mapeamento de parâmetros SQL duplicados (`$2` múltiplo)
- ✅ Flash de conteúdo na sidebar eliminado (opacity: 0 → data-loaded)
- ✅ Campo matrícula no cadastro de alunos
- ✅ Consumo de API robusto em `CadastrarGabarito.html`

### [2024] — UX, Design System e Heurísticas

- ✅ Implementação das 10 heurísticas de Nielsen
- ✅ Sidebar modernizada (240px, fontes maiores, hover effects)
- ✅ Dashboard modernizado (grid responsivo, gauge alunos, progresso mensal)
- ✅ Sistema de toast, loading, confirmação, validação, ajuda
- ✅ Breadcrumbs em todas as páginas internas
- ✅ Atalhos de teclado (Ctrl+S, Esc, Enter)
- ✅ ~600 linhas CSS + ~290 linhas JS adicionadas

### Migrações de Infraestrutura

- ✅ PostgreSQL → SQLite (wrapper automático em `backend/db.js`)
- ✅ SQLite local → Turso (detecção automática por variáveis de ambiente)
- ✅ Processamento Python local → HuggingFace Spaces (YOLO + OCR via GPU)
- ✅ EasyOCR (PyTorch ~400MB) → Tesseract OCR (~20MB)

### Correções de Erros

- ✅ Referência `Simulado.html` → `CorrigirSimulado.html` em server.js
- ✅ Código incompleto em `script.js` removido
- ✅ `generateUUID` consolidado em `db.js` (removida duplicação)
- ✅ Imports não utilizados removidos (`crypto` em respostas.js e gabaritos.js)

---

## 12. Pendências e Melhorias Futuras

### 🔴 Alta Prioridade

- [ ] **Modelo de Predição**: Implementar previsão de acertos (card "Previsão" atualmente N/A)
- [ ] **Testes**: Implementar testes unitários e de integração (nenhum teste automatizado existe)
- [ ] **Teste com leitor de tela**: Validar acessibilidade com NVDA/JAWS em dispositivo real

### 🟡 Média Prioridade

- [ ] **Retry logic**: Adicionar retry se HuggingFace falhar
- [ ] **Cache de resultados**: Cache de frames repetidos na correção mobile
- [ ] **Monitoramento de latência**: HuggingFace adiciona ~100-300ms
- [ ] **Dark Mode**: Implementar tema escuro usando variáveis CSS
- [ ] **PWA**: Transformar em Progressive Web App
- [ ] **Teste em dispositivos reais**: iPhone (Safari), Android (Chrome), tablets

### 🟢 Baixa Prioridade

- [ ] **Logging estruturado**: Substituir console.log por winston/pino
- [ ] **Escala tipográfica em rem**: Usar rem para melhor acessibilidade de zoom
- [ ] **Onboarding**: Tour guiado para novos usuários
- [ ] **Testes E2E**: Implementar testes automatizados end-to-end

---

**Mantido por:** Equipe de Desenvolvimento  
**Última atualização:** 2026-07-11
