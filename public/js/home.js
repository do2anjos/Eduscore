    let chartProgresso = null;
    let chartRetencao = null;
    let dashboardStats = null;
    let retentionRendered = false;
    let activeAnalysis = 'progress';

    const chartValueLabelsPlugin = {
      id: 'chartValueLabels',
      afterDatasetsDraw(chart) {
        const dataset = chart.data.datasets?.[0];
        const bars = chart.getDatasetMeta(0)?.data || [];
        if (!dataset || !bars.length) return;

        const root = getComputedStyle(document.documentElement);
        const labelColor = root.getPropertyValue('--color-primary-darker').trim() || '#003b54';
        const isHorizontal = chart.options.indexAxis === 'y';
        const chartRight = chart.chartArea.right;

        chart.ctx.save();
        chart.ctx.font = '600 11px Atkinson Hyperlegible, sans-serif';
        chart.ctx.fillStyle = labelColor;

        bars.forEach((bar, index) => {
          const value = Number(dataset.data[index]);
          if (!Number.isFinite(value)) return;

          const label = `${value.toFixed(1)}%`;
          if (isHorizontal) {
            const labelWidth = chart.ctx.measureText(label).width;
            const fitsOutside = bar.x + 8 + labelWidth <= chartRight;
            chart.ctx.textAlign = fitsOutside ? 'left' : 'right';
            chart.ctx.fillStyle = fitsOutside ? labelColor : '#ffffff';
            chart.ctx.fillText(label, fitsOutside ? bar.x + 8 : bar.x - 8, bar.y + 4);
          } else {
            chart.ctx.textAlign = 'center';
            chart.ctx.fillStyle = labelColor;
            chart.ctx.fillText(label, bar.x, Math.max(chart.chartArea.top + 12, bar.y - 8));
          }
        });

        chart.ctx.restore();
      }
    };

    document.addEventListener('DOMContentLoaded', async () => {
      setupAnalysisTabs();
      await loadUserData();
      await carregarDashboard();
      
      // Redesenhar gráficos ao redimensionar a janela
      let resizeTimeout;
      window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          if (chartProgresso) {
            chartProgresso.resize();
          }
          if (chartRetencao) {
            chartRetencao.resize();
          }
        }, 250);
      });
    });

    async function carregarDashboard() {
      const token = localStorage.getItem('token');
      if (!token) {
        window.location.href = '/login.html';
        return;
      }

      try {
        showLoading('Carregando dashboard...');
        const resp = await apiFetch('/api/relatorios/estatisticas-gerais', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        if (!resp.ok) {
          if (resp.status === 401 || resp.status === 403) {
            localStorage.removeItem('token');
            window.location.href = '/login.html';
            return;
          }
          throw new Error('Falha ao carregar estatísticas');
        }
        const data = await resp.json();
        if (!data.sucesso || !data.estatisticas) throw new Error('Resposta inválida do servidor');

        const stats = data.estatisticas;
        dashboardStats = stats;
        retentionRendered = false;
        await carregarTotalAlunos();
        atualizarCards(stats);
        renderizarProgresso(stats);
        if (activeAnalysis === 'retention') {
          renderizarRetencao(stats);
          retentionRendered = true;
        }
      } catch (e) {
        console.error('Erro no dashboard:', e);
        showToast('Erro ao carregar dashboard. Tente recarregar a página.', 'error', 5000);
      } finally {
        hideLoading();
      }
    }

    async function carregarTotalAlunos() {
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        const resp = await apiFetch('/api/alunos', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        if (!resp.ok) {
          console.warn('Falha ao carregar alunos:', resp.status);
          return;
        }
        const data = await resp.json();
        const total = Array.isArray(data.alunos) ? data.alunos.length : 0;
        const numEl = document.getElementById('totalAlunosNumero');
        const labelEl = document.getElementById('totalAlunosLegenda');
        if (numEl) numEl.textContent = total.toString();
        if (labelEl) labelEl.textContent = 'alunos cadastrados';
      } catch (e) {
        console.warn('Falha ao carregar total de alunos', e);
        // Não mostrar toast para erro não crítico
      }
    }

    function atualizarCards(stats) {
      // Simulados aplicados: número total de simulados (gabaritos) que têm respostas
      const totalSimulados = stats.total_simulados_aplicados || 0;
      const simuladosEl = document.getElementById('totalSimuladosNumero');
      if (simuladosEl) simuladosEl.textContent = totalSimulados.toString();

      const aproveitamento = Number(stats.media_geral);
      const aproveitamentoEl = document.getElementById('aproveitamentoMedioNumero');
      if (aproveitamentoEl) {
        aproveitamentoEl.textContent = Number.isFinite(aproveitamento)
          ? `${aproveitamento.toFixed(1)}%`
          : '--';
      }
    }

    function setupAnalysisTabs() {
      const tabs = Array.from(document.querySelectorAll('[data-analysis-tab]'));
      if (!tabs.length) return;

      tabs.forEach((tab, index) => {
        tab.addEventListener('click', () => {
          switchAnalysis(tab.dataset.analysisTab);
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
          switchAnalysis(nextTab.dataset.analysisTab);
          nextTab.focus();
        });
      });
    }

    function switchAnalysis(analysis) {
      if (!['progress', 'retention'].includes(analysis)) return;

      activeAnalysis = analysis;
      const isRetention = analysis === 'retention';
      const subtitle = document.getElementById('analysisSubtitle');
      const tabs = document.querySelectorAll('[data-analysis-tab]');
      const panels = document.querySelectorAll('.analysis-panel');

      tabs.forEach(tab => {
        const isActive = tab.dataset.analysisTab === analysis;
        tab.classList.toggle('is-active', isActive);
        tab.setAttribute('aria-selected', String(isActive));
        tab.tabIndex = isActive ? 0 : -1;
      });

      panels.forEach(panel => {
        const isActive = panel.id === (isRetention ? 'retentionPanel' : 'progressPanel');
        panel.hidden = !isActive;
        panel.classList.toggle('is-active', isActive);
      });

      if (subtitle) {
        subtitle.textContent = isRetention
          ? 'Taxa de erro por área de conhecimento'
          : 'Média de acertos ao longo do tempo';
      }

      if (isRetention && dashboardStats && !retentionRendered) {
        renderizarRetencao(dashboardStats);
        retentionRendered = true;
      }

      if (!isRetention && chartProgresso) {
        requestAnimationFrame(() => chartProgresso.resize());
      }
      if (isRetention && chartRetencao) {
        requestAnimationFrame(() => chartRetencao.resize());
      }
    }

    function renderizarProgresso(stats) {
      const token = localStorage.getItem('token');
      if (!token) return;

      // Detectar se é mobile
      const isMobile = window.innerWidth <= 768;
      const fontSizeBase = isMobile ? 11 : 12;
      const fontSizeSmall = isMobile ? 10 : 11;
      const tooltipPadding = isMobile ? 8 : 12;
      const tooltipFontSize = isMobile ? 12 : 13;
      const tooltipTitleSize = isMobile ? 12 : 14;

      apiFetch('/api/relatorios/estatisticas-mensal', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
        .then(r => r.ok ? r.json() : Promise.reject(r))
        .then(data => {
          const series = Array.isArray(data.series) ? data.series : [];
          const labels = series.map(s => {
            // Formatar YYYY-MM para MMM/YY
            const [y, m] = (s.mes || '').split('-');
            if (!y || !m) return s.mes || 'N/A';
            const date = new Date(Number(y), Number(m) - 1, 1);
            return date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
          });
          const valores = series.map(s => Number(s.media || 0));

          // Obter cores das variáveis CSS para Chart.js
          const root = getComputedStyle(document.documentElement);
          const colorPrimary = root.getPropertyValue('--color-primary').trim() || '#008cc4';
          const colorPrimaryDarker = root.getPropertyValue('--color-primary-darker').trim() || '#003b54';
          const colorTextLight = root.getPropertyValue('--color-text-light').trim() || '#666666';
          const colorBorderLight = root.getPropertyValue('--color-border-light').trim() || '#e0e0e0';

          if (chartProgresso) chartProgresso.destroy();
          chartProgresso = new Chart(document.getElementById('progressChart'), {
            type: 'bar',
            plugins: [chartValueLabelsPlugin],
            data: {
              labels: labels.length ? labels : ['Sem dados'],
              datasets: [{
                label: 'Média mensal (%)',
                data: valores.length ? valores : [0],
                backgroundColor: colorPrimary,
                borderRadius: 8,
                maxBarThickness: 76,
                borderSkipped: false,
              }]
            },
            options: {
              plugins: {
                legend: { display: false },
                tooltip: {
                  backgroundColor: colorPrimaryDarker,
                  padding: tooltipPadding,
                  titleFont: { size: tooltipTitleSize, weight: '600' },
                  bodyFont: { size: tooltipFontSize },
                  cornerRadius: 8,
                  callbacks: { label: ctx => `${ctx.parsed.y.toFixed(1)}%` }
                }
              },
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                y: {
                  beginAtZero: true,
                  max: 100,
                  ticks: {
                    font: { size: fontSizeBase },
                    color: colorTextLight,
                    callback: v => `${v}%`,
                    maxTicksLimit: isMobile ? 5 : 10
                  },
                  grid: { color: colorBorderLight }
                },
                x: {
                  ticks: { 
                    font: { size: fontSizeSmall }, 
                    color: colorTextLight,
                    maxRotation: isMobile ? 45 : 0,
                    minRotation: isMobile ? 45 : 0
                  },
                  grid: { display: false }
                }
              }
            }
          });
        })
        .catch((error) => {
          console.error('Erro ao carregar progresso mensal:', error);
          const root = getComputedStyle(document.documentElement);
          const colorPrimary = root.getPropertyValue('--color-primary').trim() || '#008cc4';

          if (chartProgresso) chartProgresso.destroy();
          chartProgresso = new Chart(document.getElementById('progressChart'), {
            type: 'bar',
            plugins: [chartValueLabelsPlugin],
            data: {
              labels: ['Sem dados'],
              datasets: [{
                label: 'Média mensal (%)',
                data: [0],
                backgroundColor: colorPrimary,
                borderRadius: 8,
                maxBarThickness: 76
              }]
            },
            options: {
              plugins: { legend: { display: false } },
              responsive: true,
              maintainAspectRatio: false
            }
          });
        });
    }

    function renderizarRetencao(stats) {
      const disciplinas = Array.isArray(stats.media_por_disciplina) ? stats.media_por_disciplina : [];
      // Usar taxa_erro (não media) para o gráfico de Retenção
      // Ordenar do maior para o menor (maior taxa de erro = pior retenção = aparece primeiro no topo)
      const disciplinasOrdenadas = [...disciplinas].sort((a, b) => {
        const taxaErroA = Number(a.taxa_erro || 0);
        const taxaErroB = Number(b.taxa_erro || 0);
        return taxaErroB - taxaErroA; // Descendente: maior para menor
      });

      const labels = disciplinasOrdenadas.map(d => d.nome);
      const valores = disciplinasOrdenadas.map(d => Number(d.taxa_erro || 0));

      // Armazenar dados completos para tooltip
      const dadosCompletos = disciplinasOrdenadas;

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
      const colorError = root.getPropertyValue('--color-error').trim() || '#dc3545';
      const colorPrimaryDarker = root.getPropertyValue('--color-primary-darker').trim() || '#003b54';
      const colorTextLight = root.getPropertyValue('--color-text-light').trim() || '#666666';
      const colorText = root.getPropertyValue('--color-text').trim() || '#333333';
      const colorBorderLight = root.getPropertyValue('--color-border-light').trim() || '#e0e0e0';

      if (chartRetencao) chartRetencao.destroy();
      chartRetencao = new Chart(document.getElementById('retencaoChart'), {
        type: 'bar',
        plugins: [chartValueLabelsPlugin],
        data: {
          labels: labels.length ? labels : ['Sem dados'],
          datasets: [{
            label: 'Retenção (%)',
            data: valores.length ? valores : [0],
            backgroundColor: colorError,
            borderRadius: 8,
            barThickness: barThickness,
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: colorPrimaryDarker,
              padding: tooltipPadding,
              titleFont: { size: tooltipTitleSize, weight: '600' },
              bodyFont: { size: tooltipFontSize },
              cornerRadius: 8,
              callbacks: {
                label: context => {
                  const disciplina = dadosCompletos[context.dataIndex];
                  const erros = disciplina ? Number(disciplina.erros || 0) : 0;
                  const total = disciplina ? Number(disciplina.total_respostas || 0) : 0;
                  const taxaErro = disciplina ? Number(disciplina.taxa_erro || 0) : 0;
                  return `Taxa de erro: ${taxaErro.toFixed(1)}% (${erros.toLocaleString('pt-BR')} de ${total.toLocaleString('pt-BR')} respostas)`;
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
                font: { size: fontSizeBase },
                color: colorTextLight,
                maxTicksLimit: isMobile ? 5 : 10
              },
              grid: { color: colorBorderLight }
            },
            y: {
              ticks: {
                font: { size: fontSizeY, weight: '500' },
                color: colorText,
                maxTicksLimit: isMobile ? 8 : undefined
              },
              grid: { display: false }
            }
          }
        }
      });
    }
