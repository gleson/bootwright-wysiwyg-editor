import { Block } from '../Block.js';
import { spacingControls, advancedControls, colorControl,
  borderControls, shadowControl, sizingControls,
  themeControl, subtleColorControls, positionControls } from '../common-controls.js';

/**
 * Section — container Bootstrap de nível superior.
 *
 * Renderiza como <section class="container">. O controle "Largura" no painel
 * direito troca entre `container`, `container-fluid` e nenhuma das duas
 * ("sem container", para páginas que já embrulham o conteúdo num container e
 * ganhariam padding lateral duplicado) — este bloco não carrega esse estado
 * em props, é só classe.
 *
 * Section NÃO é obrigatória: parágrafos, títulos, rows e qualquer outro bloco
 * podem ser inseridos direto na raiz do canvas (ver Editor.loadJSON/Renderer).
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
      { tab: 'style', type: 'select', label: 'Largura',
        help: 'Escolha "Sem container" quando a página que hospeda o conteúdo '
            + 'já tiver um `.container` — evita padding lateral duplicado.',
        options: [
          { value: 'container',       label: 'Container centralizado' },
          { value: 'container-fluid', label: 'Container fluido (100%)' },
          { value: '',                label: 'Sem container (herda do site)' },
        ],
        bind: { kind: 'classGroup', group: ['container', 'container-fluid'] } },
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
      ...themeControl(),
      ...subtleColorControls(),

      ...borderControls(),
      ...shadowControl(),
      ...sizingControls(),
      ...spacingControls(),
      ...positionControls(),
      ...advancedControls(),
    ];
  }
}
