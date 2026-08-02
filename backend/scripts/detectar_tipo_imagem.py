import cv2
import numpy as np
import sys
import json
import os
from pathlib import Path

def verificar_enem_com_yolo(caminho_imagem):
    """
    Verifica se a imagem é uma folha ENEM usando detector YOLO
    
    Returns:
        tuple: (is_enem, tipo_enem)
        - is_enem: bool indicando se é folha ENEM
        - tipo_enem: "enem_completo" se detectar day_region + answer_area,
                     "enem_recorte" se detectar apenas answer_area,
                     None caso contrário
    """
    try:
        script_dir = Path(__file__).parent
        detector_path = script_dir / "Enem" / "02_detectar_rois.py"
        
        if not detector_path.exists():
            return False, None
        
        import importlib.util
        spec = importlib.util.spec_from_file_location("detectar_rois", detector_path)
        detector_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(detector_module)
        
        resultado = detector_module.detect_rois(caminho_imagem)
        
        if not resultado['sucesso']:
            return False, None
        
        rois = resultado.get('rois', {})
        tem_day_region = 'day_region' in rois and len(rois['day_region']) > 0
        tem_answer_area = 'answer_area_enem' in rois and len(rois['answer_area_enem']) > 0
        
        if tem_day_region and tem_answer_area:
            return True, "enem_completo"
        elif tem_answer_area and not tem_day_region:
            # Sem day_region, pode ser falso positivo em gabarito UEA.
            # Só classificar como enem_recorte se a confiança for alta (>0.5)
            answer_confs = [d.get('confidence', 0) for d in rois['answer_area_enem']]
            max_conf = max(answer_confs) if answer_confs else 0
            if max_conf > 0.5:
                return True, "enem_recorte"
            else:
                print(f"[DETECTAR-TIPO] answer_area_enem detectada mas conf baixa ({max_conf:.2f}), ignorando (possível UEA)", file=sys.stderr)
                return False, None
        else:
            return False, None
            
    except Exception as e:
        print(f"[DETECTAR-TIPO] Erro ao verificar ENEM com YOLO: {e}", file=sys.stderr)
        return False, None


def carregar_imagem(caminho):
    """
    Carrega uma imagem lidando com caracteres especiais no caminho.
    """
    try:
        with open(caminho, 'rb') as f:
            dados = bytearray(f.read())
        nparr = np.asarray(dados, dtype=np.uint8)
        imagem = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if imagem is not None:
            return imagem
    except Exception as e:
        pass
    
    imagem = cv2.imread(caminho)
    return imagem

