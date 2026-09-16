// js/admin/content.js
'use strict';

import { esc, escCssUrl, setByPath, getByPath, el, clearElement, safeDeepMerge } from './helpers.js';
import { toast, confirmDialog } from './ui.js';

/* ─────────────────────────────────────────
   CARREGAMENTO DE CAMPOS data-content
   ───────────────────────────────────────── */
export function loadAllAdminFields(CONTENT) {
  document.querySelectorAll('[data-content]').forEach((input) => {
    const val = getByPath(CONTENT, input.dataset.content);
    if (input.type === 'color') input.value = val || '#000000';
    else if (input.type === 'checkbox') input.checked = !!val;
    else input.value = val == null ? '' : val;
  });
}

export function bindContentInputs(CONTENT, onChange) {
  document.querySelectorAll('[data-content]').forEach((input) => {
    if (input.dataset.bound === '1') return;
    input.dataset.bound = '1';

    input.addEventListener('input', () => {
      let val = input.value;
      if (input.type === 'checkbox') val = input.checked;
      if (input.type === 'number') val = parseFloat(val) || 0;

      setByPath(CONTENT, input.dataset.content, val);
      onChange(input.dataset.content);
    });
  });
}

/* ─────────────────────────────────────────
   PREVIEWS DE IMAGEM (seguro)
   ───────────────────────────────────────── */
export function updateImagePreview(elementId, url, emptyText = 'Sem imagem') {
  const el = document.getElementById(elementId);
  if (!el) return;

  const safe = escCssUrl(url);
  if (safe) {
    el.style.backgroundImage = `url("${safe}")`;
    el.textContent = '';
  } else {
    el.style.backgroundImage = '';
    el.textContent = emptyText;
  }
}

/* ─────────────────────────────────────────
   UPLOAD DE IMAGEM (com validação)
   ───────────────────────────────────────── */
export function bindImageUpload(inputId, maxWidth, quality, onUpload) {
  const input = document.getElementById(inputId);
  if (!input) return;

  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast('Arquivo inválido. Envie uma imagem.', '⚠');
      input.value = '';
      return;
    }

    // Limite de 10MB
    if (file.size > 10 * 1024 * 1024) {
      toast('Imagem muito grande (máx. 10MB).', '⚠');
      input.value = '';
      return;
    }

    try {
      toast('Comprimindo imagem...', '🖼');
      const dataUrl = await compressImage(file, maxWidth, quality);
      onUpload(dataUrl);
    } catch (err) {
      console.error(err);
      toast('Erro ao processar imagem.', '⚠');
    }
    input.value = '';
  });
}

/**
 * Comprime imagem via canvas.
 */
export function compressImage(file, maxWidth = 1920, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        try {
          resolve(canvas.toDataURL('image/jpeg', quality));
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ─────────────────────────────────────────
   DESCRIÇÃO DE CAMINHO DE IMAGEM
   ───────────────────────────────────────── */
export function describeImagePath(data) {
  if (!data) return 'sem imagem';
  const s = String(data);

  if (s.startsWith('data:')) {
    const base64 = s.split(',')[1] || '';
    const bytes = Math.round(base64.length * 0.75);
    return `upload local (${formatBytes(bytes)})`;
  }
  if (/^https?:\/\//i.test(s)) return s;

  const origin = window.location.origin;
  const path = s.startsWith('/') ? s : '/' + s;
  return origin + path;
}
