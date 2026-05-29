import { Block } from '../Block.js';
import { spacingControls, advancedControls } from '../common-controls.js';

/**
 * HtmlEmbed — HTML cru sanitizado via DOMPurify antes de injetar.
 * Scripts e iframes inseguros são removidos pela sanitização.
 */
export class HtmlEmbed extends Block {
  static type = 'html';
  static label = 'HTML';
  static icon = 'code-slash';
  static schema = {
    props: { html: '<div class="alert alert-info">HTML personalizado</div>' },
    classes: [],
    attrs: {},
  };
  static allowedChildren = null;

  static render(node, ctx) {
    const wrap = document.createElement('div');
    try {
      wrap.innerHTML = ctx.sanitizer.html(node.props.html ?? '');
    } catch (err) {
      wrap.textContent = `[HTML bloqueado: ${err.message}]`;
      wrap.style.color = '#92400e';
      wrap.style.background = '#fef3c7';
      wrap.style.padding = '0.5rem';
      wrap.style.fontFamily = 'monospace';
    }
    return wrap;
  }

  static settings(node) {
    return [
      { tab: 'content', type: 'textarea', label: 'HTML',
        help: 'Sanitizado via DOMPurify. Tags inseguras (script, style, iframe, on*) são REMOVIDAS — ao tirar o foco do campo o source é reescrito com o HTML limpo.',
        bind: { kind: 'prop', key: 'html' },
        // Hook chamado quando o usuário tira o foco do textarea: reescreve o
        // source com a versão sanitizada para deixar claro o que foi removido.
        sanitizeOnBlur: true },

      ...spacingControls(),
      ...advancedControls(),
    ];
  }
}
