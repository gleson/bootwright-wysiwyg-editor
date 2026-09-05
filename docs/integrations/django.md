# Django

Guia completo para embutir o editor WYSIWYG em projetos Django 4+ / 5.

---

## 1. O que é o editor

Editor WYSIWYG modular híbrido (estilo Gutenberg + Elementor) em **Vanilla JS (ES6+) + Bootstrap 5.3**, sem jQuery, sem framework. Projetado para ser embutido em sites Django como widget de formulário.

**Modelo mental:** a verdade é uma **árvore JSON** (`editor.exportJSON()`). O DOM é apenas uma projeção. Ao salvar, o editor serializa essa árvore; ao carregar, a reidrata.

### Arquivos do editor (distribuição)

```
editor_wysiwyg_claude/
  dist/
    wysiwyg.esm.js        # bundle ESM de produção (~352 kb)
    wysiwyg.iife.js       # bundle IIFE — expõe window.WysiwygEditor.Editor
    wysiwyg.css           # CSS do "chrome" do editor (topbar, sidebars, etc.)
    scroll-animate.js     # runtime de animações on-scroll p/ página publicada
    scroll-animate.css    # CSS das animações on-scroll p/ página publicada
  css/style.css           # mesma coisa que wysiwyg.css, mas fonte do dev
  js/                     # fontes ES modules (alternativa ao bundle em dev)
```

**Copie `dist/` para `<sua_app>/static/wysiwyg/dist/`** — é tudo que o Django precisa servir do editor. Também copie quaisquer fontes/ícones de `css/` se quiser o CSS de dev.

### Dependências externas (NÃO embutidas no bundle)

O editor consome via `globalThis` (não inclui no bundle):

| Biblioteca | Versão | Como usar em produção |
|---|---|---|
| Bootstrap CSS | 5.3.3 | `<link>` no template ou `static/wysiwyg/vendor/bootstrap.min.css` |
| Bootstrap Icons CSS | 1.11.3 | `<link>` no template ou vendor |
| Bootstrap JS bundle | 5.3.3 | `<script>` ANTES do editor (Carousel/Tabs/Accordion dependem) |
| DOMPurify | 3.1.7 | `<script>` ANTES do editor (sanitização de HTML) |

Em produção evite CDN — baixe para `static/wysiwyg/vendor/` e sirva localmente.

---

## 2. Blocos disponíveis (31 built-ins)

Organizados em categorias da sidebar:

| Categoria | Blocos |
|---|---|
| **Basic** | Section, Row, Column, Heading, Paragraph, Image, Button, List, Divider, Spacer |
| **Bootstrap** | Blockquote, HtmlEmbed |
| **Elements** | Icon, Table, Code, Audio, Video, Badge, Alert, Progress, Spinner |
| **Forms** | Form, FormInput, FormTextarea, FormSelect, FormCheckbox, FormSubmit |
| **Components** | Card, Carousel, Tabs, Accordion, Repeater |
| **Custom** | Snippets HTML criados pelo usuário + Componentes salvos |

### Blocos com integração Django nativa

- **DjangoVar** (`{{ variavel }}`) — insere uma variável de template Django no HTML exportado.
- **Repeater** — embrulha filhos em `{% for item in lista %}…{% endfor %}` via `decorateExport`. Configurável: nome da variável de item e da lista.
- **Form** + filhos — gera formulário com convenção Django (`id_<name>`, `label[for]`, classe de erro, campo CSRF).

---

## 3. Funcionalidades do editor

### Edição de conteúdo
- Drag & drop de blocos entre posições
- Multi-select (Shift+clique) com operações em lote
- Undo/Redo ilimitado (Ctrl+Z / Ctrl+Shift+Z)
- Inline edit por duplo-clique
- Rich text inline (negrito, itálico, links, etc.) com toolbar flutuante
- Atalhos Markdown de bloco (`# `, `- `, `> `, etc.)
- Atalhos Markdown inline (`**bold**`, `_italic_`, `[link](url)`)
- Slash menu `/` para inserção rápida durante edição inline
- Command palette `Ctrl+K`
- Find & Replace `Ctrl+F` com highlight via CSS Custom Highlight API
- Importar HTML ou Markdown
- Bloco Code com syntax highlight zero-dependência
- Editor avançado de painéis ricos (Tabs/Accordion/Carousel) via mini-editor em modal

