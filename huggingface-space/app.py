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
        
        # 2. OCR para detectar dia (se day_region foi encontrada)
        dia_detectado = None
        if 'day_region' in rois:
            day_bbox = rois['day_region']
            resultado_ocr = detect_day_from_image(image_bgr, bbox=day_bbox)
            if resultado_ocr.get('sucesso'):
                dia_detectado = resultado_ocr.get('dia')
        
        # 3. Processar área de respostas (se answer_area_enem foi encontrada)
        respostas = []
        if 'answer_area_enem' in rois:
            # Aqui você adicionaria a lógica de detecção de bolhas
            # Por enquanto retornamos placeholder
            pass
        
        return {
            "sucesso": True,
            "detectado": True,
            "dia_detectado": dia_detectado,
            "rois": rois,
            "respostas": respostas,
            "total_respostas": len(respostas)
        }
        
    except Exception as e:
        return {
            "sucesso": False,
            "erro": str(e)
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
        btn_detect.click(fn=process_frame, inputs=input_frame, outputs=output_frame)
        
    with gr.Tab("Full Capture (Completo)"):
        gr.Markdown("### Processamento completo com OCR e extração de respostas")
        with gr.Row():
            input_full = gr.Image(type="pil", label="Imagem Completa")
            output_full = gr.JSON(label="Resultado Completo")
        
        btn_process = gr.Button("Processar", variant="primary")
        btn_process.click(fn=process_full_capture, inputs=input_full, outputs=output_full)
    
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
