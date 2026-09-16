// js/admin/users.js
'use strict';

import { esc, el, clearElement, debounce } from './helpers.js';
import { toast, confirmDialog } from './ui.js';

/**
 * ⚠️ ATENÇÃO: Em produção, os dados de usuários DEVEM vir do Supabase.
 * Este módulo assume que existe uma API `/api/admin/users`.
 */

async function fetchUsers() {
  const res = await fetch('/api/admin/users', {
    credentials: 'same-origin',
    cache: 'no-store'
  });
  if (!res.ok) throw new Error('Falha ao carregar usuários');
  return res.json();
}

async function updateUserPlan(id, plan) {
  const res = await fetch(`/api/admin/users/${encodeURIComponent(id)}/plan`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ plan })
  });
  return res.ok;
}

async function toggleUserBan(id) {
  const res = await fetch(`/api/admin/users/${encodeURIComponent(id)}/ban`, {
    method: 'POST',
    credentials: 'same-origin'
  });
  return res.ok;
}

async function deleteUser(id) {
  const res = await fetch(`/api/admin/users/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'same-origin'
  });
  return res.ok;
}

/* ─────────────────────────────────────────
   RENDERIZAÇÃO
   ───────────────────────────────────────── */
export async function renderUsersTable() {
  const filterEl = document.getElementById('userFilter');
  const searchEl = document.getElementById('userSearch');
  const wrap = document.getElementById('usersTable');
  const countEl = document.getElementById('usersCount');
  if (!wrap) return;

  let users;
  try {
    users = await fetchUsers();
  } catch (e) {
    wrap.textContent = 'Erro ao carregar usuários.';
    return;
  }

  const total = users.length;
  const filter = filterEl?.value || 'all';
  const search = (searchEl?.value || '').toLowerCase();

  if (filter !== 'all') users = users.filter((u) => u.plan === filter);
  if (search) {
    users = users.filter((u) =>
      (u.name || '').toLowerCase().includes(search) ||
      (u.email || '').toLowerCase().includes(search)
    );
  }

  if (countEl) countEl.textContent = `${users.length} de ${total}`;

  clearElement(wrap);

  if (!users.length) {
    wrap.appendChild(el('p', {
      style: 'color:var(--text-dim);padding:1rem;text-align:center;',
      text: 'Nenhum usuário encontrado.'
    }));
    return;
  }

  const table = el('table', { class: 'admin-table' });
  const thead = el('thead');
  const tr = el('tr');
  ['Nome', 'E-mail', 'Plano', 'Status', 'Cadastro', 'Ações'].forEach((h) => {
    tr.appendChild(el('th', { text: h }));
  });
  thead.appendChild(tr);
  table.appendChild(thead);

  const tbody = el('tbody');

  users.forEach((u) => {
    const row = el('tr');
    row.appendChild(el('td', { text: u.name || '—' }));
    row.appendChild(el('td', { text: u.email || '—' }));
    row.appendChild(el('td', {}, [badgePlan(u.plan)]));
    row.appendChild(el('td', {}, [
      u.banned
        ? el('span', { class: 'badge-mini badge-banned', text: 'Banido' })
        : el('span', { style: 'color:var(--success);font-size:0.75rem;', text: 'Ativo' })
    ]));
    row.appendChild(el('td', {
      text: u.createdAt ? new Date(u.createdAt).toLocaleDateString('pt-BR') : '—'
    }));

    const actions = el('div', { class: 'actions' });
    actions.appendChild(el('button', {
      class: 'btn btn-ghost btn-sm',
      text: 'Plano',
      onclick: () => handleChangePlan(u)
    }));
    actions.appendChild(el('button', {
      class: 'btn btn-ghost btn-sm',
      text: u.banned ? 'Reativar' : 'Banir',
      onclick: () => handleBan(u)
    }));
    actions.appendChild(el('button', {
      class: 'btn btn-ghost btn-sm',
      style: 'color:var(--danger);',
      text: 'Excluir',
      onclick: () => handleDelete(u)
    }));

    row.appendChild(el('td', {}, [actions]));
    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  wrap.appendChild(table);
}

/* ─── Ações ─── */
async function handleChangePlan(user) {
  const plans = ['free', 'premium', 'anual'];
  const currentIdx = plans.indexOf(user.plan);
  const next = plans[(currentIdx + 1) % plans.length];

  const ok = await confirmDialog({
    title: 'Alterar plano',
    message: `Alterar plano de ${user.email} de "${user.plan}" para "${next}"?`,
    confirmText: 'Alterar'
  });
  if (!ok) return;

  const success = await updateUserPlan(user.id, next);
  if (!success) {
    toast('Falha ao alterar plano.', '⚠');
    return;
  }
  toast('Plano atualizado.', '✓');
  renderUsersTable();
}

async function handleBan(user) {
  const action = user.banned ? 'reativar' : 'banir';
  const ok = await confirmDialog({
    title: user.banned ? 'Reativar usuário' : 'Banir usuário',
    message: `Tem certeza que deseja ${action} ${user.email}?`,
    confirmText: user.banned ? 'Reativar' : 'Banir',
    danger: !user.banned
  });
  if (!ok) return;

  const success = await toggleUserBan(user.id);
  if (!success) {
    toast('Falha ao atualizar status.', '⚠');
    return;
  }
  toast('Status atualizado.', '✓');
  renderUsersTable();
}

async function handleDelete(user) {
  const ok = await confirmDialog({
    title: 'Excluir usuário',
    message: `Excluir permanentemente ${user.email}? Esta ação é irreversível.`,
    confirmText: 'Excluir',
    danger: true
  });
  if (!ok) return;

  const success = await deleteUser(user.id);
  if (!success) {
    toast('Falha ao excluir usuário.', '⚠');
    return;
  }
  toast('Usuário excluído.', '🗑');
  renderUsersTable();
}

export function badgePlan(plan) {
  if (plan === 'free') return el('span', { class: 'badge-mini badge-free', text: 'Free' });
  if (plan === 'premium') return el('span', { class: 'badge-mini badge-premium', text: 'Premium' });
  if (plan === 'anual') return el('span', { class: 'badge-mini badge-premium', text: 'Anual' });
  return el('span', { text: String(plan) });
}

/* ─── Bind de filtros ─── */
export function initUserFilters() {
  const search = document.getElementById('userSearch');
  if (search) search.addEventListener('input', debounce(renderUsersTable, 250));

  const filter = document.getElementById('userFilter');
  if (filter) filter.addEventListener('change', renderUsersTable);
}
