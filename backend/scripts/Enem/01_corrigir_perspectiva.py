import cv2
import numpy as np
import os
import matplotlib.pyplot as plt
try:
    from ultralytics import YOLO
    if __name__ == "__main__":
        print("Ultralytics importado com sucesso!")
except ImportError:
    if __name__ == "__main__":
        print("AVISO: Ultralytics não instalado. Instale com 'pip install ultralytics'")
    YOLO = None

# ============================================================================
# CONSTANTES E CONFIGURAÇÃO
# ============================================================================
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")

# Cache global para modelos (evita recarregar a cada chamada)
_modelo_cache = {
    'yolo': None,
    'sam': None,
    'a4': None,
    'carregado': False
}

# ============================================================================
# FUNÇÕES DE API (PARA USO COMO MÓDULO)
# ============================================================================

def carregar_modelos(force_reload=False):
    """
    Carrega os modelos YOLO, SAM2 e A4 customizado.
    Usa cache global para evitar recarregamento.
    
    Args:
        force_reload: Se True, recarrega os modelos mesmo se já estiverem em cache.
    
    Returns:
        dict: Dicionário com os modelos {'yolo': model, 'sam': model, 'a4': model}
    """
    global _modelo_cache
    
    if _modelo_cache['carregado'] and not force_reload:
        return {
            'yolo': _modelo_cache['yolo'],
            'sam': _modelo_cache['sam'],
            'a4': _modelo_cache['a4']
        }
    
    print("[A4_detect] Carregando modelos...")
    
    # 1. Carrega YOLO
    model = None
    if YOLO is not None:
        models_dir = os.path.join(os.path.dirname(__file__), '..', 'models', 'enem')
        model_options = [
            ('yolov8s-doclaynet', os.path.join(models_dir, 'yolov8s-doclaynet.pt')),
            ('yolov8s-document', os.path.join(models_dir, 'yolov8s-document.pt')),
        ]
        
        for model_name, model_path_or_url in model_options:
            try:
                print(f"  Tentando carregar: {model_name}...")
                model = YOLO(model_path_or_url)
                print(f"  [OK] Modelo '{model_name}' carregado!")
                break
            except Exception as e:
                print(f"  [ERRO] Falha: {str(e)[:80]}...")
                continue
    
    _modelo_cache['yolo'] = model
    
    # 2. Carrega modelo A4 customizado
    model_a4 = None
    a4_model_path = os.path.join(os.path.dirname(__file__), '..', 'models', 'enem', 'yolov8s_a4_proporcao_correta.pt')
    if YOLO is not None and os.path.exists(a4_model_path):
        try:
            model_a4 = YOLO(a4_model_path)
            print("  [OK] Modelo A4 customizado carregado!")
        except Exception as e:
            print(f"  [ERRO] Falha modelo A4: {e}")
    
    _modelo_cache['a4'] = model_a4
    
    # 3. Carrega SAM2
    sam_model = None
    try:
        from sam2.sam2_image_predictor import SAM2ImagePredictor
        sam_model = SAM2ImagePredictor.from_pretrained("facebook/sam2-hiera-tiny", device="cpu")
        print("  [OK] SAM2 carregado!")
    except Exception as e:
        print(f"  [ERRO] SAM2 não disponível: {str(e)[:50]}")
    
    _modelo_cache['sam'] = sam_model
    _modelo_cache['carregado'] = True
    
    return {
        'yolo': model,
        'sam': sam_model,
        'a4': model_a4
    }


def processar_imagem_a4(imagem, modelos=None, salvar_em=None):
    """
    Processa uma imagem e retorna o documento A4 com perspectiva corrigida.
    Esta é a função principal para uso como módulo.
    
    Args:
        imagem: np.ndarray (BGR) ou string com caminho do arquivo
        modelos: dict com 'yolo', 'sam', 'a4' (opcional, carrega automaticamente)
        salvar_em: caminho para salvar a imagem corrigida (opcional)
    
    Returns:
        np.ndarray: imagem corrigida em BGR, ou None se falhar
    
    Exemplo:
        >>> from A4_detect import processar_imagem_a4
        >>> img_corrigida = processar_imagem_a4("foto.jpg")
        >>> # ou com modelos pré-carregados:
        >>> modelos = carregar_modelos()
        >>> img_corrigida = processar_imagem_a4("foto.jpg", modelos=modelos)
    """
    # Carrega imagem se for string
    if isinstance(imagem, str):
        imagem = cv2.imread(imagem)
        if imagem is None:
            print(f"[A4_detect] Erro: não foi possível carregar a imagem.")
            return None
    
    # Carrega modelos se não fornecidos
    if modelos is None:
        modelos = carregar_modelos()
    
    # Processa
    try:
        imagem_corrigida, pontos = corrigir_perspectiva(
            imagem,
            model=modelos.get('yolo'),
            sam_model=modelos.get('sam'),
            model_a4=modelos.get('a4')
        )
        
        # Salva se caminho fornecido
        if salvar_em is not None and imagem_corrigida is not None:
            os.makedirs(os.path.dirname(salvar_em) or '.', exist_ok=True)
            cv2.imwrite(salvar_em, imagem_corrigida)
            print(f"[A4_detect] Salvo em: {salvar_em}")
        
        return imagem_corrigida
        
    except Exception as e:
        print(f"[A4_detect] Erro no processamento: {e}")
        import traceback
        traceback.print_exc()
        return None


