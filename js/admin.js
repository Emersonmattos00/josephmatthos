/* ============================================================
   ADMIN.JS — Painel administrativo completo
   Atalho: Ctrl + Shift + A
   Login padrão: admin / admin123
   ============================================================ */

var adminTabTitles = {
  dashboard: 'Dashboard',
  geral: 'Geral',
  hero: 'Hero',
  sobre: 'Sobre',
  filosofia: 'Filosofia',
  discografia: 'Discografia',
  vendas: 'Vendas',
  planos: 'Planos',
  contato: 'Contato',
  usuarios: 'Usuários',
  aparencia: 'Aparência',
  backup: 'Backup'
};

var adminPendingFirstAccess = null;

function showAdminLogin() {
  var loginEl = document.getElementById('adminLogin');
  var dashEl = document.getElementById('adminDashboard');
  if (loginEl) loginEl.style.display = 'flex';
  if (dashEl) dashEl.style.display = 'none';
  showAdminLoginForm();
}

function showAdminDashboard() {
  var loginEl = document.getElementById('adminLogin');
  var dashEl = document.getElementById('adminDashboard');
  if (loginEl) loginEl.style.display = 'none';
  if (dashEl) dashEl.style.display = 'grid';
  renderAdminDashboard();
  loadAllAdminFields();
}

function showAdminPasswordChange() {
  var loginForm = document.getElementById('adminLoginForm');
  var changeForm = document.getElementById('adminPasswordChangeForm');
  var forgotBtn = document.getElementById('adminForgotPassword');
  if (loginForm) loginForm.style.display = 'none';
  if (changeForm) changeForm.style.display = 'block';
  if (forgotBtn) forgotBtn.style.display = 'none';
  var newPass = document.getElementById('adminNewPass');
  if (newPass) newPass.focus();
}

function showAdminLoginForm() {
  var loginForm = document.getElementById('adminLoginForm');
  var changeForm = document.getElementById('adminPasswordChangeForm');
  var forgotBtn = document.getElementById('adminForgotPassword');
  if (loginForm) loginForm.style.display = 'block';
  if (changeForm) changeForm.style.display = 'none';
  if (forgotBtn) forgotBtn.style.display = 'block';
  adminPendingFirstAccess = null;
}

/* ---------- Bind de elementos do admin (com guards) ---------- */
(function bindAdminTopElements() {
  var loginForm = document.getElementById('adminLoginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var user = document.getElementById('adminUser').value.trim();
      var pass = document.getElementById('adminPass').value;
      var err = document.getElementById('adminLoginError');

      if (typeof isProductionMode === 'function' && isProductionMode()) {
        err.textContent = 'Validando acesso...';
        try {
          var response = await fetch('/api/admin-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ user: user, pass: pass })
          });
          var result = await response.json();
          if (!response.ok || !result.ok) {
            err.textContent = result.error || 'Usuário ou senha incorretos.';
            return;
          }
          err.textContent = '';
          e.target.reset();
          showAdminDashboard();
          toast('Bem-vindo ao painel.', '⚙');
          return;
        } catch (error) {
          err.textContent = 'Não foi possível conectar ao servidor de autenticação.';
          return;
        }
      }

      var creds = await getAdminCreds();
      if (user !== creds.user) { err.textContent = 'Usuário ou senha incorretos.'; return; }
      var firstAccess = typeof isAdminFirstAccess === 'function' && await isAdminFirstAccess();
      var result = await verifyPassword(pass, creds.passHash);
      if (!result.ok) { err.textContent = 'Usuário ou senha incorretos.'; return; }
      if (result.needsMigration) {
        try { await saveAdminCreds(user, pass); } catch (e) {}
      }
      if (firstAccess) {
        adminPendingFirstAccess = { user: user };
        showAdminPasswordChange();
        return;
      }
      err.textContent = '';
      sessionStorage.setItem(ADMIN_SESSION_KEY, '1');
      e.target.reset();
      showAdminDashboard();
      toast('Bem-vindo ao painel.', '⚙');
    });
  }

  var passwordChangeForm = document.getElementById('adminPasswordChangeForm');
  if (passwordChangeForm) {
    passwordChangeForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var err = document.getElementById('adminPasswordChangeError');
      var pass = document.getElementById('adminNewPass').value;
      var confirmPass = document.getElementById('adminNewPassConfirm').value;
      if (pass.length < 8) { err.textContent = 'A nova senha deve ter pelo menos 8 caracteres.'; return; }
      if (pass !== confirmPass) { err.textContent = 'As senhas não conferem.'; return; }
      if (!adminPendingFirstAccess) { showAdminLoginForm(); return; }
      var saved = await saveAdminCreds(adminPendingFirstAccess.user, pass);
      if (!saved) { err.textContent = 'Não foi possível salvar a nova senha.'; return; }
      sessionStorage.setItem(ADMIN_SESSION_KEY, '1');
      passwordChangeForm.reset();
      showAdminDashboard();
      toast('Senha atualizada. Bem-vindo ao painel.', '⚙');
    });
  }

  var forgotBtn = document.getElementById('adminForgotPassword');
  if (forgotBtn) {
    forgotBtn.addEventListener('click', async function () {
      var err = document.getElementById('adminLoginError');
      if (typeof isProductionMode === 'function' && isProductionMode()) {
        err.textContent = 'Para redefinir em produção, gere um novo hash bcrypt e atualize ADMIN_PASSWORD_HASH no Vercel. Depois faça um novo deploy.';
        return;
      }
      if (!confirm('Restaurar o acesso para admin / admin123?')) return;
      var reset = await resetAdminCreds();
      err.textContent = reset ? 'Acesso restaurado. Use admin / admin123.' : 'Não foi possível restaurar o acesso.';
      if (reset) showAdminLoginForm();
    });
  }

  var backBtn = document.getElementById('backToSiteFromLogin');
  if (backBtn) backBtn.addEventListener('click', openPublicSite);

  var viewSiteBtn = document.getElementById('adminViewSite');
  if (viewSiteBtn) viewSiteBtn.addEventListener('click', openPublicSite);

  var logoutBtn = document.getElementById('adminLogout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async function () {
      if (typeof isProductionMode === 'function' && isProductionMode()) {
        try { await fetch('/api/admin-logout', { method: 'POST', credentials: 'same-origin' }); } catch (error) {}
      }
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
      showAdminLogin();
      openPublicSite();
      toast('Sessão de admin encerrada.', 'ℹ');
    });
  }
})();

