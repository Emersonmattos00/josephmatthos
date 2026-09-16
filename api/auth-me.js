const { getAccessToken, getAuthUser, sendJson, supabaseRequest } = require('./_supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { ok: false, error: 'Método não permitido.' });
  }
  try {
    const user = await getAuthUser(req);
    if (!user) return sendJson(res, 401, { ok: false });
    var plan = 'free';
    const profile = await supabaseRequest('/rest/v1/profiles?id=eq.' + encodeURIComponent(user.id) + '&select=plan', { headers: { Authorization: 'Bearer ' + getAccessToken(req) } });
    if (profile.response.ok && Array.isArray(profile.body) && profile.body[0] && ['free', 'premium', 'anual'].indexOf(profile.body[0].plan) > -1) plan = profile.body[0].plan;
    return sendJson(res, 200, { ok: true, user: { id: user.id, email: user.email, name: user.user_metadata && user.user_metadata.name || '', plan } });
  } catch (error) {
    return sendJson(res, 502, { ok: false, error: 'Serviço de autenticação indisponível.' });
  }
};
