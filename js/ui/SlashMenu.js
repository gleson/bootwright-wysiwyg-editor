import { el, icon, clear } from '../utils/dom.js';
import { t } from '../i18n/index.js';

/**
 * SlashMenu — inserção rápida de blocos digitando `/` no conteúdo.
 *
 * Comportamento (estilo Notion):
 *   - Aberto quando o usuário digita `/` num inline-edit de TEXTO PURO
 *     (bloco com `editableProp` e sem `editableHtml`), no início do conteúdo
 *     ou após um espaço. Blocos rich-text (paragraph, alert…) ficam de fora
 *     para não conflitar com a RichTextToolbar.
 *   - Mostra blocos do registry + templates, filtrados pela query após o `/`.
 *   - ↑/↓ navegam, Enter insere, Esc/clique fora fecham.
 *   - Ao escolher um item: remove o `/query` do texto, e se o bloco original
 *     ficar vazio (texto = ''), é substituído pelo novo bloco; caso contrário
 *     o novo bloco é inserido logo abaixo.
 *
 * O menu é filho de `[data-region="canvas-wrapper"]` (mesma estratégia da
 * BlockToolbar) e flutua ancorado ao retângulo do caret.
 */
export class SlashMenu {
  constructor(editor) {
    this.editor = editor;
    this.canvasWrapper = editor.root.querySelector('[data-region="canvas-wrapper"]');
    this._open = null; // { blockId, anchorEl, slashIndex, query, items, active, menuEl }
  }

  mount() {
    this.editor.bus.on('inline-edit:started', ({ id }) => this._attachToBlock(id));
    this.editor.bus.on('inline-edit:ended', () => this._close());
  }

  /* ---------- Trigger ---------- */

  _attachToBlock(blockId) {
    const node = this.editor.getNode(blockId);
    if (!node) return;
    const BlockClass = this.editor.registry.get(node.type);
    if (!BlockClass?.editableProp) return;
    const anchorEl = this.editor.inlineEdit?.el;
    if (!anchorEl) return;

    const onInput = () => this._onInput(blockId, anchorEl);
    // Captura no `document` para garantir que ↑/↓/Enter/Esc cheguem antes do
    // handler bubble do inline-edit (que está no mesmo elemento e commitaria o
    // texto "/query" no Enter).
    const onKeyDown = (e) => this._onKeyDown(e);
    anchorEl.addEventListener('input', onInput);
    document.addEventListener('keydown', onKeyDown, true);
    this._cleanup = () => {
      anchorEl.removeEventListener('input', onInput);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }

  _onInput(blockId, anchorEl) {
    const text = anchorEl.textContent ?? '';
    const caret = this._caretOffsetIn(anchorEl);
    if (caret < 0) { this._close(); return; }

    if (this._open) {
      // Já aberto: revalida a partir do slashIndex memorizado.
      const slashIdx = this._open.slashIndex;
      if (text[slashIdx] !== '/' || caret < slashIdx + 1) { this._close(); return; }
      // Tudo entre slash+1 e caret é a query; caret deve estar no fim do texto.
      if (caret !== text.length) { this._close(); return; }
      const query = text.slice(slashIdx + 1, caret);
      if (/\s/.test(query)) { this._close(); return; }
      this._open.query = query;
      this._renderItems();
      return;
    }

    // Abre apenas se a `/` for o primeiro caractere significativo do editável
    // (eventual whitespace antes é tolerado) e o caret estiver logo após ela.
    // Mantém comportamento previsível: ao escolher um item, o bloco vira o novo.
    if (caret < 1 || text[caret - 1] !== '/') return;
    const before = text.slice(0, caret - 1);
    if (before.trim() !== '') return;
    if (caret !== text.length) return; // não abre se houver conteúdo depois do caret
    this._show(blockId, anchorEl, caret - 1);
  }

  _onKeyDown(e) {
    if (!this._open) return;
    // stopImmediatePropagation: o inline-edit do Editor escuta keydown no mesmo
    // elemento e capturaria Enter/Esc para commit/cancel antes da nossa lógica.
    if (e.key === 'ArrowDown') {
      e.preventDefault(); e.stopImmediatePropagation();
      this._setActive(this._open.active + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); e.stopImmediatePropagation();
      this._setActive(this._open.active - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault(); e.stopImmediatePropagation();
      this._runActive();
    } else if (e.key === 'Escape') {
      e.preventDefault(); e.stopImmediatePropagation();
      this._close();
    }
  }

  /* ---------- Catálogo ---------- */

  /** Constrói o catálogo bruto (sem filtro). */
  _allItems(blockId) {
    const ed = this.editor;
    const items = [];
    const parent = ed.getParentOf(blockId);
    const parentType = parent?.type;
    const ParentClass = parentType ? ed.registry.get(parentType) : null;
    const parentAllowed = ParentClass?.allowedChildren ?? '*';

    for (const B of ed.registry.list()) {
      // Filtra pelo allowedChildren do PAI: o novo bloco será irmão do atual.
      const acceptsHere = parentAllowed === '*'
        || (Array.isArray(parentAllowed) && parentAllowed.includes(B.type))
        || !parent; // sem pai → root, aceita tudo
      if (!acceptsHere) continue;
      items.push({
        kind: 'block',
        type: B.type,
        icon: B.icon || 'square',
        label: B.label || B.type,
        keywords: `${B.type} ${B.label || ''} ${B.category || ''}`.toLowerCase(),
      });
    }
    for (const tpl of ed.listTemplates?.() ?? []) {
      items.push({
        kind: 'template',
        templateId: tpl.id,
        icon: tpl.icon || 'bookmark',
        label: tpl.name || tpl.id,
        keywords: `template ${tpl.name || ''}`.toLowerCase(),
      });
    }
    return items;
  }

  /* ---------- UI ---------- */

  _show(blockId, anchorEl, slashIndex) {
    const allItems = this._allItems(blockId);
    if (!allItems.length) return;
    const menuEl = el('div', {
      class: 'editor-slash-menu', role: 'listbox',
      'aria-label': t('slash.aria'),
    });
    this.canvasWrapper.appendChild(menuEl);
    this._open = { blockId, anchorEl, slashIndex, query: '', allItems,
      items: [], active: 0, menuEl };
    this._renderItems();
    this._reposition();
  }

  _renderItems() {
    if (!this._open) return;
    const { menuEl, allItems, query } = this._open;
    const q = query.trim().toLowerCase();
    const terms = q ? q.split(/\s+/) : [];
    const matched = allItems.filter((it) => {
      if (!terms.length) return true;
      return terms.every((term) => it.keywords.includes(term) || it.label.toLowerCase().includes(term));
    });
    clear(menuEl);
    if (!matched.length) {
      menuEl.appendChild(el('div', { class: 'editor-slash-menu__empty' }, t('slash.empty')));
      this._open.items = [];
      this._open.active = -1;
      return;
    }
    const list = el('ul', { class: 'editor-slash-menu__list' });
    matched.forEach((it, idx) => {
      const li = el('li', {
        class: 'editor-slash-menu__item' + (idx === 0 ? ' is-active' : ''),
        role: 'option',
      }, [
        icon(it.icon, 'editor-slash-menu__icon'),
        el('span', { class: 'editor-slash-menu__label' }, it.label),
        it.kind === 'template'
          ? el('span', { class: 'editor-slash-menu__tag' }, t('slash.tag.template'))
          : null,
      ]);
      // mousedown (não click) — evita perder o foco do contenteditable antes de inserir.
      li.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this._open.active = idx;
        this._runActive();
      });
      li.addEventListener('mousemove', () => this._setActive(idx));
      list.appendChild(li);
    });
    menuEl.appendChild(list);
    this._open.items = matched;
    this._open.active = 0;
  }

