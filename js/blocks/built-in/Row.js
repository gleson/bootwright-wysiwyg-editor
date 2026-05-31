import { Block } from '../Block.js';
import { spacingControls, advancedControls,
  borderControls, shadowControl, gapControl,
  themeControl, subtleColorControls, positionControls } from '../common-controls.js';

export class Row extends Block {
  static type = 'row';
  static label = 'Linha';
  static icon = 'distribute-horizontal';
  static schema = {
    props: {},
    classes: ['row'],
    attrs: {},
  };
  // Aceita qualquer filho. Para usar a grid Bootstrap (auto-distribuir largura,
  // gutters, alinhamento), insira Columns manualmente — Row continua usando flex
  // do `.row`, então blocos não-Column ficam em linha por padrão.
  static allowedChildren = '*';

  static render(node) {
    return document.createElement('div');
  }

  static settings(node) {
    return [
      { tab: 'style', type: 'select', label: 'Espaçamento entre colunas (gutter)',
        options: [
          { value: '',    label: '— padrão —' },
          { value: 'g-0', label: '0' },
          { value: 'g-1', label: '1' },
          { value: 'g-2', label: '2' },
          { value: 'g-3', label: '3' },
          { value: 'g-4', label: '4' },
          { value: 'g-5', label: '5' },
        ],
        bind: { kind: 'classGroup',
          group: ['g-0','g-1','g-2','g-3','g-4','g-5'] } },
      { tab: 'style', type: 'radio-group', label: 'Alinhamento horizontal',
        options: [
          { value: 'justify-content-start',   label: 'Início',       icon: 'align-start' },
          { value: 'justify-content-center',  label: 'Centro',       icon: 'align-center' },
          { value: 'justify-content-end',     label: 'Fim',          icon: 'align-end' },
          { value: 'justify-content-between', label: 'Espaço entre', icon: 'distribute-horizontal' },
        ],
        bind: { kind: 'classGroup',
          group: ['justify-content-start','justify-content-center','justify-content-end',
                  'justify-content-between','justify-content-around','justify-content-evenly'] } },
      { tab: 'style', type: 'radio-group', label: 'Alinhamento vertical',
        options: [
          { value: 'align-items-start',   label: 'Topo',    icon: 'align-top' },
          { value: 'align-items-center',  label: 'Meio',    icon: 'align-middle' },
          { value: 'align-items-end',     label: 'Base',    icon: 'align-bottom' },
        ],
        bind: { kind: 'classGroup',
          group: ['align-items-start','align-items-center','align-items-end'] } },
      ...gapControl(),
      ...themeControl(),
      ...subtleColorControls(),

      ...borderControls(),
      ...shadowControl(),
      ...spacingControls(),
      ...positionControls(),
      ...advancedControls(),
    ];
  }
}
