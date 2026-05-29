import { el, clear, icon } from '../utils/dom.js';
import { t } from '../i18n/index.js';
import { resolveInsertTarget } from '../utils/insertTarget.js';

/**
 * SidebarLeft — abas "Blocos" (Fase 3+) e "Estrutura" (outline).
 *
 * Outline:
 *   - Reflete a árvore JSON em tempo real (escuta state:changed).
 *   - Click em item → seleciona o bloco (editor.selectBlock).
 *   - Realça o item correspondente à seleção atual.
 */
export class SidebarLeft {
  constructor(editor) {
    this.editor = editor;
    this.region = editor.root.querySelector('[data-region="sidebar-left"]');
    this.activeTab = 'blocks';
  }

  mount() {
    clear(this.region);
    this.region.appendChild(this._buildTabs());
    this.blocksPanel = this._buildBlocksPanel();
    this.templatesPanel = this._buildTemplatesPanel();
    this.outlinePanel = this._buildOutlinePanel();
    this.region.appendChild(this.blocksPanel);
    this.region.appendChild(this.templatesPanel);
    this.region.appendChild(this.outlinePanel);

    this._setActiveTab('blocks');

    this.editor.bus.on('state:changed', () => this._scheduleRenderOutline());
    this.editor.bus.on('selection:changed', ({ id }) => this._highlight(id));
    this.editor.bus.on('customblocks:changed', () => this._populateBlocks());
    this.editor.bus.on('components:changed',   () => this._populateBlocks());
    this.editor.bus.on('templates:changed', () => this._populateTemplates());
    // Refresh da lista de templates quando entra/sai do edit-mode (item destacado).
    this.editor.bus.on('template-edit:started', () => this._populateTemplates());
    this.editor.bus.on('template-edit:ended',   () => this._populateTemplates());
    this._populateBlocks();
    this._populateTemplates();
    this._renderOutline();
  }

  /**
   * Coalesce múltiplos state:changed em uma única re-renderização do outline
   * (próximo frame). Evita N renders em N mutations consecutivas.
   */
  _scheduleRenderOutline() {
    if (this._outlineRaf) return;
    this._outlineRaf = requestAnimationFrame(() => {
      this._outlineRaf = null;
      this._renderOutline();
    });
  }

  /* ---------- Tabs ---------- */

  _buildTabs() {
    return el('div', { class: 'editor-tabs', dataset: { region: 'sidebar-tabs' } }, [
      this._tabButton('blocks',    t('sidebar.tab.blocks'),    'grid-3x3-gap'),
      this._tabButton('templates', t('sidebar.tab.templates'), 'bookmark'),
      this._tabButton('outline',   t('sidebar.tab.outline'),   'list-nested'),
    ]);
  }

  _tabButton(id, label, iconName) {
    const btn = el('button', {
      type: 'button',
      class: 'editor-tabs__btn',
      dataset: { tab: id },
    }, [icon(iconName), ' ', label]);
    btn.addEventListener('click', () => this._setActiveTab(id));
    return btn;
  }

  _setActiveTab(tabId) {
    this.activeTab = tabId;
    for (const btn of this.region.querySelectorAll('[data-tab]')) {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    }
    this.blocksPanel.hidden    = tabId !== 'blocks';
    this.templatesPanel.hidden = tabId !== 'templates';
    this.outlinePanel.hidden   = tabId !== 'outline';
  }

  /* ---------- Painel "Blocos" ---------- */

