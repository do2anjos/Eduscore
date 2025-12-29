import gradio as gr
import cv2
import numpy as np
from PIL import Image
import json
import sys
import os

# Adicionar diretório de scripts ao path para importar módulos Python
sys.path.append(os.path.dirname(__file__))

# Importar funções do detector YOLO e OCR
try:
    from detector_yolo_enem import detect_enem_sheet
    from ocr_day_detector import detect_day_from_image
except ImportError as e:
    print(f"AVISO: Não foi possível importar módulos: {e}")
    print("Certifique-se de copiar detector_yolo_enem.py e ocr_day_detector.py para este diretório")

def process_frame(image):
    """
    Processa um frame da câmera mobile para detecção YOLO rápida
    
    Args:
        image: PIL Image ou numpy array
    
    Returns:
        dict: Resultado com detecções e feedback
    """
    try:
        # Converter PIL Image para numpy array se necessário
        if isinstance(image, Image.Image):
            image_np = np.array(image)
        else:
            image_np = image
            
        # Converter RGB para BGR (OpenCV usa BGR)
        if len(image_np.shape) == 3 and image_np.shape[2] == 3:
            image_bgr = cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR)
        else:
            image_bgr = image_np
        
        # Executar detecção YOLO
        resultado = detect_enem_sheet(image_bgr)
        
        # Gerar feedback para UI
        feedback = "Procurando folha ENEM..."
        if resultado.get('detectado', False):
            feedback = "✓ Folha detectada! Capture quando estiver estável."
        elif resultado.get('rois') and len(resultado['rois']) > 0:
            feedback = "Centralize melhor a folha"
        
        return {
            "sucesso": True,
            "detectado": resultado.get('detectado', False),
            "rois": resultado.get('rois', {}),
            "feedback": feedback,
            "total_deteccoes": resultado.get('total_deteccoes', 0)
        }
        
    except Exception as e:
        return {
            "sucesso": False,
            "erro": str(e),
            "detectado": False,
            "feedback": "Erro ao processar imagem"
        }

def process_full_capture(image):
    """
    Processa captura completa com YOLO + OCR + detecção de bolhas
    Pipeline completo: detector_yolo_enem → ocr_day_detector → processar bolhas
    
    Args:
        image: PIL Image
        
    Returns:
        dict: Resultado completo com dia detectado, respostas, etc.
    """
    try:
        # Converter para numpy array BGR
        if isinstance(image, Image.Image):
            image_np = np.array(image)
        else:
            image_np = image
            
        image_bgr = cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR) if len(image_np.shape) == 3 else image_np
        
        # 1. Detecção YOLO
        resultado_yolo = detect_enem_sheet(image_bgr)
        
        if not resultado_yolo.get('detectado'):
            return {
                "sucesso": False,
                "erro": "Folha ENEM não foi detectada completamente"
            }
        
        rois = resultado_yolo.get('rois', {})
        
        # Verificar se tem as ROIs necessárias
        if 'day_region' not in rois or 'answer_area_enem' not in rois:
            return {
                "sucesso": False,
                "erro": f"ROIs incompletas. Detectado: {list(rois.keys())}"
            }
        
        # 2. OCR para detectar dia
        day_bbox = rois['day_region'][0]['bbox']
        x, y, w, h = day_bbox
        day_region_img = image_bgr[y:y+h, x:x+w]
        
        resultado_ocr = detect_day_from_image(day_region_img)
        
        if not resultado_ocr.get('sucesso'):
            return {
                "sucesso": False,
                "erro": "Não foi possível detectar o dia da prova"
            }
        
        dia_detectado = resultado_ocr.get('dia')
        
        # 3. Processar área de respostas (bolhas)
        answer_bbox = rois['answer_area_enem'][0]['bbox']
        x, y, w, h = answer_bbox
        answer_area_img = image_bgr[y:y+h, x:x+w]
        
        # Processar bolhas
        resultado_bolhas = processar_bolhas_answer_area(answer_area_img)
        
        # Ajustar números das questões baseado no dia
        respostas = resultado_bolhas['respostas']
        for resposta in respostas:
            questao_num = int(resposta['Questão'])
            if dia_detectado == 2:
                resposta['Questão'] = str(questao_num + 90)
        
        # Avisos
        avisos = []
        if resultado_bolhas['questoes_com_dupla_marcacao'] > 0:
            avisos.append(f"ATENÇÃO: {resultado_bolhas['questoes_com_dupla_marcacao']} questão(ões) com dupla marcação")
        if resultado_bolhas['questoes_sem_marcacao'] > 0:
            avisos.append(f"INFO: {resultado_bolhas['questoes_sem_marcacao']} questão(ões) em branco")
        
        return {
            "sucesso": True,
            "dia_detectado": dia_detectado,
            "questao_inicial": resultado_ocr.get('questao_inicial'),
            "questao_final": resultado_ocr.get('questao_final'),
            "total_respostas": len(respostas),
            "total_bolhas_detectadas": resultado_bolhas['total_bolhas_detectadas'],
            "questoes_com_dupla_marcacao": resultado_bolhas['questoes_com_dupla_marcacao'],
            "questoes_sem_marcacao": resultado_bolhas['questoes_sem_marcacao'],
            "questoes_validas": resultado_bolhas['questoes_validas'],
            "respostas": respostas,
            "avisos": avisos
        }
        
    except Exception as e:
        import traceback
        return {
            "sucesso": False,
            "erro": str(e),
            "traceback": traceback.format_exc()
        }