def get_image_paths(folder_path=None):
    """
    Retorna lista de caminhos de imagens em uma pasta.
    
    Args:
        folder_path: Caminho da pasta (usa padrão se None)
    
    Returns:
        list: Lista de caminhos absolutos das imagens
    """
    if folder_path is None:
        # PONTO CENTRAL DE CONFIGURAÇÃO DE PASTA
        folder_path = r"C:\Users\Do2anjos\Downloads\teste enem"
    
    if not os.path.exists(folder_path):
        print(f"[A4_detect] Pasta não encontrada: {folder_path}")
        return []
    
    valid_exts = ('.jpg', '.jpeg', '.png', '.bmp')
    files = [os.path.join(folder_path, f) for f in os.listdir(folder_path) 
             if f.lower().endswith(valid_exts)]
    
    return sorted(files)


def process_batch(folder_path=None, modelos=None):
    """
    Generator que processa imagens de uma pasta e yield cada imagem corrigida.
    Este é o ponto de entrada para uso pelo cortes_yolo.py.
    
    Args:
        folder_path: Caminho da pasta com imagens (usa padrão se None)
        modelos: dict com modelos pré-carregados (carrega se None)
    
    Yields:
        tuple: (nome_arquivo, imagem_original, imagem_corrigida, pontos_detectados)
    
    Exemplo:
        >>> from A4_detect import process_batch, carregar_modelos
        >>> modelos = carregar_modelos()
        >>> for nome, original, corrigida, pontos in process_batch(modelos=modelos):
        ...     # Fazer algo com a imagem corrigida
        ...     print(f"Processada: {nome}")
    """
    # Carrega modelos se não fornecidos
    if modelos is None:
        modelos = carregar_modelos()
    
    # Obtém lista de imagens
    files = get_image_paths(folder_path)
    
    if not files:
        print("[A4_detect] Nenhuma imagem encontrada.")
        return
    
    print(f"[A4_detect] Processando {len(files)} imagens...")
    
    for i, path in enumerate(files, 1):
        nome = os.path.basename(path)
        print(f"[A4_detect] [{i}/{len(files)}] {nome}...", end=" ")
        
        img_original = cv2.imread(path)
        if img_original is None:
            print("ERRO: não foi possível carregar")
            continue
        
        try:
            imagem_corrigida, pontos = corrigir_perspectiva(
                img_original,
                model=modelos.get('yolo'),
                sam_model=modelos.get('sam'),
                model_a4=modelos.get('a4')
            )
            print("OK")
            
            yield (nome, img_original, imagem_corrigida, pontos)
            
        except Exception as e:
            print(f"ERRO: {e}")
            continue


