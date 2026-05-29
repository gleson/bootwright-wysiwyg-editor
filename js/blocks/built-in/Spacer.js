import { Block } from '../Block.js';
import { advancedControls } from '../common-controls.js';

export class Spacer extends Block {
  static type = 'spacer';
  static label = 'Espaçador';
  static icon = 'arrows-expand';
  static schema = {
    props: { height: 2 }, // em rem
    classes: [],
    attrs: { 'aria-hidden': 'true' },
  };
  static allowedChildren = null;

  static render(node) {
    const div = document.createElement('div');
    const h = Number(node.props.height) || 0;
    div.style.height = `${h}rem`;
    return div;
  }

  static settings(node) {
    return [
      { tab: 'content', type: 'range', label: 'Altura (rem)',
        min: 0, max: 10, step: 0.5,
        bind: { kind: 'prop', key: 'height' } },
      ...advancedControls(),
    ];
  }
}
