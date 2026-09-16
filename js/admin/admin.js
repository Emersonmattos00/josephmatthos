// js/admin/admin.js
'use strict';

import { initLoginForm, initLogoutButton, hasServerSession, startInactivityTimer } from './auth.js';
import { initTabs, registerTabHandler, toast, closeModal } from './ui.js';
import { loadAllAdminFields, bindContentInputs, bindImageUpload, updateImagePreview } from './content.js';
import { renderUsersTable, initUserFilters } from './users.js';
import { initBackup } from './backup.js';

/* ─────────────────────────────────────────
   ESTADO GLOBAL
   ───────────────────────────────────────── */
const state = {
  content: null,
  defaultContent: null,
  currentTab: 'dashboard'
};

/* ─────────────────────────────────────────
   ABRIR/FECHAR PAINEL
   ───────────────────────────────────────── */
export async function openAdminSite() {
  const pub = document.getElementById('publicSite');
  const adm = document.getElementById('adminSite');
  if (pub) pub.style.display = 'none';
  if (adm) adm.style.display = 'block';
  document.body.style.paddingBottom = '0';
  window.scrollTo(0, 0);

  showAdminLogin();

  const valid = await hasServerSession();
  if (valid) showAdminDashboard();
  else showAdminLoginForm();
}

export function openPublicSite() {
  const adm = document.getElementById('adminSite');
  const pub = document.getElementById('publicSite');
  if (adm) adm.style.display = 'none';
  if (pub) pub.style.display = 'block';
  document.body.style.paddingBottom = '';
  window.scrollTo(0, 0);
}

/* ─────────────────────────────────────────
   TELAS
   ───────────────────────────────────────── */
function showAdminLogin() {
  const loginEl = document.getElementById('adminLogin');
  const dashEl = document.getElementById('adminDashboard');
  if (loginEl) loginEl.style.display = 'flex';
  if (dashEl) dashEl.style.display = 'none';
}

function showAdminLoginForm() {
  const loginForm = document.getElementById('adminLoginForm');
  const changeForm = document.getElementById('adminPasswordChangeForm');
  if (loginForm) loginForm.style.display = 'block';
  if (changeForm) changeForm.style.display = 'none';
}

function showAdminDashboard() {
  const loginEl = document.getElementById('adminLogin');
  const dashEl = document.getElementById('adminDashboard');
  if (loginEl) loginEl.style.display = 'none';
  if (dashEl) dashEl.style.display = 'grid';

  loadAllAdminFields(state.content);
  renderUsersTable();

  startInactivityTimer(() => {
    toast('Sessão expirada por inatividade.', '⏱');
    openPublicSite();
  });
}

/* ─────────────────────────────────────────
   INICIALIZAÇÃO
   ───────────────────────────────────────── */
export function initAdmin({ content, defaultContent, onContentChange }) {
  state.content = content;
  state.defaultContent = defaultContent;

  /* Login */
  initLoginForm({
    onSuccess: showAdminDashboard
  });

  /* Logout */
  initLogoutButton({
    onLogout: () => {
      showAdminLogin();
      openPublicSite();
      toast('Sessão encerrada.', 'ℹ');
    }
  });

  /* Navegação */
  initTabs();
  registerTabHandler('usuarios', renderUsersTable);
  registerTabHandler('backup', () => loadAllAdminFields(state.content));

  /* Editor de conteúdo */
  bindContentInputs(state.content, (field) => {
    onContentChange(field);
  });

  bindImageUpload('bgUpload', 1920, 0.82, (dataUrl) => {
    state.content.branding.bgImage = dataUrl;
    onContentChange('branding.bgImage');
    updateImagePreview('bgPreview', dataUrl);
  });

  /* Filtros de usuários */
  initUserFilters();

  /* Backup */
  initBackup({
    getContent: () => state.content,
    setContent: (c) => { state.content = c; },
    getDefaultContent: () => state.defaultContent,
    onAfterRestore: () => {
      loadAllAdminFields(state.content);
      onContentChange('all');
    }
  });

  /* Botões de voltar */
  const backBtn = document.getElementById('backToSiteFromLogin');
  if (backBtn) backBtn.addEventListener('click', openPublicSite);

  const viewSiteBtn = document.getElementById('adminViewSite');
  if (viewSiteBtn) viewSiteBtn.addEventListener('click', openPublicSite);

  /* Atalho Ctrl+Shift+A — apenas em desenvolvimento */
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.code === 'KeyA') {
        e.preventDefault();
        openAdminSite();
      }
    });
  }

  /* ESC fecha modais */
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') {
      closeModal();
      document.querySelectorAll('.modal-overlay.open').forEach((m) => m.classList.remove('open'));
      document.body.style.overflow = '';
    }
  });
}
