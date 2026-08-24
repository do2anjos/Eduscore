    let alunos = [];
    let gabaritos = [];
    let alunoSelecionado = null;
    let gabaritoSelecionado = null;
    let questoesGabarito = [];
    let respostasAluno = {}; // { questao_id: resposta }
    let currentStep = 1;

    // Carregar dados ao inicializar
    document.addEventListener('DOMContentLoaded', async () => {
      await loadUserData();
      await carregarAlunos();
      await carregarGabaritos();

      // Detectar se é mobile e mostrar botão de camera
      detectarDispositivo();
    });

    function detectarDispositivo() {
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      if (isMobile) {
        // MOBILE: Forçar uso da camera YOLO
        console.log('[MOBILE] Dispositivo móvel detectado - Forçando camera YOLO');

        // Quando o Step 2 ficar ativo, iniciar camera automaticamente
        const observador = new MutationObserver((mutations) => {
          const step2 = document.getElementById('step2');
          if (step2 && step2.classList.contains('active')) {
            // Step 2 ativo no mobile - iniciar camera automaticamente
            setTimeout(() => {
              iniciarCameraMobile();
            }, 300);
            observador.disconnect();
          }
        });

        // Observar mudanças no step2
        const step2 = document.getElementById('step2');
        if (step2) {
          observador.observe(step2, { attributes: true, attributeFilter: ['class'] });
        }
      } else {
        // DESKTOP: Manter upload tradicional (nada a fazer)
        console.log('[DESKTOP] Dispositivo desktop - Upload tradicional');
      }
    }

    // Variáveis globais para camera
    let cameraStream = null;
    let detectionInterval = null;
    let cameraCanvas = null;
    let cameraCtx = null;
    let cameraVideo = null;
    let track = null; // Track de video para controlar flash
    let lastROIs = {}; // Guardar últimas detecções para o render loop
    let isRenderLoopRunning = false;

    // Sistema de Tracking e Suavização de Bounding Boxes
    const boxTracker = {
      // Estado das boxes rastreadas: { tipo: { smoothed: {x,y,w,h}, lastSeen: timestamp, confidence: number } }
      tracked: {},

      // Configurações
      alpha: 0.7, // Fator de suavização (0-1): maior = mais suave, menor = mais responsivo
      maxAge: 1500, // Tempo máximo (ms) para manter box quando não detectada
      minIOU: 0.3, // IOU mínimo para associar detecção a box existente

      /**
       * Calcula Intersection over Union (IOU) entre duas boxes
       */
      calculateIOU(box1, box2) {
        const x1 = Math.max(box1.x, box2.x);
        const y1 = Math.max(box1.y, box2.y);
        const x2 = Math.min(box1.x + box1.w, box2.x + box2.w);
        const y2 = Math.min(box1.y + box1.h, box2.y + box2.h);

        if (x2 <= x1 || y2 <= y1) return 0;

        const intersection = (x2 - x1) * (y2 - y1);
        const area1 = box1.w * box1.h;
        const area2 = box2.w * box2.h;
        const union = area1 + area2 - intersection;

        return union > 0 ? intersection / union : 0;
      },

      /**
       * Atualiza boxes rastreadas com novas detecções
       */
      update(deteccoes) {
        const now = Date.now();
        const newTracked = {};

        // Processar cada tipo de detecção (day_region, answer_area_enem)
        Object.entries(deteccoes).forEach(([tipo, lista]) => {
          if (!lista || lista.length === 0) {
            // Manter box existente se ainda estiver dentro do maxAge
            if (this.tracked[tipo] && (now - this.tracked[tipo].lastSeen) < this.maxAge) {
              newTracked[tipo] = this.tracked[tipo];
            }
            return;
          }

          // Pegar a primeira detecção (maior confiança geralmente vem primeiro)
          const deteccao = lista[0];

          // Converter para coordenadas normalizadas se necessário
          let x, y, w, h;
          if (deteccao.bbox_norm) {
            const [nX, nY, nW, nH] = deteccao.bbox_norm;
            // Assumir dimensões do vídeo para cálculo (será ajustado no desenho)
            x = nX;
            y = nY;
            w = nW;
            h = nH;
          } else {
            const [px, py, pw, ph] = deteccao.bbox;
            // Normalizar (assumir dimensões do vídeo)
            const videoW = cameraVideo ? cameraVideo.videoWidth : 1080;
            const videoH = cameraVideo ? cameraVideo.videoHeight : 1920;
            x = px / videoW;
            y = py / videoH;
            w = pw / videoW;
            h = ph / videoH;
          }

          const newBox = { x, y, w, h };

          // Verificar se há box existente para este tipo
          if (this.tracked[tipo]) {
            const existingBox = this.tracked[tipo].smoothed;
            const iou = this.calculateIOU(existingBox, newBox);

            if (iou >= this.minIOU) {
              // Associar: aplicar suavização exponencial
              newTracked[tipo] = {
                smoothed: {
                  x: this.alpha * existingBox.x + (1 - this.alpha) * newBox.x,
                  y: this.alpha * existingBox.y + (1 - this.alpha) * newBox.y,
                  w: this.alpha * existingBox.w + (1 - this.alpha) * newBox.w,
                  h: this.alpha * existingBox.h + (1 - this.alpha) * newBox.h
                },
                lastSeen: now,
                confidence: deteccao.confidence || 0.8,
                raw: deteccao // Guardar detecção original para referência
              };
            } else {
              // Nova detecção (IOU baixo) - substituir
              newTracked[tipo] = {
                smoothed: newBox,
                lastSeen: now,
                confidence: deteccao.confidence || 0.8,
                raw: deteccao
              };
            }
          } else {
            // Primeira detecção deste tipo
            newTracked[tipo] = {
              smoothed: newBox,
              lastSeen: now,
              confidence: deteccao.confidence || 0.8,
              raw: deteccao
            };
          }
        });

        // Remover boxes muito antigas
        Object.keys(this.tracked).forEach(tipo => {
          if (!newTracked[tipo] && (now - this.tracked[tipo].lastSeen) >= this.maxAge) {
            // Box expirada - não incluir
          } else if (!newTracked[tipo]) {
            // Manter temporariamente
            newTracked[tipo] = this.tracked[tipo];
          }
        });

        this.tracked = newTracked;
        return this.tracked;
      },

      /**
       * Limpa todas as boxes rastreadas
       */
      reset() {
        this.tracked = {};
      },

      /**
       * Retorna boxes suavizadas no formato esperado pelo desenho
       */
      getSmoothedROIs() {
        const now = Date.now();
        const rois = {};
        Object.entries(this.tracked).forEach(([tipo, data]) => {
          if (!rois[tipo]) rois[tipo] = [];

          // Calcular idade da detecção (quanto tempo desde última detecção)
          const age = now - data.lastSeen;
          const ageRatio = Math.min(age / this.maxAge, 1.0); // 0 = nova, 1 = antiga

          rois[tipo].push({
            bbox_norm: [data.smoothed.x, data.smoothed.y, data.smoothed.w, data.smoothed.h],
            confidence: data.confidence,
            raw: data.raw,
            age: age, // Idade em ms
            ageRatio: ageRatio // 0-1, útil para ajustar opacidade
          });
        });
        return rois;
      }
    };

    async function iniciarCameraMobile() {
      try {
        showLoading('Iniciando camera...');

        // Mostrar interface
        const interface = document.getElementById('cameraInterface');
        interface.style.display = 'flex';

        cameraVideo = document.getElementById('videoPreview');
        const canvasOverlay = document.getElementById('canvasOverlay');
        cameraCanvas = canvasOverlay; // Assign to global
        cameraCtx = canvasOverlay.getContext('2d'); // Assign to global

        // Configurar acesso à camera (Tentar forçar ALTA RESOLUÇÃO)
        // Nota: Em mobile retrato, width/height podem estar invertidos.
        const constraints = {
          video: {
            facingMode: 'environment', // Camera traseira
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 },
            // Tentar configurações avançadas se suportado
            advanced: [{ focusMode: "continuous" }]
          }
        };

        try {
          cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (resErr) {
          console.warn('[CAMERA] Falha ao obter Full HD, tentando padrão...', resErr);
          // Fallback para qualquer resolução
          cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
          });
        }

        cameraVideo.srcObject = cameraStream;

        // Guardar track para flash
        track = cameraStream.getVideoTracks()[0];
        console.log('[CAMERA] Track obtido:', track);

        // Lógica de Flash melhorada (exibir botão se houver suspeita de suporte)
        const btnFlash = document.getElementById('btnFlash');
        btnFlash.style.display = 'none'; // Reset inicial

        try {
          const capabilities = track.getCapabilities ? track.getCapabilities() : {};
          console.log('[CAMERA] Capabilities:', capabilities);

          // Se tiver suporte explícito a torch OU se não conseguirmos ler capabilities (iOS/alguns Androids)
          // assumimos que pode ter flash e deixamos o usuário tentar.
          const suportaTorch = capabilities.torch || 'torch' in capabilities || !track.getCapabilities;

          if (suportaTorch) {
            console.log('[CAMERA] Possível suporte a Flash. Mostrando botão.');
            btnFlash.style.display = 'block';
          }
        } catch (capErr) {
          console.error('[CAMERA] Erro ao verificar capabilities, mas tentando mostrar botão:', capErr);
          btnFlash.style.display = 'block'; // Tentar mostrar mesmo com erro
        }

        // Aguardar video carregar
        await new Promise(resolve => {
          cameraVideo.onloadedmetadata = () => {
            console.log('[CAMERA] Video carregado. Dimensões REAIS:', cameraVideo.videoWidth, 'x', cameraVideo.videoHeight);

            // Iniciar o loop de renderização manual para evitar tela preta
            if (!isRenderLoopRunning) {
              isRenderLoopRunning = true;
              renderCanvasFrame();
            }

            resolve();
          };
        });

        hideLoading();

        // Ajustar canvas overlay
        canvasOverlay.width = cameraVideo.videoWidth;
        canvasOverlay.height = cameraVideo.videoHeight;

        // Iniciar loop de detecção
        iniciarLiveDetection();

      } catch (error) {
        console.error('Erro ao acessar camera:', error);
        hideLoading();
        document.getElementById('cameraInterface').style.display = 'none';

        if (error.name === 'NotAllowedError') {
          showToast('Precisamos de permissão para acessar a câmera.', 'warning');
        } else {
          showToast('Não foi possível iniciar a câmera. Verifique permissões.', 'error');
        }
        fecharCameraMobile();
      }
    }

    let isFlashOn = false;
    async function toggleFlash() {
      if (!track) return;

      try {
        isFlashOn = !isFlashOn;

        // Tentar método padrão
        await track.applyConstraints({
          advanced: [{ torch: isFlashOn }]
        });

        // Atualizar ícone
        const btn = document.getElementById('btnFlash');
        btn.style.backgroundColor = isFlashOn ? 'rgba(255, 215, 0, 0.8)' : 'rgba(0,0,0,0.5)';
        btn.style.color = isFlashOn ? 'black' : 'white';

      } catch (err) {
        console.error('Erro ao alternar flash:', err);
        // Se falhar e estava tentando ligar, avisar
        if (isFlashOn) {
          isFlashOn = false; // Reverter estado
          showToast('Flash não disponível ou erro ao ativar.', 'warning');
        }
      }
    }

    function fecharCameraMobile() {
      // Parar camera
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
      }

      isRenderLoopRunning = false;
      lastROIs = {};

      // Parar detecção
      if (detectionInterval) {
        clearInterval(detectionInterval);
        detectionInterval = null;
      }

      // Resetar tracker
      boxTracker.reset();

      // Voltar para interface de upload
      document.getElementById('cameraInterface').style.display = 'none';
      document.getElementById('uploadInterface').style.display = 'block';
    }

    function iniciarLiveDetection() {
      const feedbackEl = document.getElementById('detectionFeedback');
      const btnCapturar = document.getElementById('btnCapturarCamera');

      let isDetected = false;

      // Resetar tracker ao iniciar
      boxTracker.reset();

      // Loop de detecção a cada 800ms
      detectionInterval = setInterval(async () => {
        if (!cameraVideo || cameraVideo.readyState !== cameraVideo.HAVE_ENOUGH_DATA) {
          return;
        }

        try {
          // Capturar frame
          const frameBlob = await capturarFrameAtualCamera();

          // Enviar para backend
          const token = localStorage.getItem('token');
          const formData = new FormData();
          formData.append('frame', frameBlob, 'frame.jpg');

          const response = await apiFetch('/api/respostas/processar-frame-mobile', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
          });

          const data = await response.json();

          // Atualizar imagem de debug se houver
          if (data.debug_base64) {
            const imgDebug = document.getElementById('debugModelView');
            if (imgDebug) {
              imgDebug.src = 'data:image/jpeg;base64,' + data.debug_base64;
            }
          }

          // DEBUG: Log raw data from backend

          if (data.sucesso && data.detectado) {
            // Folha detectada completamente!
            isDetected = true;
            feedbackEl.style.background = '#51cf66';
            feedbackEl.textContent = data.feedback || '✓ Folha detectada! Capture agora.';
            btnCapturar.disabled = false;
            btnCapturar.style.opacity = '1';

            // DESENHAR DIRETAMENTE SEM TRACKER (para debug)
            desenharROIsDireto(data.rois);

          } else if (data.rois && Object.keys(data.rois).length > 0) {
            // Detectou parcialmente
            isDetected = false;
            feedbackEl.style.background = '#ffd43b';
            feedbackEl.textContent = data.feedback || 'Centralize melhor a folha';
            btnCapturar.disabled = true;
            btnCapturar.style.opacity = '0.5';

            // DESENHAR DIRETAMENTE SEM TRACKER
            desenharROIsDireto(data.rois);

          } else {
            // Nada detectado
            isDetected = false;
            feedbackEl.style.background = '#f03e3e';
            feedbackEl.textContent = data.feedback || '🔍 Procurando folha ENEM...';
            btnCapturar.disabled = true;
            btnCapturar.style.opacity = '0.5';
            lastROIs = {};
          }

        } catch (error) {
          console.error('Erro na detecção:', error);
        }
      }, 800);
    }

    // Função de utilidade para mapear bboxes normalizadas para o container mobile com object-fit: cover
    function mapBboxToCoverContainer(bbox_norm, imgWidth, imgHeight, containerWidth, containerHeight) {
      const scale = Math.max(containerWidth / imgWidth, containerHeight / imgHeight);
      const offsetX = (containerWidth - (imgWidth * scale)) / 2;
      const offsetY = (containerHeight - (imgHeight * scale)) / 2;

      const [nX, nY, nW, nH] = bbox_norm;

      // 1. Converter normalizado para pixels da imagem original
      const pixelX = nX * imgWidth;
      const pixelY = nY * imgHeight;
      const pixelW = nW * imgWidth;
      const pixelH = nH * imgHeight;

      // 2. Aplicar transformação (escala + offset)
      return {
        x: (pixelX * scale) + offsetX,
        y: (pixelY * scale) + offsetY,
        w: pixelW * scale,
        h: pixelH * scale,
        debug: { scale, offsetX, offsetY }
      };
    }

    /**
     * LOOP DE RENDERIZAÇÃO DE ALTA PERFORMANCE (requestAnimationFrame)
     * Desenha o vídeo e as boxes em perfeita sincronia no canvas.
     */
    function renderCanvasFrame() {
      if (!isRenderLoopRunning) return;

      const rect = cameraCanvas.parentElement.getBoundingClientRect();
      const containerWidth = rect.width;
      const containerHeight = rect.height;

      // Sincronizar tamanho do buffer do canvas com o tamanho exibido
      if (cameraCanvas.width !== containerWidth || cameraCanvas.height !== containerHeight) {
        cameraCanvas.width = containerWidth;
        cameraCanvas.height = containerHeight;
      }

      const videoW = cameraVideo.videoWidth;
      const videoH = cameraVideo.videoHeight;

      if (videoW && videoH) {
        // 1. Limpar canvas
        cameraCtx.clearRect(0, 0, cameraCanvas.width, cameraCanvas.height);

        // 2. Calcular transformação object-fit: cover
        const videoArea = mapBboxToCoverContainer([0, 0, 1, 1], videoW, videoH, containerWidth, containerHeight);
        const { scale, offsetX, offsetY } = videoArea.debug;

        // 3. DESENHAR O VÍDEO NO CANVAS (Simulando object-fit: cover)
        // Usamos as mesmas variáveis scale/offset que usaremos para as boxes
        cameraCtx.drawImage(cameraVideo, offsetX, offsetY, videoW * scale, videoH * scale);

        // 4. DESENHAR AS BBOXES (Efeito overlay)
        Object.entries(lastROIs).forEach(([nome, deteccoes]) => {
          if (!deteccoes || deteccoes.length === 0) return;

          deteccoes.forEach(deteccao => {
            if (deteccao.bbox_norm) {
              const pos = mapBboxToCoverContainer(deteccao.bbox_norm, videoW, videoH, containerWidth, containerHeight);

              const cor = nome === 'day_region' ? '#ff6b6b' : '#51cf66';
              cameraCtx.strokeStyle = cor;
              cameraCtx.lineWidth = 3;
              cameraCtx.strokeRect(pos.x, pos.y, pos.w, pos.h);

              // Label
              const text = `${nome} (${Math.round((deteccao.confidence || 0.8) * 100)}%)`;
              cameraCtx.font = 'bold 12px monospace';
              cameraCtx.fillStyle = cor;
              cameraCtx.fillRect(pos.x, Math.max(pos.y - 16, 0), cameraCtx.measureText(text).width + 6, 16);
              cameraCtx.fillStyle = '#fff';
              cameraCtx.fillText(text, pos.x + 3, Math.max(pos.y - 3, 13));
            }
          });
        });

        // 5. DEBUG VISUAL (Opcial)
        desenharDebugVisual(scale, offsetX, offsetY, videoW, videoH, containerWidth, containerHeight);
      }

      requestAnimationFrame(renderCanvasFrame);
    }

    function desenharDebugVisual(scale, offsetX, offsetY, videoW, videoH, containerWidth, containerHeight) {
      const debugEl = document.getElementById('debugDimensions');
      if (debugEl) {
        debugEl.innerHTML = `
          📹 Video: ${videoW}x${videoH} (Ratio: ${(videoW / videoH).toFixed(2)})<br>
          📱 Screen: ${containerWidth.toFixed(0)}x${containerHeight.toFixed(0)} (Ratio: ${(containerWidth / containerHeight).toFixed(2)})<br>
          🔍 Transform: S:${scale.toFixed(3)} O:(${offsetX.toFixed(0)}, ${offsetY.toFixed(0)})
        `;
      }

      // Retângulo Ciano Representando a área TOTAL do vídeo
      cameraCtx.save();
      cameraCtx.strokeStyle = 'cyan';
      cameraCtx.lineWidth = 2;
      cameraCtx.setLineDash([5, 5]);
      cameraCtx.strokeRect(offsetX, offsetY, videoW * scale, videoH * scale);

      // Centro
      cameraCtx.fillStyle = 'red';
      cameraCtx.fillRect(containerWidth / 2 - 8, containerHeight / 2 - 8, 16, 16);
      const center = mapBboxToCoverContainer([0.5, 0.5, 0, 0], videoW, videoH, containerWidth, containerHeight);
      cameraCtx.fillStyle = 'yellow';
      cameraCtx.fillRect(center.x - 5, center.y - 5, 10, 10);
      cameraCtx.restore();
    }

    // Canvas overlay - apenas atualiza o estado para o render loop
    function desenharROIsDireto(rois) {
      lastROIs = rois;

      // Iniciar o loop se ainda não estiver rodando
      if (!isRenderLoopRunning && cameraVideo && cameraVideo.videoWidth > 0) {
        isRenderLoopRunning = true;
        renderCanvasFrame();
      }
    }

    async function capturarFrameAtualCamera() {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = cameraVideo.videoWidth;
      tempCanvas.height = cameraVideo.videoHeight;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.drawImage(cameraVideo, 0, 0);

      console.log(`[CAPTURE] Frame size: ${tempCanvas.width}x${tempCanvas.height} `);

      return new Promise((resolve) => {
        tempCanvas.toBlob(resolve, 'image/jpeg', 0.95);
      });
    }

    function desenharROIsCamera(rois) {
      // Obter dimensões do container (tela inteira no mobile)
      const containerWidth = cameraVideo.clientWidth;
      const containerHeight = cameraVideo.clientHeight;

      // Ajustar canvas para cobrir o container inteiro
      if (cameraCanvas.width !== containerWidth || cameraCanvas.height !== containerHeight) {
        cameraCanvas.width = containerWidth;
        cameraCanvas.height = containerHeight;
      }

      cameraCtx.clearRect(0, 0, cameraCanvas.width, cameraCanvas.height);

      // Dimensões do vídeo original (o que a câmera captura)
      const videoW = cameraVideo.videoWidth;
      const videoH = cameraVideo.videoHeight;

      if (!videoW || !videoH) {
        console.warn('[DRAW] Video dimensions not available yet');
        return;
      }

      // ========== CÁLCULO DO OBJECT-FIT: CONTAIN ==========
      // O vídeo é escalado para caber inteiro no container, mantendo aspect ratio
      // Isso cria "letterbox" (barras pretas) nas laterais ou topo/fundo

      const videoAspect = videoW / videoH;
      const containerAspect = containerWidth / containerHeight;

      let renderedWidth, renderedHeight, offsetX, offsetY;

      if (videoAspect > containerAspect) {
        // Vídeo é mais "largo" que o container -> barras no topo/fundo
        renderedWidth = containerWidth;
        renderedHeight = containerWidth / videoAspect;
        offsetX = 0;
        offsetY = (containerHeight - renderedHeight) / 2;
      } else {
        // Vídeo é mais "alto" que o container -> barras nas laterais
        renderedHeight = containerHeight;
        renderedWidth = containerHeight * videoAspect;
        offsetX = (containerWidth - renderedWidth) / 2;
        offsetY = 0;
      }

      // Atualizar debug info
      const debugEl = document.getElementById('debugDimensions');
      if (debugEl) {
        debugEl.innerHTML = `
          📹 Video: ${videoW}x${videoH} | 📱 Container: ${containerWidth}x${containerHeight} <br>
        🎯 Rendered: ${Math.round(renderedWidth)}x${Math.round(renderedHeight)} | Offset: (${Math.round(offsetX)}, ${Math.round(offsetY)})
        `;
      }

      Object.entries(rois).forEach(([nome, deteccoes]) => {
        if (!deteccoes || deteccoes.length === 0) return;

        deteccoes.forEach(deteccao => {
          let finalX, finalY, finalW, finalH;

          // PRIORIZAR COORDENADAS NORMALIZADAS (0.0 a 1.0)
          if (deteccao.bbox_norm) {
            const [nX, nY, nW, nH] = deteccao.bbox_norm;

            // Converter normalizado -> posição na área renderizada do vídeo
            // As coordenadas normalizadas são relativas ao vídeo original
            // Precisamos mapear para a área onde o vídeo é realmente exibido

            finalX = (nX * renderedWidth) + offsetX;
            finalY = (nY * renderedHeight) + offsetY;
            finalW = nW * renderedWidth;
            finalH = nH * renderedHeight;

          } else {
            // Fallback para pixel coords (legado)
            // Converter coordenadas de pixel do vídeo original para a área renderizada
            const [x, y, w, h] = deteccao.bbox;
            const scaleX = renderedWidth / videoW;
            const scaleY = renderedHeight / videoH;
            finalX = (x * scaleX) + offsetX;
            finalY = (y * scaleY) + offsetY;
            finalW = w * scaleX;
            finalH = h * scaleY;
          }

          const cor = nome === 'day_region' ? '#ff6b6b' : '#51cf66';
          const labelNome = nome === 'day_region' ? 'Dia / Prova' : 'Respostas';

          // Ajustar opacidade baseado na idade da detecção (se disponível)
          const ageRatio = deteccao.ageRatio !== undefined ? deteccao.ageRatio : 0;
          const opacity = Math.max(0.4, 1.0 - (ageRatio * 0.6)); // Opacidade entre 0.4 e 1.0

          // Desenhar box com opacidade
          cameraCtx.strokeStyle = cor;
          cameraCtx.globalAlpha = opacity;
          cameraCtx.lineWidth = 3;
          cameraCtx.strokeRect(finalX, finalY, finalW, finalH);

          // Fundo semi-transparente para o texto ficar legível
          const text = `${labelNome} (${Math.round((deteccao.confidence || 0.8) * 100)}%)`;
          cameraCtx.font = 'bold 14px Atkinson Hyperlegible, sans-serif';
          const textMetrics = cameraCtx.measureText(text);
          const textBgHeight = 20;

          cameraCtx.fillStyle = cor;
          cameraCtx.fillRect(finalX, finalY - textBgHeight, textMetrics.width + 8, textBgHeight);

          cameraCtx.fillStyle = '#ffffff';
          cameraCtx.fillText(text, finalX + 4, finalY - 4);

          // Restaurar opacidade
          cameraCtx.globalAlpha = 1.0;
        });
      });
    }

    async function capturarDaCamera() {
      try {
        const btn = document.getElementById('btnCapturarCamera');
        btn.disabled = true;
        btn.innerHTML = '⏳';

        showLoading('Corrigindo perspectiva...');

        // Parar live detection para capturar frame limpo
        pararLiveDetection();

        // Capturar frame da camera
        const imageBlob = await capturarFrameAtualCamera();

        // Guardar referência para upload background se necessário
        imagemOriginalblob = imageBlob;

        const token = localStorage.getItem('token');
        const formData = new FormData();
        formData.append('imagem', imageBlob, 'captura_enem.jpg');

        await processarFluxoInicial(formData, fecharCameraMobile);

      } catch (error) {
        console.error('Erro ao capturar:', error);
        hideLoading();
        showToast(`Erro ao processar captura: ${error.message}`, 'error');
        document.getElementById('btnCapturarCamera').disabled = false;
        document.getElementById('btnCapturarCamera').innerHTML = '📷';
        iniciarLiveDetection();
      }
    }

    async function mostrarResultadoCaptura(data) {
      if (data.detalhes && data.detalhes.tipo_imagem_detectado && data.detalhes.tipo_imagem_detectado.startsWith('enem')) {
        showToast(`Captura ENEM Dia ${data.dia_detectado || ''} processada! ${data.total_respostas} respostas extraídas.`, 'success');
      } else {
        showToast(`Gabarito processado com sucesso! ${data.total_respostas} respostas extraídas.`, 'success');
      }

      // Armazenar respostas temporárias
      if (data.respostas && Array.isArray(data.respostas)) {
        Object.keys(respostasAluno).forEach(key => {
          if (key.startsWith('temp_')) delete respostasAluno[key];
        });

        data.respostas.forEach(item => {
          // Busca a chave que contém 'quest' ou o primeiro valor numérico
          let questaoKey = Object.keys(item).find(k => k.toLowerCase().includes('quest')) || Object.keys(item)[0];
          let respostaKey = Object.keys(item).find(k => k.toLowerCase().includes('resp')) || Object.keys(item)[1];
          
          let qVal = item[questaoKey] || item.Questão || item.Questao || item.questao;
          let rVal = item[respostaKey] || item.Resposta || item.resposta || item.alternativa || '';
          
          const questaoNumero = parseInt(qVal);
          if (!isNaN(questaoNumero) && questaoNumero > 0) {
            respostasAluno[`temp_${questaoNumero}`] = rVal;
          }
        });
      }

      // Buscar gabaritos por dia e ir para próximo step
      if (data.dia_detectado) {
        await buscarGabaritosPorDia(data.dia_detectado);
      }

      // Ir para step3_5 (respostas capturadas)
      await selecionarAluno(alunoSelecionado);

    }

    async function buscarGabaritosPorDia(dia) {
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        showLoading(`Buscando gabaritos do Dia ${dia}...`);

        const response = await apiFetch(`/api/gabaritos/por-dia/${dia}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (data.sucesso && data.gabaritos && data.gabaritos.length > 0) {
          // Substituir lista de gabaritos pela lista filtrada
          gabaritos = data.gabaritos;
          renderizarGabaritos();

          showToast(`${data.gabaritos.length} gabarito(s) encontrado(s) para o Dia ${dia} do ENEM`, 'info');
        } else {
          showToast(`Nenhum gabarito cadastrado para o Dia ${dia}. Mostrando todos os gabaritos.`, 'warning');
          // Manter todos os gabaritos caso não encontre nenhum para o dia
        }

      } catch (error) {
        console.error('Erro ao buscar gabaritos por dia:', error);
        showToast('Erro ao buscar gabaritos. Mostrando todos disponíveis.', 'warning');
      } finally {
        hideLoading();
      }
    }

    // Usamos a função global window.loadUserData definida em utils.js
    // para verificar a validade real do token com o backend.

    async function carregarAlunos() {
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        showLoading('Carregando alunos...');
        const response = await apiFetch('/api/alunos', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.sucesso || Array.isArray(data)) {
          alunos = data.alunos || data;
        }
      } catch (error) {
        console.error('Erro ao carregar alunos:', error);
        showToast('Erro ao carregar lista de alunos', 'error');
      } finally {
        hideLoading();
      }
    }

    async function carregarGabaritos() {
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        showLoading('Carregando gabaritos...');
        const response = await apiFetch('/api/gabaritos', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.sucesso || Array.isArray(data)) {
          gabaritos = data.gabaritos || data;
          renderizarGabaritos();
        }
      } catch (error) {
        console.error('Erro ao carregar gabaritos:', error);
        showToast('Erro ao carregar lista de gabaritos', 'error');
      } finally {
        hideLoading();
      }
    }

    function renderizarGabaritos() {
      const container = document.getElementById('gabaritoList');
      if (!container) return;

      container.innerHTML = '';
      gabaritos.forEach(gabarito => {
        const div = document.createElement('div');
        div.onclick = () => selectItem(div, gabarito.id);
        div.textContent = `${gabarito.nome} (${gabarito.etapa})`;
        div.dataset.gabaritoId = gabarito.id;
        container.appendChild(div);
      });
    }

    async function nextStep() {
      // Carregar lista de alunos quando avançar para step 3
      if (currentStep === 2) {
        await carregarListaAlunos();
      }

      document.getElementById(`step${currentStep}`).classList.remove('active');
      if (currentStep === '3_5') {
        currentStep = 4;
      } else {
        currentStep++;
      }
      document.getElementById(`step${currentStep}`).classList.add('active');
      atualizarBotaoVoltar();
    }

    function previousStep() {
      document.getElementById(`step${currentStep}`).classList.remove('active');
      if (currentStep === 4) {
        currentStep = '3_5';
      } else if (currentStep === '3_5') {
        currentStep = 3;
      } else {
        currentStep--;
      }
      document.getElementById(`step${currentStep}`).classList.add('active');
      atualizarBotaoVoltar();
    }

    function atualizarBotaoVoltar() {
      const btn = document.getElementById("voltarBtn");
      if (currentStep === 1 || currentStep === 5) {
        btn.style.display = "none";
      } else {
        btn.style.display = "block";
      }
    }

    async function carregarListaAlunos() {
      const container = document.getElementById('listaAlunos');
      if (!container) return;

      container.innerHTML = '';

      // Mostrar apenas o aluno selecionado no Step 1
      if (!alunoSelecionado) {
        container.innerHTML = '<p style="text-align: center; color: var(--color-error); padding: var(--spacing-lg);">Nenhum aluno selecionado. Por favor, volte ao passo anterior e identifique o aluno.</p>';
        return;
      }

      // Mostrar apenas o aluno selecionado
      const div = document.createElement('div');
      div.onclick = () => selecionarAluno(alunoSelecionado);
      div.textContent = `${alunoSelecionado.nome_completo} - ${alunoSelecionado.matricula}`;
      div.style.cursor = 'pointer';
      container.appendChild(div);

      // Auto-selecionar o aluno e avançar automaticamente para step3_5
      setTimeout(() => {
        selecionarAluno(alunoSelecionado);
      }, 100);
    }

    async function selecionarAluno(aluno) {
      alunoSelecionado = aluno;
      document.getElementById('step3').classList.remove('active');
      document.getElementById('step3_5').classList.add('active');
      document.getElementById('alunoSelecionado').innerText = `Confira as alternativas marcadas para o aluno: ${aluno.nome_completo}`;
      document.getElementById('alunoInfo').innerText = `${aluno.nome_completo} - ${aluno.matricula}`;

      // Carregar respostas existentes do aluno se houver (preserva respostas temporárias)
      await carregarRespostasAluno(aluno.id);

      // Aguardar um pouco para garantir que as respostas foram preservadas
      setTimeout(() => {
        preencherRespostasCapturadas();
      }, 100);

      currentStep = '3_5';
      atualizarBotaoVoltar();
    }

    async function carregarRespostasAluno(alunoId) {
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        // Salvar respostas temporárias existentes antes de carregar do banco
        const respostasTemporarias = {};
        Object.keys(respostasAluno).forEach(key => {
          if (key.startsWith('temp_')) {
            respostasTemporarias[key] = respostasAluno[key];
          }
        });

        const response = await apiFetch('/api/respostas', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        const respostasArray = data.respostas || (Array.isArray(data) ? data : []);
        // Filtrar respostas do aluno
        const respostasDoAluno = respostasArray.filter(r => r.aluno_id === alunoId);

        // Mesclar respostas do banco com respostas temporárias
        // Respostas temporárias têm prioridade (são as mais recentes)
        respostasAluno = {};
        respostasDoAluno.forEach(r => {
          respostasAluno[r.questao_id] = r.resposta_aluno;
        });

        // Restaurar respostas temporárias (sobrescrever se houver conflito)
        Object.keys(respostasTemporarias).forEach(key => {
          respostasAluno[key] = respostasTemporarias[key];
        });
      } catch (error) {
        console.error('Erro ao carregar respostas:', error);
      }
    }

    function preencherRespostasCapturadas() {
      const container = document.getElementById('respostasCapturadas');
      if (!container) return;

      container.innerHTML = "";

      // Contar apenas respostas temporárias (do processamento atual) e respostas do banco já mapeadas
      const respostasTemporarias = Object.keys(respostasAluno).filter(k => k.startsWith('temp_'));

      if (respostasTemporarias.length === 0 && Object.keys(respostasAluno).length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--color-text-light); padding: var(--spacing-lg);">Nenhuma resposta capturada ainda. Use a câmera ou anexe foto para capturar as respostas.</p>';
        return;
      }

      // Preparar lista de respostas para exibição
      const questoesOrdenadas = [];

      // Primeiro, adicionar respostas que já estão mapeadas por questao_id (se gabarito foi carregado)
      if (questoesGabarito.length > 0) {
        questoesGabarito.forEach(q => {
          const resposta = respostasAluno[q.id];
          if (resposta !== undefined && resposta !== null) {
            // Incluir resposta mesmo se for vazia (indica não marcado)
            questoesOrdenadas.push({ id: q.id, numero: q.numero, resposta: resposta || '' });
          }
        });
      }

      // Adicionar respostas temporárias (temp_${numero}) que ainda não foram mapeadas
      Object.keys(respostasAluno).forEach(key => {
        if (key.startsWith('temp_')) {
          const questaoNumero = parseInt(key.replace('temp_', ''));
          // Verificar se já não foi adicionada
          if (!questoesOrdenadas.find(q => q.numero === questaoNumero)) {
            const resposta = respostasAluno[key];
            // Incluir resposta temporária mesmo se for vazia
            questoesOrdenadas.push({ id: key, numero: questaoNumero, resposta: resposta || '' });
          }
        }
      });

      // Ordenar por número da questão
      questoesOrdenadas.sort((a, b) => a.numero - b.numero);

      if (questoesOrdenadas.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--color-text-light); padding: var(--spacing-lg);">Nenhuma resposta capturada ainda. Use a câmera ou anexe foto para capturar as respostas.</p>';
        return;
      }

      questoesOrdenadas.forEach((item, index) => {
        const div = document.createElement('div');
        const respostaTexto = item.resposta.trim() === ''
          ? '<span style="color: var(--color-text-lighter); font-style: italic;">Não marcado</span>'
          : item.resposta.includes(',')
            ? `<span style="color: var(--color-error); font-weight: 600;">${item.resposta} (dupla marcação - inválida)</span>`
            : item.resposta;
        div.innerHTML = `<strong>Questão ${String(item.numero).padStart(2, '0')}:</strong> ${respostaTexto}`;
        container.appendChild(div);
      });
    }

    function selectItem(el, gabaritoId) {
      document.querySelectorAll('#gabaritoList div').forEach(div => div.classList.remove('selected'));
      el.classList.add('selected');
      gabaritoSelecionado = gabaritoId;
      carregarQuestoesGabarito(gabaritoId);
    }

    async function carregarQuestoesGabarito(gabaritoId) {
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        const response = await apiFetch(`/api/questoes/gabarito/${gabaritoId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.sucesso) {
          questoesGabarito = data.questoes || [];
        }
      } catch (error) {
        console.error('Erro ao carregar questões:', error);
      }
    }

    let imagemAnexada = null;

    let recortesAtuais = {}; // { day_region: base64, answer_area_enem: base64 }
    let imagemOriginalblob = null; // Guardar blob original caso precise reprocessar ou salvar
    let imagemCorrigidaBase64 = null; // Imagem após correção de perspectiva
    let tipoGabarito = null; // 'enem_completo', 'enem_recorte', 'processada', 'original'

    // ========================================
    // FLUXO DE VALIDAÇÃO EM DUAS FASES
    // ========================================

    async function handleFileUpload(event) {
      const file = event.target.files[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        showToast('Por favor, selecione uma imagem válida', 'error');
        return;
      }

      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        imagemOriginalblob = file;
        showLoading('Corrigindo perspectiva...');

        const formData = new FormData();
        formData.append('imagem', file);

        await processarFluxoInicial(formData, null);

      } catch (error) {
        console.error('Erro ao processar imagem:', error);
        hideLoading();
        showToast(`Erro: ${error.message}`, 'error');
      }
    }

    async function processarFluxoInicial(formData, fecharCameraCallback) {
      const token = localStorage.getItem('token');
      
      
      showLoading('Identificando tipo de gabarito...');
      const resTipo = await apiFetch('/api/respostas/identificar-tipo', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      const dataTipo = await resTipo.json();
      
      if (!dataTipo.sucesso) {
        throw new Error(dataTipo.erro || 'Falha ao identificar o gabarito');
      }

      // Armazenar tipo detectado para uso em todo o fluxo
      tipoGabarito = dataTipo.tipo;
      console.log('[FLUXO] Tipo de gabarito detectado:', tipoGabarito);

      // Adicionar tipo no formData para o backend usar o script correto
      formData.append('tipo', dataTipo.tipo);

      // Sempre executar validação de perspectiva (Step 2.1)
      showLoading('Corrigindo perspectiva...');
      const response = await apiFetch('/api/respostas/etapa-perspectiva', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await response.json();
      hideLoading();
      
      if (!data.sucesso) throw new Error(data.erro || 'Falha na correção de perspectiva');
      
      if (fecharCameraCallback) fecharCameraCallback();
      
      imagemCorrigidaBase64 = data.imagem_corrigida_base64;
      mostrarValidacaoPerspectiva(data.imagem_original_base64, data.imagem_corrigida_base64);
    }



    function mostrarValidacaoPerspectiva(originalBase64, corrigidaBase64) {
      const previewOriginal = document.getElementById('previewOriginal');
      const previewCorrigida = document.getElementById('previewCorrigida');

      previewOriginal.innerHTML = '';
      previewCorrigida.innerHTML = '';

      if (originalBase64) {
        const img = document.createElement('img');
        img.src = `data:image/jpeg;base64,${originalBase64}`;
        img.style.maxWidth = '100%';
        img.style.maxHeight = '100%';
        img.style.objectFit = 'contain';
        previewOriginal.appendChild(img);
      }

      if (corrigidaBase64) {
        const img = document.createElement('img');
        img.src = `data:image/jpeg;base64,${corrigidaBase64}`;
        img.style.maxWidth = '100%';
        img.style.maxHeight = '100%';
        img.style.objectFit = 'contain';
        previewCorrigida.appendChild(img);
      }

      // Navegar para Step 2.1
      document.getElementById('step2').classList.remove('active');
      document.getElementById('step2_1').classList.add('active');
      currentStep = '2_1';
      atualizarBotaoVoltar();
    }

    function rejeitarPerspectiva() {
      // Voltar para upload (Step 2)
      document.getElementById('step2_1').classList.remove('active');
      document.getElementById('step2').classList.add('active');
      currentStep = 2;
      imagemCorrigidaBase64 = null;
      showToast('Tente com outra imagem ou posição diferente.', 'info');
    }

    async function confirmarPerspectiva() {
      if (!imagemCorrigidaBase64) {
        showToast('Imagem não disponível. Tente novamente.', 'error');
        return;
      }

      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        showLoading('Detectando regiões...');

        // Converter base64 para Blob para envio
        const corrigidaBlob = await base64ToBlob(imagemCorrigidaBase64);

        const formData = new FormData();
        formData.append('imagem', corrigidaBlob, 'imagem_corrigida.jpg');
        
        // Passar tipo para o próximo passo
        formData.append('tipo', tipoGabarito);

        if (tipoGabarito === 'original' || tipoGabarito === 'processada') {
          // FLUXO UEA: Enviar imagem já corrigida para processar
          showLoading('Processando gabarito UEA...');
          
          const response = await apiFetch('/api/respostas/processar-imagem', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
          });
          
          const dataProcessado = await response.json();
          hideLoading();
          
          if (!dataProcessado.sucesso) throw new Error(dataProcessado.erro || 'Falha ao processar gabarito UEA');
          
          if (dataProcessado.imagem) {
            imagemAnexada = dataProcessado.imagem;
          } else {
            imagemAnexada = {
              temporaria: true,
              nome: 'temp_pending_upload.jpg',
              caminho: '',
              caminhoRelativo: ''
            };
          }
          
          const resultadoCompleto = {
            total_respostas: dataProcessado.total_respostas,
            respostas: dataProcessado.respostas,
            detalhes: dataProcessado.detalhes
          };
          
          // Ir para etapa 3.5 (Respostas Capturadas)
          document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
          document.getElementById('step3_5').classList.add('active');
          currentStep = '3_5';
          mostrarResultadoCaptura(resultadoCompleto);
          
        } else {
          // FLUXO ENEM: Enviar para detecção de recortes
          showLoading('Detectando regiões...');
          
          const response = await apiFetch('/api/respostas/etapa-detectar', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
          });

          const data = await response.json();
          hideLoading();

          if (!data.sucesso) {
            throw new Error(data.erro || 'Falha na detecção');
          }

          // Armazenar recortes
          recortesAtuais = data.recortes_base64 || {};

          // Mostrar Step 2.2: Validar Crops
          mostrarValidacaoCrops(recortesAtuais);
        }

      } catch (error) {
        console.error('Erro ao detectar regiões:', error);
        hideLoading();
        showToast(`Erro: ${error.message}`, 'error');
      }
    }

    function mostrarValidacaoCrops(recortes) {
      const previewDay = document.getElementById('previewDay');
      const previewAnswers = document.getElementById('previewAnswers');

      previewDay.innerHTML = '';
      previewAnswers.innerHTML = '';

      if (recortes.day_region) {
        const img = document.createElement('img');
        img.src = `data:image/jpeg;base64,${recortes.day_region}`;
        img.style.maxWidth = '100%';
        img.style.maxHeight = '100%';
        img.style.objectFit = 'contain';
        previewDay.appendChild(img);
      } else {
        previewDay.innerHTML = '<span style="color:red">Não detectado</span>';
      }

      if (recortes.answer_area_enem) {
        const img = document.createElement('img');
        img.src = `data:image/jpeg;base64,${recortes.answer_area_enem}`;
        img.style.maxWidth = '100%';
        img.style.maxHeight = '100%';
        img.style.objectFit = 'contain';
        previewAnswers.appendChild(img);
      } else {
        previewAnswers.innerHTML = '<span style="color:red">Não detectado</span>';
      }

      // Navegar para Step 2.2
      document.getElementById('step2_1').classList.remove('active');
      document.getElementById('step2_2').classList.add('active');
      currentStep = '2_2';
      atualizarBotaoVoltar();
    }

    function rejeitarCrops() {
      // Voltar para upload (Step 2)
      document.getElementById('step2_2').classList.remove('active');
      document.getElementById('step2').classList.add('active');
      currentStep = 2;
      recortesAtuais = {};
      imagemCorrigidaBase64 = null;
      showToast('Tente com outra imagem.', 'info');
    }

    async function confirmarCrops() {
      // Validar que temos os recortes necessários
      if (!recortesAtuais.day_region || !recortesAtuais.answer_area_enem) {
        showToast('Recortes incompletos. Tente novamente.', 'warning');
        return;
      }

      // Prosseguir para processamento final (OCR + Bolhas)
      await processarEtapasFinais();
    }


    function mostrarValidacaoDeteccao(recortes) {
      const previewDay = document.getElementById('previewDay');
      const previewAnswers = document.getElementById('previewAnswers');

      previewDay.innerHTML = '';
      previewAnswers.innerHTML = '';

      if (recortes.day_region) {
        const img = document.createElement('img');
        img.src = `data:image/jpeg;base64,${recortes.day_region}`;
        img.style.maxWidth = '100%';
        img.style.maxHeight = '100%';
        img.style.objectFit = 'contain';
        previewDay.appendChild(img);
      } else {
        previewDay.innerHTML = '<span style="color:red">Não detectado</span>';
      }

      if (recortes.answer_area_enem) {
        const img = document.createElement('img');
        img.src = `data:image/jpeg;base64,${recortes.answer_area_enem}`;
        img.style.maxWidth = '100%';
        img.style.maxHeight = '100%';
        img.style.objectFit = 'contain';
        previewAnswers.appendChild(img);
      } else {
        previewAnswers.innerHTML = '<span style="color:red">Não detectado</span>';
      }

      // Avançar para step 2.5
      document.getElementById('step2').classList.remove('active');
      document.getElementById('step2_5').classList.add('active');
      currentStep = '2_5';
      atualizarBotaoVoltar();
    }

    async function processarEtapasFinais() {
      const token = localStorage.getItem('token');
      if (!token || !recortesAtuais.day_region || !recortesAtuais.answer_area_enem) {
        showToast('Recortes incompletos. Tente novamente.', 'warning');
        return;
      }

      try {
        showLoading('Lendo dia da prova (OCR)...');

        // Converter base64 para Blob para envio
        const dayBlob = await base64ToBlob(recortesAtuais.day_region);
        const formDay = new FormData();
        formDay.append('imagem', dayBlob, 'day_crop.jpg');

        // ETAPA 2: OCR DO DIA
        const respOCR = await apiFetch('/api/respostas/etapa-ocr', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formDay
        });
        const dataOCR = await respOCR.json();

        if (!dataOCR.sucesso) throw new Error('Falha no OCR do dia: ' + (dataOCR.erro || 'Desconhecido'));

        const diaDetectado = dataOCR.dia || 1;
        showLoading(`Dia ${diaDetectado} identificado. Lendo respostas...`);

        // ETAPA 3: PROCESSAR BOLHAS
        const answerBlob = await base64ToBlob(recortesAtuais.answer_area_enem);
        const formAnswers = new FormData();
        formAnswers.append('imagem', answerBlob, 'answers_crop.jpg');
        // Adicionar dia como campo extra (o endpoint espera json no body se nao fosse multipart, 
        // mas como é multipart, podemos por append ou mudar o endpoint para ler query string ou multipart field)
        // O endpoint implementa: const diaProva = req.body.dia_prova -> funciona com multer se appendado antes ou depois
        formAnswers.append('dia_prova', diaDetectado);

        const respBolhas = await apiFetch('/api/respostas/etapa-bolhas', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formAnswers
        });
        const dataBolhas = await respBolhas.json();

        if (!dataBolhas.sucesso) throw new Error('Falha na leitura das bolhas: ' + (dataBolhas.erro || 'Desconhecido'));

        hideLoading();

        // Salvar imagem original temporária (para upload final se necessário)
        // Como o fluxo original salvava a imagem no inicio, precisamos garantir que temos uma referencia
        // Podemos enviar a imagemOriginalBlob para '/api/respostas/processar-imagem' (ENDPOINT ORIGINAL) 
        // mas isso reprocessaria tudo.
        // O ideal é salvar a imagem original agora apenas como arquivo temporário para referencia futura.
        // Vamos simular a estrutura que 'mostrarResultadoCaptura' espera:

        // Precisamos fazer upload da imagem original para ter um path, SE quisermos salvar no final.
        // Vamos usar o endpoint antigo 'processar-imagem' APENAS para salvar o arquivo (hack)
        // OU criar um novo endpoint simples de upload.
        // Para simplificar, vou assumir que 'mostrarResultadoCaptura' consegue lidar mesmo sem imagem salva agora,
        // mas a logica de salvar resposta precisa de 'imagemAnexada'.

        // Vamos fazer upload silencioso da imagem original para obter o handle temporario
        if (imagemOriginalblob) {
          const formDataOrig = new FormData();
          formDataOrig.append('imagem', imagemOriginalblob);
          // Usar endpoint de upload simples se existisse, mas vou usar o processar-imagem ignorando o resultado
          // ou melhor: nao bloquear o usuario.

          // FAKE IMAGE OBJECT for now to allow proceeding without heavy upload delay
          imagemAnexada = {
            temporaria: true,
            nome: 'temp_pending_upload.jpg',
            caminho: '',
            caminhoRelativo: ''
          };

          // Background upload (opcional)
          uploadImagemOriginalEmBackground(imagemOriginalblob);
        }

        const resultadoCompleto = {
          dia_detectado: diaDetectado,
          total_respostas: dataBolhas.total_respostas,
          respostas: dataBolhas.respostas,
          detalhes: dataBolhas
        };

        mostrarResultadoCaptura(resultadoCompleto);

      } catch (error) {
        console.error(error);
        hideLoading();
        showToast(error.message, 'error');
      }
    }

    async function uploadImagemOriginalEmBackground(blob) {
      // Envia imagem apenas para persistir como temp e obter caminho
      // Podemos usar o endpoint antigo mas ignorar o processamento pesado? Nao, ele faz tudo.
      // Ideal seria endpoint 'upload-temp'.
      // Por hora, deixamos sem imagem vinculada até refatorar isso, ou usamos o base64 para reconstruir.
      // O usuario quer MVP.

      // Vamos tentar usar o processar-imagem antigo, ele retorna o path.
      try {
        const token = localStorage.getItem('token');
        const fd = new FormData();
        fd.append('imagem', blob);
        const res = await apiFetch('/api/respostas/processar-imagem', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: fd
        });
        const data = await res.json();
        if (data.imagem) {
          imagemAnexada = {
            nome: data.imagem.nome,
            caminho: data.imagem.caminho,
            caminhoRelativo: `/uploads/imagens/temp/${data.imagem.nome}`,
            temporaria: true
          };
        }
      } catch (e) { console.warn('Erro upload background', e); }
    }

    async function base64ToBlob(base64) {
      const res = await fetch(`data:image/jpeg;base64,${base64}`);
      return await res.blob();
    }

    async function verificarCodigo() {
      const input = document.getElementById("codigoAlunoInput").value.trim();
      const infoSpan = document.getElementById("alunoInfo");
      const btn = document.getElementById("btnProximoAluno");

      if (!input || input.length < 7) {
        infoSpan.innerText = "Aguardando matrícula (7 dígitos)...";
        btn.style.display = "none";
        alunoSelecionado = null;
        return;
      }

      // Buscar aluno por matrícula ou ID
      const aluno = alunos.find(a => a.matricula === input || a.id === input);

      if (aluno) {
        infoSpan.innerText = `${aluno.nome_completo} - ${aluno.matricula}`;
        btn.style.display = "inline-block";
        alunoSelecionado = aluno;
      } else {
        infoSpan.innerText = "Aluno não encontrado!";
        btn.style.display = "none";
        alunoSelecionado = null;
        showToast('Aluno não encontrado. Verifique a matrícula.', 'warning');
      }
    }

    async function finalizar() {
      if (!alunoSelecionado) {
        showToast('Selecione um aluno primeiro', 'warning');
        return;
      }

      if (!gabaritoSelecionado) {
        showToast('Selecione um gabarito primeiro', 'warning');
        return;
      }

      if (questoesGabarito.length === 0) {
        showToast('Carregue as questões do gabarito primeiro', 'warning');
        return;
      }

      // Mapear respostas temporárias (temp_${numero}) para questao_id quando gabarito é selecionado
      const respostasMapeadas = {};

      // Primeiro, copiar respostas que já estão mapeadas por questao_id
      Object.keys(respostasAluno).forEach(key => {
        if (!key.startsWith('temp_')) {
          respostasMapeadas[key] = respostasAluno[key];
        }
      });

      // Mapear respostas temporárias para questao_id baseado no número da questão
      Object.keys(respostasAluno).forEach(key => {
        if (key.startsWith('temp_')) {
          const questaoNumero = parseInt(key.replace('temp_', ''));
          // Encontrar questão no gabarito pelo número
          const questao = questoesGabarito.find(q => q.numero === questaoNumero);
          if (questao) {
            respostasMapeadas[questao.id] = respostasAluno[key];
          }
        }
      });

      // Se não houver respostas após mapeamento, mostrar aviso
      if (Object.keys(respostasMapeadas).length === 0) {
        showToast('Nenhuma resposta capturada. Use a câmera ou anexe foto para capturar as respostas.', 'warning');
        return;
      }

      const token = localStorage.getItem('token');
      if (!token) {
        window.location.href = '/login.html';
        return;
      }

      try {
        showLoading('Corrigindo simulado e salvando respostas...');

        // Comparar respostas do aluno com o gabarito e salvar
        // IMPORTANTE: Processar apenas questões que foram capturadas (têm resposta mapeada)
        let respostasSalvas = 0;
        let acertos = 0;
        let erros = 0;
        let questoesVazias = 0;
        let questoesDuplaMarcacao = 0;

        // Obter apenas as questões que foram capturadas (têm resposta mapeada)
        const questoesCapturadas = questoesGabarito.filter(questao => {
          return respostasMapeadas.hasOwnProperty(questao.id);
        });

        // Se não houver questões capturadas, mostrar aviso
        if (questoesCapturadas.length === 0) {
          showToast('Nenhuma questão foi capturada. Use a câmera ou anexe foto para capturar as respostas.', 'warning');
          hideLoading();
          return;
        }

        // Processar apenas questões capturadas
        for (const questao of questoesCapturadas) {
          const respostaAluno = respostasMapeadas[questao.id] || ''; // String vazia se não houver resposta

          // Verificar tipo de resposta
          const respostaTrim = respostaAluno.trim();
          const temDuplaMarcacao = respostaTrim.includes(',');
          const estaVazia = respostaTrim === '';

          // Contabilizar tipos
          if (estaVazia) {
            questoesVazias++;
          } else if (temDuplaMarcacao) {
            questoesDuplaMarcacao++;
          }

          // Se for dupla marcação ou vazio, não conta como acerto
          // Dupla marcação = inválida (acertou = false)
          // Vazio = não marcado (acertou = false)
          let acertou = false;

          if (!temDuplaMarcacao && !estaVazia) {
            // Apenas verifica acerto se houver resposta única válida
            acertou = respostaTrim.toUpperCase() === questao.resposta_correta.toUpperCase().trim();
            if (acertou) {
              acertos++;
            } else {
              erros++;
            }
          }

          try {
            const response = await apiFetch('/api/respostas', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                aluno_id: alunoSelecionado.id,
                questao_id: questao.id,
                gabarito_id: gabaritoSelecionado,
                resposta_aluno: respostaAluno,
                acertou: acertou
                // Não incluir imagem aqui - será confirmada apenas ao finalizar todas as respostas
              })
            });

            const data = await response.json();

            if (response.ok && data.sucesso) {
              respostasSalvas++;
            }
          } catch (error) {
            console.error(`Erro ao salvar resposta da questão ${questao.numero}:`, error);
          }
        }

        if (respostasSalvas > 0) {
          // Confirmar e salvar a imagem permanentemente apenas após salvar todas as respostas
          if (imagemAnexada && imagemAnexada.temporaria) {
            try {
              const confirmResponse = await apiFetch('/api/respostas/confirmar-imagem', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  caminho_imagem_temp: imagemAnexada.caminho,
                  aluno_id: alunoSelecionado.id,
                  gabarito_id: gabaritoSelecionado
                })
              });

              const confirmData = await confirmResponse.json();
              if (confirmData.sucesso) {
                // Atualizar referência da imagem para o caminho permanente
                imagemAnexada.caminho = confirmData.imagem.caminho;
                imagemAnexada.nome = confirmData.imagem.nome;
                imagemAnexada.caminhoRelativo = confirmData.imagem.caminho;
                imagemAnexada.temporaria = false;
                console.log('[FINALIZAR] Imagem confirmada e movida para permanente:', confirmData.imagem.caminho);
              } else {
                console.warn('[FINALIZAR] Aviso ao confirmar imagem:', confirmData.erro || confirmData.aviso);
              }
            } catch (confirmErr) {
              console.error('Erro ao confirmar imagem:', confirmErr);
              // Não falhar toda a operação se apenas a confirmação da imagem falhar
              showToast('Respostas salvas, mas houve um problema ao salvar a imagem. Verifique manualmente.', 'warning');
            }
          }

          let mensagem = `Simulado corrigido! ${respostasSalvas} questões processadas.`;
          mensagem += `\n✓ Acertos: ${acertos}`;
          mensagem += `\n✗ Erros: ${erros}`;
          if (questoesVazias > 0) {
            mensagem += `\n○ Não marcadas: ${questoesVazias}`;
          }
          if (questoesDuplaMarcacao > 0) {
            mensagem += `\n⚠ Dupla marcação (inválidas): ${questoesDuplaMarcacao}`;
          }
          showToast(mensagem, 'success');
          document.getElementById('step4').classList.remove('active');
          document.getElementById('step5').classList.add('active');
          document.getElementById('alunoInfo').innerText = "Ler código!";
          atualizarBotaoVoltar();

          // Limpar dados
          alunoSelecionado = null;
          gabaritoSelecionado = null;
          respostasAluno = {};
          questoesGabarito = [];
          imagemAnexada = null;
          document.getElementById('codigoAlunoInput').value = '';
        } else {
          showToast('Erro ao salvar respostas', 'error');
        }

      } catch (error) {
        console.error('Erro ao finalizar correção:', error);
        showToast(`Erro ao finalizar correção: ${error.message}`, 'error');
      } finally {
        hideLoading();
      }
    }