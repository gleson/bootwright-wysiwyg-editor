import { Block } from '../Block.js';
import { spacingControls, advancedControls } from '../common-controls.js';
import { highlight, listLanguages } from '../../utils/syntaxHighlight.js';

/**
 * Code — bloco `<pre><code>` com destaque de sintaxe.
 *
 * - `props.code` é o código cru (textContent). `props.language` controla o
 *   highlighter; também vai na classe `language-X` (compatível com Prism/Shiki
 *   se o usuário substituir por outro highlighter no runtime).
 * - O canvas mostra o código já com spans de destaque. Para editar, o usuário
 *   dá duplo-clique — `getInlineEditTarget` substitui o innerHTML pelo
 *   textContent puro (sem spans) antes de habilitar contenteditable. O commit
 *   do inline-edit reescreve `props.code` e o Renderer re-renderiza com
 *   highlight novamente.
 */
export class Code extends Block {
  static type = 'code';
  static label = 'Código';
  static icon = 'code-square';
  static category = 'basic';
  static schema = {
    props: {
      code: 'function hello(name) {\n  return `Olá, ${name}!`;\n}',
      language: 'javascript',
    },
    classes: [],
    attrs: {},
  };
  static allowedChildren = null;
  static editableProp = 'code';
  static editableMultiline = true;

  static render(node) {
    const pre = document.createElement('pre');
    pre.className = 'editor-code-block';
    const codeEl = document.createElement('code');
    const lang = String(node.props.language || 'plain');
    codeEl.className = `language-${lang}`;
    codeEl.innerHTML = highlight(String(node.props.code ?? ''), lang);
    pre.appendChild(codeEl);
    return pre;
  }

  /**
   * Duplo-clique entra em edição: substitui o innerHTML destacado por
   * textContent puro pra o usuário ver/digitar o código limpo.
   * Após commit, o Renderer re-renderiza com highlight aplicado.
   */
  static getInlineEditTarget(blockEl, _eventTarget, node) {
    const codeEl = blockEl.querySelector('code');
    if (!codeEl) return null;
    codeEl.textContent = node.props.code ?? '';
    return {
      element: codeEl,
      read:  (n) => n.props.code ?? '',
      write: (_, v) => ({ props: { code: v } }),
    };
  }

  static settings() {
    const langs = listLanguages();
    return [
      { tab: 'content', type: 'textarea', label: 'Código',
        help: 'Duplo-clique no canvas para editar com highlight desligado.',
        bind: { kind: 'prop', key: 'code' } },
      { tab: 'content', type: 'select', label: 'Linguagem',
        options: langs.map((l) => ({ value: l, label: l })),
        bind: { kind: 'prop', key: 'language' } },

      ...spacingControls(),
      ...advancedControls(),
    ];
  }
}
