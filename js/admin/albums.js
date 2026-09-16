// js/admin/albums.js
'use strict';

import { esc, escCssUrl, generateId, el, clearElement, formatBytes } from './helpers.js';
import { toast, openModal, closeModal, confirmDialog } from './ui.js';

/* ─────────────────────────────────────────
   RENDERIZAÇÃO DA LISTA DE ÁLBUNS
   ───────────────────────────────────────── */
export function renderAlbumsEditor(CONTENT, onEdit, onRemove) {
  const wrap = document.getElementById('albumsEditor');
  if (!wrap) return;

  clearElement(wrap);

  if (!CONTENT.discografia.albums.length) {
    wrap.appendChild(el('p', { class: 'hint', text: 'Nenhum álbum cadastrado.' }));
    return;
  }

  CONTENT.discografia.albums.forEach((al, i) => {
    const box = el('div', { class: 'track-editor' });

    const head = el('div', { class: 'track-head' });
    const strong = el('strong');
    strong.textContent = al.title;
    strong.appendChild(el('span', {
      style: 'color:var(--text-dim);font-weight:400;font-size:0.75rem;',
      text: ` (${al.type})`
    }));

    const actions = el('div');
    actions.appendChild(el('button', {
      class: 'btn btn-ghost btn-sm',
      text: '✏ Editar',
      onclick: () => onEdit(i)
    }));
    actions.appendChild(el('button', {
      class: 'btn btn-ghost btn-sm',
      text: '🗑',
      'aria-label': 'Remover',
      onclick: () => onRemove(i)
    }));

    head.appendChild(strong);
    head.appendChild(actions);

    const meta = el('div', {
      style: 'color:var(--text-dim);font-size:0.8rem;',
      text: `${al.tracks.length} faixa(s) · ${al.year}`
    });

    box.appendChild(head);
    box.appendChild(meta);
    wrap.appendChild(box);
  });
}

/* ─────────────────────────────────────────
   MODAL DE EDIÇÃO DE ÁLBUM
   ───────────────────────────────────────── */
