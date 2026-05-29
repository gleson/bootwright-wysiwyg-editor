import { generateId } from '../utils/id.js';

/**
 * State — Single Source of Truth.
 *
 * Estrutura do nó:
 *   { id, type, props, classes[], attrs{}, children[] }
 *
 * Camadas de API:
 *   - Primitivas (createNode, insertNode, detachNode, mutateNode)
 *     usadas pelos Commands para garantir reversibilidade exata.
 *   - Ergonômicas (addNode, removeNode, updateNode, moveNode)
 *     wrappers convenientes para uso direto (sem histórico).
 *
 * Toda mutação emite `state:changed` no bus.
 */

const ROOT_ID = '__root__';

function makeRoot() {
  return {
    id: ROOT_ID,
    type: 'root',
    props: {},
    classes: [],
    attrs: {},
    children: [],
  };
}

export class State {
  constructor(bus) {
    if (!bus) throw new Error('[State] EventBus é obrigatório.');
    this.bus = bus;
    this.root = makeRoot();
    /** @type {Map<string, { node: object, parent: object|null }>} */
    this._index = new Map();
    this._index.set(ROOT_ID, { node: this.root, parent: null });
  }

  static get ROOT_ID() { return ROOT_ID; }

  /* ---------- Leitura ---------- */

  getRoot() {
    return this.root;
  }

  getNode(id) {
    return this._index.get(id)?.node ?? null;
  }

  getParent(id) {
    return this._index.get(id)?.parent ?? null;
  }

  getIndexOf(id) {
    const parent = this.getParent(id);
    if (!parent) return -1;
    return parent.children.findIndex((n) => n.id === id);
  }

  /** Snapshot serializável da árvore inteira. */
  serialize() {
    return JSON.parse(JSON.stringify(this.root));
  }

  /* ---------- Primitivas (uso interno + commands) ---------- */

  /** Cria nó isolado com ID único. Não insere. */
  createNode({ type, props = {}, classes = [], attrs = {}, children = [] }) {
    if (!type) throw new Error('[State] createNode: campo "type" é obrigatório.');
    return {
      id: generateId(),
      type,
      props: { ...props },
      classes: [...classes],
      attrs: { ...attrs },
      children: children.map((c) => this.createNode(c)),
    };
  }

  /** Insere nó pré-existente sob um parent. */
  insertNode(node, parentId, index) {
    const parent = this.getNode(parentId);
    if (!parent) throw new Error(`[State] insertNode: parent "${parentId}" não existe.`);
    if (this._index.has(node.id)) {
      throw new Error(`[State] insertNode: id "${node.id}" já está na árvore.`);
    }
    const at = (index == null || index < 0 || index > parent.children.length)
      ? parent.children.length
      : index;
    parent.children.splice(at, 0, node);
    this._reindex(node, parent);
    this.bus.emit('state:changed', { type: 'insert', id: node.id, parentId, index: at });
    return node;
  }

  /** Remove nó da árvore. Retorna meta para reinserção (usado por undo). */
  detachNode(id) {
    if (id === ROOT_ID) throw new Error('[State] detachNode: a raiz não pode ser removida.');
    const entry = this._index.get(id);
    if (!entry) throw new Error(`[State] detachNode: id "${id}" não existe.`);
    const parent = entry.parent;
    const index = parent.children.findIndex((n) => n.id === id);
    parent.children.splice(index, 1);
    this._unindex(entry.node);
    this.bus.emit('state:changed', { type: 'remove', id, parentId: parent.id, index });
    return { node: entry.node, parentId: parent.id, index };
  }

  /** Substitui campos editáveis (props/classes/attrs) por completo. */
  mutateNode(id, fields) {
    const node = this.getNode(id);
    if (!node) throw new Error(`[State] mutateNode: id "${id}" não existe.`);
    if (fields.props !== undefined)   node.props   = { ...fields.props };
    if (fields.classes !== undefined) node.classes = [...fields.classes];
    if (fields.attrs !== undefined)   node.attrs   = { ...fields.attrs };
    this.bus.emit('state:changed', { type: 'update', id });
  }

  /* ---------- Ergonômicas (sem histórico próprio) ---------- */

  addNode(parentId, data, index) {
    const node = this.createNode(data);
    return this.insertNode(node, parentId, index);
  }

  removeNode(id) {
    return this.detachNode(id);
  }

  updateNode(id, patch) {
    const node = this.getNode(id);
    if (!node) throw new Error(`[State] updateNode: id "${id}" não existe.`);
    this.mutateNode(id, {
      props:   patch.props   ? { ...node.props,   ...patch.props }   : node.props,
      classes: patch.classes ? [...patch.classes]                    : node.classes,
      attrs:   patch.attrs   ? { ...node.attrs,   ...patch.attrs }   : node.attrs,
    });
  }

  moveNode(id, newParentId, index) {
    if (id === ROOT_ID) throw new Error('[State] moveNode: a raiz não pode ser movida.');
    if (this._isDescendant(id, newParentId)) {
      throw new Error('[State] moveNode: destino é descendente do próprio nó.');
    }
    const meta = this.detachNode(id);
    return this.insertNode(meta.node, newParentId, index);
  }

  /** Substitui árvore inteira (loadJSON). Preserva IDs vindos do JSON. */
  replace(rootData) {
    if (!rootData || rootData.type !== 'root') {
      throw new Error('[State] replace: raiz inválida (type !== "root").');
    }
    this.root = makeRoot();
    // Preserva metadados de página guardados na raiz (ex.: props.seo) — sem
    // isto, um loadJSON descartaria SEO e qualquer config de nível de página.
    this.root.props   = { ...(rootData.props   ?? {}) };
    this.root.classes = [...(rootData.classes ?? [])];
    this.root.attrs   = { ...(rootData.attrs   ?? {}) };
    this._index.clear();
    this._index.set(ROOT_ID, { node: this.root, parent: null });
    this._hydrate(this.root, rootData.children ?? []);
    this.bus.emit('state:changed', { type: 'replace', id: ROOT_ID });
  }

  /**
   * Constrói um nó (e seu subtree) a partir de dados serializados, preservando
   * os IDs informados. NÃO insere nem indexa — combine com `insertNode`. Usado
   * pelo `_hydrate` (loadJSON) e pela sincronização colaborativa, que precisa
   * reproduzir um nó remoto com o MESMO id em que foi criado na outra ponta.
   */
  hydrateNode(data) {
    const node = {
      id: data.id ?? generateId(),
      type: data.type,
      props:   { ...(data.props   ?? {}) },
      classes: [...(data.classes ?? [])],
      attrs:   { ...(data.attrs   ?? {}) },
      children: [],
    };
    for (const childData of data.children ?? []) {
      node.children.push(this.hydrateNode(childData));
    }
    return node;
  }

  /* ---------- Internos ---------- */

  _hydrate(parent, childrenData) {
    for (const data of childrenData) {
      const node = this.hydrateNode(data);
      parent.children.push(node);
      this._reindex(node, parent);
    }
  }

  _reindex(node, parent) {
    this._index.set(node.id, { node, parent });
    for (const child of node.children) this._reindex(child, node);
  }

  _unindex(node) {
    this._index.delete(node.id);
    for (const child of node.children) this._unindex(child);
  }

  _isDescendant(ancestorId, candidateId) {
    let current = this.getNode(candidateId);
    while (current) {
      if (current.id === ancestorId) return true;
      current = this._index.get(current.id)?.parent ?? null;
    }
    return false;
  }
}