### Visual / Animações
- Visualização responsiva (desktop/tablet/mobile) — classes `d-none d-md-block`
- Animações on-scroll (`data-animate`, `data-animate-duration`, `data-animate-delay`)
- Parallax (`data-parallax="0.2"`)
- Scroll-linked timeline (`data-scroll-link="1"`)
- Google Fonts com preview ao vivo
- Editor de imagem (alinhamento, transform, ajustes, crop, focal point)
- Resize handles nas imagens

### Organização e produção
- Painel SEO (title, description, canonical, OG image, OG type, robots)
- Comentários de revisão por bloco (não vão para o HTML exportado)
- Block locking (impede edição acidental)
- Templates de bloco e de página reutilizáveis (built-ins + criados pelo usuário)
- Snippets HTML personalizados
- Componentes reutilizáveis sincronizados
- Personalização de tema: paleta de cores, gradientes, fontes, CSS custom
- Export/Import de customizações (JSON)
- Export HTML standalone (com Bootstrap via CDN)
- Biblioteca de assets (grid de mídias já enviadas, persiste no localStorage)
- Auditoria WCAG (erros + contraste de cor)
- Auto-save em `localStorage` (debounce 2s)

### Colaboração (opcional)
- WebSocket com broadcast + last-write-wins (LWW)
- Indicador de presença de outros usuários na topbar
- Protocolo documentado em `server/README.md` para implementar com Django Channels

### i18n
- Português (pt-BR) e English (en)
- Arquivo de strings em `js/i18n/pt-BR.js` e `js/i18n/en.js`

---

## 4. API pública do editor (construtor)

```js
import { Editor } from "{% static 'wysiwyg/dist/wysiwyg.esm.js' %}";

const editor = new Editor({
  // OBRIGATÓRIO
  rootElement: document.getElementById('meu-editor'),  // HTMLElement

  // PERSISTÊNCIA
  targetField:  document.getElementById('conteudo_json'),  // <input hidden> — preenche no save()
  saveUrl:      "{% url 'wysiwyg:save' slug=pagina.slug %}",   // POST JSON — alternativa ao targetField
  csrfToken:    '{{ csrf_token }}',

  // UPLOAD DE MÍDIA
  uploadUrl:    "{% url 'wysiwyg:upload' %}",   // POST multipart → { url: '...' }
  assetsUrl:    "{% url 'wysiwyg:assets' %}",   // GET → [{ url, name?, kind? }]

  // CONTEÚDO INICIAL — aceita null, "", "{}", string-encoded ou objeto.
  // NUNCA interpole o JSON direto no <script> (ver "Passando o conteúdo
  // inicial" abaixo): use json_script + JSON.parse.
  initialJSON:  JSON.parse(document.getElementById('conteudo-json').textContent),

  // AUTO-SAVE — autoSaveKey é OBRIGATÓRIO (chaves genéricas cruzam rascunhos
  // entre páginas diferentes). Sem ele o auto-save é desligado com warning.
  autoSave:         true,        // padrão: true
  autoSaveKey:      'editor:autosave:{{ pagina.pk }}',  // namespace único por página
  autoSaveDebounce: 2000,        // ms — padrão: 2000
  // autoSaveStrict: false,      // descomenta para aceitar chave compartilhada (legado)

  // COLABORAÇÃO (opcional — requer Django Channels)
  collabUrl:    'wss://{{ request.get_host }}/ws/wysiwyg/{{ pagina.pk }}/',
  collabName:   '{{ request.user.get_full_name }}',

  // CALLBACK CUSTOM (alternativa a saveUrl)
  onSave: async (json) => { /* POST manual */ },
}).init();
```

Para servir o CSRF via cookie em vez de string hardcoded (ex.: `CSRF_USE_SESSIONS = False`):

