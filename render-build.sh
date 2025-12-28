#!/usr/bin/env bash
# Script de build para instalar dependências do sistema no Render.com

# Sair imediatamente se ocorrer erro
set -e

# Atualizar e instalar Tesseract
echo "Instalando dependências do sistema..."
apt-get update && apt-get install -y tesseract-ocr tesseract-ocr-por libgl1

# Instalar dependências Python
echo "Instalando dependências Python..."
pip install -r backend/scripts/requirements.txt

# Build do Node.js (se necessário)
echo "Instalando dependências Node.js..."
npm install
