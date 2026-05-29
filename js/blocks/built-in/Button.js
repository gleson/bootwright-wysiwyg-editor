import { Block } from '../Block.js';
import { spacingControls, advancedControls, colorControl } from '../common-controls.js';

const VARIANTS = [
  'btn-primary','btn-secondary','btn-success','btn-danger',
  'btn-warning','btn-info','btn-light','btn-dark','btn-link',
  'btn-outline-primary','btn-outline-secondary','btn-outline-success',
  'btn-outline-danger','btn-outline-warning','btn-outline-info',
  'btn-outline-light','btn-outline-dark',
];

export class Button extends Block {
  static type = 'button';
  static label = 'Botão';
  static icon = 'app';
  static schema = {
    props: { text: 'Clique aqui', href: '#', target: '' },
    classes: ['btn', 'btn-primary'],
    attrs: {},
  };
  static allowedChildren = null;
  static editableProp = 'text';
  /** Fast-path: só `text` atualiza in-place; href/target caem no re-render. */
  static fastUpdate = { text: { target: 'self' } };

  /**
   * Renderiza como <a role="button"> para suportar href/target.
   * Bootstrap aceita classe .btn em qualquer elemento.
   */
  static render(node) {
    const a = document.createElement('a');
    a.href = node.props.href ?? '#';
    a.textContent = node.props.text ?? '';
    if (node.props.target) a.target = node.props.target;
    a.setAttribute('role', 'button');
    return a;
  }

  static settings(node) {
    return [
      { tab: 'content', type: 'text', label: 'Texto',
        bind: { kind: 'prop', key: 'text' } },
      { tab: 'content', type: 'text', label: 'URL (href)',
        bind: { kind: 'prop', key: 'href' } },
      { tab: 'content', type: 'select', label: 'Abrir em',
        options: [
          { value: '',       label: 'Mesma janela' },
          { value: '_blank', label: 'Nova aba' },
        ],
        bind: { kind: 'prop', key: 'target' } },

      { tab: 'style', type: 'select', label: 'Variante',
        options: VARIANTS.map((v) => ({ value: v, label: v.replace('btn-', '') })),
        bind: { kind: 'classGroup', group: VARIANTS } },
      { tab: 'style', type: 'select', label: 'Tamanho',
        options: [
          { value: '',       label: 'Médio (padrão)' },
          { value: 'btn-sm', label: 'Pequeno' },
          { value: 'btn-lg', label: 'Grande' },
        ],
        bind: { kind: 'classGroup', group: ['btn-sm','btn-lg'] } },
      { tab: 'style', type: 'toggle', label: 'Ocupa toda a largura',
        toggleLabel: 'w-100',
        bind: { kind: 'classToggle', class: 'w-100' } },

      ...colorControl('text', 'Cor do texto'),
      ...colorControl('bg', 'Cor de fundo (sobrescreve a variante)'),

      ...spacingControls(),
      ...advancedControls(),
    ];
  }
}
