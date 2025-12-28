# Integração HuggingFace Space

## O que foi feito

Para resolver o problema de memória no Render (512MB), migramos o processamento pesado (YOLO + OCR) para o HuggingFace Spaces (GPU gratuita).

### Arquitetura Nova:

```
Mobile/Desktop → Render (Node.js) → HuggingFace API (Python/YOLO/OCR) → Render → Client
```

**Antes:** 
- Render executava Python localmente (Python + YOLO + OCR = ~400-500MB RAM) 
- Ultrapassava limite de 512MB → Crash

**Agora:**
- Render apenas faz chamadas HTTP para HuggingFace
- HuggingFace processa YOLO/OCR (com GPU)
- Render fica leve (~100-150MB RAM)

## Configuração Necessária no Render

Adicione a variável de ambiente:

```
HUGGINGFACE_API_URL=https://do2anjos-eduscore-yolo-api.hf.space
```

## Dependências Adicionadas

No `package.json`:
- `node-fetch` (para fazer chamadas HTTP)
- `form-data` (para upload de arquivos)

## Endpoints Modificados

### `/api/respostas/processar-frame-mobile`
- **Antes:** Executava `detector_yolo_enem.py` localmente
- **Agora:** Chama `https://do2anjos-eduscore-yolo-api.hf.space/api/predict`

### `/api/respostas/capturar-enem-mobile`
- **Antes:** Executava `processar_respostas_enem_mobile.py` localmente
- **Agora:** Chama HuggingFace API (full processing)

## Teste Local

```bash
# Definir variável de ambiente
export HUGGINGFACE_API_URL=https://do2anjos-eduscore-yolo-api.hf.space

# Rodar servidor
npm run dev
```

## Vantagens

1. ✅ Sem problemas de memória no Render
2. ✅ GPU gratuita do HuggingFace (processamento mais rápido)
3. ✅ Escalabilidade (HuggingFace aguenta mais carga)
4. ✅ Backup automático (se HuggingFace cair, pode voltar para local)

## Desvantagens

1. ❌ Latência de rede (adiciona ~100-300ms)
2. ❌ Dependência externa (se HuggingFace cair, sistema para)

## Próximos Passos

- [ ] Adicionar retry logic se HuggingFace falhar
- [ ] Adicionar cache de resultados para frames repetidos
- [ ] Monitorar latência e otimizar
