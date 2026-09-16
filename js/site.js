/* ============================================================
   SITE.JS — Versão Corrigida (compatível com onclick inline)
   ============================================================ */

const _imageValidated = new Set();

function applyImageSafe(el, url, cls, onFail) {
  if (!el) return;
  url = safeMediaUrl(url);
  if (!url) { el.classList.remove(cls); el.style.backgroundImage = ''; if (onFail) onFail(); return; }
  if (_imageValidated.has(url)) {
    el.classList.add(cls); el.style.backgroundImage = 'url(' + url + ')'; return;
  }
  var probe = new Image();
  probe.onload = function () {
    _imageValidated.add(url);
    el.classList.add(cls); el.style.backgroundImage = 'url(' + url + ')';
  };
  probe.onerror = function () {
    el.classList.remove(cls); el.style.backgroundImage = '';
    console.warn('Imagem não encontrada:', url);
    if (onFail) onFail();
  };
  probe.src = url;
}

/* ============================================================
   REDES SOCIAIS
   ============================================================ */
function getSocialIconHTML(key) {
  var k = String(key || '').toLowerCase().trim();

  if (k === 'audiomack') {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<circle cx="12" cy="12" r="12" fill="currentColor"/>' +
      '<path d="M6.185 13.703l6.518-3.719-6.518-3.72a.687.687 0 1 1 .703-1.174l6.518 3.719 6.518-3.719a.687.687 0 1 1 .703 1.174l-6.518 3.72 6.518 3.719a.687.687 0 1 1-.703 1.174l-6.518-3.72-6.518 3.72a.687.687 0 1 1-.703-1.174z" fill="#000"/>' +
      '</svg>';
  }

  var map = {
    spotify: 'fab fa-spotify', youtube: 'fab fa-youtube', amazon: 'fab fa-amazon',
    facebook: 'fab fa-facebook-f', tiktok: 'fab fa-tiktok', apple: 'fab fa-apple',
    itunes: 'fab fa-itunes', instagram: 'fab fa-instagram',
    twitter: 'fab fa-x-twitter', x: 'fab fa-x-twitter', deezer: 'fab fa-deezer',
    soundcloud: 'fab fa-soundcloud', bandcamp: 'fab fa-bandcamp',
    whatsapp: 'fab fa-whatsapp', telegram: 'fab fa-telegram',
    linkedin: 'fab fa-linkedin-in', threads: 'fab fa-threads',
    email: 'fas fa-envelope', website: 'fas fa-globe', link: 'fas fa-link'
  };

  var cls = map[k] || 'fas fa-link';
  return '<i class="' + cls + '" aria-hidden="true"></i>';
}

/* ============================================================
   RENDER DO CONTEÚDO
   ============================================================ */
function applyContentToSite() {
  try {
    document.title = CONTENT.branding.metaTitle;
    var metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && CONTENT.branding.metaDesc) metaDesc.setAttribute('content', CONTENT.branding.metaDesc);

    var logoEl = document.getElementById('siteLogo');
    if (logoEl) logoEl.innerHTML = esc(CONTENT.branding.name) + ' <span>' + esc(CONTENT.branding.nameAccent) + '</span>';

    var footerEl = document.getElementById('footerText');
    if (footerEl) footerEl.innerHTML = sanitizeHtml(CONTENT.branding.footer);

    var a = CONTENT.aparencia;
    document.documentElement.style.setProperty('--bg', a.bg);
    document.documentElement.style.setProperty('--accent', a.accent);
    document.documentElement.style.setProperty('--text', a.text);
    document.documentElement.style.setProperty('--accent-dark', a.accentDark);
    document.documentElement.style.setProperty('--border', a.border);
    document.documentElement.style.setProperty('--font-serif', a.fontSerif);
    document.documentElement.style.setProperty('--font-sans', a.fontSans);

    var safeBgImage = safeMediaUrl(CONTENT.branding.bgImage);
    if (safeBgImage) {
      if (_imageValidated.has(safeBgImage)) {
        document.body.style.backgroundImage = 'linear-gradient(rgba(11,10,12,0.85), rgba(11,10,12,0.85)), url(' + safeBgImage + ')';
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundAttachment = 'fixed';
      } else {
        var probe = new Image();
        probe.onload = function () {
          _imageValidated.add(safeBgImage);
          document.body.style.backgroundImage = 'linear-gradient(rgba(11,10,12,0.85), rgba(11,10,12,0.85)), url(' + safeBgImage + ')';
          document.body.style.backgroundSize = 'cover';
          document.body.style.backgroundAttachment = 'fixed';
        };
        probe.onerror = function () { document.body.style.backgroundImage = ''; };
        probe.src = safeBgImage;
      }
    } else { document.body.style.backgroundImage = ''; }

    var heroTitleEl = document.getElementById('heroTitle');
    if (heroTitleEl) heroTitleEl.innerHTML = sanitizeHtml(CONTENT.hero.title);
    var heroSubEl = document.getElementById('heroSub');
    if (heroSubEl) heroSubEl.textContent = CONTENT.hero.subtitle;
    var bp = document.getElementById('heroBtnPrimary');
    if (bp) { bp.textContent = CONTENT.hero.btnPrimaryText; bp.href = CONTENT.hero.btnPrimaryLink; }
    var bs = document.getElementById('heroBtnSecondary');
    if (bs) { bs.textContent = CONTENT.hero.btnSecondaryText; }
    var heroLyricEl = document.getElementById('heroLyric');
    if (heroLyricEl) heroLyricEl.textContent = CONTENT.hero.vinylLyric;

    var vinyl = document.getElementById('heroVinyl');
    if (vinyl) {
      var coverDiv = vinyl.querySelector('.cover-img');
      if (!coverDiv) { coverDiv = document.createElement('div'); coverDiv.className = 'cover-img'; vinyl.prepend(coverDiv); }
      applyImageSafe(coverDiv, CONTENT.hero.vinylImage, 'loaded', function () { vinyl.classList.remove('has-cover'); });
      vinyl.classList.toggle('has-cover', !!CONTENT.hero.vinylImage);
    }

    var sobreTitleEl = document.getElementById('sobreTitle');
    if (sobreTitleEl) sobreTitleEl.innerHTML = sanitizeHtml(CONTENT.sobre.title);
    var sobreSubEl = document.getElementById('sobreSub');
    if (sobreSubEl) sobreSubEl.textContent = CONTENT.sobre.subtitle;
    applyImageSafe(document.getElementById('sobreImg'), CONTENT.sobre.image, 'has-img');
    var sobreTextEl = document.getElementById('sobreText');
    if (sobreTextEl) {
      var paragraphs = String(CONTENT.sobre.paragraphs).split('\n').filter(function (p) { return p.trim(); });
      sobreTextEl.innerHTML = paragraphs.map(function (p) { return '<p>' + sanitizeHtml(p) + '</p>'; }).join('') +
        (CONTENT.sobre.quote ? '<div class="quote">' + esc(CONTENT.sobre.quote) + '</div>' : '');
    }

    var filTitleEl = document.getElementById('filosofiaTitle');
    if (filTitleEl) filTitleEl.innerHTML = sanitizeHtml(CONTENT.filosofia.title);
    var filSubEl = document.getElementById('filosofiaSub');
    if (filSubEl) filSubEl.textContent = CONTENT.filosofia.subtitle;
    var frasesGridEl = document.getElementById('frasesGrid');
    if (frasesGridEl) {
      frasesGridEl.innerHTML = CONTENT.filosofia.frases.map(function (f) {
        return '<div class="frase-card"><p>"' + esc(f.text) + '"</p><span class="author">— ' + esc(f.author) + '</span></div>';
      }).join('');
    }

    var discoTitleEl = document.getElementById('discoTitle');
    if (discoTitleEl) discoTitleEl.innerHTML = sanitizeHtml(CONTENT.discografia.title);
    var discoSubEl = document.getElementById('discoSub');
    if (discoSubEl) discoSubEl.textContent = CONTENT.discografia.subtitle;

    renderDiscography();
    updateCartFab();

    var plansTitleEl = document.getElementById('plansModalTitle');
    var plansSubEl = document.getElementById('plansModalSub');
    if (plansTitleEl) plansTitleEl.innerHTML = sanitizeHtml(CONTENT.planos.title);
    if (plansSubEl) plansSubEl.textContent = CONTENT.planos.subtitle;

    var plansGridEl = document.getElementById('plansGrid');
    if (plansGridEl) {
      plansGridEl.innerHTML = CONTENT.planos.plans.map(function (p) {
        return '<div class="plan-card ' + (p.featured ? 'featured' : '') + '">' +
          (p.badge ? '<div class="plan-badge">' + esc(p.badge) + '</div>' : '') +
          '<div class="plan-name">' + esc(p.name) + '</div>' +
          '<div class="plan-price">' + esc(p.price) + '<small>' + esc(p.suffix) + '</small></div>' +
          '<p class="plan-desc">' + esc(p.desc) + '</p>' +
          '<ul class="plan-features">' +
            p.features.map(function (f) { return '<li class="' + (f.ok ? '' : 'no') + '">' + esc(f.text) + '</li>'; }).join('') +
          '</ul>' +
          '<button class="btn ' + (p.featured ? 'btn-primary' : 'btn-outline') + ' btn-block" ' +
            (p.disabled ? 'disabled style="opacity:0.6;cursor:default;"' : 'data-plan="' + p.id + '"') + '>' +
            esc(p.cta) +
          '</button>' +
        '</div>';
      }).join('');
    }

    var contatoTitleEl = document.getElementById('contatoTitle');
    if (contatoTitleEl) contatoTitleEl.innerHTML = sanitizeHtml(CONTENT.contato.title);
    var contatoSubEl = document.getElementById('contatoSub');
    if (contatoSubEl) contatoSubEl.textContent = CONTENT.contato.subtitle;
    var contatoHeadingEl = document.getElementById('contatoHeading');
    if (contatoHeadingEl) contatoHeadingEl.textContent = CONTENT.contato.heading;
    var contatoDescEl = document.getElementById('contatoDesc');
    if (contatoDescEl) contatoDescEl.textContent = CONTENT.contato.description;

    var socialLinksEl = document.getElementById('socialLinks');
    if (socialLinksEl) {
      socialLinksEl.innerHTML = CONTENT.contato.socials.map(function (s) {
        return '<a href="' + esc(safeExternalUrl(s.url)) + '" target="_blank" rel="noopener noreferrer" ' +
               'class="ad-social-icon ' + esc(s.icon) + '" ' +
               'data-label="' + esc(s.label) + '" ' +
               'aria-label="' + esc(s.label) + '">' +
               getSocialIconHTML(s.icon) +
               '</a>';
      }).join('');
    }

    // Re-bind dos botões de plano (após re-render)
    bindPlanButtons();
  } catch (err) {
    console.error('Erro em applyContentToSite:', err);
  }
}

