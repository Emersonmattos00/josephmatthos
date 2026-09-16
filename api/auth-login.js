const { sendJson, setAuthCookies, supabaseRequest } = require('./_supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { ok: false, error: 'Método não permitido.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body || '{}'); } catch (error) { body = {}; }
  }
  const email = body && typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = body && typeof body.password === 'string' ? body.password : '';
  if (!/^\S+@\S+\.\S+$/.test(email) || !password) {
    return sendJson(res, 400, { ok: false, error: 'E-mail ou senha inválidos.' });
  }

  try {
    const result = await supabaseRequest('/auth/v1/token?grant_type=password', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (!result.response.ok || !result.body || !result.body.access_token) {
      return sendJson(res, 401, { ok: false, error: 'E-mail ou senha incorretos.' });
    }
    setAuthCookies(res, result.body);
    return sendJson(res, 200, { ok: true, user: { id: result.body.user.id, email: result.body.user.email, name: result.body.user.user_metadata && result.body.user.user_metadata.name || '' } });
  } catch (error) {
    return sendJson(res, error.code === 'NOT_CONFIGURED' ? 503 : 502, { ok: false, error: 'Serviço de autenticação indisponível.' });
  }
};
