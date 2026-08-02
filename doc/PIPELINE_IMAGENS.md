# Pipeline de Processamento de Imagens - Classy

Este documento detalha o fluxo de processamento de imagens (recortes, correções de perspectiva e extração de respostas) do sistema, detalhando especificamente as diferenças entre as abordagens para simulados **ENEM** e **UEA**.

---

## 1. Visão Geral e Roteamento (`detectar_tipo_imagem.py`)
O fluxo sempre se inicia pelo script `detectar_tipo_imagem.py`, que age como o **roteador principal**. O papel dele é carregar a imagem e determinar qual pipeline de processamento deverá ser executado. 

### Lógica de Decisão:
1. **Detecção ENEM (Prioridade 1):** O script invoca um modelo de visão computacional YOLO (`Enem/02_detectar_rois.py`).
   - Se o modelo detectar as regiões `day_region` (área indicativa do dia) e `answer_area_enem` (cartão resposta), a imagem é classificada como **`enem_completo`**.
   - Se encontrar apenas o cartão resposta com alta confiança, é classificada como **`enem_recorte`**.
2. **Detecção UEA/Padrão (Prioridade 2):** Se a imagem não for ENEM, o OpenCV é utilizado para encontrar contornos e checar a proporção da folha.
   - Imagens já recortadas em volta da área de respostas de forma quase quadrada/retangular perfeita são classificadas como **`processada`**.
   - Imagens desalinhadas e com necessidade de ajuste de perspectiva são classificadas como **`original`**.

De acordo com o tipo detectado, o sistema executa o script alvo correspondente.

---

## 2. Pipeline ENEM (`@Enem`)
**Scripts Centralizados na pasta:** `backend/scripts/Enem/`
**Orquestrador Final:** `05_processar_respostas.py`

O pipeline do Enem possui as seguintes etapas (executadas em cascata):

1. **Correção de Perspectiva (A4 + YOLO + SAM2) (`01_corrigir_perspectiva.py`):**
   - Utiliza um modelo YOLO treinado para detectar as quinas de uma folha A4 em qualquer cenário.
   - Um modelo segmentador (SAM2) refina as bordas da folha e garante máxima precisão.
   - Aplica transformação de perspectiva (`cv2.warpPerspective`) forçando a proporção exata do papel A4 (1:1.414), garantindo que a imagem não fique distorcida e sempre em formato retrato (em pé).
2. **Detecção de ROIs (Regiões de Interesse) (`02_detectar_rois.py`):**
   - Na folha já "plana" e corrigida, utiliza a rede neural YOLOv8 para localizar a região que contém a indicação do dia da prova (`day_region`) e a tabela principal de gabaritos (`answer_area_enem`).
3. **Extração OCR do Dia (`03_ocr_dia.py`):**
   - A `day_region` recortada é repassada para o `pytesseract` (Reconhecimento Ótico de Caracteres). 
   - Identifica se é o **Dia 1** ou **Dia 2** da prova do Enem, além da cor do caderno.
   - O dia define o início da contagem das questões (Ex: 1-90 para o Dia 1 e 91-180 para o Dia 2).
4. **Detecção de Bolhas (Gabarito) (`04_processar_bolhas.py`):**
   - A `answer_area_enem` sofre thresholding adaptativo e operações morfológicas.
   - Bolhas marcadas são detectadas usando verificação de **área, circularidade** e proporção de preenchimento.
5. **Classificação e Orquestração Final (`05_processar_respostas.py`):**
   - O script agrupa os dados de OCR e marcações de bolhas.
   - O ENEM é processado assumindo um layout de **3 colunas verticais** contendo **30 questões cada**.
   - Identifica em qual questão e alternativa a bolha preta se encontra e formata um JSON reportando marcações múltiplas, vazias ou anuladas.

---

## 3. Pipeline UEA (`@Scripts UEA`)
**Script Principal:** `backend/scripts/Scripts UEA/processar_respostas_Imagem_original.py` (caso a imagem não tenha sido processada previamente).

O pipeline da UEA não depende de YOLO para achar a prova, baseando-se intensamente em processamento geométrico tradicional (OpenCV).

1. **Correção de Perspectiva Avançada (Tipo "CamScanner"):**
   - A imagem sofre redimensionamento, aplicação de *CLAHE* (Melhora de Contraste) e *Bilateral Filter* (remoção de ruído preservando bordas).
   - É aplicado o detector de bordas *Canny*.
   - O algoritmo tenta encontrar o **maior contorno de 4 pontas** que pareça uma folha de papel válida (ângulos próximos a 90°).
   - Ao encontrar os 4 vértices do papel, uma **transformação de perspectiva** (`cv2.getPerspectiveTransform` e `cv2.warpPerspective`) é aplicada, "esticando" a imagem e a deixando completamente frontal e plana.
2. **Tratamento e Recorte da Área:**
   A imagem resultante é transformada em binária e achatada para dimensões padronizadas de análise (ex: `678px` de largura) para encontrar as "bolhas".
3. **Detecção das Marcações:**
   Da mesma forma que no Enem, busca-se contornos baseados na **circularidade > 0.4** e alta incidência de marcações (proporção de pixels).
4. **Mapeamento de Gabarito (Grid UEA):**
   - O layout base para a UEA contempla **60 questões** distribuídas em **3 blocos de 20 questões**.
   - As colunas de marcação (A, B, C, D, E) têm posições X exatas mapeadas para o bloco 1, bloco 2 e bloco 3.
   - O sistema checa se a marcação se enquadra dentro das margens (ex: `margem_coluna = 15`) do "grid virtual" de questões da UEA.
5. **JSON Final e Validação:**
   Respostas múltiplas (dupla marcação) para uma mesma questão são acusadas, e a folha final é retornada num objeto JSON com estatísticas de questões válidas, anuladas e ausentes.
