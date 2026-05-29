import { Block } from '../Block.js';
import { spacingControls, advancedControls } from '../common-controls.js';

export class Column extends Block {
  static type = 'column';
  static label = 'Coluna';
  static icon = 'layout-three-columns';
  static schema = {
    props: {},
    classes: ['col'],
    attrs: {},
  };
  static allowedChildren = '*';

  static render(node) {
    return document.createElement('div');
  }

  static settings(node) {
    return [
      { tab: 'style', type: 'select', label: 'Largura (col-)',
        options: [
          { value: 'col', label: 'Auto (igual)' },
          ...[1,2,3,4,5,6,7,8,9,10,11,12].map((n) => ({ value: `col-${n}`, label: `${n}/12` })),
        ],
        bind: { kind: 'classGroup',
          group: ['col','col-1','col-2','col-3','col-4','col-5','col-6',
                  'col-7','col-8','col-9','col-10','col-11','col-12'] } },
      { tab: 'style', type: 'select', label: 'Padding interno',
        options: [
          { value: '',    label: '— nenhum —' },
          { value: 'p-1', label: '1' },
          { value: 'p-2', label: '2' },
          { value: 'p-3', label: '3' },
          { value: 'p-4', label: '4' },
          { value: 'p-5', label: '5' },
        ],
        bind: { kind: 'classGroup',
          group: ['p-0','p-1','p-2','p-3','p-4','p-5'] } },

      ...spacingControls(),
      ...advancedControls(),
    ];
  }
}
