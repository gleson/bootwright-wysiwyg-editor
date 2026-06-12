import { Block } from '../Block.js';
import { spacingControls, advancedControls } from '../common-controls.js';
import { safeUrl } from '../../utils/url.js';

/**
 * Breadcrumb — trilha de navegação do Bootstrap 5.3 (`<nav><ol class="breadcrumb">`).
 *
 * Itens são uma string, um por linha, no formato `Rótulo | href`. A barra e o
 * href são opcionais: o ÚLTIMO item (ou qualquer um sem href) vira o item ativo
 * (`aria-current="page"`, sem link). Texto puro evita injeção; o href passa por
 * `safeUrl`.
 */
export class Breadcrumb extends Block {
  static type = 'breadcrumb';
  static label = 'Breadcrumb';
  static icon = 'signpost-split';
  static category = 'bootstrap';
  static schema = {
    props: {
      items: 'Início | /\nBiblioteca | /biblioteca\nDados',
    },
    classes: [],
    attrs: {},
  };
  static allowedChildren = null;

  static render(node) {
    const nav = document.createElement('nav');
    nav.setAttribute('aria-label', 'breadcrumb');
    const ol = document.createElement('ol');
    ol.className = 'breadcrumb';

    const lines = String(node.props.items ?? '')
      .split('\n').map((l) => l.trim()).filter(Boolean);

    lines.forEach((line, i) => {
      const sep = line.indexOf('|');
      const label = (sep >= 0 ? line.slice(0, sep) : line).trim();
      const href = sep >= 0 ? line.slice(sep + 1).trim() : '';
      const isLast = i === lines.length - 1;

      const li = document.createElement('li');
      li.className = 'breadcrumb-item';
      if (isLast || !href) {
        li.classList.add('active');
        li.setAttribute('aria-current', 'page');
        li.textContent = label;
      } else {
        const a = document.createElement('a');
        a.href = safeUrl(href);
        a.textContent = label;
        li.appendChild(a);
      }
      ol.appendChild(li);
    });

    nav.appendChild(ol);
    return nav;
  }

  static settings() {
    return [
      { tab: 'content', type: 'textarea', label: 'Itens (um por linha: Rótulo | href)',
        help: 'O href é opcional. O último item — ou qualquer um sem href — vira o item ativo (sem link).',
        bind: { kind: 'prop', key: 'items' } },

      ...spacingControls(),
      ...advancedControls(),
    ];
  }
}
