import { el, icon } from '../utils/dom.js';
import { Editor } from '../core/Editor.js';
import { htmlToBlocks } from '../utils/htmlImport.js';
import { formatHTML } from '../utils/htmlFormat.js';
import { resolveInsertTarget } from '../utils/insertTarget.js';
import { t } from '../i18n/index.js';

/**
 * Todos os botões disponíveis na barra do CompactEditor.
 * Cada entrada define: key (identificador), role (ação), iconName, i18nKey,
 * e opcionalmente value (parâmetro da ação) e um builder especial.
 */
const TOOLBAR_DEFS = {
  paragraph:     { role: 'insert',      iconName: 'type',                i18nKey: 'compactEditor.insertParagraph' },
  heading:       { role: 'dropdown-heading',                             i18nKey: 'compactEditor.insertHeading'   },
  blockquote:    { role: 'insert',      iconName: 'quote',               i18nKey: 'compactEditor.insertBlockquote' },
  image:         { role: 'insert',      iconName: 'image',               i18nKey: 'compactEditor.insertImage'    },
  table:         { role: 'insert',      iconName: 'table',               i18nKey: 'compactEditor.insertTable'    },
  'list-ul':     { role: 'insert-list', iconName: 'list-ul',   value: 'false', i18nKey: 'compactEditor.insertListUl' },
  'list-ol':     { role: 'insert-list', iconName: 'list-ol',   value: 'true',  i18nKey: 'compactEditor.insertListOl' },
  divider:       { role: 'insert',      iconName: 'hr',                  i18nKey: 'compactEditor.insertDivider'  },
  bold:          { role: 'fmt',         iconName: 'type-bold',       value: 'bold',         i18nKey: 'compactEditor.bold'        },
  italic:        { role: 'fmt',         iconName: 'type-italic',     value: 'italic',       i18nKey: 'compactEditor.italic'      },
  underline:     { role: 'fmt',         iconName: 'type-underline',  value: 'underline',    i18nKey: 'compactEditor.underline'   },
  strikethrough: { role: 'fmt',         iconName: 'type-strikethrough', value: 'strikeThrough', i18nKey: 'compactEditor.strikethrough' },
  link:          { role: 'fmt-link',    iconName: 'link-45deg',          i18nKey: 'compactEditor.link'           },
  'clear-fmt':   { role: 'fmt',         iconName: 'eraser',          value: 'removeFormat', i18nKey: 'compactEditor.clearFormat' },
  'align-start': { role: 'align',       iconName: 'text-left',       value: 'text-start',   i18nKey: 'compactEditor.alignLeft'   },
  'align-center':{ role: 'align',       iconName: 'text-center',     value: 'text-center',  i18nKey: 'compactEditor.alignCenter' },
  'align-end':   { role: 'align',       iconName: 'text-right',      value: 'text-end',     i18nKey: 'compactEditor.alignRight'  },
  undo:          { role: 'history',     iconName: 'arrow-counterclockwise', value: 'undo',  i18nKey: 'topbar.undo'               },
  redo:          { role: 'history',     iconName: 'arrow-clockwise',        value: 'redo',  i18nKey: 'topbar.redo'               },
};

const ALIGN_CLASSES = ['text-start', 'text-center', 'text-end'];

/**
 * Lista-padrão de ferramentas (da esquerda para a direita).
 * 'sep' insere um separador vertical.
 */
export const DEFAULT_COMPACT_TOOLS = [
  'paragraph', 'heading', 'blockquote', 'sep',
  'image', 'table', 'list-ul', 'list-ol', 'divider', 'sep',
  'bold', 'italic', 'underline', 'strikethrough', 'link', 'clear-fmt', 'sep',
  'align-start', 'align-center', 'align-end', 'sep',
  'undo', 'redo',
];

/**
 * CompactEditor — editor de conteúdo com barra de ferramentas no topo.
 *
 * Ideal para espaços apertados onde as duas sidebars do editor principal
 * ficam sobre o texto. Abre como dialog full-screen (100vw × 100vh) com:
 *   - Cabeçalho fino: título + Salvar/Cancelar.
 *   - Barra de ferramentas: inserir blocos, formatar inline, alinhar, undo/redo.
 *   - Canvas expandido (sem sidebars).
 *
 * Uso:
 *   editor.ui.compactEditor.open({ html, onSave });
 *   editor.ui.compactEditor.openForEditor(editor);   // sincroniza com editor pai
 *
 * A lista de ferramentas pode ser customizada via opção `tools`:
 *   open({ tools: ['paragraph', 'heading', 'sep', 'bold', 'italic', 'sep', 'undo', 'redo'] })
 */
