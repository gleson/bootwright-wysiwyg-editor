import { el } from '../utils/dom.js';

/**
 * ImageResizeHandles — 4 alças nos cantos da imagem selecionada para
 * redimensionar visualmente (estilo Word/Tiny). Grava em `props.width` e
 * `props.height` (px). Aspect ratio é preservado por padrão; Shift libera.
 *
 * Padrão de posicionamento (igual BlockToolbar): filho de
 * `[data-region="canvas-wrapper"]`, position:absolute em coordenadas do
 * wrapper. Acompanha scroll + resize + state:changed.
 *
 * Só aparece para nós do tipo `image`. Some quando há multi-seleção ou
 * quando o bloco está travado.
 */
export class ImageResizeHandles {
  constructor(editor) {
    this.editor = editor;
    this.targetId = null;
    this.canvasWrapper = editor.root.querySelector('[data-region="canvas-wrapper"]');
  }

  mount() {
    this.root = el('div', {
      class: 'editor-img-resize',
      hidden: true,
      'aria-hidden': 'true',
    });
    this.handles = {};
    for (const corner of ['nw', 'ne', 'sw', 'se']) {
      const h = el('span', {
        class: `editor-img-resize__handle editor-img-resize__handle--${corner}`,
        'data-corner': corner,
      });
      h.addEventListener('pointerdown', (e) => this._beginDrag(e, corner));
      this.handles[corner] = h;
      this.root.appendChild(h);
    }
    this.canvasWrapper.appendChild(this.root);

    this.editor.bus.on('selection:changed', ({ id, ids }) => {
      if (Array.isArray(ids) && ids.length > 1) { this._hide(); return; }
      this._show(id);
    });
    this.editor.bus.on('state:changed', () => {
      if (this.targetId) this._scheduleReposition();
    });
    this.canvasWrapper.addEventListener('scroll',
      () => this._scheduleReposition(), { passive: true });
    window.addEventListener('resize', () => this._scheduleReposition());
  }

  _show(id) {
    if (!id) { this._hide(); return; }
    const node = this.editor.getNode(id);
    if (!node || node.type !== 'image' || this.editor.isLocked?.(id)) {
      this._hide();
      return;
    }
    this.targetId = id;
    this.root.hidden = false;
    this._scheduleReposition();
  }

  _hide() {
    this.targetId = null;
    this.root.hidden = true;
  }

  _scheduleReposition() {
    if (this._rafId) return;
    this._rafId = requestAnimationFrame(() => {
      this._rafId = null;
      this._reposition();
    });
  }

  _reposition() {
    if (!this.targetId || this.root.hidden) return;
    const targetEl = this.editor.renderer?.nodeElements.get(this.targetId);
    if (!targetEl || !targetEl.isConnected) { this._hide(); return; }

    const wrapperRect = this.canvasWrapper.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();
    const top = targetRect.top - wrapperRect.top + this.canvasWrapper.scrollTop;
    const left = targetRect.left - wrapperRect.left + this.canvasWrapper.scrollLeft;

    this.root.style.top = `${top}px`;
    this.root.style.left = `${left}px`;
    this.root.style.width = `${targetRect.width}px`;
    this.root.style.height = `${targetRect.height}px`;
  }

  _beginDrag(e, corner) {
    if (!this.targetId) return;
    e.preventDefault();
    e.stopPropagation();

    const targetEl = this.editor.renderer?.nodeElements.get(this.targetId);
    if (!targetEl) return;
    const startRect = targetEl.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const aspect = startRect.width / (startRect.height || 1);
    const horiz = corner.includes('e') ? 1 : -1;
    const vert  = corner.includes('s') ? 1 : -1;

    document.body.classList.add('editor-img-resize-dragging');

    const onMove = (ev) => {
      const dx = (ev.clientX - startX) * horiz;
      const dy = (ev.clientY - startY) * vert;
      // Preserva aspect ratio: usa o maior delta como master. Shift desliga.
      let nw, nh;
      if (ev.shiftKey) {
        nw = Math.max(20, Math.round(startRect.width + dx));
        nh = Math.max(20, Math.round(startRect.height + dy));
      } else {
        const useWidth = Math.abs(dx) >= Math.abs(dy);
        if (useWidth) {
          nw = Math.max(20, Math.round(startRect.width + dx));
          nh = Math.max(20, Math.round(nw / aspect));
        } else {
          nh = Math.max(20, Math.round(startRect.height + dy));
          nw = Math.max(20, Math.round(nh * aspect));
        }
      }
      // `coalesceKey` agrupa todos os updates desse drag num único passo de undo.
      this.editor.updateBlock(this.targetId,
        { props: { width: nw, height: nh } },
        { coalesceKey: `image-resize:${this.targetId}` });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.classList.remove('editor-img-resize-dragging');
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }
}
