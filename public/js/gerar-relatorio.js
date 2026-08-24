    let grafico = null;
    let graficoDisciplinas = null;
    let alunoSelecionado = null;
    let listaAlunos = [];
    let timeoutBusca = null;
    let dadosDisciplinasGerais = [];
    let dadosDisciplinasPorSimulado = {}; // Cache dos dados por simulado
    let indiceSugestaoAtiva = -1;
    let reportRequestController = null;
    let disciplineRequestController = null;
    let reportVersion = 0;

    const REPORT_STATES = Object.freeze({
      INITIAL: 'initial',
      LOADING: 'loading',
      SUCCESS: 'success',
      NO_SIMULADOS: 'no-simulados',
      ERROR: 'error'
    });

    function escapeHtml(value) {
      return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    // Carregar dados ao inicializar
    document.addEventListener('DOMContentLoaded', async () => {
      configurarInteracoesDaPagina();
      renderReportState(REPORT_STATES.INITIAL);
      await carregarListaAlunos();
      await loadUserData();
    });

    function configurarInteracoesDaPagina() {
      const buscaInput = document.getElementById('buscaAluno');
      const sugestoes = document.getElementById('sugestoesAlunos');
      const botaoBuscar = document.getElementById('btnBuscar');
      const filtroSimulado = document.getElementById('filtroSimulado');
      const tabelaSimulados = document.getElementById('corpoTabelaSimulados');

      const headerBusca = document.getElementById('headerBuscaAluno');
      const btnToggleBusca = document.getElementById('btnToggleBusca');

      buscaInput.addEventListener('input', buscarAlunos);
      buscaInput.addEventListener('focus', buscarAlunos);
      buscaInput.addEventListener('keydown', tratarTecladoBusca);
      botaoBuscar.addEventListener('click', buscarRelatorio);
      filtroSimulado.addEventListener('change', filtrarDisciplinasPorSimulado);

      if (headerBusca) {
        headerBusca.addEventListener('click', (e) => {
          toggleSearchCard();
        });

        headerBusca.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleSearchCard();
          }
        });
      }

      if (btnToggleBusca) {
        btnToggleBusca.addEventListener('click', (e) => {
          e.stopPropagation();
          toggleSearchCard();
        });
      }

      sugestoes.addEventListener('click', event => {
        const option = event.target.closest('[data-aluno-id]');
        if (!option) return;
        selecionarAluno(option.dataset.alunoId);
      });

      tabelaSimulados.addEventListener('click', event => {
        const detalhe = event.target.closest('[data-action="toggle-details"]');
        if (detalhe) {
          toggleDetalhesSimulado(detalhe.dataset.simuladoId, alunoSelecionado?.id);
          return;
        }
        const cartao = event.target.closest('[data-action="view-card"]');
        if (cartao) verCartao(cartao.dataset.simuladoId, alunoSelecionado?.id);
      });
    }

    function collapseSearchCard() {
      const card = document.getElementById('cardBuscaAluno');
      const header = document.getElementById('headerBuscaAluno');
      const toggleBtn = document.getElementById('btnToggleBusca');
      const toggleText = document.getElementById('toggleBuscaTexto');
      const badge = document.getElementById('badgeAlunoSelecionado');
      const badgeName = document.getElementById('nomeAlunoBadge');

      if (!card) return;
      card.classList.add('is-collapsed');
      card.classList.add('has-selected');
      if (header) header.setAttribute('aria-expanded', 'false');
      if (toggleBtn) {
        toggleBtn.style.display = 'inline-flex';
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.setAttribute('aria-label', 'Expandir busca de aluno');
      }
      if (toggleText) toggleText.textContent = 'Alterar aluno';
      if (badge && alunoSelecionado) {
        if (badgeName) badgeName.textContent = alunoSelecionado.nome;
        badge.style.display = 'inline-flex';
      }
    }

    function expandSearchCard(focusInput = true) {
      const card = document.getElementById('cardBuscaAluno');
      const header = document.getElementById('headerBuscaAluno');
      const toggleBtn = document.getElementById('btnToggleBusca');
      const toggleText = document.getElementById('toggleBuscaTexto');
      const badge = document.getElementById('badgeAlunoSelecionado');
      const input = document.getElementById('buscaAluno');

      if (!card) return;
      card.classList.remove('is-collapsed');
      if (header) header.setAttribute('aria-expanded', 'true');
      if (toggleBtn) {
        toggleBtn.style.display = alunoSelecionado ? 'inline-flex' : 'none';
        toggleBtn.setAttribute('aria-expanded', 'true');
        toggleBtn.setAttribute('aria-label', 'Recolher busca de aluno');
      }
      if (toggleText) toggleText.textContent = 'Recolher';
      if (badge) badge.style.display = 'none';

      if (focusInput && input) {
        setTimeout(() => {
          input.focus();
        }, 150);
      }
    }

    function toggleSearchCard() {
      const card = document.getElementById('cardBuscaAluno');
      if (!card || !alunoSelecionado) return;
      if (card.classList.contains('is-collapsed')) {
        expandSearchCard(true);
      } else {
        collapseSearchCard();
      }
    }

    function showResults() {
      const container = document.getElementById('resultsContainer') || document.getElementById('report-result');
      if (container) {
        container.style.display = 'block';
        container.hidden = false;
      }
    }

    function hideResults() {
      const container = document.getElementById('resultsContainer') || document.getElementById('report-result');
      if (container) {
        container.style.display = 'none';
        container.hidden = true;
      }
    }

    function renderReportState(state) {
      const resultsContainer = document.getElementById('resultsContainer') || document.getElementById('report-result');
      const mensagemInicial = document.getElementById('mensagemInicial');
      const infoAluno = document.getElementById('infoAlunoSelecionado');
      const containerMetricas = document.getElementById('containerMetricas');
      const simulados = document.getElementById('containerRelatorioSimulados');
      const semSimulados = document.getElementById('reportNoSimulations');
      const graficoDesempenho = document.getElementById('cardGraficoDesempenho');
      const graficoDisciplinas = document.getElementById('cardGraficoDisciplinas');
      const cardBusca = document.getElementById('cardBuscaAluno');
      const toggleBtn = document.getElementById('btnToggleBusca');

      if (state === REPORT_STATES.INITIAL) {
        hideResults();
        if (cardBusca) cardBusca.classList.remove('has-selected');
        if (toggleBtn) toggleBtn.style.display = 'none';
        expandSearchCard(false);
        if (mensagemInicial) {
          mensagemInicial.hidden = true;
          const h3 = mensagemInicial.querySelector('h3');
          const p = mensagemInicial.querySelector('p');
          if (h3) h3.textContent = 'Nenhum aluno selecionado';
          if (p) p.textContent = 'Digite o nome ou matrícula do aluno acima para visualizar o relatório individual.';
        }
        return;
      }

      showResults();

      if (state === REPORT_STATES.LOADING) {
        if (infoAluno) infoAluno.hidden = true;
        if (containerMetricas) containerMetricas.hidden = true;
        if (simulados) simulados.hidden = true;
        if (semSimulados) semSimulados.hidden = true;
        if (graficoDesempenho) graficoDesempenho.hidden = true;
        if (graficoDisciplinas) graficoDisciplinas.hidden = true;
        if (mensagemInicial) {
          mensagemInicial.hidden = false;
          const h3 = mensagemInicial.querySelector('h3');
          const p = mensagemInicial.querySelector('p');
          if (h3) h3.textContent = 'Carregando relatório...';
          if (p) p.textContent = 'Estamos reunindo os dados do aluno selecionado.';
        }
      } else if (state === REPORT_STATES.SUCCESS) {
        if (mensagemInicial) mensagemInicial.hidden = true;
        if (infoAluno) infoAluno.hidden = false;
        if (containerMetricas) containerMetricas.hidden = false;
        if (simulados) simulados.hidden = false;
        if (semSimulados) semSimulados.hidden = true;
        if (graficoDesempenho) graficoDesempenho.hidden = false;
        if (graficoDisciplinas) graficoDisciplinas.hidden = false;
      } else if (state === REPORT_STATES.NO_SIMULADOS) {
        if (mensagemInicial) mensagemInicial.hidden = true;
        if (infoAluno) infoAluno.hidden = false;
        if (containerMetricas) containerMetricas.hidden = true;
        if (simulados) simulados.hidden = true;
        if (semSimulados) semSimulados.hidden = false;
        if (graficoDesempenho) graficoDesempenho.hidden = true;
        if (graficoDisciplinas) graficoDisciplinas.hidden = true;
      } else if (state === REPORT_STATES.ERROR) {
        if (infoAluno) infoAluno.hidden = true;
        if (containerMetricas) containerMetricas.hidden = true;
        if (simulados) simulados.hidden = true;
        if (semSimulados) semSimulados.hidden = true;
        if (graficoDesempenho) graficoDesempenho.hidden = true;
        if (graficoDisciplinas) graficoDisciplinas.hidden = true;
        if (mensagemInicial) {
          mensagemInicial.hidden = false;
          const h3 = mensagemInicial.querySelector('h3');
          const p = mensagemInicial.querySelector('p');
          if (h3) h3.textContent = 'Não foi possível carregar o relatório';
          if (p) p.textContent = 'Tente novamente ou selecione outro aluno.';
        }
      }
    }

    async function carregarListaAlunos() {
      const token = localStorage.getItem('token');
      if (!token) {
        window.location.href = '/login.html';
        return;
      }

      try {
        showLoading('Carregando lista de alunos...');
        const response = await apiFetch('/api/alunos', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.sucesso) {
            listaAlunos = data.alunos || [];
          }
        } else {
          console.warn('Erro ao carregar lista de alunos:', response.status);
        }
      } catch (error) {
        console.error('Erro ao carregar lista de alunos:', error);
        showToast('Erro ao carregar lista de alunos', 'error');
      } finally {
        hideLoading();
      }
    }

    function buscarAlunos(event) {
      clearTimeout(timeoutBusca);
      timeoutBusca = setTimeout(() => {
        const termo = event.target.value.trim().toLowerCase();
        const sugestoesDiv = document.getElementById('sugestoesAlunos');
        
        if (termo.length < 2) {
          fecharSugestoes();
          return;
        }

        // Filtrar alunos
        const alunosFiltrados = listaAlunos.filter(aluno => 
          aluno.nome_completo.toLowerCase().includes(termo) ||
          (aluno.matricula && aluno.matricula.toLowerCase().includes(termo))
        ).slice(0, 5); // Limitar a 5 sugestões

      if (alunosFiltrados.length === 0) {
          fecharSugestoes();
          return;
      }

      // Exibir sugestões de forma segura (DOM nodes)
      sugestoesDiv.innerHTML = '';
      indiceSugestaoAtiva = -1;
      alunosFiltrados.forEach((aluno, index) => {
        const div = document.createElement('div');
        div.className = 'report-suggestion-item';
        div.id = `sugestao-aluno-${aluno.id}`;
        div.dataset.alunoId = aluno.id;
        div.setAttribute('role', 'option');
        div.setAttribute('aria-selected', 'false');

        const nameDiv = document.createElement('div');
        nameDiv.style.cssText = 'font-weight: 600; color: #003b54; margin-bottom: 4px;';
        nameDiv.textContent = aluno.nome_completo;

        const matDiv = document.createElement('div');
        matDiv.style.cssText = 'font-size: 13px; color: #666;';
        matDiv.appendChild(document.createTextNode('Matrícula: '));
        
        const matSpan = document.createElement('span');
        matSpan.style.cssText = 'color: #008cc4; font-weight: 500;';
        matSpan.textContent = aluno.matricula || 'N/A';
        matDiv.appendChild(matSpan);

        div.appendChild(nameDiv);
        div.appendChild(matDiv);
        sugestoesDiv.appendChild(div);
      });
      
       sugestoesDiv.hidden = false;
       document.getElementById('buscaAluno').setAttribute('aria-expanded', 'true');
     }, 300);
   }

    function fecharSugestoes() {
      const sugestoesDiv = document.getElementById('sugestoesAlunos');
      sugestoesDiv.hidden = true;
      document.getElementById('buscaAluno').setAttribute('aria-expanded', 'false');
      document.getElementById('buscaAluno').removeAttribute('aria-activedescendant');
      indiceSugestaoAtiva = -1;
    }

    function atualizarSugestaoAtiva(novoIndice) {
      const opcoes = Array.from(document.querySelectorAll('#sugestoesAlunos [role="option"]'));
      if (!opcoes.length) return;
      indiceSugestaoAtiva = (novoIndice + opcoes.length) % opcoes.length;
      opcoes.forEach((opcao, indice) => {
        const ativa = indice === indiceSugestaoAtiva;
        opcao.classList.toggle('is-active', ativa);
        opcao.setAttribute('aria-selected', String(ativa));
      });
      document.getElementById('buscaAluno').setAttribute('aria-activedescendant', opcoes[indiceSugestaoAtiva].id);
    }

    function tratarTecladoBusca(event) {
      const opcoes = document.querySelectorAll('#sugestoesAlunos [role="option"]');
      if (event.key === 'ArrowDown' && opcoes.length) {
        event.preventDefault();
        atualizarSugestaoAtiva(indiceSugestaoAtiva + 1);
      } else if (event.key === 'ArrowUp' && opcoes.length) {
        event.preventDefault();
        atualizarSugestaoAtiva(indiceSugestaoAtiva - 1);
      } else if (event.key === 'Enter' && indiceSugestaoAtiva >= 0 && opcoes[indiceSugestaoAtiva]) {
        event.preventDefault();
        selecionarAluno(opcoes[indiceSugestaoAtiva].dataset.alunoId);
      } else if (event.key === 'Escape') {
        fecharSugestoes();
      }
    }

    async function selecionarAluno(id) {
      const aluno = listaAlunos.find(item => String(item.id) === String(id));
      if (!aluno) return;
      alunoSelecionado = {
        id: aluno.id,
        nome: aluno.nome_completo,
        matricula: aluno.matricula,
        etapa: aluno.etapa
      };
      reportVersion += 1;
      document.getElementById('buscaAluno').value = alunoSelecionado.nome;
      fecharSugestoes();
      
      // Preenche os campos, mas só exibiremos o container após buscar com sucesso
      document.getElementById('nomeAlunoSelecionado').textContent = alunoSelecionado.nome;
      document.getElementById('matriculaAlunoSelecionado').textContent = alunoSelecionado.matricula || 'N/A';
      document.getElementById('etapaAlunoSelecionado').textContent = alunoSelecionado.etapa || 'N/A';

      // Buscar relatório automaticamente ao selecionar o aluno
      await buscarRelatorio();
    }

    function populateResults(stats) {
      if (!stats) return;
      atualizarMetricas(stats);
      atualizarGrafico(stats.desempenho_por_gabarito || stats.desempenho_tempo);
      
      // Armazenar dados gerais e popular dropdown de simulados
      dadosDisciplinasGerais = stats.media_por_disciplina || [];
      popularDropdownSimulados(stats.desempenho_por_gabarito || []);
      
      atualizarTabelaSimulados(stats.desempenho_por_gabarito || []);

      if (alunoSelecionado) {
        document.getElementById('nomeAlunoSelecionado').textContent = alunoSelecionado.nome;
        document.getElementById('matriculaAlunoSelecionado').textContent = alunoSelecionado.matricula || 'N/A';
        document.getElementById('etapaAlunoSelecionado').textContent = alunoSelecionado.etapa || 'N/A';
      }
      
      // Resetar dropdown para "Geral" ao carregar novo relatório
      const selectFiltro = document.getElementById('filtroSimulado');
      if (selectFiltro) {
        selectFiltro.value = 'geral';
      }
      
      // Aguardar um frame para garantir que o container está visível antes de atualizar o gráfico
      // Isso garante que o canvas tenha as dimensões corretas
      requestAnimationFrame(() => {
        setTimeout(() => {
          atualizarGraficoDisciplinas(dadosDisciplinasGerais);
        }, 100);
      });
    }

    async function fetchReportData(alunoId) {
      const token = localStorage.getItem('token');
      if (!token) {
        window.location.href = '/login.html';
        return;
      }

      let requestController;
      try {
        reportRequestController?.abort();
        disciplineRequestController?.abort();
        requestController = new AbortController();
        reportRequestController = requestController;
        const alunoIdDaRequisicao = alunoId;
        renderReportState(REPORT_STATES.LOADING);
        document.getElementById('btnBuscarText').textContent = 'Buscando...';
        document.getElementById('btnBuscarSpinner').style.display = 'inline-block';
        document.getElementById('btnBuscar').disabled = true;

        const response = await apiFetch(`/api/relatorios/estatisticas-individual/${alunoId}`, {
          signal: requestController.signal,
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            localStorage.removeItem('token');
            window.location.href = '/login.html';
            return;
          }
          if (response.status === 404) {
            renderReportState(REPORT_STATES.ERROR);
            showNotice('Aluno não encontrado ou este aluno ainda não possui dados de relatório consolidados.', 'warning');
            return;
          }
          throw new Error('Erro ao buscar relatório');
        }

        const data = await response.json();
        if (requestController.signal.aborted || alunoSelecionado?.id !== alunoIdDaRequisicao) return;
        
        if (data.sucesso && data.estatisticas) {
          populateResults(data.estatisticas);
          const hasSimulados = (data.estatisticas.desempenho_por_gabarito || []).length > 0;
          renderReportState(hasSimulados ? REPORT_STATES.SUCCESS : REPORT_STATES.NO_SIMULADOS);
          
          // Recolher automaticamente a gaveta de busca após encontrar dados válidos
          collapseSearchCard();
          
          showToast('Relatório carregado com sucesso!', 'success');
        } else {
          renderReportState(REPORT_STATES.ERROR);
          expandSearchCard(false);
          showNotice('Erro ao carregar dados do relatório. O aluno pode não ter simulados.', 'error');
        }
      } catch (error) {
        if (error.name === 'AbortError') return;
        console.error('Erro ao buscar relatório:', error);
        renderReportState(REPORT_STATES.ERROR);
        expandSearchCard(false);
        showToast('Erro ao buscar relatório. Tente novamente.', 'error');
      } finally {
        if (reportRequestController !== requestController) return;
        document.getElementById('btnBuscarText').textContent = 'Buscar';
        document.getElementById('btnBuscarSpinner').style.display = 'none';
        document.getElementById('btnBuscar').disabled = false;
        reportRequestController = null;
      }
    }

    async function buscarRelatorio() {
      if (!alunoSelecionado) {
        showToast('Por favor, selecione um aluno da lista de sugestões', 'warning');
        return;
      }
      await fetchReportData(alunoSelecionado.id);
    }

    function atualizarMetricas(stats) {
      document.getElementById('qtdQuestoes').textContent = 
        stats.total_questoes.toLocaleString('pt-BR');
      document.getElementById('acertosTotais').textContent = 
        stats.total_acertos.toLocaleString('pt-BR');
      document.getElementById('taxaAcertos').textContent = 
        stats.taxa_acertos.toFixed(1) + '%';
      document.getElementById('maiorMediaDisciplina').textContent = 
        stats.maior_media_disciplina || '-';
      document.getElementById('menorMediaDisciplina').textContent = 
        stats.menor_media_disciplina || '-';
    }

    function atualizarGrafico(dados) {
      const canvas = document.getElementById('graficoDesempenho');
      const ctx = canvas.getContext('2d');
      
      // Configurar alta resolução para telas Retina
      // Chart.js lidará com DPI nativamente
      
      // Se tiver dados por gabarito, usar esses (mais útil)
      // Senão, usar dados por tempo
      let labels = [];
      let medias = [];

      if (dados && dados.length > 0) {
        // Ordenar dados do mais antigo para o mais novo (cronológico)
        let dadosOrdenados = [...dados];
        
        if (dados[0].nome) {
          // Dados por gabarito - ordenar por data (mais antigo primeiro)
          dadosOrdenados.sort((a, b) => {
            const dataA = a.data ? new Date(a.data) : new Date(0);
            const dataB = b.data ? new Date(b.data) : new Date(0);
            return dataA - dataB; // ASC: mais antigo primeiro
          });
          
          labels = dadosOrdenados.map(d => d.nome || `Simulado ${d.etapa || ''}`).slice(0, 10);
          medias = dadosOrdenados.map(d => d.media || 0).slice(0, 10);
        } else if (dados[0].data) {
          // Dados por tempo - já devem vir ordenados, mas garantir ordem ASC
          dadosOrdenados.sort((a, b) => {
            const dataA = new Date(a.data);
            const dataB = new Date(b.data);
            return dataA - dataB; // ASC: mais antigo primeiro
          });
          
          labels = dadosOrdenados.map(d => {
            const date = new Date(d.data);
            return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
          }).slice(0, 10);
          medias = dadosOrdenados.map(d => d.media || 0).slice(0, 10);
        }
      }

      if (labels.length === 0) {
        labels = ['Sem dados'];
        medias = [0];
      }

      if (grafico) {
        grafico.destroy();
      }

      // Detectar se é mobile
      const isMobile = window.innerWidth <= 768;
      const fontSizeBase = isMobile ? 11 : 12;
      const fontSizeLegend = isMobile ? 12 : 14;
      const tooltipPadding = isMobile ? 8 : 12;
      const tooltipFontSize = isMobile ? 12 : 13;
      const tooltipTitleSize = isMobile ? 12 : 14;
      const pointRadius = isMobile ? 3 : 5;
      const pointHoverRadius = isMobile ? 5 : 7;

      // Obter cores das variáveis CSS para Chart.js
      const root = getComputedStyle(document.documentElement);
      const colorPrimary = root.getPropertyValue('--color-primary').trim() || '#008cc4';
      const colorPrimaryDarker = root.getPropertyValue('--color-primary-darker').trim() || '#003b54';
      const colorTextLight = root.getPropertyValue('--color-text-light').trim() || '#666666';
      const colorBorderLight = root.getPropertyValue('--color-border-light').trim() || '#e0e0e0';
      
      // Converter cor primária para rgba com transparência
      const hexToRgba = (hex, alpha) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      };
      const colorPrimaryRgba = hexToRgba(colorPrimary, 0.1);

      // Reconfigurar canvas antes de criar novo gráfico (garantir alta resolução)
      // Chart.js lidará com DPI nativamente

      grafico = new Chart(ctx, {
    type: 'line',
    data: {
          labels: labels,
      datasets: [{
        label: '% de Acertos',
            data: medias,
            borderColor: colorPrimary,
            backgroundColor: colorPrimaryRgba,
        fill: true,
            tension: 0.4,
            pointRadius: pointRadius,
            pointHoverRadius: pointHoverRadius,
            pointBackgroundColor: colorPrimary,
            pointBorderColor: '#fff',
            pointBorderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      devicePixelRatio: window.devicePixelRatio || 2, // Alta resolução
      plugins: {
        legend: {
              display: true,
              position: 'top',
          labels: {
            font: {
                  size: fontSizeLegend,
                  weight: 'bold'
                },
                color: colorPrimaryDarker,
                padding: isMobile ? 10 : 15
              }
            },
            tooltip: {
              backgroundColor: colorPrimaryDarker,
              titleFont: {
                size: tooltipTitleSize,
                weight: 'bold'
              },
              bodyFont: {
                size: tooltipFontSize
              },
              padding: tooltipPadding,
              displayColors: false,
              cornerRadius: 8,
              callbacks: {
                label: function(context) {
                  return `Média: ${context.parsed.y.toFixed(1)}%`;
            }
          }
        }
      },
      scales: {
            x: {
              ticks: {
                font: {
                  size: fontSizeBase,
                  weight: 'bold'
                },
                color: colorPrimaryDarker,
                maxRotation: isMobile ? 45 : 0,
                minRotation: isMobile ? 45 : 0
              },
              grid: {
                display: false
              }
            },
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
                stepSize: 10,
            font: {
                  size: fontSizeBase,
                  weight: 'bold'
                },
                color: colorPrimaryDarker,
                callback: function(value) {
                  return value + '%';
                },
                maxTicksLimit: isMobile ? 6 : 11
              },
              grid: {
                color: colorBorderLight,
                lineWidth: 1
              }
            }
          },
          layout: {
            padding: {
              top: 10,
              right: 20,
              bottom: 10,
              left: 20
            }
          }
        }
      });
    }

    function popularDropdownSimulados(simulados) {
      const select = document.getElementById('filtroSimulado');
      if (!select) return;
      
      // Limpar opções existentes (exceto "Geral")
      select.innerHTML = '<option value="geral">Geral</option>';
      
      // Limpar cache de dados por simulado
      dadosDisciplinasPorSimulado = {};
      
      if (!simulados || simulados.length === 0) {
        select.disabled = true;
        select.style.opacity = '0.6';
        select.style.cursor = 'not-allowed';
        return;
      }
      
      select.disabled = false;
      select.style.opacity = '1';
      select.style.cursor = 'pointer';
      
      // Ordenar por data (mais recente primeiro)
      const simuladosOrdenados = [...simulados].sort((a, b) => {
        const dataA = a.data ? new Date(a.data) : new Date(0);
        const dataB = b.data ? new Date(b.data) : new Date(0);
        return dataB - dataA;
      });
      
      // Adicionar opções de simulados
      simuladosOrdenados.forEach((simulado) => {
        const option = document.createElement('option');
        option.value = simulado.id;
        option.textContent = `${simulado.nome || 'Simulado'} ${simulado.etapa ? `(${simulado.etapa})` : ''}`;
        select.appendChild(option);
      });
      
      // Resetar para "Geral"
      select.value = 'geral';
    }

    async function filtrarDisciplinasPorSimulado(event) {
      const gabaritoId = event.target.value;
      
      if (!alunoSelecionado) {
        showToast('Selecione um aluno primeiro', 'warning');
        event.target.value = 'geral'; // Resetar dropdown
        return;
      }
      
      // Se for "geral", usar dados gerais já carregados
      if (gabaritoId === 'geral') {
        atualizarGraficoDisciplinas(dadosDisciplinasGerais);
        return;
      }
      
      // Verificar se já temos os dados em cache
      if (dadosDisciplinasPorSimulado[gabaritoId]) {
        atualizarGraficoDisciplinas(dadosDisciplinasPorSimulado[gabaritoId]);
        return;
      }
      
      // Buscar dados do servidor
      const token = localStorage.getItem('token');
      if (!token) {
        window.location.href = '/login.html';
        return;
      }
      
      let requestController;
      try {
        disciplineRequestController?.abort();
        requestController = new AbortController();
        disciplineRequestController = requestController;
        const alunoIdDaRequisicao = alunoSelecionado.id;
        showLoading('Carregando desempenho por disciplina...');
        
        const response = await apiFetch(`/api/relatorios/estatisticas-individual/${alunoSelecionado.id}/disciplinas/${gabaritoId}`, {
          signal: requestController.signal,
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            localStorage.removeItem('token');
            window.location.href = '/login.html';
            return;
          }
          
          // Se for 404, pode não haver dados para esse simulado específico
          if (response.status === 404) {
            const errorData = await response.json().catch(() => ({}));
            showToast(errorData.erro || 'Nenhum dado encontrado para este simulado', 'warning');
            event.target.value = 'geral'; // Resetar para geral
            atualizarGraficoDisciplinas(dadosDisciplinasGerais);
            return;
          }
          
          // Se for 500, pode ser um erro no servidor
          if (response.status === 500) {
            const errorData = await response.json().catch(() => ({}));
            const mensagem = errorData.detalhes 
              ? `Erro no servidor: ${errorData.detalhes}` 
              : 'Erro interno do servidor. Tente novamente ou verifique os logs.';
            showToast(mensagem, 'error');
            event.target.value = 'geral';
            atualizarGraficoDisciplinas(dadosDisciplinasGerais);
            return;
          }
          
          // Para outros erros, tentar obter detalhes
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.erro || `Erro HTTP ${response.status}: Erro ao buscar desempenho por disciplina`);
        }
        
        const data = await response.json();
        if (requestController.signal.aborted || alunoSelecionado?.id !== alunoIdDaRequisicao) return;
        
        if (data.sucesso) {
          const disciplinas = data.media_por_disciplina || [];
          
          // Armazenar em cache (mesmo se for array vazio)
          dadosDisciplinasPorSimulado[gabaritoId] = disciplinas;
          
          if (disciplinas.length === 0) {
            const gabaritoNome = data.gabarito?.nome || 'este simulado';
            const gabaritoEtapa = data.gabarito?.etapa || '';
            showToast(`Este aluno não possui respostas válidas para o simulado "${gabaritoNome}${gabaritoEtapa ? ' - ' + gabaritoEtapa : ''}" ou não há disciplinas com dados.`, 'info');
            // Mostrar gráfico vazio
            atualizarGraficoDisciplinas([]);
          } else {
            atualizarGraficoDisciplinas(disciplinas);
          }
        } else {
          showToast(data.erro || 'Erro ao carregar dados do desempenho por disciplina', 'error');
          event.target.value = 'geral'; // Resetar para geral
          atualizarGraficoDisciplinas(dadosDisciplinasGerais);
        }
      } catch (error) {
        if (error.name === 'AbortError') return;
        console.error('Erro ao filtrar disciplinas:', error);
        
        // Verificar tipo de erro
        let mensagemErro = 'Erro ao filtrar disciplinas. Tente novamente.';
        
        if (error.name === 'TypeError' && (error.message.includes('Failed to fetch') || error.message.includes('ERR_CONNECTION_REFUSED') || error.message.includes('ERR_CONNECTION_RESET'))) {
          mensagemErro = 'Erro de conexão com o servidor. Verifique se o servidor está rodando na porta 3000.';
        } else if (error.message) {
          mensagemErro = error.message;
        }
        
        showToast(mensagemErro, 'error');
        
        // Resetar para geral em caso de erro
        try {
          event.target.value = 'geral';
          atualizarGraficoDisciplinas(dadosDisciplinasGerais);
        } catch (resetError) {
          console.error('Erro ao resetar para geral:', resetError);
        }
      } finally {
        hideLoading();
        if (disciplineRequestController === requestController) disciplineRequestController = null;
      }
    }

    function atualizarTabelaSimulados(simulados) {
      const corpoTabela = document.getElementById('corpoTabelaSimulados');
      const mensagemSemSimulados = document.getElementById('mensagemSemSimulados');
      const container = document.getElementById('containerRelatorioSimulados');
      
      let dados = Array.isArray(simulados) ? simulados : [];
      
      if (dados.length === 0) {
        corpoTabela.innerHTML = '';
        mensagemSemSimulados.style.display = 'block';
        return;
      }
      
      mensagemSemSimulados.style.display = 'none';
      
      // Ordenar por data (mais recente primeiro)
      dados = [...dados].sort((a, b) => {
        const dataA = a.data ? new Date(a.data) : new Date(0);
        const dataB = b.data ? new Date(b.data) : new Date(0);
        return dataB - dataA;
      });
      
      // Função auxiliar para escapar HTML
      const escapeHTML = (str) => {
        if (!str) return '';
        return String(str)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      };

      corpoTabela.innerHTML = dados.map((simulado, index) => {
        const nome = escapeHTML(simulado.nome || 'Simulado sem nome');
        const etapa = escapeHTML(simulado.etapa || 'N/A');
        const gabaritoId = simulado.id;
        const totalQuestoes = Number(simulado.total_questoes || 0);
        const questoesCapturadas = Number(simulado.questoes_capturadas || 0);
        const acertos = Number(simulado.acertos || 0);
        const media = Number(simulado.media || 0);
        const dataFormatada = simulado.data 
          ? new Date(simulado.data).toLocaleDateString('pt-BR', { 
              day: '2-digit', 
              month: '2-digit', 
              year: 'numeric' 
            })
          : 'N/A';
        
        // Cor da linha baseada na média
        let corFundo = 'transparent';
        let corTexto = '#003b54';
        if (media >= 70) {
          corFundo = 'rgba(46, 204, 113, 0.1)';
        } else if (media >= 50) {
          corFundo = 'rgba(241, 196, 15, 0.1)';
        } else {
          corFundo = 'rgba(231, 76, 60, 0.1)';
        }
        
        // Cor da média
        let corMedia = '#003b54';
        if (media >= 70) {
          corMedia = '#2ecc71';
        } else if (media >= 50) {
          corMedia = '#f1c40f';
        } else {
          corMedia = '#e74c3c';
        }
        
        // Cor para questões capturadas (verde se todas foram capturadas, amarelo se parcial, vermelho se poucas)
        let corQuestoesCapturadas = '#666';
        if (totalQuestoes > 0) {
          const percentualCapturado = (questoesCapturadas / totalQuestoes) * 100;
          if (percentualCapturado >= 90) {
            corQuestoesCapturadas = '#2ecc71';
          } else if (percentualCapturado >= 50) {
            corQuestoesCapturadas = '#f1c40f';
          } else {
            corQuestoesCapturadas = '#e74c3c';
          }
        }
        
        return `
          <tr id="simulado-row-${escapeHTML(gabaritoId)}" class="report-simulation-row" style="background: ${corFundo};">
            <td data-label="Simulado" class="report-simulation-trigger" data-action="toggle-details" data-simulado-id="${escapeHTML(gabaritoId)}" style="color: ${corTexto};"
                title="Clique para ver detalhes do gabarito">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span id="icon-${gabaritoId}" style="transition: transform 0.3s; flex-shrink: 0;">▶</span>
                <span style="white-space: nowrap;">${nome}</span>
              </div>
            </td>
            <td data-label="Etapa" style="padding: 12px 16px; border-bottom: 1px solid #e0e0e0; text-align: center; color: #666;">
              ${etapa}
            </td>
            <td data-label="Questões" style="padding: 12px 16px; border-bottom: 1px solid #e0e0e0; text-align: center; color: #666;">
              ${totalQuestoes.toLocaleString('pt-BR')}
            </td>
            <td data-label="Capturadas" style="padding: 12px 16px; border-bottom: 1px solid #e0e0e0; text-align: center; color: ${corQuestoesCapturadas}; font-weight: 600;">
              ${questoesCapturadas.toLocaleString('pt-BR')}
            </td>
            <td data-label="Acertos" style="padding: 12px 16px; border-bottom: 1px solid #e0e0e0; text-align: center; color: #666; font-weight: 600;">
              ${acertos.toLocaleString('pt-BR')}
            </td>
            <td data-label="Média" style="padding: 12px 16px; border-bottom: 1px solid #e0e0e0; text-align: center; font-weight: 700; color: ${corMedia}; font-size: 15px;">
              ${media.toFixed(1)}%
            </td>
            <td data-label="Data" style="padding: 12px 16px; border-bottom: 1px solid #e0e0e0; text-align: center; color: #666;">
              ${dataFormatada}
            </td>
            <td data-label="Cartão" style="padding: 12px 16px; border-bottom: 1px solid #e0e0e0; text-align: center;">
              <button type="button" class="report-card-button"
                data-action="view-card" data-simulado-id="${escapeHTML(gabaritoId)}"
                title="Ver cartão enviado"
                aria-label="Ver cartão do simulado"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#008cc4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </button>
            </td>
          </tr>
          <tr id="detalhes-${gabaritoId}" style="display: none;">
            <td colspan="8" style="padding: 0; border-bottom: 1px solid #e0e0e0; background: #f8f9fa;">
              <div id="conteudo-detalhes-${gabaritoId}" style="padding: 20px;">
                <div style="text-align: center; color: #666;">
                  <div class="loading-spinner" style="display: inline-block; width: 20px; height: 20px; border: 3px solid rgba(0,140,196,.3); border-radius: 50%; border-top-color: #008cc4; animation: spin 1s ease-in-out infinite;"></div>
                  <span style="margin-left: 10px;">Carregando detalhes...</span>
                </div>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    function atualizarGraficoDisciplinas(disciplinas) {
      const canvas = document.getElementById('graficoDisciplinas');
      if (!canvas) {
        console.error('Canvas graficoDisciplinas não encontrado');
        return;
      }
      
      const ctx = canvas.getContext('2d');
      let dados = Array.isArray(disciplinas) ? disciplinas : [];
      
      // Configurar alta resolução para telas Retina
      // Chart.js lidará com DPI nativamente
      
      // Se não houver dados, mostrar gráfico vazio com mensagem
      if (dados.length === 0) {
        if (graficoDisciplinas) {
          graficoDisciplinas.destroy();
        }
        
        // Reconfigurar canvas antes de criar novo gráfico
        // Chart.js lidará com DPI nativamente
        
        // Obter cores das variáveis CSS
        const rootEmpty = getComputedStyle(document.documentElement);
        const colorBorderLightEmpty = rootEmpty.getPropertyValue('--color-border-light').trim() || '#e0e0e0';
        const colorBorderEmpty = rootEmpty.getPropertyValue('--color-border').trim() || '#cccccc';
        
        graficoDisciplinas = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: ['Sem dados'],
            datasets: [{
              label: 'Questões',
              data: [0],
              backgroundColor: colorBorderLightEmpty,
              borderColor: colorBorderEmpty,
              borderWidth: 2
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            devicePixelRatio: window.devicePixelRatio || 2,
            plugins: {
              legend: { display: false },
              tooltip: { enabled: false }
            },
            scales: {
              y: { beginAtZero: true }
            }
          }
        });
        return;
      }
      
      // Ordenar por média de acertos (maior para menor) para melhor visualização
      // O backend já calcula a média corretamente, então usamos o valor 'media' diretamente
      dados = [...dados].sort((a, b) => {
        const mediaA = Number(a.media || 0);
        const mediaB = Number(b.media || 0);
        return mediaB - mediaA;
      });

      const labels = dados.map(d => {
        const nome = d.nome || 'Disciplina';
        // Não encurtar nomes, deixar completos para melhor legibilidade
        return nome;
      });

      // Usar a média que já vem calculada do backend (já está em percentual 0-100)
      const medias = dados.map(d => Number(d.media || 0));

      if (graficoDisciplinas) {
        graficoDisciplinas.destroy();
      }

      // Detectar se é mobile
      const isMobileDisciplinas = window.innerWidth <= 768;
      const fontSizeBaseDisciplinas = isMobileDisciplinas ? 11 : 12;
      const fontSizeYDisciplinas = isMobileDisciplinas ? 11 : 13;
      const tooltipPaddingDisciplinas = isMobileDisciplinas ? 8 : 12;
      const tooltipFontSizeDisciplinas = isMobileDisciplinas ? 12 : 13;
      const tooltipTitleSizeDisciplinas = isMobileDisciplinas ? 12 : 14;
      const barThicknessDisciplinas = isMobileDisciplinas ? 20 : 28;

      // Obter cores das variáveis CSS para Chart.js
      const rootDisciplinas = getComputedStyle(document.documentElement);
      const colorPrimaryDisciplinas = rootDisciplinas.getPropertyValue('--color-primary').trim() || '#008cc4';
      const colorPrimaryDarkerDisciplinas = rootDisciplinas.getPropertyValue('--color-primary-darker').trim() || '#003b54';
      const colorTextLightDisciplinas = rootDisciplinas.getPropertyValue('--color-text-light').trim() || '#666666';
      const colorTextDisciplinas = rootDisciplinas.getPropertyValue('--color-text').trim() || '#333333';
      const colorBorderLightDisciplinas = rootDisciplinas.getPropertyValue('--color-border-light').trim() || '#e0e0e0';

      // Reconfigurar canvas antes de criar novo gráfico (garantir alta resolução)
      // Chart.js lidará com DPI nativamente

      graficoDisciplinas = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels.length > 0 ? labels : ['Sem dados'],
          datasets: [{
            label: 'Taxa de Acertos (%)',
            data: medias.length > 0 ? medias : [0],
            backgroundColor: colorPrimaryDisciplinas,
            borderRadius: 8,
            barThickness: barThicknessDisciplinas,
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          devicePixelRatio: window.devicePixelRatio || 2,
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              backgroundColor: colorPrimaryDarkerDisciplinas,
              padding: tooltipPaddingDisciplinas,
              titleFont: {
                size: tooltipTitleSizeDisciplinas,
                weight: '600'
              },
              bodyFont: {
                size: tooltipFontSizeDisciplinas
              },
              cornerRadius: 8,
              callbacks: {
                label: context => {
                  const disciplina = dados[context.dataIndex];
                  const totalQuestoes = disciplina ? Number(disciplina.total_questoes || 0) : 0;
                  const acertos = disciplina ? Number(disciplina.acertos || 0) : 0;
                  // Mostrar total de questões da disciplina (não apenas as respondidas válidamente)
                  // Isso reflete corretamente o cálculo da média na barra
                  return `Taxa de acertos: ${context.raw.toFixed(1)}% (${acertos.toLocaleString('pt-BR')} de ${totalQuestoes.toLocaleString('pt-BR')} questões)`;
                }
              }
            }
          },
          scales: {
            x: {
              beginAtZero: true,
              max: 100,
              ticks: {
                callback: value => `${value}%`,
                font: {
                  size: fontSizeBaseDisciplinas
                },
                color: colorTextLightDisciplinas,
                maxTicksLimit: isMobileDisciplinas ? 5 : 10
              },
              grid: {
                color: colorBorderLightDisciplinas
              }
            },
            y: {
              ticks: {
                font: { size: fontSizeYDisciplinas, weight: '500' },
                color: colorTextDisciplinas,
                maxTicksLimit: isMobileDisciplinas ? 8 : undefined
              },
              grid: { display: false }
            }
          }
        }
      });
    }

    // Fechar sugestões ao clicar fora
    document.addEventListener('click', function(event) {
      const sugestoesDiv = document.getElementById('sugestoesAlunos');
      const buscaInput = document.getElementById('buscaAluno');
      const buscaContainer = buscaInput ? buscaInput.closest('.input-group') : null;
      
      if (buscaContainer && !buscaContainer.contains(event.target)) {
        fecharSugestoes();
      }
    });

    // Limpar seleção quando o campo for limpo
    document.getElementById('buscaAluno').addEventListener('input', function(e) {
      if (e.target.value.trim() === '') {
        reportRequestController?.abort();
        disciplineRequestController?.abort();
        alunoSelecionado = null;
        reportVersion += 1;
        renderReportState(REPORT_STATES.INITIAL);
        expandSearchCard(false);
      }
    });

    async function toggleDetalhesSimulado(gabaritoId, alunoId) {
      const detalhesRow = document.getElementById(`detalhes-${gabaritoId}`);
      const icon = document.getElementById(`icon-${gabaritoId}`);
      const conteudoDiv = document.getElementById(`conteudo-detalhes-${gabaritoId}`);
      
      if (!detalhesRow) return;
      
      // Se alunoId não foi fornecido, tentar pegar de alunoSelecionado
      if (!alunoId && alunoSelecionado && alunoSelecionado.id) {
        alunoId = alunoSelecionado.id;
      }
      
      if (!alunoId) {
        showToast('Erro: Aluno não selecionado', 'error');
        return;
      }

      // Alternar visibilidade
      const isVisible = detalhesRow.style.display !== 'none';
      
      if (isVisible) {
        // Fechar
        detalhesRow.style.display = 'none';
        icon.style.transform = 'rotate(0deg)';
        icon.textContent = '▶';
      } else {
        // Abrir
        detalhesRow.style.display = 'table-row';
        icon.style.transform = 'rotate(90deg)';
        icon.textContent = '▼';
        
        // Se ainda não carregou os dados, carregar agora
        if (conteudoDiv.innerHTML.includes('Carregando detalhes')) {
          await carregarDetalhesSimulado(gabaritoId, alunoId);
        }
      }
    }

    async function carregarDetalhesSimulado(gabaritoId, alunoId) {
      const conteudoDiv = document.getElementById(`conteudo-detalhes-${gabaritoId}`);
      const token = localStorage.getItem('token');
      const versaoDaConsulta = reportVersion;
      
      if (!token) {
        conteudoDiv.innerHTML = '<div style="color: #e74c3c; text-align: center; padding: 20px;">Erro: Token não encontrado</div>';
        return;
      }

      try {
        // Buscar questões do gabarito e respostas do aluno em paralelo
        const [questoesRes, respostasRes] = await Promise.all([
          apiFetch(`/api/questoes/gabarito/${gabaritoId}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }),
          apiFetch(`/api/respostas?aluno_id=${alunoId}&gabarito_id=${gabaritoId}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          })
        ]);

        if (!questoesRes.ok || !respostasRes.ok) {
          throw new Error('Erro ao carregar dados');
        }

        const questoesData = await questoesRes.json();
        const respostasData = await respostasRes.json();
        if (versaoDaConsulta !== reportVersion || alunoSelecionado?.id !== alunoId) return;

        const questoes = questoesData.questoes || [];
        const respostas = respostasData.respostas || [];

        // Criar mapa de respostas por questão_id
        const mapaRespostas = {};
        respostas.forEach(resposta => {
          if (resposta.resposta_aluno && 
              resposta.resposta_aluno.trim() !== '' && 
              !resposta.resposta_aluno.includes(',')) {
            mapaRespostas[resposta.questao_id] = resposta.resposta_aluno.trim().toUpperCase();
          }
        });

        // Ordenar questões por número
        const questoesOrdenadas = [...questoes].sort((a, b) => Number(a.numero) - Number(b.numero));

        // Gerar HTML da tabela de detalhes
        let html = `
          <div style="background: white; border-radius: 8px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <h4 style="margin: 0 0 16px 0; color: #003b54; font-size: 16px; font-weight: 600;">
              Detalhes do Gabarito
            </h4>
            <div style="overflow-x: auto;">
              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead>
                  <tr style="background: #f0f7fa; border-bottom: 2px solid #008cc4;">
                    <th style="padding: 10px 12px; text-align: center; font-weight: 600; color: #003b54; width: 80px;">Questão</th>
                    <th style="padding: 10px 12px; text-align: center; font-weight: 600; color: #003b54; width: 120px;">Gabarito</th>
                    <th style="padding: 10px 12px; text-align: center; font-weight: 600; color: #003b54; width: 120px;">Capturada</th>
                    <th style="padding: 10px 12px; text-align: center; font-weight: 600; color: #003b54;">Status</th>
                  </tr>
                </thead>
                <tbody>
        `;

        questoesOrdenadas.forEach(questao => {
          const numero = questao.numero;
          const gabarito = (questao.resposta_correta || '').trim().toUpperCase();
          const capturada = mapaRespostas[questao.id] || '-';
          const acertou = capturada !== '-' && capturada === gabarito;
          
          let statusHtml = '';
          let statusColor = '#666';
          
          if (capturada === '-') {
            statusHtml = '<span style="color: #666;">Não respondida</span>';
          } else if (acertou) {
            statusHtml = '<span style="color: #2ecc71; font-weight: 600;">✓ Acertou</span>';
            statusColor = '#2ecc71';
          } else {
            statusHtml = '<span style="color: #e74c3c; font-weight: 600;">✗ Errou</span>';
            statusColor = '#e74c3c';
          }

          html += `
            <tr style="border-bottom: 1px solid #e0e0e0;">
              <td style="padding: 10px 12px; text-align: center; font-weight: 600; color: #003b54;">${escapeHtml(numero)}</td>
              <td style="padding: 10px 12px; text-align: center; font-weight: 600; color: #008cc4; font-size: 14px;">${escapeHtml(gabarito || '-')}</td>
              <td style="padding: 10px 12px; text-align: center; font-weight: 600; color: ${statusColor}; font-size: 14px;">${escapeHtml(capturada)}</td>
              <td style="padding: 10px 12px; text-align: center;">${statusHtml}</td>
            </tr>
          `;
        });

        html += `
                </tbody>
              </table>
            </div>
          </div>
        `;

        conteudoDiv.innerHTML = html;

      } catch (error) {
        console.error('Erro ao carregar detalhes:', error);
        conteudoDiv.innerHTML = `
          <div style="color: #e74c3c; text-align: center; padding: 20px;">
            Erro ao carregar detalhes do simulado. Tente novamente.
          </div>
        `;
      }
    }

    // Função para visualizar o cartão (imagem) do simulado
    async function verCartao(gabaritoId, alunoId) {
      if (!alunoId && alunoSelecionado && alunoSelecionado.id) {
        alunoId = alunoSelecionado.id;
      }
      
      if (!alunoId) {
        showToast('Erro: Aluno não selecionado', 'error');
        return;
      }

      try {
        const versaoDaConsulta = reportVersion;
        showLoading('Carregando cartão...');
        
        // Buscar respostas do aluno para este gabarito para encontrar a imagem
        const token = localStorage.getItem('token');
        if (!token) {
          window.location.href = '/login.html';
          return;
        }

        // Buscar informações sobre o gabarito e tentar encontrar a imagem mais recente
        // Como não há relação direta, vamos buscar todas as imagens e encontrar a mais recente
        // que foi processada para este aluno/gabarito
        const response = await apiFetch(`/api/respostas?aluno_id=${alunoId}&gabarito_id=${gabaritoId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error('Erro ao buscar informações do cartão');
        }

        const data = await response.json();
        if (versaoDaConsulta !== reportVersion || alunoSelecionado?.id !== alunoId) return;
        const respostas = data.respostas || [];
        
        if (respostas.length === 0) {
          showToast('Nenhuma resposta encontrada para este simulado', 'warning');
          return;
        }

        // Buscar a imagem mais recente processada para este aluno/gabarito
        const imagemResponse = await apiFetch(`/api/respostas/imagem/${alunoId}/${gabaritoId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        let imagemUrl = null;
        if (imagemResponse.ok) {
          const imagemData = await imagemResponse.json();
          if (versaoDaConsulta !== reportVersion || alunoSelecionado?.id !== alunoId) return;
          if (imagemData.sucesso && imagemData.imagem) {
            imagemUrl = imagemData.imagem;
          }
        }

        // Exibir modal com a imagem (se encontrada) ou buscar
        exibirModalCartao(imagemUrl, gabaritoId, alunoId);
        
      } catch (error) {
        console.error('Erro ao buscar cartão:', error);
        showToast('Erro ao carregar cartão. Tentando método alternativo...', 'warning');
        
        // Tentar método alternativo: buscar diretamente do diretório de uploads
        exibirModalCartao(null, gabaritoId, alunoId);
      } finally {
        hideLoading();
      }
    }

    // Função para exibir modal com o cartão
    function exibirModalCartao(imagemUrl, gabaritoId, alunoId) {
      // Remover modal existente se houver
      const modalExistente = document.getElementById('modalCartao');
      if (modalExistente) {
        modalExistente.remove();
      }

      // Criar modal
      const modal = document.createElement('div');
      modal.id = 'modalCartao';
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--spacing-xl);
        box-sizing: border-box;
      `;

      modal.innerHTML = `
        <div style="
          background: white;
          border-radius: var(--radius-md);
          max-width: 90%;
          max-height: 90%;
          position: relative;
          box-shadow: var(--shadow-xl);
          display: flex;
          flex-direction: column;
        ">
          <div style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: var(--spacing-lg);
            border-bottom: 1px solid var(--color-border-light);
          ">
            <h3 style="margin: 0; color: var(--color-primary-darker); font-size: var(--font-size-lg);">
              Cartão do Simulado
            </h3>
            <button 
              onclick="document.getElementById('modalCartao').remove()"
              style="
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: var(--color-text-light);
                padding: 0;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: var(--radius-sm);
                transition: background 0.2s;
              "
              onmouseover="this.style.background='rgba(0,0,0,0.1)'"
              onmouseout="this.style.background='none'"
              aria-label="Fechar modal"
            >
              ×
            </button>
          </div>
          <div style="
            padding: var(--spacing-xl);
            overflow: auto;
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 400px;
          ">
            ${imagemUrl 
              ? `<img 
                  src="${imagemUrl}" 
                  alt="Cartão do simulado"
                  style="max-width: 100%; max-height: 70vh; border-radius: var(--radius-sm); box-shadow: var(--shadow-md);"
                  onerror="this.parentElement.innerHTML='<div style=\'text-align: center; color: #666; padding: 40px;\'><div style=\'font-size: 48px; margin-bottom: 16px;\'>📷</div><p>Imagem não encontrada ou não disponível</p><p style=\'font-size: 14px; color: #999;\'>O cartão pode não ter sido enviado ou processado ainda.</p></div>'"
                />`
              : `<div style="text-align: center; color: #666; padding: 40px;">
                  <div style="font-size: 48px; margin-bottom: 16px;">🔍</div>
                  <p>Buscando imagem do cartão...</p>
                  <p style="font-size: 14px; color: #999; margin-top: 16px;">
                    Se a imagem não aparecer, ela pode não estar disponível no servidor.
                  </p>
                  <button 
                    onclick="buscarImagemCartao('${gabaritoId}', '${alunoId}')"
                    style="
                      margin-top: 20px;
                      padding: var(--spacing-sm) var(--spacing-md);
                      background: var(--color-primary);
                      color: white;
                      border: none;
                      border-radius: var(--radius-sm);
                      cursor: pointer;
                      font-size: var(--font-size-sm);
                    "
                  >
                    Tentar novamente
                  </button>
                </div>`
            }
          </div>
        </div>
      `;

      // Fechar ao clicar fora do modal
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.remove();
        }
      });

      // Fechar com ESC
      const fecharComEsc = (e) => {
        if (e.key === 'Escape') {
          modal.remove();
          document.removeEventListener('keydown', fecharComEsc);
        }
      };
      document.addEventListener('keydown', fecharComEsc);

      document.body.appendChild(modal);
      
      // Se não há URL, tentar buscar
      if (!imagemUrl) {
        buscarImagemCartao(gabaritoId, alunoId);
      }
    }

    // Função auxiliar para buscar imagem do cartão
    async function buscarImagemCartao(gabaritoId, alunoId) {
      try {
        if (!alunoSelecionado || String(alunoSelecionado.id) !== String(alunoId)) return;
        const versaoDaConsulta = reportVersion;
        const token = localStorage.getItem('token');
        if (!token) {
          window.location.href = '/login.html';
          return;
        }

        // Mostrar loading no modal
        const modalContent = document.querySelector('#modalCartao > div > div:last-child');
        if (modalContent) {
          modalContent.innerHTML = `
            <div style="text-align: center; color: #666; padding: 40px;">
              <div style="font-size: 48px; margin-bottom: 16px;">🔍</div>
              <p>Buscando imagem do cartão...</p>
            </div>
          `;
        }

        // Buscar imagem via endpoint da API
        const response = await apiFetch(`/api/respostas/imagem/${alunoId}/${gabaritoId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (versaoDaConsulta !== reportVersion || String(alunoSelecionado?.id) !== String(alunoId)) return;
          
          if (data.sucesso && data.imagem) {
            // Imagem encontrada - atualizar modal com a imagem
            if (modalContent) {
              modalContent.innerHTML = `
                <img 
                  src="${data.imagem}" 
                  alt="Cartão do simulado"
                  style="max-width: 100%; max-height: 70vh; border-radius: var(--radius-sm); box-shadow: var(--shadow-md);"
                  onerror="this.parentElement.innerHTML='<div style=\'text-align: center; color: #666; padding: 40px;\'><div style=\'font-size: 48px; margin-bottom: 16px;\'>📷</div><p>Erro ao carregar imagem</p><p style=\'font-size: 14px; color: #999;\'>A imagem pode ter sido movida ou excluída.</p></div>'"
                />
              `;
            }
            return;
          }
        }

        // Se chegou aqui, não encontrou a imagem
        if (modalContent) {
          modalContent.innerHTML = `
            <div style="text-align: center; color: #666; padding: 40px;">
              <div style="font-size: 48px; margin-bottom: 16px;">📷</div>
              <p>Imagem do cartão não encontrada.</p>
              <p style="font-size: 14px; color: #999; margin-top: 16px;">
                A imagem pode não ter sido processada ainda ou a correção não foi finalizada.
              </p>
              <button 
                onclick="buscarImagemCartao('${gabaritoId}', '${alunoId}')"
                style="
                  margin-top: 20px;
                  padding: var(--spacing-sm) var(--spacing-md);
                  background: var(--color-primary);
                  color: white;
                  border: none;
                  border-radius: var(--radius-sm);
                  cursor: pointer;
                  font-size: var(--font-size-sm);
                "
              >
                Tentar novamente
              </button>
            </div>
          `;
        }
      } catch (error) {
        console.error('Erro ao buscar imagem:', error);
        const modalContent = document.querySelector('#modalCartao > div > div:last-child');
        if (modalContent) {
          modalContent.innerHTML = `
            <div style="text-align: center; color: #666; padding: 40px;">
              <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
              <p>Erro ao buscar imagem do cartão.</p>
              <p style="font-size: 14px; color: #999; margin-top: 16px;">
                ${error.message || 'Erro desconhecido'}
              </p>
              <button 
                onclick="buscarImagemCartao('${gabaritoId}', '${alunoId}')"
                style="
                  margin-top: 20px;
                  padding: var(--spacing-sm) var(--spacing-md);
                  background: var(--color-primary);
                  color: white;
                  border: none;
                  border-radius: var(--radius-sm);
                  cursor: pointer;
                  font-size: var(--font-size-sm);
                "
              >
                Tentar novamente
              </button>
            </div>
          `;
        }
      }
    }

    // Adicionar animação de spin para o spinner
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