def detectar_com_hough(imagem):
    """
    Detecta folha A4 portando a lógica exata do projeto C++ (Hough.cpp).
    Autor original: HYPJUDY
    """
    h_img, w_img = imagem.shape[:2]
    
    # 1. Pré-processamento igual ao C++
    # Hough.cpp: rgb2gray, blur(2.0), getGradient
    gray = cv2.cvtColor(imagem, cv2.COLOR_BGR2GRAY)
    
    # C++ usa sigma=2.0. No OpenCV GaussianBlur, ksize deve ser impar.
    # Sigma 2.0 -> ksize ~ 7 ou 9.
    blurred = cv2.GaussianBlur(gray, (7, 7), 2.0)
    
    # Detecção de bordas. O projeto C++ usa um gradiente customizado e votação customizada.
    # Vamos aproximar usando Canny com parâmetros equivalentes ou HoughLines padrão.
    # O C++ faz 'gradients(x, y) > GRAD_THRESHOLD'.
    # Para ser fiel ao resultado, vamos usar Canny bem ajustado que alimenta o Hough.
    edges = cv2.Canny(blurred, 50, 150, apertureSize=3)
    
    # 2. Transformada de Hough
    # Hough.cpp: Accumulator size (360, dist). Step 1 degree.
    lines = cv2.HoughLines(edges, 1, np.pi/180, threshold=80)
    
    if lines is None:
        return None

    # Estrutura equivalente a HoughEdge do C++
    # angle (graus), rho, val (strength/votes)
    # OpenCV retorna (rho, theta). 'votes' não é retornado diretamente pelo cv2.HoughLines normal,
    # mas a lista costuma vir ordenada por votos (decrescente).
    
    hough_edges = []
    
    # Constantes do C++ (Hough.h)
    SCOPE_ANGLE = 20
    SCOPE_RHO = 100
    
    for i, line in enumerate(lines):
        rho, theta = line[0]
        angle_deg = np.degrees(theta) % 360 # Normaliza 0-360
        val = 1000 - i # Simula votos (já que o OpenCV ordena por votos, o primeiro é o mais forte)
        
        # Filtro de Rho=0 do C++
        if abs(rho) < 1.0:
            continue
            
        # Lógica de Clustering do C++ (getHoughEdges)
        is_new_corner = True
        for j in range(len(hough_edges)):
            existing = hough_edges[j]
            
            # Diferença de ângulo e rho para agrupar
            diff_angle = abs(existing['angle'] - angle_deg)
            diff_rho = abs(existing['rho'] - rho)
            
            # Trata periodicidade do ângulo (359 vs 1 grau)
            if diff_angle > 180: diff_angle = 360 - diff_angle
            
            if diff_angle < SCOPE_ANGLE and diff_rho < SCOPE_RHO:
                is_new_corner = False
                # No C++, ele atualiza se o novo for mais forte.
                # Aqui assumimos que os primeiros já são os mais fortes.
                # Mas vamos manter o 'primeiro' que encontramos como o representante do cluster.
                break
        
        if is_new_corner:
            hough_edges.append({'angle': angle_deg, 'rho': rho, 'val': val, 'theta': theta})

    # C++: if hough_edges.size() > 4 ...
    
    # 3. Filtragem Geométrica Avançada (O coração do algoritmo C++)
    # Ordenar por força (val)
    hough_edges.sort(key=lambda x: x['val'], reverse=True)
    
    # Manter top 5
    if len(hough_edges) > 5:
        hough_edges = hough_edges[:5]
        
    if len(hough_edges) < 4:
        return None
        
    # Se temos 5, precisamos remover 1 intruso (geralmente borda da mesa ou ruído)
    if len(hough_edges) == 5:
        # Sort by angle para analisar paralelismo
        edges_by_angle = sorted(hough_edges, key=lambda x: x['angle'])
        
        def calc_diff(e1, e2):
            d = abs(e1['angle'] - e2['angle'])
            if d > 180: d = 360 - d
            return d

        dangles = [
            calc_diff(edges_by_angle[0], edges_by_angle[1]),
            calc_diff(edges_by_angle[1], edges_by_angle[2]),
            calc_diff(edges_by_angle[2], edges_by_angle[3]),
            calc_diff(edges_by_angle[3], edges_by_angle[4])
        ]
        
        DIFF_THRES = 10 # C++ usa 2, mas em Python graus float pode variar. 10 é seguro.
        
        # Lógica C++: Tenta encontrar 2 pares de linhas paralelas
        to_remove = -1
        
        # Caso 1: 0 e 1 paralelos
        if abs(dangles[0] - dangles[1]) > DIFF_THRES: # Diferença significativa
            # Verifica pares
            if dangles[0] < dangles[1]: # 0 e 1 são par
                if dangles[2] < dangles[3]: # 2 e 3 são par -> remove 4
                    to_remove = 4
                else: # 3 e 4 são par -> remove 2
                    to_remove = 2
            else: # 1 e 2 par, 3 e 4 par -> remove 0
                 to_remove = 0
        else:
             # Todos parecem paralelos ou confusos, remove o mais fraco entre os do meio
             # Simplificação para Python: remove o de menor 'val' global
             pass 

        if to_remove != -1:
             # Precisamos remover o elemento correspondente ao índice 'to_remove' de edges_by_angle
             removed_edge = edges_by_angle.pop(to_remove)
             # Atualiza a lista principal
             hough_edges = [e for e in hough_edges if e != removed_edge]
        else:
             # Fallback: remove o mais fraco
             hough_edges.sort(key=lambda x: x['val'], reverse=True)
             hough_edges = hough_edges[:4]
    
    # Agora temos 4 linhas. Computar interseções.
    final_lines = hough_edges[:4]
    cantos = []
    
    # Interseção de cada par (C++ lines 227-270)
    for i in range(len(final_lines)):
        for j in range(i + 1, len(final_lines)):
            l1 = final_lines[i]
            l2 = final_lines[j]
            
            # Ângulo entre elas deve ser próximo de 90 (não paralelas)
            diff = abs(l1['angle'] - l2['angle'])
            if diff > 180: diff = 360 - diff
            
            # Se forem quase paralelas (< 45 graus ou > 135 graus), ignora
            if diff < 20 or diff > 160:
                continue
                
            # Calcular interseção matemática (rho, theta) -> (x, y)
            rho1, theta1 = l1['rho'], l1['theta']
            rho2, theta2 = l2['rho'], l2['theta']
            
            A = np.array([
                [np.cos(theta1), np.sin(theta1)],
                [np.cos(theta2), np.sin(theta2)]
            ])
            b = np.array([[rho1], [rho2]])
            
            try:
                x0, y0 = np.linalg.solve(A, b)
                x, y = float(x0), float(y0)
                
                # Check bounds (C++ margin D=20)
                D = 50 
                if -D < x < w_img + D and -D < y < h_img + D:
                    # Clip
                    x = max(0, min(w_img, x))
                    y = max(0, min(h_img, y))
                    cantos.append([x, y])
            except:
                pass

    if len(cantos) != 4:
        return None

    # 4. Ordenação (OrderCorners C++)
    # O C++ ordena por distância da origem, depois faz swap.
    # Vamos usar nossa ordenação robusta por centroide que já funciona bem.
    cantos = np.array(cantos, dtype=np.float32)
    centroide = np.mean(cantos, axis=0)
    cantos_ordenados = sorted(cantos, key=lambda p: np.arctan2(p[1]-centroide[1], p[0]-centroide[0]))
    
    return np.array(cantos_ordenados, dtype=np.float32).reshape(4, 1, 2)

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

