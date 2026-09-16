const { getAuthUser, sendJson } = require('./_supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { ok: false, error: 'Método não permitido.' });
  }
  try {
    const user = await getAuthUser(req);
    if (!user) return sendJson(res, 401, { ok: false });
    return sendJson(res, 200, { ok: true, user: { id: user.id, email: user.email, name: user.user_metadata && user.user_metadata.name || '' } });
  } catch (error) {
    return sendJson(res, 502, { ok: false, error: 'Serviço de autenticação indisponível.' });
  }
};
