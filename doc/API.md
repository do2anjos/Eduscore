# Documentação da API

**Última atualização**: 2025-11-16 20:30:00

## Base URL

```
http://localhost:3000/api
```

## Autenticação

A maioria das rotas requer autenticação via JWT. Inclua o token no header:

```
Authorization: Bearer <seu_token>
```

## Respostas

### Formato de Sucesso
```json
{
  "sucesso": true,
  "dados": { ... }
}
```

### Formato de Erro
```json
{
  "sucesso": false,
  "erro": "Mensagem de erro",
  "detalhes": "Detalhes adicionais (apenas em desenvolvimento)"
}
```

## Endpoints

### Usuários

#### Registrar Usuário
```http
POST /usuarios/registro
```

**Body:**
```json
{
  "nome": "João Silva",
  "email": "joao@escola.edu.br",
  "matricula": "12345",
  "telefone": "11999999999",
  "senha": "Senha123!@#",
  "perfil": "professor"
}
```

**Perfis válidos:** `professor`, `coordenador`, `admin`

**Resposta:**
```json
{
  "sucesso": true,
  "usuario": { ... },
  "mensagem": "Usuário cadastrado com sucesso!"
}
```

#### Login
```http
POST /usuarios/login
```

**Body:**
```json
{
  "email": "joao@escola.edu.br",
  "senha": "Senha123!@#"
}
```

**Resposta:**
```json
{
  "sucesso": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "usuario": {
    "id": "...",
    "nome": "João Silva",
    "email": "joao@escola.edu.br",
    "perfil": "professor"
  }
}
```

#### Listar Usuários
```http
GET /usuarios?limit=100&offset=0&busca=joao
```

**Headers:** `Authorization: Bearer <token>`

#### Obter Usuário por ID
```http
GET /usuarios/:id
```

**Headers:** `Authorization: Bearer <token>`

---

### Alunos

Todas as rotas requerem autenticação.

#### Listar Alunos
```http
GET /alunos
```

#### Criar Aluno
```http
POST /alunos
```

**Body:**
```json
{
  "nome_completo": "Maria Santos",
  "email": "maria@email.com",
  "telefone_responsavel": "11988888888",
  "data_nascimento": "2010-05-15",
  "etapa": "6º ano",
  "matricula": "67890"
}
```

#### Atualizar Aluno
```http
PUT /alunos/:id
```

#### Deletar Aluno
```http
DELETE /alunos/:id
```

---

### Disciplinas

#### Listar Disciplinas (Público)
```http
GET /disciplinas
```

#### Criar Disciplina
```http
POST /disciplinas
```

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "nome": "Matemática"
}
```

#### Estatísticas
```http
GET /disciplinas/estatisticas
```

**Headers:** `Authorization: Bearer <token>`

#### Relatório por Disciplina
```http
GET /disciplinas/:id/relatorio
```

**Headers:** `Authorization: Bearer <token>`

---

### Gabaritos

Todas as rotas requerem autenticação.

#### Listar Gabaritos
```http
GET /gabaritos
```

#### Criar Gabarito
```http
POST /gabaritos
```

**Body:**
```json
{
  "nome": "Simulado ENEM 2024",
  "etapa": "3º ano"
}
```

#### Obter Gabarito
```http
GET /gabaritos/:id
```

#### Atualizar Gabarito
```http
PUT /gabaritos/:id
```

#### Deletar Gabarito
```http
DELETE /gabaritos/:id
```

#### Upload de CSV com Questões
```http
POST /gabaritos/upload
Content-Type: multipart/form-data
```

**Body (form-data):**
- `file`: Arquivo CSV
- `gabarito_id`: ID do gabarito

**Formato do CSV:**
```csv
numero,resposta_correta,disciplina_id
1,A,123e4567-e89b-12d3-a456-426614174000
2,B,123e4567-e89b-12d3-a456-426614174000
```

---

### Questões

Todas as rotas requerem autenticação.

#### Listar Questões
```http
GET /questoes
```

#### Listar Questões por Gabarito
```http
GET /questoes/:gabarito_id
```

#### Criar Questão
```http
POST /questoes
```

**Body:**
```json
{
  "gabarito_id": "...",
  "numero": 1,
  "resposta_correta": "A"
}
```

#### Atualizar Questão
```http
PUT /questoes/:id
```

#### Deletar Questão
```http
DELETE /questoes/:id
```

---

### Respostas

Todas as rotas requerem autenticação.

#### Listar Respostas
```http
GET /respostas
```

#### Criar Resposta
```http
POST /respostas
```

**Body:**
```json
{
  "aluno_id": "...",
  "questao_id": "...",
  "gabarito_id": "...",
  "resposta_aluno": "A",
  "acertou": true
}
```

#### Obter Resposta
```http
GET /respostas/:id
```

#### Atualizar Resposta
```http
PUT /respostas/:id
```

#### Deletar Resposta
```http
DELETE /respostas/:id
```

---

### Sessões

#### Listar Sessões (Público)
```http
GET /sessoes?etapa=3º ano&aluno_id=...&disciplina_id=...
```

**Query Parameters:**
- `etapa`: Filtrar por etapa
- `aluno_id`: Filtrar por aluno
- `disciplina_id`: Filtrar por disciplina
- `usuario_id`: Filtrar por coordenador
- `data_inicio`: Data inicial (YYYY-MM-DD)
- `data_fim`: Data final (YYYY-MM-DD)
- `limit`: Limite de resultados (padrão: 100)
- `offset`: Offset para paginação (padrão: 0)

#### Criar Sessão
```http
POST /sessoes
```

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "aluno_id": "...",
  "etapa": "3º ano",
  "disciplina_id": "...",
  "data": "2024-03-15",
  "hora": "14:00",
  "usuario_id": "..."
}
```

