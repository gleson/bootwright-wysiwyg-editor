/**
 * build.mjs — bundle de produção do Editor WYSIWYG (esbuild).
 *
 * Gera, em `dist/`:
 *   wysiwyg.esm.js   — bundle ES module; `import { Editor } from '.../wysiwyg.esm.js'`
 *   wysiwyg.iife.js  — bundle IIFE; expõe `window.WysiwygEditor.Editor` (uso sem <script type="module">)
 *   wysiwyg.css      — CSS do chrome do editor, minificado
 *   *.map            — sourcemaps (sempre gerados; em prod basta não publicá-los)
 *
 * DOMPurify e o JS do Bootstrap NÃO são empacotados: o editor os consome via
 * `globalThis` (ver Sanitizer.js). Continuam sendo carregados à parte — CDN no
 * dev, `static/wysiwyg/vendor/` em produção (ver README).
 *
 * Uso:
 *   node build.mjs            build de produção (minificado)
 *   node build.mjs --dev      build sem minificar (debug)
 *   node build.mjs --watch    rebuild ao salvar (implica --dev)
 */
import * as esbuild from 'esbuild';
import { rmSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';

const watch = process.argv.includes('--watch');
const dev = watch || process.argv.includes('--dev');
const minify = !dev;

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });

/** Config comum aos dois bundles JS. */
const common = {
  entryPoints: ['js/core/Editor.js'],
  bundle: true,
  minify,
  sourcemap: true,
  target: ['es2020'],
  charset: 'utf8',
  legalComments: 'none',
  logLevel: 'info',
  // DOMPurify é lido de globalThis em runtime — nada a marcar como external
  // (não há `import` dele no código-fonte).
};

const builds = [
  // ESM — para integração via <script type="module"> (caso recomendado no README).
  {
    ...common,
    format: 'esm',
    outfile: 'dist/wysiwyg.esm.js',
  },
  // IIFE — para páginas que não usam módulos ES; cria window.WysiwygEditor.
  {
    ...common,
    format: 'iife',
    globalName: 'WysiwygEditor',
    outfile: 'dist/wysiwyg.iife.js',
  },
  // CSS — minificado, copiado para dist com o mesmo basename.
  {
    entryPoints: ['css/style.css'],
    bundle: true,
    minify,
    sourcemap: true,
    outfile: 'dist/wysiwyg.css',
    loader: { '.woff': 'file', '.woff2': 'file', '.ttf': 'file' },
    logLevel: 'info',
  },
  // Runtime de animações on-scroll para a PÁGINA PUBLICADA (Django) — pequeno,
  // independente do bundle do editor. IIFE para uso com <script> simples.
  {
    entryPoints: ['js/runtime/scroll-animate.auto.js'],
    bundle: true,
    minify,
    sourcemap: true,
    format: 'iife',
    target: ['es2020'],
    outfile: 'dist/scroll-animate.js',
    logLevel: 'info',
  },
  // CSS das animações on-scroll — para incluir na página publicada sem o
  // peso do CSS do chrome do editor.
  {
    entryPoints: ['css/scroll-animate.css'],
    bundle: true,
    minify,
    sourcemap: true,
    outfile: 'dist/scroll-animate.css',
    logLevel: 'info',
  },
];

if (watch) {
  for (const cfg of builds) {
    const ctx = await esbuild.context(cfg);
    await ctx.watch();
  }
  console.log('[build] watch ativo — Ctrl+C para sair.');
} else {
  await Promise.all(builds.map((cfg) => esbuild.build(cfg)));
  // Copia tipos e schema públicos para dist/.
  for (const [src, dst] of [
    ['types/wysiwyg.d.ts',  'dist/wysiwyg.d.ts'],
    ['types/schema.v1.json', 'dist/schema.v1.json'],
  ]) {
    if (existsSync(src)) copyFileSync(src, dst);
  }
  console.log(`[build] concluído (${minify ? 'produção, minificado' : 'dev, sem minificar'}).`);
}
