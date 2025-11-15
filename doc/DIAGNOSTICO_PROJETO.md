# 🔍 DIAGNÓSTICO PROFUNDO DO PROJETO

## 📋 SUMÁRIO EXECUTIVO

Este documento apresenta um diagnóstico completo do projeto, identificando problemas críticos de estrutura, segurança, organização e boas práticas.

---

## 🚨 PROBLEMAS CRÍTICOS

### 1. **ARQUIVO `index.js` NA RAIZ É LIXO**
- **Localização**: `index.js` (raiz do projeto)
- **Problema**: O arquivo contém código de uma dependência (`side-channel-map`) que não deveria estar na raiz
- **Impacto**: Confusão sobre qual arquivo é o ponto de entrada do projeto
- **Solução**: Deletar este arquivo imediatamente

### 2. **DUPLICAÇÃO DE DEPENDÊNCIAS**
- **Problema**: Existem dois `package.json` (raiz e `backend/`) com dependências duplicadas e conflitantes
- **Dependências duplicadas**:
  - `bcrypt`: ^6.0.0 (raiz) vs ^6.0.0 (backend)
  - `express`: ^4.21.2 (raiz) vs ^5.1.0 (backend) ⚠️ **VERSÕES DIFERENTES!**
  - `jsonwebtoken`: ^9.0.2 (ambos)
  - `pg`: ^8.16.3 (ambos)
  - `dotenv`: ^16.6.1 (raiz) vs ^17.2.0 (backend)
- **Impacto**: 
  - Conflitos de versão podem causar bugs
  - Duplicação de `node_modules` (aumenta tamanho do projeto)
  - Confusão sobre qual `package.json` usar
- **Solução**: Consolidar em um único `package.json` na raiz

### 3. **FALTA DE AUTENTICAÇÃO EM ROTAS CRÍTICAS**
- **Problema**: A maioria das rotas não possui middleware de autenticação
- **Rotas DESPROTEGIDAS**:
  - `/api/alunos/*` - Qualquer um pode criar/editar/deletar alunos
  - `/api/disciplinas/*` - Acesso público total
  - `/api/gabaritos/*` - Qualquer um pode criar/deletar gabaritos
  - `/api/questoes/*` - Manipulação livre de questões
  - `/api/respostas/*` - Qualquer um pode ver/editar respostas
  - `/api/sessoes/*` - Acesso público (exceto validação manual em DELETE)
- **Rotas PARCIALMENTE PROTEGIDAS**:
  - `/api/usuarios/*` - Middleware de autenticação aplicado APÓS login/registro (linha 194), mas isso significa que GET /api/usuarios requer token, mas POST /registro e POST /login não (correto)
- **Impacto**: **VULNERABILIDADE CRÍTICA DE SEGURANÇA**
- **Solução**: Criar middleware de autenticação centralizado e aplicá-lo em todas as rotas sensíveis

### 4. **JWT_SECRET COM VALOR PADRÃO INSEGURO**
- **Localização**: `backend/routes/usuarios.js:24`
- **Código problemático**:
  ```javascript
  const JWT_SECRET = process.env.JWT_SECRET || 'your_very_secret_key';
  ```
- **Problema**: Se `JWT_SECRET` não estiver definido, usa uma chave fraca e conhecida
- **Impacto**: Tokens podem ser facilmente falsificados
- **Solução**: Tornar obrigatório via validação de startup

### 5. **CORS CONFIGURADO COM WILDCARD**
- **Localização**: `backend/routes/usuarios.js:10`
- **Código problemático**:
  ```javascript
  res.header('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
  ```
- **Problema**: Permite requisições de qualquer origem se `FRONTEND_URL` não estiver definido
- **Impacto**: Vulnerabilidade CSRF
- **Solução**: Remover fallback para `*` ou validar na inicialização

### 6. **MIDDLEWARE DE AUTENTICAÇÃO MAL POSICIONADO**
- **Localização**: `backend/routes/usuarios.js:194`
- **Problema**: O middleware de autenticação é aplicado DEPOIS das rotas `/registro` e `/login`, mas ANTES de outras rotas. Isso está correto, mas o middleware está dentro do arquivo de rotas, não centralizado.
- **Impacto**: Difícil reutilizar em outras rotas
- **Solução**: Criar arquivo `backend/middleware/auth.js` separado

