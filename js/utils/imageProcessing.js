/**
 * imageProcessing — helpers puros para transformações e ajustes em imagens.
 *
 * Duas categorias:
 *
 *  • Não-destrutivos (CSS): rotate/flip/scale viram `transform`; brilho,
 *    contraste, saturação, grayscale, blur, sépia, hue-rotate, invert viram
 *    `filter`. Esses valores ficam em `node.props` e são re-aplicados pelo
 *    render do bloco Image em todo render, então persistem no JSON e
 *    aparecem no HTML exportado via `style="..."` inline.
 *
 *  • Destrutivos (canvas): crop e gama exigem repintar pixels — geram uma
 *    nova data URL via <canvas> e substituem `props.src`. Não-reversíveis
 *    a não ser via undo do histórico.
 */

/** Default das props de transformação/ajuste. Igual à imagem "neutra". */
export const IMAGE_DEFAULTS = Object.freeze({
  rotate: 0,        // graus (0/90/180/270)
  flipH: false,
  flipV: false,
  scale: 100,       // %
  brightness: 100,  // %
  contrast: 100,    // %
  saturate: 100,    // %
  grayscale: 0,     // %
  blur: 0,          // px
  sepia: 0,         // %
  hueRotate: 0,     // deg
  invert: 0,        // %
  focalX: 50,       // %
  focalY: 50,       // %
  // Crop CSS (fallback quando canvas destrutivo é bloqueado por CORS).
  // Em pixels da imagem natural — render envolve a <img> num <span> com
  // overflow:hidden e desloca a img por margin negativa.
  cropX: 0, cropY: 0, cropW: 0, cropH: 0,
});

/** True se o nó tem um recorte CSS ativo (cropW>0 e cropH>0). */
export function hasCssCrop(props = {}) {
  return (Number(props.cropW) > 0) && (Number(props.cropH) > 0);
}

/** Monta a string `transform: ...` a partir das props (vazia se neutra). */
export function computeTransform(props = {}) {
  const rotate = Number(props.rotate) || 0;
  const scale = Number(props.scale ?? 100) || 100;
  const sx = props.flipH ? -1 : 1;
  const sy = props.flipV ? -1 : 1;
  const s = (scale / 100);
  const parts = [];
  if (rotate) parts.push(`rotate(${rotate}deg)`);
  if (sx !== 1 || sy !== 1 || s !== 1) {
    parts.push(`scale(${sx * s}, ${sy * s})`);
  }
  return parts.join(' ');
}

/** Monta a string `filter: ...` a partir das props (vazia se neutra). */
export function computeFilter(props = {}) {
  const parts = [];
  const b = num(props.brightness, 100);
  if (b !== 100) parts.push(`brightness(${b}%)`);
  const c = num(props.contrast, 100);
  if (c !== 100) parts.push(`contrast(${c}%)`);
  const s = num(props.saturate, 100);
  if (s !== 100) parts.push(`saturate(${s}%)`);
  const g = num(props.grayscale, 0);
  if (g !== 0) parts.push(`grayscale(${g}%)`);
  const bl = num(props.blur, 0);
  if (bl !== 0) parts.push(`blur(${bl}px)`);
  const sp = num(props.sepia, 0);
  if (sp !== 0) parts.push(`sepia(${sp}%)`);
  const hr = num(props.hueRotate, 0);
  if (hr !== 0) parts.push(`hue-rotate(${hr}deg)`);
  const iv = num(props.invert, 0);
  if (iv !== 0) parts.push(`invert(${iv}%)`);
  return parts.join(' ');
}

function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Carrega uma imagem retornando uma Promise<HTMLImageElement>. */
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err instanceof Error ? err
      : new Error('falha ao carregar imagem (CORS? URL inválida?)'));
    img.src = src;
  });
}

/**
 * Recorta a imagem nas coordenadas dadas (em pixels da imagem original).
 * Retorna uma Promise<dataURL> (PNG, mantém transparência) ou JPEG se a
 * imagem original era JPEG (qualidade 0.92).
 *
 * Coordenadas são clampadas pra dentro da imagem; w/h mínimos 1px.
 */
export async function cropImage(src, { x, y, w, h }) {
  const img = await loadImage(src);
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const cx = clamp(Math.round(x), 0, W - 1);
  const cy = clamp(Math.round(y), 0, H - 1);
  const cw = clamp(Math.round(w), 1, W - cx);
  const ch = clamp(Math.round(h), 1, H - cy);

  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, cx, cy, cw, ch, 0, 0, cw, ch);
  return canvas.toDataURL(pickMime(src), 0.92);
}

/**
 * Aplica correção de gama destrutivamente (gama < 1 escurece, > 1 clareia).
 * Tabela de lookup (256 entradas) precalculada — barata mesmo em imagens grandes.
 */
export async function applyGamma(src, gamma) {
  const g = Math.max(0.1, Math.min(5, Number(gamma) || 1));
  if (g === 1) return src;

  const img = await loadImage(src);
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  let pixels;
  try {
    pixels = ctx.getImageData(0, 0, W, H);
  } catch (err) {
    throw new Error('imagem com restrição de CORS — não dá pra ler pixels. '
      + 'Hospede o arquivo na mesma origem ou faça upload pela biblioteca.');
  }
  const data = pixels.data;
  const lut = new Uint8ClampedArray(256);
  const inv = 1 / g;
  for (let i = 0; i < 256; i++) {
    lut[i] = Math.round(255 * Math.pow(i / 255, inv));
  }
  for (let i = 0; i < data.length; i += 4) {
    data[i]     = lut[data[i]];
    data[i + 1] = lut[data[i + 1]];
    data[i + 2] = lut[data[i + 2]];
    // alpha intocado
  }
  ctx.putImageData(pixels, 0, 0);
  return canvas.toDataURL(pickMime(src), 0.92);
}

/** Detecta jpeg pelo prefixo da URL/data URL — caso contrário PNG. */
function pickMime(src) {
  const s = String(src).toLowerCase();
  if (s.startsWith('data:image/jpeg') || /\.jpe?g(\?|#|$)/.test(s)) return 'image/jpeg';
  return 'image/png';
}

function clamp(n, lo, hi) {
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}
