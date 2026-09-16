/* ============================================================
   STORE.JS — Persistência em localStorage + loja
   ============================================================ */

const CONTENT_KEY = 'jm_content_v5';
const USERS_KEY = 'jm_users_v2';
const SESSION_KEY = 'jm_session_v2';
const ADMIN_KEY = '';
const ADMIN_SESSION_KEY = 'jm_admin_session_v2';
const VOLUME_KEY = 'jm_volume_v1';
const CART_KEY = 'jm_cart_v1';
const PURCHASES_KEY = 'jm_purchases_v1';
const SCHEMA_VERSION = 5;

// Credenciais padrão — usadas só quando NADA está salvo no localStorage
const DEFAULT_ADMIN_USER = 'admin';
const DEFAULT_ADMIN_PASS = 'admin123';

// Debug opcional: ative com localStorage.setItem('jm_debug', '1')
function _cartDebug() {
  try { return localStorage.getItem('jm_debug') === '1'; } catch (e) { return false; }
}
function _cartLog() {
  if (_cartDebug()) console.log.apply(console, ['[CART]'].concat(Array.prototype.slice.call(arguments)));
}

// Notifica quem estiver ouvindo (fallback caso updateCartFab não exista)
function _notifyCartChanged() {
  try {
    if (typeof updateCartFab === 'function') {
      updateCartFab();
      _cartLog('updateCartFab() chamada com sucesso');
    } else {
      _cartLog('updateCartFab ainda não definida — disparando evento cart:updated');
      window.dispatchEvent(new CustomEvent('cart:updated'));
    }
  } catch (e) {
    console.warn('[CART] Erro ao notificar mudança:', e);
  }
}

let CONTENT = loadContent();
window.CONTENT = CONTENT;

function setContent(newContent) {
  CONTENT = newContent;
  window.CONTENT = newContent;
}

function loadContent() {
  try {
    var stored = JSON.parse(localStorage.getItem(CONTENT_KEY));
    if (!stored) return JSON.parse(JSON.stringify(DEFAULT_CONTENT));
    var merged = deepMerge(JSON.parse(JSON.stringify(DEFAULT_CONTENT)), stored);

    // 🩹 Migração: garante campos novos em faixas antigas
    if (merged.discografia && Array.isArray(merged.discografia.albums)) {
      merged.discografia.albums.forEach(function (a) {
        if (!Array.isArray(a.tracks)) a.tracks = [];
        a.tracks.forEach(function (t) {
          if (t.previewStart == null) t.previewStart = 0;
          if (t.previewDuration == null) t.previewDuration = 30;
          if (t.previewAudio == null) t.previewAudio = '';
          if (t.fullAudio == null) t.fullAudio = '';
          if (t.price == null) t.price = merged.loja ? merged.loja.defaultPrice : 4.90;
          if (t.forSale == null) t.forSale = true;
        });
      });
    }
    return merged;
  } catch (e) {
    console.error('Erro ao carregar conteúdo, usando padrão:', e);
    return JSON.parse(JSON.stringify(DEFAULT_CONTENT));
  }
}

function saveContent() {
  try {
    localStorage.setItem(CONTENT_KEY, JSON.stringify(CONTENT));
  } catch (e) {
    console.error('Erro ao salvar:', e);
    toast('Erro ao salvar: armazenamento cheio.', '⚠');
  }
}

function deepMerge(target, source) {
  for (var k in source) {
    if (source[k] && typeof source[k] === 'object' && !Array.isArray(source[k])) {
      target[k] = deepMerge(target[k] || {}, source[k]);
    } else {
      target[k] = source[k];
    }
  }
  return target;
}

/* ============================================================
   ADMIN — credenciais (SHA-256 com migração legada)
   ------------------------------------------------------------
   ✅ CORRIGIDO: getAdminCreds() NÃO salva o padrão no localStorage
   automaticamente. Só grava quando o admin troca a senha
   explicitamente via saveAdminCreds().
   ============================================================ */

async function getAdminCreds() {
  // 1) Tenta ler do localStorage
  try {
    var c = JSON.parse(localStorage.getItem(ADMIN_KEY));
    if (c && c.user && c.passHash) {
      return c; // ✅ Admin já configurou credenciais
    }
  } catch (e) {}

  // 2) Não existe → retorna o padrão EM MEMÓRIA (sem salvar)
  return {
    user: DEFAULT_ADMIN_USER,
    passHash: await hashStr(DEFAULT_ADMIN_PASS),
    _isDefault: true
  };
}

async function saveAdminCreds(user, plainPass) {
  var current = await getAdminCreds();
  var creds = { user: user };
  creds.passHash = plainPass ? await hashStr(plainPass) : current.passHash;
  try { localStorage.setItem(ADMIN_KEY, JSON.stringify(creds)); } catch (e) {}
}

/* ============================================================
   USUÁRIOS
   ============================================================ */
function getUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; }
  catch (e) { return []; }
}
function saveUsers(users) {
  try { localStorage.setItem(USERS_KEY, JSON.stringify(users)); } catch (e) {}
}
function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)); }
  catch (e) { return null; }
}
function setSession(s) {
  if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  else localStorage.removeItem(SESSION_KEY);
}
function currentUser() {
  var s = getSession();
  if (!s) return null;
  return getUsers().find(function (u) { return u.id === s.userId; }) || null;
}
function isPremium() {
  var u = currentUser();
  return !!(u && (u.plan === 'premium' || u.plan === 'anual'));
}
function updateUserPlan(userId, plan) {
  var users = getUsers();
  var i = users.findIndex(function (u) { return u.id === userId; });
  if (i < 0) return false;
  users[i].plan = plan;
  users[i].planSince = Date.now();
  saveUsers(users);
  return true;
}
function toggleUserBan(userId) {
  var users = getUsers();
  var i = users.findIndex(function (u) { return u.id === userId; });
  if (i < 0) return;
  users[i].banned = !users[i].banned;
  saveUsers(users);
}
function deleteUser(userId) {
  saveUsers(getUsers().filter(function (u) { return u.id !== userId; }));
}
function updateUserPasswordHash(userId, newHash) {
  var users = getUsers();
  var i = users.findIndex(function (u) { return u.id === userId; });
  if (i < 0) return false;
  users[i].passwordHash = newHash;
  saveUsers(users);
  return true;
}

/* ============================================================
   LOJA — carrinho
   ============================================================ */
function getCart() {
  try {
    var raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    var parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('[CART] Erro ao ler carrinho:', e);
    return [];
  }
}

function saveCart(cart) {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cart || []));
    _cartLog('saveCart OK, itens:', (cart || []).length);
  } catch (e) {
    console.error('[CART] Erro ao gravar carrinho:', e);
    toast('Erro ao salvar o carrinho.', '⚠');
  }
  _notifyCartChanged();
}

function clearCart() {
  saveCart([]);
}

function addToCart(albumId, trackIndex) {
  _cartLog('addToCart chamado:', albumId, trackIndex);

  if (albumId == null) { _cartLog('albumId inválido'); return false; }
  trackIndex = parseInt(trackIndex, 10);
  if (isNaN(trackIndex) || trackIndex < 0) { _cartLog('trackIndex inválido'); return false; }

  var cart = getCart();
  var exists = cart.some(function (i) {
    return i.albumId === albumId && Number(i.trackIndex) === trackIndex;
  });
  if (exists) { _cartLog('já está no carrinho'); return false; }

  if (!CONTENT || !CONTENT.discografia || !Array.isArray(CONTENT.discografia.albums)) {
    _cartLog('CONTENT.discografia.albums não disponível');
    return false;
  }

  var album = CONTENT.discografia.albums.find(function (a) { return a.id === albumId; });
  if (!album) { _cartLog('álbum não encontrado:', albumId); return false; }

  var track = album.tracks && album.tracks[trackIndex];
  if (!track) { _cartLog('faixa não encontrada no índice:', trackIndex); return false; }

  var defaultPrice = (CONTENT.loja && CONTENT.loja.defaultPrice) || 4.90;
  var price = parseFloat(track.price);
  if (isNaN(price) || price <= 0) price = defaultPrice;

  cart.push({
    albumId: albumId,
    trackIndex: trackIndex,
    title: track.title,
    albumTitle: album.title,
    albumCover: album.coverImage || '',
    albumCoverText: album.cover || '',
    price: price
  });

  saveCart(cart);
  _cartLog('adicionado com sucesso. total itens:', cart.length);
  return true;
}

function removeFromCart(albumId, trackIndex) {
  trackIndex = parseInt(trackIndex, 10);
  var cart = getCart().filter(function (i) {
    return !(i.albumId === albumId && Number(i.trackIndex) === trackIndex);
  });
  saveCart(cart);
  return cart;
}

function isInCart(albumId, trackIndex) {
  trackIndex = parseInt(trackIndex, 10);
  return getCart().some(function (i) {
    return i.albumId === albumId && Number(i.trackIndex) === trackIndex;
  });
}

function cartSubtotal() {
  return getCart().reduce(function (s, i) { return s + (Number(i.price) || 0); }, 0);
}

function cartDiscount() {
  var cfg = CONTENT.loja || {};
  var n = getCart().length;
  if (!cfg.discountMinItems || n < cfg.discountMinItems) return 0;
  return cartSubtotal() * ((cfg.discountPercent || 0) / 100);
}

function cartTotal() {
  return Math.max(0, cartSubtotal() - cartDiscount());
}

/* ============================================================
   LOJA — compras
   ============================================================ */
function getPurchases() {
  try { return JSON.parse(localStorage.getItem(PURCHASES_KEY)) || {}; }
  catch (e) { return {}; }
}
function savePurchases(p) {
  try { localStorage.setItem(PURCHASES_KEY, JSON.stringify(p)); } catch (e) {}
}
function ownsTrack(albumId, trackIndex) {
  var u = currentUser();
  if (!u) return false;
  var all = getPurchases();
  var list = all[u.email] || [];
  trackIndex = parseInt(trackIndex, 10);
  return list.some(function (p) {
    return p.albumId === albumId && Number(p.trackIndex) === trackIndex;
  });
}
function registerPurchase(email, items) {
  var all = getPurchases();
  if (!all[email]) all[email] = [];
  var orderId = generateId('ord');
  var now = Date.now();
  items.forEach(function (item) {
    all[email].push({
      orderId: orderId,
      albumId: item.albumId,
      trackIndex: item.trackIndex,
      title: item.title,
      albumTitle: item.albumTitle,
      price: item.price,
      date: now
    });
  });
  savePurchases(all);
  return orderId;
}
function currentUserPurchases() {
  var u = currentUser();
  if (!u) return [];
  return getPurchases()[u.email] || [];
}

/* ============================================================
   FORMATAÇÃO
   ============================================================ */
function formatPrice(v) {
  var sym = (CONTENT.loja && CONTENT.loja.currencySymbol) || 'R$';
  var n = Number(v) || 0;
  return sym + ' ' + n.toFixed(2).replace('.', ',');
}
