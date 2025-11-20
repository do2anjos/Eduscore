# EduScore - Plataforma Integrada de Analytics Educacional

> **EduScore: From digitizing answer sheets to predicting performance using machine learning, an integrated educational analytics platform for the context of university entrance exams in Amazonas**

Plataforma educacional integrada que combina digitalização de folhas de resposta, análise de desempenho e predição de resultados utilizando machine learning, desenvolvida especificamente para o contexto de exames vestibulares no Amazonas.

**Última atualização**: 2025-11-16 17:41:12

## 🎯 Sobre o Projeto

O **EduScore** é uma plataforma completa de analytics educacional que oferece:

- 📝 **Digitalização de Folhas de Resposta**: Processamento automatizado de simulados e provas usando OCR e detecção de marcações em bolhas
- 📊 **Análise de Desempenho**: Relatórios detalhados e métricas em tempo real
- 🔮 **Predição de Desempenho**: Modelo de machine learning para previsão de resultados (em desenvolvimento)
- 📈 **Visualização de Dados**: Gráficos interativos e dashboards personalizados
- 🎓 **Gestão Educacional**: Controle completo de alunos, disciplinas, simulados e sessões

Desenvolvido para coordenadores e professores acompanharem o progresso dos alunos em simulados e exames vestibulares, com foco no contexto universitário do Amazonas.

## 📋 Índice