export class CompactEditor {
  constructor(editor) {
    this.editor = editor;
    this._dialog = null;
    this._inlineEditEl = null;
    this._codeMode = false;
  }

  /**
   * Abre o compact editor. Se já houver um aberto, ignora.
   *
   * @param {{
   *   title?: string,
   *   html?: string,
   *   tools?: string[],
   *   allowFullMode?: boolean,
   *   allowHtmlMode?: boolean,
   *   onSave: (html: string) => void,
   * }} opts
   *
   * `allowFullMode` (default `true`): exibe um botão no cabeçalho que alterna
   * para o "modo completo" — revela a topbar nativa do sub-editor e as duas
   * sidebars (biblioteca de blocos + propriedades), ocultando a barra compacta.
   * Passe `false` para travar no modo compacto (ex.: campos de comentário/
   * anotação no frontend onde só se quer edição leve).
   *
   * `allowHtmlMode` (default `true`): exibe o botão que alterna para o editor de
   * código-fonte HTML. Passe `false` em campos de edição leve (comentários),
   * onde editar HTML cru não faz sentido.
   */
  open(opts = {}) {
    if (this._dialog) return;
    const {
      title   = t('compactEditor.title'),
      html    = '',
      tools   = DEFAULT_COMPACT_TOOLS,
      allowFullMode = true,
      allowHtmlMode = true,
      onSave,
    } = opts;

    const dialog = el('dialog', { class: 'editor-compact-dialog' });
    this._dialog = dialog;

    /* ---- Cabeçalho ---- */
    const btnCancel = el('button', {
      type: 'button', class: 'btn btn-sm btn-outline-secondary',
    }, t('contentEditor.cancel'));

    const btnSave = el('button', {
      type: 'button', class: 'btn btn-sm btn-primary',
    }, [icon('check2'), ' ', t('contentEditor.saveReturn')]);

    // Botão de alternância Visual ⇄ HTML (código-fonte). Opcional via allowHtmlMode.
    let btnCode = null;
    if (allowHtmlMode) {
      btnCode = el('button', {
        type: 'button', class: 'btn btn-sm btn-outline-light',
        'aria-pressed': 'false',
        title: t('compactEditor.htmlMode'),
        'aria-label': t('compactEditor.htmlMode'),
      }, [icon('code-slash'), ' ',
          el('span', { class: 'editor-compact-codemode-label' }, t('compactEditor.htmlMode'))]);
    }

    // Botão de alternância compacto ⇄ completo (opcional via allowFullMode).
    let btnFullMode = null;
    if (allowFullMode) {
      btnFullMode = el('button', {
        type: 'button', class: 'btn btn-sm btn-outline-light',
        'aria-pressed': 'false',
        title: t('compactEditor.fullMode'),
        'aria-label': t('compactEditor.fullMode'),
      }, [icon('arrows-fullscreen'), ' ',
          el('span', { class: 'editor-compact-fullmode-label' }, t('compactEditor.fullMode'))]);
      btnFullMode.addEventListener('click', () => this._toggleFullMode(dialog, btnFullMode));
    }

    const headerActions = [];
    if (btnCode) headerActions.push(btnCode);
    if (btnFullMode) headerActions.push(btnFullMode);
    headerActions.push(btnCancel, btnSave);

    // O texto do título vive num span próprio para ser trocado ao alternar de
    // modo (compacto ⇄ completo). Os dois rótulos ficam no dataset: no modo
    // completo mostramos o título original do editor (o brand da topbar do
    // editor pai), não um rótulo genérico.
    const titleText = el('span', {
      class: 'editor-compact-dialog__title-text',
      dataset: { compactTitle: title, fullTitle: this._resolveEditorTitle() },
    }, title);

    dialog.appendChild(el('header', { class: 'editor-compact-dialog__header' }, [
      el('div', { class: 'editor-compact-dialog__title' }, [icon('pencil-square'), ' ', titleText]),
      el('div', { class: 'editor-compact-dialog__header-actions' }, headerActions),
    ]));

    /* ---- Barra de ferramentas ---- */
    const toolbar = this._buildToolbar(tools);
    dialog.appendChild(toolbar);

    /* ---- Shell do sub-editor (sidebars presentes no DOM mas ocultas via CSS) ---- */
    const canvasEl = el('div', {
      class: 'editor-canvas',
      dataset: { region: 'canvas', device: 'desktop' },
      tabindex: 0,
    });

    const shell = el('div', {
      class: 'editor-shell editor-compact-dialog__shell',
      role: 'application',
      'aria-label': title,
    }, [
      // Topbar fantasma — necessário para que a classe Topbar encontre seus seletores.
      el('header', { class: 'editor-topbar editor-compact-dialog__ghost-topbar', role: 'toolbar' }, [
        el('div', { class: 'editor-topbar__group editor-topbar__group--start' }),
        el('div', {
          class: 'editor-topbar__group editor-topbar__group--center',
          dataset: { region: 'device-switch' }, role: 'group',
        }, [
          el('button', { type: 'button', class: 'btn btn-sm btn-outline-secondary', dataset: { device: 'desktop' }, disabled: true }, [icon('display')]),
          el('button', { type: 'button', class: 'btn btn-sm btn-outline-secondary', dataset: { device: 'tablet'  }, disabled: true }, [icon('tablet')]),
          el('button', { type: 'button', class: 'btn btn-sm btn-outline-secondary', dataset: { device: 'mobile'  }, disabled: true }, [icon('phone')]),
        ]),
        el('div', {
          class: 'editor-topbar__group editor-topbar__group--end',
          dataset: { region: 'actions' }, role: 'group',
        }, [
          el('button', { type: 'button', class: 'btn btn-sm btn-outline-secondary', dataset: { action: 'undo' }, disabled: true }, [icon('arrow-counterclockwise')]),
          el('button', { type: 'button', class: 'btn btn-sm btn-outline-secondary', dataset: { action: 'redo' }, disabled: true }, [icon('arrow-clockwise')]),
          el('button', { type: 'button', class: 'btn btn-sm btn-primary d-none', dataset: { action: 'save' }, hidden: true, 'aria-hidden': 'true' }, [icon('check')]),
        ]),
      ]),
      el('div', { class: 'editor-body' }, [
        el('aside', { class: 'editor-sidebar editor-sidebar--left',  dataset: { region: 'sidebar-left'  } }),
        el('main',  { class: 'editor-canvas-wrapper', dataset: { region: 'canvas-wrapper' } }, [canvasEl]),
        el('aside', { class: 'editor-sidebar editor-sidebar--right', dataset: { region: 'sidebar-right' } }),
      ]),
    ]);

    dialog.appendChild(shell);

    /* ---- Painel de código-fonte HTML (oculto até alternar) ---- */
    const codeTa = el('textarea', {
      class: 'form-control font-monospace editor-compact-dialog__code-ta',
      spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off',
    });
    const codePanel = el('div', {
      class: 'editor-compact-dialog__code',
    }, [
      el('p', { class: 'editor-compact-dialog__code-hint small mb-2' },
        t('compactEditor.htmlHint')),
      codeTa,
    ]);
    dialog.appendChild(codePanel);

    document.body.appendChild(dialog);

    /* ---- Sub-editor ---- */
    let initialChildren = [];
    try { initialChildren = htmlToBlocks(html, this.editor?.sanitizer); } catch { /* vazio é válido */ }

    let subEd;
    try {
      subEd = new Editor({
        rootElement: shell,
        autoSave: false,
        collabUrl: null,
        initialJSON: { type: 'root', children: initialChildren },
      });
      if (this.editor?.customizations) {
        subEd.customizations.importAll(this.editor.customizations.exportAll());
      }
      subEd.init();
    } catch (err) {
      console.error('[CompactEditor] Falha ao inicializar sub-editor:', err);
      dialog.remove();
      this._dialog = null;
      return;
    }

    this._wireToolbar(toolbar, subEd);

    /* ---- Alternância Visual ⇄ código-fonte HTML ----
       Aplica o HTML editado de volta ao sub-editor via reconciliação (Fase 2):
       blocos inalterados reaproveitam o nó original (preserva compostos), só os
       alterados são reimportados. Retorna false em caso de erro de parse. */
    this._codeMode = false;
    const applyCodeToEditor = () => {
      try {
        subEd.importContent({ format: 'html', source: codeTa.value, mode: 'replace', diff: true });
        return true;
      } catch (err) {
        console.error('[CompactEditor] aplicar HTML editado falhou:', err);
        this.editor?.notify?.toast?.(t('htmlSource.error'), 'danger');
        return false;
      }
    };
    const toggleCode = () => {
      const goingToCode = !this._codeMode;
      if (goingToCode) {
        codeTa.value = formatHTML(subEd.exportHTML());
      } else if (!applyCodeToEditor()) {
        return; // mantém no modo código se o parse falhar
      }
      this._codeMode = goingToCode;
      dialog.classList.toggle('editor-compact-dialog--code', goingToCode);
      const label = goingToCode ? t('compactEditor.visualMode') : t('compactEditor.htmlMode');
      btnCode.setAttribute('aria-pressed', String(goingToCode));
      btnCode.title = label;
      btnCode.setAttribute('aria-label', label);
      const iconEl = btnCode.querySelector('i');
      if (iconEl) iconEl.className = `bi bi-${goingToCode ? 'easel' : 'code-slash'}`;
      const labelEl = btnCode.querySelector('.editor-compact-codemode-label');
      if (labelEl) labelEl.textContent = label;
      if (goingToCode) codeTa.focus();
    };
    if (btnCode) btnCode.addEventListener('click', toggleCode);

    /* ---- Bloqueia atalhos globais do editor pai enquanto aberto ---- */
    const trapShortcuts = (e) => {
      const blockKeys = new Set(['z', 'y', 's', 'k', 'f', '/']);
      if ((e.ctrlKey || e.metaKey) && blockKeys.has(e.key.toLowerCase())) {
        if (dialog.contains(e.target)) e.stopImmediatePropagation();
      }
    };
    document.addEventListener('keydown', trapShortcuts, true);

    /* ---- Salvar / fechar ---- */
    const close = (commit) => {
      if (commit) {
        // Se está no modo código, aplica o HTML editado ao sub-editor antes de
        // exportar (senão as edições no textarea seriam ignoradas).
        if (this._codeMode && !applyCodeToEditor()) return;
        try {
          const out = subEd.exportHTML();
          onSave?.(out);
        } catch (err) {
          console.error('[CompactEditor] exportHTML falhou:', err);
          this.editor?.notify?.toast?.(t('contentEditor.error'), 'danger');
          return;
        }
      }
      document.removeEventListener('keydown', trapShortcuts, true);
      this._inlineEditEl = null;
      this._codeMode = false;
      dialog.close();
    };

    btnCancel.addEventListener('click', () => close(false));
    btnSave.addEventListener('click',   () => close(true));
    dialog.addEventListener('close',  () => { dialog.remove(); this._dialog = null; });
    dialog.addEventListener('cancel', (e) => { e.preventDefault(); close(false); });

    dialog.showModal();
  }

