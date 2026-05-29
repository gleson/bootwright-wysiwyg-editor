import { el, icon, clear } from '../utils/dom.js';
import { t } from '../i18n/index.js';

/**
 * FindReplace — busca e substituição em todos os textos da página.
 *
 * Painel flutuante modeless (não usa <dialog>): aberto por Ctrl+F ou pelo
 * botão da Topbar; fechado por Esc ou pelo X. Como é modeless, o usuário
 * consegue rolar/clicar o canvas com o painel aberto.
 *
 * Estratégia de busca: varre `editor.state` e procura a query em TODAS as
 * props string de TODOS os nós. Isso pega `paragraph.text` (rich-text HTML),
 * `heading.text`, `blockquote.text/source`, `list.items`, `button.text`,
 * `image.alt`, `link.href`, etc. — cobre o catálogo inteiro sem precisar de
 * configuração por bloco.
 *
 * Limitação aceita v1: a busca opera no valor cru da prop. Em parágrafos com
 * HTML inline (<b>, <i>, etc.) os caracteres de tag fazem parte do valor — uma
 * query "b>" matcharia tags. Para queries normais (palavras) o resultado é o
 * esperado.
 *
 * Destaque visual:
 *   - Range-level via CSS Custom Highlight API (`CSS.highlights`): pinta TODAS
 *     as ocorrências encontradas no textContent renderizado com uma camada
 *     `editor-find-all` (suave) e a ocorrência atual com `editor-find-current`
 *     (forte). Funciona dentro de contenteditable sem mutar o DOM.
 *   - Bloco atual também ganha `.editor-find-hit` (outline âmbar) e
 *     `scrollIntoView` — funciona como indicador secundário e fallback para
 *     props sem texto visível (alt, src, href).
 *   - Para matches em props invisíveis (atributos) a CSS Highlight não pinta
 *     nada — o usuário ainda vê o bloco selecionado pelo outline.
 *
 * Replace:
 *   - "Replace": troca a ocorrência atual exatamente — usa o índice da match
 *     dentro da prop (`matchIndex`) para preservar outras ocorrências.
 *   - "Replace all": para cada (nó, prop) com matches, aplica replace global
 *     numa única atualização. Após qualquer replace, refaz a busca.
 *
 * Histórico: cada update passa por `editor.updateBlock`, então cada replace é
 * um passo de undo. Replace all gera N passos (um por prop alterada).
 */
const HL_ALL = 'editor-find-all';
const HL_CURRENT = 'editor-find-current';
export class FindReplace {
  constructor(editor) {
    this.editor = editor;
    this.canvasWrapper = editor.root.querySelector('[data-region="canvas-wrapper"]');
    this._panel = null;
    this._matches = [];        // [{ id, propKey, start, end }]
    this._currentIdx = -1;
    this._highlightTimer = null;
    // Per-block Range arrays — uma Range por ocorrência visível no textContent
    // do bloco. Construídos em `_paintAllHighlights`, reusados pelo current.
    this._textRanges = new Map();
    this._supportsHighlight = typeof CSS !== 'undefined'
      && typeof CSS.highlights !== 'undefined'
      && typeof Highlight !== 'undefined';
  }