def processar_bolhas_answer_area(answer_area_image):
    """
    Detecta bolhas marcadas na answer_area_enem
    Adaptado do processar_respostas_enem_mobile.py
    
    Args:
        answer_area_image: Imagem recortada da answer_area (numpy BGR)
        
    Returns:
        dict: {respostas, total_bolhas_detectadas, questoes_com_dupla_marcacao, ...}
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
    
    # Extrair centróides
    centroides = []
    for i, contorno in enumerate(bolhas_validas):
        M = cv2.moments(contorno)
        if M["m00"] != 0:
            cx = int(M["m10"] / M["m00"])
            cy = int(M["m01"] / M["m00"])
            centroides.append((cx, cy, contorno, i+1))
    
    # Layout ENEM: 90 questões, 5 alternativas (A-E), 3 colunas de 30
    letras_colunas = ['A', 'B', 'C', 'D', 'E']
    num_questoes_por_coluna = 30
    num_colunas = 3
    
    altura_area, largura_area = answer_area_image.shape[:2]
    largura_coluna = largura_area / num_colunas
    
    # Definir limites das colunas
    limites_x_colunas = {}
    posicoes_colunas_por_bloco = {}
    
    for col in range(num_colunas):
        x_inicio = int(col * largura_coluna)
        x_fim = int((col + 1) * largura_coluna)
        limites_x_colunas[col] = (x_inicio, x_fim)
        
        posicoes_alt = {}
        for idx, letra in enumerate(letras_colunas):
            pos_x = x_inicio + (x_fim - x_inicio) * (idx + 0.5) / len(letras_colunas)
            posicoes_alt[letra] = pos_x
        
        posicoes_colunas_por_bloco[col] = posicoes_alt
    
    margem_coluna = 20
    
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
    
    # Processar cada coluna
    for coluna in range(num_colunas):
        centroides_coluna = [
            (x, y, cnt, num) for (x, y, cnt, num) in centroides
            if limites_x_colunas[coluna][0] <= x < limites_x_colunas[coluna][1]
        ]
        
        if not centroides_coluna:
            continue
        
        passo_y = (centroides_coluna[-1][1] - centroides_coluna[0][1]) / (num_questoes_por_coluna - 1) if len(centroides_coluna) > 1 else 1
        
        for x, y, cnt, num_marcacao in centroides_coluna:
            if passo_y > 0:
                questao = min(int(round((y - centroides_coluna[0][1]) / passo_y)) + 1, num_questoes_por_coluna)
            else:
                questao = 1
            
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

# Criar interface Gradio com duas abas
with gr.Blocks(title="EduScore YOLO API") as demo:
    gr.Markdown("# 🎯 EduScore YOLO + OCR API")
    gr.Markdown("API para detecção de folhas ENEM usando YOLOv11 e Tesseract OCR")
    
    with gr.Tab("Live Detection (Rápido)"):
        gr.Markdown("### Detecção rápida para feedback em tempo real")
        with gr.Row():
            input_frame = gr.Image(type="pil", label="Frame da Câmera")
            output_frame = gr.JSON(label="Resultado")
        
        btn_detect = gr.Button("Detectar", variant="primary")
        btn_detect.click(
            fn=process_frame, 
            inputs=input_frame, 
            outputs=output_frame,
            api_name="detect"  # Endpoint: /api/predict ou client.predict("/detect")
        )
        
    with gr.Tab("Full Capture (Completo)"):
        gr.Markdown("### Processamento completo com OCR e extração de respostas")
        with gr.Row():
            input_full = gr.Image(type="pil", label="Imagem Completa")
            output_full = gr.JSON(label="Resultado Completo")
        
        btn_process = gr.Button("Processar", variant="primary")
        btn_process.click(
            fn=process_full_capture, 
            inputs=input_full, 
            outputs=output_full,
            api_name="process"  # Endpoint: client.predict("/process")
        )
    
    gr.Markdown("---")
    gr.Markdown("**Como usar via API:**")
    gr.Code('''
# Exemplo Python
import requests

url = "https://do2anjos-eduscore-yolo-api.hf.space/api/predict"
files = {"data": open("frame.jpg", "rb")}
response = requests.post(url, files=files)
print(response.json())
    ''', language="python")

# Lançar com API pública habilitada
if __name__ == "__main__":
    demo.launch(share=False, server_name="0.0.0.0", server_port=7860)
