# 🚨 SOLUÇÃO URGENTE: Build Command Manual no Render

## Problema

O Render está usando um **Build Command manual** configurado no Dashboard que contém `--user`, causando o erro:
```
ERRO: Não é possível realizar uma instalação '--user'. Pacotes de site de usuário não são visíveis neste virtualenv.
```

## ✅ Solução (2 minutos)

### Passo 1: Acesse o Dashboard do Render
1. Vá para: https://dashboard.render.com
2. Faça login na sua conta

### Passo 2: Abra seu Web Service
1. Clique em **Services** no menu lateral
2. Clique no serviço **eduscore** (ou o nome que você deu)

### Passo 3: Remova o Build Command Manual
1. Clique em **Settings** (no menu superior do serviço)
2. Role até a seção **Build Command**
3. **DELETE** ou **REMOVA** todo o conteúdo que está lá
4. **OU** substitua por apenas:
   ```
   npm install
   ```
5. Clique em **Save Changes**

### Passo 4: Faça um Novo Deploy
1. Clique em **Manual Deploy** → **Deploy latest commit**
2. Aguarde o deploy concluir

## ✅ Verificação

Após o deploy, você deve ver nos logs:
```
Instalado com sucesso numpy-2.2.6 opencv-python-4.12.0.88
```

E **NÃO deve ver**:
```
ERRO: Não é possível realizar uma instalação '--user'
```

## Por que funciona agora?

O script `postinstall` no `package.json` já instala automaticamente as dependências Python quando você executa `npm install`. **Não precisa de Build Command adicional!**

---

## 📸 Imagens de Referência

1. **Settings** → **Build Command**
2. **Delete** ou deixe vazio
3. **Save Changes**
4. **Manual Deploy**

---

**IMPORTANTE:** O Build Command manual no Dashboard **sobrescreve** o `render.yaml`. Você precisa removê-lo manualmente!

