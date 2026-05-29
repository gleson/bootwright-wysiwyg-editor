import { el, icon as iconEl, clear } from '../utils/dom.js';
import { t } from '../i18n/index.js';

/**
 * IconPicker — diálogo para escolher um ícone Bootstrap Icons.
 *
 * Estratégia: ao abrir, varre `document.styleSheets` por regras `.bi-NAME::before`
 * e monta a lista de nomes disponíveis. Funciona offline com qualquer versão da
 * folha Bootstrap Icons carregada — sem precisar embutir os ~2000 nomes no
 * bundle. Se a folha não estiver acessível (CORS / não carregada ainda), cai
 * para uma lista curada de ícones comuns.
 *
 * Uso:
 *   const picker = editor.ui.iconPicker;
 *   picker.pick((name) => { ... });
 */

const FALLBACK = [
  'star','star-fill','heart','heart-fill','check-circle-fill','x-circle','info-circle',
  'exclamation-triangle','lightbulb','lightning','gear','house','envelope','telephone',
  'geo-alt','calendar','clock','arrow-right','arrow-left','arrow-up','arrow-down',
  'cart','bag','person','people','globe','search','bell','instagram','facebook',
  'twitter-x','linkedin','github','youtube','whatsapp','play-circle','pause-circle',
  'download','upload','share','link-45deg','image','camera','file-earmark',
  'folder','trash','pencil','plus','dash','x','check','three-dots','grid',
  'list','filter','sort-down','sort-up','arrow-clockwise','book','bookmark',
];

let CACHED_NAMES = null;

export class IconPicker {
  constructor(editor) {
    this.editor = editor;
  }

  /** Abre o picker. Chama `onPick(name)` quando o usuário escolhe (ou cancela). */
  pick(onPick) {
    const names = this._loadNames();
    const dialog = el('dialog', { class: 'editor-icon-picker' });

    const search = el('input', {
      type: 'text', class: 'form-control form-control-sm',
      placeholder: t('icons.search'), autocomplete: 'off', spellcheck: 'false',
    });
    const grid = el('div', { class: 'editor-icon-picker__grid' });
    const counter = el('span', { class: 'editor-icon-picker__counter' });

    const render = (q) => {
      const filter = q.trim().toLowerCase();
      const matched = filter
        ? names.filter((n) => n.includes(filter))
        : names;
      clear(grid);
      // Cap render to 600 itens para não travar com 2000+ ícones.
      const MAX = 600;
      const slice = matched.slice(0, MAX);
      for (const name of slice) {
        const btn = el('button', {
          type: 'button', class: 'editor-icon-picker__cell',
          title: name, 'data-name': name,
        }, [iconEl(name), el('small', {}, name)]);
        btn.addEventListener('click', () => {
          dialog.close();
          onPick?.(name);
        });
        grid.appendChild(btn);
      }
      counter.textContent = matched.length > MAX
        ? t('icons.counterCapped', { shown: MAX, total: matched.length })
        : t('icons.counter', { n: matched.length });
    };

    search.addEventListener('input', () => render(search.value));
    search.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); dialog.close(); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        const first = grid.querySelector('.editor-icon-picker__cell');
        first?.click();
      }
    });

    dialog.append(
      el('div', { class: 'editor-icon-picker__header' }, [
        el('h5', { class: 'mb-0' }, [iconEl('grid-3x3-gap'), ' ', t('icons.title')]),
        counter,
      ]),
      search,
      grid,
    );
    document.body.appendChild(dialog);
    dialog.addEventListener('close', () => dialog.remove());
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
    dialog.showModal();
    search.focus();
    render('');
  }

  /** Lista única (memoizada) de nomes `bi-*` encontrados nas stylesheets. */
  _loadNames() {
    if (CACHED_NAMES) return CACHED_NAMES;
    const found = new Set();
    try {
      for (const sheet of document.styleSheets) {
        let rules;
        try { rules = sheet.cssRules; } catch { continue; } // CORS
        if (!rules) continue;
        for (const rule of rules) {
          const sel = rule.selectorText;
          if (!sel) continue;
          // Match `.bi-name::before` (e variantes com comma).
          for (const m of sel.matchAll(/\.bi-([a-z0-9-]+)::?before/gi)) {
            found.add(m[1]);
          }
        }
      }
    } catch {
      // Ignora falhas e cai no fallback.
    }
    CACHED_NAMES = found.size ? [...found].sort() : FALLBACK.slice();
    return CACHED_NAMES;
  }
}
