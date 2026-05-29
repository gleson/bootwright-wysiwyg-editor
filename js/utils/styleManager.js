/**
 * styleManager — manipula CSS properties dentro de uma string `style` (atributo
 * inline). Usado por controles que escrevem cores customizadas/gradientes em
 * `node.attrs.style` sem destruir outras propriedades já presentes.
 *
 * Convenções:
 *   - String vazia / undefined → trata como sem styles.
 *   - Property names case-insensitive na leitura, normalizadas para lowercase
 *     na escrita.
 *   - Valor null/undefined/'' em `writeStyleProp` → REMOVE a propriedade.
 */

/** Lê o valor de uma CSS property numa string `style`. Retorna '' se ausente. */
export function readStyleProp(styleStr, prop) {
  if (!styleStr) return '';
  const re = new RegExp(`(?:^|;)\\s*${escapeRegex(prop)}\\s*:\\s*([^;]+)`, 'i');
  const m = String(styleStr).match(re);
  return m ? m[1].trim() : '';
}

/**
 * Escreve (ou remove) uma CSS property numa string `style`. Preserva as demais
 * properties. Retorna a nova string (sem trailing `;` desnecessário).
 */
export function writeStyleProp(styleStr, prop, value) {
  const re = new RegExp(`(?:^|;)\\s*${escapeRegex(prop)}\\s*:\\s*[^;]+;?`, 'gi');
  let next = String(styleStr ?? '').replace(re, '').trim();
  // Limpa `;` órfãos, espaços, separadores múltiplos.
  next = next.replace(/;\s*;/g, ';').replace(/^;|;$/g, '').trim();
  if (value !== null && value !== undefined && value !== '') {
    next = (next ? next + '; ' : '') + `${prop}: ${value}`;
  }
  return next;
}

/** Remove uma lista de properties de uma vez (atalho). */
export function removeStyleProps(styleStr, props) {
  let s = styleStr;
  for (const p of props) s = writeStyleProp(s, p, '');
  return s;
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* ==========================================================================
   Cores: parsing/serialização para o color picker compound (custom + alpha)
   ========================================================================== */

/**
 * Tenta parsear uma string de cor para `{ hex, alpha }`.
 *   - "#rrggbb"      → alpha = 1
 *   - "#rrggbbaa"    → alpha extraído
 *   - "rgb(r,g,b)"   → alpha = 1
 *   - "rgba(r,g,b,a)" → alpha extraído
 * Retorna `null` se não conseguir parsear (ex.: vazio, gradient).
 */
export function parseColor(value) {
  if (!value || typeof value !== 'string') return null;
  const v = value.trim();

  // #rrggbb / #rgb / #rrggbbaa / #rgba
  const hex = v.match(/^#([0-9a-f]{3,8})$/i);
  if (hex) {
    let h = hex[1];
    let alpha = 1;
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    if (h.length === 4) {
      const expanded = h.split('').map((c) => c + c).join('');
      alpha = parseInt(expanded.slice(6, 8), 16) / 255;
      h = expanded.slice(0, 6);
    } else if (h.length === 8) {
      alpha = parseInt(h.slice(6, 8), 16) / 255;
      h = h.slice(0, 6);
    } else if (h.length !== 6) {
      return null;
    }
    return { hex: '#' + h.toLowerCase(), alpha: clampAlpha(alpha) };
  }

  // rgb()/rgba()
  const rgb = v.match(/^rgba?\s*\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (rgb) {
    const r = clampByte(rgb[1]);
    const g = clampByte(rgb[2]);
    const b = clampByte(rgb[3]);
    const a = rgb[4] !== undefined ? clampAlpha(parseFloat(rgb[4])) : 1;
    return { hex: rgbToHex(r, g, b), alpha: a };
  }

  return null;
}

/**
 * Serializa `{ hex, alpha }` para a representação CSS mais curta:
 *   - alpha = 1 → "#rrggbb"
 *   - alpha < 1 → "rgba(r, g, b, a)"
 */
export function serializeColor({ hex, alpha }) {
  const a = clampAlpha(alpha ?? 1);
  if (a >= 0.9995) return hex.toLowerCase();
  const m = String(hex).match(/^#([0-9a-f]{6})$/i);
  if (!m) return hex;
  const r = parseInt(m[1].slice(0, 2), 16);
  const g = parseInt(m[1].slice(2, 4), 16);
  const b = parseInt(m[1].slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${roundAlpha(a)})`;
}

function clampByte(v)  { const n = Number(v); return Math.max(0, Math.min(255, Math.round(n))); }
function clampAlpha(v) { const n = Number(v); return Math.max(0, Math.min(1, isFinite(n) ? n : 1)); }
function roundAlpha(v) { return Math.round(v * 100) / 100; }
function rgbToHex(r, g, b) {
  const h = (n) => n.toString(16).padStart(2, '0');
  return '#' + h(r) + h(g) + h(b);
}
