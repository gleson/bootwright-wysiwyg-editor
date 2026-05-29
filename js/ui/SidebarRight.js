import { el, clear, icon } from '../utils/dom.js';
import { ControlFactory } from './ControlFactory.js';
import { displayControls } from '../blocks/common-controls.js';
import { t } from '../i18n/index.js';

/**
 * SidebarRight — painel contextual de propriedades.
 *
 * Estratégia anti-flicker:
 *   - Reconstrói o painel inteiro só em selection:changed (ou replace global).
 *   - Em state:changed do tipo "update" no nó atual, chama factory.sync() em
 *     cada controle (atualiza valor sem destruir DOM, preservando caret).
 *   - Auto-pula sync em controles cujo input está focado.
 */
const TAB_ORDER = ['content', 'style', 'advanced'];
const tabLabel = (tab) => t(`inspector.tab.${tab}`);

export class SidebarRight {
  constructor(editor) {
    this.editor = editor;
    this.region = editor.root.querySelector('[data-region="sidebar-right"]');
    this.factory = new ControlFactory(editor);
    this.activeTab = 'content';
    /** @type {Array<{ field, input, schema }>} */
    this.controls = [];
  }

  mount() {
    this._mountBreakpointSwitch();
    this.body = el('div', { class: 'editor-sidebar__body' });
    this.region.appendChild(this.body);
    this._renderEmpty();

    this.editor.bus.on('selection:changed', ({ id, ids }) => {
      if (Array.isArray(ids) && ids.length > 1) this._renderMulti(ids);
      else this._render(id);
    });
    this.editor.bus.on('state:changed', (e) => {
      const ids = this.editor.getSelectedIds();
      if (ids.length > 1) { if (e.type === 'replace') this._renderEmpty(); return; }
      const sel = this.editor.getSelectedId();
      if (!sel) return;
      if (e.type === 'replace') { this._render(sel); return; }
      if (e.id === sel && e.type === 'update') this._syncControls();
    });
    this.editor.bus.on('breakpoint:changed', ({ bp }) => {
      this._highlightBreakpoint(bp);
      // Reconstrói o painel: controles responsivos têm values resolvidos no bp
      // de criação; mudar o bp exige recriar os <input>s pra que value e read
      // batam de novo. Sync sozinho não basta.
      const sel = this.editor.getSelectedId();
      if (sel) this._render(sel);
    });
    // Re-render para atualizar o picker de classes personalizadas (aba Avançado).
    this.editor.bus.on('css:changed', () => {
      const sel = this.editor.getSelectedId();
      if (sel) this._render(sel);
    });
    // Re-render para refletir mudanças na paleta/gradientes/fontes do Tema
    // (color compound e typography re-buildam suas listas internas).
    for (const ev of ['palette:changed', 'gradients:changed', 'fonts:changed']) {
      this.editor.bus.on(ev, () => {
        const sel = this.editor.getSelectedId();
        if (sel) this._render(sel);
      });
    }
  }

  _mountBreakpointSwitch() {
    const BPS = [
      { value: '',   label: t('inspector.bp.general'), title: 'Vale para todos os tamanhos (sem prefixo)', icon: 'globe' },
      { value: 'sm', label: 'SM',    title: '≥ 576px / sm',  icon: 'phone-landscape' },
      { value: 'md', label: 'MD',    title: '≥ 768px / md',  icon: 'tablet' },
      { value: 'lg', label: 'LG',    title: '≥ 992px / lg',  icon: 'laptop' },
      { value: 'xl', label: 'XL',    title: '≥ 1200px / xl', icon: 'display' },
    ];
    const wrap = el('div', { class: 'editor-bp-switch', dataset: { region: 'bp-switch' } });
    wrap.appendChild(el('span', { class: 'editor-bp-switch__title' }, t('inspector.bp.title')));
    for (const bp of BPS) {
      const btn = el('button', {
        type: 'button',
        class: 'editor-bp-switch__btn',
        dataset: { bp: bp.value },
        title: bp.title,
      }, [icon(bp.icon), el('span', {}, bp.label)]);
      btn.addEventListener('click', () => this.editor.setBreakpoint(bp.value));
      wrap.appendChild(btn);
    }
    // Limpa o conteúdo prévio do region (placeholder de Fase 0/2) e adiciona o switch
    clear(this.region);
    this.region.appendChild(wrap);
    this._highlightBreakpoint(this.editor.activeBreakpoint);
  }

