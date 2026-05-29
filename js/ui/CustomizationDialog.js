import { el, clear, icon } from '../utils/dom.js';
import {
  POPULAR_FONTS,
  buildGoogleFontsUrl,
  parseGoogleFontsUrl,
  familyToStack,
  categoryFor,
} from '../utils/googleFonts.js';

/**
 * CustomizationDialog — &lt;dialog&gt; com 4 abas:
 *   - CSS:        textarea livre + lista de classes detectadas.
 *   - Blocos:     CRUD de snippets HTML (nome/ícone/HTML).
 *   - Templates:  lista + remoção (criação acontece via menu de contexto).
 *   - Exportar:   download/upload JSON com tudo.
 *
 * Persistência via editor.customizations (CustomizationStore).
 */
const TABS = [
  { id: 'css',         label: 'CSS',         icon: 'palette' },
  { id: 'theme',       label: 'Tema',        icon: 'droplet-half' },
  { id: 'blocks',      label: 'Blocos',      icon: 'puzzle' },
  { id: 'components',  label: 'Componentes', icon: 'box-seam' },
  { id: 'templates',   label: 'Templates',   icon: 'bookmark' },
  { id: 'io',          label: 'Exportar/Importar', icon: 'download' },
];

export class CustomizationDialog {
  constructor(editor) {
    this.editor = editor;
    this.dialog = null;
    this.activeTab = 'css';
    this.editingBlockId = null;
  }

  mount() {
    this.editor.bus.on('customblocks:changed', () => {
      if (this.dialog?.open && this.activeTab === 'blocks') this._renderActiveTab();
    });
    this.editor.bus.on('templates:changed', () => {
      if (this.dialog?.open && this.activeTab === 'templates') this._renderActiveTab();
    });
    this.editor.bus.on('css:changed', () => {
      if (this.dialog?.open && this.activeTab === 'css') {
        this._refreshClassList();
      }
    });
    for (const ev of ['palette:changed', 'gradients:changed', 'fonts:changed']) {
      this.editor.bus.on(ev, () => {
        if (!this.dialog?.open) return;
        if (this.activeTab === 'theme') this._renderActiveTab();
        else if (ev === 'fonts:changed' && this.activeTab === 'io') this._renderActiveTab();
      });
    }
    this.editor.bus.on('components:changed', () => {
      if (this.dialog?.open && this.activeTab === 'components') this._renderActiveTab();
    });
  }

  show(tab) {
    if (tab) this.activeTab = tab;
    if (!this.dialog) this._build();
    this._renderActiveTab();
    this._highlightTab();
    if (!this.dialog.isConnected) document.body.appendChild(this.dialog);
    // Guard contra "InvalidStateError: dialog already open" em re-aberturas
    if (!this.dialog.open) this.dialog.showModal();
  }

  close() {
    if (this.dialog?.open) this.dialog.close();
  }

