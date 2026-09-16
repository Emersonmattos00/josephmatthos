// js/admin/backup.js
'use strict';

import { safeDeepMerge, el, clearElement } from './helpers.js';
import { toast, confirmDialog } from './ui.js';

const SCHEMA_VERSION = 1;

export function initBackup({ getContent, setContent, getDefaultContent, onAfterRestore }) {
  /* Salvar */
  const saveBtn = document.getElementById('adminSaveBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const ok = saveContent(getContent());
      toast(ok ? 'Alterações salvas.' : 'Não foi possível salvar.', ok ? '💾' : '⚠');
    });
  }

  /* Reset */
  const resetBtn = document.getElementById('adminResetBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: 'Restaurar padrão',
        message: 'Restaurar todo o conteúdo para o padrão?',
        confirmText: 'Restaurar',
        danger: true
      });
      if (!ok) return;

      setContent(JSON.parse(JSON.stringify(getDefaultContent())));
      saveContent(getContent());
      onAfterRestore();
      toast('Conteúdo restaurado.', '↺');
    });
  }

  /* Exportar */
  const exportBtn = document.getElementById('exportBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const pack = {
        _version: SCHEMA_VERSION,
        _exportedAt: new Date().toISOString(),
        content: getContent()
      };
      const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = el('a', {
        href: url,
        download: `joseph-matthos-content-${Date.now()}.json`
      });
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast('Exportado.', '⬇');
    });
  }

  /* Importar */
  const importFile = document.getElementById('importFile');
  if (importFile) {
    importFile.addEventListener('change', (e) => {
      const f = e.target.files?.[0];
      if (!f) return;

      if (f.size > 20 * 1024 * 1024) {
        toast('Arquivo muito grande (máx. 20MB).', '⚠');
        e.target.value = '';
        return;
      }

      const r = new FileReader();
      r.onload = () => {
        try {
          const parsed = JSON.parse(r.result);
          const data = parsed.content || parsed;

          // 🔒 Safe merge contra prototype pollution
          const merged = safeDeepMerge(
            JSON.parse(JSON.stringify(getDefaultContent())),
            data
          );

          setContent(merged);
          saveContent(getContent());
          onAfterRestore();
          toast('Conteúdo importado.', '⬆');
        } catch {
          toast('Arquivo inválido.', '⚠');
        }
      };
      r.readAsText(f);
      e.target.value = '';
    });
  }

  /* Wipe */
  const wipeBtn = document.getElementById('wipeBtn');
  if (wipeBtn) {
    wipeBtn.addEventListener('click', async () => {
      const ok1 = await confirmDialog({
        title: 'Apagar tudo',
        message: 'Apagar TUDO (conteúdo + usuários + áudios)? Irreversível.',
        confirmText: 'Continuar',
        danger: true
      });
      if (!ok1) return;

      const ok2 = await confirmDialog({
        title: 'Confirmação final',
        message: 'Tem certeza absoluta? Esta ação NÃO pode ser desfeita.',
        confirmText: 'Apagar tudo',
        danger: true
      });
      if (!ok2) return;

      // Limpa localStorage
      [
        'jm_content', 'jm_users', 'jm_session', 'jm_admin',
        'jm_volume', 'jm_cart', 'jm_purchases'
      ].forEach((k) => localStorage.removeItem(k));

      // Limpa IndexedDB
      try {
        await new Promise((resolve) => {
          const req = indexedDB.deleteDatabase('jm_audio');
          req.onsuccess = req.onerror = req.onblocked = resolve;
        });
      } catch {}

      location.reload();
    });
  }
}

/* ─── Funções auxiliares ─── */
function saveContent(content) {
  try {
    localStorage.setItem('jm_content', JSON.stringify(content));
    return true;
  } catch (e) {
    console.error('Erro ao salvar:', e);
    return false;
  }
}
