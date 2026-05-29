/**
 * markdownImport — parser markdown minimal, zero-dep.
 *
 * Converte Markdown → HTML para ser processado por `htmlToBlocks`.
 * Cobertura v1 (suficiente para conteúdo escrito manualmente em editores tipo
 * Notion/Obsidian/StackEdit):
 *
 *   Blocos: # ## ### ... ######  →  <h1..6>
 *           > linha               →  <blockquote>
 *           -/* / 1.              →  <ul>/<ol> com <li>
 *           --- ou ***            →  <hr>
 *           ```                   →  <pre><code> (capturado como HtmlEmbed depois)
 *           ![alt](src) sozinho   →  <img>
 *           qualquer outra coisa →  <p>
 *
 *   Inline: **bold** __bold__       → <b>
 *           *italic* _italic_       → <i>
 *           `code`                  → <code>
 *           [texto](url)            → <a href>
 *           ![alt](src)             → <img>
 *           \n dentro de parágrafo  → <br>
 *
 * Limitações documentadas: sem tabelas, sem definition lists, sem footnotes,
 * sem HTML cru misturado, sem auto-link, sem reference-style links.
 */

export function markdownToHtml(md) {
  if (!md) return '';
  const lines = String(md).replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Linha vazia — separador de blocos.
    if (!line.trim()) { i++; continue; }

    // Fenced code block ```
    if (/^\s*```/.test(line)) {
      i++;
      const buf = [];
      while (i < lines.length && !/^\s*```/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // consome o ``` final
      out.push(`<pre><code>${escapeHtml(buf.join('\n'))}</code></pre>`);
      continue;
    }

    // HR — `---` / `***` / `___` (3+).
    if (/^\s*([-*_])\s*(?:\1\s*){2,}$/.test(line)) {
      out.push('<hr>');
      i++; continue;
    }

    // Heading
    const h = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (h) {
      out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
      i++; continue;
    }

    // Blockquote — junta linhas consecutivas com `>`
    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      out.push(`<blockquote>${inline(buf.join('\n'))}</blockquote>`);
      continue;
    }

    // Lista não-ordenada
    if (/^\s*[-*+]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(inline(lines[i].replace(/^\s*[-*+]\s+/, '')));
        i++;
      }
      out.push(`<ul>${items.map((t) => `<li>${t}</li>`).join('')}</ul>`);
      continue;
    }

    // Lista ordenada
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(inline(lines[i].replace(/^\s*\d+\.\s+/, '')));
        i++;
      }
      out.push(`<ol>${items.map((t) => `<li>${t}</li>`).join('')}</ol>`);
      continue;
    }

    // Imagem isolada
    const img = /^!\[(.*?)\]\(([^)]+)\)\s*$/.exec(line.trim());
    if (img) {
      out.push(`<img src="${escapeAttr(img[2])}" alt="${escapeAttr(img[1])}">`);
      i++; continue;
    }

    // Parágrafo: junta linhas seguintes não-vazias e que não começam outro bloco.
    const buf = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) {
      buf.push(lines[i]);
      i++;
    }
    out.push(`<p>${inline(buf.join('\n'))}</p>`);
  }

  return out.join('\n');
}

function isBlockStart(line) {
  return (
    /^#{1,6}\s+/.test(line) ||
    /^>\s?/.test(line) ||
    /^\s*[-*+]\s+/.test(line) ||
    /^\s*\d+\.\s+/.test(line) ||
    /^\s*([-*_])\s*(?:\1\s*){2,}$/.test(line) ||
    /^\s*```/.test(line)
  );
}

function inline(text) {
  // Escapa HTML primeiro para evitar tags maliciosas em texto plano.
  let s = escapeHtml(text);
  // Code spans (antes do resto p/ não interpretar `*` dentro de código).
  s = s.replace(/`([^`]+?)`/g, (_, x) => `<code>${x}</code>`);
  // Imagens inline
  s = s.replace(/!\[(.*?)\]\(([^)]+)\)/g,
    (_, alt, src) => `<img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}">`);
  // Links
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
    (_, txt, href) => `<a href="${escapeAttr(href)}">${txt}</a>`);
  // Bold (** ou __)
  s = s.replace(/\*\*([^*]+?)\*\*/g, '<b>$1</b>');
  s = s.replace(/__([^_]+?)__/g, '<b>$1</b>');
  // Itálico (* ou _) — depois do bold p/ não conflitar
  s = s.replace(/\*([^*\n]+?)\*/g, '<i>$1</i>');
  s = s.replace(/(?:^|[^\w])_([^_\n]+?)_(?=[^\w]|$)/g, (m, x) => m.replace(`_${x}_`, `<i>${x}</i>`));
  // Quebras de linha dentro do mesmo parágrafo
  s = s.replace(/\n/g, '<br>');
  return s;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
