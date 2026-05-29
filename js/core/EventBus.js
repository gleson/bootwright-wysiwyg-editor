/**
 * EventBus — pub/sub mínimo usado por todo o editor.
 *
 * Eventos canônicos:
 *   - state:changed      { type, id, parentId?, index? }   → Renderer reage
 *   - selection:changed  { id }                            → Painel direito reage
 *   - history:changed    { canUndo, canRedo, lastLabel }   → Topbar reage
 *
 * Handlers que lançam não derrubam o emit dos demais.
 */
export class EventBus {
  constructor() {
    this.events = new Map();
  }

  on(event, handler) {
    if (!this.events.has(event)) this.events.set(event, new Set());
    this.events.get(event).add(handler);
    return () => this.off(event, handler);
  }

  once(event, handler) {
    const wrapper = (payload) => {
      this.off(event, wrapper);
      handler(payload);
    };
    return this.on(event, wrapper);
  }

  off(event, handler) {
    this.events.get(event)?.delete(handler);
  }

  emit(event, payload) {
    const handlers = this.events.get(event);
    if (!handlers || handlers.size === 0) return;
    // Cópia defensiva: handler pode chamar off/on durante o emit.
    for (const handler of [...handlers]) {
      try {
        handler(payload);
      } catch (err) {
        console.error(`[EventBus] Erro em handler de "${event}":`, err);
      }
    }
  }

  clear(event) {
    if (event) this.events.delete(event);
    else this.events.clear();
  }
}
