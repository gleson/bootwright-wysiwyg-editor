import { el, icon } from '../utils/dom.js';

/**
 * RichTextToolbar — barra flutuante de formatação que aparece durante a
 * edição inline de blocos `editableHtml`.
 *
 * Botões: Bold / Italic / Underline / Link / Clear.
 * Implementação via document.execCommand (bem suportado em todos os browsers
 * modernos para esses 5 comandos, apesar do "deprecated" formal do spec).
 *
 * Visibilidade: comporta-se como "bubble menu" — a barra é criada quando a
 * edição inline começa, mas só fica visível enquanto há uma seleção de texto
 * NÃO colapsada dentro do elemento em edição. Colapsou o caret, clicou fora,
 * ou a seleção saiu do bloco → some. Sem isso ela ficava pendurada sobre o
 * texto mesmo depois de o usuário desfazer a seleção.
 *
 * Posicionamento: ancorada acima do retângulo da própria seleção (não do bloco
 * inteiro), com folga suficiente para não cobrir a linha selecionada; cai para
 * baixo quando não há espaço acima. Recalcula em scroll, resize e
 * selectionchange.
 */

/** Distância vertical entre a barra e o texto selecionado, em px. */
const GAP = 12;

export class RichTextToolbar {
  constructor(editor) {
    this.editor = editor;
    this.toolbar = null;
    this.editingEl = null;
    this._rafId = null;
    /** Trava o auto-hide enquanto um dialog (link) rouba a seleção. */
    this._pinned = false;
  }

  mount() {
    this.editor.bus.on('inline-edit:started', ({ id, useHtml }) => {
      if (!useHtml) return;
      this._show(id);
    });
    this.editor.bus.on('inline-edit:ended', () => this._hide());
    document.addEventListener('selectionchange', () => this._sync());
    window.addEventListener('scroll', () => this._sync(), true);
    window.addEventListener('resize',  () => this._sync());
  }

