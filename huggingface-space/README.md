---
title: EduScore YOLO API
emoji: 🎯
colorFrom: blue
colorTo: green
sdk: gradio
sdk_version: 6.2.0
app_file: app.py
pinned: false
license: mit
---

# 🎯 EduScore YOLO + OCR API

API para detecção de folhas de resposta ENEM usando YOLOv11 e Tesseract OCR.

## Funcionalidades

- **Live Detection**: Detecção rápida de ROIs (day_region, answer_area_enem) para feedback em tempo real
- **Full Capture**: Processamento completo com OCR de dia e extração de respostas

## Como usar

### Via Interface Web
Acesse a interface Gradio diretamente no Space.

### Via API

```python
import requests

# Live Detection
url = "https://do2anjos-eduscore-yolo-api.hf.space/api/predict"
files = {"data": open("frame.jpg", "rb")}
response = requests.post(url, files=files)
print(response.json())
```

## Arquivos Necessários

Certifique-se de fazer upload dos seguintes arquivos:

1. `detector_yolo_enem.py` - Script de detecção YOLO
2. `ocr_day_detector.py` - Script de OCR para dia
3. `best_yolo11s_optimized.onnx` - Modelo YOLO treinado
4. Arquivos de dados Tesseract (instalados via apt-get)

## Configuração no Render

Após criar este Space, atualize seu backend no Render para chamar esta API:

```javascript
const response = await fetch('https://do2anjos-eduscore-yolo-api.hf.space/api/predict', {
  method: 'POST',
  body: formData
});
const resultado = await response.json();
```