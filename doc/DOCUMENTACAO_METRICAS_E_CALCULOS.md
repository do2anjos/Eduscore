# Dossiê de Métricas e Cálculos Estatísticos do Sistema

Este documento descreve detalhadamente o núcleo matemático e as Queries de banco de dados utilizadas para calcular médias, taxas de erro, acertos totais e classificação de disciplinas no painel.

---

## 1. Mapeamento de Intervalos x Disciplinas (SIS/UEA)

O sistema conta com um algoritmo classificador (`backend/utils/disciplinaClassifier.js`) que, no momento em que as questões entram no banco de dados, atrela automaticamente a disciplina com base no número da questão, seguindo o padrão de **60 questões**:

- **Questões 01 a 08:** Língua Portuguesa e Artes
- **Questões 09 a 12:** Língua Estrangeira
- **Questões 13 a 20:** História, Filosofia e Educação Física
- **Questões 21 a 28:** Geografia
- **Questões 29 a 36:** Biologia
- **Questões 37 a 44:** Química
- **Questões 45 a 52:** Física
- **Questões 53 a 60:** Matemática

*Sempre que uma questão for calculada, ela será agrupada no seu respectivo bloco acima para formar o Gráfico de Disciplinas.*

---

## 2. A Matemática das "Exceções" (Rasuras e Brancos)

Antes de qualquer cálculo de média, o sistema passa um "filtro de purificação" nos dados.
As respostas capturadas pela inteligência artificial (OMR) passam pela seguinte validação SQL:
```sql
resposta_aluno IS NOT NULL 
AND resposta_aluno != '' 
AND resposta_aluno NOT LIKE '%,%'
```
**O que isso significa na prática:**
1. **Em branco (`NULL` ou `''`):** O aluno não marcou nada.
2. **Dupla Marcação/Rasura (`LIKE '%,%'`):** O aluno marcou duas bolhas (ex: `A,B`). A câmera lê ambas, mas o sistema penaliza automaticamente, invalidando a resposta para que ela não seja computada como um "Acerto por sorte".

---

## 3. Cálculos do Dashboard Geral (Visão Coletiva)

### 3.1. Questões Aplicadas
- **Como é calculado:** Não é a multiplicação de questões pelo número de alunos. O sistema conta o total de **Questões Únicas** (`COUNT(DISTINCT q.id)`) pertencentes a todos os gabaritos que possuam pelo menos uma folha de resposta submetida.
- **Exemplo:** Se foi aplicado 1 simulado de 60 questões para 200 alunos, o número de "Questões Aplicadas" será 60, e não 12.000. Isso informa a "carga de conteúdo" aplicada ao longo do ano.

### 3.2. Acertos Totais
- **Como é calculado:** É a soma direta e bruta (`COUNT(*)`) de todas as vezes em que `acertou = 1`. Rasuras e respostas em branco são eliminadas antes da contagem.

### 3.3. Taxa de Erro (Por Disciplina)
- **Como é calculado:** O sistema pega os erros confirmados (`acertou = 0`) e divide apenas pelas **respostas válidas capturadas**, ignorando as que o aluno deixou em branco.
- **Fórmula:** `(Total de Erros * 100) / Total de Respostas Válidas Marcadas`.

---

## 4. Cálculos do Relatório Individual (Por Aluno)

A régua de cálculo para a avaliação individual do aluno é mais punitiva e realista para simular o modelo de notas reais de concursos/vestibulares.

### 4.1. Média de Acertos por Disciplina (%)
Diferente da Taxa de Erro (que divide pelas respostas capturadas), a Média de Acertos do aluno pune as questões deixadas em branco.
- **Como é calculado:** O sistema soma as questões corretas (`acertou = 1`) e divide pelo **TOTAL DE QUESTÕES DO GABARITO DAQUELA DISCIPLINA** (`COUNT(DISTINCT q.id)`), independentemente de quantas o aluno marcou.
- **Fórmula:** `(Acertos na Disciplina * 100) / Total de Questões da Disciplina no Exame`
- **Exemplo Prático:** A prova tem 10 questões de Matemática. O aluno respondeu apenas 5 questões e acertou todas as 5. As outras 5 ele deixou em branco. A média dele em Matemática será **50%** (5 acertos / 10 questões possíveis), e não 100%. *Questões não respondidas valem automaticamente 0% na média final.*

### 4.2. Gráfico: Desempenho por Simulado no Tempo
No final da página do Relatório Individual, o sistema exibe a linha do tempo do aluno.
Para cada simulado isolado, o banco processa:
1. `total_questoes`: Número de questões oficiais do gabarito.
2. `questoes_capturadas`: Quantas o sistema conseguiu ler validamente da folha dele (exclui rasuras).
3. `acertos`: Quantas dessas bateram com a resposta oficial.
4. `media`: Porcentagem fina `(Acertos * 100) / total_questoes`.

### 4.3. Maior e Menor Média (Troféus)
O sistema agrupa as médias das disciplinas do aluno ao longo de todo o histórico dele (através da agregação `GROUP BY d.id, d.nome`) e usa a função `ORDER BY media DESC`. 
A matéria no índice `[0]` (topo da lista) recebe o título de **Maior Média**, e a matéria no índice `[length - 1]` (fundo da lista) recebe o título de **Menor Média** ou "Disciplina que requer atenção".
