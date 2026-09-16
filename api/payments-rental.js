const { getAuthUser, sendJson } = require('./_supabase');

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
  const albumId = body && typeof body.albumId === 'string' ? body.albumId : '';
  const trackIndex = Number(body && body.trackIndex);
  const title = body && typeof body.title === 'string' ? body.title.slice(0, 160) : '';
  const amount = Number(body && body.amount);
  if (!albumId || !Number.isInteger(trackIndex) || trackIndex < 0 || !title || !Number.isFinite(amount) || amount <= 0) {
    return sendJson(res, 400, { ok: false, error: 'Faixa inválida.' });
  }

  try {
    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ id: albumId + ':' + trackIndex, title: 'Aluguel 48h: ' + title, quantity: 1, currency_id: 'BRL', unit_price: amount }],
        payer: { email: user.email },
        external_reference: JSON.stringify({ type: 'rental', userId: user.id, albumId, trackIndex }),
        back_urls: { success: backUrl, failure: backUrl, pending: backUrl },
        auto_return: 'approved'
      })
    });
    const result = await response.json();
    if (!response.ok || !result.init_point) return sendJson(res, 502, { ok: false, error: 'Não foi possível iniciar o pagamento.' });
    return sendJson(res, 200, { ok: true, checkoutUrl: result.init_point });
  } catch (error) {
    return sendJson(res, 502, { ok: false, error: 'Gateway de pagamento indisponível.' });
  }
};