  _setActive(idx) {
    if (!this._open?.items.length) return;
    const clamped = Math.max(0, Math.min(idx, this._open.items.length - 1));
    if (this._open.active === clamped) return;
    const list = this._open.menuEl.querySelector('.editor-slash-menu__list');
    if (!list) return;
    list.children[this._open.active]?.classList.remove('is-active');
    this._open.active = clamped;
    const li = list.children[clamped];
    li?.classList.add('is-active');
    li?.scrollIntoView({ block: 'nearest' });
  }

  _reposition() {
    if (!this._open) return;
    const sel = document.getSelection();
    if (!sel?.rangeCount) return;
    const range = sel.getRangeAt(0).cloneRange();
    range.collapse(true);
    const caretRect = range.getBoundingClientRect();
    // Quando o caret está num elemento vazio, getBoundingClientRect retorna 0/0:
    // cai no rect do anchorEl.
    const rect = (caretRect.width === 0 && caretRect.height === 0)
      ? this._open.anchorEl.getBoundingClientRect()
      : caretRect;
    const wrapRect = this.canvasWrapper.getBoundingClientRect();
    const top = rect.bottom - wrapRect.top + this.canvasWrapper.scrollTop + 4;
    const left = rect.left - wrapRect.left + this.canvasWrapper.scrollLeft;
    this._open.menuEl.style.top = `${top}px`;
    this._open.menuEl.style.left = `${left}px`;
  }

  /* ---------- Inserir ---------- */

  _runActive() {
    if (!this._open) return;
    const item = this._open.items[this._open.active];
    if (!item) return;
    const { blockId, anchorEl, slashIndex, query } = this._open;
    this._close();
    this._insert(blockId, anchorEl, slashIndex, query, item);
  }

  _insert(blockId, _anchorEl, _slashIndex, _query, item) {
    const ed = this.editor;
    const parent = ed.getParentOf(blockId);
    if (!parent) { ed.cancelInlineEdit(); return; }
    const idx = parent.children.findIndex((c) => c.id === blockId);

    // Como só abrimos o menu quando `/query` é o conteúdo significativo do
    // editável, o caminho é sempre "substituir o bloco original pelo novo".
    // Cancela a edição (não escreve `/query` no estado) e troca o nó.
    ed.cancelInlineEdit();
    ed.removeBlock(blockId);
    const newId = this._performInsert(item, parent.id, idx);
    if (newId) ed.selectBlock(typeof newId === 'string' ? newId : (newId[0] ?? null));
  }

  _performInsert(item, parentId, index) {
    const ed = this.editor;
    if (item.kind === 'block') return ed.addBlock(parentId, item.type, {}, index);
    if (item.kind === 'template') return ed.insertTemplate(item.templateId, parentId, index);
    return null;
  }

  /* ---------- Util ---------- */

  /** Offset (em caracteres) do caret dentro de `root`, somando todos os text nodes. */
  _caretOffsetIn(root) {
    const sel = document.getSelection();
    if (!sel?.rangeCount) return -1;
    const range = sel.getRangeAt(0);
    if (!root.contains(range.endContainer)) return -1;
    const pre = range.cloneRange();
    pre.selectNodeContents(root);
    pre.setEnd(range.endContainer, range.endOffset);
    return pre.toString().length;
  }

  /* ---------- Fechar ---------- */

  _close() {
    if (this._open) {
      this._open.menuEl.remove();
      this._open = null;
    }
    if (this._cleanup) {
      this._cleanup();
      this._cleanup = null;
    }
  }
}