/* ============================================================
   DISCOGRAFIA
   ============================================================ */
let currentFilter = 'all';
let currentTrackIdentity = null;
var _shopSearch = '';
var _expandedAlbumId = null;

function renderDiscography() {
  var albums = CONTENT.discografia.albums;
  var filtered = currentFilter === 'all' ? albums : albums.filter(function (a) { return a.type === currentFilter; });
  var container = document.getElementById('discographyContainer');
  if (!container) return;
  var premium = isPremium();
  var q = _shopSearch.trim().toLowerCase();

  if (!filtered.length) {
    container.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:2rem;">Nada encontrado neste filtro.</p>';
    return;
  }

  var forceOpen = !!q;
  var html = '';
  var totalVisible = 0;

  filtered.forEach(function (album) {
    var tracks = [];
    album.tracks.forEach(function (track, ti) {
      if (q && track.title.toLowerCase().indexOf(q) === -1 && album.title.toLowerCase().indexOf(q) === -1) return;
      tracks.push({ track: track, trackIndex: ti });
    });

    if (!tracks.length) return;
    totalVisible += tracks.length;

    var isExpanded = forceOpen || _expandedAlbumId === album.id;

    html += '<div class="album-block ' + (isExpanded ? 'expanded' : '') + '" data-album="' + album.id + '">' +
      '<div class="album-header" onclick="toggleAlbum(\'' + esc(album.id) + '\', event)">' +
        '<div class="album-cover" ' + (album.coverImage ? 'style="background-image:url(' + esc(album.coverImage) + ');"' : '') + '>' +
          (album.coverImage ? '' : esc(album.cover)) +
        '</div>' +
        '<div class="album-info">' +
          '<div class="album-title">' + esc(album.title) +
            (premium ? '<span class="album-badge premium">Premium</span>' : '<span class="album-badge">Prévia</span>') +
          '</div>' +
          '<div class="album-meta">' +
            '<span class="gold">' + album.type.toUpperCase() + '</span> · ' + album.year + ' · ' + tracks.length + ' faixa' + (tracks.length > 1 ? 's' : '') +
          '</div>' +
          '<div style="color:var(--text-dim);font-size:0.8rem;margin-top:0.3rem;">' + esc(album.description) + '</div>' +
        '</div>' +
        '<button class="album-toggle" aria-label="Expandir/recolher" onclick="event.stopPropagation(); toggleAlbum(\'' + esc(album.id) + '\', event)">▼</button>' +
      '</div>' +
      '<div class="album-tracks">' +
        '<div class="discography-scroll" data-album="' + esc(album.id) + '">' +
          tracks.map(function (item) {
            return renderDiscographyCard(album, item.track, item.trackIndex);
          }).join('') +
        '</div>' +
      '</div>' +
    '</div>';
  });

  if (!totalVisible) {
    container.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:2rem;">Nenhuma faixa encontrada.</p>';
    return;
  }

  container.innerHTML = html;
  updatePlayingHighlight();
}
window.renderDiscography = renderDiscography;

window.toggleAlbum = function (albumId, event) {
  if (event) event.stopPropagation();
  _expandedAlbumId = (_expandedAlbumId === albumId) ? null : albumId;
  document.querySelectorAll('.album-block').forEach(function (block) {
    var isExpanded = block.dataset.album === _expandedAlbumId;
    block.classList.toggle('expanded', isExpanded);
  });
};

