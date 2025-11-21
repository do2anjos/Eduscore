-- Schema SQL para contagem de linguagem no GitHub
-- Este arquivo contém o schema do banco de dados extraído para estatísticas

CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  matricula TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  tipo_usuario TEXT NOT NULL CHECK(tipo_usuario IN ('aluno', 'professor', 'coordenador')),
  telefone TEXT,
  foto_perfil TEXT,
  configuracoes TEXT,
  criado_em TEXT DEFAULT datetime('now'),
  atualizado_em TEXT DEFAULT datetime('now')
);

CREATE TABLE IF NOT EXISTS alunos (
  id TEXT PRIMARY KEY,
  nome_completo TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone_responsavel TEXT,
  data_nascimento TEXT,
  etapa TEXT,
  matricula TEXT NOT NULL UNIQUE,
  criado_em TEXT DEFAULT datetime('now')
);

CREATE TABLE IF NOT EXISTS disciplinas (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  criado_em TEXT DEFAULT datetime('now')
);

CREATE TABLE IF NOT EXISTS gabaritos (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  etapa TEXT,
  criado_em TEXT DEFAULT datetime('now')
);

CREATE TABLE IF NOT EXISTS questoes (
  id TEXT PRIMARY KEY,
  gabarito_id TEXT NOT NULL,
  numero INTEGER NOT NULL,
  resposta_correta TEXT NOT NULL,
  disciplina_id TEXT,
  FOREIGN KEY (gabarito_id) REFERENCES gabaritos(id) ON DELETE CASCADE,
  FOREIGN KEY (disciplina_id) REFERENCES disciplinas(id),
  UNIQUE(gabarito_id, numero)
);

CREATE TABLE IF NOT EXISTS respostas (
  id TEXT PRIMARY KEY,
  aluno_id TEXT NOT NULL,
  questao_id TEXT NOT NULL,
  gabarito_id TEXT NOT NULL,
  resposta_aluno TEXT,
  acertou INTEGER DEFAULT 0,
  data_resposta TEXT DEFAULT datetime('now'),
  FOREIGN KEY (aluno_id) REFERENCES alunos(id) ON DELETE CASCADE,
  FOREIGN KEY (questao_id) REFERENCES questoes(id) ON DELETE CASCADE,
  FOREIGN KEY (gabarito_id) REFERENCES gabaritos(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sessoes (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL,
  aluno_id TEXT,
  etapa TEXT,
  disciplina_id TEXT,
  data TEXT NOT NULL,
  hora TEXT NOT NULL,
  observacoes TEXT,
  criado_em TEXT DEFAULT datetime('now'),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (aluno_id) REFERENCES alunos(id) ON DELETE CASCADE,
  FOREIGN KEY (disciplina_id) REFERENCES disciplinas(id)
);

CREATE TABLE IF NOT EXISTS relatorios (
  id TEXT PRIMARY KEY,
  aluno_id TEXT NOT NULL,
  gabarito_id TEXT NOT NULL,
  dados_relatorio TEXT NOT NULL,
  criado_em TEXT DEFAULT datetime('now'),
  FOREIGN KEY (aluno_id) REFERENCES alunos(id) ON DELETE CASCADE,
  FOREIGN KEY (gabarito_id) REFERENCES gabaritos(id) ON DELETE CASCADE
);

