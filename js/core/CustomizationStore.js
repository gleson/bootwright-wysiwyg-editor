import { generateId } from '../utils/id.js';

/**
 * CustomizationStore — persistência de customizações do projeto:
 *   - CSS personalizado (string única)
 *   - Blocos personalizados (snippets HTML reutilizáveis)
 *   - Templates (subárvores JSON nomeadas)
 *   - Paleta de cores (cores rápidas para o color picker)
 *   - Gradientes (presets que substituem/somam aos built-in)
 *   - Fontes (font-family stacks adicionais para a tipografia)
 *
 * Tudo em localStorage sob uma chave única (versionada). Emite eventos via bus
 * para que UI/Renderer reajam (sidebar repopula, &lt;style&gt; do canvas atualiza,
 * datalist de classes recarrega).
 *
 * Eventos:
 *   - css:changed         → { css }
 *   - customblocks:changed → { blocks }
 *   - templates:changed    → { templates }
 *   - palette:changed      → { palette }
 *   - gradients:changed    → { gradients }
 *   - fonts:changed        → { fonts }
 *   - customizations:imported → { all }
 */
const STORAGE_KEY = 'editor:customizations:v1';

export class CustomizationStore {
  constructor(bus) {
    if (!bus) throw new Error('[CustomizationStore] bus é obrigatório.');
    this.bus = bus;
    this.data = {
      css: '', blocks: [], templates: [],
      palette: [], gradients: [], fonts: [],
      components: [], theme: {},
    };
    this._load();
  }

  /* ---------- Tema (cores Bootstrap) ---------- */

  /** Mapa de overrides `{ primary: '#...', ... }` (só cores alteradas). */
  getTheme() { return { ...(this.data.theme ?? {}) }; }

  /** Define/limpa uma cor de tema. `value` vazio remove o override. */
  setThemeColor(name, value) {
    if (!name) return;
    if (!this.data.theme) this.data.theme = {};
    const v = String(value ?? '').trim();
    if (v) this.data.theme[name] = v;
    else delete this.data.theme[name];
    this._persist();
    this.bus.emit('theme:changed', { theme: this.getTheme() });
  }

  /** Substitui o mapa inteiro de cores de tema. */
  setTheme(map) {
    this.data.theme = {};
    for (const [k, v] of Object.entries(map ?? {})) {
      const val = String(v ?? '').trim();
      if (val) this.data.theme[k] = val;
    }
    this._persist();
    this.bus.emit('theme:changed', { theme: this.getTheme() });
  }

  /** Remove todos os overrides — volta ao tema padrão do Bootstrap. */
  resetTheme() {
    this.data.theme = {};
    this._persist();
    this.bus.emit('theme:changed', { theme: {} });
  }

  /* ---------- CSS ---------- */

  getCSS() { return this.data.css ?? ''; }

  setCSS(css) {
    this.data.css = String(css ?? '');
    this._persist();
    this.bus.emit('css:changed', { css: this.data.css });
  }

  /**
   * Extrai nomes de classes (.foo, .bar-baz) do CSS atual.
   * Ignora pseudo-classes/elementos. Retorna array único e ordenado.
   */
  extractClassNames() {
    const css = this.data.css ?? '';
    if (!css.trim()) return [];
    const re = /\.([a-zA-Z_][\w-]*)/g;
    const set = new Set();
    let m;
    while ((m = re.exec(css)) !== null) set.add(m[1]);
    return [...set].sort((a, b) => a.localeCompare(b));
  }

  /* ---------- Blocos personalizados (snippets) ---------- */

  listBlocks() { return [...this.data.blocks]; }

  getBlock(id) { return this.data.blocks.find((b) => b.id === id) ?? null; }

  /**
   * meta = { name, icon?, html, category? }
   * Gera id único e type 'snippet:&lt;id-curto&gt;'.
   */
  addBlock(meta) {
    const id = generateId();
    const block = {
      id,
      type: 'snippet:' + id.slice(0, 8),
      name: String(meta.name ?? 'Sem nome').trim() || 'Sem nome',
      icon: meta.icon ?? 'puzzle',
      html: String(meta.html ?? ''),
      category: 'custom',
      createdAt: new Date().toISOString(),
    };
    this.data.blocks.push(block);
    this._persist();
    this.bus.emit('customblocks:changed', { blocks: this.listBlocks() });
    return block;
  }

