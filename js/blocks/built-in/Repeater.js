import { Block } from '../Block.js';
import { spacingControls, advancedControls, colorControl } from '../common-controls.js';

/**
 * Repeater — container que vira um loop `{% for %}` do Django na exportação.
 *
 * No canvas é um `<div>` comum: os blocos-filhos representam o **molde de uma
 * iteração** (o usuário digita `{{ item.campo }}` direto nos textos dos filhos).
 * Na exportação, `decorateExport()` embrulha os filhos em
 * `{% for <itemVar> in <listVar> %}` … `{% endfor %}`.
 *
 * Dica de uso: para um grid repetido, coloque a classe `row` no próprio Repeater
 * e Colunas como filhos — o `{% for %}` fica dentro da row, sem div extra.
 */
export class Repeater extends Block {
  static type = 'repeater';
  static label = 'Repetidor (Django)';
  static icon = 'arrow-repeat';
  static category = 'elements';
  static schema = {
    props: {
      itemVar: 'item',
      listVar: 'items',
    },
    classes: [],
    attrs: {},
  };
  static allowedChildren = '*';

  static render(node) {
    const div = document.createElement('div');
    const item = (node.props.itemVar || 'item').trim();
    const list = (node.props.listVar || 'items').trim();
    // Lido pelo CSS do canvas (badge ::before). Removido na exportação por
    // _stripEditorAttrs — ver Editor.js.
    div.dataset.repeaterLabel = `for ${item} in ${list}`;
    return div;
  }

  /**
   * Hook de exportação (ver Block.js). Embrulha os filhos já renderizados no
   * `{% for %}` do Django, como nós de texto — sobrevivem ao `outerHTML`.
   */
  static decorateExport(node, element) {
    const item = (node.props.itemVar || 'item').trim();
    const list = (node.props.listVar || 'items').trim();
    element.insertBefore(
      document.createTextNode(`{% for ${item} in ${list} %}`),
      element.firstChild,
    );
    element.appendChild(document.createTextNode('{% endfor %}'));
  }

  static settings(node) {
    return [
      { tab: 'content', type: 'text', label: 'Variável do item',
        help: 'Nome usado em cada iteração. Ex.: `item` → `{{ item.titulo }}`.',
        bind: { kind: 'prop', key: 'itemVar' } },
      { tab: 'content', type: 'text', label: 'Variável da lista',
        help: 'Variável de contexto do Django a iterar. Ex.: `produtos`.',
        bind: { kind: 'prop', key: 'listVar' } },

      ...colorControl('bg', 'Cor de fundo'),
      ...spacingControls(),
      ...advancedControls(),
    ];
  }
}
