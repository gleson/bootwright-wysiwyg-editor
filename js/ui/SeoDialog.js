import { el, icon, clear } from '../utils/dom.js';

/**
 * SeoDialog — painel de metadados SEO da página.
 *
 * Edita `root.props.seo` via `editor.updateSeo()`. Mostra um preview de
 * resultado de busca (estilo Google), um preview do `<head>` gerado e botão
 * de copiar. O campo de imagem social reaproveita a AssetLibrary.
 *
 * Como o ExportDialog, cada `show()` cria um <dialog> e o descarta no close.
 * Os dados ficam no JSON da página (root.props.seo) — o Django lê de lá.
 */
const TITLE_LIMIT = 60;
const DESC_LIMIT = 155;

export class SeoDialog {
  constructor(editor) {
    this.editor = editor;
  }

  show() {
    const seo = this.editor.getSeo();
    const dialog = el('dialog', { class: 'editor-seo-dialog' });

    // Preview do snippet de busca + do <head> — atualizados a cada input.
    const serp = el('div', { class: 'editor-seo-dialog__serp' });
    const headPre = el('pre', { class: 'editor-seo-dialog__head' });
    const copyBtn = el('button', { type: 'button', class: 'btn btn-sm btn-primary' },
      [icon('clipboard'), ' Copiar <head>']);

    const refresh = () => {
      const s = this.editor.getSeo();
      clear(serp);
      serp.append(
        el('div', { class: 'editor-seo-dialog__serp-url' },
          s.canonical || 'https://exemplo.com/sua-pagina'),
        el('div', { class: 'editor-seo-dialog__serp-title' },
          s.title || 'Título da página aparece aqui'),
        el('div', { class: 'editor-seo-dialog__serp-desc' },
          s.description || 'A meta description aparece aqui — escreva algo entre 120 e 155 caracteres que resuma a página e convença o usuário a clicar.'),
      );
      headPre.textContent = this.editor.exportSeoHead() || '<!-- preencha os campos para gerar as meta tags -->';
    };

    // Grava no editor e re-renderiza os previews.
    const commit = (patch) => { this.editor.updateSeo(patch); refresh(); };

    const fields = el('div', { class: 'editor-seo-dialog__fields' }, [
      this._textField('Título', seo.title, TITLE_LIMIT,
        'Aparece na aba do navegador e como link azul no Google.',
        (v) => commit({ title: v })),
      this._textareaField('Descrição', seo.description, DESC_LIMIT,
        'Resumo exibido abaixo do título no resultado de busca.',
        (v) => commit({ description: v })),
      this._textField('URL canônica', seo.canonical, 0,
        'URL absoluta preferencial desta página (evita conteúdo duplicado).',
        (v) => commit({ canonical: v })),
      this._imageField('Imagem social (og:image)', seo.ogImage,
        (v) => commit({ ogImage: v })),
      this._selectField('Tipo Open Graph', seo.ogType, [
        { value: 'website', label: 'website' },
        { value: 'article', label: 'article' },
        { value: 'product', label: 'product' },
        { value: 'profile', label: 'profile' },
      ], (v) => commit({ ogType: v })),
      this._selectField('Robots', seo.robots, [
        { value: 'index, follow',     label: 'index, follow (padrão)' },
        { value: 'noindex, follow',   label: 'noindex, follow' },
        { value: 'index, nofollow',   label: 'index, nofollow' },
        { value: 'noindex, nofollow', label: 'noindex, nofollow' },
      ], (v) => commit({ robots: v })),
    ]);

    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(headPre.textContent);
        const i = copyBtn.querySelector('i');
        const prev = i.className;
        i.className = 'bi bi-check2';
        setTimeout(() => { i.className = prev; }, 1500);
      } catch {
        // Sem clipboard API — seleciona o texto pro usuário copiar manualmente.
        const range = document.createRange();
        range.selectNodeContents(headPre);
        getSelection().removeAllRanges();
        getSelection().addRange(range);
      }
    });

    const closeBtn = el('button', { type: 'button', class: 'btn btn-sm btn-outline-secondary' },
      [icon('x-lg'), ' Fechar']);
    closeBtn.addEventListener('click', () => dialog.close());

    dialog.append(
      el('div', { class: 'editor-seo-dialog__header' }, [
        el('h5', { class: 'mb-0' }, [icon('tags'), ' SEO da página']),
        closeBtn,
      ]),
      el('div', { class: 'editor-seo-dialog__body' }, [
        fields,
        el('div', { class: 'editor-seo-dialog__preview' }, [
          el('h6', { class: 'text-muted small text-uppercase' }, 'Pré-visualização na busca'),
          serp,
          el('div', { class: 'd-flex align-items-center justify-content-between mt-3 mb-1' }, [
            el('h6', { class: 'text-muted small text-uppercase mb-0' }, 'Tags geradas para o <head>'),
            copyBtn,
          ]),
          headPre,
        ]),
      ]),
    );

    document.body.appendChild(dialog);
    dialog.addEventListener('close', () => dialog.remove());
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });

    refresh();
    dialog.showModal();
  }

  /* ---------- construtores de campo ---------- */

  _row(label, control, help) {
    return el('div', { class: 'editor-seo-dialog__row' }, [
      el('label', { class: 'form-label small fw-semibold' }, label),
      control,
      help ? el('div', { class: 'form-text' }, help) : null,
    ]);
  }

  /** Campo de texto com contador opcional (limit > 0). */
  _textField(label, value, limit, help, onInput) {
    const input = el('input', { type: 'text', class: 'form-control form-control-sm', value: value ?? '' });
    const counter = limit ? el('span', { class: 'editor-seo-dialog__counter' }) : null;
    const update = () => {
      if (!counter) return;
      const len = input.value.length;
      counter.textContent = `${len}/${limit}`;
      counter.classList.toggle('is-over', len > limit);
    };
    input.addEventListener('input', () => { update(); onInput(input.value); });
    update();
    const labelRow = counter
      ? el('div', { class: 'editor-seo-dialog__label-row' },
          [el('label', { class: 'form-label small fw-semibold mb-0' }, label), counter])
      : el('label', { class: 'form-label small fw-semibold' }, label);
    return el('div', { class: 'editor-seo-dialog__row' },
      [labelRow, input, help ? el('div', { class: 'form-text' }, help) : null]);
  }

  _textareaField(label, value, limit, help, onInput) {
    const ta = el('textarea', { class: 'form-control form-control-sm', rows: 3 });
    ta.value = value ?? '';
    const counter = el('span', { class: 'editor-seo-dialog__counter' });
    const update = () => {
      const len = ta.value.length;
      counter.textContent = `${len}/${limit}`;
      counter.classList.toggle('is-over', len > limit);
    };
    ta.addEventListener('input', () => { update(); onInput(ta.value); });
    update();
    return el('div', { class: 'editor-seo-dialog__row' }, [
      el('div', { class: 'editor-seo-dialog__label-row' },
        [el('label', { class: 'form-label small fw-semibold mb-0' }, label), counter]),
      ta,
      help ? el('div', { class: 'form-text' }, help) : null,
    ]);
  }

  _selectField(label, value, options, onInput) {
    const sel = el('select', { class: 'form-select form-select-sm' });
    for (const opt of options) {
      const o = el('option', { value: opt.value }, opt.label);
      if (opt.value === value) o.selected = true;
      sel.appendChild(o);
    }
    sel.addEventListener('change', () => onInput(sel.value));
    return this._row(label, sel);
  }

  /** Campo de imagem: input de texto + botão que abre a AssetLibrary. */
  _imageField(label, value, onInput) {
    const input = el('input', { type: 'text', class: 'form-control form-control-sm', value: value ?? '' });
    input.addEventListener('input', () => onInput(input.value));

    const libBtn = el('button', {
      type: 'button',
      class: 'btn btn-sm btn-outline-secondary',
      title: 'Escolher da biblioteca de assets',
    }, [icon('images')]);
    libBtn.addEventListener('click', () => {
      this.editor.ui?.assetLibrary?.open({
        accept: 'image/*',
        onPick: (url) => { input.value = url; onInput(url); },
      });
    });

    const group = el('div', { class: 'input-group input-group-sm' }, [input, libBtn]);
    return this._row(label, group, 'Usada por Facebook, WhatsApp, LinkedIn. Recomendado: 1200×630.');
  }
}
