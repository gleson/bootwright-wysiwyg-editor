import { el, icon } from '../utils/dom.js';
import { t } from '../i18n/index.js';

/**
 * ImportDialog — modal de importação de HTML ou Markdown.
 *
 * Estrutura: header, seletor de formato (HTML/Markdown), textarea com o
 * conteúdo cru, upload de arquivo (.html/.md/.txt), seletor de modo
 * (anexar/substituir), botões. Como o ExportDialog, cada `show()` cria um
 * <dialog> e descarta no close.
 *
 * Delega para `editor.importContent({ format, source, mode })`.
 */
export class ImportDialog {
  constructor(editor) {
    this.editor = editor;
  }

  show() {
    const dialog = el('dialog', { class: 'editor-import-dialog' });

    const ta = el('textarea', {
      class: 'form-control font-monospace',
      rows: 16, placeholder: t('import.placeholder'),
    });

    const fmtHtml = this._radio('import-format', 'html', t('import.format.html'), true);
    const fmtMd   = this._radio('import-format', 'markdown', t('import.format.markdown'), false);
    const modeAppend = this._radio('import-mode', 'append',  t('import.mode.append'), true);
    const modeReplace = this._radio('import-mode', 'replace', t('import.mode.replace'), false);

    const file = el('input', { type: 'file', accept: '.html,.htm,.md,.markdown,.txt',
      class: 'form-control form-control-sm' });
    file.addEventListener('change', async () => {
      const f = file.files?.[0];
      if (!f) return;
      const text = await f.text();
      ta.value = text;
      // Detecta o formato pela extensão.
      const isMd = /\.(md|markdown)$/i.test(f.name);
      (isMd ? fmtMd.input : fmtHtml.input).checked = true;
    });

    const importBtn = el('button', {
      type: 'button', class: 'btn btn-primary',
    }, [icon('box-arrow-in-down'), ' ', t('import.action')]);
    const cancelBtn = el('button', {
      type: 'button', class: 'btn btn-outline-secondary',
    }, t('common.cancel'));

    cancelBtn.addEventListener('click', () => dialog.close());
    importBtn.addEventListener('click', () => {
      const format = fmtHtml.input.checked ? 'html' : 'markdown';
      const mode = modeReplace.input.checked ? 'replace' : 'append';
      const source = ta.value;
      if (!source.trim()) {
        this.editor.notify?.toast?.(t('import.emptySource'), 'warning');
        return;
      }
      const { count } = this.editor.importContent({ format, source, mode });
      if (count > 0) {
        this.editor.notify?.toast?.(t('import.done', { n: count }), 'success');
        dialog.close();
      } else {
        this.editor.notify?.toast?.(t('import.noBlocks'), 'warning');
      }
    });

    dialog.append(
      el('div', { class: 'editor-import-dialog__header' }, [
        el('h5', { class: 'mb-0' }, [icon('box-arrow-in-down'), ' ', t('import.title')]),
      ]),
      el('div', { class: 'editor-import-dialog__row' }, [
        el('label', { class: 'editor-import-dialog__label' }, t('import.format.label') + ':'),
        fmtHtml.wrap, fmtMd.wrap,
      ]),
      el('div', { class: 'editor-import-dialog__row' }, [
        el('label', { class: 'editor-import-dialog__label' }, t('import.file') + ':'),
        file,
      ]),
      ta,
      el('div', { class: 'editor-import-dialog__row' }, [
        el('label', { class: 'editor-import-dialog__label' }, t('import.mode.label') + ':'),
        modeAppend.wrap, modeReplace.wrap,
      ]),
      el('div', { class: 'd-flex gap-2 justify-content-end mt-2' }, [
        cancelBtn, importBtn,
      ]),
    );

    document.body.appendChild(dialog);
    dialog.addEventListener('close', () => dialog.remove());
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
    dialog.showModal();
    ta.focus();
  }

  _radio(name, value, label, checked) {
    const id = `${name}-${value}`;
    const input = el('input', {
      type: 'radio', name, value, class: 'form-check-input', id,
    });
    if (checked) input.checked = true;
    const lab = el('label', { class: 'form-check-label small', for: id }, label);
    const wrap = el('div', { class: 'form-check form-check-inline' }, [input, lab]);
    return { wrap, input };
  }
}
