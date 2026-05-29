import { el, icon } from '../utils/dom.js';

/**
 * TemplateEditBanner — faixa azul abaixo da topbar exibida apenas enquanto
 * o usuário está editando um template existente (modo "Carregar para edição").
 *
 * Botões:
 *   - Atualizar template (commit)  → grava root atual no template e sai do modo
 *   - Salvar como novo             → cria template novo (mantém o original)
 *   - Cancelar edição              → sai do modo (mantém o conteúdo no canvas)
 */
export class TemplateEditBanner {
  constructor(editor) {
    this.editor = editor;
    this.root = editor.root;
    this.banner = null;
  }

  mount() {
    this.editor.bus.on('template-edit:started',
      ({ id, name }) => this._show('template', id, name));
    this.editor.bus.on('template-edit:ended', () => this._hide());
    this.editor.bus.on('component-edit:started',
      ({ id, name }) => this._show('component', id, name));
    this.editor.bus.on('component-edit:ended', () => this._hide());
  }

  _show(kind, id, name) {
    this._hide();
    this.kind = kind;
    const isComponent = kind === 'component';

    const updateBtn = el('button', {
      type: 'button', class: 'btn btn-sm btn-primary',
    }, [icon('check2-circle'), ' ', isComponent ? 'Atualizar componente' : 'Atualizar template']);
    updateBtn.addEventListener('click', () => this._commit());

    const saveAsNewBtn = el('button', {
      type: 'button', class: 'btn btn-sm btn-outline-light',
    }, [icon('plus-lg'), ' Salvar como novo']);
    saveAsNewBtn.addEventListener('click', () => this._saveAsNew());

    const cancelBtn = el('button', {
      type: 'button', class: 'btn btn-sm btn-outline-light',
    }, [icon('x-lg'), ' Cancelar edição']);
    cancelBtn.addEventListener('click', () => this._cancel());

    this.banner = el('div', {
      class: 'editor-template-edit-banner',
      role: 'region',
      'aria-label': isComponent
        ? 'Modo de edição de componente'
        : 'Modo de edição de template',
      dataset: { kind },
    }, [
      icon(isComponent ? 'box-seam' : 'bookmark-fill'),
      el('span', { class: 'editor-template-edit-banner__label' }, [
        isComponent ? 'Editando componente: ' : 'Editando template: ',
        el('strong', {}, name),
        isComponent ? el('small', { class: 'ms-2 opacity-75' },
          '(todas as instâncias atualizam ao salvar)') : null,
      ]),
      el('div', { class: 'editor-template-edit-banner__actions' },
        [updateBtn, saveAsNewBtn, cancelBtn]),
    ]);
    const body = this.root.querySelector('.editor-body');
    this.root.insertBefore(this.banner, body);
  }

  _hide() {
    this.banner?.remove();
    this.banner = null;
  }

  _commit() {
    const root = this.editor.getRoot();
    if (!root.children?.length) {
      this.editor.notify.toast(
        'Não é possível salvar vazio. Adicione pelo menos um bloco.', 'warning');
      return;
    }
    if (this.kind === 'component') {
      if (root.children.length > 1) {
        this.editor.notify.toast(
          'Componente deve ter um único bloco raiz. Apenas o primeiro será salvo.',
          'warning');
      }
      if (this.editor.commitComponentEdit()) {
        this.editor.notify.toast('Componente atualizado — instâncias sincronizadas.', 'success');
      }
    } else {
      if (this.editor.commitTemplateEdit()) {
        this.editor.notify.toast('Template atualizado.', 'success');
      }
    }
  }

  async _saveAsNew() {
    const root = this.editor.getRoot();
    if (!root.children?.length) {
      this.editor.notify.toast('Página vazia — adicione blocos antes de salvar.', 'warning');
      return;
    }
    if (this.kind === 'component') {
      const original = this.editor.getComponent(this.editor.editingComponentId);
      const name = await this.editor.notify.prompt(
        'Nome do novo componente:',
        original ? `${original.name} (cópia)` : 'Novo componente',
        { title: 'Salvar como novo componente', okLabel: 'Salvar' });
      if (!name) return;
      const tree = JSON.parse(JSON.stringify(root.children[0]));
      const meta = this.editor.addComponent({ name, tree });
      if (meta) {
        this.editor.cancelComponentEdit();
        this.editor.notify.toast(`Novo componente "${meta.name}" salvo.`, 'success');
      }
      return;
    }
    const original = this.editor.getTemplate(this.editor.editingTemplateId);
    const name = await this.editor.notify.prompt(
      'Nome do novo template:',
      original ? `${original.name} (cópia)` : 'Novo template',
      { title: 'Salvar como novo template', okLabel: 'Salvar' });
    if (!name) return;
    const tpl = this.editor.savePageAsTemplate(name);
    if (tpl) {
      this.editor.cancelTemplateEdit();
      this.editor.notify.toast(`Novo template "${tpl.name}" salvo.`, 'success');
    }
  }

  async _cancel() {
    const which = this.kind === 'component' ? 'componente' : 'template';
    const ok = await this.editor.notify.confirm(
      `Sair do modo de edição? O ${which} original NÃO será modificado. ` +
      'O conteúdo atual continua no canvas.',
      { title: 'Cancelar edição', okLabel: 'Sair', cancelLabel: 'Voltar' });
    if (!ok) return;
    if (this.kind === 'component') this.editor.cancelComponentEdit();
    else                            this.editor.cancelTemplateEdit();
    this.editor.notify.toast(`Edição de ${which} cancelada.`, 'info');
  }
}