async function hasProductionAdminSession() {
  try {
    var response = await fetch('/api/admin-session', { credentials: 'same-origin' });
    return response.ok;
  } catch (error) {
    return false;
  }
}

function openAdminSite() {
  var pub = document.getElementById('publicSite');
  var adm = document.getElementById('adminSite');
  if (pub) pub.style.display = 'none';
  if (adm) adm.style.display = 'block';
  document.body.style.paddingBottom = '0';
  window.scrollTo(0, 0);
  if (typeof isProductionMode === 'function' && isProductionMode()) {
    showAdminLogin();
    hasProductionAdminSession().then(function (valid) {
      if (valid) showAdminDashboard();
    });
  } else if (sessionStorage.getItem(ADMIN_SESSION_KEY)) showAdminDashboard();
  else { showAdminLogin(); showAdminLoginForm(); }
}

function openPublicSite() {
  var adm = document.getElementById('adminSite');
  var pub = document.getElementById('publicSite');
  if (adm) adm.style.display = 'none';
  if (pub) pub.style.display = 'block';
  document.body.style.paddingBottom = '';
  window.scrollTo(0, 0);
}

document.addEventListener('keydown', function (e) {
  if (e.ctrlKey && e.shiftKey && e.code === 'KeyA') { e.preventDefault(); openAdminSite(); }
  var inField = ['INPUT', 'TEXTAREA', 'SELECT'].indexOf(e.target.tagName) > -1;
  var pub = document.getElementById('publicSite');
  var publicVisible = pub && pub.style.display !== 'none';
  if (e.code === 'Space' && !inField && publicVisible && typeof togglePlay === 'function') {
    e.preventDefault();
    togglePlay();
  }
  if (publicVisible && !inField && typeof audio !== 'undefined' && audio.src && audio.duration) {
    if (e.code === 'ArrowRight') { e.preventDefault(); seekBy(5); }
    if (e.code === 'ArrowLeft') { e.preventDefault(); seekBy(-5); }
  }
  if (e.code === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(function (m) { m.classList.remove('open'); });
    closeAdminModal();
    document.body.style.overflow = '';
    if (typeof restoreFocus === 'function') restoreFocus();
  }
});

/* Navegação por abas */
document.querySelectorAll('.admin-nav button').forEach(function (btn) {
  btn.addEventListener('click', function () {
    document.querySelectorAll('.admin-nav button').forEach(function (b) { b.classList.remove('active'); });
    document.querySelectorAll('.admin-section').forEach(function (s) { s.classList.remove('active'); });
    btn.classList.add('active');
    var tab = btn.dataset.tab;
    var section = document.getElementById('tab-' + tab);
    if (section) section.classList.add('active');
    var titleEl = document.getElementById('adminTabTitle');
    if (titleEl) titleEl.textContent = adminTabTitles[tab] || tab;

    if (tab === 'usuarios') renderUsersTable();
    if (tab === 'vendas') renderSales();
    if (tab === 'backup') loadAdminCredsFields();
    if (tab === 'aparencia') loadAllAdminFields();
    if (tab === 'contato') renderSocialEditor();
  });
});

/* ============================================================
   Campos genéricos (data-content)
   ============================================================ */
function getByPath(obj, path) {
  return path.split('.').reduce(function (o, k) { return o && o[k]; }, obj);
}
function setByPath(obj, path, value) {
  var keys = path.split('.');
  var last = keys.pop();
  var target = keys.reduce(function (o, k) { return (o[k] = o[k] || {}); }, obj);
  target[last] = value;
}

function loadAllAdminFields() {
  document.querySelectorAll('[data-content]').forEach(function (el) {
    var val = getByPath(CONTENT, el.dataset.content);
    if (el.type === 'color') el.value = val || '#000000';
    else if (el.type === 'checkbox') el.checked = !!val;
    else el.value = val == null ? '' : val;
  });
  updateBgPreview();
  updateVinylPreview();
  updateSobrePreview();
  renderFrasesEditor();
  renderAlbumsEditor();
  renderPlansEditor();
  renderSocialEditor();
}

function bindContentInputs() {
  document.querySelectorAll('[data-content]').forEach(function (el) {
    if (el.dataset.bound === '1') return;
    el.dataset.bound = '1';
    el.addEventListener('input', function () {
      var val = el.value;
      if (el.type === 'checkbox') val = el.checked;
      if (el.type === 'number') val = parseFloat(val) || 0;
      setByPath(CONTENT, el.dataset.content, val);
      applyContentToSite();
      if (el.dataset.content === 'branding.bgImage') updateBgPreview();
      if (el.dataset.content === 'hero.vinylImage') updateVinylPreview();
      if (el.dataset.content === 'sobre.image') updateSobrePreview();
    });
  });
}

function updateBgPreview() {
  var el = document.getElementById('bgPreview');
  if (!el) return;
  if (CONTENT.branding.bgImage) {
    el.style.backgroundImage = 'url(' + CONTENT.branding.bgImage + ')';
    el.textContent = '';
  } else {
    el.style.backgroundImage = '';
    el.textContent = 'Sem imagem';
  }
}
function updateVinylPreview() {
  var el = document.getElementById('vinylPreview');
  if (!el) return;
  if (CONTENT.hero.vinylImage) {
    el.style.backgroundImage = 'url(' + CONTENT.hero.vinylImage + ')';
    el.textContent = '';
  } else {
    el.style.backgroundImage = '';
    el.textContent = 'Sem imagem';
  }
}
function updateSobrePreview() {
  var el = document.getElementById('sobrePreview');
  if (!el) return;
  if (CONTENT.sobre.image) {
    el.style.backgroundImage = 'url(' + CONTENT.sobre.image + ')';
    el.textContent = '';
  } else {
    el.style.backgroundImage = '';
    el.textContent = 'Sem imagem';
  }
}

/* ------------------------------------------------------------
   Helper: descreve o caminho da imagem para exibir no toast
   - data URL (upload local): mostra "upload local (X KB)"
   - URL externa: mostra a URL
   - Caminho relativo: monta URL absoluta
   ------------------------------------------------------------ */