---

## ⚠️ PROBLEMAS GRAVES

### 7. **ESTRUTURA DE PROJETO CONFUSA**
- **Problema**: 
  - `server.js` na raiz, mas rotas em `backend/routes/`
  - `backend/db.js` mas `server.js` na raiz
  - Dois `package.json` sem clareza sobre qual usar
- **Impacto**: Dificulta manutenção e onboarding
- **Solução**: Reorganizar estrutura ou consolidar

### 8. **FALTA DE ARQUIVO `.env.example`**
- **Problema**: Não há exemplo de variáveis de ambiente necessárias
- **Impacto**: Dificulta configuração do projeto
- **Solução**: Criar `.env.example` com todas as variáveis necessárias

### 9. **CONFIGURAÇÃO DUPLICADA DE MIDDLEWARES**
- **Localização**: `server.js:13-16`
- **Problema**: `express.json()` e `bodyParser.json()` são configurados duas vezes
- **Código**:
  ```javascript
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(bodyParser.json({ limit: '10mb' }));
  app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
  ```
- **Impacto**: Redundância desnecessária (body-parser está integrado no Express 4.16+)
- **Solução**: Remover `body-parser` ou usar apenas um

### 10. **FALTA DE VALIDAÇÃO DE ENTRADA CONSISTENTE**
- **Problema**: Cada rota valida de forma diferente
- **Exemplos**:
  - `alunos.js`: Validação básica inline
  - `usuarios.js`: Validação mais robusta
  - `respostas.js`: Validação mínima
- **Impacto**: Código inconsistente e difícil de manter
- **Solução**: Criar middleware de validação centralizado (ex: usando `joi` ou `express-validator`)

### 11. **TRATAMENTO DE ERROS INCONSISTENTE**
- **Problema**: Formato de resposta de erro varia entre rotas
- **Exemplos**:
  - `alunos.js`: `{ sucesso: false, erro: '...' }`
  - `respostas.js`: `{ erro: '...' }` (sem campo `sucesso`)
  - `usuarios.js`: `{ sucesso: false, erro: '...', detalhes: '...' }`
- **Impacto**: Frontend precisa lidar com múltiplos formatos
- **Solução**: Padronizar formato de resposta de erro

### 12. **FALTA DE VALIDAÇÃO DE TIPOS DE DADOS**
- **Problema**: Não há validação de tipos (UUID, números, datas)
- **Exemplo**: `sessoes.js:266` usa `req.user.id` sem verificar se `req.user` existe
- **Impacto**: Pode causar erros em runtime
- **Solução**: Adicionar validação de tipos e verificação de existência

### 13. **QUERIES SQL SEM PROTEÇÃO CONTRA SQL INJECTION**
- **Status**: ✅ **PROTEGIDO** - Uso de parâmetros preparados (`$1, $2, etc.`)
- **Observação**: Boa prática mantida, mas algumas queries dinâmicas em `sessoes.js` precisam atenção

### 14. **FALTA DE LOGGING ESTRUTURADO**
- **Problema**: Apenas `console.log` e `console.error`
- **Impacto**: Difícil debugar em produção
- **Solução**: Implementar biblioteca de logging (ex: `winston`, `pino`)

### 15. **FALTA DE RATE LIMITING**
- **Problema**: Não há proteção contra abuso de API
- **Impacto**: Vulnerável a ataques de força bruta e DDoS
- **Solução**: Implementar `express-rate-limit`

---

## 📁 PROBLEMAS DE ORGANIZAÇÃO

### 16. **ARQUIVO `script.js` MÍNIMO**
- **Localização**: `public/script.js`
- **Problema**: Contém apenas código de exemplo (botões de login)
- **Impacto**: Código JavaScript provavelmente está inline nos HTMLs
- **Solução**: Centralizar JavaScript ou usar módulos

### 17. **FALTA DE SEPARAÇÃO DE RESPONSABILIDADES**
- **Problema**: Lógica de negócio misturada com rotas
- **Exemplo**: Validação de coordenador em `sessoes.js` poderia estar em um serviço
- **Solução**: Criar camada de serviços (`backend/services/`)

### 18. **FALTA DE DOCUMENTAÇÃO**
- **Problema**: 
  - Sem README.md
  - Sem documentação de API
  - Comentários Swagger incompletos (apenas em algumas rotas)