  updateBlock(id, patch) {
    const block = this.getBlock(id);
    if (!block) return null;
    if (patch.name !== undefined) block.name = String(patch.name).trim() || block.name;
    if (patch.icon !== undefined) block.icon = patch.icon || 'puzzle';
    if (patch.html !== undefined) block.html = String(patch.html);
    this._persist();
    this.bus.emit('customblocks:changed', { blocks: this.listBlocks() });
    return block;
  }

  removeBlock(id) {
    const i = this.data.blocks.findIndex((b) => b.id === id);
    if (i < 0) return false;
    this.data.blocks.splice(i, 1);
    this._persist();
    this.bus.emit('customblocks:changed', { blocks: this.listBlocks() });
    return true;
  }

  /* ---------- Templates ---------- */

  listTemplates() { return [...this.data.templates]; }

  getTemplate(id) { return this.data.templates.find((t) => t.id === id) ?? null; }

  /**
   * meta = { name, icon?, tree?, nodes? }
   *   - `tree`  → template de bloco (uma única subárvore)
   *   - `nodes` → template de página (array de subárvores; insere todas no destino)
   * IDs são removidos para que createNode regere novos ao inserir.
   */
  addTemplate(meta) {
    const isPage = Array.isArray(meta.nodes);
    const tpl = {
      id: generateId(),
      name: String(meta.name ?? 'Template').trim() || 'Template',
      icon: meta.icon ?? (isPage ? 'file-earmark-richtext' : 'bookmark'),
      kind: isPage ? 'page' : 'block',
      createdAt: new Date().toISOString(),
    };
    if (isPage) {
      tpl.nodes = meta.nodes.map((n) => this._stripIds(n));
    } else {
      tpl.tree = this._stripIds(meta.tree);
    }
    this.data.templates.push(tpl);
    this._persist();
    this.bus.emit('templates:changed', { templates: this.listTemplates() });
    return tpl;
  }

  removeTemplate(id) {
    const i = this.data.templates.findIndex((t) => t.id === id);
    if (i < 0) return false;
    this.data.templates.splice(i, 1);
    this._persist();
    this.bus.emit('templates:changed', { templates: this.listTemplates() });
    return true;
  }

  /**
   * Atualiza um template. patch aceita:
   *   - name, icon: metadata.
   *   - tree:  substitui árvore (template de bloco). Strip de IDs.
   *   - nodes: substitui array (template de página). Strip de IDs em cada nó.
   *
   * Ao trocar tree↔nodes, ajusta `kind` automaticamente.
   */
  updateTemplate(id, patch = {}) {
    const tpl = this.getTemplate(id);
    if (!tpl) return null;
    if (patch.name !== undefined) tpl.name = String(patch.name).trim() || tpl.name;
    if (patch.icon !== undefined) tpl.icon = patch.icon || tpl.icon;
    if (patch.tree !== undefined && patch.tree !== null) {
      tpl.tree = this._stripIds(patch.tree);
      tpl.kind = 'block';
      delete tpl.nodes;
    }
    if (patch.nodes !== undefined && patch.nodes !== null) {
      tpl.nodes = patch.nodes.map((n) => this._stripIds(n));
      tpl.kind = 'page';
      delete tpl.tree;
    }
    this._persist();
    this.bus.emit('templates:changed', { templates: this.listTemplates() });
    return tpl;
  }

  _stripIds(node) {
    if (!node || typeof node !== 'object') return node;
    const { id, ...rest } = node;
    return {
      ...rest,
      props: { ...(node.props ?? {}) },
      classes: [...(node.classes ?? [])],
      attrs: { ...(node.attrs ?? {}) },
      children: (node.children ?? []).map((c) => this._stripIds(c)),
    };
  }

  /* ---------- Componentes (master tree sincronizada) ---------- */

  listComponents() { return [...this.data.components]; }
  getComponent(id) { return this.data.components.find((c) => c.id === id) ?? null; }

  /**
   * meta = { name, icon?, tree }   tree = nó-raiz do componente.
   * IDs do tree são removidos (createNode regera ao instanciar).
   */
  addComponent(meta) {
    const id = generateId();
    const item = {
      id,
      type: 'component:' + id.slice(0, 8),
      name: String(meta.name ?? 'Componente').trim() || 'Componente',
      icon: meta.icon ?? 'box-seam',
      tree: this._stripIds(meta.tree),
      createdAt: new Date().toISOString(),
    };
    this.data.components.push(item);
    this._persist();
    this.bus.emit('components:changed', { components: this.listComponents() });
    return item;
  }

