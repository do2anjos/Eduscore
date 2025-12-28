# 📦 Migração Completa para HuggingFace

Todos os arquivos Python necessários para fazer upload no HuggingFace Space:

## Arquivos a Atualizar:

### 1. `app.py` ✅ (Atualizado localmente)
Agora inclui:
- `process_frame()` - Live detection (rápido)
- `process_full_capture()` - Pipeline completo (YOLO + OCR + Bolhas)
- `processar_bolhas_answer_area()` - Detecção de respostas

### 2. `detector_yolo_enem.py` ✅ (Já está no HF com thresholds otimizados)

### 3. `ocr_day_detector.py` ✅ (Já está no HF)

### 4. `best_yolo11s_optimized.onnx` ✅ (Já está no HF)

### 5. `requirements.txt` ✅ (Já está no HF)

### 6. `packages.txt` ✅ (Já está no HF)

---

## 📝 Próximos Passos:

1. **Atualizar `app.py` no HuggingFace:**
   - Substituir o conteúdo pelo arquivo local atualizado
   - O rebuild levará ~2-3 minutos

2. **Testar a API Full Processing:**
   ```bash
   curl -X POST https://do2anjos-eduscore-yolo-api.hf.space/api/predict \
     -F "data=@folha_enem.jpg" \
     -F "fn_index=1"  # Índice da aba "Full Capture"
   ```

3. **Atualizar Backend Render:**
   - Modificar rota `/api/respostas/capturar-enem-mobile`
   - Chamar HuggingFace ao invés de script local

---

## 💾 Consumo de Memória:

**Antes (Render com Python local):**
- Node.js: ~100MB
- Python + YOLO + OCR: ~400MB
- **TOTAL: ~500MB** ❌ (Crash no free tier)

**Agora (HuggingFace):**
- Render (só Node.js): ~100MB ✅
- HuggingFace: 1GB/18GB (grátis com GPU) ✅
- **TOTAL Render: ~100MB** 🎉

---

## 🔗 Endpoints da API HuggingFace:

### Live Detection (rápido):
```
POST https://do2anjos-eduscore-yolo-api.hf.space/api/predict
Body: FormData { data: <image_file>, fn_index: 0 }
```

### Full Processing (completo):
```
POST https://do2anjos-eduscore-yolo-api.hf.space/api/predict  
Body: FormData { data: <image_file>, fn_index: 1 }
```

fn_index:
- 0 = Aba "Live Detection"
- 1 = Aba "Full Capture"
