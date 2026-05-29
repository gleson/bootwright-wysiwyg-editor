import { Block } from './Block.js';
import { spacingControls, advancedControls } from './common-controls.js';

/**
 * Cria uma subclasse de `Block` para uma instância de componente
 * personalizado. A diferença entre **componente** e **snippet**:
 *
 *   - **Snippet** (CustomSnippet.js) — fork-on-insert: o HTML do master é
 *     copiado para `node.props.html` no momento da inserção. Editar o
 *     master NÃO atualiza instâncias já no canvas (a menos que o usuário
 *     marque "propagar").
 *   - **Componente** (este) — sincronizado: a instância NÃO copia a
 *     subárvore. Em render, o Renderer chama `getEffectiveChildren` que
 *     devolve a árvore atual do master. Editar o master atualiza TODAS as
 *     instâncias automaticamente no próximo render.
 *
 * As crianças renderizadas vêm da árvore do master e ficam "frozen": sem
 * `data-block-id`, então clicar dentro da instância seleciona o bloco da
 * instância, não os filhos do master. Para editar o master, o usuário usa
 * "Editar componente" (banner igual ao de templates).
 *
 * Para "destacar" uma instância (transformar em árvore normal editável),
 * existe `editor.detachComponentInstance(id)` — converte a instância em
 * uma cópia profunda da master com IDs novos.
 */
export function createComponentBlockClass(meta) {
  return class ComponentInstance extends Block {
    static type = meta.type;       // 'component:<id8>'
    static label = meta.name;
    static icon = meta.icon || 'box-seam';
    static category = 'components';
    static componentId = meta.id;  // ref ao master em customizations
    static schema = {
      props: {},
      classes: ['editor-component-instance'],
      attrs: {},
    };
    static essentialClasses = ['editor-component-instance'];
    static allowedChildren = null;

    /**
     * Render apenas o wrapper. O Renderer detecta `getEffectiveChildren`
     * abaixo e popula com a árvore do master (modo frozen).
     *
     * Se o master foi deletado, renderiza um placeholder explicativo no
     * próprio wrapper (skip getEffectiveChildren via early return).
     */
    static render(node, ctx) {
      const wrap = document.createElement('div');
      wrap.dataset.componentId = meta.id;
      const master = ctx?.editor?.customizations?.getComponent(meta.id);
      if (!master?.tree) {
        wrap.classList.add('editor-component-instance--missing');
        const msg = document.createElement('p');
        msg.className = 'small text-muted m-0 p-2';
        msg.textContent = `Componente "${meta.name}" foi removido. ` +
          'Selecione e clique em "Desconectar do master" para liberar a árvore (vazia).';
        wrap.appendChild(msg);
      }
      return wrap;
    }

    /**
     * Devolve a subárvore atual do master para o Renderer usar no lugar
     * de node.children. Quando master ausente, devolve [] (o placeholder
     * já está no `render`).
     */
    static getEffectiveChildren(node, ctx) {
      const master = ctx?.editor?.customizations?.getComponent(meta.id);
      if (!master?.tree) return [];
      // Devolve a árvore inteira (1 nó) para que o Renderer pinte a
      // raiz do master + descendentes recursivamente.
      return [master.tree];
    }

    static settings(node) {
      return [
        { tab: 'content', type: 'action',
          label: 'Editar componente (atualiza todas as instâncias)',
          icon: 'pencil-square',
          onClick: (n, ctx) => {
            ctx?.editor?.loadComponentForEdit(meta.id);
            return null;
          } },
        { tab: 'content', type: 'action',
          label: 'Desconectar do master (vira árvore editável)',
          icon: 'scissors',
          onClick: (n, ctx) => {
            ctx?.editor?.detachComponentInstance(n.id);
            return null;
          } },
        ...spacingControls(),
        ...advancedControls(),
      ];
    }
  };
}
