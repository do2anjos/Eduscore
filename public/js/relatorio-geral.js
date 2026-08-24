    let grafico = null;
    let graficoRetencao = null;
    let dadosEstatisticas = null;
    let etapasDisponiveis = [];

    const reportChartValueLabelsPlugin = {
      id: 'reportChartValueLabels',
      afterDatasetsDraw(chart) {
        const dataset = chart.data.datasets?.[0];
        const bars = chart.getDatasetMeta(0)?.data || [];
        const chartArea = chart.chartArea;

        if (!dataset || !chartArea) return;

        const options = chart.options.plugins?.reportChartValueLabels || {};
        const labelColor = options.color || '#334155';
        const inverseColor = options.inverseColor || '#ffffff';
        const { ctx } = chart;

        ctx.save();
        ctx.font = '600 12px Atkinson Hyperlegible, sans-serif';
        ctx.textBaseline = 'middle';

        bars.forEach((bar, index) => {
          const value = Number(dataset.data[index]);
          if (!Number.isFinite(value)) return;

          const label = `${value.toFixed(1)}%`;
          const labelWidth = ctx.measureText(label).width;
          const hasExternalSpace = bar.x + labelWidth + 12 <= chartArea.right;

          ctx.fillStyle = hasExternalSpace ? labelColor : inverseColor;
          ctx.textAlign = hasExternalSpace ? 'left' : 'right';
          ctx.fillText(label, hasExternalSpace ? bar.x + 8 : bar.x - 8, bar.y);
        });

        ctx.restore();
      }
    };

    // Carregar dados ao inicializar
    document.addEventListener('DOMContentLoaded', async () => {
      setupReportAnalysisTabs();
      await carregarEstatisticas();
      await loadUserData();
    });

    function setupReportAnalysisTabs() {
      const tabs = Array.from(document.querySelectorAll('[data-report-analysis-tab]'));
      if (!tabs.length) return;

      tabs.forEach((tab, index) => {
        tab.addEventListener('click', () => {
          switchReportAnalysis(tab.dataset.reportAnalysisTab);
        });

        tab.addEventListener('keydown', (event) => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;

          event.preventDefault();
          let nextIndex = index;
          if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
          if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
          if (event.key === 'Home') nextIndex = 0;
          if (event.key === 'End') nextIndex = tabs.length - 1;

          const nextTab = tabs[nextIndex];
          switchReportAnalysis(nextTab.dataset.reportAnalysisTab);
          nextTab.focus();
        });
      });
    }

    function switchReportAnalysis(analysis) {
      if (!['indicators', 'discipline-averages', 'retention'].includes(analysis)) return;

      const isDisciplineAverages = analysis === 'discipline-averages';
      const isRetention = analysis === 'retention';
      const subtitle = document.getElementById('reportAnalysisSubtitle');
      const tabs = document.querySelectorAll('[data-report-analysis-tab]');
      const panels = document.querySelectorAll('.report-analysis-card .analysis-panel');

      tabs.forEach(tab => {
        const isActive = tab.dataset.reportAnalysisTab === analysis;
        tab.classList.toggle('is-active', isActive);
        tab.setAttribute('aria-selected', String(isActive));
        tab.tabIndex = isActive ? 0 : -1;
      });

      panels.forEach(panel => {
        const activePanelId = isDisciplineAverages
          ? 'reportDisciplineAveragesPanel'
          : isRetention
            ? 'reportRetentionPanel'
            : 'reportIndicatorsPanel';
        const isActive = panel.id === activePanelId;
        panel.hidden = !isActive;
        panel.classList.toggle('is-active', isActive);
      });

      if (subtitle) {
        subtitle.textContent = isDisciplineAverages
          ? 'Comparação do desempenho médio entre as disciplinas'
          : isRetention
            ? 'Taxa de erro por disciplina, da maior para a menor'
            : 'Resumo dos indicadores gerais das turmas';
      }

      if (isDisciplineAverages && grafico) {
        requestAnimationFrame(() => grafico.resize());
      }
      if (isRetention && graficoRetencao) {
        requestAnimationFrame(() => graficoRetencao.resize());
      }
    }

    async function carregarEstatisticas(etapaFiltro = null) {
      const token = localStorage.getItem('token');
      if (!token) {
        window.location.href = '/login.html';
        return;
      }

      try {
        showLoading();
        
        // Adicionar filtro de etapa na URL se especificado
        let url = '/api/relatorios/estatisticas-gerais';
        if (etapaFiltro && etapaFiltro !== 'Geral') {
          url += `?etapa=${encodeURIComponent(etapaFiltro)}`;
        }
        
        const response = await apiFetch(url, {
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
          throw new Error('Erro ao carregar estatísticas');
        }

        const data = await response.json();
        
        if (data.sucesso && data.estatisticas) {
          dadosEstatisticas = data.estatisticas;
          atualizarMetricas();
          atualizarSelectEtapas();

          // Ajustar seleção do filtro para refletir o filtro atual
          const select = document.getElementById('filtroTurma');
          const valorDesejado = etapaFiltro && etapaFiltro !== 'Geral' ? etapaFiltro : 'Geral';
          if ([...select.options].some(opt => opt.value === valorDesejado)) {
            select.value = valorDesejado;
          } else {
            select.value = 'Geral';
          }

          inicializarGrafico();
          inicializarGraficoRetencao();
        } else {
          showToast('Erro ao carregar dados do relatório', 'error');
        }
      } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
        showToast('Erro ao carregar estatísticas. Tente novamente.', 'error');
      } finally {
        hideLoading();
      }
    }

    function atualizarMetricas() {
      if (!dadosEstatisticas) return;

      const stats = dadosEstatisticas;
      
      // Formatar números com separador de milhar
      document.getElementById('qtdQuestoes').textContent = 
        stats.total_questoes.toLocaleString('pt-BR');
      document.getElementById('acertosTotais').textContent = 
        stats.total_acertos.toLocaleString('pt-BR');
      document.getElementById('mediaAluno').textContent = 
        stats.media_geral.toFixed(1) + '%';
      document.getElementById('maiorMediaDisciplina').textContent = 
        stats.maior_media_disciplina || '-';
      document.getElementById('menorMediaDisciplina').textContent = 
        stats.menor_media_disciplina || '-';
    }

    function atualizarSelectEtapas() {
      if (!dadosEstatisticas || !dadosEstatisticas.por_etapa) return;

      const select = document.getElementById('filtroTurma');
      const etapas = dadosEstatisticas.por_etapa;
      
      // Limpar opções existentes (exceto "Geral")
      while (select.options.length > 1) {
        select.remove(1);
      }

      // Adicionar etapas disponíveis
      etapas.forEach(etapa => {
        if (etapa.etapa) {
          const option = document.createElement('option');
          option.value = etapa.etapa;
          option.textContent = etapa.etapa;
          select.appendChild(option);
        }
      });

      etapasDisponiveis = etapas;
    }

    function renderizarGraficoPorDisciplina({ canvasId, chartAtual, campo, label, cor, tooltip }) {
      if (!dadosEstatisticas) return;

      // Destruir gráfico existente se houver
      if (chartAtual) {
        chartAtual.destroy();
      }

      const ctx = document.getElementById(canvasId).getContext('2d');
      
      const dadosGeral = dadosEstatisticas.media_por_disciplina || [];
      
      // Ordenar do maior para o menor e encurtar nomes longos.
      const dadosOrdenados = [...dadosGeral].sort((a, b) => {
        return Number(b[campo] || 0) - Number(a[campo] || 0);
      });
      
      const labels = dadosOrdenados.map(d => {
        // Encurtar nomes longos para melhor visualização
        const nome = d.nome;
        if (nome.length > 30) {
          return nome.substring(0, 27) + '...';
        }
        return nome;
      });
      const valores = dadosOrdenados.map(d => Number(d[campo] || 0));

      // Detectar se é mobile
      const isMobile = window.innerWidth <= 768;
      const fontSizeBase = isMobile ? 11 : 12;
      const fontSizeY = isMobile ? 11 : 13;
      const tooltipPadding = isMobile ? 8 : 12;
      const tooltipFontSize = isMobile ? 12 : 13;
      const tooltipTitleSize = isMobile ? 12 : 14;
      const barThickness = isMobile ? 20 : 28;

      // Obter cores das variáveis CSS para Chart.js
      const root = getComputedStyle(document.documentElement);
      const colorPrimaryDarker = root.getPropertyValue('--color-primary-darker').trim() || '#003b54';
      const colorTextLight = root.getPropertyValue('--color-text-light').trim() || '#666666';
      const colorText = root.getPropertyValue('--color-text').trim() || '#333333';
      const colorBorderLight = root.getPropertyValue('--color-border-light').trim() || '#e0e0e0';

      return new Chart(ctx, {
        type: 'bar',
        plugins: [reportChartValueLabelsPlugin],
        data: {
          labels: labels.length > 0 ? labels : ['Sem dados'],
          datasets: [{
            label: label,
            data: valores.length > 0 ? valores : [0],
            backgroundColor: cor,
            borderRadius: 8,
            barThickness: barThickness,
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            reportChartValueLabels: {
              color: colorText,
              inverseColor: '#ffffff'
            },
            legend: {
              display: false
            },
            tooltip: {
              backgroundColor: colorPrimaryDarker,
              padding: tooltipPadding,
              titleFont: {
                size: tooltipTitleSize,
                weight: '600'
              },
              bodyFont: {
                size: tooltipFontSize
              },
              cornerRadius: 8,
              callbacks: {
                label: context => tooltip(context, dadosOrdenados)
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
                  size: fontSizeBase
                },
                color: colorTextLight,
                maxTicksLimit: isMobile ? 5 : 10
              },
              grid: {
                color: colorBorderLight
              }
            },
            y: {
              ticks: {
                font: {
                  size: fontSizeY,
                  weight: '500'
                },
                color: colorText,
                maxTicksLimit: isMobile ? 8 : undefined
              },
              grid: {
                display: false
              }
            }
          }
        }
      });
    }

    function inicializarGrafico() {
      const root = getComputedStyle(document.documentElement);
      const colorPrimary = root.getPropertyValue('--color-primary').trim() || '#008cc4';

      grafico = renderizarGraficoPorDisciplina({
        canvasId: 'graficoGeralTurmas',
        chartAtual: grafico,
        campo: 'media',
        label: 'Média de Acertos (%)',
        cor: colorPrimary,
        tooltip: context => `Média: ${Number(context.raw).toFixed(1)}%`
      });
    }

    function inicializarGraficoRetencao() {
      const root = getComputedStyle(document.documentElement);
      const colorError = root.getPropertyValue('--color-error').trim() || '#dc3545';

      graficoRetencao = renderizarGraficoPorDisciplina({
        canvasId: 'graficoRetencaoDisciplinas',
        chartAtual: graficoRetencao,
        campo: 'taxa_erro',
        label: 'Retenção (%)',
        cor: colorError,
        tooltip: (context, disciplinas) => {
          const disciplina = disciplinas[context.dataIndex];
          const taxaErro = Number(context.raw) || 0;
          const erros = Number(disciplina?.erros) || 0;
          const totalRespostas = Number(disciplina?.total_respostas) || 0;
          return `Retenção: ${taxaErro.toFixed(1)}% (${erros.toLocaleString('pt-BR')} de ${totalRespostas.toLocaleString('pt-BR')} respostas)`;
        }
      });
    }

    async function atualizarGrafico() {
      const turma = document.getElementById('filtroTurma').value;
      
      try {
        showLoading('Atualizando gráfico...');
        
        // Recarregar dados com filtro de etapa
        await carregarEstatisticas(turma);
        
        // Os gráficos serão atualizados automaticamente por carregarEstatisticas.
      } catch (error) {
        console.error('Erro ao atualizar gráfico:', error);
        showToast('Erro ao atualizar gráfico. Tente novamente.', 'error', 5000);
      } finally {
        hideLoading();
      }
    }

    function showLoading() {
      // Mostrar indicador de carregamento se necessário
      const cards = document.querySelectorAll('.metric-card-modern .value-number');
      cards.forEach(card => {
        if (card.textContent === '0' || card.textContent === '-') {
          card.textContent = '...';
        }
      });
    }

    function hideLoading() {
      // Ocultar indicador de carregamento
    }