  /**
   * Atalho: abre o compact editor sincronizado com o editor pai.
   * Exporta o HTML atual, edita no modo compacto e importa ao salvar.
   */
  openForEditor(parentEditor) {
    const html = parentEditor.exportHTML?.() ?? '';
    this.open({
      html,
      onSave: (saved) => {
        try {
          const blocks = htmlToBlocks(saved, parentEditor.sanitizer);
          parentEditor.loadJSON({ type: 'root', children: blocks });
        } catch (err) {
          console.error('[CompactEditor] sync com editor pai falhou:', err);
        }
      },
    });
  }

  /**
   * Alterna entre modo compacto e modo completo no mesmo dialog.
   *
   * O sub-editor já é um `Editor` completo: a topbar nativa (device switch,
   * undo/redo) e as sidebars (biblioteca + propriedades) só estão ocultas via
   * CSS. O modo completo apenas revela essas regiões e oculta a barra compacta;
   * o cabeçalho com Salvar/Cancelar permanece (é o contrato do modal).
   */
  /**
   * Título a exibir no modo completo: o "nome original" do editor — o brand da
   * topbar do editor pai (ex.: "Bootwright WYSIWYG Editor"). Cai para
   * `document.title` e, por fim, para a string genérica de modo completo.
   */
  _resolveEditorTitle() {
    const brand = this.editor?.root?.querySelector?.('.editor-topbar__brand');
    const fromBrand = brand?.textContent?.replace(/\s+/g, ' ').trim();
    return fromBrand || document.title?.trim() || t('compactEditor.fullTitle');
  }