export function openAlbumModal(CONTENT, index, { onSave, compressImage, storeAudioFile, deleteAudioBlob, isUploadedAudio, isAudioFile, formatBytes }) {
  const isNew = index < 0;
  const al = isNew
    ? {
        id: generateId('album'),
        type: 'single',
        title: 'Novo',
        year: new Date().getFullYear(),
        cover: 'NN',
        coverImage: '',
        description: '',
        tracks: []
      }
    : JSON.parse(JSON.stringify(CONTENT.discografia.albums[index]));

  /* ─── Estrutura ─── */
  const root = el('div');

  const h3 = el('h3', { text: isNew ? 'Novo álbum/EP/single' : 'Editar álbum' });

  /* Campos básicos */
  const row1 = el('div', { class: 'form-row' });
  row1.appendChild(field('Título', el('input', { type: 'text', id: 'amTitle', value: al.title })));
  row1.appendChild(field('Tipo', selectType(al.type)));

  const row2 = el('div', { class: 'form-row-3' });
  row2.appendChild(field('Ano', el('input', { type: 'number', id: 'amYear', value: al.year })));
  row2.appendChild(field('Iniciais', el('input', { type: 'text', id: 'amCover', maxlength: '3', value: al.cover })));
  row2.appendChild(field('ID', el('input', { type: 'text', value: al.id, disabled: 'disabled' })));

  const descGroup = field('Descrição',
    el('textarea', { id: 'amDesc', text: al.description })
  );

  const coverGroup = field('URL/caminho da capa',
    el('input', {
      type: 'text',
      id: 'amCoverImage',
      value: al.coverImage,
      placeholder: 'assets/img/... ou https://...'
    })
  );

  const uploadZone = el('div', {
    class: 'upload-zone',
    text: '📁 Ou enviar capa',
    onclick: () => document.getElementById('albumCoverUpload')?.click()
  });

  const coverInput = el('input', {
    type: 'file',
    id: 'albumCoverUpload',
    accept: 'image/*',
    style: 'display:none;'
  });

  const coverPreview = el('div', {
    class: 'admin-img-preview',
    id: 'amCoverPreview'
  });
  updateCoverPreview(coverPreview, al.coverImage);

  /* Faixas */
  const tracksTitle = el('h3', {
    style: 'margin-top:1.5rem;',
    text: 'Faixas'
  });
  const tracksHint = el('span', {
    class: 'hint',
    style: 'font-size:0.7rem;color:var(--text-dim);',
    text: '+ adicione · preço e venda por faixa'
  });
  tracksTitle.appendChild(tracksHint);

  const tracksWrap = el('div', { id: 'amTracks' });

  const addTrackBtn = el('button', {
    class: 'btn btn-outline btn-sm',
    style: 'margin-top:0.5rem;',
    text: '+ Adicionar faixa',
    onclick: () => {
      al.tracks.push({
        title: 'Nova faixa',
        fullAudio: '',
        previewAudio: '',
        previewStart: 0,
        previewDuration: 30,
        duration: '0:00',
        price: CONTENT.loja?.defaultPrice ?? 4.90,
        forSale: true
      });
      renderTracks();
    }
  });

  /* Ações */
  const actions = el('div', {
    style: 'display:flex;gap:0.7rem;margin-top:1.5rem;justify-content:flex-end;'
  });
  actions.appendChild(el('button', {
    class: 'btn btn-outline btn-sm',
    text: 'Cancelar',
    onclick: closeModal
  }));
  actions.appendChild(el('button', {
    class: 'btn btn-primary btn-sm',
    text: 'Salvar álbum',
    onclick: saveAlbum
  }));

  /* ─── Montagem ─── */
  root.appendChild(h3);
  root.appendChild(row1);
  root.appendChild(row2);
  root.appendChild(descGroup);
  root.appendChild(coverGroup);
  root.appendChild(uploadZone);
  root.appendChild(coverInput);
  root.appendChild(coverPreview);
  root.appendChild(tracksTitle);
  root.appendChild(tracksWrap);
  root.appendChild(addTrackBtn);
  root.appendChild(actions);

  openModal(root);

  /* ─── Lógica de faixas ─── */
  function renderTracks() {
    clearElement(tracksWrap);
    al.tracks.forEach((t, ti) => {
      tracksWrap.appendChild(renderTrackEditor(t, ti));
    });
  }

  function renderTrackEditor(t, ti) {
    const box = el('div', { class: 'track-editor' });

    /* Head */
    const head = el('div', { class: 'track-head' });
    head.appendChild(el('strong', { text: `Faixa ${ti + 1}: ${t.title}` }));
    head.appendChild(el('button', {
      class: 'btn btn-ghost btn-sm',
      text: '🗑',
      'aria-label': 'Remover',
      onclick: () => {
        cleanupTrackAudio(t);
        al.tracks.splice(ti, 1);
        renderTracks();
      }
    }));

    /* Título + Duração */
    const row = el('div', { class: 'form-row' });
    row.appendChild(field('Título', el('input', {
      type: 'text',
      value: t.title,
      oninput: (e) => { t.title = e.target.value; }
    })));
    row.appendChild(field('Duração', el('input', {
      type: 'text',
      value: t.duration || '',
      oninput: (e) => { t.duration = e.target.value; }
    })));

    /* Letra */
    const lyricsGroup = field('Letra sincronizada (mm:ss|texto)',
      el('textarea', {
        rows: '4',
        placeholder: '0:12|Primeira linha da letra',
        text: lyricsToText(t.lyrics),
        oninput: (e) => { t.lyrics = textToLyrics(e.target.value); }
      })
    );

    /* Áudio completo */
    const fullGroup = renderAudioField(t, 'fullAudio', 'Faixa completa', ti);

    /* Prévia */
    const previewGroup = renderAudioField(t, 'previewAudio', 'Prévia dedicada (opcional)', ti);

    /* Config prévia */
    const prevRow = el('div', { class: 'form-row' });
    prevRow.appendChild(field('Início da prévia (s)', el('input', {
      type: 'number',
      min: '0',
      value: parseInt(t.previewStart) || 0,
      oninput: (e) => { t.previewStart = parseInt(e.target.value) || 0; }
    })));
    prevRow.appendChild(field('Duração da prévia (s)', el('input', {
      type: 'number',
      min: '5',
      max: '120',
      value: parseInt(t.previewDuration) || 30,
      oninput: (e) => { t.previewDuration = parseInt(e.target.value) || 30; }
    })));

    /* Preço + Venda */
    const priceRow = el('div', { class: 'form-row' });
    priceRow.appendChild(field('Preço (R$)', el('input', {
      type: 'number',
      step: '0.01',
      min: '0',
      value: t.price != null ? t.price : (CONTENT.loja?.defaultPrice ?? 4.90),
      oninput: (e) => { t.price = parseFloat(e.target.value) || 0; }
    })));
    priceRow.appendChild(field('Vender individualmente?', selectBool(t.forSale !== false, (v) => { t.forSale = v; })));

    box.appendChild(head);
    box.appendChild(row);
    box.appendChild(lyricsGroup);
    box.appendChild(fullGroup);
    box.appendChild(previewGroup);
    box.appendChild(prevRow);
    box.appendChild(priceRow);

    return box;
  }

  function renderAudioField(track, key, label, ti) {
    const group = el('div', { class: 'form-group' });
    group.appendChild(el('label', { text: label }));

    const input = el('input', {
      type: 'text',
      value: track[key] || '',
      placeholder: 'https://... ou envie abaixo',
      oninput: (e) => { track[key] = e.target.value; }
    });

    const chipRow = el('div', {
      style: 'display:flex;gap:0.5rem;align-items:center;margin-top:0.4rem;flex-wrap:wrap;'
    });

    const uploadBtn = el('button', {
      type: 'button',
      class: 'btn btn-ghost btn-sm',
      text: '📁 Enviar áudio',
      onclick: () => document.getElementById(`up_${key}_${ti}`)?.click()
    });

    const fileInput = el('input', {
      type: 'file',
      id: `up_${key}_${ti}`,
      accept: 'audio/*',
      style: 'display:none;'
    });

    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!isAudioFile(file)) {
        toast('Formato não reconhecido como áudio.', '⚠');
        e.target.value = '';
        return;
      }

      if (file.size > 80 * 1024 * 1024) {
        toast('Arquivo muito grande (máx. 80MB).', '⚠');
        e.target.value = '';
        return;
      }

      try {
        toast('Salvando áudio...', '🎵');
        const ref = await storeAudioFile(file);
        const old = track[key];
        if (isUploadedAudio(old)) {
          deleteAudioBlob(old.slice(6)).catch(() => {});
        }
        track[key] = ref;
        renderTracks();
        toast(`Áudio enviado (${formatBytes(file.size)}).`, '✓');
      } catch (err) {
        console.error(err);
        toast('Erro ao salvar áudio.', '⚠');
      }
      e.target.value = '';
    });

    chipRow.appendChild(uploadBtn);
    if (isUploadedAudio(track[key])) {
      chipRow.appendChild(el('button', {
        type: 'button',
        class: 'btn btn-ghost btn-sm',
        style: 'color:var(--danger);',
        text: '🗑 Remover upload',
        onclick: () => {
          const old = track[key];
          if (isUploadedAudio(old)) deleteAudioBlob(old.slice(6)).catch(() => {});
          track[key] = '';
          renderTracks();
        }
      }));
    }
    chipRow.appendChild(audioChip(track[key], isUploadedAudio));

    group.appendChild(input);
    group.appendChild(chipRow);
    group.appendChild(fileInput);
    return group;
  }

  function saveAlbum() {
    al.title = document.getElementById('amTitle').value.trim();
    if (!al.title) {
      toast('Título é obrigatório.', '⚠');
      return;
    }

    al.type = document.getElementById('amType').value;
    al.year = parseInt(document.getElementById('amYear').value) || new Date().getFullYear();
    al.cover = document.getElementById('amCover').value || 'NN';
    al.description = document.getElementById('amDesc').value;
    al.coverImage = document.getElementById('amCoverImage').value || al.coverImage;

    if (isNew) CONTENT.discografia.albums.push(al);
    else CONTENT.discografia.albums[index] = al;

    onSave(al);
    closeModal();
    toast('Álbum salvo.', '💿');
  }

  renderTracks();
}

