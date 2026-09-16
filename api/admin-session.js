// admin-session.js
const { hasValidSession } = require('./_admin-session');
const { sendJson } = require('./supabase');

module.exports = function handler(req, res) {
  // Headers defensivos
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Vary', 'Cookie');
  res.setHeader('Allow', 'GET');

  if (req.method !== 'GET') {
    return sendJson(res, 405, { ok: false, error: 'Método não permitido.' });
  }

  let valid = false;
  try {
    valid = hasValidSession(req);
  } catch (error) {
    console.error('[admin-session] Erro ao validar sessão:', error.message);
    return sendJson(res, 500, { ok: false, error: 'Erro interno.' });
  }

  if (!valid) {
    return sendJson(res, 401, { ok: false });
  }

  return sendJson(res, 200, { ok: true });
};
