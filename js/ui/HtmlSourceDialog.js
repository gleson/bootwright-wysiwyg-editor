import { el, icon } from '../utils/dom.js';
import { t } from '../i18n/index.js';
import { formatHTML } from '../utils/htmlFormat.js';

/**
 * HtmlSourceDialog — edição direta do código-fonte HTML do documento inteiro.
 *
 * Mostra o HTML atual (`editor.exportHTML()`), indentado, num textarea
 * editável. Ao aplicar, re-parseia via
 * `editor.importContent({ format: 'html', mode: 'replace', diff: true })`,
 * substituindo o documento.
 *
 * Como o editor é baseado em blocos (modelo JSON), o HTML passa pelo
 * `htmlToBlocks` + sanitizer ao reimportar. Desde a Fase 1, `class`/`style`/
 * `id`/`data-*`/`aria-*` de nível de bloco são preservados; estruturas que o
 * editor não modela viram blocos `html` (embed). Não é edição byte-a-byte: é
 * "edita o HTML → reconstrói os blocos a partir dele".
 *
 * Fase 2 — reconciliação (`diff: true`): os blocos de topo que o usuário NÃO
 * tocou são casados por posição + igualdade textual contra o HTML exportado e
 * reaproveitados como estão (mesmo id, subtree e fidelidade). Só os blocos
 * alterados/novos são reconstruídos pelo importer. Isso protege blocos
 * compostos (Tabs/Acordeão/Carousel) de virarem embed `html` ao salvar.
 */
export class HtmlSourceDialog {
  constructor(editor) {
    this.editor = editor;
  }

  show() {
    const dialog = el('dialog', { class: 'editor-export-dialog editor-html-source-dialog' });

    const ta = el('textarea', {
      class: 'form-control font-monospace editor-html-source-dialog__ta',
      rows: 18, spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off',
    });
    ta.value = formatHTML(this.editor.exportHTML());

    const apply = (close) => {
      try {
        this.editor.importContent({ format: 'html', source: ta.value, mode: 'replace', diff: true });
      } catch (err) {
        console.error('[HtmlSourceDialog] importContent falhou:', err);
        this.editor.notify?.toast?.(t('htmlSource.error'), 'danger');
        return;
      }
      this.editor.notify?.toast?.(t('htmlSource.applied'), 'success');
      if (close) dialog.close();
    };

    const reindent = el('button', {
      type: 'button', class: 'btn btn-sm btn-outline-secondary me-auto',
      title: t('htmlSource.reindent'),
    }, [icon('text-indent-left'), ' ', t('htmlSource.reindent')]);
    reindent.addEventListener('click', () => { ta.value = formatHTML(ta.value); });

    const cancelBtn = el('button', {
      type: 'button', class: 'btn btn-sm btn-outline-secondary',
    }, t('common.cancel'));
    cancelBtn.addEventListener('click', () => dialog.close());

    const applyBtn = el('button', {
      type: 'button', class: 'btn btn-sm btn-primary',
    }, [icon('check2'), ' ', t('htmlSource.apply')]);
    applyBtn.addEventListener('click', () => apply(true));

    dialog.append(
      el('div', { class: 'editor-export-dialog__header' }, [
        el('h5', { class: 'mb-0' }, [icon('code-slash'), ' ', t('htmlSource.title')]),
      ]),
      el('p', { class: 'editor-html-source-dialog__hint small text-muted mb-2' },
        t('htmlSource.hint')),
      ta,
      el('div', { class: 'd-flex gap-2 justify-content-end align-items-center mt-2' }, [
        reindent, cancelBtn, applyBtn,
      ]),
    );

    document.body.appendChild(dialog);
    dialog.addEventListener('close', () => dialog.remove());
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
    dialog.showModal();
    ta.focus();
  }
}
