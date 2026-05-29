import { Block } from '../Block.js';
import { spacingControls, advancedControls, colorControl } from '../common-controls.js';

const VARIANTS = [
  'alert-primary','alert-secondary','alert-success','alert-danger',
  'alert-warning','alert-info','alert-light','alert-dark',
];

export class Alert extends Block {
  static type = 'alert';
  static label = 'Alerta';
  static icon = 'exclamation-triangle';
  static category = 'bootstrap';
  static schema = {
    props: { text: 'Esta é uma mensagem informativa.', heading: '' },
    classes: ['alert', 'alert-primary'],
    attrs: { role: 'alert' },
  };
  static essentialClasses = ['alert'];
  static allowedChildren = null;
  static editableProp = 'text';
  static editableMultiline = true;
  /**
   * Fast-path: só a mensagem (`text`, no `<p class="mb-0">`) atualiza in-place.
   * `heading` cria/remove o `<h4>` condicional → cai no re-render normal.
   */
  static fastUpdate = { text: { target: 'p.mb-0' } };

  static render(node) {
    const div = document.createElement('div');
    if (node.props.heading) {
      const h = document.createElement('h4');
      h.className = 'alert-heading';
      h.textContent = node.props.heading;
      div.appendChild(h);
    }
    const p = document.createElement('p');
    p.className = 'mb-0';
    p.textContent = node.props.text ?? '';
    div.appendChild(p);
    return div;
  }

  static settings(node) {
    return [
      { tab: 'content', type: 'text', label: 'Cabeçalho (opcional)',
        bind: { kind: 'prop', key: 'heading' } },
      { tab: 'content', type: 'textarea', label: 'Mensagem',
        bind: { kind: 'prop', key: 'text' } },

      { tab: 'style', type: 'select', label: 'Variante semântica',
        help: 'Atalho Bootstrap para alert-* (cor + ícone implícito). Use os controles de cor abaixo para custom/gradiente.',
        options: VARIANTS.map((v) => ({ value: v, label: v.replace('alert-', '') })),
        bind: { kind: 'classGroup', group: VARIANTS } },

      ...colorControl('text', 'Cor do texto'),
      ...colorControl('bg', 'Cor de fundo'),

      ...spacingControls(),
      ...advancedControls(),
    ];
  }
}
