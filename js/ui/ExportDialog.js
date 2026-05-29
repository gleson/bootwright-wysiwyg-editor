import { el, icon } from '../utils/dom.js';

/**
 * ExportDialog — modal para exportação de HTML ou JSON.
 *
 * Usa <dialog> nativo (showModal). Inclui Copiar, Baixar e (para HTML) toggle
 * de Minificar que re-renderiza o conteúdo. Não mantém estado próprio entre
 * chamadas — cada show* cria um novo dialog e descarta no close.
 */
export class ExportDialog {
  constructor(editor) {
    this.editor = editor;
  }

  showHTML() { this._show('HTML', 'html', () => this.editor.exportHTML()); }
  showJSON() { this._show('JSON', 'json', () => JSON.stringify(this.editor.exportJSON(), null, 2)); }
  showStandalone() {
    this._show('HTML completo', 'standalone',
      (opts) => this.editor.exportStandaloneHTML(opts));
  }

  _show(title, format, getContent) {
    const dialog = el('dialog', { class: 'editor-export-dialog' });
    const ta = el('textarea', { class: 'form-control font-monospace', rows: 16, readonly: true });
    const opts = { minify: false, cdnBootstrap: true, includeBootstrapJs: false };
    const refresh = () => { ta.value = getContent(opts); };
    refresh();

    const actions = el('div', { class: 'd-flex gap-2 justify-content-end mt-2' });
    actions.append(
      this._copyBtn(ta),
      this._downloadBtn(ta, format),
      this._closeBtn(dialog),
    );

    dialog.appendChild(el('div', { class: 'editor-export-dialog__header' }, [
      el('h5', { class: 'mb-0' }, [icon('download'), ` Exportar ${title}`]),
    ]));
    if (format === 'html' || format === 'standalone') {
      dialog.appendChild(this._toggleRow([
        this._toggle('Minificar', (v) => { opts.minify = v; refresh(); }),
        format === 'standalone' && this._toggle('CDN Bootstrap', (v) => {
          opts.cdnBootstrap = v; refresh();
        }, true),
        format === 'standalone' && this._toggle('Bootstrap JS (interativos)', (v) => {
          opts.includeBootstrapJs = v; refresh();
        }),
      ].filter(Boolean)));
    }
    dialog.appendChild(ta);
    dialog.appendChild(actions);

    document.body.appendChild(dialog);
    dialog.addEventListener('close', () => dialog.remove());
    // Clique no backdrop fecha
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.close();
    });

    dialog.showModal();
    ta.focus();
    ta.select();
  }

  /** Linha de toggles compactos. */
  _toggleRow(children) {
    return el('div', { class: 'd-flex flex-wrap gap-3 mb-2' }, children);
  }

  /** Toggle reutilizável (switch Bootstrap). */
  _toggle(label, onChange, checked = false) {
    const id = `t-${Math.random().toString(36).slice(2, 8)}`;
    const input = el('input', { type: 'checkbox', class: 'form-check-input', id });
    if (checked) input.checked = true;
    input.addEventListener('change', () => onChange(input.checked));
    return el('div', { class: 'form-check form-switch' }, [
      input,
      el('label', { class: 'form-check-label small', for: id }, label),
    ]);
  }

  _minifyToggle(ta) {
    const wrap = el('div', { class: 'form-check form-switch mb-2' });
    const id = `mini-${Date.now()}`;
    const input = el('input', { type: 'checkbox', class: 'form-check-input', id });
    const label = el('label', { class: 'form-check-label small', for: id }, 'Minificar');
    input.addEventListener('change', () => {
      ta.value = this.editor.exportHTML({ minify: input.checked });
    });
    wrap.append(input, label);
    return wrap;
  }

  _copyBtn(ta) {
    const btn = el('button', { type: 'button', class: 'btn btn-sm btn-primary' },
      [icon('clipboard'), ' Copiar']);
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(ta.value);
        const i = btn.querySelector('i');
        const original = i.className;
        i.className = 'bi bi-check2';
        setTimeout(() => { i.className = original; }, 1500);
      } catch {
        ta.select();
      }
    });
    return btn;
  }

  _downloadBtn(ta, format) {
    const btn = el('button', { type: 'button', class: 'btn btn-sm btn-outline-secondary' },
      [icon('cloud-download'), ' Baixar']);
    btn.addEventListener('click', () => {
      const mime = format === 'json' ? 'application/json' : 'text/html';
      const ext = format === 'json' ? 'json' : 'html';
      const blob = new Blob([ta.value], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `editor-export.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    });
    return btn;
  }

  _closeBtn(dialog) {
    const btn = el('button', { type: 'button', class: 'btn btn-sm btn-outline-secondary' }, 'Fechar');
    btn.addEventListener('click', () => dialog.close());
    return btn;
  }
}
