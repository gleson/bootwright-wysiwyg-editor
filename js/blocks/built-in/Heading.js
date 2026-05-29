import { Block } from '../Block.js';
import { spacingControls, advancedControls, colorControl, typographyControl } from '../common-controls.js';

/**
 * Heading — h1 a h6, controlado por props.level.
 *
 * Texto vai por textContent (XSS-safe nativamente). Quando o nível muda,
 * o Renderer re-renderiza o subtree (cria um novo elemento <hN>).
 */
export class Heading extends Block {
  static type = 'heading';
  static label = 'Título';
  static icon = 'type-h1';
  static schema = {
    props: { level: 2, text: 'Novo título' },
    classes: [],
    attrs: {},
  };
  static allowedChildren = null;
  /** Prop editável via duplo-clique (inline edit). */
  static editableProp = 'text';
  /**
   * Fast-path: só `props.text` atualiza in-place (textContent do `<hN>`).
   * Mudança de `level` troca a tag → não está no descritor → re-render.
   */
  static fastUpdate = { text: { target: 'self' } };

  static render(node) {
    const level = Math.min(6, Math.max(1, Number(node.props.level) || 2));
    const el = document.createElement('h' + level);
    el.textContent = node.props.text ?? '';
    return el;
  }

  static settings(node) {
    return [
      { tab: 'content', type: 'text', label: 'Texto',
        bind: { kind: 'prop', key: 'text' } },
      { tab: 'content', type: 'select', label: 'Nível',
        options: [1,2,3,4,5,6].map((n) => ({ value: n, label: `H${n}` })),
        bind: { kind: 'prop', key: 'level' } },

      { tab: 'style', type: 'radio-group', label: 'Alinhamento',
        help: 'Use o switch de breakpoint no topo para variar por tamanho de tela.',
        options: [
          { value: 'text-{bp}-start',  label: 'Esquerda', icon: 'text-left' },
          { value: 'text-{bp}-center', label: 'Centro',   icon: 'text-center' },
          { value: 'text-{bp}-end',    label: 'Direita',  icon: 'text-right' },
        ],
        bind: { kind: 'classGroup', responsive: true,
          group: ['text-{bp}-start', 'text-{bp}-center', 'text-{bp}-end'] } },
      ...typographyControl(),
      ...colorControl('text', 'Cor do texto'),
      ...colorControl('bg', 'Cor de fundo'),

      ...spacingControls(),
      ...advancedControls(),
    ];
  }
}