```js
csrf: { header: 'X-CSRFToken', cookie: 'csrftoken' },
// equivalente a: csrfToken: getCookie('csrftoken')
```

### Métodos públicos relevantes

```js
editor.exportJSON()           // → objeto JS da árvore (para salvar no banco)
editor.exportHTML()           // → string HTML limpo (para renderizar no site público)
editor.exportStandaloneHTML() // → documento HTML completo com Bootstrap via CDN
editor.exportSeoHead()        // → string de tags <meta>/<title> para o <head>
editor.exportFontLinks()      // → string de <link> para Google Fonts
editor.getSeo()               // → { title, description, canonical, ogImage, ogType, robots }
editor.save()                 // aciona o fluxo de save (escreve targetField + POST)
editor.loadJSON(data)         // carrega árvore (substitui o estado atual)
```

### Eventos DOM e acesso à instância

Em vez de ler `window.__wysiwygEditors`, escute eventos no elemento raiz:

```js
const root = document.getElementById('editor-root');
root.addEventListener('editor:ready',  (e) => inicializarCalculadora(e.detail.editor));
root.addEventListener('editor:change', (e) => debouncedRecalc(e.detail.editor));
```

Ou leia do registry global (útil em módulos externos):

```js
import { Editor } from '...wysiwyg.esm.js';
const editor = Editor.instances.get('editor-root');  // id do rootElement
```

---

## 5. Endpoints Django necessários

### 5.1 Save — `POST /wysiwyg/save/<slug>/`

Recebe o JSON da árvore e persiste no banco.

**Request:**
```
Content-Type: application/json
X-CSRFToken: <token>

{ "type": "root", "props": { "seo": {...}, "comments": {...} }, "children": [...] }
```

**Response:**
```json
{ "ok": true }
```

**View de referência:**
```python
import json
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.contrib.auth.decorators import login_required
from .models import Pagina

@login_required
@require_POST
def wysiwyg_save(request, slug):
    pagina = get_object_or_404(Pagina, slug=slug)
    data = json.loads(request.body)
    pagina.conteudo_json = data  # JSONField
    pagina.save(update_fields=['conteudo_json'])
    return JsonResponse({'ok': True})
```

> **Alternativa via form HTML:** configure apenas `targetField` no editor (sem `saveUrl`). O `<input type="hidden">` será preenchido com o JSON serializado antes do submit do form.

---

### 5.2 Upload de mídia — `POST /wysiwyg/upload/`

Recebe um arquivo multipart e retorna a URL pública.

**Request:**
```
Content-Type: multipart/form-data
X-CSRFToken: <token>

file: <arquivo>
```

**Response (sucesso):**
```json
{ "url": "/media/wysiwyg/imagens/foto.jpg" }
```

**Response (erro):**
```json
{ "error": "mensagem" }
```

**View de referência:**
```python
import os
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.contrib.auth.decorators import login_required
from django.core.files.storage import default_storage

@login_required
@require_POST
def wysiwyg_upload(request):
    f = request.FILES.get('file')
    if not f:
        return JsonResponse({'error': 'Nenhum arquivo enviado.'}, status=400)
    # Valide tipo e tamanho aqui (segurança)
    allowed_types = ['image/jpeg', 'image/png', 'image/gif', 'image/webp',
                     'image/svg+xml', 'video/mp4', 'audio/mpeg', 'audio/ogg']
    if f.content_type not in allowed_types:
        return JsonResponse({'error': 'Tipo de arquivo não permitido.'}, status=400)
    path = default_storage.save(f'wysiwyg/uploads/{f.name}', f)
    url = default_storage.url(path)
    return JsonResponse({'url': url})
```

---

### 5.3 Lista de assets — `GET /wysiwyg/assets/`

Retorna os arquivos já hospedados para o grid da biblioteca de assets.

**Response (qualquer um dos formatos abaixo é aceito):**
```json
["/media/wysiwyg/foto.jpg", "/media/wysiwyg/logo.png"]

// ou
{ "results": [{ "url": "...", "name": "foto.jpg", "kind": "image" }] }

// ou
{ "assets": [...] }
```

