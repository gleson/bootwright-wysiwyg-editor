import { Block } from '../Block.js';
import { spacingControls, advancedControls, colorControl } from '../common-controls.js';

const COMMON = [
  'star','star-fill','heart','heart-fill','check-circle','check-circle-fill',
  'x-circle','info-circle','exclamation-triangle','lightbulb','lightning',
  'gear','house','envelope','telephone','geo-alt','calendar','clock',
  'arrow-right','arrow-left','arrow-up','arrow-down','arrow-right-circle',
  'cart','bag','person','people','globe','search','bell',
  'instagram','facebook','twitter-x','linkedin','github','youtube','whatsapp',
  'play-circle','pause-circle','download','upload','share','link-45deg',
];

export class Icon extends Block {
  static type = 'icon';
  static label = 'Ícone';
  static icon = 'star-fill';
  static schema = {
    props: { name: 'star-fill', size: 2 }, // size em rem
    classes: [],
    attrs: { 'aria-hidden': 'true' },
  };
  static allowedChildren = null;

  static render(node) {
    const i = document.createElement('i');
    const name = node.props.name ?? 'square';
    i.className = `bi bi-${name}`;
    i.style.fontSize = `${Number(node.props.size) || 1}rem`;
    return i;
  }

  static settings(node) {
    return [
      { tab: 'content', type: 'action', label: 'Escolher ícone…',
        icon: 'grid-3x3-gap',
        onClick: (n, ctx) => {
          ctx.editor.ui.iconPicker?.pick((name) => {
            ctx.editor.updateBlock(n.id, { props: { name } });
          });
          // updateBlock acontece assincronamente quando o usuário escolhe;
          // não devolve patch aqui pra evitar update vazio.
        } },
      { tab: 'content', type: 'select', label: 'Atalhos (comuns)',
        options: COMMON.map((n) => ({ value: n, label: n })),
        bind: { kind: 'prop', key: 'name' } },
      { tab: 'content', type: 'text', label: 'Nome customizado',
        help: 'Sobrescreve a seleção. Lista completa: icons.getbootstrap.com.',
        bind: { kind: 'prop', key: 'name' } },
      { tab: 'content', type: 'range', label: 'Tamanho (rem)',
        min: 0.5, max: 8, step: 0.5,
        bind: { kind: 'prop', key: 'size' } },

      ...colorControl('text', 'Cor'),

      ...spacingControls(),
      ...advancedControls(),
    ];
  }
}
