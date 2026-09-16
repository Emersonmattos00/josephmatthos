const { clearAuthCookies, sendJson } = require('./_supabase');

module.exports = function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { ok: false, error: 'Método não permitido.' });
  }
  clearAuthCookies(res);
  return sendJson(res, 200, { ok: true });
};