`kind` aceita: `"image"` | `"video"` | `"audio"`.

**View de referência:**
```python
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required

@login_required
def wysiwyg_assets(request):
    from django.core.files.storage import default_storage
    _, files = default_storage.listdir('wysiwyg/uploads')
    assets = [{'url': default_storage.url(f'wysiwyg/uploads/{f}'), 'name': f}
              for f in files]
    return JsonResponse(assets, safe=False)
```

---

### 5.4 Colaboração WebSocket — `wss://.../ws/wysiwyg/<pk>/` (opcional)

Requer **Django Channels**. O protocolo está documentado em `server/README.md`.

Resumo do que o consumer precisa fazer por sala (identificada por `pk`):

1. **`hello`** → registrar cliente, responder `welcome` + enviar `snapshot` se houver cache.
2. **`op`** → relay do evento para todos os outros clientes da sala (sem persistir).
3. **`snapshot`** → salvar como cache da sala (bom ponto para persistir no banco também).
4. **`sync-request`** → devolver o `snapshot` em cache.
5. **disconnect** → remover cliente e broadcast de `peers`.

```python
# consumers.py (Django Channels)
import json
from channels.generic.websocket import AsyncWebsocketConsumer

class WysiwygConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room = f"wysiwyg_{self.scope['url_route']['kwargs']['pk']}"
        await self.channel_layer.group_add(self.room, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        await self.channel_layer.group_discard(self.room, self.channel_name)

    async def receive(self, text_data):
        msg = json.loads(text_data)
        t = msg.get('t')
        if t == 'hello':
            await self.send(json.dumps({'t': 'welcome', 'clientId': self.channel_name, 'needSnapshot': True}))
        elif t == 'op':
            await self.channel_layer.group_send(self.room, {
                'type': 'relay_op', 'op': msg['op'], 'origin': self.channel_name
            })
        elif t == 'snapshot':
            pass  # cache + persistir se quiser
        elif t == 'sync-request':
            pass  # devolver snapshot em cache

    async def relay_op(self, event):
        if event.get('origin') != self.channel_name:
            await self.send(json.dumps({'t': 'op', 'op': event['op'], 'origin': event['origin']}))
```

---

## 6. Modelo de dados Django

```python
# models.py
from django.db import models

class Pagina(models.Model):
    slug          = models.SlugField(unique=True)
    titulo        = models.CharField(max_length=200)
    conteudo_json = models.JSONField(default=dict, blank=True)
    # Opcional: guardar o HTML pré-renderizado para exibição rápida sem JS
    conteudo_html = models.TextField(blank=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Página'
```

> **Dica:** o `conteudo_json` é a fonte da verdade. O `conteudo_html` é um cache opcional — pode ser gerado na view chamando `editor.exportHTML()` no cliente antes de submeter, ou regenerado no backend se você reimplementar o render em Python (complexo — prefira guardar o HTML exportado pelo editor).

---

## 7. Renderizando o conteúdo no site público

### Opção A — Guardar o HTML exportado (recomendado)

No frontend, antes de submeter ao servidor, gere o HTML:

```js
// Chame isso no evento de submit do formulário ou no onSave
const html = editor.exportHTML();
document.getElementById('conteudo_html').value = html;
```

No template do site público:

```django
{# Dependências p/ componentes interativos Bootstrap #}
<link rel="stylesheet" href="{% static 'wysiwyg/vendor/bootstrap.min.css' %}">
<link rel="stylesheet" href="{% static 'wysiwyg/vendor/bootstrap-icons.css' %}">
<script src="{% static 'wysiwyg/vendor/bootstrap.bundle.min.js' %}" defer></script>

{# Runtime de animações on-scroll (se usar data-animate / parallax) #}
<link rel="stylesheet" href="{% static 'wysiwyg/dist/scroll-animate.css' %}">
<script src="{% static 'wysiwyg/dist/scroll-animate.js' %}" defer></script>

{# Google Fonts (se o usuário configurou fontes no editor) #}
{{ pagina.font_links_html|safe }}  {# gerado por editor.exportFontLinks() #}

{# CSS personalizado do tema #}
{% if pagina.custom_css %}
<style>{{ pagina.custom_css }}</style>
{% endif %}

{# Conteúdo da página #}
<main>
  {{ pagina.conteudo_html|safe }}
</main>
```

