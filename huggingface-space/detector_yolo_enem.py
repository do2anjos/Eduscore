#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Detector YOLO11 para Folhas ENEM
Detecta regiões de interesse (ROIs): day_region e answer_area_enem
Modelo: best_yolo11s_optimized.onnx
"""

import cv2
import numpy as np
import onnxruntime as ort
import sys
import json
import os
from pathlib import Path

# Configurações do modelo
MODEL_PATH = Path(__file__).parent / "best_yolo11s_optimized.onnx"
INPUT_SIZE = (640, 640)  # Tamanho de entrada padrão YOLO11
CONFIDENCE_THRESHOLD = 0.25  # Reduzido de 0.5 para detectar mais (menos conservador)
NMS_THRESHOLD = 0.3  # Reduzido de 0.4 para permitir mais detecções próximas

# Classes detectadas pelo modelo (ajustar conforme seu treinamento)
CLASS_NAMES = {
    0: "day_region",
    1: "answer_area_enem"
}


def load_model():
    """Carrega o modelo ONNX"""
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Modelo não encontrado: {MODEL_PATH}")
    
    # Configurar sessão ONNX Runtime
    session_options = ort.SessionOptions()
    session_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    
    # Usar CPU por padrão (mais compatível)
    # Para GPU: providers=['CUDAExecutionProvider', 'CPUExecutionProvider']
    providers = ['CPUExecutionProvider']
    
    session = ort.InferenceSession(str(MODEL_PATH), session_options, providers=providers)
    
    return session


def preprocess_image(image_path):
    """
    Pré-processa imagem para inferência YOLO
    
    Args:
        image_path: Caminho da imagem
        
    Returns:
        tuple: (imagem_original, tensor_preprocessado, escala, pad)
    """
    # Carregar imagem
    img = cv2.imread(image_path)
    if img is None:
        # Tentar carregar com encoding especial para caracteres especiais
        with open(image_path, 'rb') as f:
            dados = bytearray(f.read())
        nparr = np.asarray(dados, dtype=np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if img is None:
        raise ValueError(f"Não foi possível carregar a imagem: {image_path}")
    
    original_img = img.copy()
    height, width = img.shape[:2]
    
    # Calcular escala e padding para manter aspect ratio
    scale = min(INPUT_SIZE[0] / width, INPUT_SIZE[1] / height)
    new_width = int(width * scale)
    new_height = int(height * scale)
    
    # Redimensionar
    img_resized = cv2.resize(img, (new_width, new_height), interpolation=cv2.INTER_LINEAR)
    
    # Adicionar padding para chegar ao tamanho de entrada
    pad_w = INPUT_SIZE[0] - new_width
    pad_h = INPUT_SIZE[1] - new_height
    top, bottom = pad_h // 2, pad_h - (pad_h // 2)
    left, right = pad_w // 2, pad_w - (pad_w // 2)
    
    img_padded = cv2.copyMakeBorder(
        img_resized, top, bottom, left, right,
        cv2.BORDER_CONSTANT, value=(114, 114, 114)
    )
    
    # Converter para RGB e normalizar
    img_rgb = cv2.cvtColor(img_padded, cv2.COLOR_BGR2RGB)
    img_normalized = img_rgb.astype(np.float32) / 255.0
    
    # Transpor para formato NCHW (batch, channels, height, width)
    img_transposed = np.transpose(img_normalized, (2, 0, 1))
    img_batch = np.expand_dims(img_transposed, axis=0)
    
    return original_img, img_batch, scale, (left, top)


def postprocess_detections(outputs, original_shape, scale, pad):
    """
    Pós-processa saídas do YOLO para obter bounding boxes
    
    Args:
        outputs: Saída do modelo ONNX
        original_shape: Forma da imagem original (height, width)
        scale: Escala aplicada no pré-processamento
        pad: Padding aplicado (left, top)
        
    Returns:
        list: Lista de detecções [{class_id, class_name, confidence, bbox: [x, y, w, h]}]
    """
    # YOLO11 output format: (1, num_detections, 5 + num_classes)
    # [x_center, y_center, width, height, confidence, class_scores...]
    
    output = outputs[0][0]  # Remover dimensão batch
    
    detections = []
    height, width = original_shape
    pad_left, pad_top = pad
    
    for detection in output:
        # Extrair coordenadas e confiança
        x_center, y_center, w, h = detection[:4]
        confidence = detection[4]
        class_scores = detection[5:]
        
        # Aplicar threshold de confiança
        if confidence < CONFIDENCE_THRESHOLD:
            continue
        
        # Encontrar classe com maior score
        class_id = np.argmax(class_scores)
        class_confidence = class_scores[class_id]
        
        # Confiança final
        final_confidence = confidence * class_confidence
        
        if final_confidence < CONFIDENCE_THRESHOLD:
            continue
        
        # Converter coordenadas para imagem original
        # Remover padding
        x_center = (x_center - pad_left) / scale
        y_center = (y_center - pad_top) / scale
        w = w / scale
        h = h / scale
        
        # Converter de centro para canto superior esquerdo
        x = int(x_center - w / 2)
        y = int(y_center - h / 2)
        w = int(w)
        h = int(h)
        
        # Garantir que está dentro dos limites
        x = max(0, min(x, width))
        y = max(0, min(y, height))
        w = min(w, width - x)
        h = min(h, height - y)
        
        detections.append({
            'class_id': int(class_id),
            'class_name': CLASS_NAMES.get(int(class_id), f'class_{class_id}'),
            'confidence': float(final_confidence),
            'bbox': [x, y, w, h]
        })
    
    # Aplicar Non-Maximum Suppression (NMS)
    detections = apply_nms(detections, NMS_THRESHOLD)
    
    return detections


def apply_nms(detections, iou_threshold):
    """Aplica Non-Maximum Suppression para remover detecções duplicadas"""
    if len(detections) == 0:
        return []
    
    # Agrupar por classe
    detections_by_class = {}
    for det in detections:
        class_id = det['class_id']
        if class_id not in detections_by_class:
            detections_by_class[class_id] = []
        detections_by_class[class_id].append(det)
    
    # Aplicar NMS por classe
    final_detections = []
    for class_id, dets in detections_by_class.items():
        # Ordenar por confiança
        dets = sorted(dets, key=lambda x: x['confidence'], reverse=True)
        
        keep = []
        while len(dets) > 0:
            # Manter a detecção com maior confiança
            best = dets.pop(0)
            keep.append(best)
            
            # Remover detecções com IoU alto
            dets = [d for d in dets if calculate_iou(best['bbox'], d['bbox']) < iou_threshold]
        
        final_detections.extend(keep)
    
    return final_detections


def calculate_iou(box1, box2):
    """Calcula Intersection over Union entre duas bounding boxes"""
    x1, y1, w1, h1 = box1
    x2, y2, w2, h2 = box2
    
    # Calcular área de interseção
    x_left = max(x1, x2)
    y_top = max(y1, y2)
    x_right = min(x1 + w1, x2 + w2)
    y_bottom = min(y1 + h1, y2 + h2)
    
    if x_right < x_left or y_bottom < y_top:
        return 0.0
    
    intersection = (x_right - x_left) * (y_bottom - y_top)
    
    # Calcular área de união
    area1 = w1 * h1
    area2 = w2 * h2
    union = area1 + area2 - intersection
    
    return intersection / union if union > 0 else 0.0


def detect_rois(image_path, draw_boxes=False, output_path=None):
    """
    Detecta ROIs em uma imagem usando YOLO11
    
    Args:
        image_path: Caminho da imagem
        draw_boxes: Se True, desenha bounding boxes na imagem
        output_path: Caminho para salvar imagem com boxes (se draw_boxes=True)
        
    Returns:
        dict: Resultado da detecção {sucesso, detectado, rois: {day_region: [...], answer_area_enem: [...]}}
    """
    try:
        # Carregar modelo
        session = load_model()
        
        # Pré-processar imagem
        original_img, img_tensor, scale, pad = preprocess_image(image_path)
        
        # Inferência
        input_name = session.get_inputs()[0].name
        outputs = session.run(None, {input_name: img_tensor})
        
        # Pós-processar detecções
        detections = postprocess_detections(outputs, original_img.shape[:2], scale, pad)
        
        # Organizar ROIs por classe
        rois = {}
        for det in detections:
            class_name = det['class_name']
            if class_name not in rois:
                rois[class_name] = []
            rois[class_name].append({
                'bbox': det['bbox'],
                'confidence': det['confidence']
            })
        
        # Desenhar boxes se solicitado
        if draw_boxes and len(detections) > 0:
            img_with_boxes = original_img.copy()
            for det in detections:
                x, y, w, h = det['bbox']
                color = (0, 255, 0) if det['class_name'] == 'answer_area_enem' else (255, 0, 0)
                cv2.rectangle(img_with_boxes, (x, y), (x + w, y + h), color, 2)
                
                label = f"{det['class_name']}: {det['confidence']:.2f}"
                cv2.putText(img_with_boxes, label, (x, y - 10),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
            
            if output_path:
                cv2.imwrite(output_path, img_with_boxes)
        
        # Verificar se detectou ambas as ROIs
        detectado = 'day_region' in rois and 'answer_area_enem' in rois
        
        return {
            'sucesso': True,
            'detectado': detectado,
            'rois': rois,
            'total_deteccoes': len(detections)
        }
        
    except Exception as e:
        return {
            'sucesso': False,
            'erro': str(e),
            'detectado': False,
            'rois': {}
        }


def detect_enem_sheet(image_bgr):
    """
    Detecta folha ENEM a partir de uma imagem numpy array (BGR)
    Esta é a função chamada pelo app.py do Gradio
    
    Args:
        image_bgr: numpy array da imagem em formato BGR (OpenCV)
        
    Returns:
        dict: Resultado da detecção {sucesso, detectado, rois, total_deteccoes}
    """
    try:
        # Carregar modelo
        session = load_model()
        
        # Pré-processar imagem diretamente do array
        original_img = image_bgr.copy()
        height, width = original_img.shape[:2]
        
        # Calcular escala e padding
        scale = min(INPUT_SIZE[0] / width, INPUT_SIZE[1] / height)
        new_width = int(width * scale)
        new_height = int(height * scale)
        
        img_resized = cv2.resize(original_img, (new_width, new_height), interpolation=cv2.INTER_LINEAR)
        
        pad_w = INPUT_SIZE[0] - new_width
        pad_h = INPUT_SIZE[1] - new_height
        top, bottom = pad_h // 2, pad_h - (pad_h // 2)
        left, right = pad_w // 2, pad_w - (pad_w // 2)
        
        img_padded = cv2.copyMakeBorder(
            img_resized, top, bottom, left, right,
            cv2.BORDER_CONSTANT, value=(114, 114, 114)
        )
        
        # Converter para RGB e normalizar
        img_rgb = cv2.cvtColor(img_padded, cv2.COLOR_BGR2RGB)
        img_normalized = img_rgb.astype(np.float32) / 255.0
        
        # Transpor para formato NCHW
        img_transposed = np.transpose(img_normalized, (2, 0, 1))
        img_batch = np.expand_dims(img_transposed, axis=0)
        
        # Inferência
        input_name = session.get_inputs()[0].name
        outputs = session.run(None, {input_name: img_batch})
        
        # Pós-processar detecções
        detections = postprocess_detections(outputs, (height, width), scale, (left, top))
        
        # Organizar ROIs por classe
        rois = {}
        for det in detections:
            class_name = det['class_name']
            if class_name not in rois:
                rois[class_name] = []
            rois[class_name].append({
                'bbox': det['bbox'],
                'confidence': det['confidence']
            })
        
        # Verificar se detectou ambas as ROIs
        detectado = 'day_region' in rois and 'answer_area_enem' in rois
        
        return {
            'sucesso': True,
            'detectado': detectado,
            'rois': rois,
            'total_deteccoes': len(detections)
        }
        
    except Exception as e:
        return {
            'sucesso': False,
            'erro': str(e),
            'detectado': False,
            'rois': {}
        }


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
