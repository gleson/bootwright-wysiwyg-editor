# Como criar um bloco

Este documento descreve a interface que todo bloco deve cumprir + o passo a passo
para registrá-lo no editor. Veja `js/blocks/built-in/` para exemplos reais.

---

## 1. Anatomia de um bloco

Um bloco é uma **classe estática** (sem instâncias) que herda de `Block` e expõe:

```js
import { Block } from '../Block.js';

export class MeuBloco extends Block {
  // Identificadores ----------------------------------------------------
  static type  = 'meu-bloco';      // único; usado em node.type
  static label = 'Meu Bloco';      // mostrado na sidebar de blocos
  static icon  = 'star';           // nome do Bootstrap Icons (sem o "bi-")

  // Schema padrão aplicado ao criar via editor.addBlock(parent, type) ---
  static schema = {
    props:   { mensagem: 'Olá' },  // dados específicos
    classes: ['minha-classe'],     // classes Bootstrap iniciais
    attrs:   {},                   // atributos HTML extras (id, etc.)
  };

  // Aninhamento --------------------------------------------------------
  static allowedChildren = null;   // null=folha | '*'=qualquer | ['tipo1','tipo2']

  // Inline edit (opcional) ---------------------------------------------
  static editableProp       = 'mensagem';   // duplo-clique edita esta prop
  static editableMultiline  = false;        // true → Enter quebra linha

  // Render -------------------------------------------------------------
  static render(node, ctx) {
    const div = document.createElement('div');
    div.textContent = node.props.mensagem ?? '';
    return div;
    // Note: NÃO aplique node.classes/node.attrs aqui — o Renderer faz isso.
  }

  // Onde os filhos vão (default: o próprio root retornado por render) ---
  static getChildrenContainer(rootEl) {
    return rootEl;
  }

  // Controles do painel direito ----------------------------------------
  static settings(node) {
    return [
      { tab: 'content', type: 'text', label: 'Mensagem',
        bind: { kind: 'prop', key: 'mensagem' } },
    ];
  }
}
```

---

## 2. Schema padrão (`static schema`)

Aplicado por `editor.addBlock(parentId, type, props)` por baixo dos overrides do
usuário. Tem três chaves:

- **`props`** — objeto livre com dados do bloco (texto, src, items, etc).
- **`classes`** — lista de classes Bootstrap aplicadas no render (ex.: `['btn', 'btn-primary']`).
- **`attrs`** — atributos HTML extras (`{ id: '...', 'data-foo': 'bar' }`).

---

## 3. Render

Recebe `(node, ctx)` e devolve um `HTMLElement`. O Renderer aplica
automaticamente:

- `data-block-id` e `data-block-type` (para click-to-select)
- `node.classes` (via `classList.add`)
- `node.attrs` (via `setAttribute`)
- Filhos (insere recursivamente em `getChildrenContainer(rootEl)`)

`ctx` contém:
- `ctx.sanitizer` — wrapper do DOMPurify; chame `ctx.sanitizer.html(rawHtml)`
  ANTES de inserir HTML cru via `innerHTML`. Veja `HtmlEmbed.js`.

**Não chame `innerHTML` com strings cruas** — sempre `textContent` para texto
e `ctx.sanitizer.html()` para HTML.

---

## 4. `allowedChildren`

Controla **drag & drop** e validação de aninhamento:

- `null` — bloco-folha; não recebe filhos. (Heading, Image, Button, etc.)
- `'*'` — aceita qualquer tipo. (Section, Column.)
- `string[]` — lista permitida. (Row aceita só `['column']`.)

---

## 5. Inline edit

Duas opções:

### 5.1 Prop simples (`editableProp`)

Duplo-clique no bloco ativa `contenteditable` no elemento-raiz e escreve em
`node.props[editableProp]` no commit (blur ou Enter).

```js
static editableProp = 'text';
static editableMultiline = false;  // true para Paragraph
```

