#!/bin/bash
# Script de build para Render - instala dependências Node.js e Python

echo "🔧 Iniciando build..."

# 1. Instalar dependências Node.js
echo "📦 Instalando dependências Node.js..."
npm install

# 2. Instalar dependências Python
echo "🐍 Instalando dependências Python..."
if command -v python3 &> /dev/null; then
    echo "✓ Python3 encontrado"
    python3 -m pip install --upgrade pip
    python3 -m pip install -r ../backend/scripts/requirements.txt
    echo "✅ Dependências Python instaladas com sucesso"
elif command -v python &> /dev/null; then
    echo "✓ Python encontrado"
    python -m pip install --upgrade pip
    python -m pip install -r ../backend/scripts/requirements.txt
    echo "✅ Dependências Python instaladas com sucesso"
else
    echo "⚠️  Python não encontrado. Verificando se está instalado no sistema..."
    # Tentar verificar no PATH do Render
    export PATH=$PATH:/usr/bin:/usr/local/bin
    if command -v python3 &> /dev/null || command -v python &> /dev/null; then
        echo "✓ Python encontrado após atualizar PATH"
        python3 -m pip install -r ../backend/scripts/requirements.txt 2>/dev/null || python -m pip install -r ../backend/scripts/requirements.txt 2>/dev/null
    else
        echo "❌ Python não encontrado. As dependências Python devem ser instaladas manualmente."
        echo "   Por favor, configure o Render para instalar Python 3.x e suas dependências."
    fi
fi

echo "✅ Build concluído!"

