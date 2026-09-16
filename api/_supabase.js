// supabase.js
// ⚠️ ATENÇÃO: Este arquivo NUNCA deve ser importado no cliente.
// Use apenas em API routes / serverless functions do servidor.

const jwt = require('jsonwebtoken');

// ─────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────
const AUTH_COOKIE = '__Host-jm_auth_access';
const REFRESH_COOKIE = '__Host-jm_auth_refresh';
const ACCESS_MAX_AGE = 60 * 60;             // 1 hora
const REFRESH_MAX_AGE = 60 * 60 * 24 * 7;   // 7 dias
const FETCH_TIMEOUT = 10000;                // 10 segundos
const IS_PROD = process.env.NODE_ENV === 'production';

// ─────────────────────────────────────────────────────────────
// Guard: impede importação no cliente
// ─────────────────────────────────────────────────────────────
if (typeof window !== 'undefined') {
  throw new Error('[supabase.js] Este módulo não pode ser importado no cliente.');
}

// ─────────────────────────────────────────────────────────────
// Configuração
// ─────────────────────────────────────────────────────────────
function getConfig() {
  const url = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const anonKey = process.env.SUPABASE_ANON_KEY || '';
  if (!url || !anonKey) {
    const error = new Error('Supabase não configurado.');
    error.code = 'NOT_CONFIGURED';
    throw error;
  }
  return { url, anonKey };
}

function getAdminKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    const error = new Error('SUPABASE_SERVICE_ROLE_KEY ausente.');
    error.code = 'NOT_CONFIGURED';
    throw error;
  }
  return key;
}

// ─────────────────────────────────────────────────────────────
// Helpers HTTP
// ─────────────────────────────────────────────────────────────
function sendJson(res, status, body) {
  res.status(status);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.end(JSON.stringify(body));
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === 'AbortError') {
      const err = new Error('Timeout ao contactar Supabase.');
      err.code = 'TIMEOUT';
      throw err;
    }
    const err = new Error('Falha de rede ao contactar Supabase.');
    err.code = 'NETWORK_ERROR';
    err.cause = error;
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Função base para requisições ao Supabase.
 * @param {string} path - Caminho da API (ex: '/auth/v1/user')
 * @param {object} options - Opções do fetch (method, body, headers)
 * @param {string} key - apikey a ser usada
 * @param {boolean} useBearer - Se true, adiciona Authorization: Bearer <key>
 */
async function supabaseFetch(path, options, key, useBearer) {
  const { url } = getConfig();
  const headers = {
    apikey: key,
    'Content-Type': 'application/json',
    ...(useBearer ? { Authorization: 'Bearer ' + key } : {}),
    ...(options?.headers || {})
  };

  const response = await fetchWithTimeout(url + path, { ...options, headers });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  return { response, body };
}

function supabaseRequest(path, options) {
  return supabaseFetch(path, options, getConfig().anonKey, false);
}

function supabaseAdminRequest(path, options) {
  return supabaseFetch(path, options, getAdminKey(), true);
}

// ─────────────────────────────────────────────────────────────
// Cookies
// ─────────────────────────────────────────────────────────────
function parseCookies(header) {
  return String(header || '').split(';').reduce((cookies, item) => {
    const separator = item.indexOf('=');
    if (separator < 0) return cookies;
    const key = item.slice(0, separator).trim();
    const value = item.slice(separator + 1).trim();
    if (!key) return cookies;
    try {
      cookies[key] = decodeURIComponent(value);
    } catch {
      cookies[key] = '';
    }
    return cookies;
  }, {});
}

function getAccessToken(req) {
  const cookies = parseCookies(req.headers && (req.headers.cookie || req.headers.Cookie));
  return cookies[AUTH_COOKIE] || '';
}

function getRefreshToken(req) {
  const cookies = parseCookies(req.headers && (req.headers.cookie || req.headers.Cookie));
  return cookies[REFRESH_COOKIE] || '';
}

function cookie(name, value, maxAge) {
  const secure = IS_PROD ? ' Secure;' : '';
  return (
    name + '=' + encodeURIComponent(value || '') +
    '; Max-Age=' + maxAge +
    '; Path=/' +
    '; HttpOnly;' +
    secure +
    ' SameSite=Strict'
  );
}

function setAuthCookies(res, session) {
  res.setHeader('Set-Cookie', [
    cookie(AUTH_COOKIE, session.access_token, ACCESS_MAX_AGE),
    cookie(REFRESH_COOKIE, session.refresh_token, REFRESH_MAX_AGE)
  ]);
}

function clearAuthCookies(res) {
  res.setHeader('Set-Cookie', [
    cookie(AUTH_COOKIE, '', 0),
    cookie(REFRESH_COOKIE, '', 0)
  ]);
}

// ─────────────────────────────────────────────────────────────
// Autenticação
// ─────────────────────────────────────────────────────────────
async function getAuthUser(req) {
  const accessToken = getAccessToken(req);
  if (!accessToken) return null;

  try {
    const result = await supabaseRequest('/auth/v1/user', {
      headers: { Authorization: 'Bearer ' + accessToken }
    });
    if (!result.response.ok || !result.body || !result.body.id) return null;
    return result.body;
  } catch (error) {
    console.error('[Supabase] Erro ao buscar usuário:', error.code || error.message);
    return null;
  }
}

/**
 * Renova a sessão usando o refresh_token.
 * Retorna a nova sessão ou null se falhar.
 */
async function refreshAuthSession(req, res) {
  const refreshToken = getRefreshToken(req);
  if (!refreshToken) return null;

  try {
    const result = await supabaseRequest('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken })
    });

    if (!result.response.ok || !result.body || !result.body.access_token) {
      clearAuthCookies(res);
      return null;
    }

    setAuthCookies(res, result.body);
    return result.body;
  } catch (error) {
    console.error('[Supabase] Erro ao renovar sessão:', error.code || error.message);
    clearAuthCookies(res);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Exportações
// ─────────────────────────────────────────────────────────────
module.exports = {
  clearAuthCookies,
  getAccessToken,
  getAuthUser,
  getRefreshToken,
  refreshAuthSession,
  sendJson,
  setAuthCookies,
  supabaseRequest,
  supabaseAdminRequest
};
