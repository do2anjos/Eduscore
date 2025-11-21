# Configuração do Render para Processamento de Imagens

## ✅ Problema Resolvido

O processamento de imagens agora instala automaticamente as dependências Python (`opencv-python` e `numpy`) através do script `postinstall` no `package.json`.

## 🔧 Configuração no Render Dashboard

**IMPORTANTE:** Remova ou atualize o Build Command no Render Dashboard.

### Passo 1: Acesse o Dashboard do Render
1. Vá para https://dashboard.render.com
2. Abra seu Web Service (EduScore)

### Passo 2: Atualize o Build Command
1. Vá em **Settings** → **Build Command**
2. **Remova o Build Command antigo** ou substitua por:
   ```bash
   npm install
   ```
   
   **OU simplesmente deixe vazio** para usar o padrão (que já funciona com o postinstall)

### Passo 3: Verifique o Start Command
Certifique-se de que o **Start Command** está configurado como:
```bash
npm start
```

## 📋 O que está funcionando agora

1. ✅ Script `postinstall` no `package.json` instala automaticamente:
   - `opencv-python>=4.8.0`
   - `numpy>=1.24.0`

2. ✅ Não usa mais `--user` (incompatível com virtualenv do Poetry)

3. ✅ Detecta automaticamente Python3 ou Python

## 🚨 Problema Atual

Se você ainda está vendo erro com `--user`, é porque:
- O Build Command no Render Dashboard ainda contém comandos com `--user`
- **Solução:** Remova ou atualize o Build Command conforme instruções acima

## ✅ Verificação

Após atualizar o Build Command, nos logs você deve ver:
```
Successfully installed numpy-2.2.6 opencv-python-4.12.0.88
up to date, audited 159 packages in 32s
```

E **NÃO deve ver**:
```
ERROR: Can not perform a '--user' install
```
