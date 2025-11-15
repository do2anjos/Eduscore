# Classy - Sistema de Gestão Educacional

> Sistema moderno de gestão educacional com foco em usabilidade e experiência do usuário, implementando as 10 Heurísticas de Nielsen.

Sistema completo para gestão de alunos, disciplinas, gabaritos, questões e relatórios educacionais.

## 📋 Índice

- [Requisitos](#requisitos)
- [Instalação](#instalação)
- [Configuração](#configuração)
- [Executando o Projeto](#executando-o-projeto)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Autenticação](#autenticação)
- [API](#api)

## 🔧 Requisitos

- Node.js 14+ 
- SQLite 3 (incluído no Node.js via better-sqlite3)
- npm ou yarn

## 📦 Instalação

1. Clone o repositório:
```bash
git clone <url-do-repositorio>
cd classy-main
```

2. Instale as dependências:
```bash
npm install
```

3. Configure o arquivo `.env` em `backend/` (veja [Configuração](#configuração))

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
│   ├── routes/          # Rotas da API
│   ├── utils/           # Utilitários (transactions)
│   ├── db.js            # Configuração do banco de dados
│   └── .env             # Variáveis de ambiente (não versionado)
├── public/              # Arquivos estáticos (HTML, CSS, JS)
├── uploads/             # Diretório de uploads (criado automaticamente)
├── server.js            # Arquivo principal do servidor
└── package.json         # Dependências do projeto
```

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

- [API Documentation](doc/API.md) - Documentação completa da API REST
- [Diagnóstico do Projeto](doc/DIAGNOSTICO_PROJETO.md) - Análise inicial do projeto
- [Migração SQLite](doc/MIGRACAO_SQLITE.md) - Detalhes da migração de PostgreSQL para SQLite
- [Heurísticas de Nielsen](doc/HEURISTICAS_NIELSEN.md) - Implementação das 10 heurísticas de usabilidade
- [Changelog](doc/CHANGELOG.md) - Histórico completo de alterações

## 🎨 Design System

O projeto implementa as **10 Heurísticas de Usabilidade de Nielsen**:

1. ✅ **Visibilidade do Status do Sistema** - Toast notifications, loading states, progress bars
2. ✅ **Correspondência com o Mundo Real** - Ícones familiares, linguagem natural
3. ✅ **Controle e Liberdade** - Botões cancelar, confirmações, breadcrumbs
4. ✅ **Consistência e Padrões** - Navegação consistente, cores padronizadas
5. ✅ **Prevenção de Erros** - Validação em tempo real, hints contextuais
6. ✅ **Reconhecimento ao Invés de Recordação** - Labels claros, placeholders informativos
7. ✅ **Flexibilidade e Eficiência** - Atalhos de teclado, ações rápidas
8. ✅ **Design Estético e Minimalista** - Cards limpos, hierarquia visual clara
9. ✅ **Ajudar Usuários a Recuperar de Erros** - Mensagens claras, sugestões de correção
10. ✅ **Ajuda e Documentação** - Botão de ajuda, tooltips, atalhos visíveis

### 🎯 Melhorias Implementadas

- **Sidebar Modernizada**: Tipografia melhorada (15px), melhor legibilidade, largura aumentada (240px)
- **Dashboard Moderno**: Cards reorganizados com grid responsivo, gráficos atualizados
- **Feedback Visual**: Sistema completo de notificações toast e estados de loading
- **Acessibilidade**: ARIA labels, focus visible, semantic HTML
- **Validação**: Formulários com validação em tempo real e mensagens claras

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

## 📝 Notas

- O diretório `uploads/` é criado automaticamente na primeira execução
- Em produção, configure `NODE_ENV=production`
- Use uma chave JWT_SECRET forte e única em produção
- O rate limiting protege contra abuso da API

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

