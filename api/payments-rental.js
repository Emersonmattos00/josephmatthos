// payments-rental.js
const { getAuthUser, sendJson, supabaseAdminRequest } = require('./_supabase');

// ─────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────
const MP_API_URL = 'https://api.mercadopago.com/checkout/preferences';
const FETCH_TIMEOUT = 10000; // 10s
const RENTAL_DURATION_HOURS = 48;

// Preços configurados no servidor (⚠️ idealmente vir do banco)
const TRACK_PRICES = {
  // 'albumId:trackIndex': preço em BRL
  // Exemplo — substituir por consulta ao banco
};

// Rate limiting (⚠️ em memória — troque por Redis/KV em produção)
const attempts = new Map();
const ATTEMPT_WINDOW_MS = 60 * 60 * 1000; // 1h
const MAX_ATTEMPTS = 10;

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

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

// ─────────────────────────────────────────────────────────────
// Validação da faixa no banco
// ─────────────────────────────────────────────────────────────
async function getTrackFromDB(albumId, trackIndex) {
  // ⚠️ Ajustar para a estrutura real do banco
  const result = await supabaseAdminRequest(
    `/rest/v1/tracks?album_id=eq.${encodeURIComponent(albumId)}&track_index=eq.${trackIndex}&select=id,title,price_cents,album_id,track_index`,
    { method: 'GET' }
  );

  if (!result.response.ok || !Array.isArray(result.body) || !result.body[0]) {
    return null;
  }
  return result.body[0];
}

async function hasActiveRental(userId, trackId) {
  const now = new Date().toISOString();
  const result = await supabaseAdminRequest(
    `/rest/v1/rentals?user_id=eq.${encodeURIComponent(userId)}&track_id=eq.${encodeURIComponent(trackId)}&expires_at=gt.${encodeURIComponent(now)}&select=id`,
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
    console.error('[payments-rental] Mercado Pago não configurado.');
    return sendJson(res, 503, { ok: false, error: 'Pagamento ainda não configurado.' });
  }

  // Autenticação
  let user;
  try {
    user = await getAuthUser(req);
  } catch (error) {
    console.error('[payments-rental] Erro em getAuthUser:', error.code || error.message);
    return sendJson(res, 502, { ok: false, error: 'Autenticação indisponível.' });
  }
  if (!user || !user.id) {
    return sendJson(res, 401, { ok: false, error: 'Faça login para continuar.' });
  }

  // Rate limiting por usuário
  const rateStatus = getRateLimitStatus(user.id);
  if (rateStatus.limited) {
    res.setHeader('Retry-After', String(rateStatus.retryAfter));
    console.warn('[payments-rental] Rate limit atingido:', { userId: user.id });
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

  // ⚠️ Cliente envia APENAS albumId e trackIndex
  const albumId =
    typeof body.albumId === 'string' ? body.albumId.trim().slice(0, 64) : '';
  const trackIndex = Number(body.trackIndex);

  if (!albumId || !Number.isInteger(trackIndex) || trackIndex < 0) {
    return sendJson(res, 400, { ok: false, error: 'Faixa inválida.' });
  }

  // 🔒 Buscar faixa no BANCO (não confiar no cliente)
  let track;
  try {
    track = await getTrackFromDB(albumId, trackIndex);
  } catch (error) {
    console.error('[payments-rental] Erro ao buscar faixa:', error.message);
    return sendJson(res, 502, { ok: false, error: 'Serviço indisponível.' });
  }

  if (!track) {
    return sendJson(res, 404, { ok: false, error: 'Faixa não encontrada.' });
  }

  // 🔒 Verificar se usuário já tem aluguel ativo (evitar duplicata)
  try {
    const alreadyRented = await hasActiveRental(user.id, track.id);
    if (alreadyRented) {
      return sendJson(res, 409, {
        ok: false,
        error: 'Você já possui acesso a esta faixa.'
      });
    }
  } catch (error) {
    console.warn('[payments-rental] Erro ao verificar aluguel:', error.message);
    // Não bloqueia — segue com a criação da preferência
  }

  // 🔒 Preço vem do BANCO
  const amount = track.price_cents / 100;
  if (!Number.isFinite(amount) || amount <= 0) {
    console.error('[payments-rental] Preço inválido para faixa:', track.id);
    return sendJson(res, 500, { ok: false, error: 'Preço indisponível.' });
  }

  // Registrar tentativa (após validações)
  registerAttempt(user.id);

  // Criar preferência no Mercado Pago
  try {
    const response = await fetchWithTimeout(MP_API_URL, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        items: [
          {
            id: `${albumId}:${trackIndex}`,
            title: `Aluguel 48h: ${track.title}`.slice(0, 256),
            quantity: 1,
            currency_id: 'BRL',
            unit_price: amount
          }
        ],
        payer: { email: user.email },
        external_reference: JSON.stringify({
          type: 'rental',
          userId: user.id,
          trackId: track.id,
          albumId,
          trackIndex,
          durationHours: RENTAL_DURATION_HOURS
        }),
        back_urls: {
          success: backUrl,
          failure: backUrl,
          pending: backUrl
        },
        auto_return: 'approved',
        notification_url: process.env.MP_WEBHOOK_URL || undefined
      })
    });

    const result = await response.json();

    if (!response.ok || !result.init_point) {
      console.error('[payments-rental] Erro do Mercado Pago:', {
        status: response.status,
        error: result.message || result.error
      });
      return sendJson(res, 502, {
        ok: false,
        error: 'Não foi possível iniciar o pagamento.'
      });
    }

    console.info('[payments-rental] Preferência criada:', {
      userId: user.id,
      trackId: track.id,
      amount,
      preferenceId: result.id
    });

    return sendJson(res, 200, {
      ok: true,
      checkoutUrl: result.init_point,
      preferenceId: result.id
    });
  } catch (error) {
    console.error('[payments-rental] Erro:', error.code || error.message);

    if (error.code === 'TIMEOUT') {
      return sendJson(res, 504, { ok: false, error: 'Tempo esgotado. Tente novamente.' });
    }
    return sendJson(res, 502, { ok: false, error: 'Gateway de pagamento indisponível.' });
  }
};
