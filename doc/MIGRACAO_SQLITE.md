# Relatório de Migração PostgreSQL → SQLite

## ✅ Conversões Automáticas Implementadas

### 1. Placeholders de Parâmetros
- **PostgreSQL**: `$1, $2, $3...`
- **SQLite**: `?`
- **Status**: ✅ Convertido automaticamente no wrapper

### 2. Funções de Data/Hora
- **NOW()** → **datetime('now')**
- **TO_CHAR(data, 'YYYY-MM-DD')** → **strftime('%Y-%m-%d', data)**
- **TO_CHAR(hora, 'HH24:MI')** → **strftime('%H:%M', hora)**
- **Status**: ✅ Convertido automaticamente

### 3. Operador ILIKE (Case-Insensitive)
- **ILIKE** → **UPPER(campo) LIKE UPPER(valor)**
- **Status**: ✅ Convertido automaticamente

### 4. RETURNING em INSERT
- **PostgreSQL**: `INSERT ... RETURNING *`
- **SQLite**: INSERT + SELECT separado usando `rowid` ou `id` gerado
- **Status**: ✅ Implementado no wrapper

### 5. COUNT(*)
- Normalização automática: `COUNT(*)` → `count` (minúsculo)
- **Status**: ✅ Implementado no wrapper

### 6. Geração Automática de IDs (UUID)
- IDs são gerados automaticamente quando não fornecidos
- **Status**: ✅ Implementado no wrapper

## 🔧 Correções Aplicadas

### Arquivos Modificados

1. **backend/db.js**
   - ✅ Wrapper completo de conversão PostgreSQL → SQLite
   - ✅ Suporte a transações
   - ✅ Normalização de COUNT(*)
   - ✅ Conversão de RETURNING
   - ✅ Geração automática de UUIDs

2. **backend/utils/transaction.js**
   - ✅ Adaptado para SQLite (transações automáticas)

3. **backend/routes/gabaritos.js**
   - ✅ Corrigido `withTransaction` (client → db)

4. **backend/migrations/create_schema.js** (NOVO)
   - ✅ Script de criação de schema completo
   - ✅ 8 tabelas criadas
   - ✅ Índices para performance
   - ✅ Foreign keys habilitadas

5. **package.json**
   - ✅ Removido: `pg`
   - ✅ Adicionado: `better-sqlite3`
   - ✅ Adicionado script: `npm run migrate`

6. **README.md**
   - ✅ Atualizado com instruções SQLite

7. **.gitignore**
   - ✅ Adicionado: `*.sqlite`, `*.db`

## ⚠️ Pontos de Atenção

### 1. Tipos de Dados
- **UUID**: SQLite não tem tipo UUID nativo, usar TEXT
- **Timestamps**: SQLite usa TEXT, INTEGER ou REAL para datas
- **Solução**: IDs são gerados automaticamente como TEXT (UUID v4)

### 2. Queries com CASE WHEN
- ✅ SQLite suporta CASE WHEN (compatível)
- Exemplo: `CASE WHEN r.acertou THEN 1 ELSE 0 END`

### 3. Funções Agregadas
- ✅ COUNT, AVG, ROUND, DISTINCT são compatíveis
- ✅ GROUP BY funciona igual

### 4. JOINs
- ✅ INNER JOIN, LEFT JOIN são compatíveis

## 📋 Checklist de Verificação

- [x] Dependências atualizadas (package.json)
- [x] Wrapper de banco criado (backend/db.js)
- [x] Conversão de placeholders ($1 → ?)
- [x] Conversão de NOW()
- [x] Conversão de TO_CHAR()
- [x] Conversão de ILIKE
- [x] Suporte a RETURNING
- [x] Normalização de COUNT(*)
- [x] Geração automática de UUIDs
- [x] Transações corrigidas
- [x] Script de migração criado
- [x] README atualizado
- [x] .gitignore atualizado

## 🚀 Próximos Passos

1. **Instalar dependências:**
   ```bash
   npm install
   ```

2. **Criar schema do banco:**
   ```bash
   npm run migrate
   ```
   Ou:
   ```bash
   node backend/migrations/create_schema.js
   ```

3. **Testar o servidor:**
   ```bash
   npm run dev
   ```

## 📝 Notas Importantes

- O wrapper mantém compatibilidade com o código existente
- Todas as queries PostgreSQL são convertidas automaticamente
- Não é necessário alterar as rotas existentes
- O banco SQLite será criado automaticamente na primeira execução
- IDs são gerados automaticamente quando não fornecidos nas queries INSERT

## 📊 Tabelas Criadas

O script de migração cria as seguintes tabelas:

1. **usuarios** - Usuários do sistema (professores, coordenadores, admins)
2. **alunos** - Alunos cadastrados
3. **disciplinas** - Disciplinas do sistema
4. **gabaritos** - Gabaritos de provas
5. **questoes** - Questões dos gabaritos
6. **respostas** - Respostas dos alunos
7. **sessoes** - Sessões de prova
8. **relatorios** - Relatórios gerados

Todas as tabelas incluem:
- Foreign keys configuradas
- Índices para performance
- Constraints de integridade

## 🔍 Testes Recomendados

Após instalar as dependências e criar o schema:

1. Testar login de usuário
2. Testar criação de aluno
3. Testar criação de gabarito
4. Testar upload de CSV
5. Testar listagem com filtros
6. Testar queries com JOINs
7. Testar agregações (COUNT, AVG)
