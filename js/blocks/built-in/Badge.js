import { Block } from '../Block.js';
import { spacingControls, advancedControls, colorControl } from '../common-controls.js';

const VARIANTS = [
  'text-bg-primary','text-bg-secondary','text-bg-success','text-bg-danger',
  'text-bg-warning','text-bg-info','text-bg-light','text-bg-dark',
];

export class Badge extends Block {
  static type = 'badge';
  static label = 'Badge';
  static icon = 'tag';
  static category = 'bootstrap';
  static schema = {
    props: { text: 'Novo' },
    classes: ['badge', 'text-bg-primary'],
    attrs: {},
  };
  static essentialClasses = ['badge'];
  static allowedChildren = null;
  static editableProp = 'text';
  /** Fast-path: só `text` atualiza in-place (textContent do `<span>`). */
  static fastUpdate = { text: { target: 'self' } };

  static render(node) {
    const span = document.createElement('span');
    span.textContent = node.props.text ?? '';
    return span;
  }

  static settings(node) {
    return [
      { tab: 'content', type: 'text', label: 'Texto',
        bind: { kind: 'prop', key: 'text' } },

      { tab: 'style', type: 'select', label: 'Tema (texto + fundo)',
        help: 'Atalho Bootstrap text-bg-* (combina cor de texto e fundo automaticamente). Use os controles abaixo para personalizar separadamente.',
        options: VARIANTS.map((v) => ({ value: v, label: v.replace('text-bg-', '') })),
        bind: { kind: 'classGroup', group: VARIANTS } },
      { tab: 'style', type: 'toggle', label: 'Pílula',
        toggleLabel: 'rounded-pill (cantos completamente arredondados)',
        bind: { kind: 'classToggle', class: 'rounded-pill' } },

      ...colorControl('text', 'Cor do texto'),
      ...colorControl('bg', 'Cor de fundo'),

      ...spacingControls(),
      ...advancedControls(),
    ];
  }
}
