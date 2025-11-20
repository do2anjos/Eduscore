/**
 * Utilitários para implementação das 10 Heurísticas de Nielsen
 */

// 1. VISIBILIDADE DO STATUS DO SISTEMA
function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container') || createToastContainer();
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icon = getToastIcon(type);
  toast.innerHTML = `
    <span>${icon}</span>
    <span style="flex: 1;">${message}</span>
    <button class="toast-close" onclick="this.parentElement.remove()" aria-label="Fechar">×</button>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function getToastIcon(type) {
  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };
  return icons[type] || icons.info;
}

function createToastContainer() {
  const container = document.createElement('div');
  container.id = 'toast-container';
  container.className = 'toast-container';
  document.body.appendChild(container);
  return container;
}

function showLoading(message = 'Carregando...') {
  const overlay = document.getElementById('loading-overlay') || createLoadingOverlay();
  const messageEl = overlay.querySelector('.loading-message');
  if (messageEl) messageEl.textContent = message;
  overlay.classList.add('active');
}

function hideLoading() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) overlay.classList.remove('active');
}

function createLoadingOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'loading-overlay';
  overlay.className = 'loading-overlay';
  overlay.innerHTML = `
    <div style="text-align: center; color: white;">
      <div class="loading-spinner-large"></div>
      <div class="loading-message" style="margin-top: 16px; font-size: 16px;">Carregando...</div>
    </div>
  `;
  document.body.appendChild(overlay);
  return overlay;
}

// 3. CONTROLE E LIBERDADE DO USUÁRIO
function showConfirmDialog(message, onConfirm, onCancel = null) {
  const overlay = document.getElementById('confirm-overlay') || createConfirmOverlay();
  const dialog = document.getElementById('confirm-dialog') || createConfirmDialog();
  
  dialog.querySelector('.confirm-message').textContent = message;
  
  const confirmBtn = dialog.querySelector('.confirm-btn');
  const cancelBtn = dialog.querySelector('.cancel-btn');
  
  // Remove listeners anteriores
  const newConfirmBtn = confirmBtn.cloneNode(true);
  const newCancelBtn = cancelBtn.cloneNode(true);
  confirmBtn.replaceWith(newConfirmBtn);
  cancelBtn.replaceWith(newCancelBtn);
  
  newConfirmBtn.onclick = () => {
    overlay.classList.remove('active');
    dialog.classList.remove('active');
    if (onConfirm) onConfirm();
  };
  
  newCancelBtn.onclick = () => {
    overlay.classList.remove('active');
    dialog.classList.remove('active');
    if (onCancel) onCancel();
  };
  
  overlay.classList.add('active');
  dialog.classList.add('active');
}

function createConfirmOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'confirm-overlay';
  overlay.className = 'confirm-dialog-overlay';
  document.body.appendChild(overlay);
  return overlay;
}

function createConfirmDialog() {
  const dialog = document.createElement('div');
  dialog.id = 'confirm-dialog';
  dialog.className = 'confirm-dialog';
  dialog.innerHTML = `
    <div class="confirm-message" style="margin-bottom: 20px;"></div>
    <div class="confirm-dialog-actions">
      <button class="btn-secondary cancel-btn">Cancelar</button>
      <button class="email-btn confirm-btn">Confirmar</button>
    </div>
  `;
  document.body.appendChild(dialog);
  return dialog;
}

// 5. PREVENÇÃO DE ERROS
function validateForm(formElement) {
  const inputs = formElement.querySelectorAll('input[required], select[required]');
  let isValid = true;
  const errors = [];
  
  inputs.forEach(input => {
    if (!input.value.trim()) {
      isValid = false;
      input.classList.add('error');
      errors.push(`O campo "${input.previousElementSibling?.textContent || input.name}" é obrigatório`);
    } else {
      input.classList.remove('error');
      
      // Validação específica por tipo
      if (input.type === 'email' && !isValidEmail(input.value)) {
        isValid = false;
        input.classList.add('error');
        errors.push('Email inválido');
      }
    }
  });
  
  if (!isValid && errors.length > 0) {
    showToast(errors[0], 'error');
  }
  
  return isValid;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// 6. RECONHECIMENTO AO INVÉS DE RECORDAÇÃO
function addInputHints() {
  document.querySelectorAll('input[type="email"]').forEach(input => {
    if (!input.nextElementSibling?.classList.contains('input-hint')) {
      const hint = document.createElement('span');
      hint.className = 'input-hint';
      hint.textContent = 'Use seu email institucional';
      input.parentElement.appendChild(hint);
    }
  });
}

// 7. FLEXIBILIDADE E EFICIÊNCIA - Atalhos de teclado
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + S para salvar
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      const saveBtn = document.querySelector('button[type="submit"], .save-btn');
      if (saveBtn && !saveBtn.disabled) {
        saveBtn.click();
      }
    }
    
    // Esc para fechar modais
    if (e.key === 'Escape') {
      const activeModal = document.querySelector('.confirm-dialog.active, .help-panel.active');
      if (activeModal) {
        activeModal.classList.remove('active');
        const overlay = document.querySelector('.confirm-dialog-overlay.active');
        if (overlay) overlay.classList.remove('active');
      }
    }
    
    // Enter em formulários
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
      const form = e.target.closest('form');
      if (form) {
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn && !submitBtn.disabled) {
          e.preventDefault();
          submitBtn.click();
        }
      }
    }
  });
}

// 10. AJUDA E DOCUMENTAÇÃO
function setupHelpButton() {
  if (document.getElementById('help-button')) return;
  
  const helpBtn = document.createElement('button');
  helpBtn.id = 'help-button';
  helpBtn.className = 'help-button';
  helpBtn.innerHTML = '?';
  helpBtn.setAttribute('aria-label', 'Ajuda');
  helpBtn.onclick = toggleHelpPanel;
  
  const helpPanel = document.createElement('div');
  helpPanel.id = 'help-panel';
  helpPanel.className = 'help-panel';
  helpPanel.innerHTML = getHelpContent();
  
  document.body.appendChild(helpBtn);
  document.body.appendChild(helpPanel);
}

function toggleHelpPanel() {
  const panel = document.getElementById('help-panel');
  if (panel) {
    panel.classList.toggle('active');
  }
}

function getHelpContent() {
  return `
    <h3>Ajuda Rápida</h3>
    <ul>
      <li><a href="#login">Como fazer login?</a></li>
      <li><a href="#cadastro">Como cadastrar um aluno?</a></li>
      <li><a href="#gabarito">Como criar um gabarito?</a></li>
      <li><a href="#relatorio">Como gerar relatórios?</a></li>
    </ul>
    <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #eee;">
      <strong>Atalhos de Teclado:</strong>
      <ul style="margin-top: 8px;">
        <li><kbd>Ctrl</kbd> + <kbd>S</kbd> - Salvar</li>
        <li><kbd>Esc</kbd> - Fechar modais</li>
        <li><kbd>Enter</kbd> - Submeter formulário</li>
      </ul>
    </div>
  `;
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  setupKeyboardShortcuts();
  setupHelpButton();
  addInputHints();
  setupUserProfileMenu();
  
  // Carregar dados do usuário se houver sidebar ou user-profile-menu
  if (document.querySelector('.sidebar') || document.querySelector('.user-profile-menu')) {
    loadUserData();
  }
  
  // Adicionar animação slideOut para toasts
  if (!document.getElementById('toast-styles')) {
    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.textContent = `
      @keyframes slideOut {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(100%);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }
});

