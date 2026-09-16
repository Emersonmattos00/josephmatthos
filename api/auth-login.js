// auth-login.js
const { sendJson, setAuthCookies, supabaseRequest } = require('./_supabase');

// ─────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────
const MAX_EMAIL_LENGTH = 254;
const MAX_PASSWORD_LENGTH = 256;
const MIN_PASSWORD_LENGTH = 6;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Rate limiting (⚠️ em memória — troque por Redis/KV em produção)
const attempts = new Map();
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of attempts.entries()) {
    if (now - value.startedAt > ATTEMPT_WINDOW_MS) attempts.delete(key);
  }
}, 60 * 1000).unref?.();

function clientKey(req) {
  const headers = req.headers || {};
  const forwarded =
    headers['x-vercel-forwarded-for'] ||
    headers['x-real-ip'] ||
    headers['x-forwarded-for'];
  return String(forwarded || (req.socket && req.socket.remoteAddress) || 'unknown')
    .split(',')[0]
    .trim();
}

function getRateLimitStatus(key) {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || now - current.startedAt > ATTEMPT_WINDOW_MS) {
    return { limited: false, retryAfter: 0 };
  }
  if (current.count >= MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((current.startedAt + ATTEMPT_WINDOW_MS - now) / 1000);
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
  // Headers defensivos
  res.setHeader('Vary', 'Cookie');
  res.setHeader('Allow', 'POST');

  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'Método não permitido.' });
  }

  // Rate limiting
  const key = clientKey(req);
  const rateStatus = getRateLimitStatus(key);
  if (rateStatus.limited) {
    res.setHeader('Retry-After', String(rateStatus.retryAfter));
    console.warn('[auth-login] Rate limit atingido:', { key });
    return sendJson(res, 429, {
      ok: false,
      error: 'Muitas tentativas. Tente novamente mais tarde.'
    });
  }

  // Parse do body
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body || '{}');
    } catch {
      body = {};
    }
  }

  // Validação com limites
  const email =
    body && typeof body.email === 'string'
      ? body.email.trim().toLowerCase().slice(0, MAX_EMAIL_LENGTH)
      : '';
  const password =
    body && typeof body.password === 'string'
      ? body.password.slice(0, MAX_PASSWORD_LENGTH)
      : '';

  if (!EMAIL_REGEX.test(email) || !password || password.length < MIN_PASSWORD_LENGTH) {
    registerFailure(key);
    return sendJson(res, 400, { ok: false, error: 'E-mail ou senha inválidos.' });
  }

  try {
    const result = await supabaseRequest('/auth/v1/token?grant_type=password', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    if (!result.response.ok || !result.body || !result.body.access_token) {
      registerFailure(key);
      console.warn('[auth-login] Login falhou:', { email, key });
      return sendJson(res, 401, { ok: false, error: 'E-mail ou senha incorretos.' });
    }

    // Defensivo: valida se user existe
    const user = result.body.user || {};
    const metadata = user.user_metadata || {};

    clearFailures(key);
    setAuthCookies(res, result.body);

    console.info('[auth-login] Login bem-sucedido:', { userId: user.id });

    return sendJson(res, 200, {
      ok: true,
      user: {
        id: user.id || '',
        email: user.email || email,
        name: metadata.name || ''
      }
    });
  } catch (error) {
    console.error('[auth-login] Erro:', error.code || error.message);

    // Diferencia tipos de erro
    if (error.code === 'NOT_CONFIGURED') {
      return sendJson(res, 503, { ok: false, error: 'Serviço de autenticação indisponível.' });
    }
    if (error.code === 'TIMEOUT') {
      return sendJson(res, 504, { ok: false, error: 'Tempo esgotado. Tente novamente.' });
    }
    return sendJson(res, 502, { ok: false, error: 'Serviço de autenticação indisponível.' });
  }
};
