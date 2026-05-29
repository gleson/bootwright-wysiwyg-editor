# Django

> A referência completa continua em [`DJANGO_INTEGRATION.md`](../../DJANGO_INTEGRATION.md)
> na raiz. Este arquivo é só um delta com as novidades 1.1.0.

## Mudanças importantes

### initialJSON pode ser passado sem `|default:"null"`
O editor normaliza `null | "" | "{}" | "null" | objeto` automaticamente:

```django
{# antes #}
initialJSON: {{ pagina.conteudo_json|safe|default:"null" }},

{# 1.1.0 — funciona igual, mas estes também funcionam: #}
initialJSON: {{ pagina.conteudo_json|safe }},          {# pode vir vazio #}
initialJSON: "{{ pagina.conteudo_json|escapejs }}",    {# pode vir como string #}
```

### autoSaveKey é obrigatório
Senão o auto-save é desligado (com warning no console). Use sempre:

```js
autoSaveKey: 'editor:page:{{ pagina.pk }}',
```

Para manter o comportamento anterior (chave default compartilhada):
`autoSaveStrict: false`.

### CSRF — o atalho `csrfToken` segue funcionando
Equivale a `csrf: { header: 'X-CSRFToken', token: ... }`. Para servir o token
via cookie (ex.: `CSRF_USE_SESSIONS = False`), use:

```js
csrf: { header: 'X-CSRFToken', cookie: 'csrftoken' },
```

### Eventos DOM
Em vez de expor `window.__wysiwygEditors[id]`, escute eventos no DOM:

```js
const root = document.getElementById('editor-root');
root.addEventListener('editor:ready',  (e) => initCalculator(e.detail.editor));
root.addEventListener('editor:change', (e) => debouncedRecalc(e.detail.editor));
```

Ou leia do registry oficial:

```js
import { Editor } from '.../wysiwyg.esm.js';
const editor = Editor.instances.get('editor-root');  // id do rootElement
```

### Page edit standalone
Quando a página do editor é renderizada dentro de um `admin/base.html` com
chrome próprio (sidebar, header, breadcrumb), prefira instanciar o editor
num template **standalone** (sem `extends`) — o editor controla o viewport
inteiro (100vh) e conflita com grids do host.

### Migração de conteúdo legado de CKEditor
Use o CLI:

```bash
cd editor_wysiwyg_claude
npm i -D linkedom            # uma vez
npm run convert -- html --in legacy_page.html --out tree.json
```

O CLI já limpa `<o:p>`, `data-cke-*` e estilos `mso-*`. Carregue no editor:

```python
import json
page.conteudo_json = json.load(open('tree.json'))
page.save()
```
