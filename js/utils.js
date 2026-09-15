/* ============================================================
   UTILS.JS — Funções utilitárias globais
   ============================================================ */

/* ------------------------------------------------------------
   ESC — escapa HTML para prevenir XSS em conteúdo dinâmico
   ------------------------------------------------------------ */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/* ------------------------------------------------------------
   DEBOUNCE — atrasa execução até o usuário parar de chamar
   ------------------------------------------------------------ */
function debounce(func, wait) {
  wait = wait || 300;
  var timeout;
  return function () {
    var args = arguments;
    var ctx = this;
    clearTimeout(timeout);
    timeout = setTimeout(function () { func.apply(ctx, args); }, wait);
  };
}

/* ------------------------------------------------------------
   COMPRESS IMAGE — redimensiona e comprime imagens via Canvas
   ------------------------------------------------------------ */
function compressImage(file, maxWidth, quality) {
  maxWidth = maxWidth || 1920;
  quality = quality || 0.82;
  return new Promise(function (resolve, reject) {
    if (!file) { reject(new Error('Arquivo ausente')); return; }
    if (!file.type || !file.type.startsWith('image/')) { reject(new Error('Arquivo não é imagem')); return; }

    var reader = new FileReader();
    reader.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        var canvas = document.createElement('canvas');
        var width = img.width;
        var height = img.height;
        if (width > maxWidth) { height = (height * maxWidth) / width; width = maxWidth; }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        try {
          resolve(canvas.toDataURL('image/jpeg', quality));
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = function () { reject(new Error('Falha ao carregar imagem')); };
      img.src = e.target.result;
    };
    reader.onerror = function () { reject(new Error('Falha ao ler arquivo')); };
    reader.readAsDataURL(file);
  });
}

/* ------------------------------------------------------------
   LUHN CHECK — validação de número de cartão de crédito
   ------------------------------------------------------------ */
function luhnCheck(num) {
  var digits = String(num).replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  var sum = 0, alt = false;
  for (var i = digits.length - 1; i >= 0; i--) {
    var n = parseInt(digits.charAt(i), 10);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

/* ------------------------------------------------------------
   FORMAT TIME — segundos em "m:ss" (com guard de NaN/Infinity)
   ------------------------------------------------------------ */
function formatTime(sec) {
  if (isNaN(sec) || !isFinite(sec) || sec < 0) return '0:00';
  var m = Math.floor(sec / 60);
  var s = Math.floor(sec % 60);
  return m + ':' + (s < 10 ? '0' + s : s);
}

/* ------------------------------------------------------------
   TOAST — notificação flutuante (auto-dismiss em 3.2s)
   ------------------------------------------------------------ */
var _toastTimer = null;
function toast(msg, icon) {
  var el = document.getElementById('toast');
  if (!el) { console.log('[toast]', msg); return; }
  var msgEl = document.getElementById('toastMsg');
  var iconEl = document.getElementById('toastIcon');
  if (msgEl) msgEl.textContent = msg;
  if (iconEl) iconEl.textContent = icon || '✦';
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(function () { el.classList.remove('show'); }, 3200);
}

/* ------------------------------------------------------------
   GENERATE ID — ID único (UUID com fallback)
   ------------------------------------------------------------ */
function generateId(prefix) {
  prefix = prefix || 'id';
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return prefix + '-' + crypto.randomUUID();
  }
  return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
}

/* ------------------------------------------------------------
   FORMAT BYTES — 1048576 → "1 MB"
   ------------------------------------------------------------ */
function formatBytes(bytes) {
  if (bytes === null || bytes === undefined || isNaN(bytes)) return '—';
  if (bytes === 0) return '0 B';
  var units = ['B', 'KB', 'MB', 'GB', 'TB'];
  var i = 0, v = bytes;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return (v >= 10 || i === 0 ? v.toFixed(0) : v.toFixed(1)) + ' ' + units[i];
}

/* ------------------------------------------------------------
   SLUGIFY — "Cálice de Verso" → "calice-de-verso"
   ------------------------------------------------------------ */
function slugify(s) {
  var result = String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return result || 'faixa';
}

/* ------------------------------------------------------------
   ÁUDIO — formatos aceitos no upload
   ------------------------------------------------------------ */
var AUDIO_EXTS = ['mp3','wav','ogg','oga','m4a','mp4','flac','aac','wma','opus','webm','aif','aiff','amr','mid','midi','3gp'];

function isAudioFile(file) {
  if (!file) return false;
  if (file.type && file.type.startsWith('audio/')) return true;
  var name = String(file.name || '');
  var ext = name.split('.').pop().toLowerCase();
  return AUDIO_EXTS.indexOf(ext) !== -1;
}

/* ------------------------------------------------------------
   HASH DE SENHA
   ------------------------------------------------------------
   ⚠️  AVISO DE SEGURANÇA:
   Hash no cliente NÃO substitui backend seguro. Use HTTPS +
   bcrypt/Argon2 no servidor em produção.
   Este código existe apenas para não armazenar senhas em texto
   puro no localStorage.
   ------------------------------------------------------------ */

/** Hash legado (djb2) — mantido para MIGRAÇÃO de contas antigas */
function _legacyHash(str) {
  var h = 0;
  for (var i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return 'h' + Math.abs(h).toString(36);
}

/**
 * Hash SHA-256 (hex) prefixado com "sha256:".
 * Fallback legado se SubtleCrypto indisponível.
 * É ASSÍNCRONO — use await.
 */
async function hashStr(str) {
  if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
    try {
      var enc = new TextEncoder().encode(str);
      var buf = await crypto.subtle.digest('SHA-256', enc);
      var bytes = new Uint8Array(buf);
      // ✅ Sem loop perdido — converte direto
      var hex = Array.from(bytes).map(function (b) {
        return b.toString(16).padStart(2, '0');
      }).join('');
      return 'sha256:' + hex;
    } catch (e) {
      console.warn('SubtleCrypto falhou, usando fallback legado:', e);
    }
  }
  return _legacyHash(str);
}

/**
 * Verifica senha contra hash armazenado.
 * Aceita hashes novos (sha256:...) e legados (hXXXX).
 * Retorna { ok, needsMigration }.
 * É ASSÍNCRONO — use await.
 */
async function verifyPassword(plain, stored) {
  if (!stored || typeof stored !== 'string') {
    return { ok: false, needsMigration: false };
  }

  // Hash novo (SHA-256)
  if (stored.indexOf('sha256:') === 0) {
    var computed = await hashStr(plain);
    return { ok: computed === stored, needsMigration: false };
  }

  // Hash legado (djb2) — migração automática
  if (stored.charAt(0) === 'h') {
    var ok = _legacyHash(plain) === stored;
    return { ok: ok, needsMigration: ok };
  }

  return { ok: false, needsMigration: false };
}