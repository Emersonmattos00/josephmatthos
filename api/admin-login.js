const bcrypt = require('bcryptjs');

function sendJson(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { ok: false, error: 'Método não permitido.' });
  }

  const configuredUser = process.env.ADMIN_USER;
  const configuredHash = process.env.ADMIN_PASSWORD_HASH;
  if (!configuredUser || !configuredHash) {
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
    return sendJson(res, 401, { ok: false, error: 'Usuário ou senha incorretos.' });
  }

  const valid = await bcrypt.compare(pass, configuredHash);
  if (!valid) {
    return sendJson(res, 401, { ok: false, error: 'Usuário ou senha incorretos.' });
  }

  return sendJson(res, 200, { ok: true });
};