  _buildBlocksPanel() {
    const search = el('input', {
      type: 'search',
      class: 'form-control form-control-sm editor-blocks-search',
      placeholder: t('sidebar.blocks.search'),
      'aria-label': t('sidebar.blocks.searchAria'),
    });
    search.addEventListener('input', () => {
      this._searchQuery = search.value.trim().toLowerCase();
      this._populateBlocks();
    });
    // Esc no campo limpa.
    search.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && search.value) {
        e.stopPropagation();
        search.value = '';
        this._searchQuery = '';
        this._populateBlocks();
      }
    });
    this._searchInput = search;
    this._searchQuery = '';

    return el('div', { class: 'editor-sidebar__panel' }, [
      el('div', { class: 'editor-blocks-search-wrap' }, [search]),
      el('div', { class: 'editor-blocks-list', dataset: { region: 'blocks-list' } }),
    ]);
  }

  _populateBlocks() {
    const list = this.blocksPanel.querySelector('[data-region="blocks-list"]');
    clear(list);
    const blocks = this.editor.registry?.list() ?? [];
    if (blocks.length === 0) {
      list.appendChild(el('div', { class: 'editor-sidebar__placeholder' }, [
        el('small', {}, t('sidebar.blocks.none')),
      ]));
      return;
    }

    const q = this._searchQuery ?? '';
    const matches = (B) => {
      if (!q) return true;
      const haystack = [B.label, B.type, B.category]
        .filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    };
    const filtered = blocks.filter(matches);

    if (filtered.length === 0) {
      list.appendChild(el('div', { class: 'editor-sidebar__placeholder' }, [
        icon('search'),
        el('p', {}, t('sidebar.blocks.noResults')),
        el('small', {}, t('sidebar.blocks.noResultsFor', { q })),
      ]));
      return;
    }

    // Favoritos (só quando NÃO há busca ativa: filtro tem prioridade visual).
    if (!q) {
      const favs = this._getFavoriteBlocks(blocks);
      if (favs.length) {
        list.appendChild(el('div',
          { class: 'editor-blocks-list__header editor-blocks-list__header--favorites' },
          [icon('star-fill'), ' ' + t('sidebar.blocks.favorites')]));
        for (const B of favs) list.appendChild(this._buildBlockButton(B));
      }
    }

    const categories = [
      { key: 'basic',      label: t('sidebar.cat.basic') },
      { key: 'bootstrap',  label: t('sidebar.cat.bootstrap') },
      { key: 'elements',   label: t('sidebar.cat.elements') },
      { key: 'forms',      label: t('sidebar.cat.forms') },
      { key: 'components', label: t('sidebar.cat.components') },
      { key: 'custom',     label: t('sidebar.cat.custom') },
    ];
    const grouped = { basic: [], bootstrap: [], elements: [], forms: [], components: [], custom: [] };
    for (const B of filtered) {
      const cat = grouped[B.category] ? B.category : 'basic';
      grouped[cat].push(B);
    }

    for (const cat of categories) {
      const empty = grouped[cat.key].length === 0;
      const isCustom     = cat.key === 'custom';
      const isComponents = cat.key === 'components';
      if (empty && !(isCustom || isComponents) && !q) continue;
      if (empty && q) continue;
      list.appendChild(el('div', { class: 'editor-blocks-list__header' }, cat.label));
      if (empty && isCustom) {
        list.appendChild(el('div', { class: 'editor-blocks-list__empty' }, [
          el('small', { class: 'text-muted' }, t('sidebar.custom.empty')),
        ]));
        continue;
      }
      if (empty && isComponents) {
        list.appendChild(el('div', { class: 'editor-blocks-list__empty' }, [
          el('small', { class: 'text-muted' }, t('sidebar.components.empty')),
        ]));
        continue;
      }
      for (const B of grouped[cat.key]) list.appendChild(this._buildBlockButton(B));
    }
  }

  /**
   * Lê tipos favoritos do localStorage e devolve as classes na ordem em que
   * o usuário marcou. Tipos não registrados são silenciosamente ignorados.
   */
  _getFavoriteBlocks(allBlocks) {
    const types = this._readFavorites();
    if (types.length === 0) return [];
    const byType = new Map(allBlocks.map((B) => [B.type, B]));
    const out = [];
    for (const t of types) {
      const B = byType.get(t);
      if (B && !out.includes(B)) out.push(B);
    }
    return out;
  }

  _readFavorites() {
    try {
      const raw = localStorage.getItem('editor:favoriteBlocks');
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  }

  _writeFavorites(types) {
    try {
      localStorage.setItem('editor:favoriteBlocks', JSON.stringify(types));
    } catch {}
  }

  _isFavorite(type) {
    return this._readFavorites().includes(type);
  }

  _toggleFavorite(type) {
    const arr = this._readFavorites();
    const idx = arr.indexOf(type);
    if (idx >= 0) arr.splice(idx, 1);
    else          arr.push(type);
    this._writeFavorites(arr);
    return idx < 0; // true = adicionou; false = removeu
  }

  /**
   * Constrói uma "tile" para um bloco. Como precisamos de um botão dentro do
   * botão (estrela toggle), o container externo é um `<div role="button">`
   * (HTML não permite button-in-button) e a estrela é um `<button>` real
   * com stopPropagation para não disparar o insert ao clicar nela.
   */
  _buildBlockButton(BlockClass) {
    const isFav = this._isFavorite(BlockClass.type);
    const favLabel = isFav ? t('sidebar.fav.remove') : t('sidebar.fav.add');
    const star = el('button', {
      type: 'button',
      class: `editor-blocks-list__star${isFav ? ' editor-blocks-list__star--on' : ''}`,
      title: favLabel,
      'aria-label': favLabel,
      'aria-pressed': isFav ? 'true' : 'false',
    }, [icon(isFav ? 'star-fill' : 'star')]);
    star.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const added = this._toggleFavorite(BlockClass.type);
      this._populateBlocks();
      const name = BlockClass.label || BlockClass.type;
      this.editor.notify?.toast(
        added
          ? t('sidebar.fav.added', { name })
          : t('sidebar.fav.removed', { name }),
        'info', { duration: 1800 });
    });

    const tile = el('div', {
      class: 'editor-blocks-list__item',
      role: 'button',
      tabindex: '0',
      title: t('sidebar.block.insertHint'),
      draggable: 'true',
    }, [
      star,
      icon(BlockClass.icon || 'square'),
      el('span', {}, BlockClass.label || BlockClass.type),
    ]);
    tile.addEventListener('click', (e) => {
      // Click na estrela é tratado pelo handler dela (stopPropagation).
      // Mas tile é div role=button — confirma que não foi propagação residual.
      if (e.target.closest('.editor-blocks-list__star')) return;
      this._insertBlock(BlockClass.type);
    });
    tile.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this._insertBlock(BlockClass.type);
      }
    });
    tile.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', BlockClass.type);
      e.dataTransfer.effectAllowed = 'copy';
      this.editor.bus.emit('drag:started', { kind: 'library', type: BlockClass.type });
    });
    tile.addEventListener('dragend', () => {
      this.editor.bus.emit('drag:ended');
    });
    return tile;
  }

  /**
   * Resolve onde inserir um bloco do tipo `type` dado o nó selecionado, e
   * cria o bloco. O recém-criado fica selecionado para encadear inserts.
   *
   * Regras (em ordem):
   *   1. Sem seleção → root.
   *   2. Self-nest proibido (column→column, row→row) → vai como sibling no pai
   *      (usuário quase sempre quer outra coluna/row ao lado, não aninhada).
   *   3. Selecionado aceita o novo tipo → vai dentro dele (sections aceitam
   *      rows, rows aceitam columns, columns aceitam qualquer coisa).
   *   4. Caso contrário → tenta como sibling do selecionado (parent precisa
   *      aceitar o tipo). Isso preserva o "encadeamento" depois que o usuário
   *      inseriu um bloco-folha (parágrafo/imagem) e clica outro tile —
   *      o esperado é o próximo virar irmão dentro do mesmo container, não
   *      pular para o root.
   *   5. Fallback final → root.
   */
  _insertBlock(type) {
    const target = resolveInsertTarget(this.editor, type);
    const newId = this.editor.addBlock(target.parentId, type, {}, target.index);
    if (newId) this.editor.selectBlock(newId);
  }

  /* ---------- Painel "Templates" ---------- */

  _buildTemplatesPanel() {
    const saveBtn = el('button', {
      type: 'button',
      class: 'btn btn-sm btn-primary editor-templates-save-page',
      title: t('sidebar.templates.savePageTitle'),
    }, [icon('file-earmark-richtext'), ' ' + t('sidebar.templates.savePage')]);
    saveBtn.addEventListener('click', () => this._savePageAsTemplate());

    return el('div', { class: 'editor-sidebar__panel' }, [
      el('div', { class: 'editor-templates-actions' }, [saveBtn]),
      el('div', { class: 'editor-templates-list', dataset: { region: 'templates-list' } }),
    ]);
  }

  async _savePageAsTemplate() {
    const root = this.editor.getRoot();
    if (!root.children?.length) {
      this.editor.notify.toast(
        'A página está vazia — adicione blocos antes de salvar como template.',
        'warning');
      return;
    }
    const defaultName = `Página (${root.children.length} blocos)`;
    const name = await this.editor.notify.prompt(
      'Salva todos os blocos do canvas como template reutilizável:',
      defaultName,
      { title: 'Salvar página como template',
        placeholder: 'Ex.: Landing v1', okLabel: 'Salvar' });
    if (!name) return;
    const tpl = this.editor.savePageAsTemplate(name);
    if (tpl) {
      this._setActiveTab('templates');
      this.editor.notify.toast(
        `Template "${tpl.name}" salvo (${tpl.nodes.length} blocos).`,
        'success');
    }
  }

  _populateTemplates() {
    const list = this.templatesPanel.querySelector('[data-region="templates-list"]');
    clear(list);
    const tpls = this.editor.listTemplates();
    if (tpls.length === 0) {
      list.appendChild(el('div', { class: 'editor-sidebar__placeholder' }, [
        icon('bookmark'),
        el('p', {}, t('sidebar.templates.empty')),
        el('small', {}, t('sidebar.templates.emptyHint')),
      ]));
      return;
    }
    for (const t of tpls) {
      list.appendChild(this._buildTemplateButton(t));
    }
  }

  _buildTemplateButton(tpl) {
    const isPage = tpl.kind === 'page' || Array.isArray(tpl.nodes);
    const isEditing = this.editor.editingTemplateId === tpl.id;
    const isBuiltIn = tpl.builtIn === true;
    const summary = isPage
      ? `página · ${tpl.nodes?.length ?? 0} blocos`
      : (tpl.tree?.type ?? '?');

    const btn = el('button', {
      type: 'button',
      class: `editor-templates-list__item${isEditing ? ' editor-templates-list__item--editing' : ''}${isBuiltIn ? ' editor-templates-list__item--builtin' : ''}`,
      title: isEditing
        ? `Você está editando este template — use a faixa azul acima do canvas`
        : (isPage
          ? `Inserir template de página "${tpl.name}" no final da página`
          : `Inserir bloco "${tpl.name}"`),
      dataset: { kind: isPage ? 'page' : 'block' },
    }, [
      icon(tpl.icon || (isPage ? 'file-earmark-richtext' : 'bookmark')),
      el('div', { class: 'editor-templates-list__meta' }, [
        el('strong', {}, tpl.name),
        el('small', { class: 'text-muted' },
          isBuiltIn ? t('sidebar.templates.builtinSummary', { summary }) : summary),
      ]),
    ]);
    btn.addEventListener('click', () => this._insertTemplate(tpl.id));

    if (isPage) {
      const replaceBtn = el('button', {
        type: 'button',
        class: 'editor-templates-list__replace',
        title: t('sidebar.templates.replace'),
      }, [icon('arrow-repeat')]);
      replaceBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._replacePageWithTemplate(tpl);
      });
      btn.appendChild(replaceBtn);
    }

    if (!isBuiltIn) {
      const editBtn = el('button', {
        type: 'button',
        class: 'editor-templates-list__edit',
        title: t('sidebar.templates.edit'),
      }, [icon('pencil')]);
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._editTemplate(tpl);
      });
      btn.appendChild(editBtn);

      const delBtn = el('button', {
        type: 'button',
        class: 'editor-templates-list__remove',
        title: t('sidebar.templates.remove'),
      }, [icon('x')]);
      delBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const ok = await this.editor.notify.confirm(
          `Remover template "${tpl.name}"?`,
          { title: 'Remover template', okLabel: 'Remover', danger: true });
        if (!ok) return;
        this.editor.removeTemplate(tpl.id);
        this.editor.notify.toast('Template removido.', 'info');
      });
      btn.appendChild(delBtn);
    }
    return btn;
  }

  _insertTemplate(templateId) {
    const tpl = this.editor.getTemplate(templateId);
    if (!tpl) return;
    const isPage = tpl.kind === 'page' || Array.isArray(tpl.nodes);

    if (isPage) {
      // Templates de página vão sempre para o root (anexa ao final).
      const result = this.editor.insertTemplate(templateId, this.editor.rootId);
      const ids = Array.isArray(result) ? result : (result ? [result] : []);
      if (ids.length) this.editor.selectBlock(ids[0]);
      return;
    }

    // Template de bloco: insere no nó selecionado se ele aceitar; senão na raiz.
    const tplType = tpl.tree?.type;
    const selectedId = this.editor.getSelectedId();
    let parentId = this.editor.rootId;
    if (selectedId) {
      const selNode = this.editor.getNode(selectedId);
      const SelClass = selNode && this.editor.registry.get(selNode.type);
      const allowed = SelClass?.allowedChildren;
      const accepts = allowed === '*' ||
        (Array.isArray(allowed) && tplType && allowed.includes(tplType));
      if (accepts) parentId = selectedId;
    }
    const newId = this.editor.insertTemplate(templateId, parentId);
    if (newId) this.editor.selectBlock(newId);
  }

  /**
   * Abre dialog para editar nome/ícone do template e oferece ação extra
   * "Carregar para edição" que substitui o canvas pela árvore do template
   * e entra em edit-mode.
   */
  async _editTemplate(tpl) {
    const result = await this.editor.notify.formDialog({
      title: 'Editar template',
      description: tpl.kind === 'page'
        ? `Template de página · ${tpl.nodes?.length ?? 0} blocos`
        : `Template de bloco · ${tpl.tree?.type ?? '?'}`,
      fields: [
        { key: 'name', label: 'Nome', value: tpl.name, placeholder: 'Nome do template' },
        { key: 'icon', label: 'Ícone Bootstrap', value: tpl.icon ?? '',
          placeholder: 'bookmark, star, file-earmark, …',
          help: 'Veja icons.getbootstrap.com para a lista completa.' },
      ],
      okLabel: 'Salvar',
      extraActions: [
        { label: 'Carregar para edição', value: '__load__' },
      ],
    });
    if (result === null) return;
    if (result === '__load__') {
      const root = this.editor.getRoot();
      if (root.children?.length) {
        const ok = await this.editor.notify.confirm(
          `Carregar o template "${tpl.name}" no canvas? O conteúdo atual (${root.children.length} blocos) será descartado.`,
          { title: 'Carregar para edição', okLabel: 'Carregar', danger: true });
        if (!ok) return;
      }
      this.editor.loadTemplateForEdit(tpl.id);
      return;
    }
    // Salva metadata
    const patch = {};
    if (result.name && result.name !== tpl.name) patch.name = result.name;
    if (result.icon !== tpl.icon)                patch.icon = result.icon || 'bookmark';
    if (Object.keys(patch).length === 0) return;
    this.editor.updateTemplate(tpl.id, patch);
    this.editor.notify.toast(`Template "${patch.name ?? tpl.name}" atualizado.`, 'success');
  }

  async _replacePageWithTemplate(tpl) {
    const root = this.editor.getRoot();
    if (root.children?.length) {
      const ok = await this.editor.notify.confirm(
        `Substituir a página atual (${root.children.length} blocos) pelo template "${tpl.name}"? ` +
        `Esta ação descarta o conteúdo atual e o histórico de undo.`,
        { title: 'Substituir página', okLabel: 'Substituir', danger: true });
      if (!ok) return;
    }
    this.editor.replacePageWithTemplate(tpl.id);
    this.editor.notify.toast(`Página substituída pelo template "${tpl.name}".`, 'success');
  }

  /* ---------- Painel "Estrutura" ---------- */

  _buildOutlinePanel() {
    return el('div', { class: 'editor-sidebar__panel' }, [
      el('ul', { class: 'editor-outline', role: 'tree',
        'aria-label': 'Estrutura da árvore de blocos',
        dataset: { region: 'outline-list' } }),
    ]);
  }

  _renderOutline() {
    const list = this.outlinePanel.querySelector('[data-region="outline-list"]');
    clear(list);
    const root = this.editor.getRoot();
    if (root.children.length === 0) {
      list.appendChild(el('li', { class: 'editor-outline__empty' },
        t('sidebar.outline.empty')));
      return;
    }
    for (const child of root.children) {
      list.appendChild(this._renderOutlineNode(child, 0));
    }
    this._highlight(this.editor.getSelectedId());
  }

  _renderOutlineNode(node, depth) {
    const label = el('div', {
      class: 'editor-outline__label',
      dataset: { id: node.id },
      role: 'treeitem',
      tabindex: '0',
      'aria-label': `${node.type}${node.props?.text ? ': ' + String(node.props.text).slice(0, 40) : ''}`,
      style: { paddingLeft: `${0.5 + depth * 0.85}rem` },
    }, [
      icon(this._iconFor(node.type)),
      ' ',
      el('strong', {}, node.type),
      this._previewOf(node),
    ]);
    label.addEventListener('click', (e) => {
      e.stopPropagation();
      this.editor.selectBlock(node.id);
    });
    label.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.editor.selectBlock(node.id);
      }
    });

    const li = el('li', { class: 'editor-outline__item', role: 'none' }, [label]);
    if (node.children?.length) {
      const sub = el('ul', { class: 'editor-outline editor-outline--sub', role: 'group' });
      for (const child of node.children) sub.appendChild(this._renderOutlineNode(child, depth + 1));
      li.appendChild(sub);
    }
    return li;
  }

  _previewOf(node) {
    const text = node.props?.text;
    if (!text) return null;
    const trimmed = String(text).trim().slice(0, 28);
    return el('span', { class: 'editor-outline__preview' }, ' — ' + trimmed);
  }

  _iconFor(type) {
    const map = {
      section: 'square',
      row: 'distribute-horizontal',
      column: 'layout-three-columns',
      heading: 'type-h1',
      paragraph: 'text-paragraph',
      image: 'image',
      button: 'app',
      table: 'table',
    };
    return map[type] ?? 'square';
  }

  _highlight(id) {
    for (const label of this.outlinePanel.querySelectorAll('[data-id]')) {
      label.classList.toggle('editor-outline__label--active', label.dataset.id === id);
    }
  }
}
