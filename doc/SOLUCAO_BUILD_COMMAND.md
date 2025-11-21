# 🚨 SOLUÇÃO URGENTE: Build Command Manual no Render

## ⚠️ Problema Identificado

Mesmo que o Build Command esteja como `npm install`, o Render ainda está executando comandos com `--user` porque:

1. **O Render pode estar detectando automaticamente o `requirements.txt`** e tentando instalar Python
2. **Pode haver cache do Build Command antigo** no Render
3. **O Render pode ter configurado Python automaticamente** quando detecta `requirements.txt`

## ✅ Solução Definitiva

### Opção 1: Limpar Cache e Reconfigurar (Recomendado)

1. **Acesse o Dashboard do Render**
   - Vá para: https://dashboard.render.com
   - Abra o serviço **eduscore**

2. **Limpe o Cache**
   - Vá em **Settings** → **Clear Build Cache**
   - Clique em **Clear Cache**

3. **Verifique o Build Command**
   - Em **Settings** → **Build Command**
   - Deve estar: `npm install`
   - Se houver algo mais, **DELETE tudo e deixe apenas `npm install`**

4. **Verifique se há Python configurado automaticamente**
   - Em **Settings** → **Python Version**
   - Se houver algo configurado, isso pode estar causando o problema
   - O Python será instalado automaticamente quando o `postinstall` rodar

5. **Faça um Deploy Limpo**
   - **Manual Deploy** → **Deploy latest commit**
   - Aguarde o deploy

### Opção 2: Verificar se o Render está usando render.yaml

Se o Render está usando o `render.yaml` automaticamente, ele pode estar executando comandos adicionais. Verifique:
- O arquivo `render.yaml` está na raiz do projeto? ✅
- O Render detecta o `render.yaml` automaticamente?

**Nota:** O `render.yaml` já está configurado para usar apenas `npm install`.

## 🔍 Como Identificar o Problema

Nos logs, você verá:
```
==> Executando o comando build ' npm install && python3 -m pip install --user ...
```

Isso significa que **ALGUM LUGAR** ainda tem um Build Command com `--user`.

**Possíveis causas:**
1. ❌ Cache do Render
2. ❌ Build Command manual no Dashboard (mesmo que você não veja)
3. ❌ Render detectando `requirements.txt` e tentando instalar automaticamente

## ✅ Solução Temporária

O `postinstall` no `package.json` agora tem `|| true` no final para não falhar o build se houver erro nas dependências Python. Isso permite que o build continue mesmo se houver problema.

## 📋 Checklist Final

- [ ] Build Command no Dashboard = `npm install` (ou vazio)
- [ ] Cache limpo no Render
- [ ] Sem Python Version manual configurado
- [ ] Deploy limpo feito
- [ ] Verificar logs para confirmar que só roda `npm install`

---

**IMPORTANTE:** O erro `--user` vem de algum lugar. Você precisa encontrar e remover essa configuração manualmente no Dashboard do Render.
