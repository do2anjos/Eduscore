import cv2
import csv
import os
import sys
import json
import numpy as np
from datetime import datetime

def validar_retangulo(pontos):
    """
    Valida se os 4 pontos formam um retângulo razoável.
    Retorna True se for válido, False caso contrário.
    """
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
    
    # Verificar se os lados opostos têm tamanhos similares (tolerância de 30%)
    lado1_medio = (lados[0] + lados[2]) / 2
    lado2_medio = (lados[1] + lados[3]) / 2
    
    if lado1_medio == 0 or lado2_medio == 0:
        return False
    
    # Verificar proporção dos lados (não pode ser muito diferente)
    razao = max(lado1_medio, lado2_medio) / min(lado1_medio, lado2_medio)
    if razao > 10:  # Muito alongado
        return False
    
    # Verificar se os ângulos são próximos de 90 graus
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
    
    # Verificar se os ângulos são próximos de 90 graus (tolerância de 30 graus)
    angulos_validos = [a for a in angulos if 60 <= a <= 120]
    if len(angulos_validos) < 3:
        return False
    
    return True

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
                            break
                
                if pontos_documento is not None:
                    break
    
    # MÉTODO 3: Usar bounding box do maior contorno válido
    if pontos_documento is None:
        if len(contornos) > 0:
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
    
    # MÉTODO 4: Último recurso - usar bordas da imagem com margem
    if pontos_documento is None:
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
    """
    Carrega uma imagem lidando com caracteres especiais no caminho.
    """
    # Método mais robusto: usar numpy para ler bytes e depois decodificar
    try:
        with open(caminho, 'rb') as f:
            dados = bytearray(f.read())
        nparr = np.asarray(dados, dtype=np.uint8)
        imagem = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if imagem is not None:
            return imagem
    except Exception as e:
        pass
    
    # Tentar método padrão como fallback
    imagem = cv2.imread(caminho)
    return imagem