### Opção B — Renderizar via `initialJSON` (editor read-only)

Instancie o editor em modo somente-leitura passando apenas `initialJSON` sem `saveUrl`/`targetField`. Não é ideal para usuários finais — use apenas para preview.

---

## 8. Metadados SEO

O editor possui painel SEO que salva em `root.props.seo`:

```python
# Extraindo SEO do JSON salvo no banco
seo = pagina.conteudo_json.get('props', {}).get('seo', {})
titulo    = seo.get('title', '')
descricao = seo.get('description', '')
canonical = seo.get('canonical', '')
og_image  = seo.get('ogImage', '')
robots    = seo.get('robots', 'index, follow')
```

No template:
```django
{% if pagina.seo_title %}<title>{{ pagina.seo_title }}</title>{% endif %}
{% if pagina.seo_description %}<meta name="description" content="{{ pagina.seo_description }}">{% endif %}
```

Ou use `editor.exportSeoHead()` para gerar todas as tags de uma vez (chamado no cliente antes de salvar e guardado no banco).

---

## 9. Customizações de tema

O editor permite ao usuário definir cores, gradientes, fontes e CSS custom. Essas customizações são exportáveis via `editor.exportCustomizations()` → JSON. Para persistir no banco:

```python
class Pagina(models.Model):
    # ...
    customizacoes = models.JSONField(default=dict, blank=True)
    # CSS gerado pelas customizações (para injetar no site público)
    custom_css    = models.TextField(blank=True)
```

No frontend, ao salvar:
```js
const customizacoes = editor.exportCustomizations();
document.getElementById('customizacoes_json').value = JSON.stringify(customizacoes);

const customCss = editor.getCustomCSS();
document.getElementById('custom_css').value = customCss;
```

Ao carregar o editor (sempre via `json_script` — ver seção 9.1):
```django
{{ pagina.conteudo_json|json_script:"conteudo-json" }}
{{ pagina.customizacoes|json_script:"customizacoes-json" }}
```
```js
new Editor({
  rootElement: ...,
  initialJSON: JSON.parse(document.getElementById('conteudo-json').textContent),
  onSave: async (json) => { /* ... */ },
}).init();

// Logo após o init():
editor.importCustomizations(
  JSON.parse(document.getElementById('customizacoes-json').textContent)
);
```

### 9.1. Passando o conteúdo inicial — use `json_script`, nunca `|safe`

Este é o erro de integração mais comum e o mais difícil de diagnosticar:

```django
{# ❌ NUNCA #}
<script type="module">
  const initialJSON = {{ pagina.conteudo_json|safe }};
</script>
```

Dois motivos, ambos quebram a **página inteira** (tela branca, editor não monta,
botões da topbar somem — porque o `<script type="module">` inteiro falha):

1. **`conteudo_json` é um `JSONField`** → o Django imprime o `repr()` do dict
   Python, não JSON. Assim que o conteúdo tiver um booleano ou nulo (blocos
   Lista, Imagem, Vídeo, Carousel, Formulário… todos têm), o script recebe
   `True` / `False` / `None`, que não existem em JavaScript →
   `Uncaught SyntaxError`.
2. **Qualquer texto contendo `</script>`** (um bloco HTML embed, uma citação de
   código) fecha o `<script>` no meio da string e destrói o resto da página.

O jeito certo é o filtro embutido `json_script`, que serializa como JSON de
verdade e escapa `<`, `>` e `&`:

```django
{# ✅ SEMPRE #}
{{ pagina.conteudo_json|json_script:"conteudo-json" }}
<script type="module">
  import { Editor } from "{% static 'wysiwyg/dist/wysiwyg.esm.js' %}";

  const el = document.getElementById('conteudo-json');
  const initialJSON = el ? JSON.parse(el.textContent) : null;

  new Editor({ rootElement: ..., initialJSON }).init();
</script>
```

O editor aceita `initialJSON` como objeto, como string JSON, como array de nós
de topo ou como `null` — o que ele não tem como consertar é um `<script>` que
nem chega a executar.

Se o campo for um `TextField` guardando a string JSON (em vez de `JSONField`),
`json_script` também funciona: o valor chega como string e o editor faz o
`JSON.parse` interno.

---

## 10. Template Django completo — editor de página

> **Nota sobre layout:** o editor controla o viewport inteiro (100vh). Se o template pai (`base.html`) tiver chrome próprio (sidebar, header, breadcrumb), instancie o editor em um template **standalone** (sem `extends`) para evitar conflitos com o grid do host.

```django
{% extends "base.html" %}
{% load static %}

{% block head_extra %}
  {# CSS Bootstrap e Icons #}
  <link rel="stylesheet" href="{% static 'wysiwyg/vendor/bootstrap.min.css' %}">
  <link rel="stylesheet" href="{% static 'wysiwyg/vendor/bootstrap-icons.css' %}">
  {# CSS do editor #}
  <link rel="stylesheet" href="{% static 'wysiwyg/dist/wysiwyg.css' %}">
{% endblock %}

{% block content %}
{# Shell do editor — será preenchido pelo JS #}
<div id="editor-root" class="editor-shell"></div>

{# Form hidden para submit via HTML form #}
<form id="editor-form" method="post" action="{% url 'paginas:salvar' pagina.slug %}">
  {% csrf_token %}
  <input type="hidden" name="conteudo_json"  id="conteudo_json">
  <input type="hidden" name="conteudo_html"  id="conteudo_html">
  <input type="hidden" name="custom_css"     id="custom_css">
  <input type="hidden" name="seo_tags_html"  id="seo_tags_html">
  <input type="hidden" name="font_links_html" id="font_links_html">
</form>
{% endblock %}

{% block scripts %}
  {# Dependências ANTES do editor #}
  <script src="{% static 'wysiwyg/vendor/bootstrap.bundle.min.js' %}"></script>
  <script src="{% static 'wysiwyg/vendor/purify.min.js' %}"></script>

  {# Conteúdo inicial — json_script escapa corretamente (ver seção 9.1) #}
  {{ pagina.conteudo_json|json_script:"conteudo-json-data" }}
  {{ pagina.customizacoes|json_script:"customizacoes-data" }}

  <script type="module">
    import { Editor } from "{% static 'wysiwyg/dist/wysiwyg.esm.js' %}";

    const readJson = (id) => {
      const el = document.getElementById(id);
      try { return el ? JSON.parse(el.textContent) : null; }
      catch { return null; }
    };
    const initialJSON = readJson('conteudo-json-data');

    const editor = new Editor({
      rootElement:  document.getElementById('editor-root'),
      csrfToken:    '{{ csrf_token }}',
      uploadUrl:    "{% url 'wysiwyg:upload' %}",
      assetsUrl:    "{% url 'wysiwyg:assets' %}",
      initialJSON:  initialJSON,
      autoSaveKey:  'editor:{{ pagina.pk }}',
      // collabUrl: 'wss://{{ request.get_host }}/ws/wysiwyg/{{ pagina.pk }}/',
      // collabName: '{{ request.user.get_full_name }}',
    }).init();

    // Restaurar customizações salvas
    const customizacoes = readJson('customizacoes-data');
    if (customizacoes) editor.importCustomizations(customizacoes);

    // Preencher campos hidden antes de qualquer submit
    document.getElementById('editor-form').addEventListener('submit', () => {
      document.getElementById('conteudo_json').value  = JSON.stringify(editor.exportJSON());
      document.getElementById('conteudo_html').value  = editor.exportHTML();
      document.getElementById('custom_css').value     = editor.getCustomCSS();
      document.getElementById('seo_tags_html').value  = editor.exportSeoHead();
      document.getElementById('font_links_html').value = editor.exportFontLinks();
    });
  </script>
{% endblock %}
```

