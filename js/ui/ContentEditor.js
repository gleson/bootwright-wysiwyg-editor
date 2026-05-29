import { el, icon } from '../utils/dom.js';
import { Editor } from '../core/Editor.js';
import { htmlToBlocks } from '../utils/htmlImport.js';
import { t } from '../i18n/index.js';
import { Carousel } from '../blocks/built-in/Carousel.js';
import { SlidePropertiesPanel } from './SlidePropertiesPanel.js';

/**
 * ContentEditor — modal com mini-Editor para edição rica do conteúdo de um
 * painel (aba/acordeão/slide).
 *
 * Modos:
 *  - Padrão: `open({ title, html, onSave })` — Tabs/Accordion.
 *  - Slide:  `open({ title, html, onSave, slideMode: {…} })` — Carousel.
 *    Em slide mode o dialog fica compacto, o canvas ganha backdrop com a
 *    imagem do slide e uma barra extra de controles (URL/biblioteca + size +
 *    position + repeat + altura). `onSave(html, meta)` recebe o objeto meta
 *    com `{src, alt, bgSize, bgPosition, bgRepeat, minHeight}` atualizado.
 *
 * Implementação:
 *  - Cada `open()` cria um `<dialog>` e um sub-Editor zerados; close descarta.
 *  - Sub-Editor usa autoSave=false, collabUrl=null. Reusa o CSS customizado
 *    do editor-pai injetando uma `<style>` no scope do dialog.
 *  - Atalhos do editor-pai (Ctrl+Z, Ctrl+S, Ctrl+K, Ctrl+F) são neutralizados
 *    enquanto o dialog está aberto via listener capture no document.
 */
export class ContentEditor {
  constructor(editor) {
    this.editor = editor;
    this._activeDialog = null;
  }

