import cv2
import numpy as np
import base64
import sys
import os
from pathlib import Path

# Configurações do modelo
MODEL_PATH = Path(__file__).parent / "best_yolo11s_optimized.onnx"
INPUT_SIZE = (640, 640)
CONFIDENCE_THRESHOLD = 0.25
NMS_THRESHOLD = 0.45

CLASS_NAMES = {
    0: "answer_area_enem",
    1: "day_region"
}

_NET = None
def load_model():
    global _NET
    if _NET is None:
        if not MODEL_PATH.exists():
            raise FileNotFoundError(f"Modelo não encontrado: {MODEL_PATH}")
        
        try:
            # Tentar carregar com OpenCV DNN
            _NET = cv2.dnn.readNetFromONNX(str(MODEL_PATH))
            # Configurar backend preferencial (CPU)
            _NET.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
            _NET.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)
        except Exception as e:
            raise RuntimeError(f"Erro ao carregar modelo com OpenCV DNN: {e}")
    return _NET

from PIL import Image, ImageOps
import io

def load_image_robust(image_source):
    """
    Carrega imagem de forma robusta usando PIL para tratar EXIF orientation.
    Converte para BGR (OpenCV format) para ser compatível com o resto do pipeline.
    """
    if isinstance(image_source, str) or isinstance(image_source, Path):
        img_pil = Image.open(image_source)
    elif isinstance(image_source, bytes) or isinstance(image_source, bytearray):
        img_pil = Image.open(io.BytesIO(image_source))
    elif isinstance(image_source, np.ndarray):
        # Assumindo BGR do OpenCV, converte para PIL para garantir consistência se necessário,
        # mas se já é numpy, EXIF já foi perdido provavelmente.
        # Nesse caso retornamos o próprio array.
        return image_source
    else:
        raise ValueError("Formato de imagem não suportado")

    # Corrigir orientação baseada no EXIF (Crítico para mobile!)
    img_pil = ImageOps.exif_transpose(img_pil)
    
    # Converter para RGB (PIL usa RGB, OpenCV usa BGR)
    if img_pil.mode != 'RGB':
        img_pil = img_pil.convert('RGB')
    
    img_np = np.array(img_pil)
    # Converter RGB -> BGR
    img_bgr = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)
    
    return img_bgr

def preprocess_numpy_image(img):
    """Implementação correta do Letterbox (estilo Ultralytics)"""
    shape = img.shape[:2]  # altura, largura atual
    new_shape = INPUT_SIZE
    
    # Razão de escala (new / old)
    r = min(new_shape[0] / shape[0], new_shape[1] / shape[1])
    
    # Tamanho do redimensionamento (mantendo aspecto)
    new_unpad = (int(round(shape[1] * r)), int(round(shape[0] * r)))
    
    # Padding
    dw, dh = new_shape[1] - new_unpad[0], new_shape[0] - new_unpad[1]
    dw /= 2  # divide o padding nas duas bordas
    dh /= 2
    
    if shape[::-1] != new_unpad:  # resize
        # Usar INTER_AREA para downscaling (preserva melhor texturas finas/bolinhas)
        # O usuário identificou que INTER_LINEAR pode estar destruindo as bolinhas do gabarito.
        img_resized = cv2.resize(img, new_unpad, interpolation=cv2.INTER_AREA)
    else:
        img_resized = img
    
    top, bottom = int(round(dh - 0.1)), int(round(dh + 0.1))
    left, right = int(round(dw - 0.1)), int(round(dw + 0.1))
    
    img_padded = cv2.copyMakeBorder(img_resized, top, bottom, left, right, cv2.BORDER_CONSTANT, value=(114, 114, 114))
    
    # Normalização e Blob
    blob = cv2.dnn.blobFromImage(img_padded, 1/255.0, new_shape, swapRB=True, crop=False)
    
    return img_padded, blob, r, (left, top)

def postprocess_detections(outputs, original_shape, scale, pad):
    """Post-processamento robusto para YOLOv8/v11 ONNX"""
    output = outputs[0]
    
    # Se o shape for (1, 6, 8400), transpõe para (1, 8400, 6)
    if output.shape[1] < output.shape[2]: 
        output = np.transpose(output, (0, 2, 1))
    
    output = output[0] # Remover batch -> agota é (8400, 6)
        
    detections = []
    pad_left, pad_top = pad
    
    for row in output:
        scores = row[4:]
        class_id = np.argmax(scores)
        conf = scores[class_id]
        
        if conf > CONFIDENCE_THRESHOLD:
            # 1. Coordenadas no espaço 640x640
            cx, cy, w, h = row[0:4]
            
            # 2. Remover o padding (centralizado)
            x_unpad = cx - pad_left
            y_unpad = cy - pad_top
            
            # 3. Escalar de volta para o tamanho original
            # Importante: a escala deve ser aplicada após remover o padding
            x0 = int((x_unpad - w/2) / scale)
            y0 = int((y_unpad - h/2) / scale)
            w0 = int(w / scale)
            h0 = int(h / scale)
            
            detections.append({
                'class_id': int(class_id),
                'class_name': CLASS_NAMES.get(int(class_id), f'class_{class_id}'),
                'confidence': float(conf),
                'bbox': [x0, y0, w0, h0]
            })
            
    return apply_nms(detections, NMS_THRESHOLD)

