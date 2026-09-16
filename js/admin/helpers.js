// js/admin/helpers.js
'use strict';

/**
 * Escapa HTML de forma robusta.
 * Usar SEMPRE que interpolar strings em HTML.
 */
export function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#96;');
}

/**
 * Escapa valor para uso em atributo CSS (style).
 * Remove caracteres perigosos.
 */
export function escCssUrl(url) {
  const s = String(url == null ? '' : url);
  // Só permite URLs http(s), data:image, caminhos relativos
  if (!/^(https?:\/\/|data:image\/|\/|assets\/)/i.test(s)) return '';
  return s.replace(/["'()\\]/g, '');
}

/**
 * Deep merge seguro — previne prototype pollution.
 */
export function safeDeepMerge(target, source) {
  if (!source || typeof source !== 'object') return target;
  const FORBIDDEN = new Set(['__proto__', 'constructor', 'prototype']);

  for (const key of Object.keys(source)) {
    if (FORBIDDEN.has(key)) continue;

    const srcVal = source[key];
    const tgtVal = target[key];

    if (Array.isArray(srcVal)) {
      target[key] = srcVal.slice();
    } else if (srcVal && typeof srcVal === 'object') {
      target[key] = safeDeepMerge(
        tgtVal && typeof tgtVal === 'object' ? tgtVal : {},
        srcVal
      );
    } else {
      target[key] = srcVal;
    }
  }
  return target;
}

/**
 * Gera ID único.
 */
export function generateId(prefix = 'id') {
  if (crypto && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Formata bytes.
 */
export function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

/**
 * Formata preço em BRL.
 */
export function formatPrice(value) {
  return 'R$ ' + (Number(value) || 0).toFixed(2).replace('.', ',');
}

/**
 * Debounce.
 */
export function debounce(fn, ms = 250) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}

/**
 * Remove todos os filhos de um elemento.
 */
export function clearElement(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

/**
 * Cria elemento com atributos e filhos.
 */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (v != null && v !== false) {
      node.setAttribute(k, v);
    }
  }
  for (const child of [].concat(children)) {
    if (typeof child === 'string') node.appendChild(document.createTextNode(child));
    else if (child) node.appendChild(child);
  }
  return node;
}
