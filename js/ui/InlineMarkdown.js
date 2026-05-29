/**
 * InlineMarkdown — atalhos de formatação inline durante edição rich-text.
 *
 * Padrões reconhecidos ao terminar de digitar o delimitador final:
 *   **texto**   →  <b>texto</b>          (bold com `*`)
 *   __texto__   →  <b>texto</b>          (bold com `_`)
 *   *texto*     →  <i>texto</i>          (italic com `*`)
 *   _texto_     →  <i>texto</i>          (italic com `_`)
 *   [texto](url) → <a href="url">texto</a>
 *
 * Só dispara em blocos com `editableHtml = true` (Paragraph). Em blocos de
 * texto puro (Heading/Button/…) os caracteres ficam literais — sem formatação.
 *
 * Detecção:
 *   - A cada `input` no editável, scaneia `textContent.slice(0, caret)`.
 *   - Tenta padrões na ordem: bold★ → bold _ → italic★ → italic _ → link.
 *   - Em match: cria Range mapeando o intervalo no textContent para os text
 *     nodes reais, `deleteContents()`, `insertNode(<b/i/a>)`, posiciona o caret
 *     logo após o novo elemento (assim o que o usuário digitar a seguir fica
 *     FORA da formatação).
 *
 * Limitações aceitas v1:
 *   - O perfil rich-text permite `<a>` e `<b>/<i>` mas não `<code>` — então
 *     `` `code` `` não é reconhecido (seria sanitizado no commit).
 *   - Padrão precisa caber em um único parágrafo (sem `<br>` no meio).
 *   - Não retroativo: pattern já consolidado no estado não é re-detectado.
 */

const RE_BOLD_STAR   = /\*\*([^*\n]+?)\*\*$/;
const RE_BOLD_UND    = /__([^_\n]+?)__$/;
const RE_ITALIC_STAR = /(?<!\*)\*([^*\n]+?)\*$/;
const RE_ITALIC_UND  = /(?<![_\w])_([^_\n]+?)_$/;
const RE_LINK        = /\[([^\]\n]+)\]\(([^)\s\n]+)\)$/;

export class InlineMarkdown {
  constructor(editor) {
    this.editor = editor;
  }

  mount() {
    this.editor.bus.on('inline-edit:started', ({ id, useHtml }) => {
      if (!useHtml) return;
      this._attach(id);
    });
    this.editor.bus.on('inline-edit:ended', () => this._detach());
  }

  _attach(blockId) {
    const anchorEl = this.editor.inlineEdit?.el;
    if (!anchorEl) return;
    const onInput = () => this._maybeTransform(anchorEl);
    anchorEl.addEventListener('input', onInput);
    this._cleanup = () => anchorEl.removeEventListener('input', onInput);
  }

  _detach() {
    if (this._cleanup) { this._cleanup(); this._cleanup = null; }
  }

  _maybeTransform(root) {
    const caret = this._caretOffsetIn(root);
    if (caret < 0) return;
    const text = root.textContent ?? '';
    const before = text.slice(0, caret);

    // Tenta os padrões em ordem de especificidade.
    let m, kind, content, href;
    if ((m = RE_BOLD_STAR.exec(before)))      { kind = 'b'; content = m[1]; }
    else if ((m = RE_BOLD_UND.exec(before)))  { kind = 'b'; content = m[1]; }
    else if ((m = RE_ITALIC_STAR.exec(before))) { kind = 'i'; content = m[1]; }
    else if ((m = RE_ITALIC_UND.exec(before)))  { kind = 'i'; content = m[1]; }
    else if ((m = RE_LINK.exec(before)))      { kind = 'a'; content = m[1]; href = m[2]; }
    else return;

    const matchEnd = before.length;
    const matchStart = matchEnd - m[0].length;
    const range = this._rangeForTextOffsets(root, matchStart, matchEnd);
    if (!range) return;

    // Cria o elemento de substituição.
    const node = document.createElement(kind);
    node.textContent = content;
    if (kind === 'a') {
      node.setAttribute('href', href);
      // rel/target ficam por conta do usuário no painel de propriedades.
    }

    range.deleteContents();
    range.insertNode(node);

    // Posiciona o caret depois do elemento inserido. Garante que o usuário
    // continua digitando FORA do <b>/<i>/<a>.
    const sel = document.getSelection();
    const after = document.createRange();
    after.setStartAfter(node);
    after.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(after);
  }

  /* ---------- Util ---------- */

  /** Offset do caret (em caracteres do textContent) dentro de `root`. */
  _caretOffsetIn(root) {
    const sel = document.getSelection();
    if (!sel?.rangeCount) return -1;
    const range = sel.getRangeAt(0);
    if (!root.contains(range.endContainer)) return -1;
    const pre = range.cloneRange();
    pre.selectNodeContents(root);
    pre.setEnd(range.endContainer, range.endOffset);
    return pre.toString().length;
  }

  /**
   * Mapeia um intervalo `[startOffset, endOffset]` (em textContent) para um
   * `Range` real cobrindo os text nodes correspondentes em `root`.
   */
  _rangeForTextOffsets(root, startOffset, endOffset) {
    let pos = 0;
    let startNode = null, startInNodeOffset = 0;
    let endNode = null, endInNodeOffset = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const len = node.nodeValue.length;
      const nodeEnd = pos + len;
      if (startNode == null && nodeEnd >= startOffset) {
        startNode = node;
        startInNodeOffset = startOffset - pos;
      }
      if (endNode == null && nodeEnd >= endOffset) {
        endNode = node;
        endInNodeOffset = endOffset - pos;
        break;
      }
      pos = nodeEnd;
    }
    if (!startNode || !endNode) return null;
    const range = document.createRange();
    range.setStart(startNode, startInNodeOffset);
    range.setEnd(endNode, endInNodeOffset);
    return range;
  }
}