### 5.2 Sub-elementos (`getInlineEditTarget`)

Quando o bloco tem múltiplas regiões editáveis (ex.: células de tabela), exporte:

```js
static getInlineEditTarget(blockEl, eventTarget, node) {
  const cell = eventTarget.closest('[data-cell]');
  if (!cell || !blockEl.contains(cell)) return null;
  const [r, c] = cell.dataset.cell.split(',').map(Number);
  return {
    element: cell,
    read:  (n) => n.props.cells?.[r]?.[c] ?? '',
    write: (n, v) => {
      const cells = (n.props.cells ?? []).map((row) => [...row]);
      cells[r][c] = v;
      return { props: { cells } };
    },
  };
}
```

Veja `Table.js` como referência.

---

## 6. Settings — controles do painel direito

`settings(node)` devolve um array de schemas de controle. Cada controle é
processado pela `ControlFactory` e plugado ao painel.

### 6.1 Esqueleto

```js
{
  tab:    'content' | 'style' | 'advanced',  // qual aba
  type:   'text'|'textarea'|'number'|'select'|'toggle'|
          'range'|'radio-group'|'color'|'spacing'|'file'|'action',
  label:  'Rótulo',
  help?:  'Texto de ajuda',
  bind:   { kind: ..., ... },                // como ler/escrever do nó
  // específicos por tipo: options, min, max, step, accept, ...
}
```

### 6.2 Tipos de bind

| `bind.kind` | Lê de | Escreve em | Notas |
|---|---|---|---|
| `prop` | `node.props[key]` | `node.props[key]` | qualquer valor JSON |
| `attr` | `node.attrs[key]` | `node.attrs[key]` | atributos HTML extras |
| `classToggle` | `node.classes.includes(class)` | adiciona/remove class | `removes`/`addsWhenOff` para grupos |
| `classGroup` | classe do `group` presente | substitui pela `value` | mutuamente exclusivo no grupo |
| `classes` | `node.classes.join(' ')` | substitui lista inteira | textarea bruto |
| `spacing` | classes `mt-N`/`mb-N`/etc | gera `mt-N`/etc por lado | controle composto |

### 6.3 Responsividade (opt-in)

Adicione `responsive: true` em `classToggle` / `classGroup` / `spacing` e use
templates com `{bp}`:

```js
{ tab: 'style', type: 'radio-group', label: 'Alinhamento',
  options: [
    { value: 'text-{bp}-start',  label: 'Esquerda' },
    { value: 'text-{bp}-center', label: 'Centro' },
    { value: 'text-{bp}-end',    label: 'Direita' },
  ],
  bind: { kind: 'classGroup', responsive: true,
    group: ['text-{bp}-start', 'text-{bp}-center', 'text-{bp}-end'] } },
```

O switch de breakpoint no topo do painel direito (`XS / SM / MD / LG / XL`)
controla qual variante está sendo editada. `{bp}` resolve para `''` (xs) ou
`'sm'`/`'md'`/`'lg'`/`'xl'`. As classes de outros breakpoints são preservadas.

### 6.4 Override de bind: `schema.onChange`

Quando precisar de mutações multi-prop coerentes (ex.: trocar `rows` E `cells`
ao mesmo tempo na Tabela):

```js
{ type: 'range', label: 'Linhas', min: 1, max: 12,
  bind: { kind: 'prop', key: 'rows' },        // lê de prop.rows
  onChange: (value, node) => ({                // escreve patch livre
    props: { rows: value, cells: redimensionarMatriz(node, value) },
  }) },
```

### 6.5 Botões de ação (`type: 'action'`)

Botão sem label externa, sem bind. `onClick(node) → patch`:

```js
{ tab: 'content', type: 'action', label: '+ Linha',
  icon: 'plus-square',
  onClick: (n) => ({ props: { rows: (n.props.rows ?? 3) + 1 } }) },
```