**Nota:** Apenas coordenadores podem criar sessões.

#### Deletar Sessão
```http
DELETE /sessoes/:id
```

**Headers:** `Authorization: Bearer <token>`

**Nota:** Apenas o coordenador responsável ou admin podem deletar.

---

### Relatórios

**Última atualização**: 2025-11-16 17:41:12

#### Estatísticas Gerais
```http
GET /relatorios/estatisticas-gerais?etapa=3º ano
```

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `etapa` (opcional): Filtrar por etapa específica ou omitir para "Geral"

**Resposta:**
```json
{
  "sucesso": true,
  "estatisticas": {
    "total_questoes": 180,
    "total_acertos": 135,
    "media_geral": 75.0,
    "maior_media_disciplina": "Matemática",
    "menor_media_disciplina": "História",
    "media_por_disciplina": [
      {
        "id": "...",
        "nome": "Matemática",
        "media": 85.5,
        "total_questoes": 30,
        "total_respostas": 120,
        "acertos": 102
      }
    ],
    "por_etapa": [
      {
        "etapa": "3º ano",
        "total_questoes": 60,
        "total_respostas": 40,
        "acertos": 30,
        "media": 75.0
      }
    ]
  }
}
```

#### Estatísticas Individuais de um Aluno
```http
GET /relatorios/estatisticas-individual/:aluno_id
```

**Headers:** `Authorization: Bearer <token>`

**Resposta:**
```json
{
  "sucesso": true,
  "aluno": {
    "id": "...",
    "nome": "João Silva",
    "matricula": "12345"
  },
  "estatisticas": {
    "total_questoes": 150,
    "total_acertos": 105,
    "taxa_acertos": 70.0,
    "maior_media_disciplina": "Matemática",
    "menor_media_disciplina": "História",
    "media_por_disciplina": [
      {
        "id": "...",
        "nome": "Matemática",
        "media": 80.0,
        "total_respostas": 30,
        "acertos": 24
      }
    ],
    "desempenho_tempo": [
      {
        "data": "2024-11-15",
        "total_questoes": 30,
        "acertos": 21,
        "media": 70.0
      }
    ],
    "desempenho_por_gabarito": [
      {
        "id": "...",
        "nome": "Simulado ENEM 2024",
        "etapa": "3º ano",
        "total_questoes": 60,
        "acertos": 42,
        "media": 70.0,
        "data": "2024-11-16T10:00:00Z"
      }
    ]
  }
}
```

#### Desempenho por Disciplina Filtrado por Simulado (NOVO)
```http
GET /relatorios/estatisticas-individual/:aluno_id/disciplinas/:gabarito_id
```

**Adicionado em**: 2025-11-16 17:41:12

**Headers:** `Authorization: Bearer <token>`

**Path Parameters:**
- `aluno_id`: ID do aluno
- `gabarito_id`: ID do gabarito (simulado)

**Resposta:**
```json
{
  "sucesso": true,
  "gabarito": {
    "id": "...",
    "nome": "Simulado ENEM 2024",
    "etapa": "3º ano"
  },
  "media_por_disciplina": [
    {
      "id": "...",
      "nome": "Matemática",
      "media": 75.5,
      "total_respostas": 20,
      "acertos": 15
    },
    {
      "id": "...",
      "nome": "Português",
      "media": 80.0,
      "total_respostas": 15,
      "acertos": 12
    }
  ]
}
```

**Erros:**
- `400`: Parâmetros aluno_id e gabarito_id são obrigatórios
- `404`: Aluno ou gabarito não encontrado
- `500`: Erro interno ao buscar desempenho por disciplina

#### Listar Relatórios
```http
GET /relatorios?sessao_id=...&etapa=...&aluno_id=...&disciplina_id=...
```

#### Criar Relatório
```http
POST /relatorios
```

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "sessao_id": "...",
  "etapa": "3º ano",
  "media_geral": 75.5,
  "grafico_linha": "{ ... }",
  "grafico_coluna": "{ ... }"
}
```

#### Deletar Relatório
```http
DELETE /relatorios/:id
```

**Headers:** `Authorization: Bearer <token>`

---

## Códigos de Status HTTP

- `200` - Sucesso
- `201` - Criado com sucesso
- `400` - Erro de validação
- `401` - Não autorizado
- `403` - Acesso negado
- `404` - Recurso não encontrado
- `409` - Conflito
- `413` - Payload muito grande
- `500` - Erro interno do servidor

## Rate Limiting

- **Geral:** 100 requisições/minuto
- **Login:** 5 tentativas/15 minutos
- **Uploads:** 10 uploads/minuto

## Exemplos de Uso

### Exemplo completo: Criar gabarito e importar questões

```javascript
// 1. Login
const loginResponse = await fetch('http://localhost:3000/api/usuarios/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'joao@escola.edu.br',
    senha: 'Senha123!@#'
  })
});

const { token } = await loginResponse.json();

// 2. Criar gabarito
const gabaritoResponse = await fetch('http://localhost:3000/api/gabaritos', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    nome: 'Simulado ENEM 2024',
    etapa: '3º ano'
  })
});

const { gabarito } = await gabaritoResponse.json();

// 3. Upload de CSV
const formData = new FormData();
formData.append('file', csvFile);
formData.append('gabarito_id', gabarito.id);

const uploadResponse = await fetch('http://localhost:3000/api/gabaritos/upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
```

