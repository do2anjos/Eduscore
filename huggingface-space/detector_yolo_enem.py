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
    if img is None:
        with open(image_path, 'rb') as f:
            dados = bytearray(f.read())
        nparr = np.asarray(dados, dtype=np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    print(f"[PREPROCESS] Loaded image size: {img.shape if img is not None else 'None'}")
    
    if img is None:
        raise ValueError(f"Não foi possível carregar a imagem: {image_path}")
    
    return preprocess_numpy_image(img)


def preprocess_numpy_image(img):
    """Refatorado para reuso"""
    original_img = img.copy()
    height, width = img.shape[:2]
    
    scale = min(INPUT_SIZE[0] / width, INPUT_SIZE[1] / height)
    new_width = int(width * scale)
    new_height = int(height * scale)
    
    img_resized = cv2.resize(img, (new_width, new_height), interpolation=cv2.INTER_LINEAR)
    
    pad_w = INPUT_SIZE[0] - new_width
    pad_h = INPUT_SIZE[1] - new_height
    top, bottom = pad_h // 2, pad_h - (pad_h // 2)
    left, right = pad_w // 2, pad_w - (pad_w // 2)
    
    img_padded = cv2.copyMakeBorder(
        img_resized, top, bottom, left, right,
        cv2.BORDER_CONSTANT, value=(114, 114, 114)
    )
    
    
    print(f"[PREPROCESS] Original: {height}x{width} (HxW), Scale: {scale:.3f}, Resized: {new_height}x{new_width}")
    print(f"[PREPROCESS] Padding - left: {left}, top: {top}, right: {right}, bottom: {bottom}")
    
    # Normalização e Transposição
    # OpenCV DNN pode usar blobFromImage, mas para manter consistência com o código anterior:
    blob = cv2.dnn.blobFromImage(img_padded, 1/255.0, INPUT_SIZE, swapRB=True, crop=False)
    
    # Nota: blobFromImage já faz swapRB (BGR->RGB se True) e normalização
    # O código anterior fazia isso manualmente. 
    # Vamos retornar o blob pronto.
    
    return original_img, blob, scale, (left, top)


def postprocess_detections(outputs, original_shape, scale, pad):
    # OpenCV retorna outputs como uma lista de blobs. 
    # Para YOLO ONNX exportado, geralmente é um único output [1, 8400, 6] (se for v8/11)
    
    # outputs é uma lista de arrays numpy
    output = outputs[0] # Pegar o primeiro output layer
    
    # output shape para YOLOv8/11 geralmente é (1, 6, 8400) ou (1, 8400, 6) dependendo do export
    # Vamos verificar a dimensão. Se for (1, 6, 8400), precisamos transpor.
    if output.shape[1] < output.shape[2]: # Ex: (1, 6, 8400) -> Transpor para (1, 8400, 6)
        output = np.transpose(output, (0, 2, 1))
    
    output = output[0] # Remover batch -> (8400, 6)
    
    detections = []
    height, width = original_shape
    pad_left, pad_top = pad
    
    # Iterar sobre detecções
    # Formato: [x_center, y_center, width, height, class0_score, class1_score...]
    # Não tem "confidence" separado no v8/v11 default, a confiança é o max(class_scores)
    
    rows = output.shape[0]
    
    for i in range(rows):
        row = output[i]
        
        # As primeiras 4 colunas são bbox
        scores = row[4:]
        class_id = np.argmax(scores)
        confidence = scores[class_id]
        
        if confidence < CONFIDENCE_THRESHOLD:
            continue
            
        x_center, y_center, w, h = row[:4]
        
        # DEBUG: Log primeira detecção para diagnóstico
        if len(detections) == 0 and confidence > CONFIDENCE_THRESHOLD:
            print(f"[DEBUG] Raw ONNX output (first detection): x_center={x_center}, y_center={y_center}, w={w}, h={h}")
            print(f"[DEBUG] Image size (with padding): {INPUT_SIZE}, Original: {width}x{height}, Scale: {scale}")
            print(f"[DEBUG] Padding: pad_left={pad_left}, pad_top={pad_top}")
        
        # IMPORTANTE: x_center, y_center, w, h estão no espaço de INPUT (640x640)
        # Precisamos remover padding e então escalar para o tamanho original
        
        # 1. Remover padding (ainda no espaço 640x640)
        x_center_nopad = x_center - pad_left
        y_center_nopad = y_center - pad_top
        
        # DEBUG: Log após remover padding
        if len(detections) == 0 and confidence > CONFIDENCE_THRESHOLD:
            print(f"[DEBUG] After removing padding: x={x_center_nopad}, y={y_center_nopad}")
        
        # 2. Escalar para o tamanho original
        # scale = INPUT_SIZE / max(width, height)
        # Para voltar ao original: coord_original = coord_input / scale
        x_center_orig = x_center_nopad / scale
        y_center_orig = y_center_nopad / scale
        w_orig = w / scale
        h_orig = h / scale
        
        # DEBUG: Log após escalar
        if len(detections) == 0 and confidence > CONFIDENCE_THRESHOLD:
            print(f"[DEBUG] After scaling: x={x_center_orig}, y={y_center_orig}, w={w_orig}, h={h_orig}")
        
        # 3. Converter de center para top-left
        # HIPÓTESE: O modelo pode estar retornando xywh (Top-Left) ao invés de cxcywh (Center)
        # Sintoma: Boxes aparecem deslocadas para cima e esquerda (~metade da dimensão)
        # Teste: Assumir Top-Left direto
        
        # x = int(x_center_orig - w_orig / 2) # Center logic
        # y = int(y_center_orig - h_orig / 2) # Center logic
        
        x = int(x_center_orig) # Top-Left logic test
        y = int(y_center_orig) # Top-Left logic test
        w = int(w_orig)
        h = int(h_orig)
        
        # DEBUG: Log final
        if len(detections) == 0 and confidence > CONFIDENCE_THRESHOLD:
            print(f"[DEBUG] Final bbox (Assuming Top-Left Input): [{x}, {y}, {w}, {h}]")
        
        detections.append({
            'class_id': int(class_id),
            'class_name': CLASS_NAMES.get(int(class_id), f'class_{class_id}'),
            'confidence': float(confidence),
            'bbox': [x, y, w, h]
        })
    
    return apply_nms(detections, NMS_THRESHOLD)


def apply_nms(detections, iou_threshold):
    # Mantém implementación anterior
    if len(detections) == 0: return []
    
    # OpenCV tem NMSBoxes que é mais rápido, mas vamos manter o Python puro 
    # por enquanto para evitar mudar muitas coisas, ou usar cv2.dnn.NMSBoxes se quiser otimizar.
    # Manterei a função original para minimizar erros de portabilidade agora.
    
    detections_by_class = {}
    for det in detections:
        cid = det['class_id']
        if cid not in detections_by_class: detections_by_class[cid] = []
        detections_by_class[cid].append(det)
        
    final_detections = []
    for cid, dets in detections_by_class.items():
        dets = sorted(dets, key=lambda x: x['confidence'], reverse=True)
        keep = []
        while len(dets) > 0:
            best = dets.pop(0)
            keep.append(best)
            dets = [d for d in dets if calculate_iou(best['bbox'], d['bbox']) < iou_threshold]
        final_detections.extend(keep)
        
    return final_detections


def calculate_iou(box1, box2):
    # Manter implementação original
    x1, y1, w1, h1 = box1
    x2, y2, w2, h2 = box2
    x_left = max(x1, x2)
    y_top = max(y1, y2)
    x_right = min(x1 + w1, x2 + w2)
    y_bottom = min(y1 + h1, y2 + h2)
    if x_right < x_left or y_bottom < y_top: return 0.0
    intersection = (x_right - x_left) * (y_bottom - y_top)
    union = (w1 * h1) + (w2 * h2) - intersection
    return intersection / union if union > 0 else 0.0


def detect_rois(image_path, draw_boxes=False, output_path=None):
    try:
        net = load_model()
        original_img, blob, scale, pad = preprocess_image(image_path)
        
        net.setInput(blob)
        outputs = net.forward()
        # forward retorna lista ou array, colocamos em lista se não for
        if not isinstance(outputs, (list, tuple)):
            outputs = [outputs]
            
        detections = postprocess_detections(outputs, original_img.shape[:2], scale, pad)
        
        rois = {}
        for det in detections:
            cname = det['class_name']
            if cname not in rois: rois[cname] = []
            rois[cname].append({'bbox': det['bbox'], 'confidence': det['confidence']})
            
        if draw_boxes and len(detections) > 0:
            img_with_boxes = original_img.copy()
            for det in detections:
                x, y, w, h = det['bbox']
                color = (0, 255, 0) if det['class_name'] == 'answer_area_enem' else (255, 0, 0)
                cv2.rectangle(img_with_boxes, (x, y), (x + w, y + h), color, 2)
                label = f"{det['class_name']}: {det['confidence']:.2f}"
                cv2.putText(img_with_boxes, label, (x, y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
            if output_path:
                cv2.imwrite(output_path, img_with_boxes)
                
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