### 6.6 Upload de arquivo (`type: 'file'`)

Posta multipart com CSRF para `editor.config.uploadUrl`; fallback `FileReader` →
data URL se sem endpoint:

```js
{ tab: 'content', type: 'file', label: 'Imagem', accept: 'image/*',
  bind: { kind: 'prop', key: 'src' } },
```

O controle `file` também expõe um botão que abre a **biblioteca de assets**
(`editor.ui.assetLibrary`) — grid de mídia já enviada, para reuso sem re-upload.

### 6.7 Hook de exportação (`static decorateExport`)

Opcional. Chamado por `Editor.exportHTML` **após os filhos serem anexados** —
ajusta o elemento exportado sem afetar o render do canvas. Usado pelo `Repeater`
para embrulhar os filhos em `{% for %}`/`{% endfor %}` do Django:

```js
static decorateExport(node, element) {
  element.insertBefore(
    document.createTextNode(`{% for ${node.props.itemVar} in ${node.props.listVar} %}`),
    element.firstChild);
  element.appendChild(document.createTextNode('{% endfor %}'));
}
```

---

## 7. Registro

Inclua no `js/blocks/built-in/index.js`:

```js
import { MeuBloco } from './MeuBloco.js';

export const builtInBlocks = [
  // ... outros blocos
  MeuBloco,
];
export { MeuBloco };
```

Ou via plugin externo (sem tocar no core):

```js
import { Editor } from './core/Editor.js';
import { MeuBloco } from './meus-blocos/MeuBloco.js';

const editor = new Editor({ rootElement: ... });
editor.registry.register(MeuBloco);
editor.init();
```

---

## 8. Boas práticas

- **Não duplique estado** — se uma classe Bootstrap já reflete um booleano
  (ex.: `container-fluid`), mantenha em `classes`, não em `props`.
- **Renderize com `textContent` para texto** — só use `ctx.sanitizer.html()`
  quando inserir HTML cru.
- **Não toque no DOM externo** — `render()` deve ser puro: input = node, output
  = elemento. Sem efeitos colaterais.
- **Atributos do bloco vs atributos do editor** — se você usar `data-cell` ou
  similares, eles ficam no HTML exportado por `editor.exportHTML()` a menos que
  você os adicione ao filtro em `Editor._stripEditorAttrs`. Por padrão
  `data-block-id`, `data-block-type`, `data-editing` e `data-cell` são removidos.

---

## 9. Exemplo completo: Card

```js
import { Block } from '../Block.js';

export class Card extends Block {
  static type = 'card';
  static label = 'Card';
  static icon = 'card-text';
  static schema = {
    props: { title: 'Título', body: 'Corpo do card' },
    classes: ['card'],
    attrs: {},
  };
  static allowedChildren = null;

  static render(node) {
    const card = document.createElement('div');
    const body = document.createElement('div');
    body.className = 'card-body';
    const h = document.createElement('h5');
    h.className = 'card-title';
    h.textContent = node.props.title ?? '';
    h.dataset.cardField = 'title';
    const p = document.createElement('p');
    p.className = 'card-text';
    p.textContent = node.props.body ?? '';
    p.dataset.cardField = 'body';
    body.append(h, p);
    card.appendChild(body);
    return card;
  }

  static getInlineEditTarget(blockEl, eventTarget, node) {
    const field = eventTarget.closest('[data-card-field]');
    if (!field || !blockEl.contains(field)) return null;
    const key = field.dataset.cardField; // 'title' | 'body'
    return {
      element: field,
      read:  (n) => n.props[key] ?? '',
      write: (n, v) => ({ props: { [key]: v } }),
    };
  }

  static settings(node) {
    return [
      { tab: 'content', type: 'text',     label: 'Título', bind: { kind: 'prop', key: 'title' } },
      { tab: 'content', type: 'textarea', label: 'Corpo',  bind: { kind: 'prop', key: 'body' } },
    ];
  }
}
```
