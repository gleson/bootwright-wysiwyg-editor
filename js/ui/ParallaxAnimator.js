import { createParallaxAnimator } from '../runtime/parallax.js';

/**
 * ParallaxAnimator (editor) — liga o runtime de parallax/scroll-link ao
 * canvas para pré-visualização ao vivo enquanto o usuário rola o canvas.
 *
 * Acompanha o `ScrollAnimator`: mesmo padrão de re-scan coalescido em rAF a
 * cada `state:changed`. O `root` do animator é o `.editor-canvas-wrapper`
 * (elemento que rola), para que as posições sejam medidas relativas a ele.
 */
export class ParallaxAnimator {
  constructor(editor) {
    this.editor = editor;
    this.canvas = editor.root.querySelector('[data-region="canvas"]');
    const wrapper = editor.root.querySelector('[data-region="canvas-wrapper"]');
    this.animator = createParallaxAnimator({ root: wrapper ?? null });
    this._frame = null;
  }

  mount() {
    if (!this.canvas) return;
    this.editor.bus.on('state:changed', () => this._scheduleRescan());
    this._scheduleRescan();
  }

  _scheduleRescan() {
    if (this._frame != null) return;
    this._frame = requestAnimationFrame(() => {
      this._frame = null;
      this.animator.rescan(this.canvas);
    });
  }
}