def detectar_tipo_imagem(caminho_imagem):
    """
    Detecta se a imagem já está processada (corrigida em perspectiva) ou se precisa de processamento.
    Também detecta se é uma folha ENEM (completa ou recorte).
    
    Retorna:
        "enem_completo": folha ENEM completa detectada (day_region + answer_area_enem)
        "enem_recorte": apenas answer_area_enem detectada
        "processada": se a imagem já está retificada e pronta para detecção
        "original": se a imagem precisa de correção de perspectiva
    """
    
    # PRIORIDADE 1: Verificar se é folha ENEM usando YOLO
    is_enem, tipo_enem = verificar_enem_com_yolo(caminho_imagem)
    if is_enem and tipo_enem:
        return tipo_enem
    
    # PRIORIDADE 2: Continuar com detecção tradicional se não for ENEM
    # Carregar imagem
    imagem = carregar_imagem(caminho_imagem)
    if imagem is None:
        raise ValueError(f"Erro ao carregar a imagem: {caminho_imagem}")

    
    altura, largura = imagem.shape[:2]
    
    # Redimensionar para análise mais rápida
    escala = 800.0 / max(largura, altura)
    if escala < 1.0:
        largura_proc = int(largura * escala)
        altura_proc = int(altura * escala)
        imagem_proc = cv2.resize(imagem, (largura_proc, altura_proc), interpolation=cv2.INTER_AREA)
    else:
        imagem_proc = imagem.copy()
        largura_proc = largura
        altura_proc = altura
        escala = 1.0
    
    # Converter para escala de cinza
    cinza = cv2.cvtColor(imagem_proc, cv2.COLOR_BGR2GRAY)
    
    # Aplicar equalização de histograma para melhorar contraste
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    cinza = clahe.apply(cinza)
    
    # Aplicar desfoque
    suavizada = cv2.GaussianBlur(cinza, (5, 5), 0)
    
    # Detectar bordas
    mediana = np.median(suavizada)
    sigma = 0.33
    limiar_baixo = int(max(0, (1.0 - sigma) * mediana))
    limiar_alto = int(min(255, (1.0 + sigma) * mediana))
    
    if limiar_baixo < 50:
        limiar_baixo = 50
    if limiar_alto < 100:
        limiar_alto = 100
    
    bordas = cv2.Canny(suavizada, limiar_baixo, limiar_alto, apertureSize=3, L2gradient=True)
    
    # Operações morfológicas
    kernel = np.ones((3, 3), np.uint8)
    bordas = cv2.dilate(bordas, kernel, iterations=2)
    bordas = cv2.morphologyEx(bordas, cv2.MORPH_CLOSE, kernel, iterations=2)
    
    # Encontrar contornos
    contornos, _ = cv2.findContours(bordas, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    # Filtrar contornos grandes (potenciais folhas)
    area_minima = (largura_proc * altura_proc) * 0.15
    contornos_grandes = [c for c in contornos if cv2.contourArea(c) > area_minima]
    contornos_grandes = sorted(contornos_grandes, key=cv2.contourArea, reverse=True)
    
    # Verificar proporção da imagem (documentos retificados tendem a ter proporções mais regulares)
    proporcao = max(largura_proc, altura_proc) / min(largura_proc, altura_proc)
    
    # Se não encontrou contornos grandes, mas a imagem é quase quadrada, pode ser um grid já recortado
    if len(contornos_grandes) == 0:
        if proporcao <= 1.2:
            return "processada"
        return "original"
    
    # Analisar os maiores contornos
    indicadores_processada = 0
    indicadores_original = 0
    
    for contorno in contornos_grandes[:5]:  # Analisar os 5 maiores contornos
        perimetro = cv2.arcLength(contorno, True)
        if perimetro == 0:
            continue
        
        # Aproximar contorno
        epsilon = 0.02 * perimetro
        aproximacao = cv2.approxPolyDP(contorno, epsilon, True)
        
        # Se tiver 4 pontos, é um retângulo
        if len(aproximacao) == 4:
            # Verificar quão retangular é (quanto mais próximo de 1, mais retangular)
            area_contorno = cv2.contourArea(aproximacao)
            x, y, w, h = cv2.boundingRect(aproximacao)
            area_bbox = w * h
            
            if area_bbox > 0:
                razao_area = area_contorno / area_bbox
                
                # Se a razão for muito alta (>0.95), provavelmente está retificado
                if razao_area > 0.95:
                    indicadores_processada += 1
                else:
                    # Se não for muito retangular, provavelmente precisa de correção
                    indicadores_original += 1
                
                # Verificar ângulos dos cantos
                pontos = aproximacao.reshape(4, 2)
                angulos_validos = 0
                for i in range(4):
                    p1 = pontos[i]
                    p2 = pontos[(i + 1) % 4]
                    p3 = pontos[(i + 2) % 4]
                    
                    v1 = p2 - p1
                    v2 = p3 - p2
                    cos_angulo = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-6)
                    cos_angulo = np.clip(cos_angulo, -1, 1)
                    angulo = np.arccos(cos_angulo) * 180 / np.pi
                    
                    # Ângulo próximo de 90 graus indica retificação
                    if 85 <= angulo <= 95:
                        angulos_validos += 1
                
                # Se 3 ou 4 ângulos estão próximos de 90°, está processada
                if angulos_validos >= 3:
                    indicadores_processada += 1
                else:
                    indicadores_original += 1
    
    # Verificar proporção da imagem (documentos retificados tendem a ter proporções mais regulares)
    proporcao = max(largura_proc, altura_proc) / min(largura_proc, altura_proc)
    
    # Documentos retificados geralmente têm proporção entre 1.3 e 2.0 (A4, por exemplo)
    if 1.3 <= proporcao <= 2.0:
        indicadores_processada += 1
    # Grids recortados manualmente (apenas a tabela de respostas) costumam ser quase quadrados
    elif proporcao <= 1.2:
        indicadores_processada += 2  # Forte indício de que é um grid recortado
    elif proporcao > 2.5:
        indicadores_original += 1
    
    # Decisão baseada nos indicadores
    # Ser conservador: só classificar como "processada" se houver evidências CLARAS
    # Preferir errar para o lado de "original" (usar script completo) que é mais seguro
    # Precisa de pelo menos 3 indicadores de processada E mais que os indicadores originais
    if proporcao <= 1.2 and indicadores_processada >= 2:
        return "processada"
    elif indicadores_processada >= 3 and indicadores_processada > (indicadores_original * 1.5):
        return "processada"
    else:
        # Por padrão, assume que precisa de processamento (mais seguro)
        return "original"

