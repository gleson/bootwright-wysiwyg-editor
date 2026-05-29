import { Block } from '../Block.js';
import { spacingControls, advancedControls, colorControl } from '../common-controls.js';

/**
 * Section — container Bootstrap de nível superior.
 *
 * Renderiza como <section class="container">. Para alternar fluid/centered,
 * o painel direito (Fase 4) trocará a classe `container` por `container-fluid`
 * — este bloco não carrega esse estado em props.
 */
export class Section extends Block {
  static type = 'section';
  static label = 'Seção';
  static icon = 'square';
  static schema = {
    props: {},
    classes: ['container'],
    attrs: {},
  };
  static allowedChildren = '*';

  static render(node) {
    return document.createElement('section');
  }

  static settings(node) {
    return [
      { tab: 'style', type: 'toggle', label: 'Largura',
        toggleLabel: 'Container fluido (sem max-width)',
        bind: { kind: 'classToggle',
          class: 'container-fluid',
          removes: ['container'],
          addsWhenOff: ['container'] } },
      { tab: 'style', type: 'select', label: 'Padding vertical',
        options: [
          { value: '',     label: '— nenhum —' },
          { value: 'py-1', label: '1' },
          { value: 'py-2', label: '2' },
          { value: 'py-3', label: '3' },
          { value: 'py-4', label: '4' },
          { value: 'py-5', label: '5' },
        ],
        bind: { kind: 'classGroup',
          group: ['py-0','py-1','py-2','py-3','py-4','py-5'] } },
      ...colorControl('bg', 'Cor de fundo'),
      ...colorControl('text', 'Cor do texto'),

      ...spacingControls(),
      ...advancedControls(),
    ];
  }
}
