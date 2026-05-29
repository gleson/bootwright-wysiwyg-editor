/**
 * googleFonts.js — utilidades para integração com Google Fonts.
 *
 * - POPULAR_FONTS: lista curada de famílias populares + categoria (para o
 *   fallback do stack CSS) + pesos comumente disponíveis.
 * - buildGoogleFontsUrl({ family, weights, italic }) → URL https
 *   (formato css2). Aceita 1+ pesos; quando `italic=true`, inclui pares
 *   ital,wght. Sem pesos => sem qualificador (a família carrega regular).
 * - parseGoogleFontsUrl(url) → array de { family, stack, googleUrl }.
 *   A `googleUrl` retornada é a URL completa fornecida (será reaproveitada
 *   na injeção). Cada family detectada vira uma entrada de fonte
 *   independente — quando o usuário cola uma URL com várias famílias.
 * - familyToStack(family, category) → string CSS com fallback adequado.
 *
 * O parser tolera URLs em formato `css?family=`, `css2?family=` e múltiplas
 * famílias coladas via `&family=`. Não toca em `&display=`/`&subset=` etc.
 */

const SERIF_FALLBACK = '"Times New Roman", Georgia, serif';
const SANS_FALLBACK  = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const MONO_FALLBACK  = 'ui-monospace, SFMono-Regular, Menlo, monospace';
const DISPLAY_FALLBACK = SANS_FALLBACK;
const HAND_FALLBACK    = 'cursive';

const FALLBACK_BY_CATEGORY = {
  serif: SERIF_FALLBACK,
  'sans-serif': SANS_FALLBACK,
  monospace: MONO_FALLBACK,
  display: DISPLAY_FALLBACK,
  handwriting: HAND_FALLBACK,
};

/** Lista curada de fontes populares do Google Fonts. */
export const POPULAR_FONTS = [
  { family: 'Inter',           category: 'sans-serif', weights: [300, 400, 500, 600, 700, 800] },
  { family: 'Roboto',          category: 'sans-serif', weights: [100, 300, 400, 500, 700, 900] },
  { family: 'Open Sans',       category: 'sans-serif', weights: [300, 400, 500, 600, 700, 800] },
  { family: 'Lato',            category: 'sans-serif', weights: [100, 300, 400, 700, 900] },
  { family: 'Montserrat',      category: 'sans-serif', weights: [100, 300, 400, 500, 600, 700, 800, 900] },
  { family: 'Poppins',         category: 'sans-serif', weights: [100, 300, 400, 500, 600, 700, 800, 900] },
  { family: 'Source Sans 3',   category: 'sans-serif', weights: [200, 300, 400, 500, 600, 700, 800, 900] },
  { family: 'Nunito',          category: 'sans-serif', weights: [200, 300, 400, 500, 600, 700, 800, 900] },
  { family: 'Nunito Sans',     category: 'sans-serif', weights: [200, 300, 400, 600, 700, 800, 900] },
  { family: 'Raleway',         category: 'sans-serif', weights: [100, 300, 400, 500, 600, 700, 800, 900] },
  { family: 'Work Sans',       category: 'sans-serif', weights: [100, 300, 400, 500, 600, 700, 800, 900] },
  { family: 'Rubik',           category: 'sans-serif', weights: [300, 400, 500, 600, 700, 800, 900] },
  { family: 'DM Sans',         category: 'sans-serif', weights: [400, 500, 700] },
  { family: 'Mulish',          category: 'sans-serif', weights: [200, 300, 400, 500, 600, 700, 800, 900] },
  { family: 'Karla',           category: 'sans-serif', weights: [200, 300, 400, 500, 600, 700, 800] },
  { family: 'Manrope',         category: 'sans-serif', weights: [200, 300, 400, 500, 600, 700, 800] },
  { family: 'Oswald',          category: 'sans-serif', weights: [200, 300, 400, 500, 600, 700] },
  { family: 'Barlow',          category: 'sans-serif', weights: [100, 300, 400, 500, 600, 700, 800, 900] },
  { family: 'PT Sans',         category: 'sans-serif', weights: [400, 700] },
  { family: 'Quicksand',       category: 'sans-serif', weights: [300, 400, 500, 600, 700] },
  { family: 'Playfair Display',category: 'serif',      weights: [400, 500, 600, 700, 800, 900] },
  { family: 'Merriweather',    category: 'serif',      weights: [300, 400, 700, 900] },
  { family: 'Lora',            category: 'serif',      weights: [400, 500, 600, 700] },
  { family: 'PT Serif',        category: 'serif',      weights: [400, 700] },
  { family: 'Bitter',          category: 'serif',      weights: [100, 300, 400, 500, 600, 700, 800, 900] },
  { family: 'Crimson Text',    category: 'serif',      weights: [400, 600, 700] },
  { family: 'EB Garamond',     category: 'serif',      weights: [400, 500, 600, 700, 800] },
  { family: 'JetBrains Mono',  category: 'monospace',  weights: [100, 200, 300, 400, 500, 600, 700, 800] },
  { family: 'Fira Code',       category: 'monospace',  weights: [300, 400, 500, 600, 700] },
  { family: 'Source Code Pro', category: 'monospace',  weights: [200, 300, 400, 500, 600, 700, 800, 900] },
  { family: 'Pacifico',        category: 'handwriting', weights: [400] },
  { family: 'Dancing Script',  category: 'handwriting', weights: [400, 500, 600, 700] },
];

