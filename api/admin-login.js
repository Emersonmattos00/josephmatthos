const bcrypt = require('bcryptjs');
const { setSessionCookie } = require('./_admin-session');

const attempts = new Map();
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function clientKey(req) {
  const forwarded = req.headers && (req.headers['x-forwarded-for'] || req.headers['X-Forwarded-For']);
  return String(forwarded || req.socket && req.socket.remoteAddress || 'unknown').split(',')[0].trim();
}

function isRateLimited(key) {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || now - current.startedAt > ATTEMPT_WINDOW_MS) {
    attempts.set(key, { startedAt: now, count: 0 });
    return false;
  }
  return current.count >= MAX_ATTEMPTS;
}

function registerFailure(key) {
  const current = attempts.get(key) || { startedAt: Date.now(), count: 0 };
  current.count += 1;
  attempts.set(key, current);
}

function sendJson(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { ok: false, error: 'Método não permitido.' });
  }

  const key = clientKey(req);
  if (isRateLimited(key)) {
    res.setHeader('Retry-After', '900');
    return sendJson(res, 429, { ok: false, error: 'Muitas tentativas. Tente novamente mais tarde.' });
  }

  const configuredUser = process.env.ADMIN_USER;
  const configuredHash = process.env.ADMIN_PASSWORD_HASH;
  if (!configuredUser || !configuredHash || !process.env.ADMIN_SESSION_SECRET) {
    return sendJson(res, 503, { ok: false, error: 'Autenticação do admin não configurada.' });
  }

  let payload = req.body;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch (error) {
      payload = null;
    }
  }

  const user = payload && typeof payload.user === 'string' ? payload.user.trim() : '';
  const pass = payload && typeof payload.pass === 'string' ? payload.pass : '';
  if (!user || !pass || user !== configuredUser) {
    registerFailure(key);
    return sendJson(res, 401, { ok: false, error: 'Usuário ou senha incorretos.' });
  }

  const valid = await bcrypt.compare(pass, configuredHash);
  if (!valid) {
    registerFailure(key);
    return sendJson(res, 401, { ok: false, error: 'Usuário ou senha incorretos.' });
  }

  attempts.delete(key);
  setSessionCookie(res);
  return sendJson(res, 200, { ok: true });
};
