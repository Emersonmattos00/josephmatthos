const { hasValidSession } = require('./_admin-session');

module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ ok: false, error: 'Método não permitido.' });
    return;
  }

  if (!hasValidSession(req)) {
    res.status(401).json({ ok: false });
    return;
  }

  res.status(200).json({ ok: true });
};
