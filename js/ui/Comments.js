import { el, clear, icon } from '../utils/dom.js';
import { t, getLocale } from '../i18n/index.js';

/**
 * Comments — comentários de revisão presos a blocos.
 *
 * Duas responsabilidades:
 *   1. Marcadores: aplica `editor-block--has-comments` + `data-comment-count`
 *      aos elementos do canvas que têm comentários (re-aplicado a cada render,
 *      pois o Renderer recria os elementos).
 *   2. Popover: um painel flutuante (filho de `canvas-wrapper`, como a
 *      BlockToolbar) com a thread de um bloco — listar, adicionar, resolver e
 *      excluir comentários.
 *
 * Os dados moram em `root.props.comments` (ver Editor.getComments etc.):
 * persistem no JSON salvo, não vão para o HTML exportado.
 */
export class Comments {
  constructor(editor) {
    this.editor = editor;
    this.canvas = editor.root.querySelector('[data-region="canvas"]');
    this.wrapper = editor.root.querySelector('[data-region="canvas-wrapper"]');
    this.popover = null;
    this.openId = null;
    this._frame = null;
  }

  mount() {
    // Marcadores: re-sincroniza após render e quando comentários mudam.
    this.editor.bus.on('state:changed', () => this._scheduleMarkers());
    this.editor.bus.on('comments:changed', ({ blockId }) => {
      this._scheduleMarkers();
      if (this.openId && (!blockId || blockId === this.openId)) {
        if (this.editor.getNode(this.openId)) this._renderThread();
        else this.close();
      }
    });
    // Bloco aberto saiu da árvore / virou multi-seleção → fecha o popover.
    this.editor.bus.on('state:changed', (e) => {
      if (this.openId && e.type === 'remove' && !this.editor.getNode(this.openId)) {
        this.close();
      }
    });
    this.wrapper?.addEventListener('scroll', () => this._reposition(), { passive: true });
    window.addEventListener('resize', () => this._reposition());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.popover) this.close();
    });

    this._scheduleMarkers();
  }

  /* ---------- Marcadores no canvas ---------- */

  _scheduleMarkers() {
    if (this._frame != null) return;
    this._frame = requestAnimationFrame(() => {
      this._frame = null;
      this._applyMarkers();
    });
  }

  _applyMarkers() {
    if (!this.canvas) return;
    // Limpa marcadores antigos (elementos podem ter sido recriados/removidos).
    for (const elm of this.canvas.querySelectorAll('.editor-block--has-comments')) {
      elm.classList.remove('editor-block--has-comments');
      elm.removeAttribute('data-comment-count');
    }
    const all = this.editor.getAllComments();
    for (const [blockId, list] of Object.entries(all)) {
      const elm = this.editor.renderer?.nodeElements.get(blockId);
      if (!elm || !list.length) continue;
      const open = list.filter((c) => !c.resolved).length;
      elm.classList.add('editor-block--has-comments');
      // Mostra o nº de comentários em aberto (ou ✓ quando tudo resolvido).
      elm.setAttribute('data-comment-count', open > 0 ? String(open) : '✓');
    }
  }

  /* ---------- Popover ---------- */

  /** Abre (ou realoca) o popover de comentários de um bloco. */
  open(blockId) {
    if (!blockId || !this.editor.getNode(blockId)) return;
    this.openId = blockId;
    if (!this.popover) {
      this.popover = this._build();
      this.wrapper.appendChild(this.popover);
      this._onDocMouseDown = (e) => {
        if (this.popover && !this.popover.contains(e.target)) this.close();
      };
      // Adiado: o clique que abriu não deve fechar imediatamente.
      setTimeout(() => document.addEventListener('mousedown', this._onDocMouseDown), 0);
    }
    this.popover.hidden = false;
    this._renderThread();
    this._reposition();
    this.popover.querySelector('.editor-comments__input')?.focus();
  }

  close() {
    if (!this.popover) return;
    this.popover.remove();
    this.popover = null;
    this.openId = null;
    if (this._onDocMouseDown) {
      document.removeEventListener('mousedown', this._onDocMouseDown);
      this._onDocMouseDown = null;
    }
  }

  _build() {
    const popover = el('div', {
      class: 'editor-comments', role: 'dialog',
      'aria-label': t('comments.title'),
    });

    const closeBtn = el('button', {
      type: 'button', class: 'editor-comments__close', title: t('comments.close'),
    }, [icon('x-lg')]);
    closeBtn.addEventListener('click', () => this.close());

    this.headerEl = el('div', { class: 'editor-comments__header' }, [
      el('span', { class: 'editor-comments__title' }, [
        icon('chat-left-text'), el('span', {}, t('comments.title')),
      ]),
      closeBtn,
    ]);

    this.listEl = el('div', { class: 'editor-comments__list' });

    this.inputEl = el('textarea', {
      class: 'editor-comments__input form-control form-control-sm',
      rows: '2', placeholder: t('comments.placeholder'),
    });
    // Ctrl+Enter envia rapidamente.
    this.inputEl.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        this._submit();
      }
    });
    const addBtn = el('button', {
      type: 'button', class: 'btn btn-sm btn-primary w-100 mt-1',
    }, t('comments.add'));
    addBtn.addEventListener('click', () => this._submit());

    const footer = el('div', { class: 'editor-comments__footer' }, [this.inputEl, addBtn]);

    popover.append(this.headerEl, this.listEl, footer);
    return popover;
  }

  _submit() {
    const text = this.inputEl.value;
    if (!text.trim()) return;
    this.editor.addComment(this.openId, text);
    this.inputEl.value = '';
    this.inputEl.focus();
    // _renderThread vem via evento 'comments:changed'.
  }

  _renderThread() {
    if (!this.popover || !this.openId) return;
    const node = this.editor.getNode(this.openId);
    const comments = this.editor.getComments(this.openId);

    const titleSpan = this.headerEl.querySelector('.editor-comments__title span');
    titleSpan.textContent = `${t('comments.title')} · ${node?.type ?? ''}`;

    clear(this.listEl);
    if (!comments.length) {
      this.listEl.appendChild(
        el('div', { class: 'editor-comments__empty' }, t('comments.empty')));
      return;
    }
    for (const c of comments) {
      this.listEl.appendChild(this._renderComment(c));
    }
  }

  _renderComment(c) {
    const meta = el('div', { class: 'editor-comments__meta' }, [
      el('strong', {}, c.author || '—'),
      el('span', { class: 'editor-comments__time' }, this._formatTime(c.createdAt)),
    ]);

    const resolveBtn = el('button', {
      type: 'button', class: 'editor-comments__act',
      title: c.resolved ? t('comments.reopen') : t('comments.resolve'),
    }, [icon(c.resolved ? 'arrow-counterclockwise' : 'check2-circle')]);
    resolveBtn.addEventListener('click', () => {
      this.editor.updateComment(this.openId, c.id, { resolved: !c.resolved });
    });

    const delBtn = el('button', {
      type: 'button', class: 'editor-comments__act editor-comments__act--danger',
      title: t('comments.delete'),
    }, [icon('trash')]);
    delBtn.addEventListener('click', () => {
      this.editor.removeComment(this.openId, c.id);
    });

    const item = el('div', {
      class: `editor-comments__item${c.resolved ? ' is-resolved' : ''}`,
    }, [
      meta,
      el('p', { class: 'editor-comments__text' }, c.text),
      el('div', { class: 'editor-comments__actions' }, [
        c.resolved
          ? el('span', { class: 'editor-comments__badge' }, t('comments.resolved'))
          : null,
        resolveBtn, delBtn,
      ]),
    ]);
    return item;
  }

  _formatTime(iso) {
    try {
      return new Date(iso).toLocaleString(getLocale(), {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return '';
    }
  }

  /* ---------- Posicionamento (espelha a BlockToolbar) ---------- */

  _reposition() {
    if (!this.popover || this.popover.hidden || !this.openId) return;
    const targetEl = this.editor.renderer?.nodeElements.get(this.openId);
    if (!targetEl || !targetEl.isConnected) { this.close(); return; }

    const wrapperRect = this.wrapper.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();
    const pw = this.popover.offsetWidth;

    let left = targetRect.right - wrapperRect.left + this.wrapper.scrollLeft + 8;
    // Sem espaço à direita → encosta à esquerda do bloco.
    if (left + pw > this.wrapper.scrollLeft + wrapperRect.width) {
      left = targetRect.left - wrapperRect.left + this.wrapper.scrollLeft - pw - 8;
    }
    const top = targetRect.top - wrapperRect.top + this.wrapper.scrollTop;

    this.popover.style.left = `${Math.max(2, left)}px`;
    this.popover.style.top = `${Math.max(2, top)}px`;
  }
}
