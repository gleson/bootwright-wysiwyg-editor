/**
 * Gerador de IDs únicos para nós da árvore.
 * crypto.randomUUID() é nativo em todos os navegadores modernos e Node ≥ 14.17.
 */
export function generateId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  // Fallback apenas para ambientes muito antigos.
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}
