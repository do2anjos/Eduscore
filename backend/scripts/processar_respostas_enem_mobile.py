#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Processador de Respostas ENEM para Mobile
Pipeline completo: YOLO detection → OCR day → recorte ROIs → detecção de bolhas
Integra detector_yolo_enem.py e ocr_day_detector.py
"""

import cv2
import numpy as np
import sys
import json
import os
from pathlib import Path

# Importar módulos locais
try:
    from detector_yolo_enem import detect_rois
    from ocr_day_detector import detect_day_from_image
except ImportError:
    # Fallback para importação absoluta
    import importlib.util
    script_dir = Path(__file__).parent
    
    # Carregar detector_yolo_enem
    spec = importlib.util.spec_from_file_location("detector_yolo_enem", script_dir / "detector_yolo_enem.py")
    detector_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(detector_module)
    detect_rois = detector_module.detect_rois
    
    # Carregar ocr_day_detector
    spec = importlib.util.spec_from_file_location("ocr_day_detector", script_dir / "ocr_day_detector.py")
    ocr_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(ocr_module)
    detect_day_from_image = ocr_module.detect_day_from_image


def processar_bolhas_answer_area(answer_area_image):
    """
    Detecta bolhas marcadas na answer_area_enem
    Adaptado de processar_respostas_Imagem_original.py
    
    Args:
        answer_area_image: Imagem recortada da answer_area
        
    Returns:
        list: Lista de respostas [{Questão, Resposta, Valida}]
    """
    # Pré-processamento
    cinza = cv2.cvtColor(answer_area_image, cv2.COLOR_BGR2GRAY)
    suavizada = cv2.GaussianBlur(cinza, (5, 5), 0)
    _, binaria = cv2.threshold(suavizada, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    
    # Remoção de ruído
    kernel = np.ones((5, 5), np.uint8)
    mascara = cv2.morphologyEx(binaria, cv2.MORPH_OPEN, kernel)
    mascara = cv2.morphologyEx(mascara, cv2.MORPH_CLOSE, kernel)
    
    # Detectar bolhas
    contornos, _ = cv2.findContours(mascara, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    # Filtrar bolhas válidas
    area_minima = 100  # Ajustar conforme necessário
    limiar_branco = 0.70
    bolhas_validas = []
    
    for contorno in contornos:
        area = cv2.contourArea(contorno)
        if area > area_minima:
            perimetro = cv2.arcLength(contorno, True)
            if perimetro == 0:
                continue
            
            circularidade = 4 * np.pi * area / (perimetro ** 2)
            if circularidade > 0.4:
                mascara_local = np.zeros_like(mascara)
                cv2.drawContours(mascara_local, [contorno], -1, 255, -1)
                pixels_brancos = np.sum(mascara[mascara_local == 255] == 255)
                total_pixels = np.sum(mascara_local == 255)
                
                if total_pixels > 0:
                    proporcao_branco = pixels_brancos / total_pixels
                    if proporcao_branco >= limiar_branco:
                        bolhas_validas.append(contorno)
    
    # Ordenar bolhas por posição vertical
    bolhas_validas = sorted(bolhas_validas, key=lambda c: cv2.boundingRect(c)[1])
    
    # Extrair centróides
    centroides = []
    for i, contorno in enumerate(bolhas_validas):
        M = cv2.moments(contorno)
        if M["m00"] != 0:
            cx = int(M["m10"] / M["m00"])
            cy = int(M["m01"] / M["m00"])
            centroides.append((cx, cy, contorno, i+1))
    
    # Classificar bolhas em questões e alternativas
    # ENEM: 90 questões por dia, 5 alternativas cada (A-E)
    # Layout típico: 3 colunas de 30 questões cada
    
    letras_colunas = ['A', 'B', 'C', 'D', 'E']
    num_questoes_por_coluna = 30
    num_colunas = 3
    
    # Detectar limites das colunas automaticamente
    altura_area, largura_area = answer_area_image.shape[:2]
    largura_coluna = largura_area / num_colunas
    
    # Definir posições aproximadas das colunas
    limites_x_colunas = {}
    posicoes_colunas_por_bloco = {}
    
    for col in range(num_colunas):
        x_inicio = int(col * largura_coluna)
        x_fim = int((col + 1) * largura_coluna)
        limites_x_colunas[col] = (x_inicio, x_fim)
        
        # Posições das alternativas dentro de cada coluna
        # Assumindo espaçamento igual entre as 5 alternativas
        posicoes_alt = {}
        for idx, letra in enumerate(letras_colunas):
            # Posição X aproximada da alternativa dentro da coluna
            pos_x = x_inicio + (x_fim - x_inicio) * (idx + 0.5) / len(letras_colunas)
            posicoes_alt[letra] = pos_x
        
        posicoes_colunas_por_bloco[col] = posicoes_alt
    
    margem_coluna = 20  # Margem para classificação de alternativa
    
    # Estrutura para armazenar respostas
    gabarito_completo = {}
    for coluna in range(num_colunas):
        gabarito_bloco = {
            q: {'respostas': {letra: None for letra in letras_colunas}, 'valida': True}
            for q in range(1, num_questoes_por_coluna + 1)
        }
        gabarito_completo[coluna] = gabarito_bloco
    
    # Ordenar centróides por Y
    centroides.sort(key=lambda x: x[1])
    
    # Processar cada coluna separadamente
    for coluna in range(num_colunas):
        # Filtrar centróides desta coluna
        centroides_coluna = [
            (x, y, cnt, num) for (x, y, cnt, num) in centroides
            if limites_x_colunas[coluna][0] <= x < limites_x_colunas[coluna][1]
        ]
        
        if not centroides_coluna:
            continue
        
        # Distribuir uniformemente pelas questões
        passo_y = (centroides_coluna[-1][1] - centroides_coluna[0][1]) / (num_questoes_por_coluna - 1) if len(centroides_coluna) > 1 else 1
        
        for x, y, cnt, num_marcacao in centroides_coluna:
            # Determinar qual questão
            if passo_y > 0:
                questao = min(int(round((y - centroides_coluna[0][1]) / passo_y)) + 1, num_questoes_por_coluna)
            else:
                questao = 1
            
            # Determinar qual alternativa (A-E)
            distancias = {
                letra: abs(x - pos)
                for letra, pos in posicoes_colunas_por_bloco[coluna].items()
            }
            alternativa = min(distancias, key=distancias.get)
            
            if distancias[alternativa] <= margem_coluna:
                gabarito_completo[coluna][questao]['respostas'][alternativa] = (num_marcacao, x, y, cnt)
    
    # Verificar dupla marcação
    questoes_invalidas = []
    for coluna in range(num_colunas):
        for questao in range(1, num_questoes_por_coluna + 1):
            respostas = [
                letra for letra in letras_colunas
                if gabarito_completo[coluna][questao]['respostas'][letra] is not None
            ]
            
            if len(respostas) > 1:
                gabarito_completo[coluna][questao]['valida'] = False
                questao_real = questao + (coluna * num_questoes_por_coluna)
                questoes_invalidas.append({
                    'questao': questao_real,
                    'respostas': respostas,
                    'tipo': 'dupla_marcacao'
                })
    
    # Gerar lista de respostas
    respostas = []
    respostas_invalidas_count = 0
    questoes_sem_marcacao_count = 0
    
    for coluna in range(num_colunas):
        for questao in range(1, num_questoes_por_coluna + 1):
            questao_real = questao + (coluna * num_questoes_por_coluna)
            
            respostas_marcadas = [
                letra for letra in letras_colunas
                if gabarito_completo[coluna][questao]['respostas'][letra] is not None
            ]
            
            if len(respostas_marcadas) == 0:
                questoes_sem_marcacao_count += 1
                resposta_str = ""
            elif len(respostas_marcadas) > 1:
                respostas_invalidas_count += 1
                resposta_str = ",".join(sorted(respostas_marcadas))
            else:
                resposta_str = respostas_marcadas[0]
            
            respostas.append({
                "Questão": str(questao_real),
                "Resposta": resposta_str,
                "Valida": len(respostas_marcadas) == 1
            })
    
    return {
        'respostas': respostas,
        'total_bolhas_detectadas': len(centroides),
        'questoes_com_dupla_marcacao': respostas_invalidas_count,
        'questoes_sem_marcacao': questoes_sem_marcacao_count,
        'questoes_validas': len(respostas) - respostas_invalidas_count - questoes_sem_marcacao_count,
        'questoes_invalidas_detalhes': questoes_invalidas
    }


def processar_imagem_enem_mobile(caminho_imagem):
    """
    Pipeline completo para processar folha ENEM capturada no mobile
    
    Args:
        caminho_imagem: Caminho da imagem capturada
        
    Returns:
        dict: Resultado completo {sucesso, dia_detectado, questao_inicial, questao_final, respostas, ...}
    """
    try:
        # 1. Detectar ROIs usando YOLO
        print("[ENEM-MOBILE] Detectando ROIs com YOLO...", file=sys.stderr)
        resultado_yolo = detect_rois(caminho_imagem)
        
        if not resultado_yolo['sucesso']:
            return {
                'sucesso': False,
                'erro': f"Falha na detecção YOLO: {resultado_yolo.get('erro', 'Erro desconhecido')}"
            }
        
        if not resultado_yolo['detectado']:
            return {
                'sucesso': False,
                'erro': 'Não foi possível detectar as regiões necessárias (day_region e answer_area_enem). Certifique-se de que a imagem contém uma folha ENEM completa.'
            }
        
        rois = resultado_yolo['rois']
        
        # Verificar se detectou ambas as ROIs
        if 'day_region' not in rois or 'answer_area_enem' not in rois:
            return {
                'sucesso': False,
                'erro': f"ROIs incompletas. Detectado: {list(rois.keys())}. Necessário: day_region e answer_area_enem."
            }
        
        # 2. Carregar imagem original
        img = cv2.imread(caminho_imagem)
        if img is None:
            with open(caminho_imagem, 'rb') as f:
                dados = bytearray(f.read())
            nparr = np.asarray(dados, dtype=np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        # 3. Recortar e processar day_region com OCR
        print("[ENEM-MOBILE] Executando OCR na day_region...", file=sys.stderr)
        day_region_bbox = rois['day_region'][0]['bbox']  # Pegar primeira detecção
        x, y, w, h = day_region_bbox
        day_region_img = img[y:y+h, x:x+w]
        
        resultado_ocr = detect_day_from_image(day_region_img)
        
        if not resultado_ocr['sucesso']:
            return {
                'sucesso': False,
                'erro': f"Falha no OCR: {resultado_ocr.get('erro', 'Não foi possível identificar o dia da prova')}"
            }
        
        dia_detectado = resultado_ocr['dia']
        questao_inicial = resultado_ocr['questao_inicial']
        questao_final = resultado_ocr['questao_final']
        
        # 4. Recortar answer_area_enem
        print("[ENEM-MOBILE] Processando bolhas na answer_area...", file=sys.stderr)
        answer_area_bbox = rois['answer_area_enem'][0]['bbox']
        x, y, w, h = answer_area_bbox
        answer_area_img = img[y:y+h, x:x+w]
        
        # 5. Processar bolhas
        resultado_bolhas = processar_bolhas_answer_area(answer_area_img)
        
        # 6. Ajustar números das questões baseado no dia detectado
        respostas = resultado_bolhas['respostas']
        for resposta in respostas:
            questao_num = int(resposta['Questão'])
            # Renumerar: Dia 1 mantém 1-90, Dia 2 mapeia para 91-180
            if dia_detectado == 2:
                resposta['Questão'] = str(questao_num + 90)
        
        # 7. Construir resultado final
        avisos = []
        if resultado_bolhas['questoes_com_dupla_marcacao'] > 0:
            avisos.append(
                f"ATENÇÃO: {resultado_bolhas['questoes_com_dupla_marcacao']} questão(ões) com dupla marcação detectada(s)."
            )
        
        if resultado_bolhas['questoes_sem_marcacao'] > 0:
            avisos.append(
                f"INFO: {resultado_bolhas['questoes_sem_marcacao']} questão(ões) deixada(s) em branco."
            )
        
        return {
            'sucesso': True,
            'dia_detectado': dia_detectado,
            'questao_inicial': questao_inicial,
            'questao_final': questao_final,
            'confianca_ocr': resultado_ocr['confianca'],
            'texto_dia_extraido': resultado_ocr['texto_extraido'],
            'total_respostas': len(respostas),
            'total_bolhas_detectadas': resultado_bolhas['total_bolhas_detectadas'],
            'questoes_com_dupla_marcacao': resultado_bolhas['questoes_com_dupla_marcacao'],
            'questoes_sem_marcacao': resultado_bolhas['questoes_sem_marcacao'],
            'questoes_validas': resultado_bolhas['questoes_validas'],
            'questoes_invalidas_detalhes': resultado_bolhas['questoes_invalidas_detalhes'],
            'respostas': respostas,
            'avisos': avisos,
            'rois_detectadas': {
                'day_region': day_region_bbox,
                'answer_area_enem': answer_area_bbox
            }
        }
        
    except Exception as e:
        import traceback
        return {
            'sucesso': False,
            'erro': str(e),
            'traceback': traceback.format_exc()
        }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({
            'sucesso': False,
            'erro': 'Uso: python processar_respostas_enem_mobile.py <caminho_imagem>'
        }))
        sys.exit(1)
    
    caminho_imagem = sys.argv[1]
    
    if not os.path.exists(caminho_imagem):
        print(json.dumps({
            'sucesso': False,
            'erro': f'Arquivo não encontrado: {caminho_imagem}'
        }))
        sys.exit(1)
    
    resultado = processar_imagem_enem_mobile(caminho_imagem)
    print(json.dumps(resultado, ensure_ascii=False, indent=2))
