/**
 * i18n — tradução da UI do editor.
 *
 * Uso:
 *   import { t, setLocale, getLocale, listLocales, onLocaleChange } from './i18n/index.js';
 *   t('topbar.save')                       → "Salvar"
 *   t('sidebar.fav.added', { name: 'X' })   → '"X" adicionado aos favoritos.'
 *
 * O idioma é persistido em localStorage. Chaves ausentes no catálogo ativo
 * caem para pt-BR e, em último caso, retornam a própria chave (facilita achar
 * strings não traduzidas).
 */
import { ptBR } from './pt-BR.js';
import { en } from './en.js';

const CATALOGS = {
  'pt-BR': ptBR,
  'en': en,
};
const DEFAULT_LOCALE = 'pt-BR';
const STORAGE_KEY = 'editor:locale';

let current = DEFAULT_LOCALE;
let catalog = CATALOGS[current];
const listeners = new Set();

// Restaura idioma salvo.
try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && CATALOGS[saved]) {
    current = saved;
    catalog = CATALOGS[saved];
  }
} catch { /* localStorage indisponível — segue com o padrão */ }

/** Traduz `key`, interpolando `{param}` com `params`. */
export function t(key, params) {
  let str = catalog[key] ?? CATALOGS[DEFAULT_LOCALE][key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.split(`{${k}}`).join(String(v));
    }
  }
  return str;
}

export function getLocale() {
  return current;
}

/** Lista [{ code, name }] dos idiomas disponíveis. */
export function listLocales() {
  return Object.keys(CATALOGS).map((code) => ({
    code,
    name: CATALOGS[code]['locale.name'] ?? code,
  }));
}

/** Troca o idioma ativo, persiste e notifica os listeners. */
export function setLocale(locale) {
  if (!CATALOGS[locale] || locale === current) return false;
  current = locale;
  catalog = CATALOGS[locale];
  try { localStorage.setItem(STORAGE_KEY, locale); } catch { /* ignore */ }
  for (const fn of listeners) {
    try { fn(locale); } catch (err) { console.warn('[i18n] listener falhou:', err); }
  }
  return true;
}

/** Registra callback chamado quando o idioma muda. Retorna função de unsubscribe. */
export function onLocaleChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Registra (ou substitui) um catálogo de strings. Mescla com pt-BR para
 * cobrir chaves ausentes (mantém fallback consistente). Útil para adicionar
 * idiomas novos (es, fr, de) sem fork do bundle.
 *
 *   import { registerLocale, setLocale } from '.../i18n/index.js';
 *   registerLocale('es', { 'topbar.save': 'Guardar', ... });
 *   setLocale('es');
 */
export function registerLocale(code, strings) {
  if (!code || typeof strings !== 'object') return false;
  // Herda o catálogo padrão para evitar buracos. O usuário pode sobrescrever
  // apenas as chaves que precisar.
  CATALOGS[code] = { ...CATALOGS[DEFAULT_LOCALE], ...strings };
  if (code === current) catalog = CATALOGS[code];
  return true;
}
