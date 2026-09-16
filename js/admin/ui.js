// js/admin/ui.js
'use strict';

import { el, clearElement } from './helpers.js';

/* ─────────────────────────────────────────
   TOAST (sem innerHTML)
   ───────────────────────────────────────── */
let toastEl = null;
let toastTimer = null;

export function toast(message, icon = 'ℹ') {
  if (!toastEl) {
    toastEl = document.getElementById('toast');
    if (!toastEl) {
      toastEl = el('div', { id: 'toast', class: 'toast' });
      document.body.appendChild(toastEl);
    }
  }

  clearElement(toastEl);

  const iconSpan = el('span', { class: 'icon', text: icon });
  const msgSpan = el('span', { text: String(message) });

  toastEl.appendChild(iconSpan);
  toastEl.appendChild(msgSpan);

  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3200);
}

/* ─────────────────────────────────────────
   MODAL GENÉRICO
   ───────────────────────────────────────── */
export function openModal(contentNode) {
  const content = document.getElementById('adminModalContent');
  const modal = document.getElementById('adminModal');
  if (!content || !modal) return;

  clearElement(content);
  if (typeof contentNode === 'string') {
    content.textContent = contentNode;
  } else {
    content.appendChild(contentNode);
  }

  modal.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Focus trap básico
  const focusable = modal.querySelector(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  if (focusable) focusable.focus();
}

export function closeModal() {
  const modal = document.getElementById('adminModal');
  if (modal) modal.classList.remove('open');
  document.body.style.overflow = '';
}

/* ─────────────────────────────────────────
   CONFIRM CUSTOMIZADO (substitui confirm())
   ───────────────────────────────────────── */
export function confirmDialog({ title = 'Confirmar', message, confirmText = 'Confirmar', danger = false }) {
  return new Promise((resolve) => {
    const overlay = el('div', { class: 'modal-overlay open', style: 'z-index:900;' });

    const modal = el('div', { class: 'modal', style: 'width:min(420px,100%);' });

    const h2 = el('h2', { text: title });
    const p = el('p', { class: 'sub', text: message });

    const actions = el('div', {
      style: 'display:flex;gap:0.7rem;justify-content:flex-end;margin-top:1.5rem;'
    });

    const cancelBtn = el('button', {
      class: 'btn btn-outline btn-sm',
      text: 'Cancelar',
      onclick: () => { cleanup(); resolve(false); }
    });

    const okBtn = el('button', {
      class: `btn btn-sm ${danger ? 'btn-danger' : 'btn-primary'}`,
      text: confirmText,
      onclick: () => { cleanup(); resolve(true); }
    });

    actions.appendChild(cancelBtn);
    actions.appendChild(okBtn);

    modal.appendChild(h2);
    modal.appendChild(p);
    modal.appendChild(actions);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    function cleanup() {
      overlay.remove();
    }

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) { cleanup(); resolve(false); }
    });

    okBtn.focus();
  });
}

/* ─────────────────────────────────────────
   NAVEGAÇÃO POR ABAS
   ───────────────────────────────────────── */
const TAB_TITLES = {
  dashboard: 'Dashboard',
  geral: 'Geral',
  hero: 'Hero',
  sobre: 'Sobre',
  filosofia: 'Filosofia',
  discografia: 'Discografia',
  vendas: 'Vendas',
  planos: 'Planos',
  contato: 'Contato',
  usuarios: 'Usuários',
  aparencia: 'Aparência',
  backup: 'Backup'
};

const TAB_HANDLERS = {};

export function registerTabHandler(tab, handler) {
  TAB_HANDLERS[tab] = handler;
}

export function initTabs() {
  document.querySelectorAll('.admin-nav button').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-nav button').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.admin-section').forEach((s) => s.classList.remove('active'));

      btn.classList.add('active');
      const tab = btn.dataset.tab;
      const section = document.getElementById('tab-' + tab);
      if (section) section.classList.add('active');

      const titleEl = document.getElementById('adminTabTitle');
      if (titleEl) titleEl.textContent = TAB_TITLES[tab] || tab;

      if (TAB_HANDLERS[tab]) {
        try { TAB_HANDLERS[tab](); } catch (e) { console.error(e); }
      }
    });
  });
}
