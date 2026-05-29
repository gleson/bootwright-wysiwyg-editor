# Laravel

Laravel emite o token CSRF como cookie `XSRF-TOKEN` e espera o header
`X-XSRF-TOKEN` na resposta. O editor lê o cookie automaticamente.

## Blade — instanciar o editor

```blade
<div id="editor-root" class="editor-shell"></div>

<form id="editor-form" action="{{ route('pages.save', $page) }}" method="POST">
  @csrf
  <input type="hidden" name="content_json" id="content_json">
  <input type="hidden" name="content_html" id="content_html">
</form>

<script src="{{ asset('vendor/wysiwyg/purify.min.js') }}"></script>
<script src="{{ asset('vendor/bootstrap/bootstrap.bundle.min.js') }}"></script>
<script type="module">
  import { Editor } from "{{ asset('vendor/wysiwyg/wysiwyg.esm.js') }}";

  const editor = new Editor({
    rootElement: document.getElementById('editor-root'),
    initialJSON: @json($page->content_json),
    disableDjangoBlocks: true,        // remove blocos Django-only do palette
    autoSaveKey:  `editor:page:{{ $page->id }}`,
    csrf:    { header: 'X-XSRF-TOKEN', cookie: 'XSRF-TOKEN' },
    uploadUrl:    "{{ route('media.upload') }}",
    assetsUrl:    "{{ route('media.index') }}",
    saveUrl:      "{{ route('pages.save', $page) }}",
  }).init();

  document.getElementById('editor-form').addEventListener('submit', () => {
    document.getElementById('content_json').value = JSON.stringify(editor.exportJSON());
    document.getElementById('content_html').value = editor.exportHTML();
  });
</script>
```

## Controller — upload

```php
public function upload(Request $request)
{
    $request->validate([
        'file' => 'required|file|max:10240|mimes:jpg,png,webp,gif,mp4,mp3,ogg',
    ]);
    $path = $request->file('file')->store('wysiwyg', 'public');
    return response()->json(['url' => Storage::url($path)]);
}
```

> Laravel rejeita `svg` por default no `mimes` rule — coerente com o editor,
> que tem `allowSvg: false` por default.

## Schema da árvore

Validar `content_json` no backend antes de persistir:

```php
use Opis\JsonSchema\Validator;

$schema = json_decode(file_get_contents(public_path('vendor/wysiwyg/schema.v1.json')));
$result = (new Validator())->validate(json_decode($request->content_json), $schema);
abort_unless($result->isValid(), 422, 'JSON inválido para o editor.');
```
