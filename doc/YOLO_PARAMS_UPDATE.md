# 🎯 Guia de Atualização do HuggingFace Space

## Arquivo Modificado:
`detector_yolo_enem.py`

## O que foi alterado:

### Parâmetros YOLO (Linhas 20-21):

```python
# ANTES (Conservador - detecta menos):
CONFIDENCE_THRESHOLD = 0.5  # 50% de confiança mínima
NMS_THRESHOLD = 0.4

# AGORA (Agressivo - detecta mais):
CONFIDENCE_THRESHOLD = 0.25  # 25% de confiança mínima  
NMS_THRESHOLD = 0.3
```

### O que isso faz:

1. **CONFIDENCE_THRESHOLD = 0.25**  
   - Detecta objetos com apenas 25% de confiança (antes era 50%)
   - Será MUITO mais sensível
   - Pode ter mais falsos positivos, mas vai "pegar" folhas difíceis

2. **NMS_THRESHOLD = 0.3**  
   - Permite detecções mais próximas umas das outras
   - Útil se houver múltiplas folhas na imagem

### ⚠️ Trade-offs:
- ✅ **Prós**: Detecta muito mais, mesmo com luz ruim ou ângulo difícil
- ❌ **Contras**: Pode detectar coisas que não são folhas (false positives)

---

## 📝 Como Atualizar no HuggingFace:

1. Vá para: https://huggingface.co/spaces/do2anjos/eduscore-yolo-api
2. Clique em **Files** > `detector_yolo_enem.py`
3. Clique no ícone de **editar** (lápis)
4. Encontre as linhas 20-21 e substitua por:

```python
CONFIDENCE_THRESHOLD = 0.25  # Reduzido de 0.5 para detectar mais (menos conservador)
NMS_THRESHOLD = 0.3  # Reduzido de 0.4 para permitir mais detecções próximas
```

5. **Commit changes to main**

O HuggingFace vai rebuildar automaticamente (leva ~1-2min).

---

## 🧪 Como Testar:

Após o rebuild, teste no celular:
- Luz ruim ✅ (antes falhava)
- Ângulo torto ✅ (antes falhava)  
- Folha mal centralizada ✅ (antes falhava)

Se detectar coisas demais (falsos positivos), volte para:
- `CONFIDENCE_THRESHOLD = 0.35` (meio termo)
