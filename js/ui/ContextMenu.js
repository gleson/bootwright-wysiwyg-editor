import { el, icon } from '../utils/dom.js';

/**
 * ContextMenu — menu do botão direito sobre blocos no canvas.
 *
 * Itens variam conforme o estado: "Selecionar pai" só se há pai não-root;
 * "Colar abaixo" só se há clipboard. Posiciona próximo ao cursor com clamp
 * para não sair da viewport. Fecha em click fora, Esc ou seleção de item.
 */
export class ContextMenu {
  constructor(editor) {
    this.editor = editor;
    this.canvas = editor.root.querySelector('[data-region="canvas"]');
    this.menu = null;
  }

  mount() {
    this.canvas.addEventListener('contextmenu', (e) => {
      const blockEl = e.target.closest('[data-block-id]');
      if (!blockEl) return;
      e.preventDefault();
      const id = blockEl.dataset.blockId;
      this.editor.selectBlock(id);
      this._show(e.clientX, e.clientY, id);
    });
    document.addEventListener('mousedown', (e) => {
      if (this.menu && !this.menu.contains(e.target)) this._hide();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.menu) this._hide();
    });
    window.addEventListener('blur', () => this._hide());
  }

  _show(x, y, id) {
    this._hide();
    const node = this.editor.getNode(id);
    if (!node) return;

    const items = this._buildItems(id, node);
    this.menu = el('div', {
      class: 'editor-context-menu',
      role: 'menu',
      'aria-label': `Ações para ${node.type}`,
    });
    for (const item of items) {
      this.menu.appendChild(item.separator
        ? el('div', { class: 'editor-context-menu__separator' })
        : this._buildItem(item));
    }

    document.body.appendChild(this.menu);
    this._position(x, y);
    // Foco no primeiro item habilitado (acessibilidade)
    this.menu.querySelector('button')?.focus();
  }

  _buildItems(id, node) {
    const parent = this.editor.getParentOf(id);
    const items = [];
    if (parent && parent.id !== this.editor.rootId) {
      items.push({ label: 'Selecionar pai', icon: 'arrow-up-square',
        action: () => this.editor.selectBlock(parent.id) });
      items.push({ separator: true });
    }
    items.push({ label: 'Duplicar', icon: 'files', shortcut: 'Ctrl+D',
      action: () => this.editor.duplicateBlock(id) });
    items.push({ label: 'Copiar', icon: 'clipboard', shortcut: 'Ctrl+C',
      action: () => this.editor.copyBlock(id) });
    if (this.editor.hasClipboard()) {
      items.push({ label: 'Colar abaixo', icon: 'clipboard-plus', shortcut: 'Ctrl+V',
        action: () => this.editor.pasteBlock(id) });
    }
    items.push({ separator: true });
    const commentCount = this.editor.getCommentCount(id);
    items.push({
      label: commentCount > 0 ? `Comentários (${commentCount})` : 'Comentar…',
      icon: 'chat-left-text',
      action: () => this.editor.ui.comments?.open(id),
    });
    items.push({ separator: true });
    items.push({ label: 'Salvar bloco como template', icon: 'bookmark-plus',
      action: () => this._saveAsTemplate(id, node) });
    items.push({ label: 'Salvar bloco como componente', icon: 'box-seam',
      action: () => this._saveAsComponent(id, node) });
    items.push({ label: 'Limpar formatações', icon: 'eraser',
      action: () => this.editor.clearBlockClasses(id) });
    items.push({ label: 'Excluir', icon: 'trash', shortcut: 'Delete',
      action: () => this.editor.removeBlock(id), danger: true });
    return items;
  }

  async _saveAsComponent(id, node) {
    const defaultName = node.props?.text
      ? `${node.type}: ${String(node.props.text).slice(0, 20)}`
      : node.type;
    const name = await this.editor.notify.prompt(
      'Nome do componente. O bloco selecionado vira o "master"; o atual será substituído por uma instância sincronizada.',
      defaultName,
      { title: 'Salvar como componente', placeholder: 'Ex.: Hero da marca', okLabel: 'Salvar' });
    if (!name) return;
    const meta = this.editor.saveAsComponent(id, name);
    if (meta) {
      this.editor.notify.toast(
        `Componente "${meta.name}" criado. Edite-o uma vez e todas as instâncias atualizam.`,
        'success');
    }
  }

  async _saveAsTemplate(id, node) {
    const defaultName = node.props?.text
      ? `${node.type}: ${String(node.props.text).slice(0, 20)}`
      : node.type;
    const name = await this.editor.notify.prompt(
      'Nome do template (apenas este bloco):', defaultName,
      { title: 'Salvar bloco como template', placeholder: 'Ex.: Hero verde', okLabel: 'Salvar' });
    if (!name) return;
    const tpl = this.editor.saveAsTemplate(id, name);
    if (tpl) {
      this.editor.notify.toast(`Template "${tpl.name}" salvo.`, 'success');
    }
  }

  _buildItem(item) {
    const btn = el('button', {
      type: 'button',
      role: 'menuitem',
      class: `editor-context-menu__item${item.danger ? ' editor-context-menu__item--danger' : ''}`,
    }, [
      icon(item.icon),
      el('span', { class: 'editor-context-menu__label' }, item.label),
      item.shortcut ? el('kbd', {}, item.shortcut) : null,
    ]);
    btn.addEventListener('click', () => {
      try { item.action(); }
      finally { this._hide(); }
    });
    return btn;
  }

  _position(x, y) {
    const w = this.menu.offsetWidth;
    const h = this.menu.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    this.menu.style.left = `${Math.min(x, vw - w - 8)}px`;
    this.menu.style.top  = `${Math.min(y, vh - h - 8)}px`;
  }

  _hide() {
    if (this.menu) {
      this.menu.remove();
      this.menu = null;
    }
  }
}