function renderDiscographyCard(album, track, trackIndex) {
  var premium = isPremium();
  var owns = ownsTrack(album.id, trackIndex);
  var inCart = isInCart(album.id, trackIndex);
  var canFull = premium || owns;
  var forSale = track.forSale !== false && (track.price == null || track.price > 0);
  var price = parseFloat(track.price) || parseFloat(CONTENT.loja.defaultPrice) || 4.90;

  var isPlaying = currentTrackIdentity &&
    currentTrackIdentity.albumId === album.id &&
    currentTrackIdentity.trackTitle === track.title;

  var coverStyle = album.coverImage ? 'style="background-image:url(' + esc(album.coverImage) + ')"' : '';
  var coverText = album.coverImage ? '' : esc(album.cover || '♪');

  var btnClass = 'discography-track-btn';
  var btnText = 'Adicionar';
  var btnDisabled = '';
  var btnOnclick = '';

  if (owns) {
    btnClass += ' owned';
    btnText = '✓ Comprada';
    btnDisabled = 'disabled';
  } else if (inCart) {
    btnClass += ' in-cart';
    btnText = 'No carrinho';
    btnDisabled = 'disabled';
  } else if (!forSale) {
    btnClass += ' locked';
    btnText = 'Só Premium';
    btnDisabled = 'disabled';
  } else {
    // ✅ CORREÇÃO: usa data-action + event delegation em vez de apenas onclick
    btnOnclick = 'onclick="event.stopPropagation(); handleShopBuy(\'' + esc(album.id) + '\',' + trackIndex + ')"';
  }

  var priceHTML = '';
  if (owns || premium) {
    priceHTML = '<div class="discography-track-price">✓<small>' + (owns ? 'Você já tem' : 'Premium ativo') + '</small></div>';
  } else if (forSale) {
    priceHTML = '<div class="discography-track-price">' + formatPrice(price) + '<small>pagamento único</small></div>';
  } else {
    priceHTML = '<div class="discography-track-price">🔒<small>exclusivo Premium</small></div>';
  }

  return '<div class="discography-track-card ' + (isPlaying ? 'playing' : '') + '" data-album="' + esc(album.id) + '" data-track="' + esc(track.title) + '">' +
    (owns ? '<span class="discography-owned-badge">✓ Sua</span>' : '') +
    '<div class="discography-track-cover" ' + coverStyle + ' onclick="playFromDiscography(\'' + esc(album.id) + '\',' + trackIndex + ')">' + coverText + '</div>' +
    '<div class="discography-track-body">' +
      '<div class="discography-track-title">' + esc(track.title) + '</div>' +
      '<div class="discography-track-meta">' +
        '<span>' + esc(track.duration || '—') + '</span>' +
        '<span>·</span>' +
        '<span>' + (canFull ? 'Completa' : (track.previewDuration || 30) + 's prévia') + '</span>' +
      '</div>' +
      '<div class="discography-track-footer">' +
        priceHTML +
        '<button class="' + btnClass + '" ' + btnDisabled + ' ' + btnOnclick + ' data-action="add-to-cart" data-album-id="' + esc(album.id) + '" data-track-index="' + trackIndex + '">' + btnText + '</button>' +
      '</div>' +
    '</div>' +
  '</div>';
}
window.renderDiscographyCard = renderDiscographyCard;

function buildFlatPlaylist() {
  var flat = [];
  CONTENT.discografia.albums.forEach(function (album) {
    album.tracks.forEach(function (track, ti) { flat.push({ album: album, track: track, trackIndex: ti }); });
  });
  return flat;
}
function getGlobalIndex(albumId, trackIndex) {
  var count = 0;
  for (var i = 0; i < CONTENT.discografia.albums.length; i++) {
    var album = CONTENT.discografia.albums[i];
    if (album.id === albumId) return count + trackIndex;
    count += album.tracks.length;
  }
  return -1;
}

/* ============================================================
   PLAYER
   ============================================================ */
var audio = document.getElementById('audio');
var flatPlaylist = [];
var currentIndex = -1;
var isSeeking = false;
var lastVolume = 0.8;
var muted = false;
var previewState = { active: false, start: 0, end: 0 };

function refreshFlatPlaylist() { flatPlaylist = buildFlatPlaylist(); }
try {
  var savedVol = localStorage.getItem(VOLUME_KEY);
  if (savedVol !== null) {
    var v = parseFloat(savedVol);
    if (!isNaN(v) && v >= 0 && v <= 1) { lastVolume = v; audio.volume = v; }
  } else { audio.volume = lastVolume; }
} catch (e) {}

function previewCutActive() { return previewState.active && previewState.end !== Infinity; }

function computePlaybackConfig(track, premium) {
  if (premium) return { src: track.fullAudio || track.previewAudio, isPreview: false, start: 0, end: Infinity };
  var dur = Math.max(5, parseInt(track.previewDuration) || 30);
  if (track.previewAudio && String(track.previewAudio).trim()) {
    return { src: track.previewAudio, isPreview: true, start: 0, end: dur };
  }
  if (track.fullAudio) {
    var start = Math.max(0, parseInt(track.previewStart) || 0);
    return { src: track.fullAudio, isPreview: true, start: start, end: start + dur };
  }
  return { src: '', isPreview: true, start: 0, end: 0 };
}

async function playFromDiscography(albumId, trackIndex) {
  var album = CONTENT.discografia.albums.find(function (a) { return a.id === albumId; });
  if (!album) return;
  var track = album.tracks[trackIndex];
  if (!track) return;

  var premium = isPremium();
  var owns = ownsTrack(albumId, trackIndex);
  var canFull = premium || owns;

  currentTrackIdentity = { albumId: albumId, trackTitle: track.title };
  currentIndex = getGlobalIndex(albumId, trackIndex);

  var cfg = computePlaybackConfig(track, canFull);
  if (!cfg.src) { toast('Esta faixa ainda não tem áudio cadastrado.', '⚠'); return; }

  var resolved = await resolveAudioSrc(cfg.src);
  if (!resolved) { toast('Áudio enviado não encontrado neste navegador.', '⚠'); return; }

  previewState = { active: cfg.isPreview, start: cfg.start, end: cfg.end };
  audio.src = resolved;
  audio.load();

  var onLoaded = function () {
    if (previewCutActive()) {
      var maxStart = Math.max(0, (audio.duration || 0) - 1);
      if (previewState.start > maxStart) {
        previewState.start = 0;
        previewState.end = Math.min(Math.max(5, parseInt(track.previewDuration) || 30), audio.duration || 30);
      }
    }
    if (previewCutActive() && previewState.start > 0) {
      try { audio.currentTime = previewState.start; } catch (e) {}
    }
    audio.removeEventListener('loadedmetadata', onLoaded);
  };
  audio.addEventListener('loadedmetadata', onLoaded);

  var nowTitleEl = document.getElementById('nowTitle');
  if (nowTitleEl) nowTitleEl.textContent = track.title;
  var nowArtistEl = document.getElementById('nowArtist');
  if (nowArtistEl) nowArtistEl.textContent = 'Joseph Matthos · ' + album.title + (canFull ? '' : ' (prévia)');
  var previewBadgeEl = document.getElementById('previewBadge');
  if (previewBadgeEl) previewBadgeEl.classList.toggle('visible', !canFull);

  var cover = document.getElementById('playerCover');
  if (cover) {
    if (album.coverImage) { cover.classList.add('has-cover'); cover.style.backgroundImage = 'url(' + album.coverImage + ')'; }
    else { cover.classList.remove('has-cover'); cover.style.backgroundImage = ''; }
  }

  var playPromise = audio.play();
  if (playPromise !== undefined) {
    playPromise.then(function () {
      var playBtnEl = document.getElementById('playBtn');
      if (playBtnEl) playBtnEl.textContent = '⏸';
      if (cover) cover.classList.add('spinning');
      var heroVinylEl = document.getElementById('heroVinyl');
      if (heroVinylEl) heroVinylEl.classList.add('spinning');
      updatePlayingHighlight();
    }).catch(function (err) {
      console.warn('Erro ao tocar:', err);
      toast('Não foi possível tocar agora.', '⚠');
      var playBtnEl = document.getElementById('playBtn');
      if (playBtnEl) playBtnEl.textContent = '▶';
    });
  }
}