/** family + category → CSS stack (com fallback adequado). */
export function familyToStack(family, category = 'sans-serif') {
  const fb = FALLBACK_BY_CATEGORY[category] || SANS_FALLBACK;
  return `"${family}", ${fb}`;
}

/** Pequeno lookup para devolver categoria curada (se houver) por family name. */
export function categoryFor(family) {
  const hit = POPULAR_FONTS.find((f) => f.family.toLowerCase() === String(family).toLowerCase());
  return hit?.category ?? 'sans-serif';
}

/**
 * Monta uma URL https://fonts.googleapis.com/css2?family=...
 *
 * @param {object} opts
 * @param {string} opts.family   — nome da família (ex.: 'Open Sans')
 * @param {number[]} [opts.weights=[400]] — lista de pesos (ex.: [400,700])
 * @param {boolean} [opts.italic=false]   — incluir variantes itálicas
 * @returns {string} URL completa, com display=swap.
 */
export function buildGoogleFontsUrl({ family, weights = [400], italic = false } = {}) {
  if (!family) throw new Error('[googleFonts] family é obrigatório');
  const fam = String(family).trim().replace(/\s+/g, '+');
  const sorted = [...new Set(weights.map((w) => Number(w)).filter(Boolean))].sort((a, b) => a - b);
  let qualifier = '';
  if (italic && sorted.length) {
    // ital,wght@0,400;0,700;1,400;1,700
    const pairs = [];
    for (const w of sorted) pairs.push(`0,${w}`);
    for (const w of sorted) pairs.push(`1,${w}`);
    qualifier = `:ital,wght@${pairs.join(';')}`;
  } else if (sorted.length === 1 && sorted[0] === 400) {
    qualifier = '';
  } else if (sorted.length) {
    qualifier = `:wght@${sorted.join(';')}`;
  }
  return `https://fonts.googleapis.com/css2?family=${fam}${qualifier}&display=swap`;
}

/**
 * Decodifica uma "family token" do Google Fonts (parte depois de `family=`,
 * antes de qualquer `&`) → nome da família legível.
 * Ex.: 'Open+Sans:wght@400;700' → 'Open Sans'
 */
function decodeFamilyToken(token) {
  // Remove qualifier após ':'
  const head = token.split(':')[0] || '';
  // Substitui + por espaço e decodeURIComponent p/ acentos.
  let s = head.replace(/\+/g, ' ');
  try { s = decodeURIComponent(s); } catch { /* deixa raw */ }
  return s.trim();
}

/**
 * Parse de URL do Google Fonts.
 *
 * Aceita formatos:
 *   - https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap
 *   - https://fonts.googleapis.com/css?family=Open+Sans:400,700&display=swap
 *   - múltiplas famílias via &family=...
 *
 * @param {string} url
 * @returns {{ family: string, stack: string, googleUrl: string }[]}
 */
export function parseGoogleFontsUrl(url) {
  const s = String(url ?? '').trim();
  if (!s) return [];
  if (!/^https?:\/\/fonts\.googleapis\.com\//i.test(s)) return [];

  // Extrai todos `family=...` (cada um pode conter múltiplas families
  // separadas por `|` no formato css legado).
  const families = [];
  const re = /[?&]family=([^&]+)/gi;
  let m;
  while ((m = re.exec(s)) !== null) {
    const raw = m[1] || '';
    // Formato css1 antigo permite "Open+Sans|Roboto" (pipe).
    for (const tok of raw.split('|')) {
      const fam = decodeFamilyToken(tok);
      if (fam) families.push(fam);
    }
  }
  if (!families.length) return [];

  const seen = new Set();
  const out = [];
  for (const family of families) {
    const key = family.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      family,
      stack: familyToStack(family, categoryFor(family)),
      googleUrl: s,
    });
  }
  return out;
}
