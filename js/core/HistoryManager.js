/**
 * HistoryManager — pilhas de undo/redo baseadas em comandos.
 *
 * Limite padrão: 100 comandos. Comandos mais antigos são descartados.
 *
 * **Coalescência**: passe `opts.coalesceKey` em `execute()` para que comandos
 * consecutivos com a mesma chave dentro de uma janela curta (500ms) sejam
 * mesclados em um único registro de undo. Isso evita inflar o histórico
 * durante digitação contínua de texto. Para que o undo aponte para o estado
 * anterior ao **primeiro** comando do burst, o `_previous` do comando antigo
 * é repassado ao novo (UpdateNodeCommand). O acoplamento é proposital e
 * documentado.
 */

const DEFAULT_LIMIT = 100;
const COALESCE_WINDOW_MS = 500;

export class HistoryManager {
  constructor(bus, { limit = DEFAULT_LIMIT } = {}) {
    if (!bus) throw new Error('[HistoryManager] EventBus é obrigatório.');
    this.bus = bus;
    this.limit = limit;
    this.undoStack = [];
    this.redoStack = [];
  }

  execute(command, opts = {}) {
    if (!command || typeof command.do !== 'function' || typeof command.undo !== 'function') {
      throw new Error('[HistoryManager] comando inválido (precisa expor do/undo).');
    }
    const result = command.do();
    const now = Date.now();
    const last = this.undoStack.at(-1);

    if (last && opts.coalesceKey
        && last._coalesceKey === opts.coalesceKey
        && (now - last._coalesceTime) < COALESCE_WINDOW_MS) {
      // Mescla: o undo do novo comando deve apontar para o estado original do burst.
      if (last._previous !== undefined && command._previous !== undefined) {
        command._previous = last._previous;
      }
      command._coalesceKey = opts.coalesceKey;
      command._coalesceTime = now;
      this.undoStack[this.undoStack.length - 1] = command;
    } else {
      if (opts.coalesceKey) {
        command._coalesceKey = opts.coalesceKey;
        command._coalesceTime = now;
      }
      this.undoStack.push(command);
      if (this.undoStack.length > this.limit) this.undoStack.shift();
    }
    this.redoStack.length = 0;
    this._notify();
    return result;
  }

  undo() {
    if (!this.canUndo()) return false;
    const command = this.undoStack.pop();
    command.undo();
    this.redoStack.push(command);
    this._notify();
    return true;
  }

  redo() {
    if (!this.canRedo()) return false;
    const command = this.redoStack.pop();
    command.do();
    this.undoStack.push(command);
    this._notify();
    return true;
  }

  canUndo() { return this.undoStack.length > 0; }
  canRedo() { return this.redoStack.length > 0; }

  clear() {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this._notify();
  }

  _notify() {
    this.bus.emit('history:changed', {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      lastLabel: this.undoStack.at(-1)?.label ?? null,
    });
  }
}
