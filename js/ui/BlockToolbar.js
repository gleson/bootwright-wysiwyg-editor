import { el, icon } from '../utils/dom.js';

/**
 * BlockToolbar — barra flutuante posicionada acima do bloco selecionado.
 *
 * Posicionamento: a toolbar é filha de `[data-region="canvas-wrapper"]` (que
 * já é o container scrollável + position:relative), e usa `position: absolute`
 * em coordenadas internas do wrapper. Assim ela acompanha o bloco no scroll
 * e no switch de dispositivo sem precisar de ResizeObserver.
 *
 * Re-posiciona em selection:changed, em qualquer state:changed (movimento,
 * mudança de tamanho do conteúdo) e em scroll/resize. Sempre via rAF para
 * pegar o DOM já atualizado pelo Renderer.
 */
export class BlockToolbar {
  constructor(editor) {
    this.editor = editor;
    this.canvas = editor.root.querySelector('[data-region="canvas"]');
    this.canvasWrapper = editor.root.querySelector('[data-region="canvas-wrapper"]');
    this.targetId = null;
  }

  mount() {
    this.toolbar = this._build();
    this.canvasWrapper.appendChild(this.toolbar);

    this.editor.bus.on('selection:changed', ({ id, ids }) => {
      // Multi-seleção: a toolbar single não faz sentido — esconde.
      if (Array.isArray(ids) && ids.length > 1) {
        this.targetId = null;
        this.toolbar.hidden = true;
        return;
      }
      this._update(id);
    });
    this.editor.bus.on('state:changed', (evt) => {
      if (this.targetId) {
        this._scheduleReposition();
        if (evt?.type === 'update' && evt.id === this.targetId) {
          this._updateLockBtn(this.targetId);
        }
      }
    });
    this.editor.bus.on('comments:changed', ({ blockId }) => {
      if (this.targetId && (!blockId || blockId === this.targetId)) {
        this._updateCommentBtn(this.targetId);
      }
    });
    this.canvasWrapper.addEventListener('scroll', () => this._scheduleReposition(),
      { passive: true });
    window.addEventListener('resize', () => this._scheduleReposition());
  }

  _build() {
    const toolbar = el('div', {
      class: 'editor-block-toolbar', hidden: true,
      role: 'toolbar', 'aria-label': 'Ações do bloco selecionado',
    });

    this.btnDrag = this._buildDragHandle();
    this.labelEl = el('span', { class: 'editor-block-toolbar__label' }, '');
    this.btnParent = this._actionBtn('arrow-up-square', 'Selecionar bloco pai',
      () => this._selectParent());
    this.btnUp     = this._actionBtn('arrow-up',   'Mover para cima (Alt+↑)',  () => this._move(-1));
    this.btnDown   = this._actionBtn('arrow-down', 'Mover para baixo (Alt+↓)', () => this._move(+1));
    // Botão "Editar imagem" — atalho para o ImageEditor. Só visível em type='image'.
    this.btnEditImage = this._actionBtn('image', 'Editar imagem…',
      () => this._openImageEditor());
    this.btnComment = this._actionBtn('chat-left-text', 'Comentários',
      () => this._openComments());
    this.btnLock   = this._actionBtn('unlock', 'Travar bloco',
      () => this._toggleLock());
    this.btnDup    = this._actionBtn('files',      'Duplicar (Ctrl+D)',         () => this._duplicate());
    this.btnDel    = this._actionBtn('trash',      'Excluir (Delete)',          () => this._delete(), 'danger');

    toolbar.append(this.btnDrag, this.labelEl,
      this.btnParent, this.btnUp, this.btnDown, this.btnEditImage,
      this.btnComment, this.btnLock, this.btnDup, this.btnDel);
    return toolbar;
  }

  _buildDragHandle() {
    const btn = el('button', {
      type: 'button',
      class: 'editor-block-toolbar__btn editor-block-toolbar__btn--drag',
      title: 'Arrastar para mover',
      draggable: 'true',
    }, [icon('grip-vertical')]);

    btn.addEventListener('dragstart', (e) => {
      if (!this.targetId) { e.preventDefault(); return; }
      if (this.editor.isLocked(this.targetId)) { e.preventDefault(); return; }
      e.dataTransfer.setData('text/plain', this.targetId);
      e.dataTransfer.effectAllowed = 'move';
      this.editor.bus.emit('drag:started', { kind: 'move', id: this.targetId });
    });
    btn.addEventListener('dragend', () => {
      this.editor.bus.emit('drag:ended');
    });
    return btn;
  }

