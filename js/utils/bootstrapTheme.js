/**
 * bootstrapTheme — gera CSS que sobrescreve as cores de tema do Bootstrap 5.3
 * (primary, secondary, success, …) a partir de um mapa de cores escolhido pelo
 * usuário, sem recompilar o SCSS.
 *
 * Estratégia: o Bootstrap 5.3 expõe a maioria das cores como CSS custom
 * properties em `:root` — `--bs-primary`, `--bs-primary-rgb`,
 * `--bs-primary-text-emphasis`, `--bs-primary-bg-subtle`,
 * `--bs-primary-border-subtle`. Sobrescrevendo essas variáveis, quase todos os
 * utilitários (`.bg-*`, `.text-*`, `.border-*`, `.link-*`, `.text-*-emphasis`,
 * `.bg-*-subtle`) e componentes que as consomem (`.alert-*`, `.list-group-item-*`)
 * passam a usar a cor nova automaticamente.
 *
 * As exceções são os BOTÕES (`.btn-*`/`.btn-outline-*`), que o Bootstrap compila
 * com hex literais em variáveis locais (`--bs-btn-bg`, etc.), e o texto de
 * `.text-bg-*` (cor de contraste fixa). Para esses geramos as regras
 * explicitamente, calculando matizes de hover/active e a cor de contraste.
 *
 * O CSS resultante deve ser incluído DEPOIS do CSS do Bootstrap.
 */

/** Cores de tema padrão do Bootstrap 5.3.3 — base do formulário e do reset. */
export const DEFAULT_THEME = {
  primary:   '#0d6efd',
  secondary: '#6c757d',
  success:   '#198754',
  danger:    '#dc3545',
  warning:   '#ffc107',
  info:      '#0dcaf0',
  light:     '#f8f9fa',
  dark:      '#212529',
};

/** Ordem/rótulos exibidos na UI. */
export const THEME_COLOR_KEYS = Object.keys(DEFAULT_THEME);

/* ---------- Matemática de cor ---------- */

/** '#rgb'/'#rrggbb' → [r,g,b] (0–255) ou null se inválido. */
export function hexToRgb(hex) {
  if (typeof hex !== 'string') return null;
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));

export function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('');
}

/** Escurece misturando com preto. `amount` 0–1. (Bootstrap shade-color) */
function shade(hex, amount) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return rgbToHex(rgb.map((v) => v * (1 - amount)));
}

/** Clareia misturando com branco. `amount` 0–1. (Bootstrap tint-color) */
function tint(hex, amount) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return rgbToHex(rgb.map((v) => v + (255 - v) * amount));
}

/** Luminância relativa WCAG (0–1) para decidir cor de contraste. */
function luminance([r, g, b]) {
  const lin = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Texto legível sobre `hex`: '#000' para fundos claros, '#fff' para escuros. */
function contrastText(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#fff';
  return luminance(rgb) > 0.5 ? '#000' : '#fff';
}

/* ---------- Geração de CSS ---------- */

/** Regras de um `.btn-{c}` sólido (espelha o mixin button-variant do Bootstrap). */
function solidButtonCss(name, hex) {
  const color = contrastText(hex);
  const lightBg = color === '#000';
  // Botões de fundo claro clareiam no hover; de fundo escuro, escurecem.
  const mix = lightBg ? tint : shade;
  const hoverBg = mix(hex, 0.15);
  const hoverBorder = mix(hex, 0.20);
  const activeBg = mix(hex, 0.20);
  const activeBorder = mix(hex, 0.25);
  const rgb = hexToRgb(hex)?.join(',') ?? '13,110,253';
  return `.btn-${name}{` +
    `--bs-btn-color:${color};--bs-btn-bg:${hex};--bs-btn-border-color:${hex};` +
    `--bs-btn-hover-color:${color};--bs-btn-hover-bg:${hoverBg};--bs-btn-hover-border-color:${hoverBorder};` +
    `--bs-btn-focus-shadow-rgb:${rgb};` +
    `--bs-btn-active-color:${color};--bs-btn-active-bg:${activeBg};--bs-btn-active-border-color:${activeBorder};` +
    `--bs-btn-disabled-color:${color};--bs-btn-disabled-bg:${hex};--bs-btn-disabled-border-color:${hex};` +
    `}`;
}

/** Regras de um `.btn-outline-{c}`. */
function outlineButtonCss(name, hex) {
  const hoverColor = contrastText(hex);
  const rgb = hexToRgb(hex)?.join(',') ?? '13,110,253';
  return `.btn-outline-${name}{` +
    `--bs-btn-color:${hex};--bs-btn-border-color:${hex};--bs-btn-bg:transparent;` +
    `--bs-btn-hover-color:${hoverColor};--bs-btn-hover-bg:${hex};--bs-btn-hover-border-color:${hex};` +
    `--bs-btn-focus-shadow-rgb:${rgb};` +
    `--bs-btn-active-color:${hoverColor};--bs-btn-active-bg:${hex};--bs-btn-active-border-color:${hex};` +
    `--bs-btn-disabled-color:${hex};--bs-btn-disabled-bg:transparent;--bs-btn-disabled-border-color:${hex};` +
    `}`;
}

/**
 * Gera o CSS de tema para um mapa `{ primary: '#...', ... }`. Só emite regras
 * para as chaves presentes (e válidas) — uma cor ausente mantém o default do
 * Bootstrap. Retorna '' se nada a sobrescrever.
 *
 * @param {Record<string,string>} theme
 * @param {object} [opts]
 * @param {boolean} [opts.onlyOverrides=true] emitir só cores que diferem do default
 */
export function generateThemeCss(theme, opts = {}) {
  const onlyOverrides = opts.onlyOverrides !== false;
  if (!theme || typeof theme !== 'object') return '';

  const rootLines = [];
  const blockRules = [];

  for (const key of THEME_COLOR_KEYS) {
    const hex = theme[key];
    if (!hex || !hexToRgb(hex)) continue;
    if (onlyOverrides && hex.toLowerCase() === DEFAULT_THEME[key].toLowerCase()) continue;

    const rgb = hexToRgb(hex).join(',');
    rootLines.push(
      `  --bs-${key}:${hex};`,
      `  --bs-${key}-rgb:${rgb};`,
      `  --bs-${key}-text-emphasis:${shade(hex, 0.60)};`,
      `  --bs-${key}-bg-subtle:${tint(hex, 0.80)};`,
      `  --bs-${key}-border-subtle:${tint(hex, 0.60)};`,
    );
    blockRules.push(solidButtonCss(key, hex));
    blockRules.push(outlineButtonCss(key, hex));
    // text-bg-* tem a cor de texto fixa no Bootstrap; o fundo já segue o -rgb.
    blockRules.push(`.text-bg-${key}{color:${contrastText(hex)} !important;}`);
  }

  if (!rootLines.length) return '';

  return [
    '/* Tema Bootstrap personalizado — gerado pelo editor. Inclua após o CSS do Bootstrap. */',
    ':root,[data-bs-theme=light]{',
    ...rootLines,
    '}',
    ...blockRules,
  ].join('\n');
}
