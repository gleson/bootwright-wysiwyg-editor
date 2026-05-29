import { el, icon } from '../utils/dom.js';
import { t } from '../i18n/index.js';
import {
  SLIDE_BG_SIZE_OPTIONS,
  SLIDE_BG_POSITION_OPTIONS,
  SLIDE_BG_REPEAT_OPTIONS,
  Carousel,
} from '../blocks/built-in/Carousel.js';

/**
 * SlidePropertiesPanel — painel de propriedades customizado para edição de
 * slides no ContentEditor (modo slide). Injeta um cabeçalho colapsável no
 * sidebar-right do sub-editor, abrigando os controles do slide sem
 * substituir o painel padrão (que exibe as propriedades do bloco que está
 * selecionado dentro do slide).
 *
 * Inclui:
 *  - Controles de imagem de fundo (URL, biblioteca, alt, tamanho, posição,
 *    repetição, altura)
 *  - Controles de alinhamento flex (vertical = justify-content; horizontal
 *    = align-items — slide é column)
 *  - Atualização ao vivo do backdrop e do flex no canvas conforme mudam
 *  - Auto-colapso quando um bloco é selecionado dentro do slide para dar
 *    espaço ao painel padrão de propriedades; auto-expande quando deseleciona
 */
export class SlidePropertiesPanel {
  constructor(meta, canvasEl, onMetaChange, opts = {}) {
    this.meta = meta;
    this.canvasEl = canvasEl;
    this.onMetaChange = onMetaChange;
    this.bus = opts.bus ?? null;
    this.collapsed = false;
    this._busUnsub = null;
  }

  /**
   * Monta o painel em um container específico.
   * @param {HTMLElement} container - Elemento para montar o painel
   */
  mount(container) {
    if (!container) return;
    // Re-mounts (ex.: depois de escolher imagem da biblioteca) reusam o
    // mesmo container — desregistra o listener anterior pra não duplicar.
    this._busUnsub?.();
    this._busUnsub = null;
    this.container = container;
    container.innerHTML = '';

    this.headerEl = this._buildHeader();
    this.bodyEl = el('div', { class: 'editor-slide-properties__body' });
    this.bodyEl.appendChild(this._buildImageSection());
    this.bodyEl.appendChild(this._buildAlignmentSection());

    container.appendChild(this.headerEl);
    container.appendChild(this.bodyEl);

    this._applyCollapsed();

    // Auto-colapsa quando o usuário seleciona um bloco no canvas do slide
    // (libera espaço pro painel padrão) e re-expande ao deselecionar.
    if (this.bus && !this._busUnsub) {
      this._busUnsub = this.bus.on('selection:changed', ({ id, ids }) => {
        const hasSel = !!id || (Array.isArray(ids) && ids.length > 0);
        this.setCollapsed(hasSel);
      });
    }
  }

  setCollapsed(v) {
    this.collapsed = !!v;
    this._applyCollapsed();
  }

  _applyCollapsed() {
    if (!this.headerEl || !this.bodyEl) return;
    this.bodyEl.hidden = this.collapsed;
    this.headerEl.dataset.collapsed = String(this.collapsed);
    const chev = this.headerEl.querySelector('[data-role="chevron"]');
    if (chev) {
      chev.innerHTML = '';
      chev.appendChild(icon(this.collapsed ? 'chevron-down' : 'chevron-up'));
    }
  }

  _buildHeader() {
    const chev = el('span', { class: 'editor-slide-properties__chev', dataset: { role: 'chevron' } }, [
      icon('chevron-up'),
    ]);
    const header = el('button', {
      type: 'button',
      class: 'editor-slide-properties__header',
      'aria-label': 'Alternar painel de propriedades do slide',
    }, [
      el('span', { class: 'editor-slide-properties__header-title' }, [
        icon('aspect-ratio'), ' Propriedades do Slide',
      ]),
      chev,
    ]);
    header.addEventListener('click', () => this.setCollapsed(!this.collapsed));
    return header;
  }