def processar_imagem(caminho_imagem):
    """Processa uma imagem de folha de resposta e retorna as respostas extraídas"""
    
    # 1. Carregar imagem (com suporte a caracteres especiais)
    imagem = carregar_imagem(caminho_imagem)
    if imagem is None:
        raise ValueError(f"Erro ao carregar a imagem: {caminho_imagem}")

    # 1.5. Corrigir perspectiva do documento (similar ao CamScanner)
    imagem = corrigir_perspectiva(imagem, salvar_debug=False)

    # 2. Pré-processamento
    cinza = cv2.cvtColor(imagem, cv2.COLOR_BGR2GRAY)
    suavizada = cv2.GaussianBlur(cinza, (5, 5), 0)
    _, binaria = cv2.threshold(suavizada, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    # 3. Remoção de ruído
    kernel = np.ones((5, 5), np.uint8)
    mascara = cv2.morphologyEx(binaria, cv2.MORPH_OPEN, kernel)
    mascara = cv2.morphologyEx(mascara, cv2.MORPH_CLOSE, kernel)

    # 4. Redimensionamento
    largura_desejada = 678
    escala = largura_desejada / mascara.shape[1]
    altura_desejada = int(mascara.shape[0] * escala)
    mascara_redimensionada = cv2.resize(mascara, (largura_desejada, altura_desejada))

    # 5. Detectar bolhas
    contornos, _ = cv2.findContours(mascara_redimensionada, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    # 6. Filtrar bolhas válidas
    area_minima = 200
    limiar_branco = 0.75
    bolhas_validas = []

    for contorno in contornos:
        area = cv2.contourArea(contorno)
        if area > area_minima:
            perimetro = cv2.arcLength(contorno, True)
            if perimetro == 0:
                continue
            circularidade = 4 * np.pi * area / (perimetro ** 2)
            if circularidade > 0.4:
                mascara_local = np.zeros_like(mascara_redimensionada)
                cv2.drawContours(mascara_local, [contorno], -1, 255, -1)
                pixels_brancos = np.sum(mascara_redimensionada[mascara_local == 255] == 255)
                total_pixels = np.sum(mascara_local == 255)
                if total_pixels > 0:
                    proporcao_branco = pixels_brancos / total_pixels
                    if proporcao_branco >= limiar_branco:
                        bolhas_validas.append(contorno)

    # 7. Ordenar bolhas por posição vertical (Y)
    bolhas_validas = sorted(bolhas_validas, key=lambda c: cv2.boundingRect(c)[1])

    # 8. Extrair centróides
    centroides = []
    for i, contorno in enumerate(bolhas_validas[:180]):  # 3 blocos de 60 bolhas
        M = cv2.moments(contorno)
        if M["m00"] != 0:
            cx = int(M["m10"] / M["m00"])
            cy = int(M["m01"] / M["m00"])
            centroides.append((cx, cy, contorno, i+1))  # i+1 é o número da marcação

    # 9. Definir sistema de classificação para cada bloco
    num_questoes_por_bloco = 20
    num_blocos = 3
    letras_colunas = ['A', 'B', 'C', 'D', 'E']

    # Posições X das colunas para cada bloco
    posicoes_colunas_por_bloco = {
        0: {'A': 75, 'B': 104, 'C': 134, 'D': 163, 'E': 192},    # Bloco 1-20
        1: {'A': 301, 'B': 330, 'C': 357, 'D': 387, 'E': 415},   # Bloco 21-40
        2: {'A': 525, 'B': 553, 'C': 584, 'D': 612, 'E': 641}    # Bloco 41-60
    }

    # Limites horizontais aproximados para cada bloco
    limites_x_blocos = {
        0: (0, 250),    # Bloco 1
        1: (250, 450),  # Bloco 2
        2: (450, 700)   # Bloco 3
    }

    margem_coluna = 15

    # 10. Classificar bolhas para todos os blocos com verificação de dupla marcação
    gabarito_completo = {}
    for bloco in range(num_blocos):
        gabarito_bloco = {q: {'respostas': {letra: None for letra in letras_colunas}, 'valida': True} 
                         for q in range(1, num_questoes_por_bloco+1)}
        gabarito_completo[bloco] = gabarito_bloco

    # Ordenar centróides por posição Y (linha)
    centroides.sort(key=lambda x: x[1])

    # Processar cada bloco separadamente
    for bloco in range(num_blocos):
        # Filtrar centróides que pertencem a este bloco
        centroides_bloco = [(x, y, cnt, num) for (x, y, cnt, num) in centroides 
                           if limites_x_blocos[bloco][0] <= x < limites_x_blocos[bloco][1]]
        
        if not centroides_bloco:
            continue
            
        # Distribuir bolhas igualmente entre as questões neste bloco
        passo_y = (centroides_bloco[-1][1] - centroides_bloco[0][1]) / (num_questoes_por_bloco - 1)
        
        for x, y, cnt, num_marcacao in centroides_bloco:
            questao = min(int(round((y - centroides_bloco[0][1]) / passo_y)) + 1, num_questoes_por_bloco)
            
            # Classificar por coluna usando as posições específicas do bloco
            distancias = {letra: abs(x - pos) for letra, pos in posicoes_colunas_por_bloco[bloco].items()}
            coluna = min(distancias, key=distancias.get)
            
            if distancias[coluna] <= margem_coluna:
                gabarito_completo[bloco][questao]['respostas'][coluna] = (num_marcacao, x, y, cnt)

    # Verificar dupla marcação e marcar questões inválidas
    questoes_invalidas = []
    for bloco in range(num_blocos):
        for questao in range(1, num_questoes_por_bloco+1):
            respostas = [letra for letra in letras_colunas 
                        if gabarito_completo[bloco][questao]['respostas'][letra] is not None]
            
            # Dupla marcação: mais de uma alternativa marcada
            if len(respostas) > 1:
                gabarito_completo[bloco][questao]['valida'] = False
                questao_real = questao + (bloco * num_questoes_por_bloco)
                questoes_invalidas.append({
                    'questao': questao_real,
                    'respostas': respostas,
                    'tipo': 'dupla_marcacao'
                })

    # 11. Gerar lista de respostas no formato esperado
    respostas = []
    respostas_invalidas_count = 0
    questoes_sem_marcacao_count = 0
    total_questoes_esperado = num_blocos * num_questoes_por_bloco  # 3 * 20 = 60
    
    for bloco in range(num_blocos):
        for questao in range(1, num_questoes_por_bloco + 1):
            questao_real = questao + (bloco * num_questoes_por_bloco)
            
            # Validar que a questão está no range esperado (1-60)
            if questao_real > total_questoes_esperado:
                continue  # Ignorar questões fora do range esperado
            
            # Coletar todas as alternativas marcadas para esta questão
            respostas_marcadas = [letra for letra in letras_colunas 
                                 if gabarito_completo[bloco][questao]['respostas'][letra] is not None]
            
            # Verificar tipo de resposta
            if len(respostas_marcadas) == 0:
                # Questão em branco (não marcada)
                questoes_sem_marcacao_count += 1
                resposta_str = ""  # String vazia = não foi marcado
            elif len(respostas_marcadas) > 1:
                # Dupla marcação: múltiplas alternativas marcadas
                respostas_invalidas_count += 1
                # Retornar todas as alternativas separadas por vírgula para identificação
                # Exemplo: "A,B" indica que A e B foram marcadas (inválido)
                resposta_str = ",".join(sorted(respostas_marcadas))
            else:
                # Resposta única válida
                resposta_str = respostas_marcadas[0]
            
            respostas.append({
                "Questão": str(questao_real),
                "Resposta": resposta_str,
                "Valida": len(respostas_marcadas) == 1  # Válida apenas se houver exatamente 1 marcação
            })
    
    # Retornar resultado como JSON
    resultado = {
        "sucesso": True,
        "total_bolhas_detectadas": len(centroides),
        "total_respostas": len(respostas),
        "questoes_com_dupla_marcacao": respostas_invalidas_count,
        "questoes_sem_marcacao": questoes_sem_marcacao_count,
        "questoes_validas": len(respostas) - respostas_invalidas_count - questoes_sem_marcacao_count,
        "questoes_invalidas_detalhes": questoes_invalidas,
        "respostas": respostas,
        "avisos": []
    }
    
    # Adicionar avisos se houver problemas
    if respostas_invalidas_count > 0:
        resultado["avisos"].append(
            f"ATENÇÃO: {respostas_invalidas_count} questão(ões) com dupla marcação detectada(s). "
            "Essas questões serão consideradas inválidas e não contarão como acerto."
        )
    
    if questoes_sem_marcacao_count > 0:
        resultado["avisos"].append(
            f"INFO: {questoes_sem_marcacao_count} questão(ões) deixada(s) em branco."
        )
    
    return resultado

if __name__ == "__main__":
    try:
        # Verificar se foi passado o caminho da imagem
        if len(sys.argv) < 2:
            print(json.dumps({
                "sucesso": False,
                "erro": "Caminho da imagem não fornecido. Uso: python processar_respostas.py <caminho_imagem>"
            }))
            sys.exit(1)
        
        caminho_imagem = sys.argv[1]
        
        # Verificar se o arquivo existe
        if not os.path.exists(caminho_imagem):
            print(json.dumps({
                "sucesso": False,
                "erro": f"Arquivo não encontrado: {caminho_imagem}"
            }))
            sys.exit(1)
        
        # Processar imagem
        resultado = processar_imagem(caminho_imagem)
        
        # Retornar JSON via stdout (apenas o JSON, sem outros prints)
        print(json.dumps(resultado, ensure_ascii=False))
        
    except Exception as e:
        print(json.dumps({
            "sucesso": False,
            "erro": str(e)
        }))
        sys.exit(1)

