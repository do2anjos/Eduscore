# Solução para Erro de Memória no Render (Memory Limit Exceeded)

Como o plano gratuito do Render limita a memória em 512MB, a biblioteca `EasyOCR` (que usa PyTorch) estava estourando o limite. Migramos para o **Tesseract OCR**, que é muito mais leve e eficiente para detectar "DIA 1" ou "DIA 2".

## O que foi feito no código (Já realizado):
1.  **Dependências**: Substituído `easyocr` por `pytesseract` e `opencv-python` por `opencv-python-headless` (versão leve sem interface gráfica).
2.  **Script OCR**: O detector de dia (`ocr_day_detector.py`) foi reescrito para usar Tesseract.
3.  **Script de Build**: Criado o arquivo `render-build.sh` na raiz do projeto para instalar o Tesseract no servidor Linux do Render.

## ⚠️ O QUE VOCÊ PRECISA FAZER NO RENDER:

Para que o Tesseract funcione, você precisa alterar o **Build Command** na sua dashboard do Render:

1.  Acesse seu serviço no [Render Dashboard](https://dashboard.render.com/).
2.  Vá em **Settings** > **Build & Deploy**.
3.  Encontre o campo **Build Command**.
4.  Altere o valor atual (provavelmente `npm install` ou `yarn`) para:

    ```bash
    ./render-build.sh
    ```

5.  Salve as alterações ("Save Changes").
6.  Faça um novo deploy (ou espere o auto-deploy do próximo commit).

Isso garantirá que o linux instale o `tesseract-ocr` antes de rodar o projeto.

### Por que isso resolve?
- **Antes**: EasyOCR + PyTorch ~400MB RAM (Sozinho) + Node.js ~150MB = **CRASH** (>512MB)
- **Agora**: Tesseract ~10-20MB RAM + Node.js ~150MB = **SUCESSO** (~200MB total)
