import { Block } from '../Block.js';
import { spacingControls, advancedControls } from '../common-controls.js';

/**
 * DjangoVar — placeholder de variável Django `{{ expression }}`.
 *
 * - Renderiza como `<span>{{ expression }}</span>` com `data-django-var` para o
 *   CSS do canvas marcar como badge roxo.
 * - Na exportação, `data-django-var` é removido pelo `_stripEditorAttrs` do
 *   Editor (lista atualizada). Sobra `<span>{{ expression }}</span>` — o
 *   Django interpreta a expressão no render e o `<span>` fica como wrapper
 *   neutro (pode receber classes/atributos pelo painel se o usuário quiser).
 *
 * Decisão v1: o bloco é block-level (não inline) porque o Editor não suporta
 * blocos inline. Para variáveis dentro de uma frase, o usuário escreve
 * `{{ var }}` diretamente no parágrafo — o sanitize preserva o texto.
 */
export class DjangoVar extends Block {
  static type = 'variable';
  static label = 'Variável Django';
  static icon = 'braces-asterisk';
  static category = 'elements';
  static schema = {
    props: { expression: 'user.username' },
    classes: [],
    attrs: {},
  };
  static allowedChildren = null;
  static editableProp = 'expression';

  /** Inline edit: troca o `{{ … }}` decorado pela expressão pura. */
  static getInlineEditTarget(blockEl, _eventTarget, node) {
    blockEl.textContent = String(node.props.expression ?? '');
    return {
      element: blockEl,
      read:  (n) => n.props.expression ?? '',
      write: (_, v) => ({ props: { expression: String(v).replace(/^\{\{\s*|\s*\}\}$/g, '') } }),
    };
  }

  static render(node) {
    const span = document.createElement('span');
    span.dataset.djangoVar = '';
    span.textContent = `{{ ${String(node.props.expression || '').trim() || '…'} }}`;
    return span;
  }

  static settings() {
    return [
      { tab: 'content', type: 'text', label: 'Expressão',
        help: 'Sem `{{ }}` — ex.: `user.username` ou `post.title|upper`.',
        bind: { kind: 'prop', key: 'expression' } },
      ...spacingControls(),
      ...advancedControls(),
    ];
  }
}
