import { Block } from '../Block.js';
import { spacingControls, advancedControls,
  borderControls, shadowControl, sizingControls, objectFitControl } from '../common-controls.js';
import { computeTransform, computeFilter, hasCssCrop } from '../../utils/imageProcessing.js';
import { safeUrl } from '../../utils/url.js';

export class Image extends Block {
  static type = 'image';
  static label = 'Imagem';
  static icon = 'image';
  static schema = {
    props: {
      src: 'https://placehold.co/600x400?text=Imagem',
      alt: 'Imagem',
      // Transformações não-destrutivas (CSS) — `0` / `false` = neutro.
      rotate: 0, flipH: false, flipV: false, scale: 100,
      brightness: 100, contrast: 100, saturate: 100,
      grayscale: 0, blur: 0, sepia: 0, hueRotate: 0, invert: 0,
      focalX: 50, focalY: 50,
      // Crop CSS (fallback quando canvas destrutivo é bloqueado por CORS).
      cropX: 0, cropY: 0, cropW: 0, cropH: 0,
      // Dimensões finais (px) — definidas pelos handles de resize do canvas.
      // Vazio = tamanho natural. Quando há crop CSS, escalam o wrapper.
      width: '', height: '',
    },
    classes: ['img-fluid'],
    attrs: {},
  };
  static allowedChildren = null;

  static render(node) {
    const tr = computeTransform(node.props);
    const fi = computeFilter(node.props);
    const fx = Number(node.props.focalX);
    const fy = Number(node.props.focalY);

    const img = document.createElement('img');
    img.src = safeUrl(node.props.src, '');
    img.alt = node.props.alt ?? '';
    if ((Number.isFinite(fx) && fx !== 50) || (Number.isFinite(fy) && fy !== 50)) {
      img.style.objectPosition = `${fx ?? 50}% ${fy ?? 50}%`;
    }

    if (!hasCssCrop(node.props)) {
      // Caso simples: <img> com transform/filter aplicados nela própria.
      if (tr) img.style.transform = tr;
      if (fi) img.style.filter = fi;
      const w = Image._dim(node.props.width);
      const h = Image._dim(node.props.height);
      if (w) img.style.width = w;
      if (h) img.style.height = h;
      return img;
    }

    // ---- Crop CSS fallback ----
    // <span class="editor-img-crop"> com `position: relative; overflow: hidden`
    // e dimensões do recorte. A <img> interna usa `position: absolute` com
    // top/left negativos — fica fora do flow, então não sofre interferência
    // de regras externas (img-fluid, flex parent, etc.).
    // Transform/filter vão no WRAPPER (não na img) — assim scale/rotate
    // afetam o conjunto inteiro sem deixar espaços em branco dentro.
    const cx = Math.max(0, Number(node.props.cropX) || 0);
    const cy = Math.max(0, Number(node.props.cropY) || 0);
    const cw = Math.max(1, Number(node.props.cropW) || 1);
    const ch = Math.max(1, Number(node.props.cropH) || 1);

    const wOverride = Image._dim(node.props.width);
    const hOverride = Image._dim(node.props.height);

    // Quando o wrapper é redimensionado, escalar a img dentro proporcionalmente.
    const finalW = wOverride ? parseFloat(wOverride) : cw;
    const finalH = hOverride ? parseFloat(hOverride) : ch;
    const scaleW = finalW / cw;
    const scaleH = finalH / ch;

    img.style.position = 'absolute';
    img.style.left = `${-cx * scaleW}px`;
    img.style.top = `${-cy * scaleH}px`;
    img.style.maxWidth = 'none';
    img.style.maxHeight = 'none';
    img.style.width = 'auto';
    img.style.height = 'auto';
    img.style.display = 'block';
    if (scaleW !== 1 || scaleH !== 1) {
      img.style.transformOrigin = '0 0';
      img.style.transform = `scale(${scaleW}, ${scaleH})`;
    }

    const wrap = document.createElement('span');
    wrap.className = 'editor-img-crop';
    // Estilos inline + classe CSS (com !important nos pontos críticos) — assim
    // mesmo com `img-fluid` aplicada ao wrapper pelo Renderer, as dimensões e
    // o overflow ficam intactos.
    wrap.style.display = 'inline-block';
    wrap.style.position = 'relative';
    wrap.style.overflow = 'hidden';
    wrap.style.verticalAlign = 'middle';
    wrap.style.width = `${finalW}px`;
    wrap.style.height = `${finalH}px`;
    if (tr) wrap.style.transform = tr;
    if (fi) wrap.style.filter = fi;

    wrap.appendChild(img);
    return wrap;
  }

  /** Normaliza dimensão (number → "Npx", string mantida; vazio → null). */
  static _dim(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return `${v}px`;
    const s = String(v).trim();
    if (!s) return null;
    return /^\d+(\.\d+)?$/.test(s) ? `${s}px` : s;
  }

  static settings(node) {
    return [
      { tab: 'content', type: 'text', label: 'URL da imagem',
        bind: { kind: 'prop', key: 'src' } },
      { tab: 'content', type: 'file', label: 'Upload',
        accept: 'image/*',
        help: 'Sem `uploadUrl` configurado, a imagem é embutida como data URL no JSON.',
        bind: { kind: 'prop', key: 'src' } },
      { tab: 'content', type: 'text', label: 'Texto alternativo (alt)',
        help: 'Acessibilidade — descreva a imagem para leitores de tela.',
        bind: { kind: 'prop', key: 'alt' } },

      { tab: 'content', type: 'action', label: 'Editar imagem…',
        icon: 'sliders',
        onClick: (n, ctx) => {
          ctx.editor.ui.imageEditor?.open(n.id);
        } },

      { tab: 'style', type: 'text', label: 'Largura (px ou auto)',
        help: 'Deixe vazio para tamanho natural. Use as alças nos cantos da imagem para redimensionar visualmente.',
        bind: { kind: 'prop', key: 'width' } },
      { tab: 'style', type: 'text', label: 'Altura (px ou auto)',
        bind: { kind: 'prop', key: 'height' } },

      { tab: 'style', type: 'toggle', label: 'Responsiva',
        toggleLabel: 'img-fluid (max-width: 100%)',
        bind: { kind: 'classToggle', class: 'img-fluid' } },
      { tab: 'style', type: 'toggle', label: 'Thumbnail',
        toggleLabel: 'img-thumbnail (borda + padding)',
        bind: { kind: 'classToggle', class: 'img-thumbnail' } },

      ...objectFitControl(),
      ...sizingControls(),
      ...borderControls(),
      ...shadowControl(),
      ...spacingControls(),
      ...advancedControls(),
    ];
  }
}