  updateComponent(id, patch = {}) {
    const c = this.getComponent(id);
    if (!c) return null;
    if (patch.name !== undefined) c.name = String(patch.name).trim() || c.name;
    if (patch.icon !== undefined) c.icon = patch.icon || c.icon;
    if (patch.tree !== undefined && patch.tree !== null) {
      c.tree = this._stripIds(patch.tree);
    }
    this._persist();
    this.bus.emit('components:changed', { components: this.listComponents() });
    return c;
  }

  removeComponent(id) {
    const i = this.data.components.findIndex((c) => c.id === id);
    if (i < 0) return false;
    this.data.components.splice(i, 1);
    this._persist();
    this.bus.emit('components:changed', { components: this.listComponents() });
    return true;
  }

  /* ---------- Paleta de cores ---------- */

  listPalette() { return [...this.data.palette]; }
  getPaletteColor(id) { return this.data.palette.find((c) => c.id === id) ?? null; }

  /** meta = { label, value }   (value = '#rrggbb' | 'rgba(...)') */
  addPaletteColor(meta) {
    const item = {
      id: generateId(),
      label: String(meta.label ?? '').trim() || 'Cor',
      value: String(meta.value ?? '#000000').trim(),
      createdAt: new Date().toISOString(),
    };
    this.data.palette.push(item);
    this._persist();
    this.bus.emit('palette:changed', { palette: this.listPalette() });
    return item;
  }

  updatePaletteColor(id, patch) {
    const c = this.getPaletteColor(id);
    if (!c) return null;
    if (patch.label !== undefined) c.label = String(patch.label).trim() || c.label;
    if (patch.value !== undefined) c.value = String(patch.value).trim() || c.value;
    this._persist();
    this.bus.emit('palette:changed', { palette: this.listPalette() });
    return c;
  }

  removePaletteColor(id) {
    const i = this.data.palette.findIndex((c) => c.id === id);
    if (i < 0) return false;
    this.data.palette.splice(i, 1);
    this._persist();
    this.bus.emit('palette:changed', { palette: this.listPalette() });
    return true;
  }

  /* ---------- Gradientes personalizados ---------- */

  listGradients() { return [...this.data.gradients]; }
  getGradient(id) { return this.data.gradients.find((g) => g.id === id) ?? null; }

  /** meta = { label, css }   (css = string CSS, ex.: 'linear-gradient(...)') */
  addGradient(meta) {
    const item = {
      id: generateId(),
      label: String(meta.label ?? '').trim() || 'Gradiente',
      css: String(meta.css ?? '').trim(),
      createdAt: new Date().toISOString(),
    };
    this.data.gradients.push(item);
    this._persist();
    this.bus.emit('gradients:changed', { gradients: this.listGradients() });
    return item;
  }

  updateGradient(id, patch) {
    const g = this.getGradient(id);
    if (!g) return null;
    if (patch.label !== undefined) g.label = String(patch.label).trim() || g.label;
    if (patch.css   !== undefined) g.css   = String(patch.css).trim()   || g.css;
    this._persist();
    this.bus.emit('gradients:changed', { gradients: this.listGradients() });
    return g;
  }

  removeGradient(id) {
    const i = this.data.gradients.findIndex((g) => g.id === id);
    if (i < 0) return false;
    this.data.gradients.splice(i, 1);
    this._persist();
    this.bus.emit('gradients:changed', { gradients: this.listGradients() });
    return true;
  }

  /* ---------- Fontes personalizadas ---------- */

  listFonts() { return [...this.data.fonts]; }
  getFont(id) { return this.data.fonts.find((f) => f.id === id) ?? null; }

  /**
   * meta = { label, stack, googleUrl? }
   *   - stack: font-family CSS value
   *   - googleUrl (opcional): URL do Google Fonts a ser injetada via <link>
   *     no editor e nos exports. Sem googleUrl, a fonte é "personalizada"
   *     (usuário cuida do @font-face / <link> manualmente).
   */
  addFont(meta) {
    const item = {
      id: generateId(),
      label: String(meta.label ?? '').trim() || 'Fonte',
      stack: String(meta.stack ?? '').trim(),
      googleUrl: meta.googleUrl ? String(meta.googleUrl).trim() : '',
      createdAt: new Date().toISOString(),
    };
    this.data.fonts.push(item);
    this._persist();
    this.bus.emit('fonts:changed', { fonts: this.listFonts() });
    return item;
  }