  mount() {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
        // Só capturamos quando o foco NÃO está num input fora do editor —
        // assim não roubamos Ctrl+F do navegador em outros contextos.
        if (!this.editor.root.contains(e.target) && document.activeElement?.tagName !== 'BODY')
          return;
        e.preventDefault();
        this.show();
      }
    });
  }

  /* ---------- UI ---------- */

  show() {
    if (this._panel) {
      this._findInput?.focus();
      this._findInput?.select();
      return;
    }
    this._buildPanel();
    this._panel.dataset.mode = 'find';
    // Painel é `position: absolute` no canvas-wrapper — flutua sobre o canvas
    // sem reduzir a área visível de edição.
    this.canvasWrapper.appendChild(this._panel);
    this._findInput.focus();
    // Pré-preenche com a seleção atual do navegador se houver.
    const sel = document.getSelection()?.toString();
    if (sel && sel.length <= 80) {
      this._findInput.value = sel;
      this._runSearch();
      this._findInput.select();
    }
  }

  /** Abre se fechado, fecha se aberto. Usado pelo botão da topbar. */
  toggle() {
    if (this._panel) this.close();
    else this.show();
  }

  close() {
    if (!this._panel) return;
    this._panel.remove();
    this._panel = null;
    this._matches = [];
    this._currentIdx = -1;
    this._textRanges.clear();
    this._clearHighlight();
    this._clearRangeHighlights();
  }

  _buildPanel() {
    this._findInput = el('input', {
      type: 'text', class: 'editor-find-replace__input form-control form-control-sm',
      placeholder: t('find.placeholder'), 'aria-label': t('find.placeholder'),
      autocomplete: 'off', spellcheck: 'false',
    });
    this._replaceInput = el('input', {
      type: 'text', class: 'editor-find-replace__input form-control form-control-sm',
      placeholder: t('find.replacePlaceholder'), 'aria-label': t('find.replacePlaceholder'),
      autocomplete: 'off', spellcheck: 'false',
    });
    this._counter = el('span', { class: 'editor-find-replace__counter' }, '');
    this._caseToggle = el('input', { type: 'checkbox',
      class: 'form-check-input', id: 'editor-find-case' });
    const caseLabel = el('label', {
      class: 'form-check-label editor-find-replace__case',
      for: 'editor-find-case',
    }, [this._caseToggle, ' Aa']);

    const btnPrev = this._btn('chevron-up', t('find.prev'), () => this._step(-1));
    const btnNext = this._btn('chevron-down', t('find.next'), () => this._step(+1));
    const btnClose = this._btn('x', t('find.close'), () => this.close());
    const btnReplace = el('button', {
      type: 'button', class: 'btn btn-sm btn-outline-secondary',
    }, t('find.replace'));
    const btnReplaceAll = el('button', {
      type: 'button', class: 'btn btn-sm btn-outline-secondary',
    }, t('find.replaceAll'));

    btnReplace.addEventListener('click', () => this._replaceOne());
    btnReplaceAll.addEventListener('click', () => this._replaceAll());

    this._findInput.addEventListener('input', () => this._runSearch());
    this._findInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this._step(e.shiftKey ? -1 : +1);
      } else if (e.key === 'Escape') {
        e.preventDefault(); this.close();
      }
    });
    this._replaceInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this._replaceOne(); }
      else if (e.key === 'Escape') { e.preventDefault(); this.close(); }
    });
    this._caseToggle.addEventListener('change', () => this._runSearch());

    const findRow = el('div', { class: 'editor-find-replace__row' }, [
      this._findInput, this._counter, caseLabel, btnPrev, btnNext, btnClose,
    ]);
    const replaceRow = el('div', { class: 'editor-find-replace__row' }, [
      this._replaceInput, btnReplace, btnReplaceAll,
    ]);
    this._panel = el('div', {
      class: 'editor-find-replace', role: 'dialog', 'aria-label': t('find.title'),
    }, [findRow, replaceRow]);
  }

  _btn(name, title, onClick) {
    const b = el('button', {
      type: 'button', class: 'btn btn-sm btn-outline-secondary', title,
    }, [icon(name)]);
    b.addEventListener('click', onClick);
    return b;
  }

  /* ---------- Busca ---------- */

  _runSearch() {
    const q = this._findInput.value;
    this._matches = [];
    this._currentIdx = -1;
    this._clearHighlight();
    if (!q) { this._renderCounter(); return; }
    const caseSensitive = this._caseToggle.checked;
    const needle = caseSensitive ? q : q.toLowerCase();
    this._walk(this.editor.getRoot(), (node) => {
      if (!node.props) return;
      for (const [propKey, value] of Object.entries(node.props)) {
        if (typeof value !== 'string' || !value) continue;
        const hay = caseSensitive ? value : value.toLowerCase();
        let from = 0;
        while (true) {
          const idx = hay.indexOf(needle, from);
          if (idx < 0) break;
          this._matches.push({ id: node.id, propKey, start: idx, end: idx + needle.length });
          from = idx + needle.length || idx + 1;
        }
      }
    });
    this._paintAllHighlights();
    if (this._matches.length) {
      this._currentIdx = 0;
      this._focusMatch();
    } else {
      this._clearRangeHighlights();
    }
    this._renderCounter();
  }

  _walk(node, visit) {
    visit(node);
    for (const c of node.children ?? []) this._walk(c, visit);
  }

  _renderCounter() {
    clear(this._counter);
    if (!this._matches.length) {
      this._counter.textContent = this._findInput.value ? t('find.noMatch') : '';
      return;
    }
    this._counter.textContent = `${this._currentIdx + 1} / ${this._matches.length}`;
  }

  _step(delta) {
    if (!this._matches.length) return;
    const n = this._matches.length;
    this._currentIdx = (this._currentIdx + delta + n) % n;
    this._focusMatch();
    this._renderCounter();
  }

  _focusMatch() {
    const m = this._matches[this._currentIdx];
    if (!m) return;
    const elNode = this.editor.renderer?.nodeElements.get(m.id);
    if (!elNode) return;
    elNode.scrollIntoView({ block: 'center', behavior: 'smooth' });
    this._highlight(elNode);
    this._paintCurrentHighlight();
    // Seleciona o bloco no editor sem entrar em inline-edit.
    this.editor.selectBlock(m.id);
  }

  _highlight(elNode) {
    this._clearHighlight();
    elNode.classList.add('editor-find-hit');
    this._highlighted = elNode;
    this._highlightTimer = setTimeout(() => {
      elNode.classList.remove('editor-find-hit');
      this._highlighted = null;
    }, 1200);
  }

  _clearHighlight() {
    if (this._highlightTimer) {
      clearTimeout(this._highlightTimer);
      this._highlightTimer = null;
    }
    if (this._highlighted) {
      this._highlighted.classList.remove('editor-find-hit');
      this._highlighted = null;
    }
  }

  /* ---------- Replace ---------- */

  _replaceOne() {
    if (this._currentIdx < 0) return;
    const m = this._matches[this._currentIdx];
    const node = this.editor.getNode(m.id);
    if (!node) return;
    const original = node.props[m.propKey];
    if (typeof original !== 'string') return;
    const replacement = this._replaceInput.value;
    const newValue = original.slice(0, m.start) + replacement + original.slice(m.end);
    this.editor.updateBlock(m.id, { props: { [m.propKey]: newValue } });
    // Re-busca para reposicionar; tenta manter o índice atual.
    const keepIdx = this._currentIdx;
    this._runSearch();
    if (this._matches.length) {
      this._currentIdx = Math.min(keepIdx, this._matches.length - 1);
      this._focusMatch();
      this._renderCounter();
    }
  }

  _replaceAll() {
    if (!this._matches.length) return;
    const replacement = this._replaceInput.value;
    const q = this._findInput.value;
    const caseSensitive = this._caseToggle.checked;
    // Agrupa matches por (nó, prop) — uma única update por prop.
    const buckets = new Map(); // key=`${id}|${propKey}` → { id, propKey }
    for (const m of this._matches) {
      const key = `${m.id}|${m.propKey}`;
      if (!buckets.has(key)) buckets.set(key, { id: m.id, propKey: m.propKey });
    }
    let totalProps = 0;
    for (const { id, propKey } of buckets.values()) {
      const node = this.editor.getNode(id);
      if (!node) continue;
      const value = node.props[propKey];
      if (typeof value !== 'string') continue;
      const re = new RegExp(this._escapeRegex(q), caseSensitive ? 'g' : 'gi');
      const next = value.replace(re, replacement);
      if (next !== value) {
        this.editor.updateBlock(id, { props: { [propKey]: next } });
        totalProps += 1;
      }
    }
    this.editor.notify?.toast?.(t('find.replacedAll', { n: this._matches.length }), 'success');
    this._runSearch();
  }

  _escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /* ---------- Range highlight (CSS Custom Highlight API) ---------- */

  /**
   * Pinta todas as ocorrências (visíveis no textContent) com a camada `all`.
   * Constrói `_textRanges`: para cada bloco, lista de Ranges em ordem de
   * aparição no textContent. Esses Ranges são reaproveitados em
   * `_paintCurrentHighlight` para evitar walk repetido.
   */
  _paintAllHighlights() {
    this._textRanges.clear();
    if (!this._supportsHighlight) return;
    CSS.highlights.delete(HL_ALL);
    CSS.highlights.delete(HL_CURRENT);
    const q = this._findInput?.value;
    if (!q || !this._matches.length) return;
    const caseSensitive = this._caseToggle.checked;
    const blockIds = new Set(this._matches.map((m) => m.id));
    const allRanges = [];
    for (const id of blockIds) {
      const el = this.editor.renderer?.nodeElements.get(id);
      if (!el) continue;
      const ranges = this._findAllTextRanges(el, q, caseSensitive);
      if (ranges.length) {
        this._textRanges.set(id, ranges);
        allRanges.push(...ranges);
      }
    }
    if (allRanges.length) {
      CSS.highlights.set(HL_ALL, new Highlight(...allRanges));
    }
  }

  /**
   * Pinta a ocorrência atual com a camada `current` (mais forte). Quando o
   * match aponta para uma prop invisível (alt, src, href), nenhum Range é
   * encontrado e o highlight fica vazio — o outline de bloco supre.
   */
  _paintCurrentHighlight() {
    if (!this._supportsHighlight) return;
    CSS.highlights.delete(HL_CURRENT);
    const m = this._matches[this._currentIdx];
    if (!m) return;
    const ranges = this._textRanges.get(m.id);
    if (!ranges?.length) return;
    // occurrence-in-block: conta matches anteriores no mesmo bloco. Se o bloco
    // tem mais matches do que ocorrências visíveis (parte das matches está em
    // attrs), o clamp por `ranges.length` mantém o highlight em ALGUMA
    // ocorrência válida — pior caso é apontar para a 1ª ocorrência visível.
    let occIdx = 0;
    for (let i = 0; i < this._currentIdx; i++) {
      if (this._matches[i].id === m.id) occIdx++;
    }
    occIdx = Math.min(occIdx, ranges.length - 1);
    CSS.highlights.set(HL_CURRENT, new Highlight(ranges[occIdx]));
  }

  _clearRangeHighlights() {
    if (!this._supportsHighlight) return;
    CSS.highlights.delete(HL_ALL);
    CSS.highlights.delete(HL_CURRENT);
  }

  /** Encontra todas as ocorrências de `query` no textContent de `root`,
   * devolvendo Ranges nos text nodes correspondentes. */
  _findAllTextRanges(root, query, caseSensitive) {
    if (!query) return [];
    const text = root.textContent || '';
    const hay = caseSensitive ? text : text.toLowerCase();
    const needle = caseSensitive ? query : query.toLowerCase();
    const ranges = [];
    let pos = -1;
    while ((pos = hay.indexOf(needle, pos + 1)) >= 0) {
      const r = this._rangeForTextOffsets(root, pos, pos + query.length);
      if (r) ranges.push(r);
      if (needle.length === 0) break;
    }
    return ranges;
  }

  /** Mapeia offset de `root.textContent` → (text node, offset) e devolve um
   * Range cobrindo [start, end). */
  _rangeForTextOffsets(root, start, end) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let offset = 0;
    let startNode = null, startOffset = 0;
    let endNode = null, endOffset = 0;
    let node;
    while ((node = walker.nextNode())) {
      const len = node.nodeValue.length;
      if (!startNode && offset + len >= start) {
        startNode = node;
        startOffset = start - offset;
      }
      if (offset + len >= end) {
        endNode = node;
        endOffset = end - offset;
        break;
      }
      offset += len;
    }
    if (!startNode || !endNode) return null;
    try {
      const range = document.createRange();
      range.setStart(startNode, startOffset);
      range.setEnd(endNode, endOffset);
      return range;
    } catch {
      return null;
    }
  }
}