def apply_nms(detections, iou_threshold):
    if not detections: return []
    boxes = [d['bbox'] for d in detections]
    scores = [d['confidence'] for d in detections]
    
    indices = cv2.dnn.NMSBoxes(boxes, scores, CONFIDENCE_THRESHOLD, iou_threshold)
    
    final_detections = []
    if len(indices) > 0:
        for i in indices.flatten():
            final_detections.append(detections[i])
            
    return final_detections

def detect_enem_sheet(image_input):
    try:
        # Carregar imagem de forma robusta (trata EXIF se for bytes/path)
        # Se image_input for numpy (Gradio image component), o Gradio já tratou a rotação geralmente?
        # Gradio 'numpy' mode usually handles rotation if coming from file upload, but base64?
        # Vamos garantir.
        if isinstance(image_input, np.ndarray):
            image_bgr = image_input
        else:
            image_bgr = load_image_robust(image_input)

        # DEBUG DA ORIENTAÇÃO DO FRAME
        h, w = image_bgr.shape[:2]
        print(f"DEBUG: Frame recebido -> Largura: {w}, Altura: {h}")
        
        net = load_model()
        
        # Preprocessamento Robust (Ultralytics Style)
        # img_padded é a imagem 640x640 pronta para visualização, blob é o tensor para inferência
        img_padded, blob, scale, pad = preprocess_numpy_image(image_bgr)
        
        # Inferência
        net.setInput(blob)
        outputs = net.forward()
        if not isinstance(outputs, (list, tuple)):
            outputs = [outputs]
        
        # Post-processamento
        detections = postprocess_detections(outputs, (h, w), scale, pad)
        
        # --- VISUAL DEBUG (Opcional, mas útil) ---
        # Desenhar bbox na imagem de debug (img_padded 640x640)
        debug_img = img_padded.copy()
        pad_left, pad_top = pad
        
        # Para desenhar na imagem 640x640, precisamos reverter algumas operações ou usar as coords "unpad" antes do scale
        # Mas como já temos 'detections' finais, vamos fazer o caminho inverso para visualizar O QUE O MODELO DETECTOU
        
        for det in detections:
            x_orig, y_orig, w_orig, h_orig = det['bbox']
            
            # Reverter para 640x640
            x_640 = int(x_orig * scale + pad_left)
            y_640 = int(y_orig * scale + pad_top)
            w_640 = int(w_orig * scale)
            h_640 = int(h_orig * scale)
            
            color = (0, 255, 0) if det['class_id'] == 0 else (0, 0, 255) # Verde=Resposta, Vermelho=Data
            cv2.rectangle(debug_img, (x_640, y_640), (x_640 + w_640, y_640 + h_640), color, 2)
            
        # Encode Debug Image
        _, buffer = cv2.imencode('.jpg', debug_img)
        debug_base64 = base64.b64encode(buffer).decode('utf-8')
        # ------------------------------------------

        rois = {}
        
        # Estratégia de MERGE para answer_area_enem
        # O modelo pode estar detectando blocos separados de questões. 
        # Vamos unir todas as detecções de 'answer_area_enem' em uma única caixa grande.
        
        answer_boxes = []
        answer_confs = []
        
        day_boxes = []
        
        for det in detections:
            cname = det['class_name']
            if cname == 'answer_area_enem':
                answer_boxes.append(det['bbox'])
                answer_confs.append(det['confidence'])
            else:
                if cname not in rois: rois[cname] = []
                rois[cname].append({'bbox': det['bbox'], 'confidence': det['confidence']})
        
        # Merge Answer Area
        if len(answer_boxes) > 0:
            # Encontrar min_x, min_y, max_x, max_y
            min_x = min([b[0] for b in answer_boxes])
            min_y = min([b[1] for b in answer_boxes])
            max_x = max([b[0] + b[2] for b in answer_boxes])
            max_y = max([b[1] + b[3] for b in answer_boxes])
            
            merged_w = max_x - min_x
            merged_h = max_y - min_y
            
            # Usar a maior confiança encontrada ou média
            max_conf = max(answer_confs)
            
            rois['answer_area_enem'] = [{
                'bbox': [min_x, min_y, merged_w, merged_h],
                'confidence': max_conf
            }]
            
        detectado = 'day_region' in rois and 'answer_area_enem' in rois
        
        return {
            'sucesso': True, 
            'detectado': detectado, 
            'rois': rois, 
            'total_deteccoes': len(detections),
            'debug_base64': debug_base64
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {'sucesso': False, 'erro': str(e), 'detectado': False, 'rois': {}}
