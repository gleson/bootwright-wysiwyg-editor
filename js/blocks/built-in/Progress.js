import { Block } from '../Block.js';
import { spacingControls, advancedControls } from '../common-controls.js';

const BAR_VARIANTS = [
  'bg-primary','bg-secondary','bg-success','bg-danger',
  'bg-warning','bg-info','bg-dark',
];

export class Progress extends Block {
  static type = 'progress';
  static label = 'Progresso';
  static icon = 'reception-3';
  static category = 'bootstrap';
  static schema = {
    props: {
      value: 50, label: '',
      variant: 'bg-primary',
      striped: false, animated: false,
    },
    classes: ['progress'],
    attrs: {},
  };
  static essentialClasses = ['progress'];
  static allowedChildren = null;

  static render(node) {
    const wrap = document.createElement('div');
    const bar = document.createElement('div');
    let cls = 'progress-bar';
    if (node.props.variant)  cls += ' ' + node.props.variant;
    if (node.props.striped)  cls += ' progress-bar-striped';
    if (node.props.animated) cls += ' progress-bar-animated';
    bar.className = cls;
    bar.setAttribute('role', 'progressbar');
    const v = Math.max(0, Math.min(100, Number(node.props.value) || 0));
    bar.style.width = `${v}%`;
    bar.setAttribute('aria-valuenow', String(v));
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');
    bar.textContent = node.props.label || `${v}%`;
    wrap.appendChild(bar);
    return wrap;
  }

  static settings(node) {
    return [
      { tab: 'content', type: 'range', label: 'Valor (%)',
        min: 0, max: 100, step: 1,
        bind: { kind: 'prop', key: 'value' } },
      { tab: 'content', type: 'text', label: 'Rótulo (vazio = mostra %)',
        bind: { kind: 'prop', key: 'label' } },

      { tab: 'style', type: 'select', label: 'Cor da barra',
        options: BAR_VARIANTS.map((v) => ({ value: v, label: v.replace('bg-', '') })),
        bind: { kind: 'prop', key: 'variant' } },
      { tab: 'style', type: 'toggle', label: 'Listrada',
        toggleLabel: 'progress-bar-striped',
        bind: { kind: 'prop', key: 'striped' } },
      { tab: 'style', type: 'toggle', label: 'Animada',
        toggleLabel: 'progress-bar-animated (move as listras)',
        bind: { kind: 'prop', key: 'animated' } },

      ...spacingControls(),
      ...advancedControls(),
    ];
  }
}