def draw_detection(image, corners, scale=1.0):
    """
    Desenha os cantos detectados e as bordas na imagem.
    Adaptado do script de detecção A4 para melhor visualização.
    """
    result = image.copy()
    
    # Escala a espessura da linha e o raio com base no tamanho da imagem
    h, w = result.shape[:2]
    thickness = max(2, int(min(h, w) / 200))
    radius = max(5, int(min(h, w) / 100))
    font_scale = max(1.0, min(h, w) / 1000)
    
    if corners is not None:
        # Ajusta a escala dos pontos se necessário
        corners_scaled = (corners / scale).astype(int) if scale != 1.0 else corners.astype(int)
        
        # Define os rótulos e cores para cada canto
        # A ordem esperada de 'corrigir_perspectiva' é [TL, TR, BR, BL]
        labels = ["TL", "TR", "BR", "BL"]
        colors = [
            (0, 0, 255),   # Vermelho (TL)
            (255, 0, 0),   # Azul (TR)
            (255, 255, 0), # Ciano (BR)
            (0, 255, 255)  # Amarelo (BL)
        ]
        
        # Desenha as bordas (conectando os pontos 0-1, 1-2, 2-3, 3-0 para o ciclo completo)
        for i in range(4):
            pt1 = tuple(corners_scaled[i % 4])
            pt2 = tuple(corners_scaled[(i + 1) % 4])
            cv2.line(result, pt1, pt2, (0, 255, 0), thickness)
        
        # Desenha os círculos nos cantos e os rótulos
        for i, (corner, color, label) in enumerate(zip(corners_scaled, colors, labels)):
            cv2.circle(result, tuple(corner), radius, color, -1)
            cv2.putText(result, f"{label}({i})", (corner[0] + 10, corner[1] - 10),
                       cv2.FONT_HERSHEY_SIMPLEX, font_scale, color, thickness)
    
    return result

def expandir_margem(pontos, margem_pct, largura_img, altura_img):
    """
    Expande os pontos em todas as direções por uma porcentagem da distância ao centroide.
    Isso adiciona margem de segurança para evitar cortar bordas.
    
    Args:
        pontos: array (4, 2) ou (4, 1, 2) com os 4 cantos
        margem_pct: porcentagem de expansão (ex: 0.03 para 3%)
        largura_img, altura_img: dimensões da imagem para clipping
    
    Returns:
        pontos expandidos no mesmo formato de entrada
    """
    # Normaliza shape
    original_shape = pontos.shape
    if len(pontos.shape) == 3:
        pontos = pontos.reshape(4, 2)
    
    # Calcula centroide
    centroide = np.mean(pontos, axis=0)
    
    # Expande cada ponto afastando do centroide
    pontos_expandidos = []
    for ponto in pontos:
        # Vetor do centroide para o ponto
        vetor = ponto - centroide
        # Expande o vetor
        vetor_expandido = vetor * (1 + margem_pct)
        # Novo ponto
        novo_ponto = centroide + vetor_expandido
        pontos_expandidos.append(novo_ponto)
    
    pontos_expandidos = np.array(pontos_expandidos, dtype=np.float32)
    
    # Clip para não sair da imagem
    pontos_expandidos[:, 0] = np.clip(pontos_expandidos[:, 0], 0, largura_img - 1)
    pontos_expandidos[:, 1] = np.clip(pontos_expandidos[:, 1], 0, altura_img - 1)
    
    # Restaura shape original
    if len(original_shape) == 3:
        pontos_expandidos = pontos_expandidos.reshape(4, 1, 2)
    
    return pontos_expandidos

