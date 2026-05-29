/**
 * syntaxHighlight — destaque de sintaxe minimalista, zero-dep.
 *
 * `highlight(code, lang)` retorna HTML com `<span class="tok-…">` ao redor de
 * tokens reconhecidos. As linguagens suportadas têm um conjunto pequeno de
 * regras (comentário, string, keyword, número, builtins, tags HTML). Não é
 * um lexer real — bom o suficiente para preview de snippets na página.
 *
 * Estratégia: rodar cada regex sobre o texto cru, coletar todos os intervalos
 * `{start, end, type}`, ordenar e descartar sobreposições (primeiro match
 * vence). Depois costurar o HTML intercalando spans + texto bruto escapado.
 *
 * Linguagens cobertas v1: javascript/typescript, html/xml, css, python, bash,
 * json, sql. Demais (incluindo `plain`) → apenas escape HTML.
 */

const RULES = {
  javascript: [
    { type: 'comment', re: /\/\/[^\n]*|\/\*[\s\S]*?\*\//g },
    { type: 'string',  re: /(["'`])(?:\\.|(?!\1).)*\1/g },
    { type: 'keyword', re: /\b(?:const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|class|extends|new|this|super|typeof|instanceof|in|of|async|await|import|export|from|as|default|null|true|false|undefined|try|catch|finally|throw|delete|void)\b/g },
    { type: 'builtin', re: /\b(?:console|document|window|Math|Object|Array|String|Number|Boolean|Date|Promise|JSON|Map|Set|Symbol)\b/g },
    { type: 'number',  re: /\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/gi },
  ],
  python: [
    { type: 'comment', re: /#[^\n]*/g },
    { type: 'string',  re: /(?:"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g },
    { type: 'keyword', re: /\b(?:def|class|return|if|elif|else|for|while|in|not|and|or|None|True|False|self|lambda|with|try|except|finally|raise|pass|yield|import|from|as|global|nonlocal|assert|break|continue|is)\b/g },
    { type: 'builtin', re: /\b(?:print|len|range|list|dict|tuple|set|str|int|float|bool|type|isinstance|enumerate|zip|map|filter|open|input|abs|min|max|sum|sorted|reversed)\b/g },
    { type: 'number',  re: /\b\d+(?:\.\d+)?\b/g },
  ],
  css: [
    { type: 'comment', re: /\/\*[\s\S]*?\*\//g },
    { type: 'string',  re: /(["'])(?:\\.|(?!\1).)*\1/g },
    { type: 'keyword', re: /@(?:media|keyframes|import|font-face|supports|charset|page)\b/g },
    { type: 'property', re: /^[ \t]*([a-z-]+)\s*:/gm },
    { type: 'number',  re: /\b\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|ms|s|deg|fr)?\b/g },
  ],
  html: [
    { type: 'comment', re: /<!--[\s\S]*?-->/g },
    { type: 'tag',     re: /<\/?[a-z][\w-]*/gi },
    { type: 'string',  re: /(["'])(?:\\.|(?!\1).)*\1/g },
    { type: 'attr',    re: /\s([a-z-]+)(?==)/gi },
  ],
  bash: [
    { type: 'comment', re: /#[^\n]*/g },
    { type: 'string',  re: /(["'])(?:\\.|(?!\1).)*\1/g },
    { type: 'keyword', re: /\b(?:if|then|else|elif|fi|for|while|do|done|case|esac|in|function|return|export|local|readonly|source)\b/g },
    { type: 'builtin', re: /\$\{?\w+\}?|\$\(/g },
    { type: 'number',  re: /\b\d+\b/g },
  ],
  json: [
    { type: 'string',  re: /"(?:\\.|[^"\\])*"/g },
    { type: 'keyword', re: /\b(?:true|false|null)\b/g },
    { type: 'number',  re: /-?\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/gi },
  ],
  sql: [
    { type: 'comment', re: /--[^\n]*|\/\*[\s\S]*?\*\//g },
    { type: 'string',  re: /'(?:''|[^'])*'/g },
    { type: 'keyword', re: /\b(?:SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|INDEX|DROP|ALTER|JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP|ORDER|BY|HAVING|LIMIT|OFFSET|AS|AND|OR|NOT|NULL|IS|IN|LIKE|BETWEEN|DISTINCT|UNION|ALL|CASE|WHEN|THEN|ELSE|END)\b/gi },
    { type: 'number',  re: /\b\d+(?:\.\d+)?\b/g },
  ],
};
RULES.typescript = RULES.javascript;
RULES.xml = RULES.html;

export function highlight(code, lang) {
  const rules = RULES[lang];
  if (!rules || !code) return escapeHtml(code || '');

  const tokens = [];
  for (const { type, re } of rules) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(code))) {
      if (!m[0]) break; // proteção contra loop infinito
      tokens.push({ start: m.index, end: m.index + m[0].length, type });
    }
  }
  // Primeiro match vence: ordena por start; se empate, mantém o mais longo.
  tokens.sort((a, b) => a.start - b.start || b.end - a.end);
  // Descarta sobreposições.
  const out = [];
  let cursor = 0;
  for (const tok of tokens) {
    if (tok.start < cursor) continue;
    out.push(tok);
    cursor = tok.end;
  }

  let html = '';
  let pos = 0;
  for (const tok of out) {
    if (tok.start > pos) html += escapeHtml(code.slice(pos, tok.start));
    html += `<span class="tok-${tok.type}">${escapeHtml(code.slice(tok.start, tok.end))}</span>`;
    pos = tok.end;
  }
  if (pos < code.length) html += escapeHtml(code.slice(pos));
  return html;
}

export function listLanguages() {
  return Object.keys(RULES).sort().concat(['plain']);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
