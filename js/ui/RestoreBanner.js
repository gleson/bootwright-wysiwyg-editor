import { el, icon } from '../utils/dom.js';

/**
 * RestoreBanner — faixa amarela abaixo da topbar oferecendo restaurar
 * a última sessão salva em localStorage.
 *
 * Mostra-se apenas se:
 *   - editor.hasAutoSave() === true
 *   - editor.config.initialJSON é falsy (senão o JSON inicial vence)
 */
export class RestoreBanner {
  constructor(editor) {
    this.editor = editor;
    this.root = editor.root;
    this.banner = null;
  }

  mount() {
    if (this.editor.config.initialJSON) return;
    if (typeof this.editor.hasAutoSave !== 'function' || !this.editor.hasAutoSave()) return;
    const info = this.editor.getAutoSaveInfo();
    if (!info) return;

    let dateStr = '';
    try { dateStr = new Date(info.savedAt).toLocaleString('pt-BR'); }
    catch { dateStr = info.savedAt ?? ''; }

    this.banner = el('div', { class: 'editor-restore-banner', dataset: { region: 'restore-banner' } }, [
      icon('clock-history'),
      el('span', {}, `Sessão anterior salva em ${dateStr}.`),
      this._btn('arrow-clockwise', 'Restaurar', 'btn-primary', () => {
        if (this.editor.restoreAutoSave()) this._hide();
      }),
      this._btn('x-lg', 'Descartar', 'btn-outline-secondary', () => {
        this.editor.clearAutoSave();
        this._hide();
      }),
    ]);
    this.root.appendChild(this.banner);
  }

  _btn(iconName, label, variant, handler) {
    const btn = el('button', {
      type: 'button',
      class: `btn btn-sm ${variant} d-inline-flex align-items-center gap-1`,
    }, [icon(iconName), label]);
    btn.addEventListener('click', handler);
    return btn;
  }

  _hide() {
    if (this.banner) this.banner.remove();
    this.banner = null;
  }
}
