#!/usr/bin/env node
/**
 * wysiwyg-convert — converte HTML (legado de CKEditor/TinyMCE/Quill) em
 * árvore JSON aceita pelo editor (`Editor.loadJSON(...)`).
 *
 * Uso:
 *   wysiwyg-convert html < page.html > tree.json
 *   wysiwyg-convert html --in page.html --out tree.json
 *   wysiwyg-convert markdown < post.md > tree.json
 *
 * Dependência opcional: `linkedom` (≈90kb) ou `jsdom` precisa estar instalado
 * para polyfill do DOMParser. Tente:
 *   npm i -D linkedom    # mais rápido, baixa pegada
 *   npm i -D jsdom       # mais completo
 *
 * Saída: objeto `{ type: 'root', props: {}, classes: [], attrs: {}, children: [...] }`.
 * Carregue no editor com `editor.loadJSON(tree)`.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const args = parseArgs(process.argv.slice(2));
if (args.help || !args.format) {
  printHelpAndExit();
}

await ensureDomParser();

const input = await readInput(args);
const tree = await convert(input, args.format);
const json = JSON.stringify(tree, null, args.pretty ? 2 : 0);

if (args.out) writeFileSync(args.out, json);
else process.stdout.write(json + '\n');

/* ---------- helpers ---------- */

function parseArgs(argv) {
  const out = { format: null, in: null, out: null, pretty: true, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') out.help = true;
    else if (a === '--in')   out.in  = argv[++i];
    else if (a === '--out')  out.out = argv[++i];
    else if (a === '--min')  out.pretty = false;
    else if (!out.format)    out.format = a;
  }
  return out;
}

function printHelpAndExit() {
  process.stdout.write(`wysiwyg-convert <html|markdown> [--in arquivo] [--out arquivo] [--min]

  Lê HTML/Markdown de stdin (ou --in) e escreve a árvore JSON do editor
  em stdout (ou --out).

  Exige polyfill de DOMParser — instale 'linkedom' ou 'jsdom':
    npm i -D linkedom
`);
  process.exit(args?.help ? 0 : 1);
}

async function ensureDomParser() {
  if (globalThis.DOMParser) return;
  try {
    const { parseHTML } = await import('linkedom');
    globalThis.DOMParser = class {
      parseFromString(str) { return parseHTML(str).document; }
    };
    return;
  } catch { /* tenta jsdom abaixo */ }
  try {
    const { JSDOM } = await import('jsdom');
    globalThis.DOMParser = class {
      parseFromString(str) { return new JSDOM(str).window.document; }
    };
    return;
  } catch { /* sem polyfill */ }
  process.stderr.write(
    '[wysiwyg-convert] Faltando polyfill de DOMParser. ' +
    'Instale uma das alternativas: `npm i -D linkedom` ou `npm i -D jsdom`.\n'
  );
  process.exit(2);
}

async function readInput({ in: inPath }) {
  if (inPath) return readFileSync(inPath, 'utf8');
  // stdin
  return new Promise((resolve, reject) => {
    let buf = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => buf += chunk);
    process.stdin.on('end', () => resolve(buf));
    process.stdin.on('error', reject);
  });
}

async function convert(source, format) {
  const cleaned = format === 'html' ? scrubLegacyHtml(source) : source;
  let html = cleaned;
  if (format === 'markdown') {
    const { markdownToHtml } = await import('../js/utils/markdownImport.js');
    html = markdownToHtml(source);
  }
  const { htmlToBlocks } = await import('../js/utils/htmlImport.js');
  const descriptors = htmlToBlocks(html, /* sanitizer */ null);
  return {
    type: 'root',
    props: {},
    classes: [],
    attrs: {},
    children: descriptors.map((d) => ({
      type: d.type,
      props: d.props ?? {},
      classes: d.classes ?? [],
      attrs: d.attrs ?? {},
      children: (d.children ?? []),
    })),
  };
}

/**
 * Remove sujeira comum de CKEditor / Word / Outlook que confunde o parser:
 *   - <o:p> ... </o:p>      → removido
 *   - atributos data-cke-*  → removidos
 *   - estilos mso-* (Word)  → removidos
 *   - <meta>, <link>, <style> top-level → removidos
 */
function scrubLegacyHtml(html) {
  return String(html)
    .replace(/<\/?o:p[^>]*>/gi, '')
    .replace(/\s+data-cke-[a-z0-9-]+="[^"]*"/gi, '')
    .replace(/style="[^"]*mso-[^"]*"/gi, '')
    .replace(/<meta[^>]*>/gi, '')
    .replace(/<link[^>]*>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
}
