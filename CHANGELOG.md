# Changelog

Todos os changes notáveis deste editor são documentados aqui.
Formato baseado em [Keep a Changelog](https://keepachangelog.com/);
versionamento [SemVer](https://semver.org/).

## [1.1.0] - 2026-05-27 — plug-and-play em qualquer stack

Pacote de mudanças motivadas pelo `FEEDBACK_DEVS_EDITOR.md` — endurece a
integração do bundle em backends arbitrários (Django, Laravel, Rails, etc.).

### Added
- **`Editor.version` / `Editor.schemaVersion`** + exports `VERSION`,
  `SCHEMA_VERSION` — diagnóstico em produção e versionamento do payload.
- **Registro oficial de instâncias**: `Editor.instances` (Map). Integrações
  externas (calculadoras de pontuação, validators) leem do registry em vez de
  precisarem que o partial Django exponha um global ad-hoc.
- **Eventos DOM** disparados no `rootElement`:
  `editor:ready`, `editor:change`, `editor:save`, `editor:destroy`.
- **`initialContent`** — alternativa unificada a `initialJSON`:
  `{ format: 'json'|'html'|'markdown', source }`. `initialJSON` segue aceito.
- **`importHTML(html, mode?)`** — atalho deprecated mantido para integrações
  antigas; loga warning e delega para `importContent`.
- **`csrf` configurável**: `{ header, token, cookie }`. Padrão `X-CSRFToken`
  para Django, mas dá pra usar `X-XSRF-TOKEN` (Laravel), `X-CSRF-Token`
  (Rails), `RequestVerificationToken` (.NET) ou ler de cookie.
- **`transport` configurável**: `{ upload: { url, method, field, headers,
  parser }, assets: {...}, save: {...} }` — escolhe método HTTP, nome do
  campo multipart, headers adicionais, parser custom da resposta.
- **`fetch` custom**: passe axios/ky/etc. para `new Editor({ fetch })`.
- **`disableDjangoBlocks: true`** — não registra `DjangoVar`, `Repeater`,
  `Form*`. Para outras engines (Twig/Liquid), use `excludeBlocks: [...]`.
- **`allowSvg`** (default `false`) + nova API do `Sanitizer`:
  `{ allowSvg, allowedTags, allowedAttrs, forbiddenTags, forbiddenAttrs,
   addHooks, logRemoved }`. SVG inline (com `<script>` embutido) bloqueado.
- **`Editor.registerLocale(code, strings)`** + `Editor.setLocale(code)` —
  registra novos idiomas (es, fr, de) sem fork.
- **TypeScript types** (`dist/wysiwyg.d.ts`) e **JSON Schema** (`dist/schema.v1.json`).
- **CLI `wysiwyg-convert`** (`npm run convert html < page.html > tree.json`)
  com scrub de sujeira de CKEditor (`<o:p>`, `data-cke-*`, `mso-*`).
- **Auto-save versionado**: payload agora carrega `editorVersion` e
  `schemaVersion`. Restore avisa em console quando há mismatch de schema.
- **`Editor.destroy()`** — remove do registry, fecha colab, dispara evento DOM.
- **Métodos públicos**: `editor.csrfHeaders()`, `editor.fetch()`,
  `editor.transportFor('upload'|'assets'|'save')`.
- Doc por integração em `docs/integrations/` (django, laravel, rails, express).

### Changed
- **`initialJSON` tolerante** a `null | undefined | "" | "{}" | {} | "\""\"" |
  string-encoded`. Antes, vários desses formatos faziam o editor abrir vazio
  ou logar `Object.keys(null)`. Normalização interna decide entre "vazio" e
  "carrega".
- **`autoSaveKey` torna-se obrigatório** quando `autoSave` está ligado.
  Sem ele, `autoSave` é desligado e um warning explicativo é logado.
  Passe `autoSaveStrict: false` para manter o comportamento antigo
  (chave genérica compartilhada).
- **`init()` valida DOMPurify** e falha com mensagem explícita se ausente
  (antes degradava silenciosamente). Loga warning se `window.bootstrap` não
  estiver presente (Carousel/Tabs/Accordion não terão comportamento).
- **`save()`** usa `editor.fetch` + `csrfHeaders()` (respeita `transport.save`).
- **AssetLibrary.uploadFile** rejeita `image/svg+xml` por padrão. Habilite
  com `new Editor({ allowSvg: true })`.

### Documentação
- README ganhou seção "Plug-and-play em qualquer stack" e movido o
  conteúdo Django para `docs/integrations/django.md`.
- `DJANGO_INTEGRATION.md` continua válido — atualizado para refletir
  a nova normalização de `initialJSON` (não precisa mais de `|default:"null"`).

### Migration notes
- Quem já passava `csrfToken: '...'` segue funcionando — agora ele é tratado
  como atalho para `csrf: { header: 'X-CSRFToken', token: ... }`.
- Quem já chamava `editor.importContent({ format, source })` segue igual.
- Quem chamava `editor.importHTML(html)` recebe um warning de deprecation —
  troque para `importContent`.
- Quem dependia de auto-save com chave default genérica (`'editor:autosave'`)
  precisa passar uma chave única por registro OU `autoSaveStrict: false`.

## [1.0.0] - 2026-05-23

- Versão inicial. Editor funcional com 31 blocos built-in, edição rica de
  painéis (Tabs/Accordion/Carousel) via mini-editor em modal, asset library,
  templates, componentes, SEO, comentários, animações on-scroll, parallax,
  Google Fonts, exportação standalone, colaboração via WebSocket opt-in.
