// auth-logout.js
const {
  clearAuthCookies,
  getAccessToken,
  sendJson,
  supabaseRequest
} = require('./_supabase');

module.exports = async function handler(req, res) {
  // Headers defensivos
  res.setHeader('Vary', 'Cookie');
  res.setHeader('Allow', 'POST');

  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'Método não permitido.' });
  }

  // Tenta revogar o token no Supabase (best-effort)
  const accessToken = getAccessToken(req);
  if (accessToken) {
    try {
      await supabaseRequest('/auth/v1/logout', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + accessToken }
      });
    } catch (error) {
      // Não bloqueia o logout local se o Supabase falhar
      console.warn('[auth-logout] Falha ao revogar token:', error.code || error.message);
    }
  }

  // Limpa cookies localmente
  try {
    clearAuthCookies(res);
  } catch (error) {
    console.error('[auth-logout] Erro ao limpar cookies:', error.message);
    return sendJson(res, 500, { ok: false, error: 'Erro ao encerrar sessão.' });
  }

  console.info('[auth-logout] Sessão encerrada');
  return sendJson(res, 200, { ok: true });
};
