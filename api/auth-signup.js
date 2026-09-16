// auth-signup.js
const { sendJson, setAuthCookies, supabaseRequest } = require('./_supabase');

// ─────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────
const MAX_NAME_LENGTH = 120;
const MIN_NAME_LENGTH = 2;
const MAX_EMAIL_LENGTH = 254;
const MAX_PASSWORD_LENGTH = 256;
const MIN_PASSWORD_LENGTH = 8;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NAME_REGEX = /^[\p{L}\p{N}\s.'-]+$/u;

// Rate limiting (⚠️ em memória — troque por Redis/KV em produção)
const attempts = new Map();
const ATTEMPT_WINDOW_MS = 60 * 60 * 1000; // 1h
const MAX_ATTEMPTS = 5; // 5 cadastros por IP por hora

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

function registerAttempt(key) {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || now - current.startedAt > ATTEMPT_WINDOW_MS) {
    attempts.set(key, { startedAt: now, count: 1 });
    return;
  }
  current.count += 1;
  attempts.set(key, current);
}

// ─────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  // Headers defensivos
  res.setHeader('Vary', 'Cookie');
  res.setHeader('Allow', 'POST');
  res.setHeader('Pragma', 'no-cache');

  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'Método não permitido.' });
  }

  // Rate limiting
  const key = clientKey(req);
  const rateStatus = getRateLimitStatus(key);
  if (rateStatus.limited) {
    res.setHeader('Retry-After', String(rateStatus.retryAfter));
    console.warn('[auth-signup] Rate limit atingido:', { key });
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
  body = body || {};

  // Validação
  const name =
    typeof body.name === 'string'
      ? body.name.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME_LENGTH)
      : '';
  const email =
    typeof body.email === 'string'
      ? body.email.trim().toLowerCase().slice(0, MAX_EMAIL_LENGTH)
      : '';
  const password =
    typeof body.password === 'string'
      ? body.password.slice(0, MAX_PASSWORD_LENGTH)
      : '';

  if (
    name.length < MIN_NAME_LENGTH ||
    !NAME_REGEX.test(name) ||
    !EMAIL_REGEX.test(email) ||
    password.length < MIN_PASSWORD_LENGTH
  ) {
    return sendJson(res, 400, { ok: false, error: 'Dados de cadastro inválidos.' });
  }

  // Registra tentativa (antes de chamar Supabase)
  registerAttempt(key);

  // Cadastro
  try {
    const result = await supabaseRequest('/auth/v1/signup', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        data: { name },
        options: process.env.SIGNUP_REDIRECT_URL
          ? { emailRedirectTo: process.env.SIGNUP_REDIRECT_URL }
          : undefined
      })
    });

    if (!result.response.ok || !result.body || !result.body.user) {
      const status = result.response.status === 422 ? 409 : 400;
      console.warn('[auth-signup] Falha no cadastro:', {
        email,
        status: result.response.status
      });
      return sendJson(res, status, {
        ok: false,
        error: 'Não foi possível criar a conta.'
      });
    }

    const requiresEmailConfirmation = !result.body.access_token;

    if (result.body.access_token) {
      setAuthCookies(res, result.body);
    }

    console.info('[auth-signup] Novo cadastro:', {
      email,
      requiresEmailConfirmation
    });

    return sendJson(res, 201, {
      ok: true,
      requiresEmailConfirmation,
      user: {
        id: result.body.user.id,
        email: result.body.user.email || email,
        name
      }
    });
  } catch (error) {
    console.error('[auth-signup] Erro:', error.code || error.message);

    if (error.code === 'NOT_CONFIGURED') {
      return sendJson(res, 503, { ok: false, error: 'Serviço indisponível.' });
    }
    if (error.code === 'TIMEOUT') {
      return sendJson(res, 504, { ok: false, error: 'Tempo esgotado.' });
    }
    return sendJson(res, 502, { ok: false, error: 'Serviço de autenticação indisponível.' });
  }
};