  updateFont(id, patch) {
    const f = this.getFont(id);
    if (!f) return null;
    if (patch.label !== undefined) f.label = String(patch.label).trim() || f.label;
    if (patch.stack !== undefined) f.stack = String(patch.stack).trim() || f.stack;
    if (patch.googleUrl !== undefined) f.googleUrl = patch.googleUrl ? String(patch.googleUrl).trim() : '';
    this._persist();
    this.bus.emit('fonts:changed', { fonts: this.listFonts() });
    return f;
  }

  /** URLs únicas do Google Fonts coletadas das fontes registradas. */
  listFontUrls() {
    const seen = new Set();
    const out = [];
    for (const f of this.data.fonts) {
      const u = (f.googleUrl || '').trim();
      if (!u) continue;
      if (seen.has(u)) continue;
      seen.add(u);
      out.push(u);
    }
    return out;
  }

  removeFont(id) {
    const i = this.data.fonts.findIndex((f) => f.id === id);
    if (i < 0) return false;
    this.data.fonts.splice(i, 1);
    this._persist();
    this.bus.emit('fonts:changed', { fonts: this.listFonts() });
    return true;
  }

  /* ---------- Export / Import ---------- */

  exportAll() {
    return JSON.parse(JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      ...this.data,
    }));
  }

  importAll(payload, opts = {}) {
    if (!payload || typeof payload !== 'object') {
      throw new Error('[CustomizationStore] importAll: payload inválido.');
    }
    const merge = opts.merge === true;
    const incoming = {
      css: typeof payload.css === 'string' ? payload.css : '',
      blocks:     Array.isArray(payload.blocks)     ? payload.blocks     : [],
      templates:  Array.isArray(payload.templates)  ? payload.templates  : [],
      palette:    Array.isArray(payload.palette)    ? payload.palette    : [],
      gradients:  Array.isArray(payload.gradients)  ? payload.gradients  : [],
      fonts:      Array.isArray(payload.fonts)      ? payload.fonts      : [],
      components: Array.isArray(payload.components) ? payload.components : [],
      theme: (payload.theme && typeof payload.theme === 'object') ? payload.theme : {},
    };

    if (merge) {
      this.data.css = (this.data.css || '') + (incoming.css ? '\n\n' + incoming.css : '');
      for (const b of incoming.blocks)     this.data.blocks.push(this._sanitizeBlock(b));
      for (const t of incoming.templates)  this.data.templates.push(this._sanitizeTemplate(t));
      for (const p of incoming.palette)    this.data.palette.push(this._sanitizePaletteColor(p));
      for (const g of incoming.gradients)  this.data.gradients.push(this._sanitizeGradient(g));
      for (const f of incoming.fonts)      this.data.fonts.push(this._sanitizeFont(f));
      for (const c of incoming.components) this.data.components.push(this._sanitizeComponent(c));
      this.data.theme = { ...(this.data.theme ?? {}), ...this._sanitizeTheme(incoming.theme) };
    } else {
      this.data.css        = incoming.css;
      this.data.blocks     = incoming.blocks.map((b)     => this._sanitizeBlock(b));
      this.data.templates  = incoming.templates.map((t)  => this._sanitizeTemplate(t));
      this.data.palette    = incoming.palette.map((p)    => this._sanitizePaletteColor(p));
      this.data.gradients  = incoming.gradients.map((g)  => this._sanitizeGradient(g));
      this.data.fonts      = incoming.fonts.map((f)      => this._sanitizeFont(f));
      this.data.components = incoming.components.map((c) => this._sanitizeComponent(c));
      this.data.theme      = this._sanitizeTheme(incoming.theme);
    }
    this._persist();
    this.bus.emit('css:changed', { css: this.data.css });
    this.bus.emit('theme:changed', { theme: this.getTheme() });
    this.bus.emit('customblocks:changed', { blocks: this.listBlocks() });
    this.bus.emit('templates:changed', { templates: this.listTemplates() });
    this.bus.emit('palette:changed',   { palette:   this.listPalette() });
    this.bus.emit('gradients:changed', { gradients: this.listGradients() });
    this.bus.emit('fonts:changed',     { fonts:     this.listFonts() });
    this.bus.emit('components:changed', { components: this.listComponents() });
    this.bus.emit('customizations:imported', { all: this.exportAll() });
  }

  _sanitizeComponent(c) {
    const id = c.id || generateId();
    return {
      id,
      type: c.type || 'component:' + id.slice(0, 8),
      name: String(c.name ?? 'Componente').trim() || 'Componente',
      icon: c.icon || 'box-seam',
      tree: this._stripIds(c.tree ?? { type: 'section', children: [] }),
      createdAt: c.createdAt || new Date().toISOString(),
    };
  }

  /** Mantém só pares chave→string de cor (hex/rgb). Descarta valores vazios. */
  _sanitizeTheme(theme) {
    const out = {};
    for (const [k, v] of Object.entries(theme ?? {})) {
      const val = String(v ?? '').trim();
      if (val) out[k] = val;
    }
    return out;
  }

  _sanitizePaletteColor(c) {
    return {
      id: c.id || generateId(),
      label: String(c.label ?? 'Cor').trim() || 'Cor',
      value: String(c.value ?? '#000000').trim() || '#000000',
      createdAt: c.createdAt || new Date().toISOString(),
    };
  }
  _sanitizeGradient(g) {
    return {
      id: g.id || generateId(),
      label: String(g.label ?? 'Gradiente').trim() || 'Gradiente',
      css:   String(g.css   ?? '').trim(),
      createdAt: g.createdAt || new Date().toISOString(),
    };
  }
  _sanitizeFont(f) {
    return {
      id: f.id || generateId(),
      label: String(f.label ?? 'Fonte').trim() || 'Fonte',
      stack: String(f.stack ?? '').trim(),
      googleUrl: f.googleUrl ? String(f.googleUrl).trim() : '',
      createdAt: f.createdAt || new Date().toISOString(),
    };
  }

  _sanitizeBlock(b) {
    const id = b.id || generateId();
    return {
      id,
      type: b.type || 'snippet:' + id.slice(0, 8),
      name: String(b.name ?? 'Sem nome').trim() || 'Sem nome',
      icon: b.icon || 'puzzle',
      html: String(b.html ?? ''),
      category: 'custom',
      createdAt: b.createdAt || new Date().toISOString(),
    };
  }

  _sanitizeTemplate(t) {
    const isPage = t.kind === 'page' || Array.isArray(t.nodes);
    const base = {
      id: t.id || generateId(),
      name: String(t.name ?? 'Template').trim() || 'Template',
      icon: t.icon || (isPage ? 'file-earmark-richtext' : 'bookmark'),
      kind: isPage ? 'page' : 'block',
      createdAt: t.createdAt || new Date().toISOString(),
    };
    if (isPage) {
      base.nodes = (t.nodes ?? []).map((n) => this._stripIds(n));
    } else {
      base.tree = this._stripIds(t.tree ?? { type: 'section', children: [] });
    }
    return base;
  }

  /* ---------- Persistência ---------- */

  _load() {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      this.data.css        = typeof parsed.css === 'string' ? parsed.css : '';
      this.data.blocks     = Array.isArray(parsed.blocks)     ? parsed.blocks     : [];
      this.data.templates  = Array.isArray(parsed.templates)  ? parsed.templates  : [];
      this.data.palette    = Array.isArray(parsed.palette)    ? parsed.palette    : [];
      this.data.gradients  = Array.isArray(parsed.gradients)  ? parsed.gradients  : [];
      this.data.fonts      = Array.isArray(parsed.fonts)      ? parsed.fonts      : [];
      this.data.components = Array.isArray(parsed.components) ? parsed.components : [];
      this.data.theme      = (parsed.theme && typeof parsed.theme === 'object') ? parsed.theme : {};
    } catch (err) {
      console.warn('[CustomizationStore] _load falhou:', err);
    }
  }

  _persist() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (err) {
      console.warn('[CustomizationStore] _persist falhou:', err);
    }
  }

  /** Limpa tudo (útil para testes). */
  clear() {
    this.data = {
      css: '', blocks: [], templates: [],
      palette: [], gradients: [], fonts: [],
      components: [], theme: {},
    };
    this._persist();
    this.bus.emit('css:changed', { css: '' });
    this.bus.emit('theme:changed', { theme: {} });
    this.bus.emit('customblocks:changed', { blocks: [] });
    this.bus.emit('templates:changed',    { templates: [] });
    this.bus.emit('palette:changed',      { palette: [] });
    this.bus.emit('gradients:changed',    { gradients: [] });
    this.bus.emit('fonts:changed',        { fonts: [] });
    this.bus.emit('components:changed',   { components: [] });
  }
}
