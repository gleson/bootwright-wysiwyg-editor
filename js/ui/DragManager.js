import { el } from '../utils/dom.js';

/**
 * DragManager — orquestra drag & drop no canvas.
 *
 * Origens de drag:
 *   - Biblioteca (sidebar esquerda): emite { kind:'library', type }
 *   - Alça da BlockToolbar:           emite { kind:'move',    id  }
 *
 * Ao receber `drag:started`, percorre a árvore e injeta `.editor-drop-zone`
 * em cada container válido (entre filhos e como "fill" em containers vazios).
 * Validação por aninhamento usa `Block.allowedChildren`. Move dentro do
 * próprio source ou em descendentes é bloqueado visualmente (zona vira
 * `--invalid` e não recebe pointer events).
 *
 * Auto-scroll: enquanto há drag ativo, mover o cursor próximo às bordas do
 * canvas-wrapper rola o container.
 *
 * IMPORTANTE: o handler de drop chama `_hide()` ANTES de mutar o state, pra
 * remover as dropzones do DOM e evitar que o Renderer recalcule índices
 * com elas misturadas entre os blocos.
 */

const SCROLL_MARGIN = 60;
const SCROLL_SPEED = 14;

export class DragManager {
  constructor(editor) {
    this.editor = editor;
    this.canvas = editor.root.querySelector('[data-region="canvas"]');
    this.canvasWrapper = editor.root.querySelector('[data-region="canvas-wrapper"]');
    this.active = null;
  }

  mount() {
    this.editor.bus.on('drag:started', (info) => this._show(info));
    this.editor.bus.on('drag:ended',   ()      => this._hide());

    this.canvasWrapper.addEventListener('dragover', (e) => {
      if (!this.active) return;
      e.preventDefault(); // necessário para o drop ser permitido no wrapper
      this._autoscroll(e);
    });
    // Cancela drop "no vazio" (no wrapper, fora de qualquer zona) silenciosamente.
    this.canvasWrapper.addEventListener('drop', (e) => e.preventDefault());
  }

  /* ---------- Mostra / esconde zonas ---------- */

  _show(info) {
    if (this.active) this._hide(); // segurança: 2 dragstarts seguidos
    this.active = info;
    this.canvas.classList.add('editor-canvas--dragging');
    this._injectZones();
  }

  _hide() {
    this.active = null;
    this.canvas.classList.remove('editor-canvas--dragging');
    for (const z of this.canvas.querySelectorAll('.editor-drop-zone')) z.remove();
  }

  /* ---------- Construção das zonas ---------- */

  _injectZones() {
    this._injectFor(this.editor.getRoot(), this.canvas, false);
  }

  _injectFor(node, container, insideSource) {
    const isRoot = node.id === this.editor.rootId;
    const isSource = this.active?.kind === 'move' && node.id === this.active.id;
    const inside = insideSource || isSource;

    const allowed = isRoot
      ? '*'
      : this.editor.registry.get(node.type)?.allowedChildren;
    if (allowed === null || allowed === undefined) return;

    const dragType = this._getDragType();
    const accepts = !inside && this._typeAllowed(allowed, dragType);

    const childEls = [...container.children].filter((c) => c.dataset?.blockId);

    if (childEls.length === 0) {
      container.appendChild(this._buildZone(node.id, 0, accepts, true));
      return;
    }

    for (let i = 0; i < childEls.length; i++) {
      container.insertBefore(this._buildZone(node.id, i, accepts, false), childEls[i]);
    }
    container.appendChild(this._buildZone(node.id, childEls.length, accepts, false));

    for (let i = 0; i < node.children.length; i++) {
      const childNode = node.children[i];
      const childEl = childEls[i];
      const ChildClass = this.editor.registry.get(childNode.type);
      const innerContainer = ChildClass?.getChildrenContainer
        ? ChildClass.getChildrenContainer(childEl)
        : childEl;
      this._injectFor(childNode, innerContainer, inside);
    }
  }

  _typeAllowed(allowed, type) {
    if (!type) return false;
    if (allowed === '*') return true;
    if (Array.isArray(allowed)) return allowed.includes(type);
    return false;
  }

  _getDragType() {
    if (!this.active) return null;
    if (this.active.kind === 'library') return this.active.type;
    if (this.active.kind === 'move') return this.editor.getNode(this.active.id)?.type ?? null;
    return null;
  }

  _buildZone(parentId, index, accepts, fill) {
    const cls = ['editor-drop-zone'];
    if (fill)     cls.push('editor-drop-zone--fill');
    if (!accepts) cls.push('editor-drop-zone--invalid');
    const zone = el('div', {
      class: cls.join(' '),
      dataset: { dropParent: parentId, dropIndex: index },
    });

    if (accepts) {
      zone.addEventListener('dragenter', (e) => {
        e.preventDefault();
        zone.classList.add('editor-drop-zone--active');
      });
      zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = this.active?.kind === 'move' ? 'move' : 'copy';
        }
      });
      zone.addEventListener('dragleave', () => {
        zone.classList.remove('editor-drop-zone--active');
      });
      zone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._handleDrop(parentId, index);
      });
    }
    return zone;
  }

  /* ---------- Drop ---------- */

  _handleDrop(parentId, index) {
    if (!this.active) return;
    const info = this.active;

    // Remove dropzones primeiro: o Renderer vai usar children[index] sem zonas misturadas.
    this._hide();

    if (info.kind === 'library') {
      const id = this.editor.addBlock(parentId, info.type, {}, index);
      if (id) this.editor.selectBlock(id);
    } else if (info.kind === 'move') {
      let adjusted = index;
      const sourceParent = this.editor.getParentOf(info.id);
      if (sourceParent && sourceParent.id === parentId) {
        const currentIdx = sourceParent.children.findIndex((c) => c.id === info.id);
        if (currentIdx >= 0 && currentIdx < index) adjusted = index - 1;
      }
      try {
        this.editor.moveBlock(info.id, parentId, adjusted);
        this.editor.selectBlock(info.id);
      } catch (err) {
        console.warn('[DragManager] move bloqueado:', err.message);
      }
    }
  }

  /* ---------- Auto-scroll ---------- */

  _autoscroll(e) {
    const rect = this.canvasWrapper.getBoundingClientRect();
    const dy = e.clientY - rect.top;
    if (dy < SCROLL_MARGIN) {
      this.canvasWrapper.scrollTop -= SCROLL_SPEED;
    } else if (dy > rect.height - SCROLL_MARGIN) {
      this.canvasWrapper.scrollTop += SCROLL_SPEED;
    }
  }
}