- **Solução**: Criar README completo e documentação de API

### 19. **NOMENCLATURA INCONSISTENTE**
- **Problema**: 
  - Arquivos HTML com maiúsculas: `AgendarSessao.html`, `CadastrarGabarito.html`
  - Outros com minúsculas: `login.html`, `home.html`
- **Solução**: Padronizar nomenclatura (recomendado: kebab-case)

### 20. **FALTA DE TESTES**
- **Problema**: Nenhum arquivo de teste encontrado
- **Impacto**: Sem garantia de qualidade
- **Solução**: Implementar testes unitários e de integração

---

## 🔧 PROBLEMAS TÉCNICOS MENORES

### 21. **DEPENDÊNCIAS NÃO UTILIZADAS**
- **Problema**: `package.json` da raiz tem dependências que podem não ser usadas:
  - `connect-flash`: Não encontrado uso
  - `express-session`: Não encontrado uso
  - `mysql2`: Projeto usa PostgreSQL
  - `sqlite3`: Projeto usa PostgreSQL
- **Solução**: Remover dependências não utilizadas

### 22. **CONFIGURAÇÃO DE UPLOAD SEM VALIDAÇÃO DE DIRETÓRIO**
- **Localização**: `backend/routes/gabaritos.js:12`
- **Problema**: Diretório `uploads/` pode não existir
- **Solução**: Criar diretório automaticamente ou validar existência

### 23. **FALTA DE VALIDAÇÃO DE TAMANHO DE ARQUIVO NO FRONTEND**
- **Problema**: Validação apenas no backend
- **Solução**: Adicionar validação no frontend para melhor UX

### 24. **TRANSACTIONS SEM TRY-CATCH ADEQUADO**
- **Localização**: `backend/routes/gabaritos.js:114-124`
- **Problema**: Se houver erro após `BEGIN`, pode ficar em estado inconsistente
- **Solução**: Usar try-catch-finally ou wrapper de transação

### 25. **FALTA DE ÍNDICES NO BANCO DE DADOS**
- **Problema**: Não há informação sobre índices nas queries
- **Impacto**: Queries podem ser lentas com muitos dados
- **Solução**: Adicionar índices em colunas frequentemente consultadas

---

## 📊 RESUMO DE PRIORIDADES

### 🔴 **CRÍTICO (Resolver Imediatamente)**
1. Deletar `index.js` da raiz
2. Consolidar `package.json` e resolver conflitos de versão
3. Implementar autenticação em todas as rotas sensíveis
4. Corrigir JWT_SECRET padrão inseguro
5. Corrigir CORS com wildcard

### 🟠 **ALTO (Resolver em Breve)**
6. Reorganizar estrutura do projeto
7. Criar middleware de autenticação centralizado
8. Padronizar tratamento de erros
9. Implementar validação de entrada consistente
10. Adicionar `.env.example`

### 🟡 **MÉDIO (Melhorias Importantes)**
11. Implementar logging estruturado
12. Adicionar rate limiting
13. Criar camada de serviços
14. Documentar API e criar README
15. Padronizar nomenclatura de arquivos

### 🟢 **BAIXO (Melhorias Futuras)**
16. Implementar testes
17. Remover dependências não utilizadas
18. Adicionar validação de tipos
19. Melhorar tratamento de transações
20. Otimizar queries com índices

---

## 📝 RECOMENDAÇÕES GERAIS

1. **Adotar uma arquitetura clara**: MVC ou camadas (routes → services → models)
2. **Implementar CI/CD**: Para garantir qualidade antes do deploy
3. **Usar TypeScript**: Para type safety e melhor DX
4. **Implementar monitoramento**: Para detectar problemas em produção
5. **Criar documentação**: README, API docs, e guias de contribuição

---

## ✅ PONTOS POSITIVOS

1. ✅ Uso de parâmetros preparados (proteção contra SQL injection)
2. ✅ Hash de senhas com bcrypt
3. ✅ Uso de JWT para autenticação
4. ✅ Estrutura de rotas organizada por recurso
5. ✅ Tratamento básico de erros presente

---

**Data do Diagnóstico**: $(date)
**Versão do Projeto**: Não especificada
**Total de Problemas Identificados**: 25+