if __name__ == "__main__":
    import subprocess
    import re
    try:
        if len(sys.argv) < 2:
            print(json.dumps({
                "sucesso": False,
                "erro": "Caminho da imagem não fornecido. Uso: python detectar_tipo_imagem.py <caminho_imagem>"
            }))
            sys.exit(1)
        
        caminho_imagem = sys.argv[1]
        
        if not os.path.exists(caminho_imagem):
            print(json.dumps({
                "sucesso": False,
                "erro": f"Arquivo não encontrado: {caminho_imagem}"
            }))
            sys.exit(1)
        
        tipo = detectar_tipo_imagem(caminho_imagem)
        
        # Se a flag --only-detect for passada, retorna apenas o tipo detectado
        if "--only-detect" in sys.argv:
            print(json.dumps({
                "sucesso": True,
                "tipo": tipo,
                "requer_processamento": tipo == "original"
            }, ensure_ascii=False))
            sys.exit(0)
            
        script_dir = Path(__file__).resolve().parent
        
        if tipo in ["enem_completo", "enem_recorte"]:
            script_alvo = script_dir / "Enem" / "05_processar_respostas.py"
        elif tipo == "processada":
            script_alvo = script_dir / "Scripts UEA" / "processar_respostas_imagem_processadas.py"
        else:
            script_alvo = script_dir / "Scripts UEA" / "processar_respostas_Imagem_original.py"
            
        if not script_alvo.exists():
            print(json.dumps({
                "sucesso": False,
                "erro": f"Script alvo não encontrado: {script_alvo}"
            }))
            sys.exit(1)
            
        python_cmd = sys.executable
        resultado = subprocess.run([python_cmd, str(script_alvo), caminho_imagem], capture_output=True, text=True)
        
        # Injetar o tipo da imagem no JSON retornado
        saida = resultado.stdout
        json_match = re.search(r'\{[\s\S]*\}', saida)
        if json_match:
            try:
                dados = json.loads(json_match.group(0))
                dados['tipo_imagem_detectado'] = tipo
                dados['script_utilizado'] = script_alvo.name
                
                # Substituir o JSON original pelo modificado na saída
                saida_modificada = saida[:json_match.start()] + json.dumps(dados, ensure_ascii=False) + saida[json_match.end():]
                print(saida_modificada)
            except json.JSONDecodeError:
                print(saida)
        else:
            print(saida)
            
        if resultado.stderr:
            print(resultado.stderr, file=sys.stderr)
            
        sys.exit(resultado.returncode)
        
    except Exception as e:
        print(json.dumps({
            "sucesso": False,
            "erro": str(e)
        }))
        sys.exit(1)