- [Sobre o Projeto](#sobre-o-projeto)
- [Funcionalidades](#funcionalidades)
- [Requisitos](#requisitos)
- [Instalação](#instalação)
- [Configuração](#configuração)
- [Executando o Projeto](#executando-o-projeto)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Módulos da Plataforma](#módulos-da-plataforma)
- [Autenticação](#autenticação)
- [API](#api)
- [Documentação](#documentação)

## ✨ Funcionalidades Principais

### 📊 Dashboard e Relatórios
- **Dashboard Geral**: Visão consolidada com métricas de alunos ativos, progresso mensal, simulados aplicados e retenção por disciplina
- **Relatório Geral**: Estatísticas agregadas com filtro por etapa/turma
- **Relatório Individual**: Análise detalhada por aluno incluindo:
  - Desempenho ao longo do tempo
  - Relatório por simulado específico
  - Desempenho por disciplina (geral ou filtrado por simulado)
  - Previsão de desempenho (em desenvolvimento)

### 📝 Gestão de Simulados
- Upload e processamento de gabaritos via CSV
- Criação e gerenciamento de questões
- Correção automática de respostas
- Agendamento de sessões de avaliação

### 🎓 Gestão Acadêmica
- Cadastro e gerenciamento de alunos
- Gestão de disciplinas
- Controle de usuários (professores, coordenadores, administradores)

### 🔮 Predição de Desempenho
- Modelo de machine learning para previsão de acertos (em desenvolvimento)
- Baseado em histórico de desempenho do aluno
- Auxilia no planejamento de estudos

## 🔧 Requisitos

- Node.js 14+ 
- SQLite 3 (incluído no Node.js via better-sqlite3)
- npm ou yarn
- **Python 3.7+** (para processamento de imagens de folhas de resposta)
- **OpenCV (cv2)** e **NumPy** instalados via pip

## 📦 Instalação

1. Clone o repositório:
```bash
git clone <url-do-repositorio>
cd classy-main
```

2. Instale as dependências do Node.js:
```bash
npm install
```

3. Instale as dependências Python para processamento de imagens:
```bash
# Windows
pip install -r backend/scripts/requirements.txt

# Linux/Mac
pip3 install -r backend/scripts/requirements.txt
```

**Nota**: Certifique-se de que o Python está instalado e no PATH do sistema.

4. Configure o arquivo `.env` em `backend/` (veja [Configuração](#configuração))

## ⚙️ Configuração

Crie um arquivo `backend/.env` com as seguintes variáveis:

```env
# Banco de Dados SQLite
# Caminho do arquivo do banco (opcional, padrão: database.sqlite na raiz)
DB_PATH=./database.sqlite

# Segurança - JWT Secret (OBRIGATÓRIO)
# Gere uma chave segura com:
# node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=sua_chave_secreta_muito_forte_aqui

# Frontend URL para CORS
FRONTEND_URL=http://localhost:3000

# Configuração do Servidor
PORT=3000
NODE_ENV=development
```

**IMPORTANTE**: O `JWT_SECRET` é obrigatório. O servidor não iniciará sem ele.

## 🚀 Executando o Projeto

### Modo Desenvolvimento
```bash
npm run dev
```

### Modo Produção
```bash
npm start
```

O servidor estará disponível em `http://localhost:3000`

## 📁 Estrutura do Projeto

```
classy-main/
├── backend/
│   ├── middleware/       # Middlewares (auth, errorHandler, validation)
│   │   ├── auth.js      # Autenticação JWT
│   │   ├── errorHandler.js  # Tratamento de erros
│   │   └── validation.js    # Validação de dados
│   ├── scripts/          # Scripts Python para processamento
│   │   ├── detectar_tipo_imagem.py  # Detecta automaticamente se imagem precisa de processamento
│   │   ├── processar_respostas_Imagem_original.py  # Processa imagens originais (com correção de perspectiva)
│   │   ├── processar_respostas_imagem_processadas.py  # Processa imagens já pré-processadas (sem correção de perspectiva)
│   │   └── requirements.txt        # Dependências Python
│   ├── routes/          # Rotas da API
│   │   ├── alunos.js    # Gestão de alunos
│   │   ├── disciplinas.js   # Gestão de disciplinas
│   │   ├── gabaritos.js     # Gestão de gabaritos/simulados
│   │   ├── questoes.js      # Gestão de questões
│   │   ├── respostas.js     # Gestão de respostas
│   │   ├── relatorios.js    # Relatórios e estatísticas
│   │   ├── sessoes.js       # Gestão de sessões
│   │   └── usuarios.js      # Gestão de usuários
│   ├── migrations/      # Migrações do banco de dados
│   ├── utils/           # Utilitários (transactions)
│   ├── db.js            # Configuração do banco SQLite
│   └── .env             # Variáveis de ambiente (não versionado)
├── public/              # Frontend - Arquivos estáticos
│   ├── *.html          # Páginas da aplicação
│   ├── style.css       # Estilos globais
│   ├── utils.js        # Utilitários frontend (heurísticas Nielsen)
│   └── script.js       # Scripts adicionais
├── doc/                 # Documentação do projeto
│   ├── API.md          # Documentação completa da API
│   ├── CHANGELOG.md    # Histórico de alterações
│   ├── CALCULO_METRICAS.md  # Como métricas são calculadas
│   └── ...
├── uploads/             # Arquivos enviados (criado automaticamente)
├── database.sqlite      # Banco de dados SQLite
├── server.js            # Servidor Express.js principal
└── package.json         # Dependências do projeto
```

## 🏗️ Módulos da Plataforma

| Módulo | Descrição | Tecnologias |
|--------|-----------|-------------|
| **Autenticação e Usuários** | Sistema JWT, gestão de professores/coordenadores | Node.js, Express.js, JWT, bcrypt |
| **Gestão de Alunos** | CRUD completo de alunos | Node.js, Express.js, SQLite |
| **Gestão de Disciplinas** | Gerenciamento de disciplinas e cursos | Node.js, Express.js, SQLite |
| **Digitalização e Gabaritos** | Upload CSV, processamento de questões, correção automática | Node.js, Express.js, Multer, csv-parser |
| **Gestão de Sessões** | Agendamento e controle de simulados | Node.js, Express.js, SQLite |
| **Respostas e Correção** | Processamento e correção automática | Node.js, Express.js, SQLite |
| **Analytics e Relatórios** | Métricas, gráficos, estatísticas | Node.js, Express.js, Chart.js |
| **Predição de Desempenho** | Modelo ML para previsão (em desenvolvimento) | - |
| **Interface Web** | Frontend responsivo e acessível | HTML5, CSS3, JavaScript (Vanilla) |
| **Segurança** | Middlewares de autenticação, rate limiting, validação | Express.js, JWT, express-rate-limit |

**Stack Tecnológica:**
- **Backend**: Node.js + Express.js
- **Banco de Dados**: SQLite (better-sqlite3)
- **Autenticação**: JWT (jsonwebtoken) + bcrypt
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla) + Chart.js
- **Upload**: Multer (processamento de arquivos CSV)
- **Segurança**: express-rate-limit, CORS, validação de dados

## 🔐 Autenticação

O sistema usa JWT (JSON Web Tokens) para autenticação.

### Como obter um token:

1. **Registrar um novo usuário:**
```bash
POST /api/usuarios/registro
{
  "nome": "João Silva",
  "email": "joao@escola.edu.br",
  "matricula": "12345",
  "telefone": "11999999999",
  "senha": "Senha123!@#",
  "perfil": "professor"
}
```

2. **Fazer login:**
```bash
POST /api/usuarios/login
{
  "email": "joao@escola.edu.br",
  "senha": "Senha123!@#"
}
```

A resposta incluirá um `token` que deve ser enviado no header `Authorization`:

```
Authorization: Bearer <token>
```

### Perfis de Usuário

- `professor`: Acesso básico
- `coordenador`: Pode criar sessões
- `admin`: Acesso total

## 📡 API

Consulte o arquivo [API.md](./doc/API.md) para documentação completa da API.

## 📚 Documentação

**Última atualização**: 2025-11-16 17:41:12

- **[API Documentation](doc/API.md)** - Documentação completa da API REST com exemplos
- **[Cálculo de Métricas](doc/CALCULO_METRICAS.md)** - Como métricas e gráficos são calculados
- **[Changelog](doc/CHANGELOG.md)** - Histórico completo de alterações com datas
- **[Diagnóstico do Projeto](doc/DIAGNOSTICO_PROJETO.md)** - Análise inicial do projeto
- **[Migração SQLite](doc/MIGRACAO_SQLITE.md)** - Detalhes da migração de PostgreSQL para SQLite
- **[Heurísticas de Nielsen](doc/HEURISTICAS_NIELSEN.md)** - Implementação das 10 heurísticas de usabilidade

## 🎨 Design System e Usabilidade

O projeto implementa as **10 Heurísticas de Usabilidade de Nielsen** para garantir uma experiência excepcional:

1. ✅ **Visibilidade do Status do Sistema** - Toast notifications, loading states, progress bars
2. ✅ **Correspondência com o Mundo Real** - Ícones familiares, linguagem natural em português
3. ✅ **Controle e Liberdade** - Botões cancelar, confirmações, breadcrumbs
4. ✅ **Consistência e Padrões** - Navegação consistente, cores padronizadas (#008cc4, #003b54)
5. ✅ **Prevenção de Erros** - Validação em tempo real, hints contextuais
6. ✅ **Reconhecimento ao Invés de Recordação** - Labels claros, placeholders informativos
7. ✅ **Flexibilidade e Eficiência** - Atalhos de teclado, ações rápidas
8. ✅ **Design Estético e Minimalista** - Cards limpos, hierarquia visual clara
9. ✅ **Ajudar Usuários a Recuperar de Erros** - Mensagens claras, sugestões de correção
10. ✅ **Ajuda e Documentação** - Botão de ajuda, tooltips, atalhos visíveis

### 🎯 Melhorias de UX Implementadas

- **Sidebar Modernizada**: Tipografia melhorada (15px), melhor legibilidade, largura aumentada (240px)
- **Dashboard Moderno**: Cards reorganizados com grid responsivo, gráficos interativos com Chart.js
- **Feedback Visual**: Sistema completo de notificações toast e estados de loading
- **Acessibilidade**: ARIA labels, focus visible, semantic HTML, suporte a leitores de tela
- **Validação**: Formulários com validação em tempo real e mensagens claras
- **Responsividade**: Layout adaptável para diferentes tamanhos de tela

### Rotas Públicas

- `POST /api/usuarios/registro` - Registrar novo usuário
- `POST /api/usuarios/login` - Fazer login
- `GET /api/disciplinas` - Listar disciplinas
- `GET /api/sessoes` - Listar sessões

### Rotas Protegidas

Todas as outras rotas requerem autenticação via JWT.

## 🛡️ Segurança

- ✅ Autenticação JWT obrigatória
- ✅ Rate limiting configurado
- ✅ CORS configurado
- ✅ Validação de entrada
- ✅ Proteção contra SQL injection (parâmetros preparados)
- ✅ Hash de senhas com bcrypt

## 🚧 Funcionalidades em Desenvolvimento

- **Modelo de Predição**: Machine learning para prever número de acertos esperado no dia da prova
- **Análise de Padrões**: Identificação de áreas de dificuldade recorrentes
- **Recomendações Personalizadas**: Sugestões de estudos baseadas em desempenho

## 📝 Notas Importantes

- O diretório `uploads/` é criado automaticamente na primeira execução
- Em produção, configure `NODE_ENV=production`
- Use uma chave JWT_SECRET forte e única em produção
- O rate limiting protege contra abuso da API
- Os dados são persistidos em SQLite (banco de dados embutido)
- Suporte completo para importação de gabaritos via CSV
- Sistema preparado para escalar com múltiplos simulados e alunos

## 🐛 Troubleshooting

### Erro: "JWT_SECRET não está definido"
- Certifique-se de que o arquivo `backend/.env` existe
- Verifique se a variável `JWT_SECRET` está definida

### Erro de conexão com banco de dados
- Verifique se o arquivo do banco SQLite existe ou será criado automaticamente
- Certifique-se de que o diretório do banco tem permissões de escrita

### Erro: "Muitas requisições"
- O rate limiting está funcionando
- Aguarde alguns instantes antes de tentar novamente

## 📄 Licença

ISC

