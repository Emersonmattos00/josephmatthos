// admin-login.js
const bcrypt = require('bcryptjs');
const { setSessionCookie } = require('./_admin-session');
const { sendJson } = require('./supabase');

// ─────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 min
const MAX_ATTEMPTS = 5;
const MAX_USER_LENGTH = 64;
const MAX_PASS_LENGTH = 256;

// Hash dummy para manter timing constante quando o usuário não existe.
// Gerado com bcrypt.hashSync('dummy', 10)
const DUMMY_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

// ─────────────────────────────────────────────────────────────
// Rate limiting (⚠️ em memória — troque por Redis/KV em produção)
// ─────────────────────────────────────────────────────────────
const attempts = new Map();

// Limpeza periódica para evitar memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of attempts.entries()) {
    if (now - value.startedAt > ATTEMPT_WINDOW_MS) {
      attempts.delete(key);
    }
  }
}, 60 * 1000).unref?.();

function clientKey(req) {
  // ⚠️ Em produção, use headers confiáveis da plataforma.
  // Vercel: 'x-vercel-forwarded-for' ou 'x-real-ip'
  const headers = req.headers || {};
  const forwarded =
    headers['x-vercel-forwarded-for'] ||
    headers['x-real-ip'] ||
    headers['x-forwarded-for'];
  const ip = String(
    forwarded || (req.socket && req.socket.remoteAddress) || 'unknown'
  ).split(',')[0].trim();
  return ip;
}

function getRateLimitStatus(key) {
  const now = Date.now();
  const current = attempts.get(key);

  if (!current || now - current.startedAt > ATTEMPT_WINDOW_MS) {
    return { limited: false, retryAfter: 0 };
  }

  if (current.count >= MAX_ATTEMPTS) {
    const retryAfter = Math.ceil(
      (current.startedAt + ATTEMPT_WINDOW_MS - now) / 1000
    );
    return { limited: true, retryAfter };
  }

  return { limited: false, retryAfter: 0 };
}

function registerFailure(key) {
  const now = Date.now();
  const current = attempts.get(key);

  if (!current || now - current.startedAt > ATTEMPT_WINDOW_MS) {
    attempts.set(key, { startedAt: now, count: 1 });
    return;
  }

  current.count += 1;
  attempts.set(key, current);
}

function clearFailures(key) {
  attempts.delete(key);
}

// ─────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { ok: false, error: 'Método não permitido.' });
  }

  const key = clientKey(req);
  const rateStatus = getRateLimitStatus(key);

  if (rateStatus.limited) {
    res.setHeader('Retry-After', String(rateStatus.retryAfter));
    console.warn('[admin-login] Rate limit atingido:', { key });
    return sendJson(res, 429, {
      ok: false,
      error: 'Muitas tentativas. Tente novamente mais tarde.'
    });
  }

  // Verifica configuração
  const configuredUser = process.env.ADMIN_USER;
  const configuredHash = process.env.ADMIN_PASSWORD_HASH;
  if (!configuredUser || !configuredHash || !process.env.ADMIN_SESSION_SECRET) {
    console.error('[admin-login] Variáveis de ambiente ausentes.');
    return sendJson(res, 503, {
      ok: false,
      error: 'Autenticação do admin não configurada.'
    });
  }

  // Parse do body
  let payload = req.body;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch {
      payload = null;
    }
  }

  // Validação com limites de tamanho
  const user =
    payload && typeof payload.user === 'string'
      ? payload.user.trim().slice(0, MAX_USER_LENGTH)
      : '';
  const pass =
    payload && typeof payload.pass === 'string'
      ? payload.pass.slice(0, MAX_PASS_LENGTH)
      : '';

  if (!user || !pass) {
    registerFailure(key);
    return sendJson(res, 401, {
      ok: false,
      error: 'Usuário ou senha incorretos.'
    });
  }

  // ⚠️ SEMPRE roda bcrypt, mesmo se o usuário estiver errado,
  // para manter timing constante e evitar enumeração.
  const userMatches = user === configuredUser;
  const hashToCompare = userMatches ? configuredHash : DUMMY_HASH;

  let valid = false;
  try {
    valid = await bcrypt.compare(pass, hashToCompare);
  } catch (error) {
    console.error('[admin-login] Erro no bcrypt.compare:', error.message);
    registerFailure(key);
    return sendJson(res, 401, {
      ok: false,
      error: 'Usuário ou senha incorretos.'
    });
  }

  if (!userMatches || !valid) {
    registerFailure(key);
    console.warn('[admin-login] Tentativa falha:', { key });
    return sendJson(res, 401, {
      ok: false,
      error: 'Usuário ou senha incorretos.'
    });
  }

  // Sucesso
  clearFailures(key);
  console.info('[admin-login] Login bem-sucedido:', { key });
  setSessionCookie(res);
  return sendJson(res, 200, { ok: true });
};
