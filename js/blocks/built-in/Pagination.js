import { Block } from '../Block.js';
import { spacingControls, advancedControls } from '../common-controls.js';

/**
 * Pagination — paginação do Bootstrap 5.3 (`<nav><ul class="pagination">`).
 *
 * Gera setas Anterior/Próximo + N páginas numeradas. `current` marca a página
 * ativa. Os links apontam para `#` por padrão (a integração — ex.: Django —
 * troca os href no template). `size` controla `pagination-sm/lg`; `align`
 * controla o alinhamento via `justify-content-*`.
 */
const ALIGN_CLASSES = ['justify-content-start', 'justify-content-center', 'justify-content-end'];

export class Pagination extends Block {
  static type = 'pagination';
  static label = 'Paginação';
  static icon = 'three-dots';
  static category = 'bootstrap';
  static schema = {
    props: {
      pages: 5,
      current: 1,
      prevNext: true,
      size: '',          // '' | 'pagination-sm' | 'pagination-lg'
      align: 'justify-content-start',
    },
    classes: [],
    attrs: {},
  };
  static allowedChildren = null;

  static render(node) {
    const pages = Math.max(1, Math.min(50, Number(node.props.pages) || 1));
    const current = Math.max(1, Math.min(pages, Number(node.props.current) || 1));

    const nav = document.createElement('nav');
    nav.setAttribute('aria-label', 'Paginação');
    const ul = document.createElement('ul');
    ul.className = 'pagination';
    if (node.props.size) ul.classList.add(String(node.props.size));
    if (node.props.align) ul.classList.add(String(node.props.align));

    const makeItem = (label, { active = false, disabled = false, aria } = {}) => {
      const li = document.createElement('li');
      li.className = 'page-item';
      if (active) li.classList.add('active');
      if (disabled) li.classList.add('disabled');
      if (active) li.setAttribute('aria-current', 'page');
      const a = document.createElement('a');
      a.className = 'page-link';
      a.href = '#';
      if (aria) a.setAttribute('aria-label', aria);
      a.textContent = label;
      li.appendChild(a);
      return li;
    };

    if (node.props.prevNext) {
      ul.appendChild(makeItem('«', { disabled: current === 1, aria: 'Anterior' }));
    }
    for (let p = 1; p <= pages; p++) {
      ul.appendChild(makeItem(String(p), { active: p === current }));
    }
    if (node.props.prevNext) {
      ul.appendChild(makeItem('»', { disabled: current === pages, aria: 'Próximo' }));
    }

    nav.appendChild(ul);
    return nav;
  }

  static settings() {
    return [
      { tab: 'content', type: 'number', label: 'Número de páginas',
        bind: { kind: 'prop', key: 'pages' } },
      { tab: 'content', type: 'number', label: 'Página atual',
        bind: { kind: 'prop', key: 'current' } },
      { tab: 'content', type: 'toggle', label: 'Setas',
        toggleLabel: 'Mostrar « Anterior / Próximo »',
        bind: { kind: 'prop', key: 'prevNext' } },

      { tab: 'style', type: 'select', label: 'Tamanho',
        options: [
          { value: '',              label: 'Médio (padrão)' },
          { value: 'pagination-sm', label: 'Pequeno' },
          { value: 'pagination-lg', label: 'Grande' },
        ],
        bind: { kind: 'prop', key: 'size' } },
      { tab: 'style', type: 'radio-group', label: 'Alinhamento',
        options: [
          { value: 'justify-content-start',  label: 'Esquerda', icon: 'text-left' },
          { value: 'justify-content-center', label: 'Centro',   icon: 'text-center' },
          { value: 'justify-content-end',    label: 'Direita',  icon: 'text-right' },
        ],
        bind: { kind: 'prop', key: 'align' } },

      ...spacingControls(),
      ...advancedControls(),
    ];
  }
}