async function reloadCurrentTrackForPlan() {
  if (!currentTrackIdentity || !audio.src) return;
  var album = CONTENT.discografia.albums.find(function (a) { return a.id === currentTrackIdentity.albumId; });
  if (!album) return;
  var ti = album.tracks.findIndex(function (t) { return t.title === currentTrackIdentity.trackTitle; });
  if (ti < 0) return;

  var track = album.tracks[ti];
  var canFull = isPremium() || ownsTrack(album.id, ti);
  var newCfg = computePlaybackConfig(track, canFull);

  var resolvedNew = await resolveAudioSrc(newCfg.src);
  var previewBadgeEl = document.getElementById('previewBadge');
  if (!resolvedNew || audio.src === resolvedNew) {
    if (previewBadgeEl) previewBadgeEl.classList.toggle('visible', !canFull);
    return;
  }

  var wasPlaying = !audio.paused;
  var savedTime = audio.currentTime;
  var wasPreview = previewState.active;

  previewState = { active: newCfg.isPreview, start: newCfg.start, end: newCfg.end };

  var newTime = savedTime;
  if (wasPreview && !newCfg.isPreview) { newTime = savedTime; }
  else if (!wasPreview && newCfg.isPreview) {
    newTime = Math.min(savedTime, newCfg.end - 1);
    newTime = Math.max(newTime, newCfg.start);
  }

  audio.src = resolvedNew;
  audio.load();
  var onLoaded = function () {
    try { audio.currentTime = newTime; } catch (e) {}
    if (wasPlaying) audio.play().catch(function () {});
    audio.removeEventListener('loadedmetadata', onLoaded);
  };
  audio.addEventListener('loadedmetadata', onLoaded);
  if (previewBadgeEl) previewBadgeEl.classList.toggle('visible', !canFull);
}

async function downloadTrack(albumId, trackIndex) {
  var owns = ownsTrack(albumId, trackIndex);
  if (!isPremium() && !owns) {
    toast('Compre esta faixa ou assine Premium para baixar.', '🔒');
    openSubscribeModal('premium');
    return;
  }
  var album = CONTENT.discografia.albums.find(function (a) { return a.id === albumId; });
  var track = album && album.tracks[trackIndex];
  if (!track) return;
  var srcUrl = track.fullAudio || track.previewAudio;
  if (!srcUrl) { toast('Esta faixa não tem áudio cadastrado.', '⚠'); return; }
  toast('Preparando download...', '⬇');
  try {
    var blobUrl, ext = 'mp3';
    if (isUploadedAudio(srcUrl)) {
      var rec = await getAudioRecord(srcUrl.slice(6));
      if (!rec) throw new Error('Áudio não encontrado');
      var blob = rec.blob || rec;
      var nameExt = (String(rec.name || '').split('.').pop() || '').toLowerCase();
      ext = AUDIO_EXTS.indexOf(nameExt) > -1 ? nameExt : ((blob.type || '').split('/')[1] || 'mp3').replace('mpeg', 'mp3');
      blobUrl = URL.createObjectURL(blob);
    } else {
      var resp = await fetch(srcUrl, { mode: 'cors' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      var blob2 = await resp.blob();
      var m = srcUrl.match(/\.(mp3|wav|ogg|m4a|flac|aac|opus|webm|wma|aif|aiff)/i);
      ext = m ? m[1].toLowerCase() : 'mp3';
      blobUrl = URL.createObjectURL(blob2);
    }
    var a = document.createElement('a');
    a.href = blobUrl;
    a.download = 'Joseph Matthos - ' + slugify(track.title) + '.' + ext;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(blobUrl); }, 5000);
    toast('Download iniciado.', '✓');
  } catch (err) {
    console.warn('Download falhou:', err);
    var a2 = document.createElement('a');
    a2.href = srcUrl;
    a2.download = 'Joseph Matthos - ' + slugify(track.title) + '.mp3';
    a2.target = '_blank'; a2.rel = 'noopener';
    document.body.appendChild(a2); a2.click(); a2.remove();
    toast('Servidor não permite download direto. Aberto em nova aba.', 'ℹ');
  }
}

var downloadBtnEl = document.getElementById('downloadBtn');
if (downloadBtnEl) {
  downloadBtnEl.addEventListener('click', function () {
    if (!currentTrackIdentity) { toast('Toque uma faixa primeiro.', 'ℹ'); return; }
    var album = CONTENT.discografia.albums.find(function (a) { return a.id === currentTrackIdentity.albumId; });
    if (!album) return;
    var ti = album.tracks.findIndex(function (t) { return t.title === currentTrackIdentity.trackTitle; });
    if (ti >= 0) downloadTrack(album.id, ti);
  });
}
function updatePlayingHighlight() {
  document.querySelectorAll('.discography-track-card').forEach(function (card) {
    var isPlaying = currentTrackIdentity &&
      currentTrackIdentity.albumId === card.dataset.album &&
      currentTrackIdentity.trackTitle === card.dataset.track;
    card.classList.toggle('playing', isPlaying);
  });
}
async function togglePlay() {
  if (!audio.src) {
    var first = CONTENT.discografia.albums.find(function (a) { return a.tracks.length; });
    if (first) await playFromDiscography(first.id, 0);
    return;
  }
  if (audio.paused) {
    if (previewCutActive() && audio.currentTime >= previewState.end - 0.5) audio.currentTime = previewState.start;
    audio.play().catch(function () { toast('Erro ao reproduzir.', '⚠'); });
  } else { audio.pause(); }
}
function nextTrack() {
  refreshFlatPlaylist();
  if (!flatPlaylist.length) return;
  var item = flatPlaylist[(currentIndex + 1) % flatPlaylist.length];
  playFromDiscography(item.album.id, item.trackIndex);
}
function prevTrack() {
  refreshFlatPlaylist();
  if (!flatPlaylist.length) return;
  if (audio.currentTime > 3 && !previewCutActive()) { audio.currentTime = previewState.start || 0; return; }
  var item = flatPlaylist[currentIndex - 1 < 0 ? flatPlaylist.length - 1 : currentIndex - 1];
  playFromDiscography(item.album.id, item.trackIndex);
}
function seekBy(seconds) {
  if (!audio.src || !audio.duration) return;
  var newTime = audio.currentTime + seconds;
  if (previewCutActive()) {
    newTime = Math.min(newTime, previewState.end - 0.1);
    newTime = Math.max(newTime, previewState.start);
  } else { newTime = Math.min(Math.max(newTime, 0), audio.duration); }
  audio.currentTime = newTime;
}

