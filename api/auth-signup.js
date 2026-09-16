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
  body = body || {};
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (name.length < 2 || name.length > 120 || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) {
    return sendJson(res, 400, { ok: false, error: 'Dados de cadastro inválidos.' });
  }

  try {
    const result = await supabaseRequest('/auth/v1/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, data: { name } })
    });
    if (!result.response.ok || !result.body || !result.body.user) {
      return sendJson(res, result.response.status === 422 ? 409 : 400, { ok: false, error: 'Não foi possível criar a conta.' });
    }
    if (result.body.access_token) setAuthCookies(res, result.body);
    return sendJson(res, 201, { ok: true, requiresEmailConfirmation: !result.body.access_token, user: { id: result.body.user.id, email, name } });
  } catch (error) {
    return sendJson(res, error.code === 'NOT_CONFIGURED' ? 503 : 502, { ok: false, error: 'Serviço de autenticação indisponível.' });
  }
};
