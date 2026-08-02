#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
OCR Day Detector para Folhas ENEM
Identifica se é Dia 1 ou Dia 2 da prova ENEM através de OCR na região day_region
Biblioteca: easyocr (conforme decisão do usuário)
"""

import cv2
import numpy as np
import pytesseract
from PIL import Image
import os
import re
import sys
import json

# Configurar caminho do Tesseract se estiver no Windows (Desenvolvimento Local)
if os.name == 'nt':
    # Tente encontrar o tesseract no path padrão ou variáveis de ambiente se necessário
    # pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
    pass

def preprocess_day_region(image):
    """
    Pré-processa imagem da day_region para melhorar OCR
    
    Args:
        image: Imagem (numpy array) da região
        
    Returns:
        PIL Image: Imagem pré-processada pronta para Tesseract
    """
    # Converter para escala de cinza se necessário
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image.copy()
    
    # Redimensionar se muito pequena (Tesseract gosta de 300 DPI+)
    height, width = gray.shape
    scale = 2.0  # Aumentar 2x
    if height < 50: 
        scale = 3.0 # Se muito pequeno aumentar mais
        
    if scale > 1:
        new_width = int(width * scale)
        new_height = int(height * scale)
        gray = cv2.resize(gray, (new_width, new_height), interpolation=cv2.INTER_CUBIC)
    
    # Binarização simples (Tesseract funciona bem com binarização limpa)
    # Threshold de Otsu
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    
    # Converter para PIL Image (formato nativo do pytesseract)
    pil_img = Image.fromarray(binary)
    return pil_img


def detect_day_from_text(text):
    """
    Detecta o dia da prova a partir do texto extraído
    
    Args:
        text: Texto extraído por OCR
        
    Returns:
        tuple: (dia: int ou None, confianca: float)
    """
    if not text:
        return None, 0.0
    
    # Normalizar texto: uppercase, remover acentos, remover caracteres especiais
    text_normalized = text.upper()
    # Manter letras e números apenas
    text_normalized = re.sub(r'[^\w\s]', '', text_normalized)
    
    # Padrões para Dia 1
    patterns_dia1 = [
        r'\b(1|PRIMEIRO|PRIMEIRA|UM|UMA)\s*(DIA|DIA|0IA)\b', # 0IA é erro comum OCR
        r'\bDIA\s*(1|PRIMEIRO|PRIMEIRA|UM|UMA)\b',
        r'\b1\s*º\s*DIA\b',
        r'\b1\s*°\s*DIA\b'
    ]
    
    # Padrões para Dia 2
    patterns_dia2 = [
        r'\b(2|SEGUNDO|SEGUNDA|DOIS|DUAS)\s*(DIA|DIA|0IA)\b',
        r'\bDIA\s*(2|SEGUNDO|SEGUNDA|DOIS|DUAS)\b',
        r'\b2\s*º\s*DIA\b',
        r'\b2\s*°\s*DIA\b'
    ]
    
    # Verificar Dia 1
    for pattern in patterns_dia1:
        if re.search(pattern, text_normalized):
            return 1, 0.9
    
    # Verificar Dia 2
    for pattern in patterns_dia2:
        if re.search(pattern, text_normalized):
            return 2, 0.9
    
    # Fallback: procurar apenas por números isolados com contexto "DIA" próximo
    if "DIA" in text_normalized:
        if "1" in text_normalized and "2" not in text_normalized:
            return 1, 0.7
        if "2" in text_normalized and "1" not in text_normalized:
            return 2, 0.7
            
    # Fallback final: apenas números
    if re.search(r'\b1\b', text_normalized) and not re.search(r'\b2\b', text_normalized):
        return 1, 0.5
    
    if re.search(r'\b2\b', text_normalized) and not re.search(r'\b1\b', text_normalized):
        return 2, 0.5
    
    # Não conseguiu detectar
    return None, 0.0


def detect_day_from_image(image_path_or_array, bbox=None):
    """
    Detecta o dia da prova ENEM a partir de uma imagem
    
    Args:
        image_path_or_array: Caminho da imagem ou numpy array
        bbox: Bounding box [x, y, w, h] se quiser recortar (opcional)
        
    Returns:
        dict: {sucesso, dia, confianca, texto_extraido, erro}
    """
    try:
        # Carregar imagem
        if isinstance(image_path_or_array, str):
            # É caminho de arquivo
            img = cv2.imread(image_path_or_array)
            if img is None:
                # Tentar com encoding especial
                with open(image_path_or_array, 'rb') as f:
                    dados = bytearray(f.read())
                nparr = np.asarray(dados, dtype=np.uint8)
                img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if img is None:
                raise ValueError(f"Não foi possível carregar a imagem: {image_path_or_array}")
        else:
            # É numpy array
            img = image_path_or_array
        
        # Recortar se bbox fornecido
        if bbox is not None:
            x, y, w, h = bbox
            img = img[y:y+h, x:x+w]
        
        # Pré-processar (retorna PIL Image)
        pil_img = preprocess_day_region(img)
        
        # Executar OCR com Tesseract
        # --psm 7: Treat the image as a single text line.
        # -l por: Português
        custom_config = r'--oem 3 --psm 7'
        try:
            texto_completo = pytesseract.image_to_string(pil_img, lang='por', config=custom_config)
        except pytesseract.TesseractError:
            # Fallback sem linguagem se 'por' não estiver instalado
            texto_completo = pytesseract.image_to_string(pil_img, config=custom_config)
        
        texto_completo = texto_completo.strip()
        
        # Detectar dia a partir do texto
        dia, confianca = detect_day_from_text(texto_completo)
        
        if dia is None:
            return {
                'sucesso': False,
                'dia': None,
                'confianca': 0.0,
                'texto_extraido': texto_completo,
                'erro': 'Não foi possível identificar o dia da prova no texto extraído'
            }
        
        # Mapear para intervalo de questões
        if dia == 1:
            questao_inicial = 1
            questao_final = 90
        else:  # dia == 2
            questao_inicial = 91
            questao_final = 180
        
        return {
            'sucesso': True,
            'dia': dia,
            'confianca': confianca,
            'texto_extraido': texto_completo,
            'questao_inicial': questao_inicial,
            'questao_final': questao_final
        }
        
    except Exception as e:
        return {
            'sucesso': False,
            'dia': None,
            'confianca': 0.0,
            'texto_extraido': '',
            'erro': str(e)
        }


def detect_day_from_roi_coords(image_path, roi_coords):
    """
    Detecta o dia da prova a partir de coordenadas ROI
    
    Args:
        image_path: Caminho da imagem completa
        roi_coords: Coordenadas [x, y, w, h] da day_region
        
    Returns:
        dict: Resultado da detecção
    """
    try:
        # Carregar imagem completa
        img = cv2.imread(image_path)
        if img is None:
            with open(image_path, 'rb') as f:
                dados = bytearray(f.read())
            nparr = np.asarray(dados, dtype=np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            raise ValueError(f"Não foi possível carregar a imagem: {image_path}")
        
        # Recortar day_region
        x, y, w, h = roi_coords
        day_region = img[y:y+h, x:x+w]
        
        # Detectar dia
        return detect_day_from_image(day_region)
        
    except Exception as e:
        return {
            'sucesso': False,
            'dia': None,
            'confianca': 0.0,
            'texto_extraido': '',
            'erro': str(e)
        }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({
            'sucesso': False,
            'erro': 'Uso: python ocr_day_detector.py <caminho_imagem> [x y w h]'
        }))
        sys.exit(1)
    
    image_path = sys.argv[1]
    
    if not os.path.exists(image_path):
        print(json.dumps({
            'sucesso': False,
            'erro': f'Arquivo não encontrado: {image_path}'
        }))
        sys.exit(1)
    
    # Verificar se foram fornecidas coordenadas de ROI
    bbox = None
    if len(sys.argv) >= 6:
        try:
            x = int(sys.argv[2])
            y = int(sys.argv[3])
            w = int(sys.argv[4])
            h = int(sys.argv[5])
            bbox = [x, y, w, h]
        except ValueError:
            pass
    
    resultado = detect_day_from_image(image_path, bbox=bbox)
    print(json.dumps(resultado, ensure_ascii=False, indent=2))
