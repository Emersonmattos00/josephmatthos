/* ============================================================
   AUDIODB.JS — IndexedDB para músicas enviadas pelo admin
   ------------------------------------------------------------
   Armazena Blobs de áudio localmente no navegador.
   As faixas referenciam os arquivos com o esquema: idb://<id>
   ============================================================ */

const AUDIO_DB_NAME = 'jm_audio_db';
const AUDIO_DB_STORE = 'tracks';
// ⚠️ Incrementar se mudar a estrutura do objectStore
const AUDIO_DB_VERSION = 1;

/* ------------------------------------------------------------
   ABRIR CONEXÃO
   ------------------------------------------------------------ */
function openAudioDB() {
  return new Promise(function (resolve, reject) {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB não suportado'));
      return;
    }
    var req = indexedDB.open(AUDIO_DB_NAME, AUDIO_DB_VERSION);
    req.onupgradeneeded = function (e) {
      var db = e.target.result;
      if (!db.objectStoreNames.contains(AUDIO_DB_STORE)) {
        db.createObjectStore(AUDIO_DB_STORE);
      }
    };
    req.onsuccess = function () { resolve(req.result); };
    req.onerror = function () { reject(req.error); };
    req.onblocked = function () { reject(new Error('IndexedDB bloqueado')); };
  });
}

/* ------------------------------------------------------------
   CRUD
   ------------------------------------------------------------ */
async function saveAudioRecord(id, record) {
  var db = await openAudioDB();
  return new Promise(function (resolve, reject) {
    var tx = db.transaction(AUDIO_DB_STORE, 'readwrite');
    tx.objectStore(AUDIO_DB_STORE).put(record, id);
    tx.oncomplete = function () { db.close(); resolve(true); };
    tx.onerror = function () { db.close(); reject(tx.error); };
    tx.onabort = function () { db.close(); reject(tx.error); };
  });
}

async function getAudioRecord(id) {
  var db = await openAudioDB();
  return new Promise(function (resolve, reject) {
    var tx = db.transaction(AUDIO_DB_STORE, 'readonly');
    var req = tx.objectStore(AUDIO_DB_STORE).get(id);
    req.onsuccess = function () { db.close(); resolve(req.result || null); };
    req.onerror = function () { db.close(); reject(req.error); };
  });
}

async function deleteAudioBlob(id) {
  try {
    var db = await openAudioDB();
    return new Promise(function (resolve) {
      var tx = db.transaction(AUDIO_DB_STORE, 'readwrite');
      tx.objectStore(AUDIO_DB_STORE).delete(id);
      tx.oncomplete = function () { db.close(); resolve(true); };
      tx.onerror = function () { db.close(); resolve(false); };
    });
  } catch (e) {
    console.warn('deleteAudioBlob falhou:', e);
    return false;
  }
}

async function deleteAllAudioBlobs() {
  try {
    var db = await openAudioDB();
    return new Promise(function (resolve) {
      var tx = db.transaction(AUDIO_DB_STORE, 'readwrite');
      tx.objectStore(AUDIO_DB_STORE).clear();
      tx.oncomplete = function () { db.close(); resolve(true); };
      tx.onerror = function () { db.close(); resolve(false); };
    });
  } catch (e) {
    console.warn('deleteAllAudioBlobs falhou:', e);
    return false;
  }
}

/* ------------------------------------------------------------
   HELPERS
   ------------------------------------------------------------ */
function isUploadedAudio(url) {
  return typeof url === 'string' && url.indexOf('idb://') === 0;
}

/* ------------------------------------------------------------
   CACHE DE OBJECT URLs COM LIMITE LRU
   ------------------------------------------------------------
   Cada URL.createObjectURL() reserva memória. Este cache
   limita a 10 URLs simultâneas, revogando as mais antigas.
   ------------------------------------------------------------ */
var _objectUrlCache = {};
var _objectUrlOrder = [];
var MAX_OBJECTURLS = 10;

function _evictOldestObjectUrl() {
  while (_objectUrlOrder.length > MAX_OBJECTURLS) {
    var oldest = _objectUrlOrder.shift();
    if (_objectUrlCache[oldest]) {
      try { URL.revokeObjectURL(_objectUrlCache[oldest]); } catch (e) {}
      delete _objectUrlCache[oldest];
    }
  }
}

/**
 * Converte idb://<id> em URL blob: utilizável pelo <audio>.
 * Retorna '' se o blob não existir ou estiver corrompido.
 */
async function resolveAudioSrc(url) {
  if (!url) return '';
  if (!isUploadedAudio(url)) return url;

  var id = url.slice(6);

  // Cache hit → move para o fim da fila (uso recente)
  if (_objectUrlCache[id]) {
    var idx = _objectUrlOrder.indexOf(id);
    if (idx > -1) _objectUrlOrder.splice(idx, 1);
    _objectUrlOrder.push(id);
    return _objectUrlCache[id];
  }

  // Cache miss → busca no IndexedDB
  var rec = await getAudioRecord(id);
  if (!rec) {
    console.warn('Blob não encontrado no IndexedDB:', id);
    return '';
  }

  // ✅ Guard: valida se é um Blob válido
  var blob = rec.blob || rec;
  if (!(blob instanceof Blob)) {
    console.warn('Registro inválido no IndexedDB:', id, rec);
    return '';
  }

  var objUrl = URL.createObjectURL(blob);
  _objectUrlCache[id] = objUrl;
  _objectUrlOrder.push(id);
  _evictOldestObjectUrl();
  return objUrl;
}

/**
 * Salva arquivo de áudio enviado e retorna a referência idb://.
 * Valida tipo e tamanho antes de gravar.
 */
async function storeAudioFile(file) {
  if (!file) throw new Error('Arquivo ausente');
  if (!isAudioFile(file)) throw new Error('Arquivo não é áudio');
  if (file.size > 80 * 1024 * 1024) throw new Error('Arquivo maior que 80MB');

  var id = generateId('aud');
  await saveAudioRecord(id, {
    blob: file,
    name: file.name,
    mime: file.type || '',
    size: file.size
  });
  return 'idb://' + id;
}

/* ------------------------------------------------------------
   LIMPEZA AO SAIR DA PÁGINA
   ------------------------------------------------------------ */
window.addEventListener('beforeunload', function () {
  Object.keys(_objectUrlCache).forEach(function (k) {
    try { URL.revokeObjectURL(_objectUrlCache[k]); } catch (e) {}
  });
  _objectUrlCache = {};
  _objectUrlOrder = [];
});