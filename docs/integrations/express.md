# Express / Node

Sem CSRF embutido — use `csurf` ou `cookie-parser` + token manual.

```js
// server.js
import express from 'express';
import multer from 'multer';
import cookieParser from 'cookie-parser';
import csrf from 'csurf';

const app = express();
const upload = multer({ dest: 'uploads/' });
app.use(cookieParser());
app.use(csrf({ cookie: true }));

app.get('/edit', (req, res) => {
  res.render('edit', { csrfToken: req.csrfToken(), page: getPage() });
});

app.post('/upload', upload.single('file'), (req, res) => {
  // valide req.file.mimetype antes de aceitar
  res.json({ url: `/uploads/${req.file.filename}`, name: req.file.originalname });
});

app.post('/save/:id', express.json({ limit: '5mb' }), (req, res) => {
  savePage(req.params.id, req.body);
  res.json({ ok: true });
});
```

## EJS — instanciar

```html
<div id="editor-root" class="editor-shell"></div>
<script src="/static/purify.min.js"></script>
<script src="/static/bootstrap.bundle.min.js"></script>
<script type="module">
  import { Editor } from '/static/wysiwyg/wysiwyg.esm.js';

  new Editor({
    rootElement: document.getElementById('editor-root'),
    initialJSON: <%- JSON.stringify(page.content) %>,
    disableDjangoBlocks: true,
    autoSaveKey: 'editor:page:<%= page.id %>',
    csrf: { header: 'CSRF-Token', token: '<%= csrfToken %>' },
    uploadUrl: '/upload',
    saveUrl:   `/save/<%= page.id %>`,
  }).init();
</script>
```