function describeImagePath(data) {
  if (!data) return 'sem imagem';
  var s = String(data);
  if (s.indexOf('data:') === 0) {
    var base64 = s.split(',')[1] || '';
    var bytes = Math.round(base64.length * 0.75);
    return 'upload local (' + formatBytes(bytes) + ')';
  }
  if (/^https?:\/\//i.test(s)) return s;
  var origin = window.location.origin;
  var path = s.charAt(0) === '/' ? s : '/' + s;
  return origin + path;
}

function bindUpload(inputId, callback) {
  var input = document.getElementById(inputId);
  if (!input) return;
  input.addEventListener('change', async function () {
    var file = input.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast('Arquivo inválido. Envie uma imagem.', '⚠');
      input.value = '';
      return;
    }
    try {
      toast('Comprimindo imagem...', '🖼');
      callback(await compressImage(file, 1920, 0.82));
    } catch (err) {
      toast('Erro ao processar imagem.', '⚠');
    }
    input.value = '';
  });
}

bindUpload('bgUpload', function (d) {
  CONTENT.branding.bgImage = d;
  applyContentToSite();
  loadAllAdminFields();
  saveContent();
  toast('Imagem de fundo atualizada — ' + describeImagePath(d), '🖼');
});

bindUpload('vinylUpload', function (d) {
  CONTENT.hero.vinylImage = d;
  applyContentToSite();
  loadAllAdminFields();
  saveContent();
  toast('Imagem do vinil atualizada — ' + describeImagePath(d), '🖼');
});

bindUpload('sobreUpload', function (d) {
  CONTENT.sobre.image = d;
  applyContentToSite();
  loadAllAdminFields();
  saveContent();
  toast('Imagem da seção Sobre atualizada — ' + describeImagePath(d), '🖼');
});

/* ============================================================
   Frases
   ============================================================ */
function renderFrasesEditor() {
  var wrap = document.getElementById('frasesEditor');
  if (!wrap) return;
  wrap.innerHTML = CONTENT.filosofia.frases.map(function (f, i) {
    return '<div class="track-editor">' +
      '<div class="track-head">' +
        '<strong>Frase ' + (i + 1) + '</strong>' +
        '<button class="btn btn-ghost btn-sm" onclick="removeFrase(' + i + ')" aria-label="Remover">🗑 Remover</button>' +
      '</div>' +
      '<div class="form-group"><label>Texto</label><textarea oninput="updateFrase(' + i + ',\'text\',this.value)">' + esc(f.text) + '</textarea></div>' +
      '<div class="form-group"><label>Autor</label><input type="text" value="' + esc(f.author) + '" oninput="updateFrase(' + i + ',\'author\',this.value)"></div>' +
    '</div>';
  }).join('');
}
window.updateFrase = function (i, key, val) { CONTENT.filosofia.frases[i][key] = val; applyContentToSite(); };
window.removeFrase = function (i) { CONTENT.filosofia.frases.splice(i, 1); renderFrasesEditor(); applyContentToSite(); saveContent(); };
var addFraseBtn = document.getElementById('addFraseBtn');
if (addFraseBtn) {
  addFraseBtn.addEventListener('click', function () {
    CONTENT.filosofia.frases.push({ text: 'Nova frase', author: 'Joseph Matthos' });
    renderFrasesEditor();
    applyContentToSite();
    saveContent();
  });
}

/* ============================================================
   Helpers de áudio
   ============================================================ */
function audioChip(url) {
  if (isUploadedAudio(url)) return '<span class="audio-chip">🎵 Upload no dispositivo</span>';
  if (url && String(url).trim()) return '<span class="audio-chip remote">🔗 URL externa</span>';
  return '<span class="audio-chip none">⚠ sem áudio</span>';
}
function cleanupTrackAudio(track) {
  if (!track) return;
  ['fullAudio', 'previewAudio'].forEach(function (k) {
    if (isUploadedAudio(track[k])) {
      deleteAudioBlob(track[k].slice(6)).catch(function (err) { console.warn('Falha ao remover blob:', err); });
    }
  });
}

/* ============================================================
   Editor: Álbuns
   ============================================================ */
function renderAlbumsEditor() {
  var wrap = document.getElementById('albumsEditor');
  if (!wrap) return;
  wrap.innerHTML = CONTENT.discografia.albums.map(function (al, ai) {
    return '<div class="track-editor">' +
      '<div class="track-head">' +
        '<strong>' + esc(al.title) + ' <span style="color:var(--text-dim);font-weight:400;font-size:0.75rem;">(' + al.type + ')</span></strong>' +
        '<div>' +
          '<button class="btn btn-ghost btn-sm" onclick="editAlbum(' + ai + ')">✏ Editar</button>' +
          '<button class="btn btn-ghost btn-sm" onclick="removeAlbum(' + ai + ')" aria-label="Remover">🗑</button>' +
        '</div>' +
      '</div>' +
      '<div style="color:var(--text-dim);font-size:0.8rem;">' + al.tracks.length + ' faixa(s) · ' + al.year + '</div>' +
    '</div>';
  }).join('');
}
window.removeAlbum = function (i) {
  if (!confirm('Remover este álbum e todas as faixas? Áudios enviados também serão apagados.')) return;
  CONTENT.discografia.albums[i].tracks.forEach(cleanupTrackAudio);
  CONTENT.discografia.albums.splice(i, 1);
  renderAlbumsEditor();
  applyContentToSite();
  refreshFlatPlaylist();
  saveContent();
};
window.editAlbum = function (i) { openAlbumModal(i); };
var addAlbumBtn = document.getElementById('addAlbumBtn');
if (addAlbumBtn) addAlbumBtn.addEventListener('click', function () { openAlbumModal(-1); });

