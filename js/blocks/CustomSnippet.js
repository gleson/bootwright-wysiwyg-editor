import { Block } from './Block.js';
import { spacingControls, advancedControls } from './common-controls.js';

/**
 * Cria dinamicamente uma subclasse de Block para um snippet HTML personalizado.
 *
 * Cada snippet vira um "tipo" próprio no BlockRegistry (ex.: type='snippet:abc'),
 * preservando o pipeline normal de render/serialize/inspector.
 *
 * meta: { id, type, name, icon, html }
 *   - `meta.html` é o template inicial; cada instância copia em `node.props.html`.
 *   - Edição posterior do snippet no diálogo NÃO afeta nós já inseridos
 *     (props.html é o estado de cada instância — comportamento "fork on insert").
 */
export function createCustomSnippetBlockClass(meta) {
  const TYPE  = meta.type;
  const LABEL = meta.name;
  const ICON  = meta.icon || 'puzzle';
  const TEMPLATE = meta.html ?? '';

  return class CustomSnippetBlock extends Block {
    static type = TYPE;
    static label = LABEL;
    static icon = ICON;
    static category = 'custom';
    static schema = {
      props: { html: TEMPLATE },
      classes: [],
      attrs: {},
    };
    static essentialClasses = [];
    static allowedChildren = null;
    /** Marcador para diferenciar snippets dos blocos built-in. */
    static isCustomSnippet = true;
    static customMeta = { ...meta };

    static render(node, ctx) {
      const wrap = document.createElement('div');
      wrap.className = 'editor-snippet-wrapper';
      try {
        wrap.innerHTML = ctx.sanitizer.html(node.props.html ?? '');
      } catch (err) {
        wrap.textContent = `[Snippet bloqueado: ${err.message}]`;
        wrap.style.color = '#92400e';
        wrap.style.background = '#fef3c7';
        wrap.style.padding = '0.5rem';
        wrap.style.fontFamily = 'monospace';
      }
      return wrap;
    }

    static settings(node) {
      return [
        { tab: 'content', type: 'textarea', label: 'HTML do snippet',
          help: 'Sanitizado via DOMPurify. Editar aqui só altera esta instância.',
          bind: { kind: 'prop', key: 'html' } },

        ...spacingControls(),
        ...advancedControls(),
      ];
    }
  };
}