def regularizar_quadrilatero(pontos, largura_img, altura_img):
    """
    Verifica se os 4 pontos formam um quadrilátero válido (ângulos ~90°).
    Se não formarem, regulariza usando minAreaRect para criar um retângulo perfeito.
    
    Args:
        pontos: array (4, 2) ou (4, 1, 2) com os 4 cantos
        largura_img, altura_img: dimensões da imagem
    
    Returns:
        pontos regularizados, flag indicando se houve correção
    """
    # Normaliza shape
    original_shape = pontos.shape
    if len(pontos.shape) == 3:
        pontos = pontos.reshape(4, 2)
    
    # Calcula ângulos internos do quadrilátero
    def angulo_entre_vetores(v1, v2):
        cos_ang = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-6)
        cos_ang = np.clip(cos_ang, -1, 1)
        return np.degrees(np.arccos(cos_ang))
    
    angulos = []
    for i in range(4):
        p_prev = pontos[(i - 1) % 4]
        p_curr = pontos[i]
        p_next = pontos[(i + 1) % 4]
        
        v1 = p_prev - p_curr
        v2 = p_next - p_curr
        
        angulo = angulo_entre_vetores(v1, v2)
        angulos.append(angulo)
    
    # Verifica se todos os ângulos estão próximos de 90° (tolerância de 20°)
    angulos_validos = all(70 < ang < 110 for ang in angulos)
    
    # Verifica proporção A4 (1:1.414, tolerância ampla: 1.1 a 1.8)
    dists = [np.linalg.norm(pontos[i] - pontos[(i+1)%4]) for i in range(4)]
    lado_curto = min(dists)
    lado_longo = max(dists)
    proporcao = lado_longo / max(lado_curto, 1)
    proporcao_valida = 1.1 < proporcao < 2.0
    
    corrigido = False
    
    if not angulos_validos:
        print(f"  [AVISO] Ângulos irregulares detectados: {[f'{a:.1f}°' for a in angulos]}")
        
        # Usa minAreaRect para criar retângulo perfeito
        contour = pontos.reshape(-1, 1, 2).astype(np.float32)
        rect = cv2.minAreaRect(contour)
        box = cv2.boxPoints(rect)
        pontos = box.astype(np.float32)
        corrigido = True
        print(f"  [OK] Regularizado para retângulo perfeito via minAreaRect")
    
    # Clip para não sair da imagem
    pontos[:, 0] = np.clip(pontos[:, 0], 0, largura_img - 1)
    pontos[:, 1] = np.clip(pontos[:, 1], 0, altura_img - 1)
    
    # Restaura shape original
    if len(original_shape) == 3:
        pontos = pontos.reshape(4, 1, 2)
    
    return pontos, corrigido