  _toggleFullMode(dialog, btn) {
    const full = dialog.classList.toggle('editor-compact-dialog--full');
    const label = full ? t('compactEditor.compactMode') : t('compactEditor.fullMode');
    btn.setAttribute('aria-pressed', String(full));
    btn.title = label;
    btn.setAttribute('aria-label', label);
    const iconEl = btn.querySelector('i');
    if (iconEl) iconEl.className = `bi bi-${full ? 'fullscreen-exit' : 'arrows-fullscreen'}`;
    const labelEl = btn.querySelector('.editor-compact-fullmode-label');
    if (labelEl) labelEl.textContent = label;

    // O cabeçalho passa a refletir o modo: título "Editor completo" e tema claro
    // (estilo do CSS via .editor-compact-dialog--full) — em vez de manter o
    // visual escuro "Editor rápido" no modo completo.
    const titleText = dialog.querySelector('.editor-compact-dialog__title-text');
    if (titleText) {
      titleText.textContent = full ? titleText.dataset.fullTitle : titleText.dataset.compactTitle;
    }
  }

  /* ================================================================
     Barra de ferramentas
     ================================================================ */

  _buildToolbar(tools) {
    const tb = el('div', {
      class: 'editor-compact-toolbar',
      role: 'toolbar',
      'aria-label': t('compactEditor.toolbarAria'),
    });

    for (const key of tools) {
      if (key === 'sep') {
        tb.appendChild(el('div', { class: 'editor-compact-toolbar__sep', 'aria-hidden': 'true' }));
        continue;
      }
      if (key === 'heading') {
        tb.appendChild(this._buildHeadingDropdown());
        continue;
      }
      const def = TOOLBAR_DEFS[key];
      if (!def) continue;

      const btn = el('button', {
        type: 'button',
        class: 'editor-compact-toolbar__btn',
        title: t(def.i18nKey),
        'aria-label': t(def.i18nKey),
        dataset: { ctKey: key, ctRole: def.role, ...(def.value != null ? { ctValue: def.value } : {}) },
      }, [icon(def.iconName)]);

      if (def.role === 'history') btn.disabled = true; // habilitado por history:changed
      tb.appendChild(btn);
    }

    return tb;
  }