  _actionBtn(iconName, title, handler, variant = '') {
    const btn = el('button', {
      type: 'button',
      class: `editor-block-toolbar__btn${variant ? ' editor-block-toolbar__btn--' + variant : ''}`,
      title,
    }, [icon(iconName)]);
    btn.addEventListener('mousedown', (e) => e.preventDefault()); // não rouba foco
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handler();
    });
    return btn;
  }

  _update(id) {
    this.targetId = id;
    if (!id) {
      this.toolbar.hidden = true;
      return;
    }
    const node = this.editor.getNode(id);
    if (!node) {
      this.toolbar.hidden = true;
      return;
    }
    this.labelEl.textContent = node.type;

    const parent = this.editor.getParentOf(id);
    this.btnParent.hidden = !parent || parent.id === this.editor.rootId;
    // Botão "Editar imagem" só aparece em blocos do tipo image.
    this.btnEditImage.hidden = (node.type !== 'image');

    this._updateCommentBtn(id);
    this._updateLockBtn(id);

    this.toolbar.hidden = false;
    this._scheduleReposition();
  }

  /** Atualiza o ícone/título do botão de lock conforme o estado do bloco. */
  _updateLockBtn(id) {
    const locked = this.editor.isLocked(id);
    const i = this.btnLock.querySelector('i');
    if (i) i.className = `bi bi-${locked ? 'lock-fill' : 'unlock'}`;
    this.btnLock.title = locked ? 'Destravar bloco' : 'Travar bloco';
    this.btnLock.classList.toggle('is-active', locked);
  }

  /** Reflete a contagem de comentários no botão (badge + título). */
  _updateCommentBtn(id) {
    const count = this.editor.getCommentCount(id);
    const open = this.editor.getCommentCount(id, { unresolvedOnly: true });
    this.btnComment.classList.toggle('has-comments', count > 0);
    if (count > 0) this.btnComment.dataset.count = String(open || count);
    else this.btnComment.removeAttribute('data-count');
    this.btnComment.title = count > 0
      ? `Comentários (${count})`
      : 'Comentar neste bloco';
  }

  _scheduleReposition() {
    if (this._rafId) return;
    this._rafId = requestAnimationFrame(() => {
      this._rafId = null;
      this._reposition();
    });
  }

  _reposition() {
    if (!this.targetId || this.toolbar.hidden) return;
    const targetEl = this.editor.renderer?.nodeElements.get(this.targetId);
    if (!targetEl || !targetEl.isConnected) {
      this.toolbar.hidden = true;
      return;
    }
    const wrapperRect = this.canvasWrapper.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();

    const top = targetRect.top - wrapperRect.top
      + this.canvasWrapper.scrollTop
      - this.toolbar.offsetHeight - 4;
    const left = targetRect.left - wrapperRect.left
      + this.canvasWrapper.scrollLeft;

    this.toolbar.style.top = `${Math.max(2, top)}px`;
    this.toolbar.style.left = `${Math.max(2, left)}px`;
  }

  _selectParent() {
    const parent = this.editor.getParentOf(this.targetId);
    if (parent && parent.id !== this.editor.rootId) {
      this.editor.selectBlock(parent.id);
    }
  }

  _move(delta) {
    const parent = this.editor.getParentOf(this.targetId);
    if (!parent) return;
    const idx = parent.children.findIndex((c) => c.id === this.targetId);
    const target = idx + delta;
    if (target < 0 || target >= parent.children.length) return;
    this.editor.moveBlock(this.targetId, parent.id, target);
  }

  _duplicate() { this.editor.duplicateBlock(this.targetId); }
  _delete()    { this.editor.removeBlock(this.targetId); }
  _toggleLock() {
    if (this.targetId) {
      this.editor.toggleLock(this.targetId);
      this._updateLockBtn(this.targetId);
    }
  }
  _openComments() {
    if (this.targetId) this.editor.ui.comments?.open(this.targetId);
  }
  _openImageEditor() {
    if (this.targetId) this.editor.ui.imageEditor?.open(this.targetId);
  }
}
