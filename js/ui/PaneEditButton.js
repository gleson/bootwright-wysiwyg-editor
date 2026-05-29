import { el, icon } from '../utils/dom.js';
import { t } from '../i18n/index.js';

const COMPOSITE_TYPES = new Set(['tabs', 'accordion', 'carousel']);

/**
 * PaneEditButton — botão flutuante "Editar conteúdo…" que aparece sobre o
 * painel/slide ATIVO de Tabs/Accordion/Carousel quando o bloco está
 * selecionado no canvas. Clique abre o ContentEditor para aquele item.
 *
 * Padrão de posicionamento: filho de `[data-region="canvas-wrapper"]`,
 * position:absolute, acompanha scroll/resize/state:changed.
 *
 * Detecção do painel ativo:
 *   - tabs:      `.tab-pane.show.active` ou `[data-item-idx]:nth-child(1)`
 *   - accordion: `.accordion-collapse.show` → .accordion-body[data-item-idx]
 *   - carousel:  `.carousel-item.active` (sem data-item-idx — usa o índice)
 */
export class PaneEditButton {
  constructor(editor) {
    this.editor = editor;
    this.targetId = null;
    this.canvasWrapper = editor.root.querySelector('[data-region="canvas-wrapper"]');
  }

  mount() {
    this.root = el('button', {
      type: 'button',
      class: 'editor-pane-edit-btn btn btn-sm btn-dark',
      hidden: true,
      title: t('contentEditor.editPane'),
    }, [icon('pencil-square'), ' ', t('contentEditor.editPane')]);
    this.root.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._openEditor();
    });
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
    if (!node || !COMPOSITE_TYPES.has(node.type) || this.editor.isLocked?.(id)) {
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
    const blockEl = this.editor.renderer?.nodeElements.get(this.targetId);
    if (!blockEl || !blockEl.isConnected) { this._hide(); return; }
    const paneEl = this._findActivePane(blockEl);
    if (!paneEl) { this._hide(); return; }

    const wrapperRect = this.canvasWrapper.getBoundingClientRect();
    const paneRect = paneEl.getBoundingClientRect();
    const top = paneRect.top - wrapperRect.top + this.canvasWrapper.scrollTop + 8;
    const right = wrapperRect.right - paneRect.right + 8;

    this.root.style.top = `${top}px`;
    this.root.style.right = `${right}px`;
    this.root.style.left = 'auto';
  }

  _findActivePane(blockEl) {
    const node = this.editor.getNode(this.targetId);
    if (!node) return null;
    if (node.type === 'tabs') {
      return blockEl.querySelector('.tab-pane.show.active')
          || blockEl.querySelector('[data-item-idx="0"]');
    }
    if (node.type === 'accordion') {
      const open = blockEl.querySelector('.accordion-collapse.show');
      return open?.querySelector('[data-item-idx]')
          || blockEl.querySelector('[data-item-idx="0"]');
    }
    if (node.type === 'carousel') {
      return blockEl.querySelector('.carousel-item.active')
          || blockEl.querySelector('.carousel-item');
    }
    return null;
  }

  _openEditor() {
    if (!this.targetId) return;
    const node = this.editor.getNode(this.targetId);
    if (!node) return;
    const blockEl = this.editor.renderer?.nodeElements.get(this.targetId);
    const paneEl = blockEl && this._findActivePane(blockEl);
    const idx = this._indexFromPane(node, paneEl);
    if (idx == null) return;
    this._openEditorFor(node, idx);
  }

  /**
   * Determina o índice do item ativo. Em tabs/accordion lemos
   * `data-item-idx`; em carousel contamos a posição entre `.carousel-item`s.
   */
  _indexFromPane(node, paneEl) {
    if (!paneEl) return 0;
    if (node.type === 'tabs' || node.type === 'accordion') {
      const n = Number(paneEl.dataset.itemIdx);
      return Number.isFinite(n) ? n : 0;
    }
    if (node.type === 'carousel') {
      const items = paneEl.parentElement?.querySelectorAll(':scope > .carousel-item') ?? [];
      return Array.prototype.indexOf.call(items, paneEl);
    }
    return null;
  }

  /**
   * Helper estático: abre o ContentEditor para o item `idx` de `node`. Usado
   * tanto pelo clique no botão flutuante quanto pela ação do painel lateral.
   */
  static openFor(editor, nodeId, idx) {
    const node = editor.getNode(nodeId);
    if (!node) return;
    const isCarousel = node.type === 'carousel';
    const listKey = isCarousel ? 'slides' : 'items';
    const fieldKey = isCarousel ? 'caption' : 'content';
    const item = (node.props?.[listKey] ?? [])[idx];
    if (!item) return;
    const titleLabel = item.title ?? (isCarousel ? `Slide ${idx + 1}` : `${idx + 1}`);
    // Em carrossel, o modal entra em "modo slide": backdrop com a imagem do
    // slide, dimensões compactas e barra extra de controles de imagem.
    const slideMode = isCarousel ? {
      src: item.src ?? '', alt: item.alt ?? '',
      bgSize: item.bgSize, bgPosition: item.bgPosition,
      bgRepeat: item.bgRepeat, minHeight: item.minHeight,
      justifyContent: item.justifyContent, alignItems: item.alignItems,
    } : undefined;
    editor.ui.contentEditor.open({
      title: t('contentEditor.title', { name: titleLabel }),
      html: item[fieldKey] ?? '',
      slideMode,
      onSave: (html, meta) => {
        const list = (editor.getNode(nodeId)?.props?.[listKey] ?? []).slice();
        const cur = list[idx] ?? {};
        list[idx] = { ...cur, [fieldKey]: html, ...(meta ? meta : {}) };
        editor.updateBlock(nodeId, { props: { [listKey]: list } });
      },
    });
  }

  _openEditorFor(node, idx) {
    PaneEditButton.openFor(this.editor, node.id, idx);
  }
}
