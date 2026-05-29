import { Block } from '../Block.js';
import { spacingControls, advancedControls } from '../common-controls.js';

const SPIN_TYPES = ['spinner-border', 'spinner-grow'];
const COLORS = [
  'text-primary','text-secondary','text-success','text-danger',
  'text-warning','text-info','text-dark',
];

export class Spinner extends Block {
  static type = 'spinner';
  static label = 'Spinner';
  static icon = 'arrow-clockwise';
  static category = 'bootstrap';
  static schema = {
    props: {},
    classes: ['spinner-border', 'text-primary'],
    attrs: { role: 'status' },
  };
  /** Spinner sempre precisa de um tipo (border|grow) — preserva no clear. */
  static essentialClasses = ['spinner-border'];
  static allowedChildren = null;

  static render(node) {
    const div = document.createElement('div');
    const hidden = document.createElement('span');
    hidden.className = 'visually-hidden';
    hidden.textContent = 'Carregando...';
    div.appendChild(hidden);
    return div;
  }

  static settings(node) {
    return [
      { tab: 'style', type: 'select', label: 'Tipo',
        options: [
          { value: 'spinner-border', label: 'Border (giratório)' },
          { value: 'spinner-grow',   label: 'Grow (pulsante)' },
        ],
        bind: { kind: 'classGroup', group: SPIN_TYPES } },
      { tab: 'style', type: 'select', label: 'Cor',
        options: [
          { value: '', label: '— padrão —' },
          ...COLORS.map((v) => ({ value: v, label: v.replace('text-', '') })),
        ],
        bind: { kind: 'classGroup', group: COLORS } },
      { tab: 'style', type: 'toggle', label: 'Compacto',
        toggleLabel: 'spinner-border-sm / spinner-grow-sm',
        bind: { kind: 'classToggle', class: 'spinner-border-sm',
          removes: ['spinner-grow-sm'] } },

      ...spacingControls(),
      ...advancedControls(),
    ];
  }
}
