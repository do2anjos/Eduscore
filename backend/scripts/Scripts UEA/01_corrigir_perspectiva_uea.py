#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Etapa 1: Correção de Perspectiva do Documento
Detecta e corrige a perspectiva de uma imagem de gabarito (ENEM ou Testes).
Baseado na lógica extraída de processar_respostas_Imagem_original.py
"""

import cv2
import numpy as np
import sys
import json
import os

def validar_retangulo(pontos):
    """Valida se os 4 pontos formam um retângulo razoável."""
    if len(pontos) != 4:
        return False
    
    pontos = pontos.reshape(4, 2)
    
    # Calcular os 4 lados
    lados = []
    for i in range(4):
        p1 = pontos[i]
        p2 = pontos[(i + 1) % 4]
        lado = np.sqrt((p2[0] - p1[0])**2 + (p2[1] - p1[1])**2)
        lados.append(lado)
    
    # Verificar se os lados opostos têm tamanhos similares
    lado1_medio = (lados[0] + lados[2]) / 2
    lado2_medio = (lados[1] + lados[3]) / 2
    
    if lado1_medio == 0 or lado2_medio == 0:
        return False
    
    razao = max(lado1_medio, lado2_medio) / min(lado1_medio, lado2_medio)
    if razao > 10:
        return False
    
    # Verificar ângulos próximos a 90 graus
    def calcular_angulo(p1, p2, p3):
        v1 = p2 - p1
        v2 = p3 - p2
        cos_angulo = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-6)
        cos_angulo = np.clip(cos_angulo, -1, 1)
        return np.arccos(cos_angulo) * 180 / np.pi
    
    angulos = []
    for i in range(4):
        p1 = pontos[i]
        p2 = pontos[(i + 1) % 4]
        p3 = pontos[(i + 2) % 4]
        angulo = calcular_angulo(p1, p2, p3)
        angulos.append(angulo)
    
    angulos_validos = [a for a in angulos if 60 <= a <= 120]
    return len(angulos_validos) >= 3


def corrigir_perspectiva(imagem, salvar_debug=False):
    """
    Detecta e corrige a perspectiva do documento usando técnicas avançadas,
    similar ao CamScanner. Usa múltiplos métodos de detecção para maior robustez.
    
    Args:
        imagem: Imagem BGR do OpenCV
        salvar_debug: Se True, salva imagem mostrando os pontos detectados
    
    Returns:
        Imagem corrigida
    """
    altura_original, largura_original = imagem.shape[:2]
    
    # Redimensionar para processamento mais rápido (mantém proporção)
    escala_processamento = 1000.0 / max(largura_original, altura_original)
    if escala_processamento < 1.0:
        largura_proc = int(largura_original * escala_processamento)
        altura_proc = int(altura_original * escala_processamento)
        imagem_proc = cv2.resize(imagem, (largura_proc, altura_proc), interpolation=cv2.INTER_AREA)
    else:
        imagem_proc = imagem.copy()
        escala_processamento = 1.0
    
    # Converter para escala de cinza
    cinza = cv2.cvtColor(imagem_proc, cv2.COLOR_BGR2GRAY)
    
    # Aplicar equalização de histograma CLAHE para melhorar contraste
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    cinza = clahe.apply(cinza)
    
    # Aplicar desfoque gaussiano
    suavizada = cv2.GaussianBlur(cinza, (5, 5), 0)
    
    # Aplicar filtro bilateral para preservar bordas enquanto remove ruído
    suavizada = cv2.bilateralFilter(suavizada, 9, 75, 75)
    
    # MÉTODO 1: Detecção usando Canny adaptativo melhorado
    mediana = np.median(suavizada)
    sigma = 0.33
    limiar_baixo = int(max(0, (1.0 - sigma) * mediana))
    limiar_alto = int(min(255, (1.0 + sigma) * mediana))
    
    # Ajustar limiares se muito baixos
    if limiar_baixo < 50:
        limiar_baixo = 50
    if limiar_alto < 100:
        limiar_alto = 100
    
    bordas = cv2.Canny(suavizada, limiar_baixo, limiar_alto, apertureSize=3, L2gradient=True)
    
    # Operações morfológicas para conectar bordas quebradas
    kernel = np.ones((3, 3), np.uint8)
    bordas = cv2.dilate(bordas, kernel, iterations=3)
    bordas = cv2.morphologyEx(bordas, cv2.MORPH_CLOSE, kernel, iterations=2)
    
    # Encontrar contornos
    contornos, _ = cv2.findContours(bordas, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    # Filtrar contornos muito pequenos
    largura_proc, altura_proc = imagem_proc.shape[1], imagem_proc.shape[0]
    area_minima = (largura_proc * altura_proc) * 0.15  # 15% da imagem
    contornos = [c for c in contornos if cv2.contourArea(c) > area_minima]
    
    # Ordenar contornos por área (maior primeiro)
    contornos = sorted(contornos, key=cv2.contourArea, reverse=True)
    
    # Procurar o contorno que representa o documento (retangular)
    pontos_documento = None
    melhor_score = 0
    
    for contorno in contornos[:15]:  # Verificar os 15 maiores contornos
        perimetro = cv2.arcLength(contorno, True)
        if perimetro == 0:
            continue
        
        # Aproximar contorno com tolerância adaptativa
        epsilon = 0.02 * perimetro
        aproximacao = cv2.approxPolyDP(contorno, epsilon, True)
        
        # Se tiver 4 pontos, validar se é um retângulo
        if len(aproximacao) == 4:
            area_contorno = cv2.contourArea(aproximacao)
            if area_contorno > area_minima:
                # Validar se forma um retângulo razoável
                if validar_retangulo(aproximacao):
                    # Score baseado na área e na "retangularidade"
                    area_bbox = cv2.boundingRect(aproximacao)[2] * cv2.boundingRect(aproximacao)[3]
                    score = area_contorno / (area_bbox + 1)  # Quanto mais próximo de 1, mais retangular
                    if score > melhor_score:
                        melhor_score = score
                        pontos_documento = aproximacao
    
    # MÉTODO 2: Se não encontrou, usar threshold adaptativo
    if pontos_documento is None:
        print(json.dumps({'debug': 'Método 1 (Canny) falhou, tentando threshold adaptativo'}), file=sys.stderr)
        # Threshold adaptativo com diferentes parâmetros
        for block_size in [11, 15, 21]:
            thresh = cv2.adaptiveThreshold(suavizada, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                          cv2.THRESH_BINARY_INV, block_size, 2)
            
            # Operações morfológicas
            kernel = np.ones((3, 3), np.uint8)
            thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=3)
            thresh = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel, iterations=1)
            
            contornos_alt, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            if len(contornos_alt) > 0:
                # Filtrar e ordenar
                contornos_alt = [c for c in contornos_alt if cv2.contourArea(c) > area_minima]
                contornos_alt = sorted(contornos_alt, key=cv2.contourArea, reverse=True)
                
                for contorno in contornos_alt[:10]:
                    perimetro = cv2.arcLength(contorno, True)
                    if perimetro == 0:
                        continue
                    
                    epsilon = 0.02 * perimetro
                    aproximacao = cv2.approxPolyDP(contorno, epsilon, True)
                    
                    if len(aproximacao) == 4:
                        if validar_retangulo(aproximacao):
                            pontos_documento = aproximacao
                            print(json.dumps({'debug': f'Documento detectado via threshold adaptativo (block_size={block_size})'}), file=sys.stderr)
                            break
                
                if pontos_documento is not None:
                    break
    
    # MÉTODO 3: Usar bounding box do maior contorno válido
    if pontos_documento is None and len(contornos) > 0:
        print(json.dumps({'debug': 'Método 2 falhou, usando bounding box do maior contorno'}), file=sys.stderr)
        # Pegar o maior contorno e usar seu bounding box
        maior_contorno = contornos[0]
        x, y, w, h = cv2.boundingRect(maior_contorno)
        
        # Adicionar pequena margem
        margem = min(w, h) * 0.02
        x = max(0, int(x - margem))
        y = max(0, int(y - margem))
        w = min(largura_proc - x, int(w + 2 * margem))
        h = min(altura_proc - y, int(h + 2 * margem))
        
        pontos_documento = np.array([
            [[x, y]],
            [[x + w, y]],
            [[x + w, y + h]],
            [[x, y + h]]
        ], dtype=np.float32)
        print(json.dumps({'debug': 'Usando bounding box do maior contorno'}), file=sys.stderr)
    
    # MÉTODO 4: Último recurso - usar bordas da imagem com margem
    if pontos_documento is None:
        print(json.dumps({'debug': 'Usando fallback - bordas da imagem'}), file=sys.stderr)
        margem = min(largura_proc, altura_proc) * 0.03  # 3% de margem
        pontos_documento = np.array([
            [[margem, margem]],
            [[largura_proc - margem, margem]],
            [[largura_proc - margem, altura_proc - margem]],
            [[margem, altura_proc - margem]]
        ], dtype=np.float32)
    
    # Ajustar escala de volta para a imagem original
    pontos_documento = pontos_documento.astype(np.float32) / escala_processamento
    
    # Reordenar pontos: [topo-esquerdo, topo-direito, inferior-direito, inferior-esquerdo]
    pontos = pontos_documento.reshape(4, 2).astype(np.float32)
    
    # Método melhorado de ordenação usando centroide e ângulos
    centroide = np.mean(pontos, axis=0)
    
    # Calcular ângulos relativos ao centroide
    def calcular_angulo_relativo(ponto):
        return np.arctan2(ponto[1] - centroide[1], ponto[0] - centroide[0])
    
    # Ordenar pontos por ângulo (em sentido horário)
    pontos_com_angulos = [(p, calcular_angulo_relativo(p)) for p in pontos]
    pontos_com_angulos.sort(key=lambda x: x[1])
    pontos_ordenados_por_angulo = np.array([p[0] for p in pontos_com_angulos], dtype=np.float32)
    
    # Identificar qual ponto é qual baseado na posição
    # Separar em topo (menores Y) e base (maiores Y)
    indices_y = np.argsort(pontos_ordenados_por_angulo[:, 1])
    topo_indices = indices_y[:2]
    base_indices = indices_y[2:]
    
    topo = pontos_ordenados_por_angulo[topo_indices]
    base = pontos_ordenados_por_angulo[base_indices]
    
    # Ordenar topo e base por X (esquerda, direita)
    topo = topo[np.argsort(topo[:, 0])]
    base = base[np.argsort(base[:, 0])]
    
    # Montar pontos ordenados: [TE, TD, ID, IE]
    pontos_ordenados = np.array([
        topo[0],    # Topo esquerdo
        topo[1],    # Topo direito
        base[1],    # Inferior direito
        base[0]     # Inferior esquerdo
    ], dtype=np.float32)
    
    # Calcular dimensões do documento corrigido (usar média para melhor precisão)
    largura_superior = np.sqrt(((pontos_ordenados[1][0] - pontos_ordenados[0][0]) ** 2) + 
                               ((pontos_ordenados[1][1] - pontos_ordenados[0][1]) ** 2))
    largura_inferior = np.sqrt(((pontos_ordenados[2][0] - pontos_ordenados[3][0]) ** 2) + 
                               ((pontos_ordenados[2][1] - pontos_ordenados[3][1]) ** 2))
    largura_media = (largura_superior + largura_inferior) / 2
    
    altura_esquerda = np.sqrt(((pontos_ordenados[3][0] - pontos_ordenados[0][0]) ** 2) + 
                              ((pontos_ordenados[3][1] - pontos_ordenados[0][1]) ** 2))
    altura_direita = np.sqrt(((pontos_ordenados[2][0] - pontos_ordenados[1][0]) ** 2) + 
                             ((pontos_ordenados[2][1] - pontos_ordenados[1][1]) ** 2))
    altura_media = (altura_esquerda + altura_direita) / 2
    
    # Usar a média, mas garantir dimensões mínimas
    largura_final = max(int(largura_media), int(max(largura_superior, largura_inferior) * 0.98))
    altura_final = max(int(altura_media), int(max(altura_esquerda, altura_direita) * 0.98))
    
    print(json.dumps({'debug': f'Dimensões: {largura_original}x{altura_original} -> {largura_final}x{altura_final}'}), file=sys.stderr)
    
    # Pontos de destino para a transformação
    pontos_destino = np.array([
        [0, 0],
        [largura_final, 0],
        [largura_final, altura_final],
        [0, altura_final]
    ], dtype=np.float32)
    
    # Calcular matriz de transformação de perspectiva
    matriz_transformacao = cv2.getPerspectiveTransform(pontos_ordenados, pontos_destino)
    
    # Aplicar transformação com interpolação de alta qualidade
    imagem_corrigida = cv2.warpPerspective(imagem, matriz_transformacao, 
                                            (largura_final, altura_final),
                                            flags=cv2.INTER_LINEAR,
                                            borderMode=cv2.BORDER_CONSTANT,
                                            borderValue=(255, 255, 255))
    
    return imagem_corrigida


def carregar_imagem(caminho):
    """Carrega imagem com suporte a caracteres especiais."""
    try:
        with open(caminho, 'rb') as f:
            dados = bytearray(f.read())
        nparr = np.asarray(dados, dtype=np.uint8)
        return cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    except:
        return cv2.imread(caminho)


def main():
    if len(sys.argv) < 2:
        print(json.dumps({'sucesso': False, 'erro': 'Uso: python 01_corrigir_perspectiva.py <imagem> [output_path]'}))
        sys.exit(1)
    
    caminho_entrada = sys.argv[1]
    caminho_saida = sys.argv[2] if len(sys.argv) > 2 else None
    
    if not os.path.exists(caminho_entrada):
        print(json.dumps({'sucesso': False, 'erro': 'Arquivo não encontrado'}))
        sys.exit(1)
    
    try:
        imagem = carregar_imagem(caminho_entrada)
        if imagem is None:
            raise ValueError("Não foi possível carregar a imagem")
        
        imagem_corrigida = corrigir_perspectiva(imagem)
        
        if caminho_saida:
            cv2.imwrite(caminho_saida, imagem_corrigida)
            print(json.dumps({'sucesso': True, 'caminho_saida': caminho_saida}))
        else:
            # Sobrescreve a original
            cv2.imwrite(caminho_entrada, imagem_corrigida)
            print(json.dumps({'sucesso': True, 'caminho_saida': caminho_entrada}))
    
    except Exception as e:
        import traceback
        print(json.dumps({'sucesso': False, 'erro': str(e), 'traceback': traceback.format_exc()}))
        sys.exit(1)


if __name__ == "__main__":
    main()
