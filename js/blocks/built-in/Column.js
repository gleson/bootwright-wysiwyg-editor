import { Block } from '../Block.js';
import { spacingControls, advancedControls,
  borderControls, shadowControl, sizingControls,
  themeControl, subtleColorControls, positionControls } from '../common-controls.js';

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
      { tab: 'style', type: 'select', label: 'Largura (col)',
        help: 'Use o switch de breakpoint acima para larguras por tela '
            + '(ex.: 12/12 no mobile, 6/12 a partir do MD).',
        options: [
          { value: '',         label: '— herdar (do menor) —' },
          { value: 'col-{bp}', label: 'Auto (igual)' },
          ...[1,2,3,4,5,6,7,8,9,10,11,12].map((n) => ({ value: `col-{bp}-${n}`, label: `${n}/12` })),
        ],
        bind: { kind: 'classGroup', responsive: true,
          group: ['col-{bp}','col-{bp}-1','col-{bp}-2','col-{bp}-3','col-{bp}-4',
                  'col-{bp}-5','col-{bp}-6','col-{bp}-7','col-{bp}-8','col-{bp}-9',
                  'col-{bp}-10','col-{bp}-11','col-{bp}-12'] } },
      { tab: 'style', type: 'select', label: 'Deslocamento (offset)',
        help: 'Empurra a coluna para a direita. Responsivo pelo switch de breakpoint.',
        options: [
          { value: '', label: '— nenhum —' },
          ...[1,2,3,4,5,6,7,8,9,10,11].map((n) => ({ value: `offset-{bp}-${n}`, label: `${n}/12` })),
        ],
        bind: { kind: 'classGroup', responsive: true,
          group: ['offset-{bp}-0','offset-{bp}-1','offset-{bp}-2','offset-{bp}-3',
                  'offset-{bp}-4','offset-{bp}-5','offset-{bp}-6','offset-{bp}-7',
                  'offset-{bp}-8','offset-{bp}-9','offset-{bp}-10','offset-{bp}-11'] } },
      { tab: 'style', type: 'select', label: 'Ordem',
        help: 'Reordena a coluna visualmente sem mexer no HTML. Responsivo.',
        options: [
          { value: '',                 label: '— padrão —' },
          { value: 'order-{bp}-first', label: 'Primeira' },
          { value: 'order-{bp}-0',     label: '0' },
          { value: 'order-{bp}-1',     label: '1' },
          { value: 'order-{bp}-2',     label: '2' },
          { value: 'order-{bp}-3',     label: '3' },
          { value: 'order-{bp}-4',     label: '4' },
          { value: 'order-{bp}-5',     label: '5' },
          { value: 'order-{bp}-last',  label: 'Última' },
        ],
        bind: { kind: 'classGroup', responsive: true,
          group: ['order-{bp}-first','order-{bp}-0','order-{bp}-1','order-{bp}-2',
                  'order-{bp}-3','order-{bp}-4','order-{bp}-5','order-{bp}-last'] } },
      { tab: 'style', type: 'radio-group', label: 'Alinhamento vertical',
        options: [
          { value: 'align-self-{bp}-start',  label: 'Topo', icon: 'align-top' },
          { value: 'align-self-{bp}-center', label: 'Meio', icon: 'align-middle' },
          { value: 'align-self-{bp}-end',    label: 'Base', icon: 'align-bottom' },
        ],
        bind: { kind: 'classGroup', responsive: true,
          group: ['align-self-{bp}-start','align-self-{bp}-center','align-self-{bp}-end'] } },
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

      ...borderControls(),
      ...shadowControl(),
      ...sizingControls(),
      ...themeControl(),
      ...subtleColorControls(),
      ...spacingControls(),
      ...positionControls(),
      ...advancedControls(),
    ];
  }
}