def corrigir_perspectiva(imagem, model=None, sam_model=None, model_a4=None):
    """
    Detecta e corrige a perspectiva do documento usando técnicas avançadas.
    Pipeline: YOLO → SAM2 com validação de bbox.
    Se bbox muito grande, usa modelo A4 customizado ou SAM2 automático.
    """
    altura_original, largura_original = imagem.shape[:2]
    area_imagem = largura_original * altura_original
    pontos_documento = None

    # ========== PIPELINE YOLO → SAM2 ==========
    if model_a4 is not None and sam_model is not None:
        try:
            print("  -> Pipeline YOLO A4 → SAM2 iniciado...")
            
            # PASSO 1: YOLO A4 detecta bbox rapidamente
            results = model_a4(imagem, verbose=False, conf=0.3)
            yolo_bbox = None
            bbox_muito_grande = False
            
            if results and len(results) > 0:
                r = results[0]
                
                # Pega bbox com maior confiança
                if r.boxes is not None and len(r.boxes) > 0:
                    best_idx = r.boxes.conf.argmax()
                    box = r.boxes.xyxy[best_idx].cpu().numpy().astype(int)
                    x1, y1, x2, y2 = box
                    bbox_area = (x2 - x1) * (y2 - y1)
                    bbox_pct = bbox_area / area_imagem
                    conf = r.boxes.conf[best_idx].item()
                    
                    print(f"  -> YOLO detectou bbox (conf={conf:.2f}, {bbox_pct*100:.1f}% da imagem): [{x1}, {y1}, {x2}, {y2}]")
                    
                    # VALIDAÇÃO Simples
                    if bbox_pct > 0.95:
                        print(f"  [AVISO] Bbox muito grande ({bbox_pct*100:.1f}% > 95%), SAM2 tentará refinar mesmo assim...")
                        bbox_muito_grande = True
                        
                    yolo_bbox = np.array([x1, y1, x2, y2])
            
            # PASSO 2: SAM2 refina usando bbox como prompt (se bbox válido)
            if yolo_bbox is not None and not bbox_muito_grande:
                try:
                    print("  -> SAM2 refinando com box prompt...")
                    
                    # Converte BGR para RGB (SAM2 espera RGB)
                    imagem_rgb = cv2.cvtColor(imagem, cv2.COLOR_BGR2RGB)
                    
                    # Set image para SAM2
                    sam_model.set_image(imagem_rgb)
                    
                    # Usa bbox como prompt
                    # SAM2 espera box no formato [x1, y1, x2, y2]
                    masks, scores, _ = sam_model.predict(
                        point_coords=None,
                        point_labels=None,
                        box=yolo_bbox[None, :],  # Adiciona dimensão batch
                        multimask_output=False
                    )
                    
                    # Pega a melhor máscara
                    if masks is not None and len(masks) > 0:
                        mask = masks[0]  # Primeira máscara (mais confiante)
                        score = scores[0] if scores is not None else 0
                        print(f"  -> SAM2 gerou máscara (score={score:.3f})")
                        
                        # PASSO 3: Converte máscara para polígono inteligente
                        mask_uint8 = (mask * 255).astype(np.uint8)
                        
                        # Encontra contornos
                        contours, _ = cv2.findContours(
                            mask_uint8, 
                            cv2.RETR_EXTERNAL, 
                            cv2.CHAIN_APPROX_SIMPLE
                        )
                        
                        if contours:
                            # Pega o maior contorno
                            contour = max(contours, key=cv2.contourArea)
                            
                            # Aproxima para polígono de 4 pontos
                            peri = cv2.arcLength(contour, True)
                            epsilon = 0.02 * peri
                            approx = cv2.approxPolyDP(contour, epsilon, True)
                            
                            # Se conseguiu 4 pontos, valida
                            if len(approx) == 4:
                                if validar_retangulo(approx):
                                    pontos_documento = approx.astype(np.float32)
                                    print(f"  [OK] Pipeline YOLO→SAM2 bem-sucedido! 4 pontos detectados.")
                                else:
                                    print("  [AVISO] Polígono não passou na validação, usando minAreaRect...")
                                    rect = cv2.minAreaRect(contour)
                                    box = cv2.boxPoints(rect)
                                    pontos_documento = box.reshape(4, 1, 2).astype(np.float32)
                            else:
                                # Se não conseguiu 4 pontos, usa minAreaRect
                                print(f"  -> Polígono tem {len(approx)} pontos, usando minAreaRect...")
                                rect = cv2.minAreaRect(contour)
                                box = cv2.boxPoints(rect)
                                pontos_documento = box.reshape(4, 1, 2).astype(np.float32)
                                print(f"  [OK] Pipeline YOLO→SAM2 com minAreaRect completo!")
                    else:
                        print("  [AVISO] SAM2 não retornou máscaras")
                        
                except Exception as sam_error:
                    print(f"  [Erro SAM2]: {str(sam_error)[:150]}")
                    import traceback
                    traceback.print_exc()
            
            # Fallback: Se SAM2 falhou mas YOLO detectou, usa bbox do YOLO
            if pontos_documento is None and yolo_bbox is not None:
                x1, y1, x2, y2 = yolo_bbox
                pontos_documento = np.array([
                    [[x1, y1]],
                    [[x2, y1]],
                    [[x2, y2]],
                    [[x1, y2]]
                ], dtype=np.float32)
                print("  [OK] Usando bbox do YOLO (SAM2 falhou)")
            
            # IMPORTANTE: Adiciona margem e regulariza
            if pontos_documento is not None:
                # 1. Expande margem (Apenas 1% para não capturar fundo)
                pontos_documento = expandir_margem(
                    pontos_documento, 
                    margem_pct=0.01,  
                    largura_img=largura_original,
                    altura_img=altura_original
                )
                print("  -> Margem de 1% adicionada")
                
                # 2. Regulariza quadrilátero (verifica ângulos ~90°)
                pontos_documento, foi_corrigido = regularizar_quadrilatero(
                    pontos_documento,
                    largura_img=largura_original,
                    altura_img=altura_original
                )
            
            
        except Exception as e:
            print(f"  [Erro Pipeline]: {e}")
            import traceback
            traceback.print_exc()

    # --- MÉTODO 0: YOLO Document Detection (FALLBACK 1) ---
    if pontos_documento is None and model is not None:
        try:
            # Roda inferência com confiança mínima
            results = model(imagem, verbose=False, conf=0.3)
            
            if results and len(results) > 0:
                r = results[0]
                
                # Estratégia 1: Verificar OBB (Oriented Bounding Box) - 4 pontos
                if hasattr(r, 'obb') and r.obb is not None and len(r.obb) > 0:
                    # Pega o OBB com maior confiança
                    obb_pts = r.obb.xyxyxyxy[0].cpu().numpy().reshape(4, 2)
                    print("  (Usando Método 0: YOLO OBB)")
                    pontos_documento = obb_pts.reshape(4, 1, 2).astype(np.float32)
                
                # Estratégia 2: Verificar Masks (Segmentação)
                elif r.masks is not None and len(r.masks.data) > 0:
                    melhor_mascara = None
                    melhor_area = 0
                    
                    for idx, seg in enumerate(r.masks.xy):
                        if len(seg) == 0: continue
                        c = seg.astype(np.int32)
                        area = cv2.contourArea(c)
                        
                        if area > melhor_area:
                            peri = cv2.arcLength(c, True)
                            epsilon = 0.02 * peri
                            approx = cv2.approxPolyDP(c, epsilon, True)
                            
                            if len(approx) == 4 and validar_retangulo(approx):
                                melhor_area = area
                                melhor_mascara = approx
                    
                    if melhor_mascara is not None:
                        print("  (Usando Método 0: YOLO Segmentation)")
                        pontos_documento = melhor_mascara.astype(np.float32)
                
                # Estratégia 3: BBox simples (xyxy) - converte para 4 pontos
                elif r.boxes is not None and len(r.boxes) > 0:
                    # Pega a detecção com maior confiança
                    best_idx = r.boxes.conf.argmax()
                    box = r.boxes.xyxy[best_idx].cpu().numpy().astype(int)
                    x1, y1, x2, y2 = box
                    
                    # Converte bbox para 4 pontos
                    bbox_pts = np.array([
                        [[x1, y1]],
                        [[x2, y1]],
                        [[x2, y2]],
                        [[x1, y2]]
                    ], dtype=np.float32)
                    
                    print(f"  (Usando Método 0: YOLO BBox, conf={r.boxes.conf[best_idx]:.2f})")
                    pontos_documento = bbox_pts
        except Exception as e:
            print(f"  [Erro YOLO]: {e}")

    # --- MÉTODO HOUGH: Transformada de Hough (baseado no HYPJUDY repo) ---
    if pontos_documento is None:
        try:
            hough_result = detectar_com_hough(imagem)
            if hough_result is not None:
                pontos_documento = hough_result
                print("  (Usando Método Hough: Transformada de Hough Portada)")
        except Exception as e:
            print(f"  [Erro Hough]: {e}")

    # Se encontrou algo, pula os métodos alternativos
    # Define escala_processamento para o caso do YOLO/Hough
    if pontos_documento is not None:
        escala_processamento = 1.0  # Já retorna coordenadas na escala original
    else:
        # Redimensionar para processamento mais rápido (mantém proporção)
        escala_processamento = 1000.0 / max(largura_original, altura_original)
        if escala_processamento < 1.0:
            largura_proc = int(largura_original * escala_processamento)
            altura_proc = int(altura_original * escala_processamento)
            imagem_proc = cv2.resize(imagem, (largura_proc, altura_proc), interpolation=cv2.INTER_AREA)
        else:
            imagem_proc = imagem.copy()
            escala_processamento = 1.0
        
        altura_proc, largura_proc = imagem_proc.shape[:2]
        
        # Converter para escala de cinza
        cinza = cv2.cvtColor(imagem_proc, cv2.COLOR_BGR2GRAY)
        
        # Aplicar equalização de histograma CLAHE para melhorar contraste
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        cinza = clahe.apply(cinza)
        
        # Aplicar desfoque gaussiano
        suavizada = cv2.GaussianBlur(cinza, (5, 5), 0)
        
        # Aplicar filtro bilateral
        suavizada = cv2.bilateralFilter(suavizada, 9, 75, 75)
        
        # MÉTODO 1: Detecção usando Canny adaptativo melhorado
        mediana = np.median(suavizada)
        sigma = 0.33
        limiar_baixo = int(max(0, (1.0 - sigma) * mediana))
        limiar_alto = int(min(255, (1.0 + sigma) * mediana))
        
        if limiar_baixo < 50: limiar_baixo = 50
        if limiar_alto < 100: limiar_alto = 100
        
        bordas = cv2.Canny(suavizada, limiar_baixo, limiar_alto, apertureSize=3, L2gradient=True)
        
        # Operações morfológicas
        kernel = np.ones((3, 3), np.uint8)
        bordas = cv2.dilate(bordas, kernel, iterations=3)
        bordas = cv2.morphologyEx(bordas, cv2.MORPH_CLOSE, kernel, iterations=2)
        
        contornos, _ = cv2.findContours(bordas, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        area_minima = (largura_proc * altura_proc) * 0.15
        contornos = [c for c in contornos if cv2.contourArea(c) > area_minima]
        contornos = sorted(contornos, key=cv2.contourArea, reverse=True)
        
        melhor_score = 0
        
        for contorno in contornos[:15]:
            perimetro = cv2.arcLength(contorno, True)
            if perimetro == 0: continue
            
            epsilon = 0.02 * perimetro
            aproximacao = cv2.approxPolyDP(contorno, epsilon, True)
            
            if len(aproximacao) == 4:
                area_contorno = cv2.contourArea(aproximacao)
                if area_contorno > area_minima:
                    if validar_retangulo(aproximacao):
                        area_bbox = cv2.boundingRect(aproximacao)[2] * cv2.boundingRect(aproximacao)[3]
                        score = area_contorno / (area_bbox + 1)
                        if score > melhor_score:
                            melhor_score = score
                            pontos_documento = aproximacao
        
        # MÉTODO 2: Threshold adaptativo
        if pontos_documento is None:
            for block_size in [11, 15, 21]:
                thresh = cv2.adaptiveThreshold(suavizada, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                              cv2.THRESH_BINARY_INV, block_size, 2)
                kernel = np.ones((3, 3), np.uint8)
                thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=3)
                thresh = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel, iterations=1)
                
                contornos_alt, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                
                if len(contornos_alt) > 0:
                    contornos_alt = [c for c in contornos_alt if cv2.contourArea(c) > area_minima]
                    contornos_alt = sorted(contornos_alt, key=cv2.contourArea, reverse=True)
                    
                    for contorno in contornos_alt[:10]:
                        perimetro = cv2.arcLength(contorno, True)
                        if perimetro == 0: continue
                        epsilon = 0.02 * perimetro
                        aproximacao = cv2.approxPolyDP(contorno, epsilon, True)
                        
                        if len(aproximacao) == 4 and validar_retangulo(aproximacao):
                            pontos_documento = aproximacao
                            break
                    if pontos_documento is not None: break
        
        # MÉTODO 3: Bounding box do maior contorno (Agora robusto com minAreaRect)
        if pontos_documento is None:
            if len(contornos) > 0:
                maior_contorno = contornos[0]
                rect = cv2.minAreaRect(maior_contorno)
                box = cv2.boxPoints(rect)
                pontos_documento = box.reshape(4, 1, 2).astype(np.float32)
                print("  (Usando Método 3: Maior Contorno Rotacionado)")

        # MÉTODO 4: Bordas da imagem
        if pontos_documento is None:
            margem = min(largura_proc, altura_proc) * 0.03
            pontos_documento = np.array([[[margem, margem]], [[largura_proc - margem, margem]], [[largura_proc - margem, altura_proc - margem]], [[margem, altura_proc - margem]]], dtype=np.float32)
            print("  (Usando Método 4: Fallback Bordas)")

    
    # Ajustar escala de volta
    pontos_documento = pontos_documento.astype(np.float32) / escala_processamento
    pontos = pontos_documento.reshape(4, 2).astype(np.float32)
    
    # --- ORDENAÇÃO MATEMÁTICA E WARP PERSPECTIVE ROBUSTO ---
    # 1. Encontrar o centroide e ordenar no sentido horário
    centroide = np.mean(pontos, axis=0)
    
    def get_angle(p):
        return np.arctan2(p[1] - centroide[1], p[0] - centroide[0])
    
    pontos_ordenados = sorted(pontos, key=get_angle)
    pontos_ordenados = np.array(pontos_ordenados, dtype="float32")
    
    # 2. Calcular distâncias dos 4 lados
    dists = [np.linalg.norm(pontos_ordenados[i] - pontos_ordenados[(i+1)%4]) for i in range(4)]
    
    # 3. Forçar orientação Retrato (A4 em pé)
    # Queremos que o lado 0 (TL->TR) seja o Lado Curto.
    if dists[0] > dists[1]:
        # O lado 0 é longo, então rotacionamos o array de pontos em -1
        # Isso faz o lado curto virar o lado 0
        pontos_ordenados = np.roll(pontos_ordenados, -1, axis=0)
        dists = [np.linalg.norm(pontos_ordenados[i] - pontos_ordenados[(i+1)%4]) for i in range(4)]
    
    # Agora dists[0] e dists[2] são lados curtos (Largura)
    largura_media = (dists[0] + dists[2]) / 2.0
    
    # FORÇAR PROPORÇÃO EXATA DO A4 (1 : 1.4142)
    # Isso evita distorção (ex: bolinhas ovais) que quebra o OCR e o leitor de gabarito
    maxWidth = int(largura_media)
    maxHeight = int(maxWidth * 1.4142)
    
    # 4. Prevenir documento de cabeça para baixo (Upside Down)
    # Verifica se os dois pontos superiores (0 e 1) estão fisicamente abaixo dos inferiores (2 e 3)
    if (pontos_ordenados[0][1] + pontos_ordenados[1][1]) > (pontos_ordenados[2][1] + pontos_ordenados[3][1]):
        # Está de cabeça para baixo! Rotaciona 180 graus.
        pontos_ordenados = np.roll(pontos_ordenados, 2, axis=0)
    
    # 5. Aplicar o Warp Perspective exato
    pontos_destino = np.array([
        [0, 0],
        [maxWidth - 1, 0],
        [maxWidth - 1, maxHeight - 1],
        [0, maxHeight - 1]
    ], dtype=np.float32)
    
    matriz_transformacao = cv2.getPerspectiveTransform(pontos_ordenados, pontos_destino)
    imagem_corrigida = cv2.warpPerspective(imagem, matriz_transformacao, (maxWidth, maxHeight))
    
    return imagem_corrigida, pontos_ordenados