  _highlightBreakpoint(bp) {
    for (const btn of this.region.querySelectorAll('[data-bp]')) {
      btn.classList.toggle('active', btn.dataset.bp === (bp ?? ''));
    }
  }

  /* ---------- Renderização principal ---------- */

  _render(id) {
    if (!id) return this._renderEmpty();
    const node = this.editor.getNode(id);
    if (!node) return this._renderEmpty();

    this.controls = [];
    clear(this.body);
    this.body.appendChild(this._buildHeader(node));
    this.body.appendChild(this._buildBody(node));
  }

  _renderEmpty() {
    this.controls = [];
    clear(this.body);
    this.body.appendChild(el('div', { class: 'editor-sidebar__placeholder' }, [
      icon('sliders'),
      el('p', {}, t('inspector.empty.title')),
      el('small', {}, t('inspector.empty.hint')),
    ]));
  }

  /** Painel de ações em lote quando há multi-seleção. */
  _renderMulti(ids) {
    this.controls = [];
    clear(this.body);

    const header = el('div', { class: 'editor-sidebar__header' }, [
      el('span', { class: 'editor-sidebar__chip' }, t('inspector.multi.count', { n: ids.length })),
      (() => {
        const close = el('button', {
          type: 'button',
          class: 'btn btn-sm btn-link p-0 ms-auto text-secondary',
          title: t('inspector.close'),
        }, [icon('x-lg')]);
        close.addEventListener('click', () => this.editor.deselectBlock());
        return close;
      })(),
    ]);

    const types = ids
      .map((id) => this.editor.getNode(id)?.type)
      .filter(Boolean);
    const summary = el('div', { class: 'editor-inspector__hint' }, [
      icon('stack'), ' ' + t('inspector.multi.selected', { types: types.join(', ') }),
    ]);

    const dupBtn = el('button', {
      type: 'button',
      class: 'btn btn-sm btn-outline-secondary w-100 d-flex align-items-center justify-content-center gap-1',
    }, [icon('files'), ' ' + t('inspector.multi.duplicateAll')]);
    dupBtn.addEventListener('click', () => this.editor.duplicateBlocks(ids));

    const delBtn = el('button', {
      type: 'button',
      class: 'btn btn-sm btn-outline-danger w-100 d-flex align-items-center justify-content-center gap-1 mt-2',
    }, [icon('trash'), ' ' + t('inspector.multi.deleteAll')]);
    delBtn.addEventListener('click', () => this.editor.removeBlocks(ids));

    this.body.append(header, el('div', { class: 'editor-inspector p-2' }, [
      summary, dupBtn, delBtn,
    ]));
  }

  _buildHeader(node) {
    const closeBtn = el('button', {
      type: 'button',
      class: 'btn btn-sm btn-link p-0 ms-auto text-secondary',
      title: t('inspector.close'),
    }, [icon('x-lg')]);
    closeBtn.addEventListener('click', () => this.editor.deselectBlock());

    return el('div', { class: 'editor-sidebar__header' }, [
      el('span', { class: 'editor-sidebar__chip' }, node.type),
      closeBtn,
    ]);
  }

  _buildBody(node) {
    const BlockClass = this.editor.registry.get(node.type);
    const settings = (BlockClass && typeof BlockClass.settings === 'function')
      ? BlockClass.settings(node) : [];
    // Controle universal de visibilidade por breakpoint — injetado em todos
    // os blocos sem precisar editar cada Block.settings().
    const allSettings = [...settings, ...displayControls()];

    const grouped = { content: [], style: [], advanced: [] };
    for (const s of allSettings) {
      const tab = grouped[s.tab] ? s.tab : 'content';
      grouped[tab].push(s);
    }

    const tabsBar = this._buildTabs(grouped);
    const panels  = this._buildPanels(grouped, node);
    const actions = this._buildActions(node);

    return el('div', { class: 'editor-inspector' }, [tabsBar, ...panels, actions]);
  }