---

## 11. URL configuration (urls.py)

```python
# wysiwyg/urls.py
from django.urls import path
from . import views

app_name = 'wysiwyg'

urlpatterns = [
    path('upload/',      views.wysiwyg_upload, name='upload'),
    path('assets/',      views.wysiwyg_assets, name='assets'),
    path('save/<slug:slug>/', views.wysiwyg_save, name='save'),
]
```

```python
# project/urls.py
from django.urls import path, include

urlpatterns = [
    # ...
    path('wysiwyg/', include('wysiwyg.urls')),
    # Se usar colaboração com Channels:
    # path('ws/wysiwyg/<int:pk>/', WysiwygConsumer.as_asgi()),
]
```

---

## 12. Estrutura de app sugerida

```
wysiwyg_app/
  __init__.py
  apps.py
  models.py          # Pagina (JSONField conteudo_json, TextField conteudo_html, ...)
  views.py           # wysiwyg_upload, wysiwyg_assets, wysiwyg_save, pagina_detail, pagina_edit
  urls.py
  admin.py           # registrar Pagina no admin
  templates/
    wysiwyg_app/
      edit.html      # editor (template do item 10)
      detail.html    # página publicada (renderiza conteudo_html)
  static/
    wysiwyg/
      dist/          # arquivos copiados de editor_wysiwyg_claude/dist/
      vendor/        # bootstrap.min.css, bootstrap.bundle.min.js, purify.min.js, bootstrap-icons.css
```

---

## 13. Checklist de implementação

- [ ] Copiar `dist/` para `static/wysiwyg/dist/`
- [ ] Baixar dependências para `static/wysiwyg/vendor/` (Bootstrap CSS+JS, DOMPurify, Bootstrap Icons)
- [ ] Criar modelo `Pagina` com `JSONField conteudo_json`
- [ ] View + URL: `wysiwyg_upload` (POST multipart → `{ url }`)
- [ ] View + URL: `wysiwyg_assets` (GET → array de URLs)
- [ ] View + URL: `wysiwyg_save` (POST JSON — ou usar form HTML com `targetField`)
- [ ] Template de edição com instanciação do editor (item 10)
- [ ] Template de exibição pública com Bootstrap, scroll-animate runtime, Google Fonts e CSS custom
- [ ] Executar `collectstatic`
- [ ] (Opcional) Django Channels + consumer WebSocket para colaboração em tempo real

---

## 14. Observações de segurança

- **Sempre valide CSRF** nas views de save e upload.
- **Sanitize uploads**: valide `content_type` E a extensão do arquivo; não confie apenas no MIME declarado pelo cliente.
- **Tamanho máximo** de upload: configure `DATA_UPLOAD_MAX_MEMORY_SIZE` e `FILE_UPLOAD_MAX_MEMORY_SIZE` no settings.
- **O HTML exportado** (`conteudo_html`) foi gerado pelo DOMPurify no cliente. Ainda assim, ao renderizar com `{{ pagina.conteudo_html|safe }}`, confirme que a origem é confiável (edição por usuários autenticados com permissão).
- **Nunca exiba** `conteudo_json` direto via `|safe` em contexto de usuário final — use somente o HTML exportado.
- **Colaboração WS**: autentique o consumer via middleware de sessão do Django Channels antes de aceitar a conexão.

---

## 15. Migração de conteúdo legado (CKEditor / HTML bruto)

Use o CLI incluído no repositório para converter HTML legado para a árvore JSON do editor:

```bash
cd editor_wysiwyg_claude
npm i -D linkedom            # uma vez
npm run convert -- html --in legacy_page.html --out tree.json
```

O CLI limpa automaticamente tags `<o:p>`, atributos `data-cke-*` e estilos `mso-*` gerados pelo Word/CKEditor. Para carregar no banco após a conversão:

```python
import json
page.conteudo_json = json.load(open('tree.json'))
page.save()
```