function openAlbumModal(index) {
  var isNew = index < 0;
  var al = isNew
    ? { id: generateId('album'), type: 'single', title: 'Novo', year: new Date().getFullYear(), cover: 'NN', coverImage: '', description: '', tracks: [] }
    : JSON.parse(JSON.stringify(CONTENT.discografia.albums[index]));

  document.getElementById('adminModalContent').innerHTML =
    '<h3>' + (isNew ? 'Novo álbum/EP/single' : 'Editar álbum') + '</h3>' +
    '<div class="form-row">' +
      '<div class="form-group"><label>Título</label><input type="text" id="amTitle" value="' + esc(al.title) + '"></div>' +
      '<div class="form-group"><label>Tipo</label>' +
        '<select id="amType">' +
          '<option value="album" ' + (al.type === 'album' ? 'selected' : '') + '>Álbum</option>' +
          '<option value="ep" ' + (al.type === 'ep' ? 'selected' : '') + '>EP</option>' +
          '<option value="single" ' + (al.type === 'single' ? 'selected' : '') + '>Single</option>' +
        '</select>' +
      '</div>' +
    '</div>' +
    '<div class="form-row-3">' +
      '<div class="form-group"><label>Ano</label><input type="number" id="amYear" value="' + al.year + '"></div>' +
      '<div class="form-group"><label>Iniciais (sem imagem)</label><input type="text" id="amCover" maxlength="3" value="' + esc(al.cover) + '"></div>' +
      '<div class="form-group"><label>ID interno</label><input type="text" value="' + esc(al.id) + '" disabled></div>' +
    '</div>' +
    '<div class="form-group"><label>Descrição</label><textarea id="amDesc">' + esc(al.description) + '</textarea></div>' +
    '<div class="form-group"><label>URL/caminho da capa</label><input type="text" id="amCoverImage" value="' + esc(al.coverImage) + '" placeholder="assets/img/... ou https://..."></div>' +
    '<div class="upload-zone" onclick="document.getElementById(\'albumCoverUpload\').click()">📁 Ou enviar capa</div>' +
    '<input type="file" id="albumCoverUpload" accept="image/*" style="display:none;">' +
    '<div class="admin-img-preview" id="amCoverPreview" style="' + (al.coverImage ? 'background-image:url(' + esc(al.coverImage) + ');' : '') + '">' + (al.coverImage ? '' : 'Sem capa') + '</div>' +
    '<h3 style="margin-top:1.5rem;">Faixas <span class="hint" style="font-size:0.7rem;color:var(--text-dim);">+ adicione · preço e venda por faixa</span></h3>' +
    '<div id="amTracks"></div>' +
    '<button class="btn btn-outline btn-sm" id="amAddTrackBtn" style="margin-top:0.5rem;">+ Adicionar faixa</button>' +
    '<div style="display:flex;gap:0.7rem;margin-top:1.5rem;justify-content:flex-end;">' +
      '<button class="btn btn-outline btn-sm" onclick="closeAdminModal()">Cancelar</button>' +
      '<button class="btn btn-primary btn-sm" id="amSaveBtn">Salvar álbum</button>' +
    '</div>';
  document.getElementById('adminModal').classList.add('open');

  var tracksWrap = document.getElementById('amTracks');

  function renderTracks() {
    tracksWrap.innerHTML = al.tracks.map(function (t, ti) {
      return '<div class="track-editor">' +
        '<div class="track-head">' +
          '<strong>Faixa ' + (ti + 1) + ': ' + esc(t.title) + '</strong>' +
          '<button class="btn btn-ghost btn-sm" onclick="removeAlbumTrack(' + ti + ')" aria-label="Remover">🗑</button>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-group"><label>Título</label><input type="text" value="' + esc(t.title) + '" oninput="updateAlbumTrack(' + ti + ',\'title\',this.value)"></div>' +
          '<div class="form-group"><label>Duração (ex: 4:32)</label><input type="text" value="' + esc(t.duration || '') + '" oninput="updateAlbumTrack(' + ti + ',\'duration\',this.value)"></div>' +
        '</div>' +
        '<div class="form-group">' +
          '<label>Faixa completa (Premium + base da prévia)</label>' +
          '<input type="text" value="' + esc(t.fullAudio || '') + '" oninput="updateAlbumTrack(' + ti + ',\'fullAudio\',this.value)" placeholder="https://... ou envie abaixo">' +
          '<div style="display:flex;gap:0.5rem;align-items:center;margin-top:0.4rem;flex-wrap:wrap;">' +
            '<button type="button" class="btn btn-ghost btn-sm" onclick="document.getElementById(\'upFull_' + ti + '\').click()">📁 Enviar áudio</button>' +
            (isUploadedAudio(t.fullAudio) ? '<button type="button" class="btn btn-ghost btn-sm" style="color:var(--danger);" onclick="clearUploadedTrack(' + ti + ',\'fullAudio\')">🗑 Remover upload</button>' : '') +
            audioChip(t.fullAudio) +
          '</div>' +
          '<input type="file" id="upFull_' + ti + '" accept="audio/*" style="display:none;" onchange="uploadTrackAudio(' + ti + ',\'fullAudio\',this)">' +
        '</div>' +
        '<div class="form-group">' +
          '<label>Prévia dedicada (opcional)</label>' +
          '<input type="text" value="' + esc(t.previewAudio || '') + '" oninput="updateAlbumTrack(' + ti + ',\'previewAudio\',this.value)" placeholder="Vazio = corta a completa automaticamente">' +
          '<div style="display:flex;gap:0.5rem;align-items:center;margin-top:0.4rem;flex-wrap:wrap;">' +
            '<button type="button" class="btn btn-ghost btn-sm" onclick="document.getElementById(\'upPrev_' + ti + '\').click()">📁 Enviar prévia</button>' +
            (isUploadedAudio(t.previewAudio) ? '<button type="button" class="btn btn-ghost btn-sm" style="color:var(--danger);" onclick="clearUploadedTrack(' + ti + ',\'previewAudio\')">🗑 Remover upload</button>' : '') +
            (t.previewAudio ? audioChip(t.previewAudio) : '') +
          '</div>' +
          '<input type="file" id="upPrev_' + ti + '" accept="audio/*" style="display:none;" onchange="uploadTrackAudio(' + ti + ',\'previewAudio\',this)">' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-group"><label>Início da prévia (s)</label><input type="number" min="0" value="' + (parseInt(t.previewStart) || 0) + '" oninput="updateAlbumTrack(' + ti + ',\'previewStart\',parseInt(this.value)||0)"></div>' +
          '<div class="form-group"><label>Duração da prévia (s)</label><input type="number" min="5" max="120" value="' + (parseInt(t.previewDuration) || 30) + '" oninput="updateAlbumTrack(' + ti + ',\'previewDuration\',parseInt(this.value)||30)"></div>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-group"><label>Preço (R$)</label><input type="number" step="0.01" min="0" value="' + (t.price != null ? t.price : (CONTENT.loja ? CONTENT.loja.defaultPrice : 4.90)) + '" oninput="updateAlbumTrack(' + ti + ',\'price\',parseFloat(this.value)||0)"></div>' +
          '<div class="form-group"><label>Vender individualmente?</label><select onchange="updateAlbumTrack(' + ti + ',\'forSale\',this.value === \'true\')"><option value="true" ' + (t.forSale !== false ? 'selected' : '') + '>Sim</option><option value="false" ' + (t.forSale === false ? 'selected' : '') + '>Não</option></select></div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  window.updateAlbumTrack = function (ti, key, val) { al.tracks[ti][key] = val; };
  window.removeAlbumTrack = function (ti) { cleanupTrackAudio(al.tracks[ti]); al.tracks.splice(ti, 1); renderTracks(); };
  window.uploadTrackAudio = async function (ti, key, inputEl) {
    var f = inputEl.files[0];
    if (!f) return;
    if (!isAudioFile(f)) { toast('Formato não reconhecido como áudio.', '⚠'); inputEl.value = ''; return; }
    if (f.size > 80 * 1024 * 1024) { toast('Arquivo muito grande (máx. 80MB).', '⚠'); inputEl.value = ''; return; }
    try {
      toast('Salvando áudio no navegador...', '🎵');
      var ref = await storeAudioFile(f);
      var old = al.tracks[ti][key];
      if (isUploadedAudio(old)) deleteAudioBlob(old.slice(6)).catch(function (err) { console.warn('Falha:', err); });
      al.tracks[ti][key] = ref;
      inputEl.value = '';
      renderTracks();
      toast('Áudio enviado (' + formatBytes(f.size) + ').', '✓');
    } catch (err) {
      console.error(err);
      toast('Erro ao salvar áudio.', '⚠');
      inputEl.value = '';
    }
  };
  window.clearUploadedTrack = function (ti, key) {
    var old = al.tracks[ti][key];
    if (isUploadedAudio(old)) deleteAudioBlob(old.slice(6)).catch(function (err) { console.warn('Falha:', err); });
    al.tracks[ti][key] = '';
    renderTracks();
    toast('Upload removido.', '🗑');
  };
  renderTracks();

  document.getElementById('amAddTrackBtn').addEventListener('click', function () {
    al.tracks.push({ title: 'Nova faixa', fullAudio: '', previewAudio: '', previewStart: 0, previewDuration: 30, duration: '0:00', price: CONTENT.loja ? CONTENT.loja.defaultPrice : 4.90, forSale: true });
    renderTracks();
  });

  document.getElementById('albumCoverUpload').addEventListener('change', async function (e) {
    var f = e.target.files[0];
    if (!f) return;
    try {
      var dataUrl = await compressImage(f, 800, 0.85);
      al.coverImage = dataUrl;
      var p = document.getElementById('amCoverPreview');
      p.style.backgroundImage = 'url(' + dataUrl + ')';
      p.textContent = '';
      document.getElementById('amCoverImage').value = '';
    } catch (err) {
      toast('Erro ao processar imagem.', '⚠');
    }
    e.target.value = '';
  });
  document.getElementById('amCoverImage').addEventListener('input', function (e) {
    al.coverImage = e.target.value;
    var p = document.getElementById('amCoverPreview');
    if (e.target.value) {
      p.style.backgroundImage = 'url(' + e.target.value + ')';
      p.textContent = '';
    } else {
      p.style.backgroundImage = '';
      p.textContent = 'Sem capa';
    }
  });

  document.getElementById('amSaveBtn').addEventListener('click', function () {
    al.title = document.getElementById('amTitle').value;
    al.type = document.getElementById('amType').value;
    al.year = parseInt(document.getElementById('amYear').value) || new Date().getFullYear();
    al.cover = document.getElementById('amCover').value || 'NN';
    al.description = document.getElementById('amDesc').value;
    al.coverImage = document.getElementById('amCoverImage').value || al.coverImage;
    if (isNew) CONTENT.discografia.albums.push(al);
    else CONTENT.discografia.albums[index] = al;
    saveContent();
    refreshFlatPlaylist();
    renderAlbumsEditor();
    applyContentToSite();
    closeAdminModal();
    toast('Álbum salvo.', '💿');
  });
}

function closeAdminModal() {
  var m = document.getElementById('adminModal');
  if (m) m.classList.remove('open');
}
window.closeAdminModal = closeAdminModal;

/* ============================================================
   Editor: Planos
   ============================================================ */
function renderPlansEditor() {
  var wrap = document.getElementById('plansEditor');
  if (!wrap) return;
  wrap.innerHTML = CONTENT.planos.plans.map(function (p, i) {
    return '<div class="track-editor">' +
      '<div class="track-head">' +
        '<strong>' + esc(p.name) + ' — ' + esc(p.price) + esc(p.suffix) + '</strong>' +
        '<button class="btn btn-ghost btn-sm" onclick="editPlan(' + i + ')">✏ Editar</button>' +
      '</div>' +
      '<div style="color:var(--text-dim);font-size:0.8rem;">' + esc(p.desc) + '</div>' +
    '</div>';
  }).join('');
}
window.editPlan = function (i) { openPlanModal(i); };

function openPlanModal(i) {
  var p = JSON.parse(JSON.stringify(CONTENT.planos.plans[i]));
  document.getElementById('adminModalContent').innerHTML =
    '<h3>Editar plano</h3>' +
    '<div class="form-row">' +
      '<div class="form-group"><label>Nome</label><input type="text" id="pmName" value="' + esc(p.name) + '"></div>' +
      '<div class="form-group"><label>ID</label><input type="text" id="pmId" value="' + esc(p.id) + '"></div>' +
    '</div>' +
    '<div class="form-row-3">' +
      '<div class="form-group"><label>Preço</label><input type="text" id="pmPrice" value="' + esc(p.price) + '"></div>' +
      '<div class="form-group"><label>Sufixo</label><input type="text" id="pmSuffix" value="' + esc(p.suffix) + '"></div>' +
      '<div class="form-group"><label>Badge</label><input type="text" id="pmBadge" value="' + esc(p.badge || '') + '"></div>' +
    '</div>' +
    '<div class="form-group"><label>Descrição</label><input type="text" id="pmDesc" value="' + esc(p.desc) + '"></div>' +
    '<div class="form-group"><label>Texto do botão</label><input type="text" id="pmCta" value="' + esc(p.cta) + '"></div>' +
    '<div class="form-group"><label><input type="checkbox" id="pmFeatured" ' + (p.featured ? 'checked' : '') + '> Destaque</label></div>' +
    '<div class="form-group"><label><input type="checkbox" id="pmDisabled" ' + (p.disabled ? 'checked' : '') + '> Botão desabilitado</label></div>' +
    '<h3 style="margin-top:1rem;">Recursos</h3>' +
    '<div id="pmFeatures"></div>' +
    '<button class="btn btn-outline btn-sm" id="pmAddFeature" style="margin-top:0.5rem;">+ Adicionar recurso</button>' +
    '<div style="display:flex;gap:0.7rem;margin-top:1.5rem;justify-content:flex-end;">' +
      '<button class="btn btn-outline btn-sm" onclick="closeAdminModal()">Cancelar</button>' +
      '<button class="btn btn-primary btn-sm" id="pmSave">Salvar</button>' +
    '</div>';
  document.getElementById('adminModal').classList.add('open');

  var fWrap = document.getElementById('pmFeatures');
  function renderFeatures() {
    fWrap.innerHTML = p.features.map(function (f, fi) {
      return '<div class="track-editor">' +
        '<div class="track-head">' +
          '<strong>Recurso ' + (fi + 1) + '</strong>' +
          '<button class="btn btn-ghost btn-sm" onclick="removePlanFeature(' + fi + ')">🗑</button>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-group"><label>Texto</label><input type="text" value="' + esc(f.text) + '" oninput="updatePlanFeature(' + fi + ',\'text\',this.value)"></div>' +
          '<div class="form-group"><label><input type="checkbox" ' + (f.ok ? 'checked' : '') + ' onchange="updatePlanFeature(' + fi + ',\'ok\',this.checked)"> Incluído</label></div>' +
        '</div>' +
      '</div>';
    }).join('');
  }
  window.updatePlanFeature = function (fi, k, v) { p.features[fi][k] = v; };
  window.removePlanFeature = function (fi) { p.features.splice(fi, 1); renderFeatures(); };
  renderFeatures();

  document.getElementById('pmAddFeature').addEventListener('click', function () {
    p.features.push({ text: 'Novo recurso', ok: true });
    renderFeatures();
  });
  document.getElementById('pmSave').addEventListener('click', function () {
    p.name = document.getElementById('pmName').value;
    p.id = document.getElementById('pmId').value;
    p.price = document.getElementById('pmPrice').value;
    p.suffix = document.getElementById('pmSuffix').value;
    p.badge = document.getElementById('pmBadge').value || undefined;
    p.desc = document.getElementById('pmDesc').value;
    p.cta = document.getElementById('pmCta').value;
    p.featured = document.getElementById('pmFeatured').checked;
    p.disabled = document.getElementById('pmDisabled').checked;
    CONTENT.planos.plans[i] = p;
    saveContent();
    renderPlansEditor();
    applyContentToSite();
    refreshPlanConfig();
    closeAdminModal();
    toast('Plano salvo.', '💳');
  });
}

/* ============================================================
   Editor: Redes sociais
   ============================================================ */
function renderSocialEditor() {
  var wrap = document.getElementById('socialEditor');
  if (!wrap) return;
  var networks = [
    { key: 'spotify', label: 'Spotify' },
    { key: 'youtube', label: 'YouTube' },
    { key: 'amazon', label: 'Amazon Music' },
    { key: 'facebook', label: 'Facebook' },
    { key: 'tiktok', label: 'TikTok' },
    { key: 'apple', label: 'Apple Music' },
    { key: 'audiomack', label: 'Audiomack' },
    { key: 'itunes', label: 'iTunes' },
    { key: 'deezer', label: 'Deezer' }
  ];
  wrap.innerHTML = CONTENT.contato.socials.map(function (s, i) {
    return '<div class="track-editor">' +
      '<div class="track-head">' +
        '<strong>' + esc(s.label) + '</strong>' +
        '<button class="btn btn-ghost btn-sm" onclick="removeSocial(' + i + ')" aria-label="Remover">🗑</button>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-group">' +
          '<label>Rede</label>' +
          '<select onchange="updateSocial(' + i + ',\'icon\',this.value); updateSocial(' + i + ',\'label\',this.options[this.selectedIndex].text); renderSocialEditor();">' +
            networks.map(function (n) { return '<option value="' + n.key + '" ' + (s.icon === n.key ? 'selected' : '') + '>' + n.label + '</option>'; }).join('') +
          '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label>Nome exibido no tooltip</label>' +
          '<input type="text" value="' + esc(s.label) + '" oninput="updateSocial(' + i + ',\'label\',this.value)">' +
        '</div>' +
      '</div>' +
      '<div class="form-group">' +
        '<label>URL</label>' +
        '<input type="text" value="' + esc(s.url) + '" oninput="updateSocial(' + i + ',\'url\',this.value)" placeholder="https://...">' +
      '</div>' +
    '</div>';
  }).join('');
}
window.updateSocial = function (i, k, v) { CONTENT.contato.socials[i][k] = v; applyContentToSite(); };
window.removeSocial = function (i) { CONTENT.contato.socials.splice(i, 1); renderSocialEditor(); applyContentToSite(); saveContent(); };
var addSocialBtn = document.getElementById('addSocialBtn');
if (addSocialBtn) {
  addSocialBtn.addEventListener('click', function () {
    CONTENT.contato.socials.push({ icon: 'spotify', label: 'Spotify', url: '#' });
    renderSocialEditor();
    applyContentToSite();
    saveContent();
  });
}

/* ============================================================
   Dashboard
   ============================================================ */
function renderAdminDashboard() {
  var users = getUsers();
  var premium = users.filter(function (u) { return u.plan === 'premium' || u.plan === 'anual'; }).length;
  var free = users.length - premium;
  var revenue = users.filter(function (u) { return u.plan === 'premium'; }).length * 19.90
              + users.filter(function (u) { return u.plan === 'anual'; }).length * (179 / 12);
  var albumsCount = CONTENT.discografia.albums.length;
  var tracksCount = CONTENT.discografia.albums.reduce(function (s, a) { return s + a.tracks.length; }, 0);

  var allPurchases = getPurchases();
  var salesRevenue = 0;
  var salesCount = 0;
  Object.keys(allPurchases).forEach(function (email) {
    (allPurchases[email] || []).forEach(function (p) { salesRevenue += p.price || 0; salesCount++; });
  });

  var statsEl = document.getElementById('statsGrid');
  if (statsEl) {
    statsEl.innerHTML =
      '<div class="stat-card"><div class="label">Usuários</div><div class="value">' + users.length + '</div><div class="hint">' + free + ' free · ' + premium + ' premium</div></div>' +
      '<div class="stat-card"><div class="label">Assinantes</div><div class="value">' + premium + '</div><div class="hint">' + (users.length ? Math.round(premium / users.length * 100) : 0) + '% do total</div></div>' +
      '<div class="stat-card"><div class="label">Receita assinaturas</div><div class="value">R$ ' + revenue.toFixed(2) + '</div><div class="hint">estimativa</div></div>' +
      '<div class="stat-card"><div class="label">Receita loja</div><div class="value">' + formatPrice(salesRevenue) + '</div><div class="hint">' + salesCount + ' vendas</div></div>' +
      '<div class="stat-card"><div class="label">Discografia</div><div class="value">' + albumsCount + '</div><div class="hint">' + tracksCount + ' faixas</div></div>';
  }

  var recent = users.slice().sort(function (a, b) { return b.createdAt - a.createdAt; }).slice(0, 5);
  var recentEl = document.getElementById('recentUsersTable');
  if (recentEl) {
    recentEl.innerHTML = recent.length ?
      '<table class="admin-table"><thead><tr><th>Nome</th><th>E-mail</th><th>Plano</th><th>Cadastro</th></tr></thead><tbody>' +
      recent.map(function (u) {
        return '<tr><td>' + esc(u.name) + '</td><td>' + esc(u.email) + '</td><td>' + badgePlan(u.plan) + '</td><td>' + new Date(u.createdAt).toLocaleDateString('pt-BR') + '</td></tr>';
      }).join('') + '</tbody></table>'
      : '<p style="color:var(--text-dim);">Nenhum usuário cadastrado ainda.</p>';
  }
}
function badgePlan(plan) {
  if (plan === 'free') return '<span class="badge-mini badge-free">Free</span>';
  if (plan === 'premium') return '<span class="badge-mini badge-premium">Premium</span>';
  if (plan === 'anual') return '<span class="badge-mini badge-premium">Anual</span>';
  return plan;
}

/* ============================================================
   Usuários
   ============================================================ */
function renderUsersTable() {
  var filterEl = document.getElementById('userFilter');
  var searchEl = document.getElementById('userSearch');
  if (!filterEl || !searchEl) return;
  var filter = filterEl.value;
  var search = searchEl.value.toLowerCase();
  var users = getUsers();
  var total = users.length;
  if (filter !== 'all') users = users.filter(function (u) { return u.plan === filter; });
  if (search) users = users.filter(function (u) { return u.name.toLowerCase().indexOf(search) > -1 || u.email.toLowerCase().indexOf(search) > -1; });
  var countEl = document.getElementById('usersCount');
  if (countEl) countEl.textContent = users.length + ' de ' + total;
  var wrap = document.getElementById('usersTable');
  if (!wrap) return;
  if (!users.length) {
    wrap.innerHTML = '<p style="color:var(--text-dim);padding:1rem;text-align:center;">Nenhum usuário encontrado.</p>';
    return;
  }
  wrap.innerHTML =
    '<table class="admin-table"><thead><tr><th>Nome</th><th>E-mail</th><th>Plano</th><th>Status</th><th>Cadastro</th><th>Ações</th></tr></thead><tbody>' +
    users.map(function (u) {
      return '<tr>' +
        '<td>' + esc(u.name) + '</td>' +
        '<td>' + esc(u.email) + '</td>' +
        '<td>' + badgePlan(u.plan) + '</td>' +
        '<td>' + (u.banned ? '<span class="badge-mini badge-banned">Banido</span>' : '<span style="color:var(--success);font-size:0.75rem;">Ativo</span>') + '</td>' +
        '<td>' + new Date(u.createdAt).toLocaleDateString('pt-BR') + '</td>' +
        '<td><div class="actions">' +
          '<button class="btn btn-ghost btn-sm" onclick="changePlan(\'' + u.id + '\')">Plano</button>' +
          '<button class="btn btn-ghost btn-sm" onclick="banUser(\'' + u.id + '\')">' + (u.banned ? 'Reativar' : 'Banir') + '</button>' +
          '<button class="btn btn-ghost btn-sm" style="color:var(--danger);" onclick="deleteUserConfirm(\'' + u.id + '\')">Excluir</button>' +
        '</div></td>' +
      '</tr>';
    }).join('') + '</tbody></table>';
}
var userSearchEl = document.getElementById('userSearch');
if (userSearchEl) userSearchEl.addEventListener('input', debounce(renderUsersTable, 250));
var userFilterEl = document.getElementById('userFilter');
if (userFilterEl) userFilterEl.addEventListener('change', renderUsersTable);

window.changePlan = function (id) {
  var u = getUsers().find(function (x) { return x.id === id; });
  if (!u) return;
  var opt = prompt('Plano atual: ' + u.plan + '\nDigite: free, premium ou anual', u.plan);
  if (!opt) return;
  if (['free', 'premium', 'anual'].indexOf(opt) < 0) { toast('Plano inválido.', '⚠'); return; }
  updateUserPlan(id, opt);
  renderUsersTable();
  renderAdminDashboard();
  toast('Plano atualizado.', '✓');
};
window.banUser = function (id) { toggleUserBan(id); renderUsersTable(); toast('Status atualizado.', '✓'); };
window.deleteUserConfirm = function (id) {
  if (!confirm('Excluir este usuário permanentemente?')) return;
  deleteUser(id);
  renderUsersTable();
  renderAdminDashboard();
  toast('Usuário excluído.', '🗑');
};

/* ============================================================
   Vendas
   ============================================================ */
function renderSales() {
  var all = getPurchases();
  var emails = Object.keys(all);
  var allPurchases = [];
  emails.forEach(function (email) {
    (all[email] || []).forEach(function (p) { allPurchases.push({ email: email, purchase: p }); });
  });
  var totalRevenue = allPurchases.reduce(function (s, x) { return s + (x.purchase.price || 0); }, 0);
  var orders = {};
  allPurchases.forEach(function (x) { orders[x.purchase.orderId] = true; });
  var uniqueOrders = Object.keys(orders).length;
  var statsEl = document.getElementById('salesStats');
  if (statsEl) {
    statsEl.innerHTML =
      '<div class="stat-card"><div class="label">Receita total</div><div class="value">' + formatPrice(totalRevenue) + '</div><div class="hint">estimativa</div></div>' +
      '<div class="stat-card"><div class="label">Faixas vendidas</div><div class="value">' + allPurchases.length + '</div><div class="hint">itens</div></div>' +
      '<div class="stat-card"><div class="label">Pedidos</div><div class="value">' + uniqueOrders + '</div><div class="hint">únicos</div></div>' +
      '<div class="stat-card"><div class="label">Compradores</div><div class="value">' + emails.length + '</div><div class="hint">e-mails únicos</div></div>';
  }
  var wrap = document.getElementById('salesTable');
  if (!wrap) return;
  var count = document.getElementById('salesCount');
  if (count) count.textContent = allPurchases.length + ' vendas';
  if (!allPurchases.length) {
    wrap.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:2rem;">Nenhuma venda ainda.</p>';
    return;
  }
  allPurchases.sort(function (a, b) { return b.purchase.date - a.purchase.date; });
  wrap.innerHTML =
    '<table class="admin-table"><thead><tr><th>Data</th><th>Cliente</th><th>Faixa</th><th>Álbum</th><th>Valor</th><th>Pedido</th></tr></thead><tbody>' +
    allPurchases.map(function (x) {
      return '<tr>' +
        '<td>' + new Date(x.purchase.date).toLocaleDateString('pt-BR') + '</td>' +
        '<td>' + esc(x.email) + '</td>' +
        '<td>' + esc(x.purchase.title) + '</td>' +
        '<td>' + esc(x.purchase.albumTitle || '—') + '</td>' +
        '<td style="color:var(--accent);font-weight:600;">' + formatPrice(x.purchase.price) + '</td>' +
        '<td style="font-size:0.7rem;color:var(--text-dim);">#' + (x.purchase.orderId || '').slice(-6) + '</td>' +
      '</tr>';
    }).join('') + '</tbody></table>';
}

/* ============================================================
   Backup
   ============================================================ */
var adminSaveBtn = document.getElementById('adminSaveBtn');
if (adminSaveBtn) {
  adminSaveBtn.addEventListener('click', function () { saveContent(); toast('Alterações salvas.', '💾'); });
}
var adminResetBtn = document.getElementById('adminResetBtn');
if (adminResetBtn) {
  adminResetBtn.addEventListener('click', function () {
    if (!confirm('Restaurar todo o conteúdo para o padrão?')) return;
    setContent(JSON.parse(JSON.stringify(DEFAULT_CONTENT)));
    saveContent();
    applyContentToSite();
    refreshFlatPlaylist();
    refreshPlanConfig();
    loadAllAdminFields();
    renderAdminDashboard();
    toast('Conteúdo restaurado.', '↺');
  });
}
var exportBtn = document.getElementById('exportBtn');
if (exportBtn) {
  exportBtn.addEventListener('click', function () {
    var pack = { _version: SCHEMA_VERSION, _exportedAt: new Date().toISOString(), content: CONTENT };
    var blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'joseph-matthos-content-' + Date.now() + '.json';
    a.click();
    URL.revokeObjectURL(url);
    toast('Exportado.', '⬇');
  });
}
var importFile = document.getElementById('importFile');
if (importFile) {
  importFile.addEventListener('change', function (e) {
    var f = e.target.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      try {
        var parsed = JSON.parse(r.result);
        var data = parsed.content || parsed;
        setContent(deepMerge(JSON.parse(JSON.stringify(DEFAULT_CONTENT)), data));
        saveContent();
        applyContentToSite();
        refreshFlatPlaylist();
        refreshPlanConfig();
        loadAllAdminFields();
        renderAdminDashboard();
        toast('Conteúdo importado.', '⬆');
      } catch (err) { toast('Arquivo inválido.', '⚠'); }
    };
    r.readAsText(f);
  });
}
var wipeBtn = document.getElementById('wipeBtn');
if (wipeBtn) {
  wipeBtn.addEventListener('click', async function () {
    if (!confirm('Apagar TUDO (conteúdo + usuários + áudios)? Irreversível.')) return;
    if (!confirm('Tem certeza absoluta?')) return;
    localStorage.removeItem(CONTENT_KEY);
    localStorage.removeItem(USERS_KEY);
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(ADMIN_KEY);
    localStorage.removeItem(VOLUME_KEY);
    localStorage.removeItem(CART_KEY);
    localStorage.removeItem(PURCHASES_KEY);
    try {
      await new Promise(function (resolve) {
        var req = indexedDB.deleteDatabase(AUDIO_DB_NAME);
        req.onsuccess = function () { resolve(); };
        req.onerror = function () { resolve(); };
        req.onblocked = function () { resolve(); };
      });
    } catch (err) {}
    location.reload();
  });
}
function loadAdminCredsFields() {
  getAdminCreds().then(function (c) {
    var el = document.getElementById('adminUserField');
    if (el) el.value = c.user;
  });
}
var saveAdminCredsBtn = document.getElementById('saveAdminCreds');
if (saveAdminCredsBtn) {
  saveAdminCredsBtn.addEventListener('click', async function () {
    var u = document.getElementById('adminUserField').value.trim();
    var p = document.getElementById('adminPassField').value;
    if (!u) { toast('Usuário não pode ser vazio.', '⚠'); return; }
    await saveAdminCreds(u, p || null);
    document.getElementById('adminPassField').value = '';
    toast('Credenciais salvas.', '🔐');
  });
}

/* ============================================================
   INIT
   ============================================================ */
function init() {
  try {
    refreshPlanConfig();
    applyContentToSite();
    refreshFlatPlaylist();
    updateAuthUI();
    bindContentInputs();
    renderAdminDashboard();
    // ⚠️ updateCartFab por último, garantindo que todo o DOM está pronto
    updateCartFab();
  } catch (err) {
    console.error('Erro na inicialização:', err);
    document.body.innerHTML = '<div style="padding:2rem;text-align:center;color:#eee9e0;background:#0b0a0c;font-family:sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;"><div><h1 style="color:#d4af37;margin-bottom:1rem;">Erro ao carregar</h1><p>Abra o console (F12) para detalhes.</p></div></div>';
  }
}

// Aguarda o DOM estar 100% pronto antes de iniciar
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
