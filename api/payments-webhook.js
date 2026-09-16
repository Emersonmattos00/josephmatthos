// payments-webhook.js
const crypto = require('crypto');
const { sendJson, supabaseAdminRequest } = require('./_supabase');

const FETCH_TIMEOUT = 10000;
const MP_API_URL = 'https://api.mercadopago.com';

// ─────────────────────────────────────────────────────────────
// Validação de assinatura do Mercado Pago
// ─────────────────────────────────────────────────────────────
function validateMPSignature(req) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[payments-webhook] MP_WEBHOOK_SECRET ausente.');
    return false;
  }

  const signature = req.headers['x-signature'];
  const requestId = req.headers['x-request-id'];
  const dataId = req.query && typeof req.query['data.id'] === 'string'
    ? req.query['data.id']
    : '';

  if (!signature || !requestId || !dataId) {
    console.warn('[payments-webhook] Headers de assinatura ausentes.');
    return false;
  }

  // Formato: ts=...,v1=...
  const parts = String(signature).split(',');
  const tsPart = parts.find((p) => p.startsWith('ts='));
  const v1Part = parts.find((p) => p.startsWith('v1='));
  if (!tsPart || !v1Part) return false;

  const ts = tsPart.slice(3);
  const v1 = v1Part.slice(3);

  // Monta o manifest conforme documentação do MP
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(manifest)
    .digest('hex');

  const expectedBuf = Buffer.from(expected, 'hex');
  const providedBuf = Buffer.from(v1, 'hex');

  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timeout));
}

function parseExternalReference(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && typeof parsed.userId === 'string') {
      return parsed;
    }
  } catch {
    // Fallback: assume que é o userId diretamente (formato antigo)
    if (typeof raw === 'string' && raw.length < 64) {
      return { userId: raw, plan: null };
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  // Headers defensivos
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Allow', 'POST');

  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'Método não permitido.' });
  }

  // 1) Validar assinatura do Mercado Pago
  if (!validateMPSignature(req)) {
    console.warn('[payments-webhook] Assinatura inválida.');
    return sendJson(res, 401, { ok: false, error: 'Assinatura inválida.' });
  }

  // 2) Extrair dados do body
  const body = req.body || {};
  const type = String(body.type || body.action || '').slice(0, 64);
  const rawId =
    (body.data && typeof body.data.id === 'string' && body.data.id) ||
    (typeof body.id === 'string' && body.id) ||
    (req.query && typeof req.query.id === 'string' && req.query.id) ||
    '';
  const subscriptionId = rawId.slice(0, 64);

  // 3) Ignorar tipos não relacionados a assinaturas
  if (
    !subscriptionId ||
    (type &&
      !type.includes('subscription') &&
      !type.includes('preapproval'))
  ) {
    return sendJson(res, 200, { ok: true, ignored: true });
  }

  // 4) Verificar configuração
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) {
    console.error('[payments-webhook] MP_ACCESS_TOKEN ausente.');
    return sendJson(res, 503, { ok: false, error: 'Pagamento não configurado.' });
  }

  // 5) Consultar assinatura no Mercado Pago
  let subscription;
  try {
    const response = await fetchWithTimeout(
      `${MP_API_URL}/preapproval/${encodeURIComponent(subscriptionId)}`,
      { headers: { Authorization: 'Bearer ' + token } }
    );
    subscription = await response.json();

    if (!response.ok) {
      console.error('[payments-webhook] Erro do MP:', {
        status: response.status,
        subscriptionId
      });
      // Retorna 200 para não reagendar (pode ser assinatura deletada)
      return sendJson(res, 200, { ok: true, ignored: true });
    }
  } catch (error) {
    console.error('[payments-webhook] Erro ao consultar MP:', error.code || error.message);
    // Retorna 5xx para o MP reagendar
    return sendJson(res, 502, { ok: false, error: 'Gateway indisponível.' });
  }

  // 6) Extrair userId do external_reference
  const ref = parseExternalReference(subscription.external_reference);
  if (!ref || !ref.userId) {
    console.warn('[payments-webhook] external_reference inválido:', {
      subscriptionId,
      external_reference: subscription.external_reference
    });
    return sendJson(res, 200, { ok: true, ignored: true });
  }

  // 7) Determinar plano
  const active =
    subscription.status === 'authorized' ||
    subscription.status === 'approved';

  // 🔒 Preferir o plano do external_reference; fallback para o reason
  let plan = 'free';
  if (active) {
    if (ref.plan === 'anual' || ref.plan === 'premium') {
      plan = ref.plan;
    } else {
      // Fallback (menos confiável)
      const annual = /anual/i.test(subscription.reason || '');
      plan = annual ? 'anual' : 'premium';
    }
  }

  // 8) Atualizar perfil no banco
  try {
    const update = await supabaseAdminRequest(
      `/rest/v1/profiles?id=eq.${encodeURIComponent(ref.userId)}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          plan,
          subscription_id: String(subscription.id),
          subscription_status: subscription.status,
          updated_at: new Date().toISOString()
        })
      }
    );

    if (!update.response.ok) {
      console.error('[payments-webhook] Erro ao atualizar perfil:', {
        userId: ref.userId,
        status: update.response.status
      });
      // Retorna 5xx para o MP reagendar
      return sendJson(res, 502, { ok: false, error: 'Não foi possível atualizar a assinatura.' });
    }

    console.info('[payments-webhook] Assinatura atualizada:', {
      userId: ref.userId,
      subscriptionId: subscription.id,
      status: subscription.status,
      plan
    });

    return sendJson(res, 200, { ok: true });
  } catch (error) {
    console.error('[payments-webhook] Erro:', error.code || error.message);
    return sendJson(res, 502, { ok: false, error: 'Webhook indisponível.' });
  }
};
