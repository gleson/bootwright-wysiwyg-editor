/**
 * htmlFormat — pretty-printer de HTML conservador, para EXIBIÇÃO no modo de
 * edição de código-fonte. Indenta apenas elementos de bloco; runs de conteúdo
 * inline ficam numa única linha. O conteúdo de `pre`/`code`/`textarea`/`script`/
 * `style` é preservado verbatim (nunca reflowado), pois ali o espaço é
 * significativo.
 *
 * É puramente estético: o whitespace que ele adiciona é insignificante para o
 * HTML, então `formatHTML(html)` e `html` produzem a mesma árvore ao reimportar
 * via DOMParser. Não use para comparação textual de igualdade.
 */

// Elementos tratados como inline — não ganham quebra/indentação própria.
const INLINE = new Set([
  'a', 'abbr', 'b', 'bdi', 'bdo', 'br', 'cite', 'code', 'data', 'dfn', 'em',
  'i', 'kbd', 'mark', 'q', 'rp', 'rt', 'ruby', 's', 'samp', 'small', 'span',
  'strong', 'sub', 'sup', 'time', 'u', 'var', 'wbr', 'img', 'picture', 'svg',
  'button', 'input', 'select', 'label', 'textarea', 'output',
]);

// Conteúdo preservado verbatim (espaço significativo / não-HTML).
const PRESERVE = new Set(['pre', 'code', 'textarea', 'script', 'style']);

// Tags vazias (sem fechamento).
const VOID = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
  'param', 'source', 'track', 'wbr',
]);

/** Formata uma string HTML com indentação. */
export function formatHTML(html, { indent = '  ' } = {}) {
  const doc = new DOMParser().parseFromString(String(html ?? ''), 'text/html');
  const out = [];
  for (const child of doc.body.childNodes) serializeNode(child, 0, out, indent);
  return out.join('').replace(/\n+$/, '') + (out.length ? '\n' : '');
}

function serializeNode(node, depth, out, indent) {
  const pad = indent.repeat(depth);

  // Texto: colapsa whitespace; ignora nós só de espaço entre blocos.
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent.replace(/\s+/g, ' ').trim();
    if (text) out.push(pad + escapeText(text) + '\n');
    return;
  }
  // Comentários.
  if (node.nodeType === Node.COMMENT_NODE) {
    out.push(`${pad}<!--${node.textContent}-->\n`);
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const tag = node.tagName.toLowerCase();

  if (PRESERVE.has(tag)) { out.push(pad + node.outerHTML + '\n'); return; }
  if (VOID.has(tag))     { out.push(pad + openTag(node) + '\n'); return; }

  if (!hasBlockChildren(node)) {
    // Conteúdo só inline/texto → tudo numa linha.
    const inner = collapseInline(node.innerHTML);
    out.push(`${pad}${openTag(node)}${inner}</${tag}>\n`);
    return;
  }

  // Filhos de bloco → abre, recursa indentado, fecha.
  out.push(pad + openTag(node) + '\n');
  for (const child of node.childNodes) serializeNode(child, depth + 1, out, indent);
  out.push(pad + `</${tag}>\n`);
}

/** Há pelo menos um filho-elemento de bloco (que merece linha própria)? */
function hasBlockChildren(el) {
  for (const child of el.childNodes) {
    if (child.nodeType === Node.ELEMENT_NODE && !INLINE.has(child.tagName.toLowerCase())) {
      return true;
    }
  }
  return false;
}

/** Reconstrói a tag de abertura com seus atributos. */
function openTag(el) {
  let s = '<' + el.tagName.toLowerCase();
  for (const { name, value } of el.attributes) {
    s += value === '' ? ` ${name}` : ` ${name}="${escapeAttr(value)}"`;
  }
  return s + '>';
}

/** Colapsa runs de whitespace de uma string de HTML inline para uma linha. */
function collapseInline(htmlStr) {
  return String(htmlStr).replace(/\s+/g, ' ').trim();
}

function escapeAttr(v) {
  return String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function escapeText(v) {
  return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