/* ─── Helpers internos ─── */
function field(label, input) {
  const g = el('div', { class: 'form-group' });
  g.appendChild(el('label', { text: label }));
  g.appendChild(input);
  return g;
}

function selectType(current) {
  const sel = el('select', { id: 'amType' });
  [['album', 'Álbum'], ['ep', 'EP'], ['single', 'Single']].forEach(([v, l]) => {
    const opt = el('option', { value: v, text: l });
    if (v === current) opt.selected = true;
    sel.appendChild(opt);
  });
  return sel;
}

function selectBool(current, onChange) {
  const sel = el('select');
  sel.appendChild(el('option', { value: 'true', text: 'Sim' }));
  sel.appendChild(el('option', { value: 'false', text: 'Não' }));
  sel.value = current ? 'true' : 'false';
  sel.addEventListener('change', () => onChange(sel.value === 'true'));
  return sel;
}

function updateCoverPreview(node, url) {
  const safe = escCssUrl(url);
  if (safe) {
    node.style.backgroundImage = `url("${safe}")`;
    node.textContent = '';
  } else {
    node.style.backgroundImage = '';
    node.textContent = 'Sem capa';
  }
}

function lyricsToText(lyrics) {
  return (Array.isArray(lyrics) ? lyrics : []).map((line) => {
    const s = Number(line.time) || 0;
    const m = Math.floor(s / 60);
    const r = Math.floor(s % 60);
    return `${m}:${String(r).padStart(2, '0')}|${line.text || ''}`;
  }).join('\n');
}

function textToLyrics(value) {
  return String(value || '').split('\n').map((line) => {
    const parts = line.split('|');
    if (parts.length < 2) return null;
    const stamp = parts.shift().trim().split(':');
    const time = stamp.length === 2
      ? Number(stamp[0]) * 60 + Number(stamp[1])
      : Number(stamp[0]);
    const text = parts.join('|').trim();
    return Number.isFinite(time) && time >= 0 && text ? { time, text } : null;
  }).filter(Boolean).sort((a, b) => a.time - b.time);
}

function audioChip(url, isUploadedAudio) {
  if (isUploadedAudio(url)) return el('span', { class: 'audio-chip', text: '🎵 Upload no dispositivo' });
  if (url && String(url).trim()) return el('span', { class: 'audio-chip remote', text: '🔗 URL externa' });
  return el('span', { class: 'audio-chip none', text: '⚠ sem áudio' });
}

function cleanupTrackAudio(track) {
  if (!track) return;
  // Delegação: onSave cuida de limpar blobs órfãos
}
