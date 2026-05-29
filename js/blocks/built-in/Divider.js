import { Block } from '../Block.js';
import { spacingControls, advancedControls } from '../common-controls.js';

export class Divider extends Block {
  static type = 'divider';
  static label = 'Divisor';
  static icon = 'dash-lg';
  static schema = {
    props: {},
    classes: [],
    attrs: {},
  };
  static allowedChildren = null;

  static render(node) {
    return document.createElement('hr');
  }

  static settings(node) {
    return [
      { tab: 'style', type: 'select', label: 'Espessura',
        options: [
          { value: '',         label: '1px (padrão)' },
          { value: 'border-2', label: '2px' },
          { value: 'border-3', label: '3px' },
          { value: 'border-4', label: '4px' },
          { value: 'border-5', label: '5px' },
        ],
        bind: { kind: 'classGroup',
          group: ['border-2','border-3','border-4','border-5'] } },
      { tab: 'style', type: 'select', label: 'Cor',
        options: [
          { value: '',                    label: '— padrão —' },
          { value: 'border-primary',      label: 'Primária' },
          { value: 'border-secondary',    label: 'Secundária' },
          { value: 'border-success',      label: 'Sucesso' },
          { value: 'border-danger',       label: 'Perigo' },
          { value: 'border-warning',      label: 'Aviso' },
        ],
        bind: { kind: 'classGroup',
          group: ['border-primary','border-secondary','border-success',
                  'border-danger','border-warning'] } },

      ...spacingControls(),
      ...advancedControls(),
    ];
  }
}