  _show(id) {
    this.editingEl = this.editor.renderer?.nodeElements.get(id);
    if (!this.editingEl) return;

    this.toolbar = el('div', {
      class: 'editor-rich-toolbar',
      role: 'toolbar',
      'aria-label': 'Formatação de texto',
      hidden: true,
    });
    this.toolbar.append(
      this._btn('Negrito (Ctrl+B)',    'type-bold',      () => this._exec('bold')),
      this._btn('Itálico (Ctrl+I)',    'type-italic',    () => this._exec('italic')),
      this._btn('Sublinhado (Ctrl+U)', 'type-underline', () => this._exec('underline')),
      this._sep(),
      this._btn('Inserir/editar link', 'link-45deg',     () => this._link()),
      this._btn('Remover link',        'link',           () => this._exec('unlink')),
      this._sep(),
      this._btn('Limpar formatação',   'eraser',         () => this._clearFormatting()),
    );
    document.body.appendChild(this.toolbar);
    this._sync();

    // Ctrl+B/I/U dentro do contenteditable já são nativos do browser, mas
    // adicionamos handlers extras pra garantir que o comando dispare mesmo
    // se o browser bloquear (alguns motores).
    this._keyHandler = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'b') { e.preventDefault(); this._exec('bold'); }
      else if (k === 'i') { e.preventDefault(); this._exec('italic'); }
      else if (k === 'u') { e.preventDefault(); this._exec('underline'); }
    };
    this.editingEl.addEventListener('keydown', this._keyHandler);
  }

  _hide() {
    if (this.editingEl && this._keyHandler) {
      this.editingEl.removeEventListener('keydown', this._keyHandler);
    }
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
    this.toolbar?.remove();
    this.toolbar = null;
    this.editingEl = null;
    this._keyHandler = null;
    this._pinned = false;
  }

  /**
   * Range da seleção atual, se ela for uma seleção de texto real (não
   * colapsada) contida no elemento em edição. Caso contrário, null.
   */
  _activeRange() {
    if (!this.editingEl) return null;
    const sel = document.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return null;
    if (!this.editingEl.contains(range.startContainer)) return null;
    if (!this.editingEl.contains(range.endContainer)) return null;
    if (!range.toString().trim()) return null;
    return range;
  }

  /**
   * Decide visibilidade + posição a partir da seleção atual. Chamado em
   * selectionchange, scroll e resize — por isso passa pelo rAF.
   */
  _sync() {
    if (!this.toolbar || !this.editingEl) return;
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = requestAnimationFrame(() => {
      this._rafId = null;
      if (!this.toolbar || !this.editingEl) return;
      const range = this._activeRange();
      if (!range) {
        // Enquanto o dialog de link está aberto a seleção some do documento —
        // manter a barra visível evita o "pisca-some" no meio da ação.
        if (!this._pinned) this.toolbar.hidden = true;
        return;
      }
      this.toolbar.hidden = false;
      this._place(range);
    });
  }

  /** Posiciona a barra acima (ou abaixo) do retângulo da seleção. */
  _place(range) {
    // getClientRects() dá um retângulo por linha; o primeiro é onde a seleção
    // começa — é lá que a barra deve aparecer numa seleção multi-linha.
    const rects = range.getClientRects();
    const rect = rects.length ? rects[0] : range.getBoundingClientRect();
    if (!rect || (!rect.width && !rect.height)) return;

    const tw = this.toolbar.offsetWidth;
    const th = this.toolbar.offsetHeight;

    // Acima da linha selecionada; cai para baixo se não couber na viewport.
    const above = rect.top - th - GAP;
    const top = above < 8 ? rect.bottom + GAP : above;

    // Centralizada no trecho selecionado, presa às bordas da janela.
    const centered = rect.left + (rect.width / 2) - (tw / 2);
    const left = Math.max(8, Math.min(centered, window.innerWidth - tw - 8));

    this.toolbar.style.top  = `${top + window.scrollY}px`;
    this.toolbar.style.left = `${left + window.scrollX}px`;
  }

  _btn(title, iconName, onClick) {
    const btn = el('button', {
      type: 'button',
      class: 'editor-rich-toolbar__btn',
      title, 'aria-label': title,
    }, [icon(iconName)]);
    // mousedown (não click) → não rouba o foco do contenteditable, e a
    // selection do usuário fica intacta para execCommand operar nela.
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      onClick();
      // Re-foca o elemento em edição para o caret continuar visível.
      this.editingEl?.focus();
    });
    return btn;
  }

  _sep() {
    return el('div', { class: 'editor-rich-toolbar__sep', 'aria-hidden': 'true' });
  }

  _exec(command, value = null) {
    if (!this.editingEl) return;
    try {
      document.execCommand(command, false, value);
    } catch (err) {
      console.warn(`[RichTextToolbar] execCommand "${command}" falhou:`, err);
    }
  }

  _clearFormatting() {
    if (!this.editingEl) return;
    const sel = document.getSelection();

    // Se não houver seleção ativa OU ela estiver colapsada, abrange tudo no
    // editável — execCommand('removeFormat') é no-op em range colapsado.
    const hasRange = sel?.rangeCount > 0;
    const collapsed = !hasRange || sel.getRangeAt(0).collapsed;
    if (collapsed) {
      const range = document.createRange();
      range.selectNodeContents(this.editingEl);
      sel.removeAllRanges();
      sel.addRange(range);
    }

    document.execCommand('removeFormat', false, null);
    document.execCommand('unlink', false, null);

    // execCommand não remove `class` nem spans com `style` — limpeza manual.
    // Escopo: todo o editável (o range pode ter sido normalizado).
    // Inclui o próprio editingEl: ele pode ter style/class herdado do render
    // do bloco (ex.: white-space: pre-wrap no Paragraph) que o usuário quer
    // ver embora. Se o render reaplicar, é coisa do bloco — não da seleção.
    const stylish = [this.editingEl, ...this.editingEl.querySelectorAll('[style], [class]')];
    for (const node of stylish) {
      node.removeAttribute('style');
      node.removeAttribute('class');
    }
    // Desembrulha <span> remanescentes (já sem atributos úteis).
    for (const span of this.editingEl.querySelectorAll('span')) {
      const parent = span.parentNode;
      while (span.firstChild) parent.insertBefore(span.firstChild, span);
      parent.removeChild(span);
    }

    // Notifica para o blur/sync detectar mudança.
    this.editingEl.dispatchEvent(new InputEvent('input', { bubbles: true }));
  }

  async _link() {
    if (!this.editingEl) return;
    // Lê estado atual do link se cursor está dentro de <a>
    const sel = document.getSelection();
    let currentLink = null;
    if (sel?.rangeCount) {
      const node = sel.getRangeAt(0).startContainer;
      const a = (node instanceof Element ? node : node.parentElement)?.closest?.('a');
      if (a) {
        currentLink = {
          el: a,
          url:    a.getAttribute('href')   || '',
          target: a.getAttribute('target') || '',
          rel:    a.getAttribute('rel')    || '',
        };
      }
    }
    // Salva a Range ANTES de abrir o dialog — o modal mata a selection.
    const savedRange = sel?.rangeCount ? sel.getRangeAt(0).cloneRange() : null;

    // O dialog limpa a seleção do documento; sem o pin, o _sync esconderia a
    // barra no meio da ação e ela não voltaria ao confirmar.
    this._pinned = true;
    let result;
    try {
      result = await this.editor.notify.linkDialog({
        url:    currentLink?.url    ?? '',
        target: currentLink?.target ?? '',
        rel:    currentLink?.rel    ?? '',
        hasLink: !!currentLink,
      });
    } finally {
      this._pinned = false;
    }
    if (result === null) { this._sync(); return; }

    // Restaura a selection
    if (savedRange) {
      const s = document.getSelection();
      s.removeAllRanges();
      s.addRange(savedRange);
    }
    this.editingEl.focus();

    // "Remover link"
    if (result.remove) {
      this._exec('unlink');
      this.editingEl.dispatchEvent(new InputEvent('input', { bubbles: true }));
      return;
    }

    if (!result.url) {
      this._exec('unlink');
    } else if (currentLink) {
      // Edição direta — não usa execCommand pra não perder o range em texto que
      // já está envolvido pelo <a>. Atualiza atributos no elemento existente.
      currentLink.el.setAttribute('href', result.url);
      this._setOrRemove(currentLink.el, 'target', result.target);
      this._setOrRemove(currentLink.el, 'rel',    result.rel);
    } else {
      // Inserção nova
      this._exec('createLink', result.url);
      // Pega o(s) link(s) recém-criado(s) e aplica target/rel.
      const links = this.editingEl.querySelectorAll(
        `a[href="${CSS.escape(result.url)}"]`
      );
      for (const a of links) {
        this._setOrRemove(a, 'target', result.target);
        this._setOrRemove(a, 'rel',    result.rel);
      }
    }
    // Trigger pra blur/sync detectar mudança.
    this.editingEl.dispatchEvent(new InputEvent('input', { bubbles: true }));
  }

  _setOrRemove(el, attr, value) {
    if (value) el.setAttribute(attr, value);
    else       el.removeAttribute(attr);
  }

}
