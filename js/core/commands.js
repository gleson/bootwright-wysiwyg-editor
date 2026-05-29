/**
 * Comandos para o HistoryManager (Command Pattern).
 *
 * Cada comando encapsula uma mutação reversível na árvore e expõe:
 *   - label       : descrição curta (ex.: "Adicionar heading")
 *   - do()        : aplica a mutação
 *   - undo()      : reverte exatamente a mutação anterior
 *
 * Um comando pode ser executado mais de uma vez (do → undo → do = redo),
 * por isso guardamos o nó concreto criado/removido (com ID estável) em vez
 * de regerar.
 */

export class AddNodeCommand {
  constructor(state, parentId, data, index) {
    this.state = state;
    this.parentId = parentId;
    this.index = index;
    this.node = state.createNode(data);
    this.label = `Adicionar ${data.type}`;
  }
  do() {
    this.state.insertNode(this.node, this.parentId, this.index);
    return this.node.id;
  }
  undo() {
    this.state.detachNode(this.node.id);
  }
}

export class RemoveNodeCommand {
  constructor(state, id) {
    this.state = state;
    this.id = id;
    this._meta = null;
    this.label = 'Remover bloco';
  }
  do() {
    this._meta = this.state.detachNode(this.id);
  }
  undo() {
    this.state.insertNode(this._meta.node, this._meta.parentId, this._meta.index);
  }
}

export class UpdateNodeCommand {
  constructor(state, id, patch) {
    this.state = state;
    this.id = id;
    this.patch = patch;
    this._previous = null;
    this.label = 'Atualizar bloco';
  }
  do() {
    const node = this.state.getNode(this.id);
    if (!node) throw new Error(`[UpdateNodeCommand] nó "${this.id}" não existe.`);
    this._previous = {
      props:   { ...node.props },
      classes: [...node.classes],
      attrs:   { ...node.attrs },
    };
    this.state.mutateNode(this.id, {
      props:   this.patch.props   ? { ...node.props,   ...this.patch.props }   : node.props,
      classes: this.patch.classes ? [...this.patch.classes]                    : node.classes,
      attrs:   this.patch.attrs   ? { ...node.attrs,   ...this.patch.attrs }   : node.attrs,
    });
  }
  undo() {
    this.state.mutateNode(this.id, this._previous);
  }
}

/**
 * Agrupa N comandos como um único passo de histórico (undo/redo atômico).
 * `do()` executa em ordem; `undo()` reverte em ordem inversa.
 */
export class BatchCommand {
  constructor(commands, label) {
    this.commands = commands;
    this.label = label || 'Operação em lote';
  }
  do() {
    const results = [];
    for (const c of this.commands) results.push(c.do());
    return results;
  }
  undo() {
    for (let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i].undo();
    }
  }
}

export class MoveNodeCommand {
  constructor(state, id, newParentId, newIndex) {
    this.state = state;
    this.id = id;
    this.newParentId = newParentId;
    this.newIndex = newIndex;
    this._origin = null;
    this.label = 'Mover bloco';
  }
  do() {
    const parent = this.state.getParent(this.id);
    if (!parent) throw new Error(`[MoveNodeCommand] nó "${this.id}" não existe.`);
    this._origin = { parentId: parent.id, index: this.state.getIndexOf(this.id) };
    const meta = this.state.detachNode(this.id);
    this.state.insertNode(meta.node, this.newParentId, this.newIndex);
  }
  undo() {
    const meta = this.state.detachNode(this.id);
    this.state.insertNode(meta.node, this._origin.parentId, this._origin.index);
  }
}
