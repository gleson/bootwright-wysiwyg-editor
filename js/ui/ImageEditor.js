import { el, icon, clear } from '../utils/dom.js';
import { t } from '../i18n/index.js';
import {
  IMAGE_DEFAULTS,
  computeTransform,
  computeFilter,
  cropImage,
  applyGamma,
  hasCssCrop,
} from '../utils/imageProcessing.js';

/**
 * ImageEditor — modal de edição de imagem estilo TinyMCE.
 *
 * Layout:
 *   ┌──────────────────────────────┐
 *   │ header                       │
 *   │ tabs                         │
 *   │ ─ controles da aba (acima) ─ │
 *   │   ┌──────────────────────┐   │
 *   │   │  PREVIEW (imagem)    │   │ ← sempre visível
 *   │   │   (overlays p/ crop, │   │
 *   │   │    foco)             │   │
 *   │   └──────────────────────┘   │
 *   │ footer                       │
 *   └──────────────────────────────┘
 *
 * O preview é a fonte da verdade visual: cada slider/botão escreve no `pending`,
 * atualiza inline-style no `<img>` do preview, e chama `editor.updateBlock`
 * pra refletir no canvas. Cancelar restaura o snapshot inicial.
 *
 * Sobre CORS:
 *  • Preview NÃO usa `crossOrigin` — assim funciona com qualquer URL pública,
 *    mesmo que o servidor não devolva `Access-Control-Allow-Origin`.
 *  • Canvas processing (crop/gama) precisa de pixels — tenta carregar com
 *    `crossOrigin='anonymous'`. Se o servidor não cooperar, devolve erro claro.
 */
export class ImageEditor {
  constructor(editor) {
    this.editor = editor;
  }

