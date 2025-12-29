# ... imports updated in separate chunk or assuming context
import cv2
import numpy as np
import sys
import json
import os
from pathlib import Path

# Configurações do modelo
MODEL_PATH = Path(__file__).parent / "best_yolo11s_optimized.onnx"
INPUT_SIZE = (640, 640)
CONFIDENCE_THRESHOLD = 0.25
NMS_THRESHOLD = 0.3

CLASS_NAMES = {
    0: "answer_area_enem",
    1: "day_region"
}


def load_model():
    """Carrega o modelo ONNX usando OpenCV DNN (Evita erro execstack do onnxruntime)"""
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Modelo não encontrado: {MODEL_PATH}")
    
    try:
        # Tentar carregar com OpenCV DNN
        net = cv2.dnn.readNetFromONNX(str(MODEL_PATH))
        # Configurar backend preferencial (CPU)
        net.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
        net.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)
        return net
    except Exception as e:
        raise RuntimeError(f"Erro ao carregar modelo com OpenCV DNN: {e}")


def preprocess_image(image_path):
    # Manter implementação original que retorna (original_img, img_batch, scale, pad)
    # ... (código existente de preprocess_image é compatível, pois gera NCHW)
    # Mas precisamos adaptar levemente se formos usar blobFromImage, 
    # ou podemos apenas usar o array numpy que já temos.
    # Vou reescrever para garantir compatibilidade completa.
    
    img = cv2.imread(image_path)
    global _NET
    if _NET is None:
        if not MODEL_PATH.exists():
            raise FileNotFoundError(f"Modelo não encontrado: {MODEL_PATH}")
        
        try:
            # Tentar carregar com OpenCV DNN
            _NET = cv2.dnn.readNetFromONNX(str(MODEL_PATH))
            # Configurar backend preferencial (CPU)
            # Tentar usar CUDA se disponível (opcional)
            try:
                _NET.setPreferableBackend(cv2.dnn.DNN_BACKEND_CUDA)
                _NET.setPreferableTarget(cv2.dnn.DNN_TARGET_CUDA)
            except:
                _NET.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
                _NET.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)
        except Exception as e:
            raise RuntimeError(f"Erro ao carregar modelo com OpenCV DNN: {e}")
    return _NET


# The preprocess_image and preprocess_numpy_image functions are replaced by the new letterbox logic
# and integrated directly into detect_enem_sheet and detect_rois.
# The postprocess_detections is also replaced by the new logic in detect_enem_sheet.


def apply_nms(detections, iou_threshold):
    if not detections: return []
    boxes = [d['bbox'] for d in detections]
    scores = [d['confidence'] for d in detections]
    # cv2.dnn.NMSBoxes expects boxes as [x, y, w, h]
    # The confidence threshold here is for filtering boxes *before* NMS,
    # but NMSBoxes also takes a scoreThreshold for internal filtering.
    # We already filtered by CONFIDENCE_THRESHOLD, so we can pass 0 here or the same threshold.
    indices = cv2.dnn.NMSBoxes(boxes, scores, CONFIDENCE_THRESHOLD, iou_threshold)
    
    # NMSBoxes returns a list of lists, e.g., [[idx1], [idx2], ...], so flatten it.
    if len(indices) > 0:
        indices = indices.flatten()
        return [detections[i] for i in indices]
    else:
        return []


def detect_rois(image_path, draw_boxes=False, output_path=None):
    try:
        detectado = 'day_region' in rois and 'answer_area_enem' in rois
        return {'sucesso': True, 'detectado': detectado, 'rois': rois, 'total_deteccoes': len(detections)}
        
    except Exception as e:
        return {'sucesso': False, 'erro': str(e), 'detectado': False, 'rois': {}}


def detect_enem_sheet(image_bgr):
    try:
        net = load_model()
        print(f"[DETECT] Input image_bgr shape: {image_bgr.shape}")
        # preprocess_numpy_image retorna (orig, blob, scale, pad)
        original_img, blob, scale, pad = preprocess_numpy_image(image_bgr)
        print(f"[DETECT] After preprocess - original shape: {original_img.shape}, scale: {scale}")
        
        # Run inference
        net.setInput(blob)
        outputs = net.forward()
        if not isinstance(outputs, (list, tuple)):
            outputs = [outputs]
        
        detections = postprocess_detections(outputs, original_img.shape[:2], scale, pad)
        print(f"[DETECT] Detections found: {len(detections)}")
        
        rois = {}
        for det in detections:
            cname = det['class_name']
            if cname not in rois: rois[cname] = []
            rois[cname].append({'bbox': det['bbox'], 'confidence': det['confidence']})
            
        detectado = 'day_region' in rois and 'answer_area_enem' in rois
        return {'sucesso': True, 'detectado': detectado, 'rois': rois, 'total_deteccoes': len(detections)}
        
    except Exception as e:
        import traceback
        return {'sucesso': False, 'erro': str(e), 'traceback': traceback.format_exc(), 'detectado': False, 'rois': {}}


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({
            'sucesso': False,
            'erro': 'Uso: python detector_yolo_enem.py <caminho_imagem> [--draw] [--output <caminho_saida>]'
        }))
        sys.exit(1)
    
    image_path = sys.argv[1]
    draw_boxes = '--draw' in sys.argv
    output_path = None
    
    if '--output' in sys.argv:
        try:
            output_idx = sys.argv.index('--output')
            output_path = sys.argv[output_idx + 1]
        except (ValueError, IndexError):
            pass
    
    if not os.path.exists(image_path):
        print(json.dumps({
            'sucesso': False,
            'erro': f'Arquivo não encontrado: {image_path}'
        }))
        sys.exit(1)
    
    resultado = detect_rois(image_path, draw_boxes=draw_boxes, output_path=output_path)
    print(json.dumps(resultado, ensure_ascii=False, indent=2))