  /**
   * @param {{
   *   title: string,
   *   html: string,
   *   onSave: (html: string, meta?: object) => void,
   *   slideMode?: {
   *     src?: string, alt?: string,
   *     bgSize?: string, bgPosition?: string, bgRepeat?: string,
   *     minHeight?: string,
   *   }
   * }} opts
   */
  open(opts) {
    if (this._activeDialog) return;
    const { title = 'Editar conteúdo', html = '', onSave, slideMode } = opts || {};

    // Estado local do modo slide — atualizado pelos controles na barra,
    // pintado no backdrop em tempo real, devolvido em `onSave(html, meta)`.
    const meta = slideMode ? Carousel._withDefaults(slideMode) : null;

    const dialog = el('dialog', {
      class: 'editor-content-editor-dialog' + (meta ? ' editor-content-editor-dialog--slide' : ''),
    });
    this._activeDialog = dialog;

    // ---- header (barra do modal) ----
    const titleEl = el('h5', { class: 'mb-0 text-truncate' }, [
      icon('layout-text-window-reverse'), ' ', title,
    ]);
    const btnCancel = el('button', {
      type: 'button', class: 'btn btn-sm btn-outline-secondary',
    }, t('contentEditor.cancel'));
    const btnSave = el('button', {
      type: 'button', class: 'btn btn-sm btn-primary',
    }, [icon('check2'), ' ', t('contentEditor.saveReturn')]);

    const header = el('header', { class: 'editor-content-editor-dialog__header' }, [
      titleEl,
      el('div', { class: 'editor-content-editor-dialog__actions' }, [btnCancel, btnSave]),
    ]);

    // ---- shell do sub-editor (mesma estrutura do index.html) ----
    const canvasEl = el('div', {
      class: 'editor-canvas' + (meta ? ' editor-canvas--slide-backdrop' : ''),
      dataset: { region: 'canvas', device: 'desktop' }, tabindex: 0,
    });

    const shell = el('div', {
      class: 'editor-shell editor-content-editor-dialog__shell',
      role: 'application',
      'aria-label': title,
    }, [
      el('header', { class: 'editor-topbar', role: 'toolbar' }, [
        el('div', { class: 'editor-topbar__group editor-topbar__group--start' }),
        el('div', {
          class: 'editor-topbar__group editor-topbar__group--center',
          dataset: { region: 'device-switch' }, role: 'group',
        }, [
          el('button', { type: 'button', class: 'btn btn-sm btn-outline-secondary', dataset: { device: 'desktop' }, disabled: true }, [icon('display')]),
          el('button', { type: 'button', class: 'btn btn-sm btn-outline-secondary', dataset: { device: 'tablet' },  disabled: true }, [icon('tablet')]),
          el('button', { type: 'button', class: 'btn btn-sm btn-outline-secondary', dataset: { device: 'mobile' },  disabled: true }, [icon('phone')]),
        ]),
        el('div', {
          class: 'editor-topbar__group editor-topbar__group--end',
          dataset: { region: 'actions' }, role: 'group',
        }, [
          el('button', { type: 'button', class: 'btn btn-sm btn-outline-secondary', dataset: { action: 'undo' }, disabled: true }, [icon('arrow-counterclockwise')]),
          el('button', { type: 'button', class: 'btn btn-sm btn-outline-secondary', dataset: { action: 'redo' }, disabled: true }, [icon('arrow-clockwise')]),
          // Save oculto: Topbar referencia o seletor e crasha se não existir.
          el('button', { type: 'button', class: 'btn btn-sm btn-primary d-none', dataset: { action: 'save' }, hidden: true, 'aria-hidden': 'true' }, [icon('check')]),
        ]),
      ]),
      el('div', { class: 'editor-body' }, [
        el('aside', { class: 'editor-sidebar editor-sidebar--left',  dataset: { region: 'sidebar-left' } }),
        el('main',  { class: 'editor-canvas-wrapper', dataset: { region: 'canvas-wrapper' } }, [canvasEl]),
        el('aside', { class: 'editor-sidebar editor-sidebar--right', dataset: { region: 'sidebar-right' } }),
      ]),
    ]);

    dialog.appendChild(header);
    dialog.appendChild(shell);
    document.body.appendChild(dialog);

    // ---- prepara estado inicial a partir do HTML ----
    let initialChildren = [];
    try {
      initialChildren = htmlToBlocks(html, this.editor.sanitizer);
    } catch (err) {
      console.warn('[ContentEditor] htmlToBlocks falhou:', err);
    }

    // ---- instancia o sub-Editor ----
    let subEditor;
    try {
      subEditor = new Editor({
        rootElement: shell,
        autoSave: false,
        collabUrl: null,
        initialJSON: { type: 'root', children: initialChildren },
      });
      subEditor.customizations.importAll(this.editor.customizations.exportAll());
      subEditor.init();
    } catch (err) {
      console.error('[ContentEditor] Falha ao criar sub-editor:', err);
      dialog.remove();
      this._activeDialog = null;
      this.editor.notify?.toast?.(t('contentEditor.error'), 'danger');
      return;
    }

    // ---- monta o painel de propriedades do slide (modo slide) ----
    let slidePanelEl = null;
    if (meta) {
      const sidebarRight = shell.querySelector('[data-region="sidebar-right"]');
      if (sidebarRight) {
        // Cria um container para o painel do slide que não substitui o painel padrão
        slidePanelEl = el('div', { class: 'editor-content-editor-slide-panel' });
        sidebarRight.insertBefore(slidePanelEl, sidebarRight.firstChild);

        const slidePanel = new SlidePropertiesPanel(
          meta,
          canvasEl,
          () => {
            // Callback: qualquer mudança no painel atualiza o backdrop
            Carousel.applySlideBackground(canvasEl, meta);
          },
          { bus: subEditor.bus }
        );
        slidePanel.mount(slidePanelEl);
        this._activeSlidePanel = slidePanel;

        // Listener para abertura da biblioteca de imagens
        dialog.addEventListener('openAssetLibrary', (e) => {
          if (e.detail?.type === 'image') {
            this.editor.ui?.assetLibrary?.open({
              accept: 'image/*',
              onPick: (url) => {
                meta.src = url;
                // Limpa e remonta o painel
                slidePanelEl.innerHTML = '';
                slidePanel.mount(slidePanelEl);
                Carousel.applySlideBackground(canvasEl, meta);
              },
            });
          }
        });
      }

      // Aplica o backdrop inicial
      Carousel.applySlideBackground(canvasEl, meta);
    }

    // ---- desativa atalhos globais do editor-pai enquanto o modal está aberto ----
    const trapShortcuts = (e) => {
      const blockKeys = new Set(['z', 'y', 's', 'k', 'f', '/']);
      if ((e.ctrlKey || e.metaKey) && blockKeys.has(e.key.toLowerCase())) {
        if (dialog.contains(e.target)) e.stopImmediatePropagation();
      }
    };
    document.addEventListener('keydown', trapShortcuts, true);

    // ---- close + cleanup ----
    const close = (commit) => {
      if (commit) {
        try {
          const out = subEditor.exportHTML();
          onSave?.(out, meta ? { ...meta } : undefined);
        } catch (err) {
          console.error('[ContentEditor] exportHTML falhou:', err);
          this.editor.notify?.toast?.(t('contentEditor.error'), 'danger');
          return;
        }
      }
      document.removeEventListener('keydown', trapShortcuts, true);
      this._activeSlidePanel?.destroy?.();
      this._activeSlidePanel = null;
      dialog.close();
    };

    btnCancel.addEventListener('click', () => close(false));
    btnSave.addEventListener('click', () => close(true));

    dialog.addEventListener('close', () => {
      dialog.remove();
      this._activeDialog = null;
    });

    dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      close(false);
    });

    dialog.showModal();
  }
}