audio.addEventListener('timeupdate', function () {
  if (isSeeking) return;
  if (previewCutActive() && audio.currentTime >= previewState.end) {
    audio.pause();
    audio.currentTime = previewState.end;
    var progressFillEl = document.getElementById('progressFill');
    if (progressFillEl) progressFillEl.style.width = '100%';
    var currentTimeEl = document.getElementById('currentTime');
    if (currentTimeEl) currentTimeEl.textContent = formatTime(previewState.end - previewState.start);
    var progressBarEl = document.getElementById('progressBar');
    if (progressBarEl) progressBarEl.setAttribute('aria-valuenow', 100);
    if (!window._previewToastShown || Date.now() - window._previewToastShown > 8000) {
      toast('Prévia encerrada. Assine ou compre a faixa para ouvir completa.', '🎧');
      window._previewToastShown = Date.now();
    }
    return;
  }
  var pct, shown;
  if (previewCutActive()) {
    var total = previewState.end - previewState.start;
    var cur = Math.max(0, audio.currentTime - previewState.start);
    pct = total > 0 ? Math.min(100, (cur / total) * 100) : 0;
    shown = cur;
  } else {
    pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
    shown = audio.currentTime;
  }
  var progressFillEl2 = document.getElementById('progressFill');
  if (progressFillEl2) progressFillEl2.style.width = pct + '%';
  var currentTimeEl2 = document.getElementById('currentTime');
  if (currentTimeEl2) currentTimeEl2.textContent = formatTime(shown);
  var progressBarEl2 = document.getElementById('progressBar');
  if (progressBarEl2) progressBarEl2.setAttribute('aria-valuenow', Math.round(pct));
});
audio.addEventListener('loadedmetadata', function () {
  var durationEl = document.getElementById('duration');
  if (durationEl) {
    durationEl.textContent = previewCutActive()
      ? formatTime(previewState.end - previewState.start)
      : (isFinite(audio.duration) ? formatTime(audio.duration) : '—');
  }
});
audio.addEventListener('ended', nextTrack);
audio.addEventListener('play', function () {
  var playBtnEl = document.getElementById('playBtn');
  if (playBtnEl) playBtnEl.textContent = '⏸';
  var coverEl = document.getElementById('playerCover');
  if (coverEl) coverEl.classList.add('spinning');
  var heroVinylEl = document.getElementById('heroVinyl');
  if (heroVinylEl) heroVinylEl.classList.add('spinning');
});
audio.addEventListener('pause', function () {
  var playBtnEl = document.getElementById('playBtn');
  if (playBtnEl) playBtnEl.textContent = '▶';
  var coverEl = document.getElementById('playerCover');
  if (coverEl) coverEl.classList.remove('spinning');
  var heroVinylEl = document.getElementById('heroVinyl');
  if (heroVinylEl) heroVinylEl.classList.remove('spinning');
});
audio.addEventListener('error', function () {
  toast('Erro ao carregar a faixa.', '⚠');
  var playBtnEl = document.getElementById('playBtn');
  if (playBtnEl) playBtnEl.textContent = '▶';
  var coverEl = document.getElementById('playerCover');
  if (coverEl) coverEl.classList.remove('spinning');
  var heroVinylEl = document.getElementById('heroVinyl');
  if (heroVinylEl) heroVinylEl.classList.remove('spinning');
});

document.getElementById('playBtn').addEventListener('click', togglePlay);
document.getElementById('nextBtn').addEventListener('click', nextTrack);
document.getElementById('prevBtn').addEventListener('click', prevTrack);

function seek(e) {
  var progressBarEl = document.getElementById('progressBar');
  if (!progressBarEl) return;
  var rect = progressBarEl.getBoundingClientRect();
  var pct = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
  if (!audio.duration) return;
  if (previewCutActive()) {
    var total = previewState.end - previewState.start;
    audio.currentTime = previewState.start + pct * total;
  } else { audio.currentTime = pct * audio.duration; }
  var progressFillEl = document.getElementById('progressFill');
  if (progressFillEl) progressFillEl.style.width = (pct * 100) + '%';
}
document.getElementById('progressBar').addEventListener('mousedown', function (e) {
  isSeeking = true; seek(e);
  var move = function (ev) { seek(ev); };
  var up = function () { isSeeking = false; document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
  document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
});
document.getElementById('progressBar').addEventListener('touchstart', function (e) {
  isSeeking = true;
  seek({ clientX: e.touches[0].clientX });
  var move = function (ev) { seek({ clientX: ev.touches[0].clientX }); };
  var up = function () { isSeeking = false; document.removeEventListener('touchmove', move); document.removeEventListener('touchend', up); };
  document.addEventListener('touchmove', move, { passive: true });
  document.addEventListener('touchend', up);
}, { passive: true });
document.getElementById('progressBar').addEventListener('keydown', function (e) {
  if (!audio.duration) return;
  if (e.key === 'ArrowRight') { e.preventDefault(); seekBy(5); }
  if (e.key === 'ArrowLeft') { e.preventDefault(); seekBy(-5); }
});

function setVolume(v) {
  v = Math.min(Math.max(v, 0), 1);
  audio.volume = v;
  var volumeFillEl = document.getElementById('volumeFill');
  if (volumeFillEl) volumeFillEl.style.width = (v * 100) + '%';
  var muteBtnEl = document.getElementById('muteBtn');
  if (muteBtnEl) muteBtnEl.textContent = v === 0 ? '🔇' : (v < 0.5 ? '🔉' : '🔊');
  var volumeBarEl = document.getElementById('volumeBar');
  if (volumeBarEl) volumeBarEl.setAttribute('aria-valuenow', Math.round(v * 100));
  try { localStorage.setItem(VOLUME_KEY, String(v)); } catch (e) {}
}
setVolume(lastVolume);
document.getElementById('volumeBar').addEventListener('mousedown', function (e) {
  var rect = document.getElementById('volumeBar').getBoundingClientRect();
  setVolume((e.clientX - rect.left) / rect.width);
  var move = function (ev) { setVolume((ev.clientX - rect.left) / rect.width); };
  var up = function () { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
  document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
});
document.getElementById('muteBtn').addEventListener('click', function () {
  if (muted) { setVolume(lastVolume || 0.8); muted = false; }
  else { lastVolume = audio.volume; setVolume(0); muted = true; }
});

/* ============================================================
   MODAIS
   ============================================================ */
var lastFocusedElement = null;
function openModal(id) {
  lastFocusedElement = document.activeElement;
  var modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(function () {
    var first = modal.querySelector('input:not([disabled]), button:not([disabled]), textarea, select');
    if (first) first.focus();
  }, 50);
}
function closeModal(id) {
  var modal = document.getElementById(id);
  if (modal) modal.classList.remove('open');
  document.body.style.overflow = '';
  restoreFocus();
}
function restoreFocus() {
  if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') setTimeout(function () { lastFocusedElement.focus(); }, 50);
}
document.querySelectorAll('[data-close]').forEach(function (el) {
  el.addEventListener('click', function () {
    el.closest('.modal-overlay').classList.remove('open');
    document.body.style.overflow = '';
    restoreFocus();
  });
});
document.querySelectorAll('.modal-overlay').forEach(function (o) {
  o.addEventListener('click', function (e) {
    if (e.target === o) { o.classList.remove('open'); document.body.style.overflow = ''; restoreFocus(); }
  });
});

/* ============================================================
   AUTENTICAÇÃO
   ============================================================ */
document.getElementById('loginBtn').addEventListener('click', function () { openModal('loginModal'); });
document.getElementById('signupBtn').addEventListener('click', function () { openModal('signupModal'); });
document.getElementById('switchToSignup').addEventListener('click', function () { closeModal('loginModal'); openModal('signupModal'); });
document.getElementById('switchToLogin').addEventListener('click', function () { closeModal('signupModal'); openModal('loginModal'); });
document.getElementById('logoutBtn').addEventListener('click', function () {
  if (typeof isProductionMode === 'function' && isProductionMode()) {
    fetch('/api/auth-logout', { method: 'POST', credentials: 'same-origin' }).catch(function () {});
    window.PRODUCTION_USER = null;
  } else {
    setSession(null);
  }
  closeModal('accountModal'); updateAuthUI(); toast('Você saiu da conta.', 'ℹ');
});

document.getElementById('loginForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  if (typeof isProductionMode === 'function' && isProductionMode()) {
    var productionLoginError = document.getElementById('loginError');
    productionLoginError.textContent = 'Validando acesso...';
    try {
      var loginResponse = await fetch('/api/auth-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ email: document.getElementById('loginEmail').value.trim().toLowerCase(), password: document.getElementById('loginPassword').value }) });
      var loginResult = await loginResponse.json();
      if (!loginResponse.ok || !loginResult.ok) { productionLoginError.textContent = loginResult.error || 'E-mail ou senha incorretos.'; return; }
      window.PRODUCTION_USER = loginResult.user;
      productionLoginError.textContent = '';
      closeModal('loginModal'); e.target.reset(); updateAuthUI();
      toast('Bem-vindo, ' + (loginResult.user.name || loginResult.user.email).split(' ')[0] + '!', '✦');
    } catch (error) { productionLoginError.textContent = 'Serviço de autenticação indisponível.'; }
    return;
  }
  var email = document.getElementById('loginEmail').value.trim().toLowerCase();
  var pass = document.getElementById('loginPassword').value;
  var errEl = document.getElementById('loginError');
  var user = getUsers().find(function (u) { return u.email === email; });
  if (!user) { errEl.textContent = 'E-mail não encontrado.'; return; }
  var result = await verifyPassword(pass, user.passwordHash);
  if (!result.ok) { errEl.textContent = 'Senha incorreta.'; return; }
  if (user.banned) { errEl.textContent = 'Esta conta foi suspensa.'; return; }
  if (result.needsMigration) {
    try { updateUserPasswordHash(user.id, await hashStr(pass)); } catch (e) {}
  }
  errEl.textContent = '';
  setSession({ userId: user.id });
  closeModal('loginModal'); e.target.reset();
  updateAuthUI(); reloadCurrentTrackForPlan();
  toast('Bem-vindo, ' + user.name.split(' ')[0] + '!', '✦');
});

document.getElementById('signupForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  if (typeof isProductionMode === 'function' && isProductionMode()) {
    var productionSignupError = document.getElementById('signupError');
    var productionName = document.getElementById('signupName').value.trim();
    var productionEmail = document.getElementById('signupEmail').value.trim().toLowerCase();
    var productionPass = document.getElementById('signupPassword').value;
    if (productionPass.length < 8) { productionSignupError.textContent = 'Senha deve ter pelo menos 8 caracteres.'; return; }
    productionSignupError.textContent = 'Criando conta...';
    try {
      var signupResponse = await fetch('/api/auth-signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ name: productionName, email: productionEmail, password: productionPass }) });
      var signupResult = await signupResponse.json();
      if (!signupResponse.ok || !signupResult.ok) { productionSignupError.textContent = signupResult.error || 'Não foi possível criar a conta.'; return; }
      if (signupResult.requiresEmailConfirmation) { productionSignupError.textContent = 'Verifique seu e-mail para ativar a conta.'; return; }
      window.PRODUCTION_USER = signupResult.user;
      productionSignupError.textContent = '';
      closeModal('signupModal'); e.target.reset(); updateAuthUI();
      toast('Conta criada. Bem-vindo!', '✦');
    } catch (error) { productionSignupError.textContent = 'Serviço de autenticação indisponível.'; }
    return;
  }
  var name = document.getElementById('signupName').value.trim();
  var email = document.getElementById('signupEmail').value.trim().toLowerCase();
  var pass = document.getElementById('signupPassword').value;
  var errEl = document.getElementById('signupError');
  if (pass.length < 6) { errEl.textContent = 'Senha deve ter pelo menos 6 caracteres.'; return; }
  var users = getUsers();
  if (users.find(function (u) { return u.email === email; })) { errEl.textContent = 'E-mail já cadastrado.'; return; }
  var passwordHash = await hashStr(pass);
  var user = { id: generateId('u'), name: name, email: email, passwordHash: passwordHash, plan: 'free', banned: false, createdAt: Date.now() };
  users.push(user);
  saveUsers(users);
  setSession({ userId: user.id });
  closeModal('signupModal'); e.target.reset();
  updateAuthUI();
  toast('Conta criada. Bem-vindo, ' + name.split(' ')[0] + '!', '✦');
});

