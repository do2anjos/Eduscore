import cv2
import csv
import os
import sys
import json
import numpy as np
from datetime import datetime

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
    """
    Processa uma imagem de folha de resposta JÁ PROCESSADA e retorna as respostas extraídas.
    
    Este script assume que a imagem já foi corrigida em perspectiva e está pronta
    para a detecção de bolhas. Ideal para usar quando a imagem já foi pré-processada
    ou quando você quer processar sem correção de perspectiva.
    """
    
    # 1. Carregar imagem (com suporte a caracteres especiais)
    imagem = carregar_imagem(caminho_imagem)
    if imagem is None:
        raise ValueError(f"Erro ao carregar a imagem: {caminho_imagem}")

    # 2. Pré-processamento (pula correção de perspectiva pois já está processada)
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
                "erro": "Caminho da imagem não fornecido. Uso: python processar_respostas_imagem_processadas.py <caminho_imagem>"
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

