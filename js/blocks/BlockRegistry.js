/**
 * BlockRegistry — catálogo de tipos de bloco disponíveis.
 *
 * Permite plugar novos blocos sem alterar o core: basta `register(MyBlock)`.
 * O Editor expõe a instância via `editor.registry`.
 */
export class BlockRegistry {
  constructor() {
    /** @type {Map<string, typeof import('./Block.js').Block>} */
    this.types = new Map();
  }

  register(BlockClass) {
    if (!BlockClass?.type) {
      throw new Error('[BlockRegistry] Block precisa de "static type".');
    }
    if (typeof BlockClass.render !== 'function') {
      throw new Error(`[BlockRegistry] ${BlockClass.type}: precisa de "static render(node, ctx)".`);
    }
    this.types.set(BlockClass.type, BlockClass);
    return this;
  }

  get(type) {
    return this.types.get(type) ?? null;
  }

  has(type) {
    return this.types.has(type);
  }

  list() {
    return [...this.types.values()];
  }

  unregister(type) {
    return this.types.delete(type);
  }
}
