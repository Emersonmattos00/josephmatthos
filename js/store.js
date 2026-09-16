/* ============================================================
   STORE.JS — Persistência em localStorage + loja
   ------------------------------------------------------------
   Versão Melhorada:
   - Module Pattern (sem poluição global)
   - Tratamento robusto de erros e quota
   - Validação de integridade dos dados
   - Sistema de migração versionado
   - Logging controlado por ambiente
   - Proteção contra corrupção de dados
   - API pública limpa e tipada
   ============================================================ */

'use strict';

const Store = (() => {
  // ========================================
  // CONSTANTES
  // ========================================
  const STORAGE_KEYS = {
    CONTENT: 'jm_content',
    USERS: 'jm_users',
    SESSION: 'jm_session',
    ADMIN: 'jm_admin',
    ADMIN_SESSION: 'jm_admin_session',
    VOLUME: 'jm_volume',
    CART: 'jm_cart',
    PURCHASES: 'jm_purchases',
    DEBUG: 'jm_debug'
  };

  const CURRENT_SCHEMA_VERSION = 5;
  const MAX_STORAGE_SIZE = 5 * 1024 * 1024; // 5MB
  const STORAGE_WARNING_THRESHOLD = 0.9; // 90%

  // ========================================
  // ESTADO INTERNO
  // ========================================
  let content = null;
  let isDebugMode = false;
  let appMode = 'demo';

  function setAppMode(mode) {
    const nextMode = (typeof mode === 'string' && mode.trim()) ? mode.trim().toLowerCase() : 'demo';
    appMode = nextMode;
    if (typeof window !== 'undefined') {
      window.APP_MODE = nextMode;
    }
    log(`Modo de app definido: ${nextMode}`);
    return nextMode;
  }

  function getAppMode() {
    return appMode;
  }

  function isProductionMode() {
    return getAppMode() === 'production';
  }

  function normalizeContent(rawContent) {
    const fallback = getDefaultContent();
    if (!rawContent || typeof rawContent !== 'object') {
      return fallback;
    }
    return deepMerge(fallback, rawContent);
  }

  function updateContent(mutator) {
    const current = normalizeContent(getContent());
    const nextValue = typeof mutator === 'function' ? mutator(current) : mutator;
    const safeValue = normalizeContent(nextValue);
    setContent(safeValue);
    saveContent();
    return safeValue;
  }

  // ========================================
  // UTILITÁRIOS DE STORAGE
  // ========================================
  
  /**
   * Verifica se localStorage está disponível
   */
  function isStorageAvailable() {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Verifica quota disponível no localStorage
   */
  function checkStorageQuota() {
    try {
      let total = 0;
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          total += localStorage[key].length + key.length;
        }
      }
      const usedPercent = total / MAX_STORAGE_SIZE;
      
      if (usedPercent > STORAGE_WARNING_THRESHOLD) {
        console.warn(`⚠️ Armazenamento quase cheio: ${(usedPercent * 100).toFixed(1)}%`);
        return { available: false, usedPercent };
      }
      
      return { available: true, usedPercent };
    } catch (e) {
      return { available: true, usedPercent: 0 };
    }
  }

  /**
   * Lê dados do localStorage com tratamento de erros
   */
  function readStorage(key, defaultValue = null) {
    if (!isStorageAvailable()) {
      log('Storage não disponível, usando valor padrão');
      return defaultValue;
    }

    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return defaultValue;
      
      const parsed = JSON.parse(raw);
      
      // Validação básica de integridade
      if (parsed === null || parsed === undefined) {
        log(`Dados corrompidos em ${key}, usando padrão`);
        return defaultValue;
      }
      
      return parsed;
    } catch (error) {
      logError(`Erro ao ler ${key}:`, error);
      return defaultValue;
    }
  }

  /**
   * Escreve dados no localStorage com verificação de quota
   */
  function writeStorage(key, value) {
    if (!isStorageAvailable()) {
      logError('Storage não disponível');
      return false;
    }

    try {
      const serialized = JSON.stringify(value);
      
      // Verifica quota antes de escrever
      const quota = checkStorageQuota();
      if (!quota.available) {
        const error = new Error('Armazenamento cheio');
        logError('Quota excedida:', error);
        
        if (typeof toast === 'function') {
          toast('Armazenamento do navegador cheio. Limpe dados antigos.', '⚠');
        }
        
        return false;
      }
      
      localStorage.setItem(key, serialized);
      return true;
    } catch (error) {
      logError(`Erro ao escrever ${key}:`, error);
      
      if (error.name === 'QuotaExceededError' || error.code === 22) {
        if (typeof toast === 'function') {
          toast('Armazenamento cheio. Não foi possível salvar.', '⚠');
        }
      } else {
        if (typeof toast === 'function') {
          toast('Erro ao salvar dados.', '⚠');
        }
      }
      
      return false;
    }
  }

  /**
   * Remove dados do localStorage
   */
  function removeStorage(key) {
    if (!isStorageAvailable()) return false;
    
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      logError(`Erro ao remover ${key}:`, error);
      return false;
    }
  }

  // ========================================
  // LOGGING
  // ========================================
  
  function initDebugMode() {
    isDebugMode = readStorage(STORAGE_KEYS.DEBUG, false) === '1';
  }

  function log(...args) {
    if (isDebugMode) {
      console.log('[STORE]', ...args);
    }
  }

  function logError(...args) {
    console.error('[STORE ERROR]', ...args);
  }

  function setDebugMode(enabled) {
    isDebugMode = enabled;
    writeStorage(STORAGE_KEYS.DEBUG, enabled ? '1' : '0');
  }

  // ========================================
  // CONTENT MANAGEMENT
  // ========================================
  
  /**
   * Carrega conteúdo do storage ou usa padrão
   */
  function loadContent() {
    try {
      const stored = readStorage(STORAGE_KEYS.CONTENT);
      
      if (!stored) {
        log('Nenhum conteúdo salvo, usando padrão');
        return getDefaultContent();
      }
      
      // Valida schema version
      const storedVersion = stored._metadata?.version || 0;
      
      if (storedVersion < CURRENT_SCHEMA_VERSION) {
        log(`Migrando conteúdo da v${storedVersion} para v${CURRENT_SCHEMA_VERSION}`);
        const migrated = migrateContent(stored, storedVersion);
        return normalizeContent(migrated);
      }
      
      // Merge com padrão para garantir campos novos
      const merged = normalizeContent(stored);
      
      // Validação de integridade
      if (typeof validateContent === 'function') {
        const validation = validateContent(merged);
        if (!validation.valid) {
          logError('Conteúdo inválido:', validation.errors);
          // Continua mesmo assim, mas loga
        }
      }
      
      return merged;
    } catch (error) {
      logError('Erro ao carregar conteúdo:', error);
      return getDefaultContent();
    }
  }

  /**
   * Salva conteúdo no storage
   */
  function saveContent() {
    if (!content) {
      logError('Tentativa de salvar conteúdo nulo');
      return false;
    }

    const normalizedContent = normalizeContent(content);

    // Atualiza metadata
    if (!normalizedContent._metadata) {
      normalizedContent._metadata = {};
    }
    normalizedContent._metadata.version = CURRENT_SCHEMA_VERSION;
    normalizedContent._metadata.updatedAt = new Date().toISOString();

    const success = writeStorage(STORAGE_KEYS.CONTENT, normalizedContent);
    
    if (success) {
      content = normalizedContent;
      log('Conteúdo salvo com sucesso');
    }
    
    return success;
  }

  /**
   * Define novo conteúdo
   */
  function setContent(newContent) {
    const safeContent = normalizeContent(newContent);
    if (!safeContent || typeof safeContent !== 'object') {
      logError('Conteúdo inválido');
      return false;
    }
    
    content = safeContent;
    if (typeof window !== 'undefined') {
      window.CONTENT = content; // Compatibilidade
    }
    return true;
  }

  /**
   * Obtém conteúdo atual
   */
  function getContent() {
    if (!content) {
      content = loadContent();
      if (typeof window !== 'undefined') {
        window.CONTENT = content;
      }
    }
    return content;
  }

  /**
   * Obtém conteúdo padrão
   */
  function getDefaultContent() {
    if (typeof DEFAULT_CONTENT === 'undefined') {
      logError('DEFAULT_CONTENT não definido');
      return {};
    }
    return JSON.parse(JSON.stringify(DEFAULT_CONTENT));
  }

  // ========================================
  // MIGRATION
  // ========================================
  
  /**
   * Migra conteúdo de versão antiga para atual
   */
  function migrateContent(oldContent, fromVersion) {
    let migrated = JSON.parse(JSON.stringify(oldContent));
    
    // Migração da v0 para v1
    if (fromVersion < 1) {
      log('Migração v0 → v1');
      
      // Adiciona metadata
      if (!migrated._metadata) {
        migrated._metadata = {
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      }
    }
    
    // Migração da v1 para v2
    if (fromVersion < 2) {
      log('Migração v1 → v2');
      
      // Garante campos em tracks
      if (migrated.discografia?.albums) {
        migrated.discografia.albums.forEach(album => {
          if (!Array.isArray(album.tracks)) {
            album.tracks = [];
          }
          
          album.tracks.forEach(track => {
            if (track.previewStart == null) track.previewStart = 0;
            if (track.previewDuration == null) track.previewDuration = 30;
            if (track.previewAudio == null) track.previewAudio = '';
            if (track.fullAudio == null) track.fullAudio = '';
            if (track.price == null) {
              track.price = migrated.loja?.defaultPrice || 4.90;
            }
            if (track.forSale == null) track.forSale = true;
          });
        });
      }
    }
    
    // Migração da v2 para v3
    if (fromVersion < 3) {
      log('Migração v2 → v3');
      
      // Converte preços de string para número nos planos
      if (migrated.planos?.plans) {
        migrated.planos.plans.forEach(plan => {
          if (typeof plan.price === 'string') {
            plan.priceFormatted = plan.price;
            plan.price = parseFloat(plan.price.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
          }
        });
      }
    }
    
    // Migração da v3 para v4
    if (fromVersion < 4) {
      log('Migração v3 → v4');
      
      // Adiciona campos opcionais
      if (migrated.sobre && !migrated.sobre.stats) {
        migrated.sobre.stats = [];
      }
      
      if (migrated.filosofia?.frases) {
        migrated.filosofia.frases.forEach(frase => {
          if (typeof frase.featured === 'undefined') {
            frase.featured = false;
          }
        });
      }
    }
    
    // Migração da v4 para v5
    if (fromVersion < 5) {
      log('Migração v4 → v5');
      
      // Adiciona configurações de loja
      if (migrated.loja) {
        if (!migrated.loja.paymentMethods) {
          migrated.loja.paymentMethods = ['credit_card', 'pix', 'boleto'];
        }
        if (migrated.loja.taxRate == null) {
          migrated.loja.taxRate = 0;
        }
        if (migrated.loja.showTaxInfo == null) {
          migrated.loja.showTaxInfo = false;
        }
      }
    }
    
    // Atualiza versão
    migrated._metadata = migrated._metadata || {};
    migrated._metadata.version = CURRENT_SCHEMA_VERSION;
    migrated._metadata.updatedAt = new Date().toISOString();
    
    return migrated;
  }

  /**
   * Deep merge inteligente (preserva arrays)
   */
  function deepMerge(target, source) {
    if (!source || typeof source !== 'object') return target;
    if (!target || typeof target !== 'object') return source;
    
    const result = Array.isArray(target) ? [...target] : { ...target };
    
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (
          source[key] &&
          typeof source[key] === 'object' &&
          !Array.isArray(source[key]) &&
          target[key] &&
          typeof target[key] === 'object' &&
          !Array.isArray(target[key])
        ) {
          result[key] = deepMerge(target[key], source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }
    
    return result;
  }

  // ========================================
  // ADMIN CREDENTIALS
  // ========================================
  
  /**
   * Obtém credenciais do admin
   */
  async function getAdminCreds() {
    try {
      const creds = readStorage(STORAGE_KEYS.ADMIN);
      if (creds && creds.user) {
        if (creds.passHash) {
          if (typeof creds.passHash === 'string' && !creds.passHash.startsWith('sha256:') && !creds.passHash.startsWith('h')) {
            const migrated = {
              user: creds.user,
              passHash: typeof hashStr === 'function' ? await hashStr(creds.passHash) : creds.passHash
            };
            writeStorage(STORAGE_KEYS.ADMIN, migrated);
            return migrated;
          }
          return creds;
        }
      }
    } catch (error) {
      logError('Erro ao ler credenciais:', error);
    }
    
    // Cria credenciais padrão
    const defaultCreds = {
      user: 'admin',
      passHash: typeof hashStr === 'function' ? await hashStr('admin123') : 'admin123'
    };
    
    writeStorage(STORAGE_KEYS.ADMIN, defaultCreds);
    return defaultCreds;
  }

  /**
   * Salva credenciais do admin
   */
  async function saveAdminCreds(user, plainPass) {
    if (!user || typeof user !== 'string') {
      logError('Usuário inválido');
      return false;
    }
    
    const current = await getAdminCreds();
    const creds = { user };
    
    if (plainPass) {
      creds.passHash = typeof hashStr === 'function' 
        ? await hashStr(plainPass) 
        : plainPass;
    } else {
      creds.passHash = current.passHash;
    }

    creds.passwordChangedAt = plainPass ? Date.now() : current.passwordChangedAt;
    
    const success = writeStorage(STORAGE_KEYS.ADMIN, creds);
    
    if (success) {
      log('Credenciais do admin salvas');
    }
    
    return success;
  }

  async function isAdminFirstAccess() {
    const creds = await getAdminCreds();
    if (creds.user !== 'admin' || creds.passwordChangedAt) return false;
    const result = typeof verifyPassword === 'function'
      ? await verifyPassword('admin123', creds.passHash)
      : { ok: false };
    return result.ok;
  }

  async function resetAdminCreds() {
    const success = writeStorage(STORAGE_KEYS.ADMIN, {
      user: 'admin',
      passHash: typeof hashStr === 'function' ? await hashStr('admin123') : 'admin123'
    });
    return success;
  }

  // ========================================
  // USERS
  // ========================================
  
  function getUsers() {
    return readStorage(STORAGE_KEYS.USERS, []);
  }

  function saveUsers(users) {
    if (!Array.isArray(users)) {
      logError('users deve ser um array');
      return false;
    }
    return writeStorage(STORAGE_KEYS.USERS, users);
  }

  function getSession() {
    if (isProductionMode()) {
      log('Sessão de usuário bloqueada em produção: backend deve gerenciar a sessão.');
      return null;
    }
    return readStorage(STORAGE_KEYS.SESSION, null);
  }

  function setSession(session) {
    if (isProductionMode()) {
      log('Tentativa de gravar sessão em produção bloqueada.');
      return false;
    }
    if (session) {
      return writeStorage(STORAGE_KEYS.SESSION, session);
    } else {
      return removeStorage(STORAGE_KEYS.SESSION);
    }
  }

  function currentUser() {
    if (isProductionMode()) {
      return (typeof window !== 'undefined' && window.PRODUCTION_USER) || null;
    }
    const session = getSession();
    if (!session || !session.userId) return null;
    
    const users = getUsers();
    return users.find(u => u.id === session.userId) || null;
  }

  function isPremium() {
    const user = currentUser();
    return !!(user && (user.plan === 'premium' || user.plan === 'anual'));
  }

  function updateUserPlan(userId, plan) {
    const users = getUsers();
    const index = users.findIndex(u => u.id === userId);
    
    if (index < 0) {
      logError(`Usuário não encontrado: ${userId}`);
      return false;
    }
    
    users[index].plan = plan;
    users[index].planSince = Date.now();
    
    const success = saveUsers(users);
    
    if (success) {
      log(`Plano atualizado para usuário ${userId}: ${plan}`);
    }
    
    return success;
  }

  function toggleUserBan(userId) {
    const users = getUsers();
    const index = users.findIndex(u => u.id === userId);
    
    if (index < 0) {
      logError(`Usuário não encontrado: ${userId}`);
      return false;
    }
    
    users[index].banned = !users[index].banned;
    const success = saveUsers(users);
    
    if (success) {
      log(`Status de ban toggled para usuário ${userId}`);
    }
    
    return success;
  }

  function deleteUser(userId) {
    const users = getUsers();
    const filtered = users.filter(u => u.id !== userId);
    const success = saveUsers(filtered);
    
    if (success) {
      log(`Usuário deletado: ${userId}`);
    }
    
    return success;
  }

  function updateUserPasswordHash(userId, newHash) {
    const users = getUsers();
    const index = users.findIndex(u => u.id === userId);
    
    if (index < 0) {
      logError(`Usuário não encontrado: ${userId}`);
      return false;
    }
    
    users[index].passwordHash = newHash;
    const success = saveUsers(users);
    
    if (success) {
      log(`Hash de senha atualizado para usuário ${userId}`);
    }
    
    return success;
  }

  // ========================================
  // CART
  // ========================================
  
  function getCart() {
    const cart = readStorage(STORAGE_KEYS.CART, []);
    return Array.isArray(cart) ? cart : [];
  }

  function saveCart(cart) {
    if (!Array.isArray(cart)) {
      logError('cart deve ser um array');
      return false;
    }
    
    const success = writeStorage(STORAGE_KEYS.CART, cart);
    
    if (success) {
      log(`Carrinho salvo: ${cart.length} itens`);
      notifyCartChanged();
    }
    
    return success;
  }

  function clearCart() {
    return saveCart([]);
  }

  function addToCart(albumId, trackIndex) {
    if (!albumId && albumId !== 0) {
      logError('albumId inválido');
      return false;
    }
    
    trackIndex = parseInt(trackIndex, 10);
    if (isNaN(trackIndex) || trackIndex < 0) {
      logError('trackIndex inválido');
      return false;
    }
    
    const cart = getCart();
    
    // Verifica se já existe
    const exists = cart.some(item => 
      item.albumId === albumId && Number(item.trackIndex) === trackIndex
    );
    
    if (exists) {
      log('Item já está no carrinho');
      return false;
    }
    
    // Busca dados da faixa
    const content = getContent();
    if (!content?.discografia?.albums) {
      logError('Discografia não disponível');
      return false;
    }
    
    const album = content.discografia.albums.find(a => a.id === albumId);
    if (!album) {
      logError(`Álbum não encontrado: ${albumId}`);
      return false;
    }
    
    const track = album.tracks?.[trackIndex];
    if (!track) {
      logError(`Faixa não encontrada: ${albumId}[${trackIndex}]`);
      return false;
    }
    
    // Calcula preço
    const defaultPrice = content.loja?.defaultPrice || 4.90;
    let price = parseFloat(track.price);
    if (isNaN(price) || price <= 0) {
      price = defaultPrice;
    }
    
    // Adiciona ao carrinho
    cart.push({
      albumId,
      trackIndex,
      title: track.title,
      albumTitle: album.title,
      albumCover: album.coverImage || '',
      albumCoverText: album.cover || '',
      price
    });
    
    const success = saveCart(cart);
    
    if (success) {
      log(`Item adicionado ao carrinho: ${track.title}`);
    }
    
    return success;
  }

  function removeFromCart(albumId, trackIndex) {
    trackIndex = parseInt(trackIndex, 10);
    
    const cart = getCart().filter(item => 
      !(item.albumId === albumId && Number(item.trackIndex) === trackIndex)
    );
    
    const success = saveCart(cart);
    
    if (success) {
      log(`Item removido do carrinho: ${albumId}[${trackIndex}]`);
    }
    
    return cart;
  }

  function isInCart(albumId, trackIndex) {
    trackIndex = parseInt(trackIndex, 10);
    
    return getCart().some(item => 
      item.albumId === albumId && Number(item.trackIndex) === trackIndex
    );
  }

  function cartSubtotal() {
    return getCart().reduce((sum, item) => sum + (Number(item.price) || 0), 0);
  }

  function cartDiscount() {
    const content = getContent();
    const config = content?.loja || {};
    const itemCount = getCart().length;
    
    if (!config.discountMinItems || itemCount < config.discountMinItems) {
      return 0;
    }
    
    return cartSubtotal() * ((config.discountPercent || 0) / 100);
  }

  function cartTotal() {
    return Math.max(0, cartSubtotal() - cartDiscount());
  }

  function notifyCartChanged() {
    try {
      if (typeof updateCartFab === 'function') {
        updateCartFab();
        log('updateCartFab() chamada');
      } else {
        log('Disparando evento cart:updated');
        window.dispatchEvent(new CustomEvent('cart:updated'));
      }
    } catch (error) {
      logError('Erro ao notificar mudança no carrinho:', error);
    }
  }

  // ========================================
  // PURCHASES
  // ========================================
  
  function getPurchases() {
    return readStorage(STORAGE_KEYS.PURCHASES, {});
  }

  function savePurchases(purchases) {
    if (typeof purchases !== 'object' || purchases === null) {
      logError('purchases deve ser um objeto');
      return false;
    }
    
    return writeStorage(STORAGE_KEYS.PURCHASES, purchases);
  }

  function ownsTrack(albumId, trackIndex) {
    const user = currentUser();
    if (!user) return false;
    
    const purchases = getPurchases();
    const userPurchases = purchases[user.email] || [];
    
    trackIndex = parseInt(trackIndex, 10);
    
    return userPurchases.some(p => 
      p.albumId === albumId && Number(p.trackIndex) === trackIndex
    );
  }

  function registerPurchase(email, items) {
    if (!email || !Array.isArray(items)) {
      logError('Email ou itens inválidos');
      return null;
    }
    
    const purchases = getPurchases();
    
    if (!purchases[email]) {
      purchases[email] = [];
    }
    
    const orderId = typeof generateId === 'function' 
      ? generateId('ord') 
      : `ord_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    
    const now = Date.now();
    
    items.forEach(item => {
      purchases[email].push({
        orderId,
        albumId: item.albumId,
        trackIndex: item.trackIndex,
        title: item.title,
        albumTitle: item.albumTitle,
        price: item.price,
        date: now
      });
    });
    
    const success = savePurchases(purchases);
    
    if (success) {
      log(`Compra registrada: ${orderId} (${items.length} itens)`);
    }
    
    return success ? orderId : null;
  }

  function currentUserPurchases() {
    const user = currentUser();
    if (!user) return [];
    
    const purchases = getPurchases();
    return purchases[user.email] || [];
  }

  // ========================================
  // FORMATAÇÃO
  // ========================================
  
  function formatPrice(value) {
    const content = getContent();
    const symbol = content?.loja?.currencySymbol || 'R$';
    const number = Number(value) || 0;
    
    return `${symbol} ${number.toFixed(2).replace('.', ',')}`;
  }

  // ========================================
  // VOLUME
  // ========================================
  
  function getVolume() {
    const volume = readStorage(STORAGE_KEYS.VOLUME, 0.8);
    const parsed = parseFloat(volume);
    
    if (isNaN(parsed) || parsed < 0 || parsed > 1) {
      return 0.8;
    }
    
    return parsed;
  }

  function setVolume(volume) {
    if (typeof volume !== 'number' || volume < 0 || volume > 1) {
      logError('Volume inválido');
      return false;
    }
    
    return writeStorage(STORAGE_KEYS.VOLUME, volume);
  }

  // ========================================
  // ADMIN SESSION
  // ========================================
  
  function getAdminSession() {
    if (isProductionMode()) {
      log('Sessão de admin bloqueada em produção: backend deve gerenciar a sessão.');
      return null;
    }
    return readStorage(STORAGE_KEYS.ADMIN_SESSION, null);
  }

  function setAdminSession(session) {
    if (isProductionMode()) {
      log('Tentativa de gravar sessão de admin em produção bloqueada.');
      return false;
    }
    if (session) {
      return writeStorage(STORAGE_KEYS.ADMIN_SESSION, session);
    } else {
      return removeStorage(STORAGE_KEYS.ADMIN_SESSION);
    }
  }

  // ========================================
  // UTILITÁRIOS
  // ========================================
  
  /**
   * Limpa todos os dados do storage
   */
  function clearAllData() {
    const keys = Object.values(STORAGE_KEYS);
    let success = true;
    
    keys.forEach(key => {
      if (!removeStorage(key)) {
        success = false;
      }
    });
    
    if (success) {
      log('Todos os dados foram limpos');
    }
    
    return success;
  }

  /**
   * Exporta todos os dados
   */
  function exportAllData() {
    const data = {};
    
    Object.entries(STORAGE_KEYS).forEach(([name, key]) => {
      const value = readStorage(key);
      if (value !== null) {
        data[name.toLowerCase()] = value;
      }
    });
    
    return data;
  }

  /**
   * Obtém estatísticas do storage
   */
  function getStorageStats() {
    let totalSize = 0;
    let itemCount = 0;
    
    Object.values(STORAGE_KEYS).forEach(key => {
      try {
        const value = localStorage.getItem(key);
        if (value) {
          totalSize += value.length + key.length;
          itemCount++;
        }
      } catch (error) {
        // Ignora
      }
    });
    
    return {
      totalSize,
      totalSizeFormatted: formatBytes(totalSize),
      itemCount,
      usedPercent: (totalSize / MAX_STORAGE_SIZE) * 100
    };
  }

  function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
  }

  // ========================================
  // INICIALIZAÇÃO
  // ========================================
  
  function init() {
    try {
      initDebugMode();
      if (typeof window !== 'undefined') {
        setAppMode(window.APP_MODE || appMode);
      }
      log('Store inicializado');
      
      // Carrega conteúdo
      content = loadContent();
      if (typeof window !== 'undefined') {
        window.CONTENT = content;
        window.APP_MODE = appMode;
      }
      
      log(`Conteúdo carregado: v${content?._metadata?.version || 'unknown'}`);
      
      return true;
    } catch (error) {
      logError('Erro na inicialização:', error);
      return false;
    }
  }

  // ========================================
  // API PÚBLICA
  // ========================================
  
  return {
    // Inicialização
    init,
    setAppMode,
    getAppMode,
    isProductionMode,
    
    // Content
    getContent,
    setContent,
    saveContent,
    loadContent,
    getDefaultContent,
    normalizeContent,
    updateContent,
    
    // Admin
    getAdminCreds,
    saveAdminCreds,
    isAdminFirstAccess,
    resetAdminCreds,
    getAdminSession,
    setAdminSession,
    
    // Users
    getUsers,
    saveUsers,
    getSession,
    setSession,
    currentUser,
    isPremium,
    updateUserPlan,
    toggleUserBan,
    deleteUser,
    updateUserPasswordHash,
    
    // Cart
    getCart,
    saveCart,
    clearCart,
    addToCart,
    removeFromCart,
    isInCart,
    cartSubtotal,
    cartDiscount,
    cartTotal,
    
    // Purchases
    getPurchases,
    savePurchases,
    ownsTrack,
    registerPurchase,
    currentUserPurchases,
    
    // Volume
    getVolume,
    setVolume,
    
    // Formatação
    formatPrice,
    
    // Utilitários
    clearAllData,
    exportAllData,
    getStorageStats,
    setDebugMode,
    
    // Constantes
    get STORAGE_KEYS() { return STORAGE_KEYS; },
    get CURRENT_SCHEMA_VERSION() { return CURRENT_SCHEMA_VERSION; }
  };
})();

// ========================================
// EXPOSIÇÃO GLOBAL (Compatibilidade)
// ========================================

// Mantém compatibilidade com código existente
if (typeof window !== 'undefined') {
  window.APP_MODE = Store.getAppMode();
  window.CONTENT = Store.getContent();
}

// Funções globais (legacy)
window.setAppMode = Store.setAppMode;
window.getAppMode = Store.getAppMode;
window.isProductionMode = Store.isProductionMode;
window.getUsers = Store.getUsers;
window.saveUsers = Store.saveUsers;
window.getSession = Store.getSession;
window.setSession = Store.setSession;
window.currentUser = Store.currentUser;
window.isPremium = Store.isPremium;
window.updateUserPlan = Store.updateUserPlan;
window.toggleUserBan = Store.toggleUserBan;
window.deleteUser = Store.deleteUser;
window.updateUserPasswordHash = Store.updateUserPasswordHash;

window.getCart = Store.getCart;
window.saveCart = Store.saveCart;
window.clearCart = Store.clearCart;
window.addToCart = Store.addToCart;
window.removeFromCart = Store.removeFromCart;
window.isInCart = Store.isInCart;
window.cartSubtotal = Store.cartSubtotal;
window.cartDiscount = Store.cartDiscount;
window.cartTotal = Store.cartTotal;

window.getPurchases = Store.getPurchases;
window.savePurchases = Store.savePurchases;
window.ownsTrack = Store.ownsTrack;
window.registerPurchase = Store.registerPurchase;
window.currentUserPurchases = Store.currentUserPurchases;

window.formatPrice = Store.formatPrice;

window.getAdminCreds = Store.getAdminCreds;
window.saveAdminCreds = Store.saveAdminCreds;
window.isAdminFirstAccess = Store.isAdminFirstAccess;
window.resetAdminCreds = Store.resetAdminCreds;

window.getContent = Store.getContent;
window.setContent = Store.setContent;
window.saveContent = Store.saveContent;
window.loadContent = Store.loadContent;

// Constantes
window.CONTENT_KEY = Store.STORAGE_KEYS.CONTENT;
window.USERS_KEY = Store.STORAGE_KEYS.USERS;
window.SESSION_KEY = Store.STORAGE_KEYS.SESSION;
window.ADMIN_KEY = Store.STORAGE_KEYS.ADMIN;
window.ADMIN_SESSION_KEY = Store.STORAGE_KEYS.ADMIN_SESSION;
window.VOLUME_KEY = Store.STORAGE_KEYS.VOLUME;
window.CART_KEY = Store.STORAGE_KEYS.CART;
window.PURCHASES_KEY = Store.STORAGE_KEYS.PURCHASES;
window.SCHEMA_VERSION = Store.CURRENT_SCHEMA_VERSION;

// Inicialização
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', Store.init);
} else {
  Store.init();
}
