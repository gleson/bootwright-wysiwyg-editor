/**
 * Selection — rastreia os blocos selecionados.
 *
 * Suporta multi-seleção: `ids` é a lista ordenada completa; `selectedId` é o
 * bloco "primário" (último clicado) — usado pelo inspector single e toolbar.
 *
 * Eventos:
 *   - selection:changed → { id, ids }   (id = primário ou null; ids = array)
 */
export class Selection {
  constructor(bus) {
    if (!bus) throw new Error('[Selection] EventBus é obrigatório.');
    this.bus = bus;
    this.selectedId = null;
    /** @type {string[]} seleção completa, ordem de inserção. */
    this.ids = [];
  }

  /** Seleção simples: substitui tudo por um único bloco. */
  select(id) {
    if (this.selectedId === id && this.ids.length === 1 && this.ids[0] === id) return;
    this.selectedId = id ?? null;
    this.ids = id ? [id] : [];
    this._emit();
  }

  /** Shift+click: adiciona ou remove `id` da seleção atual. */
  toggle(id) {
    if (!id) return;
    const idx = this.ids.indexOf(id);
    if (idx >= 0) {
      this.ids.splice(idx, 1);
      this.selectedId = this.ids[this.ids.length - 1] ?? null;
    } else {
      this.ids.push(id);
      this.selectedId = id;
    }
    this._emit();
  }

  /** Define a seleção completa de uma vez. */
  set(ids) {
    this.ids = [...new Set(ids)].filter(Boolean);
    this.selectedId = this.ids[this.ids.length - 1] ?? null;
    this._emit();
  }

  clear() {
    if (this.selectedId === null && this.ids.length === 0) return;
    this.selectedId = null;
    this.ids = [];
    this._emit();
  }

  /** Remove um id da seleção sem emitir (uso interno após delete). */
  drop(id) {
    const idx = this.ids.indexOf(id);
    if (idx < 0) return false;
    this.ids.splice(idx, 1);
    if (this.selectedId === id) {
      this.selectedId = this.ids[this.ids.length - 1] ?? null;
    }
    this._emit();
    return true;
  }

  get() {
    return this.selectedId;
  }

  getAll() {
    return [...this.ids];
  }

  has(id) {
    return this.ids.includes(id);
  }

  _emit() {
    this.bus.emit('selection:changed', { id: this.selectedId, ids: [...this.ids] });
  }
}
