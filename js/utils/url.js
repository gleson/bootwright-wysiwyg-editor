/**
 * url — saneamento de URLs e CSS inline fornecidos pelo usuário.
 *
 * Por que existe: vários blocos (Button, Card, Image, Video, Audio) recebem
 * URLs em campos de texto livre e as colocam direto numa propriedade DOM
 * (`a.href`, `img.src`, …). Esse caminho NÃO passa pelo DOMPurify — o
 * `Sanitizer` só age sobre strings de HTML cru. Sem validação de esquema, um
 * `javascript:` digitado num href executaria ao clique e, pior, sobreviveria ao
 * `exportHTML()` (que serializa via `outerHTML`), indo parar no HTML final.
 */

// Esquemas com navegação/ação inofensiva. `javascript:`, `vbscript:`, `data:`
// (exceto imagem) e quaisquer outros ficam de fora.
const SAFE_SCHEME = /^(?:https?|mailto|tel|sms|ftp):/i;

// Caracteres de controle + espaços: o parser de URL do browser os ignora, mas
// permitem ofuscar o esquema (ex.: "java\tscript:alert(1)"). Removidos só para
// a checagem do esquema — a string original é a que retornamos.
const URL_NOISE = /[\x00-\x20\x7f-\x9f]+/g;

/**
 * Devolve `raw` se a URL for segura, ou `fallback` caso contrário.
 * Aceita: http(s), mailto, tel, sms, ftp, âncoras (#…), querystrings,
 * caminhos relativos/absolutos (sem esquema) e `data:image/*`.
 *
 * @param {*} raw       valor digitado pelo usuário
 * @param {string} fallback valor seguro quando `raw` é rejeitado (default '#';
 *                          use '' em contexto de `src`)
 */
export function safeUrl(raw, fallback = '#') {
  if (raw == null) return fallback;
  const str = String(raw).trim();
  if (!str) return fallback;

  const probe = str.replace(URL_NOISE, '');

  // data: só é permitido para imagens (data:image/...).
  if (/^data:/i.test(probe)) {
    return /^data:image\//i.test(probe) ? str : fallback;
  }

  // Tem esquema explícito ("algo:")? Então precisa estar na allowlist.
  if (/^[a-z][a-z0-9+.-]*:/i.test(probe)) {
    return SAFE_SCHEME.test(probe) ? str : fallback;
  }

  // Sem esquema → relativo / âncora / querystring → seguro.
  return str;
}

/**
 * Define `target` e o `rel` correspondente num `<a>`. Para `_blank`, força
 * `rel="noopener noreferrer"` — sem isso a página de destino ganha acesso a
 * `window.opener` (reverse tabnabbing). `target` vazio = mesma janela (no-op).
 */
export function applyLinkTarget(a, target) {
  if (!target) return;
  a.target = target;
  if (target === '_blank') a.rel = 'noopener noreferrer';
}

// Construtos executáveis dentro de CSS inline. Não bloqueamos `url(...)` em
// geral — carregar imagens externas é função legítima de um page builder —,
// só os vetores que levam a execução de código (legados de IE/Gecko) e o
// `@import`/`javascript:` que escapariam do propósito de "estilo".
const CSS_DANGER = /(?:expression\s*\(|javascript\s*:|vbscript\s*:|-moz-binding|behavio(?:u)?r\s*:|@import)/gi;

/** Remove construtos executáveis de uma string de CSS inline. */
export function safeCss(raw) {
  if (raw == null) return '';
  return String(raw).replace(CSS_DANGER, '');
}