if __name__ == "__main__":
    # Interface CLI para integração com Node.js (rota /etapa-perspectiva)
    import sys
    import json
    import os
    
    # Se rodar sem argumentos, avisa o uso
    if len(sys.argv) < 3:
        print(json.dumps({
            'sucesso': False, 
            'erro': 'Uso: python 01_corrigir_perspectiva.py <caminho_entrada> <caminho_saida>'
        }))
        sys.exit(1)
        
    caminho_entrada = sys.argv[1]
    caminho_saida = sys.argv[2]
    
    if not os.path.exists(caminho_entrada):
        print(json.dumps({
            'sucesso': False, 
            'erro': f'Arquivo não encontrado: {caminho_entrada}'
        }))
        sys.exit(1)
        
    try:
        # 1. Carrega os modelos globais
        modelos = carregar_modelos()
        
        # 2. Carrega imagem
        img = cv2.imread(caminho_entrada)
        if img is None:
            raise ValueError("Não foi possível decodificar a imagem.")
            
        # 3. Processa a correção de perspectiva
        img_corrigida, pontos = corrigir_perspectiva(
            img, 
            modelos.get('yolo'), 
            modelos.get('sam'), 
            modelos.get('a4')
        )
        
        # 4. Salva o resultado
        if img_corrigida is not None:
            cv2.imwrite(caminho_saida, img_corrigida)
            
            # Retorna o JSON esperado pelo Node
            print(json.dumps({
                'sucesso': True,
                'mensagem': 'Perspectiva corrigida com sucesso',
                'caminho_saida': caminho_saida,
                'pontos': pontos.tolist() if pontos is not None else None
            }))
        else:
            # Fallback se falhou
            cv2.imwrite(caminho_saida, img)
            print(json.dumps({
                'sucesso': True, 
                'aviso': 'Correção falhou. Imagem original copiada.',
                'caminho_saida': caminho_saida,
                'pontos': None
            }))
            
    except Exception as e:
        print(json.dumps({
            'sucesso': False,
            'erro': f'Erro interno: {str(e)}'
        }))
        sys.exit(1)


