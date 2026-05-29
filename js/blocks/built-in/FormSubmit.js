import { Block } from '../Block.js';
import { spacingControls, advancedControls, colorControl } from '../common-controls.js';

const VARIANTS = [
  'btn-primary','btn-secondary','btn-success','btn-danger',
  'btn-warning','btn-info','btn-light','btn-dark',
  'btn-outline-primary','btn-outline-secondary','btn-outline-success',
  'btn-outline-danger','btn-outline-warning','btn-outline-info',
  'btn-outline-light','btn-outline-dark',
];

export class FormSubmit extends Block {
  static type = 'form-submit';
  static label = 'Botão Enviar';
  static icon = 'send';
  static category = 'forms';
  static schema = {
    props: { text: 'Enviar', loadingText: '' },
    classes: ['btn', 'btn-primary'],
    attrs: { type: 'submit' },
  };
  static essentialClasses = ['btn'];
  static allowedChildren = null;
  static editableProp = 'text';
  /** Fast-path: só `text` atualiza in-place; `loadingText` cai no re-render. */
  static fastUpdate = { text: { target: 'self' } };

  static render(node) {
    const btn = document.createElement('button');
    btn.type = 'submit';
    btn.textContent = node.props.text ?? 'Enviar';
    if (node.props.loadingText) {
      btn.dataset.loadingText = node.props.loadingText;
    }
    return btn;
  }

  static settings(node) {
    return [
      { tab: 'content', type: 'text', label: 'Texto',
        bind: { kind: 'prop', key: 'text' } },
      { tab: 'content', type: 'text', label: 'Texto durante envio',
        help: 'Opcional — JS do site pode trocar o conteúdo do botão lendo data-loading-text.',
        bind: { kind: 'prop', key: 'loadingText' } },

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