// User Profile Menu
function setupUserProfileMenu() {
  const userMenuButton = document.getElementById('user-menu-button');
  const userDropdown = document.getElementById('user-dropdown');

  if (userMenuButton && userDropdown) {
    userMenuButton.addEventListener('click', (e) => {
      e.stopPropagation();
      userDropdown.classList.toggle('hidden');
    });

    // Fechar ao clicar fora
    document.addEventListener('click', (e) => {
      if (!userMenuButton.contains(e.target) && !userDropdown.contains(e.target)) {
        userDropdown.classList.add('hidden');
      }
    });

    // Fechar ao pressionar Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !userDropdown.classList.contains('hidden')) {
        userDropdown.classList.add('hidden');
      }
    });
  }
}

function logout() {
  showConfirmDialog(
    'Deseja realmente sair?',
    () => {
      localStorage.removeItem('token');
      window.location.href = '/login.html';
    }
  );
}

// Função para buscar e atualizar dados do usuário
async function loadUserData() {
  const token = localStorage.getItem('token');
  
  if (!token) {
    // Se não houver token, redireciona para login
    if (!window.location.pathname.includes('login.html') && !window.location.pathname.includes('index.html')) {
      window.location.href = '/login.html';
    }
    return;
  }

  try {
    const response = await fetch('/api/usuarios/me', {
      method: 'GET',
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
      throw new Error('Erro ao buscar dados do usuário');
    }

    const data = await response.json();
    
    if (data.sucesso && data.usuario) {
      updateUserProfile(data.usuario);
    }
  } catch (error) {
    console.error('Erro ao carregar dados do usuário:', error);
    // Não redireciona em caso de erro de rede, apenas loga o erro
  }
}

// Função para atualizar elementos do perfil do usuário
function updateUserProfile(usuario) {
  // Função auxiliar para gerar iniciais do nome
  function getInitials(nome) {
    if (!nome) return 'U';
    const parts = nome.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return nome.substring(0, 2).toUpperCase();
  }

  // Função auxiliar para capitalizar primeira letra
  function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  const initials = getInitials(usuario.nome);
  const perfilCapitalized = capitalize(usuario.perfil);

  // Atualizar sidebar profile
  const sidebarProfile = document.querySelector('.sidebar .profile');
  if (sidebarProfile) {
    const profileSpan = sidebarProfile.querySelector('span');
    if (profileSpan) {
      profileSpan.innerHTML = `
        ${perfilCapitalized}<br>
        <small>${usuario.email}</small>
      `;
      // Marcar como carregado e mostrar com animação suave
      profileSpan.style.opacity = '0';
      profileSpan.style.transition = 'opacity 0.3s ease';
      setTimeout(() => {
        profileSpan.style.opacity = '1';
      }, 10);
      sidebarProfile.setAttribute('data-loaded', 'true');
    }
    
    // Atualizar foto de perfil
    const profileImg = sidebarProfile.querySelector('img');
    if (profileImg) {
      // SEMPRE definir imagem padrão primeiro para evitar tentar carregar base64 diretamente
      profileImg.src = 'https://img.icons8.com/ios-filled/100/ffffff/user-male-circle.png';
      profileImg.alt = 'Perfil';
      profileImg.onerror = null;
      
      if (usuario.foto_perfil && usuario.id) {
        // SEMPRE usar endpoint da API para carregar fotos
        // Isso evita completamente o erro 431 ao usar base64 diretamente como URL
        const userId = usuario.id;
        const token = localStorage.getItem('token');
        
        if (token) {
          // Limpar blob URL anterior se existir
          if (profileImg.src && profileImg.src.startsWith('blob:')) {
            URL.revokeObjectURL(profileImg.src);
          }
          
          // Usar endpoint da API para carregar a foto
          fetch(`/api/usuarios/${userId}/foto?t=${Date.now()}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          })
          .then(response => {
            if (response.ok) {
              return response.blob();
            }
            // Se retornar 404, a foto não está disponível
            if (response.status === 404) {
              console.warn('[DEBUG] Foto não encontrada no servidor (404)');
              return null;
            }
            throw new Error(`Erro ao carregar foto: ${response.status}`);
          })
          .then(blob => {
            if (blob) {
              // Criar blob URL para exibir a imagem
              const blobUrl = URL.createObjectURL(blob);
              profileImg.src = blobUrl;
              profileImg.alt = usuario.nome || 'Perfil';
              
              profileImg.onerror = function() {
                URL.revokeObjectURL(blobUrl);
                this.src = 'https://img.icons8.com/ios-filled/100/ffffff/user-male-circle.png';
                this.alt = 'Perfil';
                this.onerror = null;
              };
            } else {
              // Se blob for null (404), manter imagem padrão
              profileImg.src = 'https://img.icons8.com/ios-filled/100/ffffff/user-male-circle.png';
              profileImg.alt = 'Perfil';
            }
          })
          .catch(error => {
            console.warn('[DEBUG] Erro ao carregar foto via API:', error);
            profileImg.src = 'https://img.icons8.com/ios-filled/100/ffffff/user-male-circle.png';
            profileImg.alt = 'Perfil';
            profileImg.onerror = null;
          });
        } else {
          console.warn('[DEBUG] Token não disponível, usando imagem padrão');
          profileImg.src = 'https://img.icons8.com/ios-filled/100/ffffff/user-male-circle.png';
          profileImg.alt = 'Perfil';
        }
      } else {
        // Se não houver foto, manter a imagem padrão
        profileImg.src = 'https://img.icons8.com/ios-filled/100/ffffff/user-male-circle.png';
        profileImg.alt = 'Perfil';
        profileImg.onerror = null;
      }
    }
  }

  // Atualizar user-profile-menu
  const userMenuButton = document.getElementById('user-menu-button');
  if (userMenuButton) {
    userMenuButton.textContent = initials;
    userMenuButton.setAttribute('aria-label', `Menu de ${usuario.nome}`);
  }

  const userDropdown = document.getElementById('user-dropdown');
  if (userDropdown) {
    const userName = userDropdown.querySelector('.user-name');
    if (userName) userName.textContent = usuario.nome;

    const userEmail = userDropdown.querySelector('.user-email');
    if (userEmail) userEmail.textContent = usuario.email;

    const userScore = userDropdown.querySelector('.user-score strong');
    if (userScore) userScore.textContent = perfilCapitalized;
  }

  // Atualizar título de boas-vindas se existir
  const welcomeTitle = document.querySelector('.dashboard-header h2');
  if (welcomeTitle) {
    const firstName = usuario.nome.split(' ')[0];
    welcomeTitle.textContent = `Bem-vindo de volta, ${firstName}!`;
    // Marcar como carregado e mostrar com animação suave
    welcomeTitle.style.opacity = '0';
    welcomeTitle.style.transition = 'opacity 0.3s ease';
    setTimeout(() => {
      welcomeTitle.style.opacity = '1';
    }, 10);
    
    // Marcar dashboard-header como carregado
    const dashboardHeader = document.getElementById('dashboard-header') || document.querySelector('.dashboard-header');
    if (dashboardHeader) {
      dashboardHeader.setAttribute('data-loaded', 'true');
    }
    
    // Atualizar subtítulo se existir e estiver no dashboard-header
    const subtitle = document.querySelector('.dashboard-header .dashboard-subtitle');
    if (subtitle) {
      // Se o subtítulo contém placeholder, atualizar com texto padrão
      if (subtitle.textContent.includes('Carregando') || subtitle.textContent.trim() === '') {
        subtitle.textContent = 'Aqui está um resumo do seu desempenho';
      }
      subtitle.style.opacity = '0';
      subtitle.style.transition = 'opacity 0.3s ease';
      setTimeout(() => {
        subtitle.style.opacity = '1';
      }, 10);
    }
  }
}

// Exportar funções para uso global
window.showToast = showToast;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.showConfirmDialog = showConfirmDialog;
window.validateForm = validateForm;
window.isValidEmail = isValidEmail;
window.setupUserProfileMenu = setupUserProfileMenu;
window.logout = logout;
window.loadUserData = loadUserData;