document.getElementById('userChip').addEventListener('click', openAccountModal);
document.getElementById('userChip').addEventListener('keydown', function (e) {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openAccountModal(); }
});
function openAccountModal() {
  var u = currentUser();
  if (!u) return;
  document.getElementById('accountAvatar').textContent = u.name.charAt(0).toUpperCase();
  document.getElementById('accountName').textContent = u.name;
  document.getElementById('accountEmail').textContent = u.email;
  var planLabel = { free: 'Free', premium: 'Premium Mensal', anual: 'Premium Anual' }[u.plan] || 'Free';
  document.getElementById('accountPlanValue').textContent = planLabel;
  document.getElementById('accountPlanDesc').textContent = u.plan === 'free' ? 'Acesso a prévias + loja de faixas.' : 'Acesso completo + downloads.';
  var actions = document.getElementById('accountActions');
  var html = '';
  if (u.plan === 'free') {
    html += '<button class="btn btn-primary btn-block" id="upgradeBtn">Fazer upgrade para Premium</button>';
  } else {
    html += '<button class="btn btn-outline btn-block" id="cancelPlanBtn">Cancelar assinatura</button>';
  }
  html += '<button class="btn btn-outline btn-block" id="myPurchasesBtn" style="margin-top:0.6rem;">🛒 Minhas compras</button>';
  actions.innerHTML = html;

  if (u.plan === 'free') {
    document.getElementById('upgradeBtn').addEventListener('click', function () { closeModal('accountModal'); openSubscribeModal('premium'); });
  } else {
    document.getElementById('cancelPlanBtn').addEventListener('click', function () {
      if (confirm('Cancelar? Você voltará ao plano Free.')) {
        updateUserPlan(u.id, 'free');
        closeModal('accountModal');
        updateAuthUI(); reloadCurrentTrackForPlan();
        toast('Assinatura cancelada.', 'ℹ');
      }
    });
  }
  document.getElementById('myPurchasesBtn').addEventListener('click', function () {
    closeModal('accountModal');
    renderPurchases();
    openModal('purchasesModal');
  });
  openModal('accountModal');
}

function updateAuthUI() {
  var u = currentUser();
  var chip = document.getElementById('userChip');
  var premium = isPremium();
  if (u) {
    document.getElementById('loginBtn').style.display = 'none';
    document.getElementById('signupBtn').style.display = 'none';
    chip.classList.add('visible');
    document.getElementById('userAvatar').textContent = u.name.charAt(0).toUpperCase();
    document.getElementById('userNameMini').textContent = u.name.split(' ')[0];
    document.getElementById('userPlanMini').textContent = ({ free: 'Free', premium: 'Premium', anual: 'Premium Anual' })[u.plan] || 'Free';
  } else {
    document.getElementById('loginBtn').style.display = '';
    document.getElementById('signupBtn').style.display = '';
    chip.classList.remove('visible');
  }
  var dl = document.getElementById('downloadBtn');
  if (dl) dl.classList.toggle('visible', premium);
  renderDiscography();
}

