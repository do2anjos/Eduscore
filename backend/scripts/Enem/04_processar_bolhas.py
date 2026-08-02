#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Etapa 4: Processar Bolhas (OMR - Optical Mark Recognition)
Suporta dois layouts:
  - ENEM: 90 questões (6 blocos x 15 questões, alternativas A-E)
          Dia 1: questões 1-90, Dia 2: questões 91-180 (offset +90)
  - TESTES: 60 questões (3 blocos x 20 questões, alternativas A-E)

O script detecta automaticamente o layout baseado na quantidade de bolhas ou
aceita o parâmetro 'layout' para forçar um tipo específico.
"""

import cv2
import numpy as np
import sys
import json
import os

# Configurações de layout
LAYOUTS = {
    'enem': {
        'num_blocos': 6,
        'questoes_por_bloco': 15,
        'total_questoes': 90,
        'alternativas': ['A', 'B', 'C', 'D', 'E'],
        'deteccao_dinamica': True  # Posições calculadas automaticamente
    },
    'teste': {
        'num_blocos': 3,
        'questoes_por_bloco': 20,
        'total_questoes': 60,
        'alternativas': ['A', 'B', 'C', 'D', 'E'],
        # Posições X hardcoded (calibradas para imagem 678px de largura)
        'posicoes_x': {
            0: {'A': 75, 'B': 104, 'C': 134, 'D': 163, 'E': 192},
            1: {'A': 301, 'B': 330, 'C': 357, 'D': 387, 'E': 415},
            2: {'A': 525, 'B': 553, 'C': 584, 'D': 612, 'E': 641}
        },
        'limites_x': {
            0: (0, 250),
            1: (250, 450),
            2: (450, 700)
        },
        'largura_referencia': 678
    }
}


def detectar_layout(num_bolhas, proporcao_imagem=None):
    """
    Detecta o layout baseado no número de bolhas encontradas.
    
    Args:
        num_bolhas: Quantidade de bolhas válidas detectadas
        proporcao_imagem: Proporção altura/largura (opcional)
    
    Returns:
        str: 'enem' ou 'teste'
    """
    # Heurística: ENEM tem mais bolhas (90q x 5alt = 450 esperadas)
    # Testes tem menos (60q x 5alt = 300 esperadas)
    
    if num_bolhas >= 70:  # Threshold para sugerir ENEM
        return 'enem'
    else:
        return 'teste'


def carregar_imagem(caminho):
    """Carrega imagem com suporte a caracteres especiais."""
    try:
        with open(caminho, 'rb') as f:
            dados = bytearray(f.read())
        nparr = np.asarray(dados, dtype=np.uint8)
        return cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    except:
        return cv2.imread(caminho)


def processar_bolhas(imagem, layout='auto', dia_prova=1):
    """
    Processa a área de respostas para extrair bolhas marcadas.
    
    Args:
        imagem: Imagem BGR (OpenCV) da área de respostas (já recortada)
        layout: 'enem', 'teste', ou 'auto' para detecção automática
        dia_prova: 1 ou 2 (usado para ajustar numeração no ENEM)
    
    Returns:
        dict: Resultado com respostas e estatísticas
    """
    # Pré-processamento
    cinza = cv2.cvtColor(imagem, cv2.COLOR_BGR2GRAY)
    suavizada = cv2.GaussianBlur(cinza, (5, 5), 0)
    _, binaria = cv2.threshold(suavizada, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    
    # Remoção de ruído
    kernel = np.ones((5, 5), np.uint8)
    mascara = cv2.morphologyEx(binaria, cv2.MORPH_OPEN, kernel)
    mascara = cv2.morphologyEx(mascara, cv2.MORPH_CLOSE, kernel)
    
    # Detectar bolhas
    contornos, _ = cv2.findContours(mascara, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    # Filtrar bolhas válidas
    area_minima = 100
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
    
    # Detectar layout se necessário
    if layout == 'auto':
        layout = detectar_layout(len(bolhas_validas))
    
    # Extrair centróides
    centroides = []
    for i, contorno in enumerate(bolhas_validas):
        M = cv2.moments(contorno)
        if M["m00"] != 0:
            cx = int(M["m10"] / M["m00"])
            cy = int(M["m01"] / M["m00"])
            centroides.append((cx, cy, contorno, i+1))
    
    # Processar baseado no layout
    if layout == 'enem':
        return _processar_layout_enem(imagem, centroides, mascara, dia_prova)
    else:
        return _processar_layout_teste(imagem, centroides, mascara)


def _processar_layout_enem(imagem, centroides, mascara, dia_prova):
    """
    Processa layout ENEM (6 blocos x 15 questões = 90)
    
    Layout físico: 2 colunas, cada uma com 3 blocos de 15 questões
    - Coluna Esquerda: Blocos 0, 1, 2 (questões 1-45)
    - Coluna Direita: Blocos 3, 4, 5 (questões 46-90)
    """
    config = LAYOUTS['enem']
    letras = config['alternativas']
    num_blocos = config['num_blocos']
    questoes_por_bloco = config['questoes_por_bloco']
    
    altura_area, largura_area = imagem.shape[:2]
    
    # Dividir em 2 colunas principais (esquerda e direita)
    largura_coluna = largura_area / 2
    
    # Cada coluna tem 3 blocos verticais
    blocos_por_coluna = 3
    altura_bloco = altura_area / blocos_por_coluna
    
    # Definir limites para cada bloco (6 no total)
    # Blocos 0,1,2 na coluna esquerda, Blocos 3,4,5 na coluna direita
    limites_blocos = {}
    posicoes_por_bloco = {}
    
    for bloco in range(num_blocos):
        if bloco < 3:
            # Coluna esquerda
            x_inicio = 0
            x_fim = int(largura_coluna)
            bloco_vertical = bloco
        else:
            # Coluna direita
            x_inicio = int(largura_coluna)
            x_fim = largura_area
            bloco_vertical = bloco - 3
        
        y_inicio = int(bloco_vertical * altura_bloco)
        y_fim = int((bloco_vertical + 1) * altura_bloco)
        
        limites_blocos[bloco] = {
            'x': (x_inicio, x_fim),
            'y': (y_inicio, y_fim)
        }
        
        # Posições das alternativas dentro do bloco
        posicoes_alt = {}
        for idx, letra in enumerate(letras):
            pos_x = x_inicio + (x_fim - x_inicio) * (idx + 0.5) / len(letras)
            posicoes_alt[letra] = pos_x
        posicoes_por_bloco[bloco] = posicoes_alt
    
    margem_x = 20
    
    # Estrutura para respostas
    gabarito = {}
    for bloco in range(num_blocos):
        gabarito[bloco] = {
            q: {'respostas': {l: None for l in letras}, 'valida': True}
            for q in range(1, questoes_por_bloco + 1)
        }
    
    # Classificar centróides por bloco
    centroides.sort(key=lambda x: x[1])  # Ordenar por Y
    
    for bloco in range(num_blocos):
        limites = limites_blocos[bloco]
        
        # Filtrar centróides deste bloco
        centroides_bloco = [
            (x, y, cnt, num) for (x, y, cnt, num) in centroides
            if limites['x'][0] <= x < limites['x'][1] and limites['y'][0] <= y < limites['y'][1]
        ]
        
        if not centroides_bloco:
            continue
        
        # Calcular passo Y dentro do bloco
        if len(centroides_bloco) > 1:
            passo_y = (centroides_bloco[-1][1] - centroides_bloco[0][1]) / (questoes_por_bloco - 1)
        else:
            passo_y = 1
        
        for x, y, cnt, num in centroides_bloco:
            if passo_y > 0:
                questao = min(int(round((y - centroides_bloco[0][1]) / passo_y)) + 1, questoes_por_bloco)
            else:
                questao = 1
            
            distancias = {l: abs(x - pos) for l, pos in posicoes_por_bloco[bloco].items()}
            alternativa = min(distancias, key=distancias.get)
            
            if distancias[alternativa] <= margem_x:
                gabarito[bloco][questao]['respostas'][alternativa] = (num, x, y, cnt)
    
    # Gerar respostas com offset por dia
    return _gerar_resultado(gabarito, num_blocos, questoes_por_bloco, letras, 'enem', dia_prova)


def _processar_layout_teste(imagem, centroides, mascara):
    """Processa layout TESTES (3 blocos x 20 questões = 60)"""
    config = LAYOUTS['teste']
    letras = config['alternativas']
    num_blocos = config['num_blocos']
    questoes_por_bloco = config['questoes_por_bloco']
    
    altura, largura = imagem.shape[:2]
    
    # Escalar posições X para a largura atual
    escala = largura / config['largura_referencia']
    
    posicoes_por_bloco = {}
    limites_x = {}
    for bloco, pos in config['posicoes_x'].items():
        posicoes_por_bloco[bloco] = {l: int(x * escala) for l, x in pos.items()}
    for bloco, (x1, x2) in config['limites_x'].items():
        limites_x[bloco] = (int(x1 * escala), int(x2 * escala))
    
    margem = int(15 * escala)
    
    # Estrutura para respostas
    gabarito = {}
    for bloco in range(num_blocos):
        gabarito[bloco] = {
            q: {'respostas': {l: None for l in letras}, 'valida': True}
            for q in range(1, questoes_por_bloco + 1)
        }
    
    # Classificar centróides
    centroides.sort(key=lambda x: x[1])
    
    for bloco in range(num_blocos):
        centroides_bloco = [
            (x, y, cnt, num) for (x, y, cnt, num) in centroides
            if limites_x[bloco][0] <= x < limites_x[bloco][1]
        ]
        
        if not centroides_bloco:
            continue
        
        passo_y = (centroides_bloco[-1][1] - centroides_bloco[0][1]) / (questoes_por_bloco - 1) if len(centroides_bloco) > 1 else 1
        
        for x, y, cnt, num in centroides_bloco:
            if passo_y > 0:
                questao = min(int(round((y - centroides_bloco[0][1]) / passo_y)) + 1, questoes_por_bloco)
            else:
                questao = 1
            
            distancias = {l: abs(x - pos) for l, pos in posicoes_por_bloco[bloco].items()}
            alternativa = min(distancias, key=distancias.get)
            
            if distancias[alternativa] <= margem:
                gabarito[bloco][questao]['respostas'][alternativa] = (num, x, y, cnt)
    
    return _gerar_resultado(gabarito, num_blocos, questoes_por_bloco, letras, 'teste', dia_prova=1)


def _gerar_resultado(gabarito, num_blocos, questoes_por_bloco, letras, layout_nome, dia_prova):
    """
    Gera o resultado final a partir do gabarito processado.
    
    Regra de offset por dia (ENEM):
    - Dia 1: questões começam em 1 (offset = 0)
    - Dia 2: questões começam em 91 (offset = 90)
    """
    respostas = []
    invalidas = 0
    em_branco = 0
    
    # Offset baseado no dia da prova
    offset_questao = 0
    if layout_nome == 'enem' and dia_prova == 2:
        offset_questao = 90
    
    for bloco in range(num_blocos):
        for questao in range(1, questoes_por_bloco + 1):
            # Cálculo da questão real:
            # Para ENEM: bloco * 15 + questao + offset
            # Ex: Bloco 0, Q1, Dia 1 -> 0*15 + 1 + 0 = 1
            # Ex: Bloco 5, Q15, Dia 1 -> 5*15 + 15 + 0 = 90
            # Ex: Bloco 0, Q1, Dia 2 -> 0*15 + 1 + 90 = 91
            # Ex: Bloco 5, Q15, Dia 2 -> 5*15 + 15 + 90 = 180
            questao_real = (bloco * questoes_por_bloco) + questao + offset_questao
            
            marcadas = [l for l in letras if gabarito[bloco][questao]['respostas'][l] is not None]
            
            if len(marcadas) == 0:
                em_branco += 1
                resp_str = ""
            elif len(marcadas) > 1:
                invalidas += 1
                resp_str = ",".join(sorted(marcadas))
            else:
                resp_str = marcadas[0]
            
            respostas.append({
                "Questão": str(questao_real),
                "Resposta": resp_str,
                "Valida": len(marcadas) == 1
            })
    
    total = len(respostas)
    
    # Calcular range de questões
    if layout_nome == 'enem':
        questao_inicial = 1 + offset_questao
        questao_final = 90 + offset_questao
    else:
        questao_inicial = 1
        questao_final = 60
    
    return {
        'sucesso': True,
        'layout_detectado': layout_nome,
        'dia_considerado': dia_prova,
        'questao_inicial': questao_inicial,
        'questao_final': questao_final,
        'total_respostas': total,
        'questoes_validas': total - invalidas - em_branco,
        'questoes_com_dupla_marcacao': invalidas,
        'questoes_sem_marcacao': em_branco,
        'respostas': respostas,
        'avisos': []
    }


def main():
    if len(sys.argv) < 2:
        print(json.dumps({
            'sucesso': False,
            'erro': 'Uso: python 04_processar_bolhas.py <imagem> [layout=auto] [dia=1]'
        }))
        sys.exit(1)
    
    caminho = sys.argv[1]
    layout = 'auto'
    dia = 1
    
    for arg in sys.argv[2:]:
        if arg.startswith('layout='):
            layout = arg.split('=')[1]
        elif arg.startswith('dia='):
            try:
                dia = int(arg.split('=')[1])
            except:
                pass
    
    if not os.path.exists(caminho):
        print(json.dumps({'sucesso': False, 'erro': 'Arquivo não encontrado'}))
        sys.exit(1)
    
    try:
        imagem = carregar_imagem(caminho)
        if imagem is None:
            raise ValueError("Não foi possível carregar a imagem")
        
        resultado = processar_bolhas(imagem, layout=layout, dia_prova=dia)
        print(json.dumps(resultado, ensure_ascii=False, indent=2))
    
    except Exception as e:
        import traceback
        print(json.dumps({
            'sucesso': False,
            'erro': str(e),
            'traceback': traceback.format_exc()
        }))
        sys.exit(1)


if __name__ == "__main__":
    main()
