/**
 * Sanitizer — wrapper sobre DOMPurify (carregado via CDN).
 *
 * Toda inserção de HTML cru no DOM (ex.: bloco "HTML embed" em fases futuras)
 * deve passar por aqui. Para conteúdo sem HTML (textContent), os blocos não
 * precisam usar este wrapper — `textContent` já é seguro nativamente.
 *
 * Política:
 *   - Se DOMPurify não estiver carregado, html() lança em vez de devolver
 *     conteúdo não tratado. É melhor falhar visivelmente do que abrir XSS.
 *   - SVG inline está desligado por padrão — pode conter `<script>`. Habilite
 *     com `new Sanitizer({ allowSvg: true })` ou passe `allowSvg: true` no
 *     `new Editor({ allowSvg: true })`.
 *
 * Customização via construtor:
 *   - `allowSvg`        : bool — destrava `<svg>` e tags filhas relacionadas.
 *   - `allowedTags`     : string[] — equivale a `ADD_TAGS` do DOMPurify.
 *   - `allowedAttrs`    : string[] — `ADD_ATTR`.
 *   - `forbiddenTags`   : string[] — adicionados ao FORBID_TAGS default.
 *   - `forbiddenAttrs`  : string[] — adicionados ao FORBID_ATTR default.
 *   - `addHooks(purify)`: function — chamada uma vez no construtor; útil para
 *      `DOMPurify.addHook('uponSanitizeElement', ...)`.
 *   - `logRemoved`      : bool — loga em console.warn cada nó descartado.
 */
const DEFAULT_FORBID_TAGS = ['script', 'style', 'object', 'embed', 'base', 'form'];
const SVG_FORBID_TAGS = ['svg', 'foreignobject', 'use', 'animate', 'animatemotion', 'animatetransform', 'set'];
const DEFAULT_FORBID_ATTR = ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onchange'];

export class Sanitizer {
  constructor(opts = {}) {
    this.opts = opts;
    this.purify = globalThis.DOMPurify ?? null;
    if (!this.purify) {
      console.warn(
        '[Sanitizer] DOMPurify não detectado em globalThis. ' +
        'Inserções de HTML cru irão lançar até que ele seja carregado.'
      );
      return;
    }
    if (typeof opts.addHooks === 'function') {
      try { opts.addHooks(this.purify); }
      catch (err) { console.warn('[Sanitizer] addHooks falhou:', err); }
    }
    if (opts.logRemoved && !this._loggerInstalled) {
      this.purify.addHook('uponSanitizeElement', (node, data) => {
        if (data?.tagName && data?.allowedTags && !data.allowedTags[data.tagName]) {
          console.warn(`[wysiwyg:sanitize] removed <${data.tagName}>`);
        }
      });
      this._loggerInstalled = true;
    }
  }

  /** Sanitiza string HTML. Retorna string segura para inserir via innerHTML. */
  html(dirty, options = {}) {
    if (!this.purify) {
      throw new Error('[Sanitizer] DOMPurify ausente — html() bloqueada por segurança.');
    }
    const o = this.opts;
    const forbidTags = [
      ...DEFAULT_FORBID_TAGS,
      ...(o.forbiddenTags || []),
      ...(o.allowSvg ? [] : SVG_FORBID_TAGS),
    ];
    const forbidAttr = [...DEFAULT_FORBID_ATTR, ...(o.forbiddenAttrs || [])];
    // Defesa em profundidade: explicita FORBID_TAGS/ATTR para o caso de o
    // usuário (ou um plugin DOMPurify) ter relaxado a config padrão.
    const merged = {
      FORBID_TAGS: forbidTags,
      FORBID_ATTR: forbidAttr,
      ...(o.allowedTags ? { ADD_TAGS: o.allowedTags } : {}),
      ...(o.allowedAttrs ? { ADD_ATTR: o.allowedAttrs } : {}),
      ...options,
    };
    return this.purify.sanitize(String(dirty ?? ''), merged);
  }

  /** Verifica se o DOMPurify está disponível. */
  isReady() {
    return this.purify !== null;
  }
}
