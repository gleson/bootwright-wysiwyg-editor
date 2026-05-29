import { Block } from '../Block.js';
import { spacingControls, advancedControls } from '../common-controls.js';

/**
 * List — itens são uma string com um item por linha (props.items).
 * Decisão: evitar bloco "list-item" filho porque inflaria a árvore.
 * Trade-off: itens não podem ter formatação rica individual.
 */
export class List extends Block {
  static type = 'list';
  static label = 'Lista';
  static icon = 'list-ul';
  static schema = {
    props: {
      ordered: false,
      items: 'Item 1\nItem 2\nItem 3',
    },
    classes: [],
    attrs: {},
  };
  static allowedChildren = null;

  static render(node) {
    const tag = node.props.ordered ? 'ol' : 'ul';
    const list = document.createElement(tag);
    const itemsRaw = String(node.props.items ?? '');
    for (const line of itemsRaw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const li = document.createElement('li');
      li.textContent = trimmed;
      list.appendChild(li);
    }
    return list;
  }

  static settings(node) {
    return [
      { tab: 'content', type: 'toggle', label: 'Tipo',
        toggleLabel: 'Numerada (<ol>)',
        bind: { kind: 'prop', key: 'ordered' } },
      { tab: 'content', type: 'textarea', label: 'Itens (um por linha)',
        bind: { kind: 'prop', key: 'items' } },

      { tab: 'style', type: 'toggle', label: 'Sem marcadores',
        toggleLabel: 'list-unstyled',
        bind: { kind: 'classToggle', class: 'list-unstyled' } },
      { tab: 'style', type: 'toggle', label: 'Inline',
        toggleLabel: 'list-inline (itens lado a lado)',
        bind: { kind: 'classToggle', class: 'list-inline' } },

      ...spacingControls(),
      ...advancedControls(),
    ];
  }
}
