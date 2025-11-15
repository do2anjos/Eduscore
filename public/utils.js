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

// Exportar funções para uso global
window.showToast = showToast;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.showConfirmDialog = showConfirmDialog;
window.validateForm = validateForm;
window.isValidEmail = isValidEmail;