  _buildHeadingDropdown() {
    const items = [1, 2, 3, 4, 5, 6].map((n) =>
      el('button', {
        type: 'button',
        class: 'editor-compact-dropdown__item',
        dataset: { ctRole: 'insert-heading', ctValue: String(n) },
      }, `H${n}`),
    );

    const menu = el('div', {
      class: 'editor-compact-dropdown__menu',
      hidden: true,
    }, items);

    const toggle = el('button', {
      type: 'button',
      class: 'editor-compact-toolbar__btn editor-compact-toolbar__btn--has-dropdown',
      title: t('compactEditor.insertHeading'),
      'aria-label': t('compactEditor.insertHeading'),
      'aria-haspopup': 'true',
    }, [icon('type-h2'), icon('chevron-down')]);

    toggle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const wasHidden = menu.hidden;
      // Fecha outros menus abertos.
      document.querySelectorAll('.editor-compact-dropdown__menu').forEach((m) => {
        m.hidden = true;
      });
      menu.hidden = !wasHidden;
    });

    // Fecha ao clicar fora.
    document.addEventListener('mousedown', (e) => {
      if (!toggle.contains(e.target) && !menu.contains(e.target)) {
        menu.hidden = true;
      }
    }, { capture: false });

    return el('div', { class: 'editor-compact-dropdown' }, [toggle, menu]);
  }

  /* ================================================================
     Wiring — conecta toolbar ao sub-editor após init()
     ================================================================ */

  _wireToolbar(toolbar, subEd) {
    // Rastreia elemento em edição inline (para execCommand).
    subEd.bus.on('inline-edit:started', ({ id }) => {
      this._inlineEditEl = subEd.renderer?.nodeElements.get(id) ?? null;
    });
    subEd.bus.on('inline-edit:ended', () => {
      this._inlineEditEl = null;
    });

    // Habilita/desabilita botões de histórico.
    subEd.bus.on('history:changed', ({ canUndo, canRedo }) => {
      const btn = (key) => toolbar.querySelector(`[data-ct-key="${key}"]`);
      const u = btn('undo'); if (u) u.disabled = !canUndo;
      const r = btn('redo'); if (r) r.disabled = !canRedo;
    });

    // Sincroniza estado dos botões de alinhamento.
    subEd.bus.on('selection:changed', ({ id }) => {
      this._syncAlignButtons(toolbar, subEd, id);
    });

    // Delegação de cliques na toolbar.
    toolbar.addEventListener('mousedown', (e) => {
      const btn = e.target.closest('[data-ct-role]');
      if (!btn) return;
      e.preventDefault();

      const { ctRole: role, ctKey: key, ctValue: value } = btn.dataset;

      switch (role) {
        case 'insert':
          this._insertBlock(subEd, key);
          break;

        case 'insert-list':
          this._insertBlock(subEd, 'list', { ordered: value === 'true' });
          break;

        case 'insert-heading': {
          this._insertBlock(subEd, 'heading', { level: Number(value) });
          toolbar.querySelector('.editor-compact-dropdown__menu').hidden = true;
          break;
        }

        case 'fmt':
          if (this._inlineEditEl) {
            document.execCommand(value, false, null);
            this._inlineEditEl.focus();
          }
          break;

        case 'fmt-link':
          this._handleLink(subEd);
          break;

        case 'align':
          this._applyAlign(subEd, value);
          this._syncAlignButtons(toolbar, subEd, subEd.getSelectedId());
          break;

        case 'history':
          if (value === 'undo') subEd.undo();
          else subEd.redo();
          break;
      }
    });
  }

  /* ---------------------------------------------------------------- */

  _insertBlock(subEd, type, extraProps = {}) {
    const target = resolveInsertTarget(subEd, type);
    const id = subEd.addBlock(target.parentId, type, extraProps, target.index);
    if (id) subEd.selectBlock(id);
  }

  _applyAlign(subEd, alignClass) {
    const id = subEd.getSelectedId();
    if (!id) return;
    const node = subEd.getNode(id);
    if (!node) return;
    // Remove alinhamentos existentes; toggle se clicado o mesmo.
    const classes = (node.classes ?? []).filter((c) => !ALIGN_CLASSES.includes(c));
    if (!node.classes?.includes(alignClass)) classes.push(alignClass);
    subEd.updateBlock(id, { classes });
  }

  _syncAlignButtons(toolbar, subEd, selectedId) {
    const node = selectedId ? subEd.getNode(selectedId) : null;
    const active = node?.classes?.find((c) => ALIGN_CLASSES.includes(c)) ?? null;
    for (const btn of toolbar.querySelectorAll('[data-ct-role="align"]')) {
      btn.classList.toggle('active', btn.dataset.ctValue === active);
    }
  }

  async _handleLink(subEd) {
    const editingEl = this._inlineEditEl;
    if (!editingEl) return;

    const sel = document.getSelection();
    let currentLink = null;
    if (sel?.rangeCount) {
      const node = sel.getRangeAt(0).startContainer;
      const a = (node instanceof Element ? node : node.parentElement)?.closest?.('a');
      if (a) currentLink = {
        el: a,
        url:    a.getAttribute('href')   ?? '',
        target: a.getAttribute('target') ?? '',
        rel:    a.getAttribute('rel')    ?? '',
      };
    }
    const savedRange = sel?.rangeCount ? sel.getRangeAt(0).cloneRange() : null;

    const result = await subEd.notify.linkDialog({
      url:    currentLink?.url    ?? '',
      target: currentLink?.target ?? '',
      rel:    currentLink?.rel    ?? '',
      hasLink: !!currentLink,
    });
    if (result === null) return;

    if (savedRange) {
      const s = document.getSelection();
      s.removeAllRanges();
      s.addRange(savedRange);
    }
    editingEl.focus();

    if (result.remove || !result.url) {
      document.execCommand('unlink');
    } else if (currentLink) {
      currentLink.el.setAttribute('href', result.url);
      const sa = (attr, val) => val ? currentLink.el.setAttribute(attr, val) : currentLink.el.removeAttribute(attr);
      sa('target', result.target);
      sa('rel',    result.rel);
    } else {
      document.execCommand('createLink', false, result.url);
      for (const a of editingEl.querySelectorAll(`a[href="${CSS.escape(result.url)}"]`)) {
        const sa = (attr, val) => val ? a.setAttribute(attr, val) : a.removeAttribute(attr);
        sa('target', result.target);
        sa('rel',    result.rel);
      }
    }
    editingEl.dispatchEvent(new InputEvent('input', { bubbles: true }));
  }
}
