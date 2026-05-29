/**
 * MarkdownShortcuts — transforma o bloco em edição quando o usuário digita
 * um prefixo markdown reconhecido seguido de espaço.
 *
 * Padrões suportados (v1):
 *   `# `,`## `,`### `,`#### `,`##### `,`###### ` → Heading nível 1–6
 *   `- ` ou `* `                                → List (não ordenada)
 *   `1. `                                       → List (ordenada)
 *   `> `                                        → Blockquote
 *
 * Regras:
 *   - Só dispara quando o prefixo está no início do conteúdo (sem texto antes,
 *     fora whitespace) e o caret acabou de pular o espaço final. Evita
 *     transformações inesperadas no meio do texto.
 *   - Origem permitida: blocos cujo `editableProp === 'text'` E que sejam
 *     containers de texto (paragraph, heading, blockquote, list). Botões e
 *     badges ficam de fora.
 *   - Conteúdo após o prefixo entra no novo bloco e a edição inline continua
 *     no novo elemento, com o caret no fim.
 *   - Não conflita com o SlashMenu: este só dispara para `/`.
 */

const SOURCE_TYPES = new Set(['paragraph', 'heading', 'blockquote', 'list']);

/** Lista de padrões — ordem importa (mais longo primeiro para `## ` antes de `# `). */
const PATTERNS = [
  { re: /^(\s*)(#{6})\s$/, build: (rest) => ({ type: 'heading', props: { level: 6, text: rest } }) },
  { re: /^(\s*)(#{5})\s$/, build: (rest) => ({ type: 'heading', props: { level: 5, text: rest } }) },
  { re: /^(\s*)(#{4})\s$/, build: (rest) => ({ type: 'heading', props: { level: 4, text: rest } }) },
  { re: /^(\s*)(#{3})\s$/, build: (rest) => ({ type: 'heading', props: { level: 3, text: rest } }) },
  { re: /^(\s*)(#{2})\s$/, build: (rest) => ({ type: 'heading', props: { level: 2, text: rest } }) },
  { re: /^(\s*)(#{1})\s$/, build: (rest) => ({ type: 'heading', props: { level: 1, text: rest } }) },
  { re: /^(\s*)(>)\s$/,    build: (rest) => ({ type: 'blockquote', props: { text: rest, source: '' } }) },
  { re: /^(\s*)(1\.)\s$/,  build: (rest) => ({ type: 'list', props: { ordered: true,  items: rest || 'Item 1' } }) },
  { re: /^(\s*)([-*])\s$/, build: (rest) => ({ type: 'list', props: { ordered: false, items: rest || 'Item 1' } }) },
];

export class MarkdownShortcuts {
  constructor(editor) {
    this.editor = editor;
  }

  mount() {
    this.editor.bus.on('inline-edit:started', ({ id }) => this._attach(id));
    this.editor.bus.on('inline-edit:ended',   () => this._detach());
  }

  _attach(blockId) {
    const node = this.editor.getNode(blockId);
    if (!node || !SOURCE_TYPES.has(node.type)) return;
    const anchorEl = this.editor.inlineEdit?.el;
    if (!anchorEl) return;

    const onInput = () => this._maybeTransform(blockId, anchorEl);
    anchorEl.addEventListener('input', onInput);
    this._cleanup = () => anchorEl.removeEventListener('input', onInput);
  }

  _detach() {
    if (this._cleanup) { this._cleanup(); this._cleanup = null; }
  }

  _maybeTransform(blockId, anchorEl) {
    const text = anchorEl.textContent ?? '';
    // O prefixo precisa ter caractere de espaço como último char. Após o
    // espaço pode haver mais conteúdo (caso paste), capturamos em `rest`.
    const spaceIdx = this._firstSpaceAfterPrefix(text);
    if (spaceIdx < 0) return;
    const head = text.slice(0, spaceIdx + 1);
    const rest = text.slice(spaceIdx + 1);

    for (const pat of PATTERNS) {
      if (pat.re.test(head)) {
        const spec = pat.build(rest.trim());
        this._transform(blockId, spec);
        return;
      }
    }
  }

  /**
   * Posição do primeiro espaço que segue um prefixo (algumas séries de
   * caracteres sem espaço). Aceita whitespace inicial mas exige conteúdo
   * compacto antes do espaço — devolve o índice do espaço ou -1.
   */
  _firstSpaceAfterPrefix(text) {
    // Pula whitespace inicial; depois pega tudo até o primeiro espaço.
    const m = /^(\s*)(\S+)(\s)/.exec(text);
    if (!m) return -1;
    return m[1].length + m[2].length;
  }

  /**
   * Substitui o bloco atual pelo novo (cancelando a edição sem persistir o
   * texto-prefixo) e retoma a edição inline no novo bloco.
   */
  _transform(blockId, spec) {
    const ed = this.editor;
    const parent = ed.getParentOf(blockId);
    if (!parent) return;
    const idx = parent.children.findIndex((c) => c.id === blockId);

    // Cancela: descarta o que está no DOM (o prefixo `# `) sem escrever no estado.
    // A reversão visual fica imperceptível porque a removeBlock vem na sequência
    // síncrona e o navegador só pinta após todo o trecho rodar.
    ed.cancelInlineEdit();
    ed.removeBlock(blockId);
    const newId = ed.addBlock(parent.id, spec.type, spec.props ?? {}, idx);
    if (!newId) return;
    ed.selectBlock(newId);
    // Retoma a edição inline para o usuário continuar digitando.
    // List não tem editableProp por padrão; pula nesse caso.
    const NewClass = ed.registry.get(spec.type);
    if (NewClass?.editableProp) {
      // Próximo tick: o Renderer já criou o elemento via state:changed síncrono;
      // pegamos imediatamente.
      ed.startInlineEdit(newId, NewClass.editableProp, {
        multiline: NewClass.editableMultiline === true,
        html:      NewClass.editableHtml === true,
        sanitizeProfile: NewClass.richTextProfile,
      });
    }
  }
}
