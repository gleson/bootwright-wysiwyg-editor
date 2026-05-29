# Rails

Rails usa `X-CSRF-Token` e expõe o token via `<meta name="csrf-token">`.

## ERB — instanciar

```erb
<div id="editor-root" class="editor-shell"></div>

<%= form_with model: @page, id: 'editor-form' do |f| %>
  <%= f.hidden_field :content_json, id: 'content_json' %>
  <%= f.hidden_field :content_html, id: 'content_html' %>
<% end %>

<script src="<%= asset_path('wysiwyg/purify.min.js') %>"></script>
<script src="<%= asset_path('bootstrap.bundle.min.js') %>"></script>
<script type="module">
  import { Editor } from "<%= asset_path('wysiwyg/wysiwyg.esm.js') %>";

  const editor = new Editor({
    rootElement: document.getElementById('editor-root'),
    initialJSON: <%= raw @page.content_json.to_json %>,
    disableDjangoBlocks: true,
    autoSaveKey: 'editor:page:<%= @page.id %>',
    csrf: {
      header: 'X-CSRF-Token',
      token:  document.querySelector('meta[name="csrf-token"]')?.content,
    },
    uploadUrl: '<%= upload_media_path %>',
    assetsUrl: '<%= media_path %>',
  }).init();

  document.getElementById('editor-form').addEventListener('submit', () => {
    document.getElementById('content_json').value = JSON.stringify(editor.exportJSON());
    document.getElementById('content_html').value = editor.exportHTML();
  });
</script>
```

## Controller — upload (Active Storage)

```ruby
class MediaController < ApplicationController
  def upload
    blob = ActiveStorage::Blob.create_and_upload!(io: params[:file], filename: params[:file].original_filename)
    render json: { url: url_for(blob), name: blob.filename.to_s }
  end
end
```
