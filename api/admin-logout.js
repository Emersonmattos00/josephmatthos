// admin-logout.js
const { clearSessionCookie } = require('./_admin-session');
const { sendJson } = require('./supabase');

module.exports = function handler(req, res) {
  // Sempre define no-store, mesmo em erros
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Allow', 'POST');

  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'Método não permitido.' });
  }

  clearSessionCookie(res);
  console.info('[admin-logout] Sessão encerrada');
  return sendJson(res, 200, { ok: true });
};
