# 📱 Pipeline de Correção Mobile (Fluxo Completo)

Este documento descreve o fluxo detalhado da funcionalidade de correção via câmera mobile no arquivo `public/CorrigirSimulado.html`, integrando as recentes otimizações de memória e processamento via HuggingFace.

## 1. Detecção de Dispositivo e Inicialização

O sistema verifica automaticamente se o usuário está em um dispositivo móvel.

- **Função:** `detectarDispositivo()`
- **Lógica:** Verifica `userAgent` (Android, iPhone, etc.) ou largura de tela <= 768px.
- **Comportamento:**
  - **Mobile:** Esconde interface de upload de arquivo. Mostra interface de câmera automaticamente ao chegar no Passo 2.
  - **Desktop:** Mantém interface de upload de arquivo tradicional.

## 2. Interface de Câmera (Mobile First)

A interface de câmera é gerenciada inteiramente via JavaScript no navegador.

- **Função:** `iniciarCameraMobile()`
- **Configuração de Câmera:**
  - `facingMode: 'environment'` (Prioriza câmera traseira)
  - `width: { ideal: 1920 }` (Tenta resolução Full HD para melhor OCR)
  - **Flash:** Verifica suporte a `torch` e mostra botão de flash se disponível.
- **Preview:** Exibe vídeo em `<video id="videoPreview">` e desenha sobreposições em `<canvas id="canvasOverlay">`.

## 3. Live Detection (Feedback em Tempo Real)

Para orientar o usuário a posicionar a folha corretamente, o sistema faz detecções rápidas a cada 500-1000ms.

- **Fluxo:**
  1. `iniciarLiveDetection()` captura um frame do vídeo (baixa resolução para rapidez).
  2. Envia para **Render**: `POST /api/respostas/processar-frame-mobile`.
  3. **Render** encaminha para **HuggingFace Space**:
     - Endpoint: `/api/predict` (fn_index: 0 - Live Detection).
     - Executa YOLOv11n (super rápido).
  4. **Retorno:** Coordenadas das ROIs (`day_region`, `answer_area_enem`).
  5. **Interface:** Desenha retângulos coloridos no canvas sobre o vídeo:
     - 🟩 Verde: Área de respostas encontrada.
     - 🟦 Azul: Área do dia encontrada.
     - Feedback texto: "Centralize a folha" ou "✓ Folha detectada! Capture agora."

## 4. Captura e Processamento Completo

Quando o usuário clica no botão de captura (ou captura automática se estabilizado):

- **Fluxo:**
  1. `capturarFoto()` obtém frame em **alta resolução** do stream de vídeo.
  2. Envia para **Render**: `POST /api/respostas/capturar-enem-mobile`.
  3. **Render** encaminha para **HuggingFace Space**:
     - Endpoint: `/api/predict` (fn_index: 1 - Full Capture).
     - **Processamento no HuggingFace (GPU):**
       1. **YOLOv11:** Detecta e recorta ROIs precisas.
       2. **Tesseract OCR:** Lê o dia da prova (1 ou 2) na `day_region`.
       3. **OpenCV (Bolhas):** Processa `answer_area_enem`, detecta bolhas preenchidas, identifica duplas marcações e questões em branco.
  4. **Retorno:** JSON completo com respostas (ex: `{ "1": "A", "2": "C" ... }`).
  5. **Interface:** Exibe modal com resultados, acertos (se gabarito disponível) e detalhes.

## 5. Arquitetura de Backend (Otimizada)

A arquitetura foi alterada para resolver problemas de memória no Render (limite 512MB).

| Componente | Função Anterior | Função Atual (Otimizada) |
|------------|-----------------|--------------------------|
| **Mobile Browser** | Câmera + Interface | Câmera + Interface |
| **Render (Node.js)** | Roteamento + **Processamento Python Pesado** | Roteamento + **Proxy para HuggingFace** |
| **HuggingFace Space** | (Não existia) | **Motor de IA (Python + GPU)**: YOLO, OCR, OpenCV |

### Benefícios:
- **Zero Crash:** Render usa apenas ~100MB de RAM (antes estourava 512MB).
- **Performance:** HuggingFace oferece hardware melhor para IA.
- **Manutenção:** Backend Node.js fica leve e focado apenas em regras de negócio.
