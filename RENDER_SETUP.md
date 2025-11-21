# Configuração do Render para Processamento de Imagens

## Problema

O processamento de imagens usa scripts Python que dependem do OpenCV (`cv2`). Essas dependências não estão sendo instaladas automaticamente no Render.

## Solução

### Opção 1: Usar Build Command no Render (Recomendado)

1. Acesse o Dashboard do Render
2. Vá em **Settings** do seu Web Service
3. Na seção **Build Command**, cole:
   ```bash
   npm install && python3 -m pip install --user --upgrade pip && python3 -m pip install --user -r requirements.txt
   ```
4. Se `python3` não funcionar, use:
   ```bash
   npm install && python -m pip install --user --upgrade pip && python -m pip install --user -r requirements.txt
   ```

### Opção 2: Usar render.yaml (Automático)

O arquivo `render.yaml` já está configurado para instalar as dependências Python automaticamente.

**Importante:** Certifique-se de que o Render detecta e usa o `render.yaml` na raiz do projeto.

### Verificação

Após o deploy, verifique nos logs se aparece:
```
✅ Dependências Python instaladas com sucesso
```

Se ainda houver erro, verifique se Python está disponível:
```bash
python3 --version
# ou
python --version
```

## Dependências Python Necessárias

As dependências estão no arquivo `requirements.txt`:
- `opencv-python>=4.8.0` - Processamento de imagens
- `numpy>=1.24.0` - Operações numéricas

## Notas

- O Render pode não ter Python instalado por padrão em Web Services Node.js
- Se necessário, configure Python como dependência adicional no Render
- Alternativamente, considere usar uma API externa para processamento de imagens se Python não estiver disponível

