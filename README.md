# Bootwright — WYSIWYG Editor

**Bootwright** é um editor WYSIWYG modular híbrido em **Vanilla JS (ES6+)** e baseado nos blocos do **Bootstrap 5.3**, embutível em qualquer backend (Django, Laravel, Rails, Express, etc.) através de 3 endpoints HTTP.

- Sem jQuery, sem framework. No dev roda como módulos ES puros; para produção há um bundle `esbuild` opcional.
- Single Source of Truth: o conteúdo é uma árvore JSON; o DOM é só projeção.
- Distribuído como pasta de static files (`dist/`) — copie para o `static/` da sua aplicação.
- Tipos TS (`dist/wysiwyg.d.ts`) e JSON Schema (`dist/schema.v1.json`) acompanham o bundle.
- Controles visuais por bloco cobrindo utilitários **Bootstrap 5.3**: layout/grid responsivo por breakpoint, cores e **modo claro/escuro** (`data-bs-theme`), bordas, sombra, dimensão, `object-fit`, posição, `gap`, espaçamento e tipografia.

## Plug-and-play em qualquer stack (1.1.0+)

```html
<div id="editor-root" class="editor-shell"></div>

<script src="/static/wysiwyg/vendor/purify.min.js"></script>
<script src="/static/wysiwyg/vendor/bootstrap.bundle.min.js"></script>
<script type="module">
  import { Editor } from '/static/wysiwyg/dist/wysiwyg.esm.js';

  const editor = new Editor({
    rootElement: document.getElementById('editor-root'),
    initialJSON: window.__initialContent ?? null,

    // CSRF — escolha o que o seu framework usa:
    //   csrf: { header: 'X-CSRFToken',          token: '...' }     // Django
    //   csrf: { header: 'X-XSRF-TOKEN',         cookie: 'XSRF-TOKEN' } // Laravel
    //   csrf: { header: 'X-CSRF-Token',         token: '...' }     // Rails
    csrf: { header: 'X-CSRFToken', token: window.__csrf },

    // Endpoints (alternativa: config.transport.{upload,assets,save}.url)
    uploadUrl: '/api/wysiwyg/upload',
    assetsUrl: '/api/wysiwyg/assets',
    saveUrl:   '/api/wysiwyg/save',

    // Plug-out de blocos com sintaxe de template-engine quando você não está
    // num backend Django/Jinja:
    disableDjangoBlocks: true,

    // Auto-save: chave obrigatória por registro (evita cruzar rascunhos)
    autoSaveKey: `editor:page:${PAGE_ID}`,
  }).init();

  // Eventos DOM (sem precisar expor a instância globalmente):
  document.getElementById('editor-root').addEventListener('editor:change', () => { /* ... */ });
</script>
```

Documentação por framework: [`docs/integrations/`](docs/integrations/README.md).

Para Django, consulte [`docs/integrations/django.md`](docs/integrations/django.md).

## Executar localmente (desenvolvimento)

A partir da raiz do projeto:

```bash
python -m http.server 8001
```

Abra http://localhost:8000

> Servir via `file://` **não funciona** — módulos ES6 exigem HTTP.

## Estrutura

```
index.html              # shell standalone (dev)
css/style.css           # estilos do "chrome" do editor (não do conteúdo)
js/
  main.js               # entry standalone
  core/                 # Editor, EventBus, State, History, Renderer, Sanitizer
  blocks/               # registro + um módulo por bloco
  ui/                   # Topbar, Sidebars, Canvas, BlockToolbar, Controls
  utils/                # helpers genéricos
assets/                 # ícones próprios, imagens da UI (se houver)
build.mjs               # script de bundle de produção (esbuild)
package.json            # scripts npm + devDependency esbuild
dist/                   # bundle de produção gerado (npm run build)
TODO.md                 # plano de execução por fases + status
instrucoes.md           # briefing original do projeto
```

## Integração com Django (visão geral)

1. Copie `js/`, `css/` e `assets/` para `<sua_app>/static/wysiwyg/`.
2. No template Django onde o editor deve aparecer:

```django
{% load static %}
<link rel="stylesheet" href="{% static 'wysiwyg/css/style.css' %}">

<div id="meu-editor" class="editor-shell">
  <!-- O Editor monta o shell aqui (topbar, sidebars, canvas) -->
</div>

<form method="post">
  {% csrf_token %}
  <input type="hidden" name="conteudo_json" id="conteudo_json">
  <button type="submit">Publicar</button>
</form>

<script type="module">
  import { Editor } from "{% static 'wysiwyg/js/core/Editor.js' %}";

  new Editor({
    rootElement: document.getElementById('meu-editor'),
    targetField: document.getElementById('conteudo_json'),
    csrfToken:   '{{ csrf_token }}',
    saveUrl:     "{% url 'editor:save' %}",     // opcional
    uploadUrl:   "{% url 'editor:upload' %}",   // opcional — POST de upload
    assetsUrl:   "{% url 'editor:assets' %}",   // opcional — GET lista de assets
    initialJSON: {{ conteudo_json|safe|default:"null" }},
  }).init();
</script>
```

3. Em produção, baixe o **DOMPurify** e o Bootstrap localmente para `static/wysiwyg/vendor/` (evita depender de CDN).

### Biblioteca de assets

Os controles de upload (Imagem, Card, Áudio, Vídeo) têm um botão que abre a
**biblioteca de assets**: um grid de mídia já usada, para reaproveitar sem
re-enviar. Tudo que passa pelo `uploadUrl` (ou pelo fallback data URL) entra na
biblioteca automaticamente; a lista persiste no `localStorage` entre sessões
(data URLs ficam só em memória — não cabem na quota).

Se `assetsUrl` estiver configurado, o editor faz `GET` nele ao abrir a biblioteca
e mescla a lista hospedada no Django. Resposta aceita: um array ou
`{ results: [...] }` / `{ assets: [...] }`, onde cada item é a URL (string) ou
`{ url, name?, kind? }` — `kind` é `image` | `video` | `audio`.

### Edição colaborativa (WebSocket)

Opcional. Com `collabUrl` configurado, múltiplos usuários editam a mesma página
em tempo real — cada mutação é transmitida via WebSocket (broadcast de eventos +
last-write-wins). Sem `collabUrl`, o editor segue offline-only; o auto-save em
`localStorage` continua valendo como cache de resiliência mesmo com a
colaboração ligada.

```js
new Editor({
  rootElement: document.getElementById('meu-editor'),
  collabUrl:   'wss://meusite.com/ws/editor/pagina-42/',  // opcional
  collabName:  '{{ request.user.get_full_name }}',         // opcional
}).init();
```

Para desenvolvimento há um **servidor de referência** zero-dependências:

```bash
npm run collab   # ws://localhost:8787 — abra a página em duas abas para testar
```

O protocolo de mensagens e o roteiro para implementar o servidor real (ex.:
Django Channels) estão em [`server/README.md`](./server/README.md).

### Animações on-scroll

Qualquer bloco pode animar ao entrar na viewport: aba **Avançado → Animação ao
rolar** (fade, fade direcional, zoom) com duração e atraso. O efeito é gravado
em atributos `data-animate*` e **vai junto no HTML exportado**.

No editor a animação é pré-visualizada no canvas. Na **página publicada** é
preciso incluir o runtime — um par CSS + JS pequeno e independente do bundle
do editor:

```django
<link rel="stylesheet" href="{% static 'wysiwyg/dist/scroll-animate.css' %}">
<script src="{% static 'wysiwyg/dist/scroll-animate.js' %}" defer></script>
```

Degrada com elegância: se o JS não carregar, nada fica invisível; e
`prefers-reduced-motion` desliga as transições.

### Parallax e timeline (scroll-linked)

Os mesmos arquivos `scroll-animate.*` do runtime acima também cuidam de:

- **Parallax** — atributo `data-parallax="<-1..1>"` em qualquer bloco. O
  runtime translada o eixo Y proporcionalmente ao deslocamento entre o
  centro do bloco e o centro da viewport. `0` = desligado; `0.2` costuma ser
  um efeito sutil agradável; negativos invertem a direção.