  _buildImageSection() {
    const srcInput = el('input', {
      type: 'text',
      class: 'form-control form-control-sm',
      placeholder: 'https://…',
      value: this.meta.src ?? '',
    });

    const libBtn = el('button', {
      type: 'button',
      class: 'btn btn-sm btn-outline-secondary w-100',
      title: t('contentEditor.slide.assetLib'),
      'aria-label': t('contentEditor.slide.assetLib'),
    }, [icon('images'), ' Biblioteca de Imagens']);

    const altInput = el('input', {
      type: 'text',
      class: 'form-control form-control-sm',
      placeholder: t('contentEditor.slide.altPh'),
      value: this.meta.alt ?? '',
    });

    const bgSizeSel = buildSelect(SLIDE_BG_SIZE_OPTIONS, this.meta.bgSize);
    const bgPosSel = buildSelect(SLIDE_BG_POSITION_OPTIONS, this.meta.bgPosition);
    const bgRepSel = buildSelect(SLIDE_BG_REPEAT_OPTIONS, this.meta.bgRepeat);

    const minHeightInput = el('input', {
      type: 'text',
      class: 'form-control form-control-sm',
      placeholder: '400px / 50vh',
      value: this.meta.minHeight ?? '',
    });

    srcInput.addEventListener('input', () => {
      this.meta.src = srcInput.value;
      this._updateBackdrop();
      this.onMetaChange?.();
    });

    libBtn.addEventListener('click', () => {
      libBtn.dispatchEvent(
        new CustomEvent('openAssetLibrary', { detail: { type: 'image' }, bubbles: true })
      );
    });

    altInput.addEventListener('input', () => {
      this.meta.alt = altInput.value;
      this._updateBackdrop();
      this.onMetaChange?.();
    });

    bgSizeSel.addEventListener('change', () => {
      this.meta.bgSize = bgSizeSel.value;
      this._updateBackdrop();
      this.onMetaChange?.();
    });

    bgPosSel.addEventListener('change', () => {
      this.meta.bgPosition = bgPosSel.value;
      this._updateBackdrop();
      this.onMetaChange?.();
    });

    bgRepSel.addEventListener('change', () => {
      this.meta.bgRepeat = bgRepSel.value;
      this._updateBackdrop();
      this.onMetaChange?.();
    });

    minHeightInput.addEventListener('input', () => {
      this.meta.minHeight = minHeightInput.value;
      this._updateBackdrop();
      this.onMetaChange?.();
    });

    return el('div', { class: 'editor-slide-properties__section' }, [
      el('h6', { class: 'editor-slide-properties__title' }, [
        icon('image'), ' Imagem de Fundo',
      ]),
      el('div', { class: 'editor-slide-properties__group' }, [
        buildFormGroup('URL da imagem', srcInput),
        buildFormGroup('', libBtn),
        buildFormGroup('Texto alternativo (alt)', altInput),
        buildFormGroup('Tamanho da imagem', bgSizeSel),
        buildFormGroup('Posição da imagem', bgPosSel),
        buildFormGroup('Repetição', bgRepSel),
        buildFormGroup('Altura mínima', minHeightInput),
      ]),
    ]);
  }

  _buildAlignmentSection() {
    // Slide é flex-direction: column → justify-content controla o eixo
    // VERTICAL (cima/meio/baixo) e align-items o HORIZONTAL (esq/centro/dir).
    const verticalOptions = [
      { value: 'flex-start', label: 'Topo' },
      { value: 'center', label: 'Meio' },
      { value: 'flex-end', label: 'Base' },
      { value: 'space-between', label: 'Espaçado' },
      { value: 'space-around', label: 'Ao redor' },
    ];

    const horizontalOptions = [
      { value: 'flex-start', label: 'Esquerda' },
      { value: 'center', label: 'Centro' },
      { value: 'flex-end', label: 'Direita' },
      { value: 'stretch', label: 'Esticar' },
    ];

    const vertSel = buildSelect(verticalOptions, this.meta.justifyContent);
    const horizSel = buildSelect(horizontalOptions, this.meta.alignItems);

    vertSel.addEventListener('change', () => {
      this.meta.justifyContent = vertSel.value;
      this._updateBackdrop();
      this.onMetaChange?.();
    });

    horizSel.addEventListener('change', () => {
      this.meta.alignItems = horizSel.value;
      this._updateBackdrop();
      this.onMetaChange?.();
    });

    return el('div', { class: 'editor-slide-properties__section' }, [
      el('h6', { class: 'editor-slide-properties__title' }, [
        icon('align-center'), ' Alinhamento dos Itens',
      ]),
      el('div', { class: 'editor-slide-properties__group' }, [
        buildFormGroup('Vertical', vertSel),
        buildFormGroup('Horizontal', horizSel),
      ]),
    ]);
  }

  _updateBackdrop() {
    Carousel.applySlideBackground(this.canvasEl, this.meta);
  }

  destroy() {
    this._busUnsub?.();
    this._busUnsub = null;
  }
}

/** Helper: cria um <select> populado com `options` e o `value` inicial. */
function buildSelect(options, value) {
  const sel = el('select', { class: 'form-select form-select-sm' });
  for (const opt of options) {
    const o = el('option', { value: opt.value }, opt.label);
    if (String(opt.value) === String(value ?? '')) o.selected = true;
    sel.appendChild(o);
  }
  return sel;
}

/** Helper: agrupa label + controle. */
function buildFormGroup(label, control) {
  const group = el('div', { class: 'editor-slide-properties__form-group' });
  if (label) {
    group.appendChild(el('label', { class: 'form-label form-label-sm mb-1' }, label));
  }
  group.appendChild(control);
  return group;
}
