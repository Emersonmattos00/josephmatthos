// js/admin/auth.js
'use strict';

import { el, clearElement } from './helpers.js';

const SESSION_CACHE_KEY = 'jm_admin_ui_cache';
const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 min

let inactivityTimer = null;

/**
 * Verifica se há sessão de admin válida NO SERVIDOR.
 * NUNCA confia em sessionStorage/localStorage.
 */
export async function hasServerSession() {
  try {
    const res = await fetch('/api/admin-session', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store'
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Faz login no servidor.
 */
export async function login(user, pass) {
  const res = await fetch('/api/admin-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ user, pass })
  });

  let result = {};
  try {
    result = await res.json();
  } catch {
    result = { ok: false, error: 'Resposta inválida do servidor.' };
  }

  if (!res.ok || !result.ok) {
    return { ok: false, error: result.error || 'Usuário ou senha incorretos.' };
  }
  return { ok: true };
}

/**
 * Faz logout no servidor e limpa UI.
 */
export async function logout() {
  try {
    await fetch('/api/admin-logout', {
      method: 'POST',
      credentials: 'same-origin'
    });
  } catch {
    // Ignora erro — limpa localmente de qualquer forma
  }
  sessionStorage.removeItem(SESSION_CACHE_KEY);
  stopInactivityTimer();
}

/**
 * Ativa timeout de inatividade.
 */
export function startInactivityTimer(onExpire) {
  stopInactivityTimer();
  const reset = () => {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(async () => {
      await logout();
      onExpire();
    }, INACTIVITY_TIMEOUT);
  };
  ['mousemove', 'keydown', 'click', 'scroll'].forEach((evt) => {
    document.addEventListener(evt, reset, { passive: true });
  });
  reset();
}

export function stopInactivityTimer() {
  clearTimeout(inactivityTimer);
  inactivityTimer = null;
}

/**
 * Inicializa o formulário de login (server-side APENAS).
 */
export function initLoginForm({ onSuccess, onShowDashboard, onShowLogin }) {
  const form = document.getElementById('adminLoginForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const userInput = document.getElementById('adminUser');
    const passInput = document.getElementById('adminPass');
    const errEl = document.getElementById('adminLoginError');

    const user = (userInput?.value || '').trim();
    const pass = passInput?.value || '';

    if (!user || !pass) {
      if (errEl) errEl.textContent = 'Preencha usuário e senha.';
      return;
    }

    if (errEl) errEl.textContent = 'Validando acesso...';

    const result = await login(user, pass);

    if (!result.ok) {
      if (errEl) errEl.textContent = result.error;
      return;
    }

    if (errEl) errEl.textContent = '';
    form.reset();
    onSuccess();
  });
}

/**
 * Inicializa botão de logout.
 */
export function initLogoutButton({ onLogout }) {
  const btn = document.getElementById('adminLogout');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    await logout();
    onLogout();
  });
}