  /** Abre o modal para o bloco `nodeId` (precisa ser do tipo image). */
  open(nodeId) {
    const node = this.editor.getNode(nodeId);
    if (!node || node.type !== 'image') return;

    const snapshot = { ...IMAGE_DEFAULTS, ...node.props };
    const pending = { ...snapshot };

    const dialog = el('dialog', { class: 'editor-image-editor' });
    dialog.dataset.tab = 'transform';

    // ----- Preview central -----
    // Hierarquia: stage > previewWrap (span) > previewImg (img).
    // O wrapper só "vira" wrapper de crop quando há crop CSS ativo e a aba
    // atual NÃO é 'crop'. Na aba crop o preview mostra a imagem original
    // (necessário pro overlay de recorte trabalhar nas coordenadas naturais).
    const previewImg = el('img', {
      class: 'editor-image-editor__previewImg',
      alt: node.props.alt ?? '',
      src: node.props.src ?? '',
      // sem crossOrigin — preview funciona com qualquer URL.
    });
    const previewWrap = el('span', { class: 'editor-image-editor__previewWrap' },
      [previewImg]);
    const cropOverlay = this._buildCropOverlay();
    const focalOverlay = this._buildFocalOverlay();
    const previewStage = el('div', { class: 'editor-image-editor__stage' },
      [previewWrap, cropOverlay.root, focalOverlay.root]);

    const resetPreviewStyles = () => {
      for (const s of ['transform', 'filter', 'objectPosition',
        'marginLeft', 'marginTop', 'maxWidth', 'maxHeight', 'display',
        'width', 'height', 'transformOrigin']) {
        previewImg.style[s] = '';
      }
      for (const s of ['overflow', 'width', 'height', 'transform', 'filter', 'display']) {
        previewWrap.style[s] = '';
      }
    };

    const applyPreviewStyle = () => {
      resetPreviewStyles();
      const tr = computeTransform(pending);
      const fi = computeFilter(pending);
      const fx = Number(pending.focalX);
      const fy = Number(pending.focalY);
      const showCrop = hasCssCrop(pending) && dialog.dataset.tab !== 'crop';

      if (!showCrop) {
        // Aba crop ou sem crop ativo: img direta.
        previewImg.style.transform = tr || '';
        previewImg.style.filter = fi || '';
        previewImg.style.objectPosition = (Number.isFinite(fx) && Number.isFinite(fy))
          ? `${fx}% ${fy}%` : '';
        return;
      }
      // Aba ≠ crop, com crop ativo: replica a estrutura do Image.render
      // para que o usuário veja o estado real do bloco.
      const cw = Math.max(1, Number(pending.cropW) || 1);
      const ch = Math.max(1, Number(pending.cropH) || 1);
      const cx = Math.max(0, Number(pending.cropX) || 0);
      const cy = Math.max(0, Number(pending.cropY) || 0);
      previewWrap.style.display = 'inline-block';
      previewWrap.style.overflow = 'hidden';
      previewWrap.style.width = `${cw}px`;
      previewWrap.style.height = `${ch}px`;
      previewWrap.style.transform = tr || '';
      previewWrap.style.filter = fi || '';

      previewImg.style.marginLeft = `-${cx}px`;
      previewImg.style.marginTop = `-${cy}px`;
      previewImg.style.maxWidth = 'none';
      previewImg.style.maxHeight = 'none';
      previewImg.style.display = 'block';
      previewImg.style.width = 'auto';
      previewImg.style.height = 'auto';
      previewImg.style.objectPosition = (Number.isFinite(fx) && Number.isFinite(fy))
        ? `${fx}% ${fy}%` : '';
    };
    applyPreviewStyle();

    const apply = (patch) => {
      Object.assign(pending, patch);
      applyPreviewStyle();
      this.editor.updateBlock(nodeId, { props: { ...patch } });
    };

    // ----- Tabs + áreas -----
    const tabs = el('div', { class: 'editor-image-editor__tabs', role: 'tablist' });
    const controls = el('div', { class: 'editor-image-editor__controls' });

    const tabConfig = [
      ['align',     t('imageEditor.tab.align'),     'text-center'],
      ['transform', t('imageEditor.tab.transform'), 'arrow-clockwise'],
      ['adjust',    t('imageEditor.tab.adjust'),    'sliders'],
      ['crop',      t('imageEditor.tab.crop'),      'crop'],
      ['focal',     t('imageEditor.tab.focal'),     'bullseye'],
    ];

    const renderControls = (key) => {
      clear(controls);
      let panel;
      if      (key === 'align')     panel = this._panelAlign(nodeId);
      else if (key === 'transform') panel = this._panelTransform(pending, apply);
      else if (key === 'adjust')    panel = this._panelAdjust(nodeId, pending, apply);
      else if (key === 'crop')      panel = this._panelCrop(nodeId, pending, apply, cropOverlay);
      else if (key === 'focal')     panel = this._panelFocal(focalOverlay);
      if (panel) controls.appendChild(panel);
      // Overlays: visibilidade depende da aba.
      cropOverlay.root.hidden = (key !== 'crop');
      focalOverlay.root.hidden = (key !== 'focal');
      // Preview reflete o crop nas abas que não são 'crop'.
      applyPreviewStyle();
    };

    for (const [key, label, ico] of tabConfig) {
      const btn = el('button', {
        type: 'button', class: 'editor-image-editor__tab',
        role: 'tab', 'data-tab': key, title: label,
      }, [icon(ico), ' ', label]);
      btn.addEventListener('click', () => {
        dialog.dataset.tab = key;
        for (const t of tabs.children) {
          t.classList.toggle('is-active', t.dataset.tab === key);
        }
        renderControls(key);
      });
      tabs.appendChild(btn);
    }
    tabs.querySelector('[data-tab="transform"]').classList.add('is-active');

    // Inicializa overlays quando a imagem carregar (precisa de naturalWidth/Height).
    const onImgReady = () => {
      cropOverlay.attach(previewImg);
      focalOverlay.attach(previewImg, pending, apply);
    };
    if (previewImg.complete && previewImg.naturalWidth) onImgReady();
    else previewImg.addEventListener('load', onImgReady, { once: true });

    // ----- Botões -----
    const btnReset = el('button', {
      type: 'button', class: 'btn btn-sm btn-outline-secondary me-auto',
    }, [icon('arrow-counterclockwise'), ' ', t('imageEditor.resetAll')]);
    btnReset.addEventListener('click', () => {
      apply({ ...IMAGE_DEFAULTS });
      renderControls(dialog.dataset.tab);
    });

    const btnCancel = el('button', {
      type: 'button', class: 'btn btn-sm btn-outline-secondary',
    }, t('common.cancel'));
    btnCancel.addEventListener('click', () => {
      apply({ ...snapshot });
      dialog.close();
    });

    const btnDone = el('button', {
      type: 'button', class: 'btn btn-sm btn-primary',
    }, [icon('check2'), ' ', t('imageEditor.apply')]);
    btnDone.addEventListener('click', () => dialog.close());

    const footer = el('div', { class: 'editor-image-editor__footer' },
      [btnReset, btnCancel, btnDone]);

    dialog.append(
      el('div', { class: 'editor-image-editor__header' }, [
        el('h5', { class: 'mb-0' }, [icon('image'), ' ', t('imageEditor.title')]),
      ]),
      tabs,
      controls,
      previewStage,
      footer,
    );

    document.body.appendChild(dialog);
    dialog.addEventListener('close', () => dialog.remove());
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        apply({ ...snapshot });
        dialog.close();
      }
    });
    dialog.showModal();
    renderControls('transform');
  }

  /* ===================== Aba: Alinhamento ===================== */

  _panelAlign(nodeId) {
    const wrap = el('div', { class: 'editor-image-editor__panel' });
    const FLOAT = ['float-start', 'float-end', 'd-block', 'mx-auto'];
    const options = [
      { value: '',                label: t('imageEditor.align.none'),   ico: 'dash' },
      { value: 'float-start',     label: t('imageEditor.align.left'),   ico: 'text-left' },
      { value: 'd-block mx-auto', label: t('imageEditor.align.center'), ico: 'text-center' },
      { value: 'float-end',       label: t('imageEditor.align.right'),  ico: 'text-right' },
    ];

    const node = () => this.editor.getNode(nodeId);
    const current = () => {
      const cls = node()?.classes ?? [];
      if (cls.includes('float-start')) return 'float-start';
      if (cls.includes('float-end')) return 'float-end';
      if (cls.includes('mx-auto') && cls.includes('d-block')) return 'd-block mx-auto';
      return '';
    };

    const help = el('p', { class: 'small text-muted mb-1' }, t('imageEditor.align.help'));
    const group = el('div', { class: 'btn-group', role: 'group' });
    const refresh = () => {
      const sel = current();
      for (const b of group.children) {
        b.classList.toggle('active', b.dataset.value === sel);
      }
    };
    for (const opt of options) {
      const b = el('button', {
        type: 'button', class: 'btn btn-sm btn-outline-secondary',
        'data-value': opt.value,
      }, [icon(opt.ico), ' ', opt.label]);
      b.addEventListener('click', () => {
        const next = (node()?.classes ?? []).filter((c) => !FLOAT.includes(c));
        if (opt.value) next.push(...opt.value.split(' '));
        this.editor.updateBlock(nodeId, { classes: next });
        refresh();
      });
      group.appendChild(b);
    }
    refresh();
    wrap.append(help, group);
    return wrap;
  }

  /* ===================== Aba: Transformar ===================== */

  _panelTransform(pending, apply) {
    const wrap = el('div', { class: 'editor-image-editor__panel' });

    const btnRow = el('div', { class: 'd-flex gap-2 flex-wrap align-items-center' });
    const mkBtn = (ico, label, onClick) => {
      const b = el('button', {
        type: 'button', class: 'btn btn-sm btn-outline-secondary',
        title: label, 'aria-label': label,
      }, [icon(ico)]);
      b.addEventListener('click', onClick);
      return b;
    };
    btnRow.append(
      mkBtn('arrow-counterclockwise', t('imageEditor.transform.rotateLeft'), () => {
        apply({ rotate: ((Number(pending.rotate) || 0) - 90 + 360) % 360 });
      }),
      mkBtn('arrow-clockwise', t('imageEditor.transform.rotateRight'), () => {
        apply({ rotate: ((Number(pending.rotate) || 0) + 90) % 360 });
      }),
      mkBtn('symmetry-horizontal', t('imageEditor.transform.flipH'),
        () => apply({ flipH: !pending.flipH })),
      mkBtn('symmetry-vertical', t('imageEditor.transform.flipV'),
        () => apply({ flipV: !pending.flipV })),
    );

    const scale = this._sliderRow(t('imageEditor.transform.scale'),
      pending.scale ?? 100, 25, 200, 1, (v) => apply({ scale: v }), '%');
    btnRow.appendChild(scale.row);

    wrap.append(btnRow);
    return wrap;
  }

  /* ===================== Aba: Ajustes ===================== */

  _panelAdjust(nodeId, pending, apply) {
    const wrap = el('div', { class: 'editor-image-editor__panel editor-image-editor__panel--adjust' });

    const adjustments = [
      ['brightness', t('imageEditor.adjust.brightness'),  0,   200, 1,   '%'],
      ['contrast',   t('imageEditor.adjust.contrast'),    0,   200, 1,   '%'],
      ['saturate',   t('imageEditor.adjust.saturate'),    0,   200, 1,   '%'],
      ['grayscale',  t('imageEditor.adjust.grayscale'),   0,   100, 1,   '%'],
      ['blur',       t('imageEditor.adjust.blur'),        0,   20,  0.5, 'px'],
      ['sepia',      t('imageEditor.adjust.sepia'),       0,   100, 1,   '%'],
      ['hueRotate',  t('imageEditor.adjust.hueRotate'),   0,   360, 1,   '°'],
      ['invert',     t('imageEditor.adjust.invert'),      0,   100, 1,   '%'],
    ];

    for (const [key, label, lo, hi, step, suffix] of adjustments) {
      const row = this._sliderRow(label, pending[key], lo, hi, step,
        (v) => apply({ [key]: v }), suffix);
      wrap.appendChild(row.row);
    }

    // Gama (destrutivo via canvas — CORS pode falhar).
    const gammaInput = el('input', {
      type: 'range', class: 'form-range',
      min: 0.2, max: 3, step: 0.05, value: 1,
    });
    const gammaVal = el('span', { class: 'editor-image-editor__slider-val' }, '1.00');
    gammaInput.addEventListener('input', () => {
      gammaVal.textContent = Number(gammaInput.value).toFixed(2);
    });
    const gammaBtn = el('button', {
      type: 'button', class: 'btn btn-sm btn-outline-primary',
    }, [icon('magic'), ' ', t('imageEditor.adjust.gammaApply')]);
    gammaBtn.addEventListener('click', async () => {
      const node = this.editor.getNode(nodeId);
      if (!node) return;
      const g = Number(gammaInput.value) || 1;
      gammaBtn.disabled = true;
      try {
        const newSrc = await applyGamma(node.props.src, g);
        this.editor.updateBlock(nodeId, { props: { src: newSrc } });
        this.editor.ui.assetLibrary?.register?.(newSrc,
          { name: t('imageEditor.adjust.gammaAssetName'), kind: 'image' });
        this.editor.notify?.toast?.(t('imageEditor.adjust.gammaDone'), 'success');
        gammaInput.value = 1;
        gammaVal.textContent = '1.00';
      } catch (err) {
        console.error('[ImageEditor] applyGamma falhou:', err);
        this.editor.notify?.toast?.(err.message || String(err), 'error');
      } finally {
        gammaBtn.disabled = false;
      }
    });
    const gammaBox = el('div', { class: 'editor-image-editor__gamma' }, [
      el('strong', { class: 'small' },
        [icon('lightbulb'), ' ', t('imageEditor.adjust.gamma')]),
      el('p', { class: 'small text-muted mb-1' }, t('imageEditor.adjust.gammaHelp')),
      el('div', { class: 'd-flex align-items-center gap-2' }, [gammaInput, gammaVal, gammaBtn]),
    ]);
    wrap.appendChild(gammaBox);

    return wrap;
  }

  /* ===================== Aba: Recortar ===================== */

  _buildCropOverlay() {
    const root = el('div', { class: 'editor-image-editor__cropOverlay', hidden: true });
    const rect = el('div', { class: 'editor-image-editor__cropRect' });
    const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
      .map((h) => el('span', {
        class: `editor-image-editor__cropHandle editor-image-editor__cropHandle--${h}`,
        'data-handle': h,
      }));
    rect.append(...handles);
    root.appendChild(rect);

    const state = { x: 10, y: 10, w: 80, h: 80, ratio: 0 };
    let previewImg = null;

    const updateRect = () => {
      // Posiciona o `cropOverlay` exatamente sobre o `<img>` (que pode estar
      // centralizado e ter dimensões variáveis pelo CSS object-fit do stage).
      if (!previewImg) return;
      const imgRect = previewImg.getBoundingClientRect();
      const stageRect = root.parentElement.getBoundingClientRect();
      root.style.left = `${imgRect.left - stageRect.left}px`;
      root.style.top = `${imgRect.top - stageRect.top}px`;
      root.style.width = `${imgRect.width}px`;
      root.style.height = `${imgRect.height}px`;
      rect.style.left = `${state.x}%`;
      rect.style.top = `${state.y}%`;
      rect.style.width = `${state.w}%`;
      rect.style.height = `${state.h}%`;
    };

    const applyRatio = () => {
      if (!state.ratio || !previewImg) return;
      const nw = previewImg.naturalWidth || 1;
      const nh = previewImg.naturalHeight || 1;
      const px = state.w * nw / 100;
      const newPxH = px / state.ratio;
      state.h = Math.min(100 - state.y, newPxH * 100 / nh);
    };

    const onPointerDown = (e) => {
      const handle = e.target.closest('[data-handle]');
      const isMove = !handle && e.target === rect;
      if (!handle && !isMove) return;
      e.preventDefault();
      const start = { ...state };
      const startX = e.clientX;
      const startY = e.clientY;
      const stageRect = root.getBoundingClientRect();
      const onMove = (ev) => {
        const dxPct = (ev.clientX - startX) / stageRect.width * 100;
        const dyPct = (ev.clientY - startY) / stageRect.height * 100;
        if (isMove) {
          state.x = clamp(start.x + dxPct, 0, 100 - start.w);
          state.y = clamp(start.y + dyPct, 0, 100 - start.h);
        } else {
          resize(handle.dataset.handle, start, dxPct, dyPct);
          applyRatio();
        }
        updateRect();
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    };

    function resize(h, s, dx, dy) {
      let { x, y, w, h: hh } = s;
      if (h.includes('w')) { x = clamp(s.x + dx, 0, s.x + s.w - 5); w = s.w - (x - s.x); }
      if (h.includes('e')) { w = clamp(s.w + dx, 5, 100 - s.x); }
      if (h.includes('n')) { y = clamp(s.y + dy, 0, s.y + s.h - 5); hh = s.h - (y - s.y); }
      if (h.includes('s')) { hh = clamp(s.h + dy, 5, 100 - s.y); }
      state.x = x; state.y = y; state.w = w; state.h = hh;
    }

    root.addEventListener('pointerdown', onPointerDown);

    return {
      root,
      state,
      attach(img) {
        previewImg = img;
        updateRect();
        const ro = new ResizeObserver(updateRect);
        ro.observe(img);
        ro.observe(root.parentElement);
      },
      reset() {
        Object.assign(state, { x: 10, y: 10, w: 80, h: 80 });
        applyRatio();
        updateRect();
      },
      setRatio(r) {
        state.ratio = r;
        applyRatio();
        updateRect();
      },
      pixelCrop() {
        if (!previewImg) return null;
        const nw = previewImg.naturalWidth;
        const nh = previewImg.naturalHeight;
        return {
          x: state.x * nw / 100,
          y: state.y * nh / 100,
          w: state.w * nw / 100,
          h: state.h * nh / 100,
        };
      },
      previewImg: () => previewImg,
    };
  }

  _panelCrop(nodeId, pending, apply, overlay) {
    const wrap = el('div', { class: 'editor-image-editor__panel' });
    const help = el('p', { class: 'small text-muted mb-1' }, t('imageEditor.crop.help'));

    // Aviso quando já há recorte CSS ativo — explica que o preview da aba
    // mostra a imagem ORIGINAL, e oferece botão pra remover o crop atual.
    if (hasCssCrop(pending)) {
      const cw = Math.round(Number(pending.cropW) || 0);
      const ch = Math.round(Number(pending.cropH) || 0);
      const cx = Math.round(Number(pending.cropX) || 0);
      const cy = Math.round(Number(pending.cropY) || 0);
      const removeBtn = el('button', {
        type: 'button', class: 'btn btn-sm btn-outline-danger',
      }, [icon('x-circle'), ' ', t('imageEditor.crop.removeActive')]);
      removeBtn.addEventListener('click', () => {
        apply({ cropX: 0, cropY: 0, cropW: 0, cropH: 0 });
        // Re-renderiza este painel sem o badge.
        const fresh = this._panelCrop(nodeId, pending, apply, overlay);
        wrap.parentElement?.replaceChild(fresh, wrap);
      });
      const badge = el('div', {
        class: 'editor-image-editor__cropBadge alert alert-warning py-2 px-3 mb-2 small',
      }, [
        icon('crop'), ' ',
        el('strong', {}, t('imageEditor.crop.activeLabel')),
        ` ${cw}×${ch}px @ (${cx},${cy}). `,
        el('span', { class: 'd-block text-muted small' }, t('imageEditor.crop.activeNote')),
        el('div', { class: 'mt-2' }, [removeBtn]),
      ]);
      wrap.appendChild(badge);
    }

    const ratioSelect = el('select', { class: 'form-select form-select-sm w-auto' }, [
      el('option', { value: '0' },      t('imageEditor.crop.ratioFree')),
      el('option', { value: '1' },      '1:1'),
      el('option', { value: '1.7778' }, '16:9'),
      el('option', { value: '1.3333' }, '4:3'),
      el('option', { value: '0.5625' }, '9:16'),
      el('option', { value: '0.75' },   '3:4'),
    ]);
    ratioSelect.addEventListener('change', () => {
      overlay.setRatio(Number(ratioSelect.value) || 0);
    });

    const resetBtn = el('button', {
      type: 'button', class: 'btn btn-sm btn-outline-secondary',
    }, [icon('x'), ' ', t('imageEditor.crop.reset')]);
    resetBtn.addEventListener('click', () => overlay.reset());

    const applyBtn = el('button', {
      type: 'button', class: 'btn btn-sm btn-primary',
    }, [icon('check2'), ' ', t('imageEditor.crop.apply')]);
    applyBtn.addEventListener('click', async () => {
      const node = this.editor.getNode(nodeId);
      if (!node) return;
      const crop = overlay.pixelCrop();
      if (!crop) return;
      const orig = applyBtn.innerHTML;
      applyBtn.disabled = true;
      applyBtn.innerHTML = '';
      applyBtn.append(icon('hourglass-split'), ' ', t('imageEditor.processing'));
      try {
        // 1ª tentativa: crop destrutivo via canvas (qualidade máxima, HTML enxuto).
        const newSrc = await cropImage(node.props.src, crop);
        this.editor.updateBlock(nodeId, { props: {
          src: newSrc,
          // Limpa qualquer crop CSS prévio — agora os pixels já são o recorte.
          cropX: 0, cropY: 0, cropW: 0, cropH: 0,
        } });
        this.editor.ui.assetLibrary?.register?.(newSrc,
          { name: t('imageEditor.crop.assetName'), kind: 'image' });
        this.editor.notify?.toast?.(t('imageEditor.crop.done'), 'success');
        const previewImg = overlay.previewImg();
        if (previewImg) previewImg.src = newSrc;
        overlay.reset();
      } catch (err) {
        // 2ª tentativa: fallback CSS (wrapper com overflow:hidden + img deslocada).
        // Aplica quando o canvas é bloqueado por CORS — não toca pixels, então
        // funciona com qualquer URL pública. Grava as coordenadas em props.
        if (/cors|tainted|crossorigin|falha ao carregar/i.test(String(err?.message || err))) {
          this.editor.updateBlock(nodeId, { props: {
            cropX: Math.round(crop.x),
            cropY: Math.round(crop.y),
            cropW: Math.round(crop.w),
            cropH: Math.round(crop.h),
          } });
          this.editor.notify?.toast?.(t('imageEditor.crop.cssFallback'), 'success');
        } else {
          console.error('[ImageEditor] cropImage falhou:', err);
          this.editor.notify?.toast?.(this._corsHint(err), 'error');
        }
      } finally {
        applyBtn.disabled = false;
        applyBtn.innerHTML = orig;
      }
    });

    const row = el('div', { class: 'd-flex gap-2 align-items-center flex-wrap' }, [
      el('label', { class: 'small mb-0 me-1' }, t('imageEditor.crop.ratio')),
      ratioSelect,
      el('span', { class: 'ms-auto d-inline-flex gap-2' }, [resetBtn, applyBtn]),
    ]);
    wrap.append(help, row);
    return wrap;
  }

  /* ===================== Aba: Foco ===================== */

  _buildFocalOverlay() {
    const root = el('div', { class: 'editor-image-editor__focalOverlay', hidden: true });
    const dot = el('div', { class: 'editor-image-editor__focalDot' });
    root.appendChild(dot);

    let previewImg = null;
    let pendingRef = null;
    let applyRef = null;

    const place = () => {
      dot.style.left = `${pendingRef?.focalX ?? 50}%`;
      dot.style.top = `${pendingRef?.focalY ?? 50}%`;
    };
    const updatePosition = () => {
      if (!previewImg) return;
      const imgRect = previewImg.getBoundingClientRect();
      const stageRect = root.parentElement.getBoundingClientRect();
      root.style.left = `${imgRect.left - stageRect.left}px`;
      root.style.top = `${imgRect.top - stageRect.top}px`;
      root.style.width = `${imgRect.width}px`;
      root.style.height = `${imgRect.height}px`;
      place();
    };

    const setFromEvent = (ev) => {
      if (!pendingRef || !applyRef) return;
      const rect = root.getBoundingClientRect();
      const x = clamp(((ev.clientX - rect.left) / rect.width) * 100, 0, 100);
      const y = clamp(((ev.clientY - rect.top) / rect.height) * 100, 0, 100);
      applyRef({ focalX: Math.round(x), focalY: Math.round(y) });
      place();
    };
    let dragging = false;
    root.addEventListener('pointerdown', (e) => {
      dragging = true;
      root.setPointerCapture?.(e.pointerId);
      setFromEvent(e);
    });
    root.addEventListener('pointermove', (e) => { if (dragging) setFromEvent(e); });
    root.addEventListener('pointerup', () => { dragging = false; });
    root.addEventListener('pointercancel', () => { dragging = false; });

    return {
      root,
      attach(img, pending, apply) {
        previewImg = img;
        pendingRef = pending;
        applyRef = apply;
        updatePosition();
        const ro = new ResizeObserver(updatePosition);
        ro.observe(img);
        ro.observe(root.parentElement);
      },
      reset() {
        if (applyRef) applyRef({ focalX: 50, focalY: 50 });
        place();
      },
    };
  }

  _panelFocal(overlay) {
    const wrap = el('div', { class: 'editor-image-editor__panel' });
    const help = el('p', { class: 'small text-muted mb-1' }, t('imageEditor.focal.help'));
    const resetBtn = el('button', {
      type: 'button', class: 'btn btn-sm btn-outline-secondary',
    }, [icon('bullseye'), ' ', t('imageEditor.focal.center')]);
    resetBtn.addEventListener('click', () => overlay.reset());
    wrap.append(help, resetBtn);
    return wrap;
  }

  /* ===================== Helpers ===================== */

  _corsHint(err) {
    const msg = String(err?.message || err);
    if (/cors|tainted|crossorigin/i.test(msg)) {
      return t('imageEditor.corsHint');
    }
    return msg;
  }

  /**
   * Linha de slider compartilhada. Retorna `{ row, set(v) }`.
   */
  _sliderRow(label, value, min, max, step, onInput, suffix = '') {
    const row = el('div', { class: 'editor-image-editor__slider' });
    const lbl = el('label', { class: 'editor-image-editor__slider-label' }, label);
    const range = el('input', {
      type: 'range', class: 'form-range',
      min: String(min), max: String(max), step: String(step), value: String(value ?? min),
    });
    const num = el('input', {
      type: 'number', class: 'form-control form-control-sm editor-image-editor__slider-num',
      min: String(min), max: String(max), step: String(step), value: String(value ?? min),
    });
    const sfx = suffix ? el('span', { class: 'editor-image-editor__slider-suffix' }, suffix) : null;

    const sync = (v) => {
      const n = Math.max(min, Math.min(max, Number(v)));
      range.value = String(n);
      num.value = String(n);
      onInput(n);
    };
    range.addEventListener('input', () => sync(range.value));
    num.addEventListener('input', () => sync(num.value));

    row.append(lbl, range, num);
    if (sfx) row.appendChild(sfx);
    return { row, set: (v) => { range.value = String(v); num.value = String(v); } };
  }
}

function clamp(n, lo, hi) {
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}