- **Timeline (scroll-linked)** — combine `data-animate` com
  `data-scroll-link="1"`. Em vez de tocar uma vez quando o bloco aparece,
  a animação é *esfregada* pelo scroll: opacity e transform interpolam de
  acordo com `--wa-progress` (gravado pelo runtime).

Ambos aparecem na aba **Avançado → "Vincular ao scroll"** e **"Parallax
(intensidade)"** do painel de propriedades — todos os 31+ blocos os herdam
via `animationControls()`. Os atributos vão no HTML exportado e o mesmo
`dist/scroll-animate.js` da página publicada já trata todos os casos.
`prefers-reduced-motion` desliga parallax e zera o progresso.

### Web fonts / Google Fonts

Em **Personalização → Tema → Fontes** há três modos para registrar fontes:

- **Google (curado)**: escolha uma família popular e os pesos por checkbox.
- **Google (URL)**: cole a URL gerada em fonts.google.com (botão "Get embed code").
  Múltiplas famílias na mesma URL viram entradas separadas.
- **Personalizada**: apenas label + stack CSS (sem `<link>` automático — você
  cuida do `@font-face` ou do `<link>` no template).

Fontes registradas com URL do Google Fonts são **injetadas automaticamente** no
`<head>` do editor (preview ao vivo) e nas tags `<link>` do
`exportStandaloneHTML()`. Para o template Django, copie as tags geradas em
**Personalização → Exportar/Importar → Web fonts** ou use a API pública:

```js
const linksHtml = editor.exportFontLinks();  // string com <link rel="preconnect">/<link rel="stylesheet">
```

Cole no `<head>` do `base.html` para que a fonte carregue também no site
público.

## Bundle de produção

O código-fonte em `js/` são módulos ES servidos como estão no dev. Para produção,
o `esbuild` gera um bundle único e minificado em `dist/`:

```bash
npm install        # uma vez — instala o esbuild (devDependency)
npm run build      # produção: minificado + sourcemaps
npm run build:dev  # debug: sem minificar
npm run watch      # rebuild ao salvar
```

Saída em `dist/`:

| Arquivo              | Uso                                                                      |
| -------------------- | ------------------------------------------------------------------------ |
| `wysiwyg.esm.js`     | `import { Editor } from '.../wysiwyg.esm.js'` (`<script type="module">`) |
| `wysiwyg.iife.js`    | sem módulos ES — expõe `window.WysiwygEditor.Editor`                     |
| `wysiwyg.css`        | CSS do chrome do editor, minificado                                      |
| `scroll-animate.js`  | runtime das animações on-scroll para a **página publicada**              |
| `scroll-animate.css` | CSS das animações on-scroll para a **página publicada**                  |
| `*.map`              | sourcemaps — não precisam ser publicados                                 |

> **DOMPurify e o JS do Bootstrap não são empacotados** — o editor os consome via
> `globalThis`. Continuam carregados à parte (`static/wysiwyg/vendor/` em produção).

No Django, copie `dist/` para `static/wysiwyg/dist/` e aponte o template para o
bundle em vez de `js/core/Editor.js`:

```django
<link rel="stylesheet" href="{% static 'wysiwyg/dist/wysiwyg.css' %}">
<script type="module">
  import { Editor } from "{% static 'wysiwyg/dist/wysiwyg.esm.js' %}";
  /* ...mesma instanciação do exemplo acima... */
</script>
```

## Status do desenvolvimento

Veja [`TODO.md`](./TODO.md) — atualizado a cada fase concluída.

## Princípios de desenvolvimento

- Toda mutação da árvore passa por um *dispatcher*; nunca alterar nó direto.
- Toda inserção de conteúdo de usuário no DOM passa pelo `Sanitizer`.
- Novo bloco = novo módulo isolado em `js/blocks/`. Zero alteração no core.
- Classes do Bootstrap são manipuladas pelo `ClassManager` (resolve conflitos de grupo, ex: `text-start` vs `text-center`).
