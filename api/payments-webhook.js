const { sendJson, supabaseAdminRequest } = require('./_supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { ok: false, error: 'Método não permitido.' });
  }

  const body = req.body || {};
  const type = body.type || body.action;
  const subscriptionId = body.data && body.data.id || body.id || req.query && req.query.id;
  if (!subscriptionId || (type && type.indexOf('subscription') === -1 && type.indexOf('preapproval') === -1)) return sendJson(res, 200, { ok: true });

  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) return sendJson(res, 503, { ok: false, error: 'Pagamento não configurado.' });

  try {
    const response = await fetch('https://api.mercadopago.com/preapproval/' + encodeURIComponent(subscriptionId), { headers: { Authorization: 'Bearer ' + token } });
    const subscription = await response.json();
    if (!response.ok || !subscription.external_reference) return sendJson(res, 200, { ok: true });

    const active = subscription.status === 'authorized' || subscription.status === 'approved';
    const annual = /anual/i.test(subscription.reason || '');
    const plan = active ? (annual ? 'anual' : 'premium') : 'free';
    const update = await supabaseAdminRequest('/rest/v1/profiles?id=eq.' + encodeURIComponent(subscription.external_reference), {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ plan, subscription_id: String(subscription.id), subscription_status: subscription.status, updated_at: new Date().toISOString() })
    });
    if (!update.response.ok) return sendJson(res, 502, { ok: false, error: 'Não foi possível atualizar a assinatura.' });
    return sendJson(res, 200, { ok: true });
  } catch (error) {
    return sendJson(res, 502, { ok: false, error: 'Webhook indisponível.' });
  }
};