  _buildTabs(grouped) {
    const defaultTab = this._defaultTab(grouped);
    const bar = el('div', { class: 'editor-tabs' });
    for (const tab of TAB_ORDER) {
      const hasContent = grouped[tab].length > 0;
      const btn = el('button', {
        type: 'button',
        class: 'editor-tabs__btn',
        disabled: !hasContent,
        dataset: { tab },
      }, tabLabel(tab));
      if (tab === defaultTab) btn.classList.add('active');
      btn.addEventListener('click', () => this._setActiveTab(tab));
      bar.appendChild(btn);
    }
    this.activeTab = defaultTab;
    return bar;
  }

  _buildPanels(grouped, node) {
    const defaultTab = this._defaultTab(grouped);
    const panels = [];
    for (const tab of TAB_ORDER) {
      const panel = el('div', {
        class: 'editor-inspector__tab-panel',
        dataset: { tabPanel: tab },
      });
      panel.hidden = tab !== defaultTab;

      if (grouped[tab].length === 0) {
        panel.appendChild(el('div', { class: 'editor-inspector__hint' }, [
          icon('info-circle'), ' ' + t('inspector.noControls', { tab: tabLabel(tab) }),
        ]));
      } else {
        for (const schema of grouped[tab]) {
          const ctrl = this.factory.create(schema, node);
          this.controls.push(ctrl);
          panel.appendChild(ctrl.field);
        }
      }
      panels.push(panel);
    }
    return panels;
  }

  _buildActions(node) {
    return el('div', { class: 'editor-inspector__actions' }, [
      this._actionBtn('arrow-up',   t('inspector.action.moveUp'),   () => this._moveSibling(node, -1)),
      this._actionBtn('arrow-down', t('inspector.action.moveDown'), () => this._moveSibling(node, +1)),
      this._actionBtn('files',      t('inspector.action.duplicate'), () => this.editor.duplicateBlock(node.id)),
      this._actionBtn('eraser',     t('inspector.action.clearClasses'), () => this.editor.clearBlockClasses(node.id),
        'btn-outline-warning'),
      this._actionBtn('trash',      t('inspector.action.delete'),   () => this.editor.removeBlock(node.id),
        'btn-outline-danger'),
    ]);
  }

  _actionBtn(iconName, title, handler, extraClass = 'btn-outline-secondary') {
    const btn = el('button', { type: 'button',
      class: `btn btn-sm ${extraClass}`, title }, [icon(iconName)]);
    btn.addEventListener('click', handler);
    return btn;
  }

  /* ---------- Tabs ---------- */

  _defaultTab(grouped) {
    if (grouped[this.activeTab]?.length) return this.activeTab;
    return TAB_ORDER.find((t) => grouped[t].length > 0) ?? 'content';
  }

  _setActiveTab(tab) {
    this.activeTab = tab;
    for (const btn of this.body.querySelectorAll('[data-tab]')) {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    }
    for (const panel of this.body.querySelectorAll('[data-tab-panel]')) {
      panel.hidden = panel.dataset.tabPanel !== tab;
    }
  }

  /* ---------- Sync sem reconstruir ---------- */

  _syncControls() {
    const id = this.editor.getSelectedId();
    if (!id) return;
    const node = this.editor.getNode(id);
    if (!node) return;
    for (const { input, schema } of this.controls) {
      this.factory.sync(input, schema, node);
    }
  }

  /* ---------- Ações ---------- */

  _moveSibling(node, delta) {
    const parent = this.editor.getParentOf(node.id);
    if (!parent) return;
    const idx = parent.children.findIndex((c) => c.id === node.id);
    const target = idx + delta;
    if (target < 0 || target >= parent.children.length) return;
    this.editor.moveBlock(node.id, parent.id, target);
  }
}