var planConfig = {};
function refreshPlanConfig() {
  CONTENT.planos.plans.forEach(function (p) { planConfig[p.id] = { name: p.name, desc: p.desc, price: p.price, suffix: p.suffix }; });
}
var selectedPlan = 'premium';
function openSubscribeModal(planId) {
  if (typeof isProductionMode === 'function' && isProductionMode()) {
    toast('Pagamentos reais ainda não estão configurados.', '⚠');
    return;
  }
  if (!currentUser()) { toast('Crie uma conta para assinar.', 'ℹ'); openModal('signupModal'); return; }
  selectedPlan = planId;
  var cfg = planConfig[planId] || { name: planId, desc: '', price: '', suffix: '' };
  document.getElementById('subPlanName').textContent = cfg.name;
  document.getElementById('subPlanDesc').textContent = cfg.desc;
  document.getElementById('subPlanPrice').innerHTML = esc(cfg.price) + '<small>' + esc(cfg.suffix) + '</small>';
  document.getElementById('subscribeError').textContent = '';
  openModal('subscribeModal');
}
document.getElementById('cardNumber').addEventListener('input', function (e) {
  var v = e.target.value.replace(/\D/g, '').slice(0, 16);
  v = v.replace(/(\d{4})(?=\d)/g, '$1 ');
  e.target.value = v;
});
document.getElementById('cardExp').addEventListener('input', function (e) {
  var v = e.target.value.replace(/\D/g, '').slice(0, 4);
  if (v.length >= 3) v = v.slice(0, 2) + '/' + v.slice(2);
  e.target.value = v;
});
document.getElementById('subscribeForm').addEventListener('submit', function (e) {
  e.preventDefault();
  var err = document.getElementById('subscribeError');
  if (typeof isProductionMode === 'function' && isProductionMode()) {
    err.textContent = 'Pagamentos reais ainda não estão configurados neste site.';
    return;
  }
  var num = document.getElementById('cardNumber').value.replace(/\s/g, '');
  if (num.length < 13 || num.length > 19) { err.textContent = 'Número de cartão inválido.'; return; }
  if (!luhnCheck(num)) { err.textContent = 'Número de cartão inválido (falha Luhn).'; return; }
  var exp = document.getElementById('cardExp').value;
  if (!/^\d{2}\/\d{2}$/.test(exp)) { err.textContent = 'Validade inválida. Use MM/AA.'; return; }
  var mm = Number(exp.split('/')[0]), yy = Number(exp.split('/')[1]);
  if (mm < 1 || mm > 12) { err.textContent = 'Mês inválido.'; return; }
  if (new Date(2000 + yy, mm) < new Date()) { err.textContent = 'Cartão vencido.'; return; }
  err.textContent = '';
  var btn = e.target.querySelector('button[type="submit"]');
  var orig = btn.textContent;
  btn.textContent = 'Processando...'; btn.disabled = true;
  setTimeout(function () {
    var u = currentUser();
    if (u) updateUserPlan(u.id, selectedPlan);
    closeModal('subscribeModal');
    e.target.reset();
    updateAuthUI(); reloadCurrentTrackForPlan();
    btn.textContent = orig; btn.disabled = false;
    toast('Assinatura ' + planConfig[selectedPlan].name + ' ativada!', '✦');
  }, 1100);
});

document.getElementById('filterBar').addEventListener('click', function (e) {
  var b = e.target.closest('.filter-btn');
  if (!b) return;
  document.querySelectorAll('.filter-btn').forEach(function (x) { x.classList.remove('active'); x.setAttribute('aria-selected', 'false'); });
  b.classList.add('active'); b.setAttribute('aria-selected', 'true');
  currentFilter = b.dataset.filter;
  renderDiscography();
});

/* ============================================================
   🛒 LOJA — CORREÇÃO CRÍTICA DO CARRINHO
   ============================================================ */

/**
 * Adiciona faixa ao carrinho (chamada via onclick inline)
 */
function handleShopBuy(albumId, trackIndex) {
  console.log('[handleShopBuy] Chamada com:', albumId, trackIndex);
  
  if (ownsTrack(albumId, trackIndex)) {
    toast('Você já comprou esta faixa.', '✓');
    return;
  }
  
  var added = addToCart(albumId, trackIndex);
  console.log('[handleShopBuy] Resultado addToCart:', added);
  
  if (added) {
    toast('Faixa adicionada ao carrinho.', '🛒');
    renderDiscography();
    updateCartFab();
  } else {
    toast('Esta faixa já está no carrinho.', 'ℹ');
  }
}
// ✅ CRÍTICO: expõe globalmente para o onclick inline funcionar
window.handleShopBuy = handleShopBuy;

function updateCartFab() {
  var navBadge = document.getElementById('navCartBadge');
  var navCart = document.getElementById('navCartLink');
  if (!navBadge || !navCart) return;

  var count = getCart().length;
  navBadge.textContent = String(count);
  navBadge.classList.toggle('hidden', count === 0);

  if (count > 0) {
    navCart.classList.remove('pop');
    void navCart.offsetWidth;
    navCart.classList.add('pop');
  }
}
window.updateCartFab = updateCartFab;

function openCartModal() { renderCartItems(); openModal('cartModal'); }

function renderCartItems() {
  var wrap = document.getElementById('cartItems');
  var totals = document.getElementById('cartTotals');
  if (!wrap || !totals) return;
  var cart = getCart();
  if (!cart.length) {
    wrap.innerHTML = '<div class="cart-empty"><p>🛒 Seu carrinho está vazio.</p><p style="font-size:0.85rem;margin-top:0.5rem;">Explore a discografia e adicione faixas.</p></div>';
    totals.style.display = 'none';
    return;
  }
  wrap.innerHTML = cart.map(function (i) {
    var coverStyle = i.albumCover ? 'style="background-image:url(' + esc(i.albumCover) + ')"' : '';
    var coverText = i.albumCover ? '' : esc(i.albumCoverText || '♪');
    return '<div class="cart-item">' +
      '<div class="cart-item-cover" ' + coverStyle + '>' + coverText + '</div>' +
      '<div class="cart-item-info">' +
        '<div class="cart-item-title">' + esc(i.title) + '</div>' +
        '<div class="cart-item-album">' + esc(i.albumTitle) + '</div>' +
      '</div>' +
      '<div class="cart-item-price">' + formatPrice(i.price) + '</div>' +
      '<button class="cart-item-remove" onclick="handleCartRemove(\'' + esc(i.albumId) + '\',' + i.trackIndex + ')" aria-label="Remover">🗑</button>' +
    '</div>';
  }).join('');
  var sub = cartSubtotal(), disc = cartDiscount(), total = cartTotal();
  document.getElementById('cartSubtotal').textContent = formatPrice(sub);
  document.getElementById('cartDiscount').textContent = '- ' + formatPrice(disc);
  document.getElementById('cartTotal').textContent = formatPrice(total);
  totals.style.display = 'block';
}

function handleCartRemove(albumId, trackIndex) {
  removeFromCart(albumId, trackIndex);
  renderCartItems(); renderDiscography(); updateCartFab();
  toast('Faixa removida do carrinho.', '🗑');
}
window.handleCartRemove = handleCartRemove;

function openCheckoutModal() {
  var cart = getCart();
  if (!cart.length) { toast('Adicione faixas ao carrinho primeiro.', 'ℹ'); return; }
  var summary = document.getElementById('checkoutSummary');
  summary.innerHTML = cart.map(function (i) {
    return '<div class="checkout-summary-item"><span>' + esc(i.title) + '</span><strong>' + formatPrice(i.price) + '</strong></div>';
  }).join('') + '<div class="checkout-summary-total"><span>Total</span><span>' + formatPrice(cartTotal()) + '</span></div>';
  document.getElementById('checkoutError').textContent = '';
  openModal('checkoutModal');
}

document.addEventListener('input', function (e) {
  if (e.target.id === 'buyCardNumber') {
    var v = e.target.value.replace(/\D/g, '').slice(0, 16);
    e.target.value = v.replace(/(\d{4})(?=\d)/g, '$1 ');
  }
  if (e.target.id === 'buyCardExp') {
    var v2 = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (v2.length >= 3) v2 = v2.slice(0, 2) + '/' + v2.slice(2);
    e.target.value = v2;
  }
});

