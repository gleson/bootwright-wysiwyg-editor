import { el, icon, clear } from '../utils/dom.js';

/**
 * AssetLibrary — biblioteca de mídia reutilizável (imagens, vídeos, áudios).
 *
 * Client-side por padrão: reúne tudo que foi enviado pelos controles `file`
 * (Image, Card, Audio, Video) e persiste a lista no localStorage para reuso
 * entre sessões. Data URLs ficam só em memória — estouram a quota se gravadas.
 *
 * Se `editor.config.assetsUrl` estiver configurado, `fetchRemote()` busca a
 * lista de assets já hospedados no Django e mescla ao grid.
 *
 * Não tem `mount()` — é instanciado no `_mountUI` do Editor e usado sob demanda
 * (o `open()` cria/descarta um <dialog> a cada chamada, como o ExportDialog).
 */
export class AssetLibrary {
  constructor(editor) {
    this.editor = editor;
    // Sem autoSaveKey explícito (modo strict), reutiliza apenas chave de
    // assets genérica. Os assets locais não são sensíveis o suficiente para
    // exigir scope obrigatório como o auto-save da página.
    const ns = editor.config.autoSaveKey ?? 'editor';
    this.storageKey = `${ns}:assets`;
    this.assets = [];          // { url, name, kind, addedAt, persistent }
    this._remoteLoaded = false;
    this._load();
  }

  /* ---------- persistência local ---------- */

