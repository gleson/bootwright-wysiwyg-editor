/**
 * Tipos que não devem se aninhar em si mesmos quando inseridos pelo usuário.
 * Tecnicamente o `allowedChildren='*'` desses blocos permitiria, mas a UX
 * esperada é "outra coluna ao lado, não dentro" — mesma intuição vale para
 * row dentro de row.
 */
const NO_SELF_NEST = new Set(['column', 'row']);

/**
 * Decide para onde inserir um bloco do tipo `type`, dado o estado de seleção
 * atual do editor. Compartilhado pela SidebarLeft (clique em tile) e pela
 * CommandPalette (Insert via Ctrl+K).
 *
 * Regra resumida (ver SidebarLeft._insertBlock para a versão narrativa):
 *  1. Sem seleção → root, append.
 *  2. Self-nest proibido (column→column, row→row) → sibling no pai.
 *  3. Selecionado aceita o tipo → dentro dele, append.
 *  4. Pai do selecionado aceita o tipo → sibling do selecionado.
 *  5. Fallback → root, append.
 *
 * Devolve `{ parentId, index }` (index undefined = append no fim).
 */
export function resolveInsertTarget(editor, type) {
  const fallback = { parentId: editor.rootId, index: undefined };
  const selectedId = editor.getSelectedId();
  if (!selectedId) return fallback;
  const selNode = editor.getNode(selectedId);
  if (!selNode) return fallback;

  // Regra 2: evita aninhamento do mesmo tipo (column-em-column, row-em-row).
  if (selNode.type === type && NO_SELF_NEST.has(type)) {
    return siblingOf(editor, selectedId, type) ?? fallback;
  }

  // Regra 3: insere dentro do selecionado se ele aceitar.
  if (acceptsChild(editor, selNode, type)) {
    return { parentId: selectedId, index: undefined };
  }

  // Regra 4: sibling do selecionado.
  return siblingOf(editor, selectedId, type) ?? fallback;
}

/** Devolve `{parentId, index}` para inserir como irmão imediatamente após `id`,
 *  ou null se o pai não aceitar o tipo. */
function siblingOf(editor, id, type) {
  const parent = editor.getParentOf(id);
  if (!parent) return null;
  if (!acceptsChild(editor, parent, type)) return null;
  const idx = parent.children.findIndex((c) => c.id === id);
  return { parentId: parent.id, index: idx >= 0 ? idx + 1 : undefined };
}

function acceptsChild(editor, node, type) {
  const Class = editor.registry.get(node.type);
  const allowed = Class?.allowedChildren;
  if (allowed === '*') return true;
  if (Array.isArray(allowed)) return allowed.includes(type);
  return false;
}