document.getElementById('checkoutForm').addEventListener('submit', function (e) {
  e.preventDefault();
  var err = document.getElementById('checkoutError');
  if (typeof isProductionMode === 'function' && isProductionMode()) {
    err.textContent = 'Pagamentos reais ainda não estão configurados neste site.';
    return;
  }
  var name = document.getElementById('buyerName').value.trim();
  var email = document.getElementById('buyerEmail').value.trim().toLowerCase();
  var cardNum = document.getElementById('buyCardNumber').value.replace(/\s/g, '');
  var exp = document.getElementById('buyCardExp').value;
  if (!name) { err.textContent = 'Informe seu nome.'; return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.textContent = 'E-mail inválido.'; return; }
  if (cardNum.length < 13 || cardNum.length > 19) { err.textContent = 'Número de cartão inválido.'; return; }
  if (!luhnCheck(cardNum)) { err.textContent = 'Número de cartão inválido (falha Luhn).'; return; }
  if (!/^\d{2}\/\d{2}$/.test(exp)) { err.textContent = 'Validade inválida (MM/AA).'; return; }
  var mm = Number(exp.split('/')[0]), yy = Number(exp.split('/')[1]);
  if (mm < 1 || mm > 12) { err.textContent = 'Mês inválido.'; return; }
  if (new Date(2000 + yy, mm) < new Date()) { err.textContent = 'Cartão vencido.'; return; }

  err.textContent = '';
  var btn = document.getElementById('checkoutConfirmBtn');
  var orig = btn.textContent;
  btn.textContent = 'Processando...'; btn.disabled = true;
  setTimeout(function () {
    var cart = getCart();
    var orderId = registerPurchase(email, cart);
    clearCart();
    btn.textContent = orig; btn.disabled = false;
    closeModal('checkoutModal');
    closeModal('cartModal');
    e.target.reset();
    renderDiscography(); updateCartFab(); renderPurchases();
    toast('Compra concluída! Pedido #' + orderId.slice(-6), '✦');
    setTimeout(function () { openModal('purchasesModal'); }, 500);
  }, 1400);
});

function renderPurchases() {
  var wrap = document.getElementById('purchasesList');
  if (!wrap) return;
  var u = currentUser();
  var list = u ? currentUserPurchases() : [];
  if (!list.length) {
    wrap.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:2rem;">Você ainda não comprou nenhuma faixa. <a href="#discografia" data-close style="color:var(--accent);text-decoration:underline;">Ir para a discografia</a></p>';
    return;
  }
  list = list.slice().sort(function (a, b) { return b.date - a.date; });
  wrap.innerHTML = list.map(function (p) {
    var album = CONTENT.discografia.albums.find(function (a) { return a.id === p.albumId; });
    var coverStyle = album && album.coverImage ? 'style="background-image:url(' + esc(album.coverImage) + ')"' : '';
    var coverText = album && album.coverImage ? '' : (album ? esc(album.cover) : '♪');
    return '<div class="purchase-item">' +
      '<div class="cart-item-cover" ' + coverStyle + '>' + coverText + '</div>' +
      '<div class="purchase-info">' +
        '<div class="purchase-title">' + esc(p.title) + '</div>' +
        '<div class="purchase-date">' + esc(p.albumTitle) + ' · ' + new Date(p.date).toLocaleDateString('pt-BR') + '</div>' +
      '</div>' +
      '<div class="purchase-actions">' +
        '<button class="btn btn-ghost btn-sm" onclick="downloadPurchased(\'' + esc(p.albumId) + '\',' + p.trackIndex + ')">⬇ Baixar</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

function downloadPurchased(albumId, trackIndex) { downloadTrack(albumId, trackIndex); }
window.downloadPurchased = downloadPurchased;

/* ============================================================
   PLANOS + CARRINHO - LISTENERS
   ============================================================ */
function bindPlanButtons() {
  document.querySelectorAll('#plansGrid [data-plan]').forEach(function (btn) {
    var clone = btn.cloneNode(true);
    btn.parentNode.replaceChild(clone, btn);
    clone.addEventListener('click', function () { openSubscribeModal(clone.dataset.plan); });
  });
}

var heroBtnSecondaryEl = document.getElementById('heroBtnSecondary');
if (heroBtnSecondaryEl) {
  heroBtnSecondaryEl.addEventListener('click', function (e) {
    e.preventDefault();
    openModal('plansModal');
  });
}

var navPlansLinkEl = document.getElementById('navPlansLink');
if (navPlansLinkEl) {
  navPlansLinkEl.addEventListener('click', function (e) {
    e.preventDefault();
    openModal('plansModal');
  });
}

var navCartEl2 = document.getElementById('navCartLink');
if (navCartEl2) {
  navCartEl2.addEventListener('click', function (e) {
    e.preventDefault();
    openCartModal();
  });
}

var checkoutBtnEl = document.getElementById('checkoutBtn');
if (checkoutBtnEl) checkoutBtnEl.addEventListener('click', function () {
  closeModal('cartModal');
  openCheckoutModal();
});

/* ============================================================
   🎯 EVENT DELEGATION — BACKUP PARA ADICIONAR AO CARRINHO
   Caso o onclick inline falhe, este listener garante que funciona
   ============================================================ */
document.addEventListener('click', function (e) {
  // Busca botão com data-action="add-to-cart"
  var btn = e.target.closest('[data-action="add-to-cart"]');
  if (btn && !btn.disabled) {
    var albumId = btn.dataset.albumId;
    var trackIndex = parseInt(btn.dataset.trackIndex, 10);
    if (albumId && !isNaN(trackIndex)) {
      console.log('[Event Delegation] Adicionando ao carrinho:', albumId, trackIndex);
      handleShopBuy(albumId, trackIndex);
    }
  }
});

/* ============================================================
   BUSCA DA DISCOGRAFIA
   ============================================================ */
var shopSearchEl = document.getElementById('shopSearch');
if (shopSearchEl && shopSearchEl.dataset.bound !== '1') {
  shopSearchEl.dataset.bound = '1';
  shopSearchEl.addEventListener('input', debounce(function () {
    _shopSearch = shopSearchEl.value;
    renderDiscography();
  }, 250));
}

/* ============================================================
   KEYBOARD SHORTCUTS (Espaço para play/pause)
   ============================================================ */
document.addEventListener('keydown', function (e) {
  var inField = ['INPUT', 'TEXTAREA', 'SELECT'].indexOf(e.target.tagName) > -1;
  var pub = document.getElementById('publicSite');
  var publicVisible = pub && pub.style.display !== 'none';
  if (e.code === 'Space' && !inField && publicVisible) {
    e.preventDefault();
    togglePlay();
  }
});

/* ============================================================
   INIT
   ============================================================ */
async function loadProductionUser() {
  if (typeof isProductionMode !== 'function' || !isProductionMode()) return;
  try {
    var response = await fetch('/api/auth-me', { credentials: 'same-origin' });
    var result = await response.json();
    window.PRODUCTION_USER = response.ok && result.ok ? result.user : null;
  } catch (error) { window.PRODUCTION_USER = null; }
}

async function init() {
  try {
    await loadProductionUser();
    refreshPlanConfig();
    applyContentToSite();
    refreshFlatPlaylist();
    updateAuthUI();
    updateCartFab();
    console.log('✅ Site.js inicializado — handleShopBuy disponível:', typeof window.handleShopBuy);
  } catch (err) {
    console.error('Erro na inicialização do site:', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}