  _load() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) this.assets = JSON.parse(raw).filter((a) => a && a.url);
    } catch (err) {
      console.warn('[AssetLibrary] falha ao ler localStorage:', err);
    }
  }

  _persist() {
    // Data URLs não vão para o localStorage — uma única imagem estoura a quota.
    const persistable = this.assets.filter((a) => a.persistent !== false);
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(persistable));
    } catch (err) {
      console.warn('[AssetLibrary] falha ao persistir (quota?):', err);
    }
  }

  /* ---------- modelo ---------- */

  /** Deduz 'image' | 'video' | 'audio' a partir de mime, accept ou URL. */
  static kindOf(hint = '') {
    const s = String(hint).toLowerCase();
    if (s.startsWith('data:video') || s.includes('video') || /\.(mp4|webm|ogv|mov)(\?|#|$)/.test(s)) return 'video';
    if (s.startsWith('data:audio') || s.includes('audio') || /\.(mp3|wav|ogg|m4a|aac)(\?|#|$)/.test(s)) return 'audio';
    return 'image'; // tipo mais comum no editor — default seguro
  }

  _nameFromUrl(url) {
    if (url.startsWith('data:')) return 'arquivo embutido';
    try {
      const path = new URL(url, location.href).pathname;
      return decodeURIComponent(path.split('/').pop()) || url;
    } catch {
      return url.split('/').pop() || url;
    }
  }

  /**
   * Registra um asset (idempotente por URL). meta: { name, kind, persistent }.
   * Retorna o registro (novo ou já existente).
   */
  register(url, meta = {}) {
    if (!url) return null;
    const existing = this.assets.find((a) => a.url === url);
    if (existing) return existing;

    const entry = {
      url,
      name: meta.name || this._nameFromUrl(url),
      kind: meta.kind || AssetLibrary.kindOf(meta.name || url),
      addedAt: Date.now(),
      persistent: meta.persistent ?? !url.startsWith('data:'),
    };
    this.assets.unshift(entry);
    this._persist();
    this.editor.bus.emit('assets:changed', { count: this.assets.length });
    return entry;
  }

  remove(url) {
    const before = this.assets.length;
    this.assets = this.assets.filter((a) => a.url !== url);
    if (this.assets.length !== before) {
      this._persist();
      this.editor.bus.emit('assets:changed', { count: this.assets.length });
    }
  }

  /* ---------- remoto (Django opcional) ---------- */

  /**
   * Busca a lista de assets do `config.assetsUrl`, se houver. Resposta aceita:
   * um array, ou `{ results: [...] }` / `{ assets: [...] }`. Cada item pode ser
   * uma string (a URL) ou `{ url, name?, kind? }`.
   */
  async fetchRemote({ force = false } = {}) {
    const url = this.editor.config.assetsUrl;
    if (!url || (this._remoteLoaded && !force)) return;
    try {
      const assetsT = this.editor.transportFor?.('assets') ?? {};
      const res = await this.editor.fetch(url, {
        method: assetsT.method || 'GET',
        headers: { Accept: 'application/json', ...(assetsT.headers || {}) },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list = assetsT.parser
        ? assetsT.parser(data)
        : (Array.isArray(data) ? data : (data.results ?? data.assets ?? []));
      for (const item of list) {
        if (typeof item === 'string') {
          this.register(item, { persistent: true });
        } else if (item?.url) {
          this.register(item.url, { name: item.name, kind: item.kind, persistent: true });
        }
      }
      this._remoteLoaded = true;
    } catch (err) {
      console.warn('[AssetLibrary] fetchRemote falhou:', err);
      this.editor.notify?.toast?.(
        `Não foi possível carregar a biblioteca remota: ${err.message}`, 'warning');
    }
  }

  /* ---------- upload ---------- */

  /**
   * Envia um arquivo. Com `config.uploadUrl`: POST multipart + X-CSRFToken,
   * esperando JSON `{ url }` (ou `.location`). Sem ele: lê como data URL.
   * Registra o resultado e devolve o registro. Lança em caso de falha de rede.
   */
  async uploadFile(file) {
    const cfg = this.editor.config;
    // SVG inline pode conter <script> — rejeitamos por padrão. Habilite com
    // `new Editor({ allowSvg: true })` se a fonte for confiável.
    if (!cfg.allowSvg && /svg(\+xml)?$/i.test(file.type || '')) {
      throw new Error(
        'SVG bloqueado por segurança (pode conter scripts). ' +
        'Habilite com `new Editor({ allowSvg: true })` se a fonte for confiável.'
      );
    }
    let url;

    if (cfg.uploadUrl) {
      const uploadT = this.editor.transportFor('upload');
      const fd = new FormData();
      fd.append(uploadT.field || 'file', file);
      const res = await this.editor.fetch(cfg.uploadUrl, {
        method: uploadT.method,
        body: fd,
        headers: { ...this.editor.csrfHeaders(), ...uploadT.headers },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      url = uploadT.parser ? uploadT.parser(data) : (data?.url ?? data?.location);
      if (!url) throw new Error('resposta sem .url');
    } else {
      url = await this._readAsDataUrl(file);
    }

    return this.register(url, {
      name: file.name,
      kind: AssetLibrary.kindOf(file.type || file.name),
    });
  }

  _readAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('leitura do arquivo falhou'));
      reader.readAsDataURL(file);
    });
  }

  /* ---------- UI ---------- */

  /**
   * Abre o modal da biblioteca.
   *   accept — atributo `accept` do controle de origem; filtra o grid por tipo.
   *   onPick(url, entry) — chamado ao escolher um asset; o modal fecha em seguida.
   */
  open({ accept = '', onPick } = {}) {
    const filterKind = AssetLibrary._kindFromAccept(accept);

    const dialog = el('dialog', { class: 'editor-asset-dialog' });
    const grid = el('div', { class: 'editor-asset-dialog__grid' });

    const renderGrid = () => {
      clear(grid);
      const items = filterKind
        ? this.assets.filter((a) => a.kind === filterKind)
        : this.assets;
      if (!items.length) {
        grid.appendChild(el('p', { class: 'editor-asset-dialog__empty text-muted small' },
          'Nenhum asset ainda. Envie um arquivo para começar a reutilizá-lo.'));
        return;
      }
      for (const asset of items) {
        grid.appendChild(this._tile(asset, dialog, onPick, renderGrid));
      }
    };

    // Upload local — input escondido acionado pelo botão.
    const fileInput = el('input', { type: 'file', class: 'd-none', accept });
    const uploadBtn = el('button', { type: 'button', class: 'btn btn-sm btn-primary' },
      [icon('upload'), ' Enviar arquivo']);
    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      fileInput.value = '';
      if (!file) return;
      const iconEl = uploadBtn.querySelector('i');
      uploadBtn.disabled = true;
      iconEl.className = 'bi bi-hourglass-split';
      try {
        await this.uploadFile(file);
        renderGrid();
      } catch (err) {
        console.error('[AssetLibrary] upload falhou:', err);
        this.editor.notify?.toast?.(`Upload falhou: ${err.message}`, 'error');
      } finally {
        uploadBtn.disabled = false;
        iconEl.className = 'bi bi-upload';
      }
    });

    const closeBtn = el('button', { type: 'button', class: 'btn btn-sm btn-outline-secondary' },
      [icon('x-lg'), ' Fechar']);
    closeBtn.addEventListener('click', () => dialog.close());

    dialog.append(
      el('div', { class: 'editor-asset-dialog__header' }, [
        el('h5', { class: 'mb-0' }, [icon('images'), ' Biblioteca de assets']),
        el('div', { class: 'd-flex gap-2' }, [uploadBtn, closeBtn]),
      ]),
      grid,
      fileInput,
    );

    document.body.appendChild(dialog);
    dialog.addEventListener('close', () => dialog.remove());
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });

    renderGrid();
    // Mescla a lista remota (se configurada) e re-renderiza ao chegar.
    if (this.editor.config.assetsUrl) {
      this.fetchRemote().then(renderGrid);
    }
    dialog.showModal();
  }

  static _kindFromAccept(accept) {
    const s = String(accept).toLowerCase();
    if (s.includes('video')) return 'video';
    if (s.includes('audio')) return 'audio';
    if (s.includes('image')) return 'image';
    return null; // sem filtro — mostra tudo
  }

  _tile(asset, dialog, onPick, refresh) {
    const tile = el('div', {
      class: 'editor-asset-tile',
      dataset: { kind: asset.kind },
      title: asset.name,
    });

    const preview = asset.kind === 'image'
      ? el('img', { src: asset.url, alt: asset.name, loading: 'lazy' })
      : el('div', { class: 'editor-asset-tile__icon' },
          [icon(asset.kind === 'video' ? 'film' : 'music-note-beamed')]);

    const pick = el('button', {
      type: 'button',
      class: 'editor-asset-tile__pick',
      'aria-label': `Usar ${asset.name}`,
    }, [preview]);
    pick.addEventListener('click', () => {
      onPick?.(asset.url, asset);
      dialog.close();
    });

    const del = el('button', {
      type: 'button',
      class: 'editor-asset-tile__del',
      title: 'Remover da biblioteca',
      'aria-label': `Remover ${asset.name} da biblioteca`,
    }, [icon('trash')]);
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      this.remove(asset.url);
      refresh();
    });

    tile.append(
      pick,
      el('div', { class: 'editor-asset-tile__meta' }, [
        el('span', { class: 'editor-asset-tile__name' }, asset.name),
        del,
      ]),
    );
    return tile;
  }
}
