# Site estático (Netlify / Cloudflare Pages / GitHub Pages)

Para um site estático, não há backend para receber `save`. Você tem 2 opções:

## A) Editor offline, conteúdo em arquivo
Use o editor localmente, exporte HTML standalone, comite o resultado:

```bash
# abra index.html localmente, monte sua página no editor, e exporte:
editor.exportStandaloneHTML({ includeBootstrapJs: true })
# copie o resultado pra dist/page.html, commit, push.
```

## B) Editor servido pelo próprio site, sem save
Embuta o editor numa página privada do site (com auth do provedor — Netlify
Identity, Cloudflare Access). O conteúdo é gravado em localStorage até o
usuário clicar "Exportar".

```html
<div id="editor-root"></div>
<script src="purify.min.js"></script>
<script src="bootstrap.bundle.min.js"></script>
<script type="module">
  import { Editor } from './wysiwyg.esm.js';
  new Editor({
    rootElement: document.getElementById('editor-root'),
    autoSaveKey: 'editor:landing-page',
    disableDjangoBlocks: true,
    // sem saveUrl/uploadUrl — uploads viram data URLs (não persistem entre devices).
  }).init();
</script>
```

> Para uploads persistentes sem backend, use o widget de upload do
> provedor (ex.: Netlify Large Media) e injete a URL final via
> `transport.upload.parser`.
