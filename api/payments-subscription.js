const { getAuthUser, sendJson } = require('./_supabase');

function planConfig(plan) {
  if (plan === 'premium') return { reason: 'Assinatura Premium mensal', amount: Number(process.env.MP_PREMIUM_MONTHLY_PRICE || 19.90), frequency: 1 };
  if (plan === 'anual') return { reason: 'Assinatura Premium anual', amount: Number(process.env.MP_PREMIUM_ANNUAL_PRICE || 179), frequency: 12 };
  return null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { ok: false, error: 'Método não permitido.' });
  }

  const token = process.env.MP_ACCESS_TOKEN;
  const backUrl = process.env.MP_BACK_URL;
  if (!token || !backUrl) return sendJson(res, 503, { ok: false, error: 'Pagamento ainda não configurado.' });

  let user;
  try { user = await getAuthUser(req); } catch (error) { return sendJson(res, 502, { ok: false, error: 'Autenticação indisponível.' }); }
  if (!user) return sendJson(res, 401, { ok: false, error: 'Faça login para continuar.' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body || '{}'); } catch (error) { body = {}; }
  }
  const plan = body && body.plan;
  const config = planConfig(plan);
  if (!config || !Number.isFinite(config.amount) || config.amount <= 0) return sendJson(res, 400, { ok: false, error: 'Plano inválido.' });

  try {
    const response = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reason: config.reason,
        external_reference: user.id,
        payer_email: user.email,
        back_url: backUrl,
        auto_recurring: {
          frequency: config.frequency,
          frequency_type: 'months',
          transaction_amount: config.amount,
          currency_id: 'BRL'
        },
        status: 'pending'
      })
    });
    const result = await response.json();
    if (!response.ok || !result.init_point) return sendJson(res, 502, { ok: false, error: 'Não foi possível iniciar o pagamento.' });
    return sendJson(res, 200, { ok: true, checkoutUrl: result.init_point });
  } catch (error) {
    return sendJson(res, 502, { ok: false, error: 'Gateway de pagamento indisponível.' });
  }
};
