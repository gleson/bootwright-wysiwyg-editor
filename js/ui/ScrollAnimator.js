import { createScrollAnimator } from '../runtime/scrollAnimate.js';

/**
 * ScrollAnimator (editor) — liga o runtime de animações on-scroll ao canvas
 * para o usuário pré-visualizar o efeito `data-animate` enquanto edita.
 *
 * Re-escaneia o canvas a cada `state:changed` (coalescido num rAF, para rodar
 * depois do Renderer ter atualizado o DOM). O `rescan` é idempotente: só
 * observa elementos novos. Quando um bloco animado é re-renderizado (mudança
 * de classe/attr), vira um elemento novo e a animação toca de novo — efeito
 * colateral aceitável num editor (o usuário vê o resultado ao ajustar).
 */
export class ScrollAnimator {
  constructor(editor) {
    this.editor = editor;
    // `canvas` = onde os blocos vivem; `wrapper` = o elemento que rola — é o
    // root do IntersectionObserver (a "viewport" do editor).
    this.canvas = editor.root.querySelector('[data-region="canvas"]');
    const wrapper = editor.root.querySelector('[data-region="canvas-wrapper"]');
    this.animator = createScrollAnimator({ root: wrapper ?? null });
    this._frame = null;
  }

  mount() {
    if (!this.canvas) return;
    this.editor.bus.on('state:changed', () => this._scheduleRescan());
    // Primeiro scan depois do render inicial do Renderer.
    this._scheduleRescan();
  }

  /** Coalesce múltiplos eventos num único rescan por frame. */
  _scheduleRescan() {
    if (this._frame != null) return;
    this._frame = requestAnimationFrame(() => {
      this._frame = null;
      this.animator.rescan(this.canvas);
    });
  }
}
