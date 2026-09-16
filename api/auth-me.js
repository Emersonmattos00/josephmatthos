// auth-me.js
const {
  getAccessToken,
  getAuthUser,
  sendJson,
  supabaseRequest
} = require('./_supabase');

// Planos válidos (whitelist)
const VALID_PLANS = new Set(['free', 'premium', 'anual']);

// Cache simples em memória (⚠️ troque por Redis/KV em produção)
const planCache = new Map();
const PLAN_CACHE_TTL = 60 * 1000; // 1 min

function getCachedPlan(userId) {
  const entry = planCache.get(userId);
  if (entry && Date.now() - entry.cachedAt < PLAN_CACHE_TTL) {
    return entry.plan;
  }
  planCache.delete(userId);
  return null;
}

function setCachedPlan(userId, plan) {
  planCache.set(userId, { plan, cachedAt: Date.now() });
  // Limpeza periódica
  if (planCache.size > 1000) {
    const now = Date.now();
    for (const [key, value] of planCache.entries()) {
      if (now - value.cachedAt > PLAN_CACHE_TTL) planCache.delete(key);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  // Headers defensivos
  res.setHeader('Vary', 'Cookie');
  res.setHeader('Allow', 'GET');
  res.setHeader('Pragma', 'no-cache');

  if (req.method !== 'GET') {
    return sendJson(res, 405, { ok: false, error: 'Método não permitido.' });
  }

  // 1) Autenticar usuário
  let user;
  try {
    user = await getAuthUser(req);
  } catch (error) {
    console.error('[auth-me] Erro em getAuthUser:', error.code || error.message);
    if (error.code === 'NOT_CONFIGURED') {
      return sendJson(res, 503, { ok: false, error: 'Serviço indisponível.' });
    }
    if (error.code === 'TIMEOUT') {
      return sendJson(res, 504, { ok: false, error: 'Tempo esgotado.' });
    }
    return sendJson(res, 502, { ok: false, error: 'Serviço indisponível.' });
  }

  if (!user || !user.id) {
    return sendJson(res, 401, { ok: false });
  }

  // 2) Buscar plano (com cache)
  let plan = getCachedPlan(user.id);
  if (!plan) {
    plan = 'free';
    try {
      const accessToken = getAccessToken(req);
      const profile = await supabaseRequest(
        '/rest/v1/profiles?id=eq.' + encodeURIComponent(user.id) + '&select=plan',
        { headers: { Authorization: 'Bearer ' + accessToken } }
      );

      if (
        profile.response.ok &&
        Array.isArray(profile.body) &&
        profile.body[0] &&
        VALID_PLANS.has(profile.body[0].plan)
      ) {
        plan = profile.body[0].plan;
      }
      setCachedPlan(user.id, plan);
    } catch (error) {
      // Falha ao buscar plano não deve quebrar /me
      console.warn('[auth-me] Erro ao buscar plano:', error.code || error.message);
      // Mantém 'free' como fallback
    }
  }

  // 3) Resposta
  return sendJson(res, 200, {
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: (user.user_metadata && user.user_metadata.name) || '',
      plan
    }
  });
};
