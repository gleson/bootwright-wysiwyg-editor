import { el, icon, clear } from '../utils/dom.js';
import { t } from '../i18n/index.js';
import { resolveInsertTarget } from '../utils/insertTarget.js';

/**
 * CommandPalette — busca rápida de ações e inserção de blocos (Ctrl+K).
 *
 * Aberta por Ctrl+K (ou Cmd+K) e pelo botão da Topbar. Como o ExportDialog/
 * SeoDialog, cada `show()` cria um <dialog> e o descarta no `close`.
 *
 * Os comandos são montados a cada abertura (`_buildCommands`) para refletir o
 * estado atual: ações dependentes de seleção/clipboard/histórico só aparecem
 * quando fazem sentido. Três grupos: ações do editor, inserir bloco, templates.
 *
 * Navegação: ↑/↓ movem o destaque, Enter executa, Esc fecha (nativo do
 * <dialog>). Clique num item também executa.
 */
export class CommandPalette {
  constructor(editor) {
    this.editor = editor;
  }

  mount() {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        if (this._dialog) this._dialog.close();
        else this.show();
      }
    });
  }

  /* ---------- Catálogo de comandos ---------- */

  /** Monta a lista de comandos conforme o estado atual do editor. */
  _buildCommands() {
    const ed = this.editor;
    const groups = [];

    /* --- Ações do editor --- */
    const actions = [];
    actions.push({
      icon: 'cloud-arrow-up', label: t('palette.cmd.save'),
      hint: 'Ctrl+S', keywords: 'salvar save guardar',
      run: () => ed.save(),
    });
    if (ed.canUndo()) actions.push({
      icon: 'arrow-counterclockwise', label: t('palette.cmd.undo'),
      hint: 'Ctrl+Z', keywords: 'desfazer undo',
      run: () => ed.undo(),
    });
    if (ed.canRedo()) actions.push({
      icon: 'arrow-clockwise', label: t('palette.cmd.redo'),
      hint: 'Ctrl+Shift+Z', keywords: 'refazer redo',
      run: () => ed.redo(),
    });
    actions.push({
      icon: 'filetype-html', label: t('palette.cmd.exportHtml'),
      keywords: 'exportar export html',
      run: () => ed.ui.exportDialog?.showHTML(),
    });
    actions.push({
      icon: 'file-earmark-code', label: t('palette.cmd.exportStandalone'),
      keywords: 'exportar export html standalone página completa documento',
      run: () => ed.ui.exportDialog?.showStandalone(),
    });
    actions.push({
      icon: 'braces', label: t('palette.cmd.exportJson'),
      keywords: 'exportar export json',
      run: () => ed.ui.exportDialog?.showJSON(),
    });
    actions.push({
      icon: 'box-arrow-in-down', label: t('palette.cmd.import'),
      keywords: 'importar import html markdown md',
      run: () => ed.ui.importDialog?.show(),
    });
    actions.push({
      icon: 'tags', label: t('palette.cmd.seo'),
      keywords: 'seo meta tags open graph busca',
      run: () => ed.ui.seoDialog?.show(),
    });
    actions.push({
      icon: 'universal-access', label: t('palette.cmd.a11y'),
      keywords: 'acessibilidade a11y wcag alt label auditoria',
      run: () => ed.ui.a11yAudit?.show(),
    });
    actions.push({
      icon: 'binoculars', label: t('palette.cmd.findReplace'),
      hint: 'Ctrl+F', keywords: 'buscar localizar substituir find replace',
      run: () => ed.ui.findReplace?.show(),
    });
    actions.push({
      icon: 'gear-fill', label: t('palette.cmd.customization'),
      keywords: 'personalização customização css blocos templates',
      run: () => ed.ui.customizationDialog?.show(),
    });
    actions.push({
      icon: 'layout-sidebar', label: t('palette.cmd.toggleSidebars'),
      hint: 'Ctrl+\\', keywords: 'painéis sidebars esconder mostrar',
      run: () => ed.ui.topbar?._toggleSidebars(),
    });

    const selId = ed.getSelectedId();
    const selIds = ed.getSelectedIds();
    if (selIds.length >= 1) {
      const many = selIds.length > 1;
      actions.push({
        icon: 'copy', label: t('palette.cmd.duplicate'),
        hint: 'Ctrl+D', keywords: 'duplicar duplicate clonar',
        run: () => (many ? ed.duplicateBlocks(selIds) : ed.duplicateBlock(selIds[0])),
      });
      actions.push({
        icon: 'trash', label: t('palette.cmd.remove'),
        hint: 'Delete', keywords: 'remover excluir delete apagar',
        run: () => (many ? ed.removeBlocks(selIds) : ed.removeBlock(selIds[0])),
      });
      actions.push({
        icon: 'x-circle', label: t('palette.cmd.deselect'),
        hint: 'Esc', keywords: 'desselecionar limpar seleção',
        run: () => ed.deselectBlock(),
      });
    }
    if (selId) actions.push({
      icon: 'clipboard', label: t('palette.cmd.copy'),
      hint: 'Ctrl+C', keywords: 'copiar copy',
      run: () => ed.copyBlock(selId),
    });
    if (ed.hasClipboard()) actions.push({
      icon: 'clipboard-plus', label: t('palette.cmd.paste'),
      hint: 'Ctrl+V', keywords: 'colar paste',
      run: () => ed.pasteBlock(ed.getSelectedId()),
    });
    groups.push({ label: t('palette.group.actions'), items: actions });

    /* --- Inserir bloco --- */
    const blocks = (ed.registry?.list() ?? []).map((B) => ({
      icon: B.icon || 'square',
      label: B.label || B.type,
      keywords: `inserir bloco ${B.type} ${B.category || ''}`,
      run: () => this._insertBlock(B.type),
    }));
    if (blocks.length) groups.push({ label: t('palette.group.insert'), items: blocks });

    /* --- Templates --- */
    const templates = (ed.listTemplates?.() ?? []).map((tpl) => ({
      icon: tpl.icon || 'bookmark',
      label: tpl.name || tpl.id,
      keywords: `template ${tpl.name || ''}`,
      run: () => this._insertTemplate(tpl.id),
    }));
    if (templates.length) groups.push({ label: t('palette.group.templates'), items: templates });

    return groups;
  }

  /** Insere um bloco respeitando a seleção (espelha SidebarLeft._insertBlock). */
  _insertBlock(type) {
    const target = resolveInsertTarget(this.editor, type);
    const newId = this.editor.addBlock(target.parentId, type, {}, target.index);
    if (newId) this.editor.selectBlock(newId);
  }

  _insertTemplate(templateId) {
    // Templates entram no fim da raiz (parentId undefined → rootId no Editor).
    this.editor.insertTemplate(templateId);
  }

  /* ---------- UI ---------- */

  show() {
    if (this._dialog) return;
    const groups = this._buildCommands();

    const input = el('input', {
      type: 'text',
      class: 'editor-cmd-palette__input',
      placeholder: t('palette.placeholder'),
      'aria-label': t('palette.aria'),
      autocomplete: 'off',
      spellcheck: 'false',
    });
    const list = el('ul', { class: 'editor-cmd-palette__list', role: 'listbox' });
    const dialog = el('dialog', { class: 'editor-cmd-palette' }, [
      el('div', { class: 'editor-cmd-palette__search' }, [icon('search'), input]),
      list,
    ]);

    this._dialog = dialog;
    this._items = [];     // [{ el, run }] visíveis, em ordem
    this._active = -1;

    const render = (query) => {
      clear(list);
      this._items = [];
      const q = query.trim().toLowerCase();
      const terms = q ? q.split(/\s+/) : [];

      for (const group of groups) {
        const matched = group.items.filter((cmd) => {
          if (!terms.length) return true;
          const hay = `${cmd.label} ${cmd.keywords || ''}`.toLowerCase();
          return terms.every((term) => hay.includes(term));
        });
        if (!matched.length) continue;
        list.appendChild(el('li', {
          class: 'editor-cmd-palette__group', role: 'presentation',
        }, group.label));
        for (const cmd of matched) {
          const li = el('li', {
            class: 'editor-cmd-palette__item', role: 'option',
          }, [
            icon(cmd.icon, 'editor-cmd-palette__icon'),
            el('span', { class: 'editor-cmd-palette__label' }, cmd.label),
            cmd.hint ? el('kbd', { class: 'editor-cmd-palette__hint' }, cmd.hint) : null,
          ]);
          const entry = { el: li, run: cmd.run };
          const idx = this._items.length;
          li.addEventListener('mousemove', () => this._setActive(idx));
          li.addEventListener('click', () => this._runActive(idx));
          this._items.push(entry);
          list.appendChild(li);
        }
      }

      if (!this._items.length) {
        list.appendChild(el('li', {
          class: 'editor-cmd-palette__empty', role: 'presentation',
        }, t('palette.empty')));
      }
      this._setActive(this._items.length ? 0 : -1);
    };

    input.addEventListener('input', () => render(input.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this._setActive(this._active + 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this._setActive(this._active - 1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        this._runActive(this._active);
      }
    });

    document.body.appendChild(dialog);
    dialog.addEventListener('close', () => {
      dialog.remove();
      this._dialog = null;
      this._items = [];
    });
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });

    render('');
    dialog.showModal();
    input.focus();
  }

  /** Move o destaque para `idx` (com clamp) e rola até ele. */
  _setActive(idx) {
    if (!this._items.length) { this._active = -1; return; }
    const clamped = Math.max(0, Math.min(idx, this._items.length - 1));
    if (this._active === clamped) return;
    this._items[this._active]?.el.classList.remove('is-active');
    this._active = clamped;
    const entry = this._items[clamped];
    entry.el.classList.add('is-active');
    entry.el.scrollIntoView({ block: 'nearest' });
  }

  /** Fecha a paleta e executa o comando em `idx`. */
  _runActive(idx) {
    const entry = this._items[idx];
    if (!entry) return;
    this._dialog?.close();
    try {
      entry.run();
    } catch (err) {
      console.error('[CommandPalette] comando falhou:', err);
    }
  }
}