  _build() {
    this.dialog = el('dialog', { class: 'editor-customization-dialog' });

    const header = el('div', { class: 'editor-customization-dialog__header' }, [
      el('h5', { class: 'mb-0' }, [icon('gear-fill'), ' Personalização do site']),
      this._closeIcon(),
    ]);

    this.tabsBar = el('div', { class: 'editor-customization-dialog__tabs editor-tabs' });
    for (const t of TABS) {
      const btn = el('button', {
        type: 'button',
        class: 'editor-tabs__btn',
        dataset: { tab: t.id },
      }, [icon(t.icon), ' ', t.label]);
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.activeTab = t.id;
        this._renderActiveTab();
        this._highlightTab();
      });
      this.tabsBar.appendChild(btn);
    }

    this.body = el('div', { class: 'editor-customization-dialog__body' });

    const footer = el('div', { class: 'editor-customization-dialog__footer' }, [
      this._footerCloseBtn(),
    ]);

    this.dialog.append(header, this.tabsBar, this.body, footer);

    // Click fora (backdrop) fecha. Usa "mousedown→mouseup no mesmo alvo" para
    // evitar fechar quando o usuário arrasta uma seleção que termina no backdrop.
    this.dialog.addEventListener('mousedown', (e) => {
      this._mouseDownTarget = e.target;
    });
    this.dialog.addEventListener('click', (e) => {
      if (e.target === this.dialog && this._mouseDownTarget === this.dialog) {
        this.close();
      }
      this._mouseDownTarget = null;
    });
    // Esc nativo do <dialog> dispara "cancel" antes de "close" — não precisamos
    // interceptar, mas garantimos limpeza no close.
    this.dialog.addEventListener('close', () => {
      this.editingBlockId = null;
    });
  }

  _closeIcon() {
    const btn = el('button', {
      type: 'button',
      class: 'btn btn-sm btn-link p-0 ms-auto text-secondary',
      title: 'Fechar (Esc)',
      'aria-label': 'Fechar diálogo',
    }, [icon('x-lg')]);
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.close();
    });
    return btn;
  }

  _footerCloseBtn() {
    const btn = el('button', {
      type: 'button',
      class: 'btn btn-sm btn-secondary',
    }, 'Fechar');
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.close();
    });
    return btn;
  }

  _highlightTab() {
    for (const btn of this.tabsBar.querySelectorAll('[data-tab]')) {
      btn.classList.toggle('active', btn.dataset.tab === this.activeTab);
    }
  }

  _renderActiveTab() {
    clear(this.body);
    if (this.activeTab === 'css')        this._renderCssTab();
    else if (this.activeTab === 'theme')      this._renderThemeTab();
    else if (this.activeTab === 'blocks')     this._renderBlocksTab();
    else if (this.activeTab === 'components') this._renderComponentsTab();
    else if (this.activeTab === 'templates')  this._renderTemplatesTab();
    else if (this.activeTab === 'io')         this._renderIoTab();
  }

  /* ---------- Tab: CSS ---------- */

  _renderCssTab() {
    const help = el('p', { class: 'small text-muted mb-2' },
      'Cole aqui o CSS personalizado do seu site. Ele será injetado no editor para que classes do seu projeto funcionem corretamente. Classes encontradas viram sugestões no campo "Classes" do painel Avançado.');

    const ta = el('textarea', {
      class: 'form-control font-monospace',
      rows: 14,
      placeholder: '/* Exemplo */\n.minha-classe { color: tomato; }\n.btn-cta { background: #0d6efd; color: #fff; padding: .5rem 1rem; }',
    });
    ta.value = this.editor.getCustomCSS();

    const btnSave = el('button', { type: 'button', class: 'btn btn-sm btn-primary' },
      [icon('check2'), ' Salvar CSS']);
    btnSave.addEventListener('click', () => {
      this.editor.setCustomCSS(ta.value);
      this.editor.notify.toast('CSS atualizado.', 'success');
    });

    const btnClear = el('button', { type: 'button', class: 'btn btn-sm btn-outline-danger' },
      [icon('trash'), ' Limpar']);
    btnClear.addEventListener('click', async () => {
      const ok = await this.editor.notify.confirm(
        'Apagar todo o CSS personalizado?',
        { title: 'Apagar CSS', okLabel: 'Apagar', danger: true });
      if (!ok) return;
      ta.value = '';
      this.editor.setCustomCSS('');
      this.editor.notify.toast('CSS apagado.', 'info');
    });

    const actions = el('div', { class: 'd-flex gap-2 align-items-center mt-2' },
      [btnSave, btnClear]);

    this.classesList = el('div', { class: 'editor-customization-dialog__classes mt-3' });
    this._refreshClassList();

    this.body.append(help, ta, actions, this.classesList);
  }

  _refreshClassList() {
    if (!this.classesList) return;
    clear(this.classesList);
    const names = this.editor.getCustomClassNames();
    if (names.length === 0) {
      this.classesList.appendChild(el('small', { class: 'text-muted' },
        'Nenhuma classe detectada. Adicione regras CSS acima.'));
      return;
    }
    this.classesList.appendChild(el('small', { class: 'text-muted d-block mb-1' },
      `${names.length} classe(s) detectada(s):`));
    const wrap = el('div', { class: 'd-flex flex-wrap gap-1' });
    for (const c of names) {
      wrap.appendChild(el('span', { class: 'badge text-bg-secondary' }, '.' + c));
    }
    this.classesList.appendChild(wrap);
  }

  /* ---------- Tab: Blocos ---------- */

  _renderBlocksTab() {
    const help = el('p', { class: 'small text-muted mb-2' },
      'Crie blocos personalizados a partir de snippets HTML. Eles aparecem na sidebar esquerda em "Meus blocos" e ficam disponíveis para arrastar/inserir.');

    const list = this._buildBlocksList();
    const form = this._buildBlockForm();

    this.body.append(help, list, form);
  }

  _buildBlocksList() {
    const blocks = this.editor.listCustomBlocks();
    const wrap = el('div', { class: 'editor-customization-dialog__list mb-3' });

    if (blocks.length === 0) {
      wrap.appendChild(el('small', { class: 'text-muted' },
        'Nenhum bloco personalizado ainda. Use o formulário abaixo para criar.'));
      return wrap;
    }

    for (const b of blocks) {
      const row = el('div', { class: 'editor-customization-dialog__row' }, [
        icon(b.icon || 'puzzle'),
        el('strong', { class: 'flex-grow-1' }, b.name),
        el('small', { class: 'text-muted me-2' }, b.type),
      ]);
      const editBtn = el('button', {
        type: 'button', class: 'btn btn-sm btn-outline-secondary',
        title: 'Editar',
      }, [icon('pencil')]);
      editBtn.addEventListener('click', () => {
        this.editingBlockId = b.id;
        this._renderActiveTab();
      });
      const delBtn = el('button', {
        type: 'button', class: 'btn btn-sm btn-outline-danger',
        title: 'Remover',
      }, [icon('trash')]);
      delBtn.addEventListener('click', async () => {
        const ok = await this.editor.notify.confirm(
          `Remover bloco "${b.name}"? Instâncias já inseridas continuarão funcionando até o reload.`,
          { title: 'Remover bloco', okLabel: 'Remover', danger: true });
        if (!ok) return;
        this.editor.removeCustomBlock(b.id);
        this.editor.notify.toast(`Bloco "${b.name}" removido.`, 'info');
      });
      row.append(editBtn, delBtn);
      wrap.appendChild(row);
    }
    return wrap;
  }

  _buildBlockForm() {
    const editing = this.editingBlockId
      ? this.editor.customizations.getBlock(this.editingBlockId)
      : null;
    const title = editing ? `Editar "${editing.name}"` : 'Adicionar bloco';

    const wrap = el('div', { class: 'editor-customization-dialog__form' }, [
      el('h6', { class: 'mb-2' }, title),
    ]);

    const nameIn = el('input', {
      type: 'text', class: 'form-control form-control-sm mb-2',
      placeholder: 'Nome (ex.: "Hero verde")',
    });
    nameIn.value = editing?.name ?? '';

    const iconIn = el('input', {
      type: 'text', class: 'form-control form-control-sm mb-2',
      placeholder: 'Ícone Bootstrap (ex.: "stars", "puzzle")',
    });
    iconIn.value = editing?.icon ?? 'puzzle';

    const htmlIn = el('textarea', {
      class: 'form-control font-monospace mb-2', rows: 8,
      placeholder: '<div class="hero">...</div>',
    });
    htmlIn.value = editing?.html ?? '';

    // Toggle "propagar para instâncias existentes" só faz sentido ao editar.
    let propagateChk = null;
    let propagateWrap = null;
    if (editing) {
      const id = `prop-${editing.id}`;
      propagateChk = el('input', { type: 'checkbox', class: 'form-check-input', id });
      propagateWrap = el('div', { class: 'form-check form-switch mb-2' }, [
        propagateChk,
        el('label', { class: 'form-check-label small', for: id }, [
          'Aplicar a instâncias já inseridas no canvas',
          el('br'),
          el('small', { class: 'text-muted' },
            'Por padrão, snippets já no canvas mantêm o HTML antigo (fork-on-insert).'),
        ]),
      ]);
    }

    const btnSave = el('button', { type: 'button', class: 'btn btn-sm btn-primary' },
      [icon(editing ? 'check2' : 'plus-lg'), ' ', editing ? 'Salvar' : 'Adicionar']);
    btnSave.addEventListener('click', () => {
      const name = nameIn.value.trim();
      if (!name)         { this.editor.notify.toast('Informe um nome.', 'warning'); return; }
      const html = htmlIn.value;
      if (!html.trim())  { this.editor.notify.toast('HTML vazio.',     'warning'); return; }
      const meta = { name, icon: iconIn.value.trim() || 'puzzle', html };
      if (editing) {
        this.editor.updateCustomBlock(editing.id, meta);
        let propagated = 0;
        if (propagateChk?.checked) {
          propagated = this.editor.propagateCustomBlockUpdate(editing.id);
        }
        const msg = propagated > 0
          ? `Bloco "${name}" atualizado (${propagated} instância${propagated > 1 ? 's' : ''} no canvas).`
          : `Bloco "${name}" atualizado.`;
        this.editor.notify.toast(msg, 'success');
      } else {
        this.editor.addCustomBlock(meta);
        this.editor.notify.toast(`Bloco "${name}" criado.`, 'success');
        nameIn.value = '';
        htmlIn.value = '';
      }
      this.editingBlockId = null;
      this._renderActiveTab();
    });

    const btnCancel = el('button', { type: 'button', class: 'btn btn-sm btn-outline-secondary' }, 'Cancelar');
    btnCancel.addEventListener('click', () => {
      this.editingBlockId = null;
      this._renderActiveTab();
    });

    const actions = el('div', { class: 'd-flex gap-2 align-items-center' },
      [btnSave, editing ? btnCancel : null]);

    wrap.append(
      this._labeled('Nome', nameIn),
      this._labeled('Ícone', iconIn),
      this._labeled('HTML', htmlIn),
      propagateWrap,
      actions,
    );
    return wrap;
  }

  /* ---------- Tab: Componentes ---------- */

  _renderComponentsTab() {
    const help = el('p', { class: 'small text-muted mb-2' }, [
      el('strong', {}, 'Componentes'),
      ' são subárvores reutilizáveis ',
      el('strong', {}, 'sincronizadas'),
      ': editar o master atualiza TODAS as instâncias inseridas no canvas. ',
      'Diferente de "snippets" (HTML estático com fork-on-insert) e de "templates" (cópia única).',
    ]);

    const comps = this.editor.listComponents();
    const wrap = el('div', { class: 'editor-customization-dialog__list' });
    if (comps.length === 0) {
      wrap.appendChild(el('small', { class: 'text-muted' },
        'Nenhum componente. Selecione um bloco no canvas e use "Salvar bloco como componente" no menu de contexto.'));
    } else {
      for (const c of comps) {
        const row = el('div', { class: 'editor-customization-dialog__row' }, [
          icon(c.icon || 'box-seam'),
          el('strong', { class: 'flex-grow-1' }, c.name),
          el('small', { class: 'text-muted me-2' }, c.tree?.type ?? '?'),
        ]);
        const editBtn = el('button', {
          type: 'button', class: 'btn btn-sm btn-outline-secondary',
          title: 'Editar nome/ícone ou carregar para edição',
        }, [icon('pencil')]);
        editBtn.addEventListener('click', async () => {
          const result = await this.editor.notify.formDialog({
            title: 'Editar componente',
            description: `Componente · ${c.tree?.type ?? '?'}`,
            fields: [
              { key: 'name', label: 'Nome', value: c.name },
              { key: 'icon', label: 'Ícone Bootstrap', value: c.icon ?? 'box-seam' },
            ],
            okLabel: 'Salvar',
            extraActions: [{ label: 'Carregar para edição', value: '__load__' }],
          });
          if (result === null) return;
          if (result === '__load__') {
            const root = this.editor.getRoot();
            if (root.children?.length) {
              const ok = await this.editor.notify.confirm(
                `Carregar "${c.name}" no canvas? O conteúdo atual (${root.children.length} blocos) será descartado.`,
                { title: 'Carregar para edição', okLabel: 'Carregar', danger: true });
              if (!ok) return;
            }
            this.dialog.close();
            this.editor.loadComponentForEdit(c.id);
            return;
          }
          const patch = {};
          if (result.name && result.name !== c.name) patch.name = result.name;
          if (result.icon !== c.icon) patch.icon = result.icon || 'box-seam';
          if (Object.keys(patch).length === 0) return;
          this.editor.updateComponent(c.id, patch);
          this.editor.notify.toast('Componente atualizado.', 'success');
        });
        const delBtn = el('button', {
          type: 'button', class: 'btn btn-sm btn-outline-danger',
          title: 'Remover',
        }, [icon('trash')]);
        delBtn.addEventListener('click', async () => {
          const ok = await this.editor.notify.confirm(
            `Remover componente "${c.name}"? Todas as instâncias inseridas perderão o vínculo (mostrarão um aviso até serem desconectadas ou removidas).`,
            { title: 'Remover componente', okLabel: 'Remover', danger: true });
          if (!ok) return;
          this.editor.removeComponent(c.id);
          this.editor.notify.toast(`Componente "${c.name}" removido.`, 'info');
        });
        row.append(editBtn, delBtn);
        wrap.appendChild(row);
      }
    }

    this.body.append(help, wrap);
  }

  /* ---------- Tab: Templates ---------- */

  _renderTemplatesTab() {
    const help = el('p', { class: 'small text-muted mb-2' }, [
      'Templates são reutilizáveis. ',
      el('strong', {}, 'Página inteira'),
      ': use o botão "Salvar página como template" na aba Templates da sidebar esquerda. ',
      el('strong', {}, 'Bloco único'),
      ': clique com o botão direito num bloco e escolha "Salvar bloco como template".',
    ]);

    const tpls = this.editor.listTemplates();
    const wrap = el('div', { class: 'editor-customization-dialog__list' });

    if (tpls.length === 0) {
      wrap.appendChild(el('small', { class: 'text-muted' },
        'Nenhum template salvo.'));
    } else {
      for (const t of tpls) {
        const isPage = t.kind === 'page' || Array.isArray(t.nodes);
        const isBuiltIn = t.builtIn === true;
        const summary = isPage
          ? `página · ${t.nodes?.length ?? 0} blocos`
          : (t.tree?.type ?? '?');
        const row = el('div', { class: 'editor-customization-dialog__row' }, [
          icon(t.icon || (isPage ? 'file-earmark-richtext' : 'bookmark')),
          el('strong', { class: 'flex-grow-1' }, t.name),
          el('span', { class: `badge ${isPage ? 'text-bg-info' : 'text-bg-secondary'} me-2` },
            isPage ? 'Página' : 'Bloco'),
          isBuiltIn
            ? el('span', { class: 'badge text-bg-light border me-2' }, 'padrão')
            : null,
          el('small', { class: 'text-muted me-2' }, summary),
        ]);
        if (isBuiltIn) {
          wrap.appendChild(row);
          continue;
        }
        const editBtn = el('button', {
          type: 'button', class: 'btn btn-sm btn-outline-secondary',
          title: 'Editar nome/ícone ou carregar para edição',
        }, [icon('pencil')]);
        editBtn.addEventListener('click', async () => {
          const result = await this.editor.notify.formDialog({
            title: 'Editar template',
            description: isPage
              ? `Template de página · ${t.nodes?.length ?? 0} blocos`
              : `Template de bloco · ${t.tree?.type ?? '?'}`,
            fields: [
              { key: 'name', label: 'Nome', value: t.name },
              { key: 'icon', label: 'Ícone Bootstrap', value: t.icon ?? '',
                help: 'Ex.: bookmark, star, file-earmark.' },
            ],
            okLabel: 'Salvar',
            extraActions: [{ label: 'Carregar para edição', value: '__load__' }],
          });
          if (result === null) return;
          if (result === '__load__') {
            const root = this.editor.getRoot();
            if (root.children?.length) {
              const ok = await this.editor.notify.confirm(
                `Carregar "${t.name}" no canvas? O conteúdo atual (${root.children.length} blocos) será descartado.`,
                { title: 'Carregar para edição', okLabel: 'Carregar', danger: true });
              if (!ok) return;
            }
            this.dialog.close();
            this.editor.loadTemplateForEdit(t.id);
            return;
          }
          const patch = {};
          if (result.name && result.name !== t.name) patch.name = result.name;
          if (result.icon !== t.icon)                patch.icon = result.icon || 'bookmark';
          if (Object.keys(patch).length === 0) return;
          this.editor.updateTemplate(t.id, patch);
          this.editor.notify.toast('Template atualizado.', 'success');
        });
        const delBtn = el('button', {
          type: 'button', class: 'btn btn-sm btn-outline-danger',
          title: 'Remover',
        }, [icon('trash')]);
        delBtn.addEventListener('click', async () => {
          const ok = await this.editor.notify.confirm(
            `Remover template "${t.name}"?`,
            { title: 'Remover template', okLabel: 'Remover', danger: true });
          if (!ok) return;
          this.editor.removeTemplate(t.id);
          this.editor.notify.toast(`Template "${t.name}" removido.`, 'info');
        });
        row.append(editBtn, delBtn);
        wrap.appendChild(row);
      }
    }

    this.body.append(help, wrap);
  }

  /* ---------- Tab: Tema (paleta / gradientes / fontes) ---------- */

  _renderThemeTab() {
    const help = el('p', { class: 'small text-muted mb-3' },
      'Personalize as opções oferecidas pelos controles de cor e tipografia para refletir a identidade visual do seu site. Cada lista vira uma paleta rápida no painel de propriedades dos blocos.');

    const palette   = this._buildThemeSection({
      title: 'Paleta de cores',
      description: 'Atalhos no painel "Custom" do controle de cor (texto/fundo).',
      icon: 'droplet',
      items: this.editor.listPalette(),
      itemRenderer: (c) => this._renderPaletteRow(c),
      formBuilder:  () => this._buildPaletteForm(),
    });

    const gradients = this._buildThemeSection({
      title: 'Gradientes',
      description: 'Aparecem no painel "Gradiente" (cor de fundo) acima dos presets built-in.',
      icon: 'rainbow',
      items: this.editor.listGradients(),
      itemRenderer: (g) => this._renderGradientRow(g),
      formBuilder:  () => this._buildGradientForm(),
    });

    const fonts = this._buildThemeSection({
      title: 'Fontes',
      description: 'Aparecem no select "Família" do controle de Tipografia. Use o stack CSS completo (ex.: "Inter", sans-serif).',
      icon: 'fonts',
      items: this.editor.listFonts(),
      itemRenderer: (f) => this._renderFontRow(f),
      formBuilder:  () => this._buildFontForm(),
    });

    this.body.append(help, palette, gradients, fonts);
  }

  _buildThemeSection({ title, description, icon: iconName, items, itemRenderer, formBuilder }) {
    const wrap = el('div', { class: 'editor-customization-dialog__theme-section' }, [
      el('h6', { class: 'mb-1' }, [icon(iconName), ' ', title]),
      el('p',  { class: 'small text-muted mb-2' }, description),
    ]);

    if (items.length === 0) {
      wrap.appendChild(el('small', { class: 'text-muted d-block mb-2' }, 'Nenhum item ainda.'));
    } else {
      const list = el('div', { class: 'editor-customization-dialog__list mb-2' });
      for (const it of items) list.appendChild(itemRenderer(it));
      wrap.appendChild(list);
    }
    wrap.appendChild(formBuilder());
    return wrap;
  }

  _renderPaletteRow(c) {
    const row = el('div', { class: 'editor-customization-dialog__row' }, [
      el('span', {
        class: 'editor-theme-swatch',
        style: { background: c.value },
        'aria-hidden': 'true',
      }),
      el('strong', { class: 'flex-grow-1' }, c.label),
      el('code', { class: 'text-muted me-2 small' }, c.value),
    ]);
    row.appendChild(this._removeBtn(() => this._confirmRemove(
      `Remover cor "${c.label}"?`,
      () => { this.editor.removePaletteColor(c.id);
              this.editor.notify.toast(`Cor "${c.label}" removida.`, 'info'); }
    )));
    return row;
  }

  _buildPaletteForm() {
    const labelIn = el('input', {
      type: 'text', class: 'form-control form-control-sm',
      placeholder: 'Nome (ex.: "Marca primária")',
    });
    const colorIn = el('input', {
      type: 'color', class: 'form-control form-control-color form-control-sm',
      value: '#0d6efd',
    });
    const btn = el('button', { type: 'button', class: 'btn btn-sm btn-primary' },
      [icon('plus-lg'), ' Adicionar cor']);
    btn.addEventListener('click', () => {
      const label = labelIn.value.trim();
      if (!label) {
        this.editor.notify.toast('Informe um nome para a cor.', 'warning');
        return;
      }
      this.editor.addPaletteColor({ label, value: colorIn.value });
      this.editor.notify.toast(`Cor "${label}" adicionada.`, 'success');
      labelIn.value = '';
    });
    return el('div', { class: 'editor-customization-dialog__form d-flex gap-2 align-items-center' },
      [labelIn, colorIn, btn]);
  }

  _renderGradientRow(g) {
    const row = el('div', { class: 'editor-customization-dialog__row' }, [
      el('span', {
        class: 'editor-theme-swatch editor-theme-swatch--wide',
        style: { background: g.css },
        'aria-hidden': 'true',
      }),
      el('strong', { class: 'flex-grow-1' }, g.label),
    ]);
    row.appendChild(this._removeBtn(() => this._confirmRemove(
      `Remover gradiente "${g.label}"?`,
      () => { this.editor.removeGradient(g.id);
              this.editor.notify.toast(`Gradiente "${g.label}" removido.`, 'info'); }
    )));
    return row;
  }

  _buildGradientForm() {
    const labelIn = el('input', {
      type: 'text', class: 'form-control form-control-sm mb-2',
      placeholder: 'Nome (ex.: "Hero da marca")',
    });
    const cssIn = el('textarea', {
      class: 'form-control form-control-sm font-monospace mb-2', rows: 2,
      placeholder: 'linear-gradient(135deg, #0d6efd 0%, #6610f2 100%)',
    });
    const preview = el('div', {
      class: 'editor-control__color-preview',
      style: { height: '1.6rem', marginTop: '0.25rem' },
    });
    cssIn.addEventListener('input', () => {
      preview.style.background = cssIn.value || '';
    });
    const btn = el('button', { type: 'button', class: 'btn btn-sm btn-primary' },
      [icon('plus-lg'), ' Adicionar gradiente']);
    btn.addEventListener('click', () => {
      const label = labelIn.value.trim();
      const css   = cssIn.value.trim();
      if (!label || !css) {
        this.editor.notify.toast('Informe nome e CSS do gradiente.', 'warning');
        return;
      }
      this.editor.addGradient({ label, css });
      this.editor.notify.toast(`Gradiente "${label}" adicionado.`, 'success');
      labelIn.value = '';
      cssIn.value = '';
      preview.style.background = '';
    });
    return el('div', { class: 'editor-customization-dialog__form' }, [
      this._labeled('Nome', labelIn),
      this._labeled('CSS do gradiente', cssIn),
      preview,
      el('div', { class: 'mt-2' }, [btn]),
    ]);
  }

  _renderFontRow(f) {
    const row = el('div', { class: 'editor-customization-dialog__row' }, [
      el('span', {
        class: 'editor-theme-font-preview',
        style: { fontFamily: f.stack || 'inherit' },
      }, 'Aa'),
      el('strong', { class: 'flex-grow-1' }, f.label),
    ]);
    if (f.googleUrl) {
      row.appendChild(el('span', {
        class: 'badge text-bg-info me-2',
        title: f.googleUrl,
      }, [icon('google'), ' Google']));
    }
    row.appendChild(el('code', {
      class: 'text-muted me-2 small text-truncate',
      style: { maxWidth: '14rem' },
      title: f.stack,
    }, f.stack));
    row.appendChild(this._removeBtn(() => this._confirmRemove(
      `Remover fonte "${f.label}"?`,
      () => { this.editor.removeFont(f.id);
              this.editor.notify.toast(`Fonte "${f.label}" removida.`, 'info'); }
    )));
    return row;
  }

  /**
   * Formulário de fontes com 3 sub-abas:
   *  - Google Fonts (curado):  family + pesos via checkboxes → URL + stack auto.
   *  - Google Fonts (URL):     usuário cola a URL → parse e cria entradas.
   *  - Personalizada:          label + stack CSS livre (sem link auto).
   */
  _buildFontForm() {
    const wrap = el('div', { class: 'editor-customization-dialog__form editor-fonts-form' });

    const modeBar = el('div', { class: 'btn-group btn-group-sm mb-2', role: 'group' });
    const modes = [
      { id: 'curated', label: 'Google (curado)', icon: 'collection' },
      { id: 'url',     label: 'Google (URL)',    icon: 'link-45deg' },
      { id: 'custom',  label: 'Personalizada',   icon: 'pencil' },
    ];
    const body = el('div');
    const setMode = (id) => {
      for (const b of modeBar.querySelectorAll('button')) {
        b.classList.toggle('active', b.dataset.mode === id);
      }
      clear(body);
      if (id === 'curated')      body.appendChild(this._buildFontFormCurated());
      else if (id === 'url')     body.appendChild(this._buildFontFormUrl());
      else                       body.appendChild(this._buildFontFormCustom());
    };
    for (const m of modes) {
      const b = el('button', {
        type: 'button',
        class: 'btn btn-outline-secondary',
        dataset: { mode: m.id },
      }, [icon(m.icon), ' ', m.label]);
      b.addEventListener('click', (e) => { e.preventDefault(); setMode(m.id); });
      modeBar.appendChild(b);
    }
    wrap.append(modeBar, body);
    setMode('curated');
    return wrap;
  }

  _buildFontFormCurated() {
    const familyIn = el('select', { class: 'form-select form-select-sm mb-2' });
    for (const f of POPULAR_FONTS) {
      familyIn.appendChild(el('option', { value: f.family }, `${f.family} (${f.category})`));
    }

    const weightsBox = el('div', { class: 'd-flex flex-wrap gap-2 mb-2' });
    const italicChk = el('input', { type: 'checkbox', class: 'form-check-input' });
    const italicLbl = el('label', { class: 'form-check form-check-inline mb-2' }, [
      italicChk, ' ', el('span', { class: 'form-check-label' }, 'Incluir itálico'),
    ]);
    const preview = el('div', {
      class: 'editor-theme-font-preview-lg mb-2 p-2 border rounded',
      style: { fontSize: '1.2rem' },
    }, 'The quick brown fox jumps over the lazy dog.');

    const rebuild = () => {
      const meta = POPULAR_FONTS.find((p) => p.family === familyIn.value) || POPULAR_FONTS[0];
      clear(weightsBox);
      for (const w of meta.weights) {
        const cb = el('input', {
          type: 'checkbox', class: 'form-check-input',
          dataset: { weight: String(w) },
        });
        if (w === 400) cb.checked = true;
        const lbl = el('label', { class: 'form-check form-check-inline' }, [
          cb, ' ', el('span', { class: 'form-check-label' }, String(w)),
        ]);
        weightsBox.appendChild(lbl);
      }
      preview.style.fontFamily = familyToStack(meta.family, meta.category);
    };
    familyIn.addEventListener('change', rebuild);
    rebuild();

    const btn = el('button', { type: 'button', class: 'btn btn-sm btn-primary' },
      [icon('plus-lg'), ' Adicionar fonte do Google']);
    btn.addEventListener('click', () => {
      const meta = POPULAR_FONTS.find((p) => p.family === familyIn.value) || POPULAR_FONTS[0];
      const weights = [...weightsBox.querySelectorAll('input:checked')]
        .map((cb) => Number(cb.dataset.weight))
        .filter(Boolean);
      if (!weights.length) {
        this.editor.notify.toast('Selecione ao menos um peso.', 'warning');
        return;
      }
      const url = buildGoogleFontsUrl({
        family: meta.family,
        weights,
        italic: italicChk.checked,
      });
      const stack = familyToStack(meta.family, meta.category);
      this.editor.addFont({ label: meta.family, stack, googleUrl: url });
      this.editor.notify.toast(`Fonte "${meta.family}" adicionada.`, 'success');
    });

    return el('div', {}, [
      this._labeled('Família', familyIn),
      el('label', { class: 'form-label small mb-1' }, 'Pesos'),
      weightsBox,
      italicLbl,
      preview,
      btn,
      el('small', { class: 'text-muted d-block mt-2' },
        'A fonte é injetada no canvas e no HTML standalone. Para o template Django, copie as tags em "Exportar/Importar" ou use editor.exportFontLinks().'),
    ]);
  }

  _buildFontFormUrl() {
    const urlIn = el('input', {
      type: 'url',
      class: 'form-control form-control-sm font-monospace mb-2',
      placeholder: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap',
    });
    const previewBox = el('div', { class: 'small text-muted mb-2' },
      'Cole a URL gerada em fonts.google.com (botão "Get embed code").');
    const updatePreview = () => {
      const parsed = parseGoogleFontsUrl(urlIn.value);
      clear(previewBox);
      if (!parsed.length) {
        previewBox.textContent = 'Aguardando URL válida do Google Fonts…';
        return;
      }
      previewBox.append(
        el('span', {}, `Detectado: `),
        el('strong', {}, parsed.map((p) => p.family).join(', ')),
      );
    };
    urlIn.addEventListener('input', updatePreview);
    updatePreview();

    const btn = el('button', { type: 'button', class: 'btn btn-sm btn-primary' },
      [icon('plus-lg'), ' Adicionar fontes da URL']);
    btn.addEventListener('click', () => {
      const parsed = parseGoogleFontsUrl(urlIn.value);
      if (!parsed.length) {
        this.editor.notify.toast('URL do Google Fonts inválida.', 'warning');
        return;
      }
      for (const p of parsed) {
        this.editor.addFont({ label: p.family, stack: p.stack, googleUrl: p.googleUrl });
      }
      this.editor.notify.toast(`${parsed.length} fonte(s) adicionada(s).`, 'success');
      urlIn.value = '';
      updatePreview();
    });

    return el('div', {}, [
      this._labeled('URL do Google Fonts', urlIn),
      previewBox,
      btn,
    ]);
  }

  _buildFontFormCustom() {
    const labelIn = el('input', {
      type: 'text', class: 'form-control form-control-sm mb-2',
      placeholder: 'Nome (ex.: "Inter")',
    });
    const stackIn = el('input', {
      type: 'text', class: 'form-control form-control-sm font-monospace mb-2',
      placeholder: '"Inter", system-ui, sans-serif',
    });
    const btn = el('button', { type: 'button', class: 'btn btn-sm btn-primary' },
      [icon('plus-lg'), ' Adicionar fonte']);
    btn.addEventListener('click', () => {
      const label = labelIn.value.trim();
      const stack = stackIn.value.trim();
      if (!label || !stack) {
        this.editor.notify.toast('Informe nome e stack CSS da fonte.', 'warning');
        return;
      }
      this.editor.addFont({ label, stack });
      this.editor.notify.toast(`Fonte "${label}" adicionada.`, 'success');
      labelIn.value = '';
      stackIn.value = '';
    });
    return el('div', {}, [
      this._labeled('Nome', labelIn),
      this._labeled('Stack CSS', stackIn),
      el('small', { class: 'text-muted d-block mb-2' },
        'Sem URL do Google Fonts: você é responsável por carregar a fonte (via @font-face no CSS personalizado ou <link> manual no template).'),
      btn,
    ]);
  }

  _removeBtn(onClick) {
    const btn = el('button', {
      type: 'button', class: 'btn btn-sm btn-outline-danger',
      title: 'Remover',
    }, [icon('trash')]);
    btn.addEventListener('click', onClick);
    return btn;
  }

  async _confirmRemove(message, action) {
    const ok = await this.editor.notify.confirm(message,
      { title: 'Remover', okLabel: 'Remover', danger: true });
    if (ok) action();
  }

  /* ---------- Tab: Export / Import ---------- */

  _renderIoTab() {
    const help = el('p', { class: 'small text-muted mb-2' },
      'Exporte tudo (CSS, blocos e templates) para um arquivo JSON. Útil para versionar no Django ou compartilhar entre instalações.');

    const btnExport = el('button', { type: 'button', class: 'btn btn-sm btn-primary' },
      [icon('cloud-download'), ' Exportar JSON']);
    btnExport.addEventListener('click', () => {
      const data = this.editor.exportCustomizations();
      const blob = new Blob([JSON.stringify(data, null, 2)],
        { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `editor-customizations-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    const fileInput = el('input', {
      type: 'file', class: 'form-control form-control-sm',
      accept: 'application/json,.json',
    });

    const mergeWrap = el('div', { class: 'form-check form-switch mb-2' });
    const mergeId = `merge-${Date.now()}`;
    const mergeChk = el('input', { type: 'checkbox', class: 'form-check-input', id: mergeId });
    mergeWrap.append(mergeChk,
      el('label', { class: 'form-check-label small', for: mergeId },
        'Mesclar (manter o que já existe)'));

    const btnImport = el('button', { type: 'button', class: 'btn btn-sm btn-outline-primary' },
      [icon('cloud-upload'), ' Importar']);
    btnImport.addEventListener('click', async () => {
      const file = fileInput.files?.[0];
      if (!file) {
        this.editor.notify.toast('Selecione um arquivo .json antes de importar.', 'warning');
        return;
      }
      try {
        const text = await file.text();
        const payload = JSON.parse(text);
        const merge = mergeChk.checked;
        if (!merge) {
          const ok = await this.editor.notify.confirm(
            'Substituir TODAS as customizações atuais? Marque "Mesclar" para preservá-las.',
            { title: 'Substituir customizações', okLabel: 'Substituir', danger: true });
          if (!ok) return;
        }
        this.editor.importCustomizations(payload, { merge });
        this.editor.notify.toast('Customizações importadas.', 'success');
      } catch (err) {
        this.editor.notify.toast('Falha ao importar: ' + err.message, 'error');
      }
    });

    const exportRow = el('div', { class: 'd-flex gap-2 align-items-center mb-3' }, [btnExport]);
    const importRow = el('div', { class: 'editor-customization-dialog__form' }, [
      el('h6', { class: 'mb-2' }, 'Importar'),
      this._labeled('Arquivo JSON', fileInput),
      mergeWrap,
      el('div', { class: 'd-flex gap-2 align-items-center' }, [btnImport]),
    ]);

    this.body.append(help, exportRow, importRow, this._buildFontLinksBox());
  }

  /**
   * Caixa "Tags para o template Django" — lista as <link> das fontes
   * registradas com googleUrl, prontas para colar no &lt;head&gt;. Inclui
   * botão "Copiar". Some quando não há fontes Google.
   */
  _buildFontLinksBox() {
    const links = this.editor.exportFontLinks();
    const wrap = el('div', { class: 'editor-customization-dialog__form mt-3' });
    wrap.appendChild(el('h6', { class: 'mb-2' }, [icon('fonts'), ' Web fonts — tags para o Django']));
    if (!links) {
      wrap.appendChild(el('small', { class: 'text-muted' },
        'Nenhuma fonte do Google Fonts registrada. Adicione em Tema → Fontes.'));
      return wrap;
    }
    wrap.appendChild(el('p', { class: 'small text-muted mb-2' },
      'Cole estas tags no <head> do template base Django para que a fonte carregue também no site público.'));
    const ta = el('textarea', {
      class: 'form-control form-control-sm font-monospace mb-2',
      rows: Math.min(8, links.split('\n').length + 1),
      readonly: 'true',
    });
    ta.value = links;
    const btnCopy = el('button', { type: 'button', class: 'btn btn-sm btn-outline-secondary' },
      [icon('clipboard'), ' Copiar tags']);
    btnCopy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(links);
        this.editor.notify.toast('Tags copiadas.', 'success');
      } catch {
        ta.select();
        document.execCommand('copy');
        this.editor.notify.toast('Tags copiadas (fallback).', 'success');
      }
    });
    wrap.append(ta, btnCopy);
    return wrap;
  }

  /* ---------- Helpers ---------- */

  _labeled(label, input) {
    return el('div', { class: 'mb-2' }, [
      el('label', { class: 'form-label small mb-1' }, label),
      input,
    ]);
  }
}
