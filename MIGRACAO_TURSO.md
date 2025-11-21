# Guia de Migração: SQLite Local → Turso no Render

## Status da Migração

✅ **CONCLUÍDA** - Aplicação pronta para produção no Render com Turso

## O que foi feito

### 1. Dependências
- ✅ Adicionado `@libsql/client` no `package.json`
- ✅ Mantido `better-sqlite3` para desenvolvimento local

### 2. Código Atualizado

#### `backend/db.js`
- ✅ Detecção automática de ambiente (Turso vs SQLite local)
- ✅ Wrapper unificado compatível com ambos os bancos
- ✅ Interface mantida: `db.query()` retorna Promise (já estava assim)
- ✅ Métodos async para migrações: `db.exec()`, `db.pragma()`, `db.prepare()`

#### Migrações
- ✅ `backend/migrations/create_schema.js` - Convertido para async/await
- ✅ `backend/migrations/add_imagens_cartoes.js` - Convertido para async/await

## Como Funciona

### Detecção Automática

A aplicação detecta automaticamente qual banco usar:

- **Turso (Produção)**: Se `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN` estiverem definidos
- **SQLite Local (Desenvolvimento)**: Caso contrário

### Compatibilidade

- ✅ Rotas não precisam de alteração (já usam `await db.query()`)
- ✅ Migrações funcionam em ambos os ambientes
- ✅ Código transparente para o resto da aplicação

## Configuração no Render

### Variáveis de Ambiente Necessárias

Configure no painel do Render (Environment Variables):

```
TURSO_DATABASE_URL=libsql://eduscore-do2anjos.aws-us-east-1.turso.io
TURSO_AUTH_TOKEN=eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9...
JWT_SECRET=sua_chave_secreta_jwt
FRONTEND_URL=https://eduscore-j49m.onrender.com
NODE_ENV=production
PORT=3000
```

### Deploy

1. Faça commit e push do código:
   ```bash
   git add .
   git commit -m "Migração para suportar Turso no Render"
   git push
   ```

2. O Render detectará automaticamente as variáveis do Turso e usará o cliente LibSQL

3. Execute as migrações no Render (via Shell ou adicione ao startup):
   ```bash
   node backend/migrations/create_schema.js
   ```

## Desenvolvimento Local

### Sem variáveis Turso (usa SQLite local)

```bash
# Instalar dependências
npm install

# Executar migrações
npm run migrate

# Iniciar servidor
npm start
```

### Com variáveis Turso (testar com Turso localmente)

Crie `backend/.env`:
```
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...
```

## Testes

### Testar Carregamento do Módulo
```bash
node -e "const db = require('./backend/db'); console.log('OK')"
```

### Testar Conexão Local
```bash
npm run migrate
```

## Arquivos Modificados

1. `package.json` - Adicionado @libsql/client
2. `backend/db.js` - Wrapper unificado para Turso e SQLite
3. `backend/migrations/create_schema.js` - Async/await
4. `backend/migrations/add_imagens_cartoes.js` - Async/await

## Arquivos Não Modificados (mas funcionam)

- ✅ Todas as rotas (`backend/routes/*`)
- ✅ Middlewares (`backend/middleware/*`)
- ✅ Utilitários (`backend/utils/*`)
- ✅ Frontend (`public/*`)

## Próximos Passos

1. ✅ Código migrado
2. ✅ Dependências instaladas
3. ⏳ Fazer commit e push
4. ⏳ Deploy no Render
5. ⏳ Executar migrações no Render
6. ⏳ Testar aplicação em produção

## Notas Importantes

- O SQLite local continua funcionando normalmente para desenvolvimento
- O Turso é usado automaticamente em produção quando as variáveis estão definidas
- Não há necessidade de alterar código nas rotas ou outras partes da aplicação
- As migrações funcionam em ambos os ambientes

