const { clearSessionCookie } = require('./_admin-session');

module.exports = function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ ok: false, error: 'Método não permitido.' });
    return;
  }

  clearSessionCookie(res);
  res.status(200).json({ ok: true });
};
