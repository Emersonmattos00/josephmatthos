// payments-subscription.js
const { getAuthUser, sendJson, supabaseAdminRequest } = require('./_supabase');

// ─────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────
const MP_API_URL = 'https://api.mercadopago.com/preapproval';
const FETCH_TIMEOUT = 10000;

const VALID_PLANS = new Set(['premium', 'anual']);

// Rate limiting (⚠️ em memória — troque por Redis/KV em produção)
const attempts = new Map();
const ATTEMPT_WINDOW_MS = 60 * 60 * 1000; // 1h
const MAX_ATTEMPTS = 5;

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of attempts.entries()) {
    if (now - value.startedAt > ATTEMPT_WINDOW_MS) attempts.delete(key);
  }
}, 60 * 1000).unref?.();

function getRateLimitStatus(userId) {
  const now = Date.now();
  const current = attempts.get(userId);
  if (!current || now - current.startedAt > ATTEMPT_WINDOW_MS) {
    return { limited: false, retryAfter: 0 };
  }
  if (current.count >= MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((current.startedAt + ATTEMPT_WINDOW_MS - now) / 1000);
    return { limited: true, retryAfter };
  }
  return { limited: false, retryAfter: 0 };
}

function registerAttempt(userId) {
  const now = Date.now();
  const current = attempts.get(userId);
  if (!current || now - current.startedAt > ATTEMPT_WINDOW_MS) {
    attempts.set(userId, { startedAt: now, count: 1 });
    return;
  }
  current.count += 1;
  attempts.set(userId, current);
}

function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timeout));
}

// ─────────────────────────────────────────────────────────────
// Configuração de planos
// ─────────────────────────────────────────────────────────────
function getPlanConfig(plan) {
  if (plan === 'premium') {
    return {
      reason: 'Assinatura Premium mensal',
      amount: Number(process.env.MP_PREMIUM_MONTHLY_PRICE || 19.90),
      frequency: 1,
      frequencyType: 'months',
      planId: process.env.MP_PREMIUM_MONTHLY_PLAN_ID || null
    };
  }
  if (plan === 'anual') {
    return {
      reason: 'Assinatura Premium anual',
      amount: Number(process.env.MP_PREMIUM_ANNUAL_PRICE || 179),
      frequency: 12,
      frequencyType: 'months',
      planId: process.env.MP_PREMIUM_ANNUAL_PLAN_ID || null
    };
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// Verificações no banco
// ─────────────────────────────────────────────────────────────
async function hasActiveSubscription(userId) {
  const result = await supabaseAdminRequest(
    `/rest/v1/subscriptions?user_id=eq.${encodeURIComponent(userId)}&status=in.(authorized,pending)&select=id,plan,status`,
    { method: 'GET' }
  );
  return result.response.ok && Array.isArray(result.body) && result.body.length > 0;
}

// ─────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  // Headers defensivos
  res.setHeader('Vary', 'Cookie');
  res.setHeader('Allow', 'POST');
  res.setHeader('Pragma', 'no-cache');

  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'Método não permitido.' });
  }

  // Configuração
  const token = process.env.MP_ACCESS_TOKEN;
  const backUrl = process.env.MP_BACK_URL;

  if (!token || !backUrl) {
    console.error('[payments-subscription] Mercado Pago não configurado.');
    return sendJson(res, 503, { ok: false, error: 'Pagamento ainda não configurado.' });
  }

  if (!backUrl.startsWith('https://')) {
    console.error('[payments-subscription] MP_BACK_URL deve ser HTTPS.');
    return sendJson(res, 503, { ok: false, error: 'Configuração inválida.' });
  }

  // Autenticação
  let user;
  try {
    user = await getAuthUser(req);
  } catch (error) {
    console.error('[payments-subscription] Erro em getAuthUser:', error.code || error.message);
    return sendJson(res, 502, { ok: false, error: 'Autenticação indisponível.' });
  }

  if (!user || !user.id || !user.email) {
    return sendJson(res, 401, { ok: false, error: 'Faça login para continuar.' });
  }

  // Rate limiting
  const rateStatus = getRateLimitStatus(user.id);
  if (rateStatus.limited) {
    res.setHeader('Retry-After', String(rateStatus.retryAfter));
    console.warn('[payments-subscription] Rate limit atingido:', { userId: user.id });
    return sendJson(res, 429, {
      ok: false,
      error: 'Muitas tentativas. Tente novamente mais tarde.'
    });
  }

  // Parse do body
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body || '{}');
    } catch {
      body = {};
    }
  }
  body = body || {};

  // Validação do plano
  const plan = typeof body.plan === 'string' ? body.plan.trim().toLowerCase() : '';
  if (!VALID_PLANS.has(plan)) {
    return sendJson(res, 400, { ok: false, error: 'Plano inválido.' });
  }

  const config = getPlanConfig(plan);
  if (!config || !Number.isFinite(config.amount) || config.amount <= 0) {
    console.error('[payments-subscription] Configuração de plano inválida:', plan);
    return sendJson(res, 500, { ok: false, error: 'Configuração de plano indisponível.' });
  }

  // 🔒 Verificar se já tem assinatura ativa
  try {
    const hasActive = await hasActiveSubscription(user.id);
    if (hasActive) {
      return sendJson(res, 409, {
        ok: false,
        error: 'Você já possui uma assinatura ativa.'
      });
    }
  } catch (error) {
    console.warn('[payments-subscription] Erro ao verificar assinatura:', error.message);
    // Não bloqueia — segue com a criação
  }

  // Registrar tentativa
  registerAttempt(user.id);

  // Criar assinatura no Mercado Pago
  try {
    const mpBody = {
      reason: config.reason,
      external_reference: user.id,
      payer_email: user.email,
      back_url: backUrl,
      auto_recurring: {
        frequency: config.frequency,
        frequency_type: config.frequencyType,
        transaction_amount: config.amount,
        currency_id: 'BRL'
      },
      status: 'pending',
      ...(process.env.MP_WEBHOOK_URL
        ? { notification_url: process.env.MP_WEBHOOK_URL }
        : {})
    };

    // Se tiver preapproval_plan_id, usa (mais robusto)
    if (config.planId) {
      mpBody.preapproval_plan_id = config.planId;
      delete mpBody.auto_recurring;
      delete mpBody.reason;
      delete mpBody.status;
    }

    const response = await fetchWithTimeout(MP_API_URL, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(mpBody)
    });

    const result = await response.json();

    if (!response.ok || !result.init_point) {
      console.error('[payments-subscription] Erro do Mercado Pago:', {
        status: response.status,
        error: result.message || result.error
      });
      return sendJson(res, 502, {
        ok: false,
        error: 'Não foi possível iniciar o pagamento.'
      });
    }

    console.info('[payments-subscription] Assinatura criada:', {
      userId: user.id,
      plan,
      amount: config.amount,
      preapprovalId: result.id
    });

    return sendJson(res, 200, {
      ok: true,
      checkoutUrl: result.init_point,
      preapprovalId: result.id
    });
  } catch (error) {
    console.error('[payments-subscription] Erro:', error.code || error.message);

    if (error.code === 'TIMEOUT') {
      return sendJson(res, 504, { ok: false, error: 'Tempo esgotado. Tente novamente.' });
    }
    return sendJson(res, 502, { ok: false, error: 'Gateway de pagamento indisponível.' });
  }
};
