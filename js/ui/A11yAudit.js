import { el, icon, clear } from '../utils/dom.js';
import { t } from '../i18n/index.js';

/**
 * A11yAudit — auditoria mínima de acessibilidade da página.
 *
 * Verifica problemas comuns que dão para detectar com inspeção da árvore JSON,
 * sem precisar renderizar a página inteira:
 *
 *   - Imagens sem `alt`.
 *   - Campos de formulário (FormInput/FormTextarea/FormSelect/FormCheckbox)
 *     sem `label` ou sem `name`.
 *   - Botões/links sem texto.
 *   - Hierarquia de cabeçalhos: avisa se a página começa por nível ≠ 1 ou se
 *     pula níveis (h1 → h3).
 *   - Contraste de cor (WCAG 2.x): usa getComputedStyle dos blocos de texto
 *     renderizados, calcula ratio fg/bg e flagga abaixo de 4.5:1 (texto
 *     normal) ou 3:1 (texto grande). Walk até achar bg não-transparente —
 *     fallback white quando tudo é transparente até o root.
 *
 * Cada issue é `{ id, severity, message }` onde `id` é o bloco que originou
 * (ou null para issues estruturais). O painel mostra a lista e cada item
 * permite "ir ao bloco" (selectBlock + scroll).
 *
 * Severidades:
 *   error   — viola WCAG AA frontalmente (alt faltando, label faltando,
 *             contraste abaixo do limiar).
 *   warning — provavelmente errado mas pode ser intencional (heading pulado).
 */

const FORM_TYPES = new Set(['form-input', 'form-textarea', 'form-select', 'form-checkbox']);
const TEXT_TYPES = new Set([
  'heading', 'paragraph', 'button', 'link', 'blockquote', 'list',
  'form-submit', 'alert', 'badge',
]);

export class A11yAudit {
  constructor(editor) {
    this.editor = editor;
  }

  /** Roda a auditoria e devolve a lista de issues. */
  run() {
    const issues = [];
    const headings = [];
    this._walk(this.editor.getRoot(), (node) => {
      const props = node.props || {};
      switch (node.type) {
        case 'image':
          if (!(props.alt && String(props.alt).trim())) {
            issues.push({ id: node.id, severity: 'error', message: t('a11y.img.alt') });
          }
          break;
        case 'button':
          if (!(props.text && String(props.text).trim())) {
            issues.push({ id: node.id, severity: 'error', message: t('a11y.btn.text') });
          }
          break;
        case 'heading':
          headings.push({ id: node.id, level: Number(props.level) || 0 });
          if (!(props.text && String(props.text).trim())) {
            issues.push({ id: node.id, severity: 'warning', message: t('a11y.heading.empty') });
          }
          break;
        case 'form-submit':
          if (!(props.text && String(props.text).trim())) {
            issues.push({ id: node.id, severity: 'error', message: t('a11y.btn.text') });
          }
          break;
      }
      if (FORM_TYPES.has(node.type)) {
        if (!(props.label && String(props.label).trim())) {
          issues.push({ id: node.id, severity: 'error', message: t('a11y.field.label') });
        }
        if (!(props.name && String(props.name).trim())) {
          issues.push({ id: node.id, severity: 'warning', message: t('a11y.field.name') });
        }
      }
      // Contraste de cor — só faz sentido em blocos que renderizam texto visível.
      if (TEXT_TYPES.has(node.type)) {
        const contrastIssue = this._checkContrast(node);
        if (contrastIssue) issues.push(contrastIssue);
      }
    });

    // Hierarquia de headings.
    if (headings.length) {
      if (headings[0].level !== 1) {
        issues.push({ id: headings[0].id, severity: 'warning',
          message: t('a11y.heading.first', { level: headings[0].level }) });
      }
      for (let i = 1; i < headings.length; i++) {
        const diff = headings[i].level - headings[i - 1].level;
        if (diff > 1) {
          issues.push({ id: headings[i].id, severity: 'warning',
            message: t('a11y.heading.skip', { from: headings[i - 1].level, to: headings[i].level }) });
        }
      }
    }
    return issues;
  }

  _walk(node, visit) {
    visit(node);
    for (const c of node.children ?? []) this._walk(c, visit);
  }

  /* ---------- Contraste WCAG ---------- */

  /**
   * Devolve uma issue se o ratio fg/bg do bloco está abaixo do limiar WCAG AA
   * (4.5:1 normal, 3:1 large). Limiar é decidido pelo font-size/weight do
   * elemento que de fato contém o texto.
   *
   * Edge cases: blocos sem texto visível renderizado, ou cujo texto-target
   * está em DOM oculto (display:none) devolvem null silenciosamente.
   */
  _checkContrast(node) {
    const elNode = this.editor.renderer?.nodeElements.get(node.id);
    if (!elNode || !elNode.isConnected) return null;
    const target = this._textTarget(elNode);
    if (!target) return null;
    const cs = getComputedStyle(target);
    const fg = this._parseColor(cs.color);
    if (!fg) return null;
    const bg = this._effectiveBg(target);
    if (!bg) return null;
    const ratio = this._contrastRatio(fg, bg);
    if (!Number.isFinite(ratio)) return null;
    const fontSize = parseFloat(cs.fontSize) || 16;
    const weight = parseInt(cs.fontWeight, 10) || 400;
    const isLarge = fontSize >= 24 || (fontSize >= 18.66 && weight >= 700);
    const threshold = isLarge ? 3 : 4.5;
    if (ratio >= threshold) return null;
    return {
      id: node.id,
      severity: 'error',
      message: t('a11y.contrast.fail', {
        ratio: ratio.toFixed(2),
        threshold: threshold.toFixed(1),
      }),
    };
  }

  /** Acha o primeiro descendente que de fato contém texto não-branco. */
  _textTarget(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) =>
        n.nodeValue && n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
    });
    const node = walker.nextNode();
    return node?.parentElement || null;
  }

  /** Parse de `rgb(...)`/`rgba(...)`. Devolve [r,g,b] ou null se transparente. */
  _parseColor(s) {
    if (!s) return null;
    const m = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/);
    if (!m) return null;
    const a = m[4] === undefined ? 1 : Number(m[4]);
    if (a < 0.1) return null;
    return [Number(m[1]), Number(m[2]), Number(m[3])];
  }

  /** Sobe pela árvore até achar o primeiro background opaco. Fallback white. */
  _effectiveBg(elNode) {
    let cur = elNode;
    while (cur && cur.nodeType === 1) {
      const bg = this._parseColor(getComputedStyle(cur).backgroundColor);
      if (bg) return bg;
      if (cur === document.documentElement) break;
      cur = cur.parentElement;
    }
    return [255, 255, 255];
  }

  /** Luminância relativa WCAG (sRGB → linear). */
  _relLuminance([r, g, b]) {
    const lin = (v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  }

  _contrastRatio(fg, bg) {
    const L1 = this._relLuminance(fg);
    const L2 = this._relLuminance(bg);
    const [a, b] = L1 > L2 ? [L1, L2] : [L2, L1];
    return (a + 0.05) / (b + 0.05);
  }

  /* ---------- Painel ---------- */

  show() {
    const issues = this.run();
    const dialog = el('dialog', { class: 'editor-a11y-dialog' });

    const list = el('ul', { class: 'editor-a11y-dialog__list' });
    const counter = el('div', { class: 'editor-a11y-dialog__counter' });

    const refresh = () => {
      const fresh = this.run();
      clear(list);
      counter.textContent = fresh.length
        ? t('a11y.summary', { n: fresh.length })
        : t('a11y.allGood');
      if (!fresh.length) {
        list.appendChild(el('li', { class: 'editor-a11y-dialog__empty' },
          [icon('check2-circle'), ' ', t('a11y.allGood')]));
        return;
      }
      for (const issue of fresh) {
        const sevIcon = issue.severity === 'error' ? 'exclamation-octagon-fill' : 'exclamation-triangle-fill';
        const li = el('li', { class: `editor-a11y-dialog__item is-${issue.severity}` }, [
          icon(sevIcon, 'editor-a11y-dialog__sev'),
          el('span', { class: 'editor-a11y-dialog__msg' }, issue.message),
          issue.id
            ? this._goBtn(issue.id, dialog)
            : null,
        ]);
        list.appendChild(li);
      }
    };

    const refreshBtn = el('button', { type: 'button', class: 'btn btn-sm btn-outline-secondary' },
      [icon('arrow-clockwise'), ' ', t('a11y.refresh')]);
    refreshBtn.addEventListener('click', refresh);

    const closeBtn = el('button', { type: 'button', class: 'btn btn-sm btn-primary' }, t('common.close'));
    closeBtn.addEventListener('click', () => dialog.close());

    dialog.append(
      el('div', { class: 'editor-a11y-dialog__header' }, [
        el('h5', { class: 'mb-0' }, [icon('universal-access'), ' ', t('a11y.title')]),
        counter,
      ]),
      list,
      el('div', { class: 'd-flex gap-2 justify-content-end mt-2' }, [refreshBtn, closeBtn]),
    );

    document.body.appendChild(dialog);
    dialog.addEventListener('close', () => dialog.remove());
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
    dialog.showModal();
    refresh();
  }

  _goBtn(blockId, dialog) {
    const btn = el('button', { type: 'button',
      class: 'btn btn-sm btn-outline-secondary editor-a11y-dialog__go' },
      [icon('arrow-up-right-circle'), ' ', t('a11y.goto')]);
    btn.addEventListener('click', () => {
      dialog.close();
      this.editor.selectBlock(blockId);
      const elNode = this.editor.renderer?.nodeElements.get(blockId);
      elNode?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
    return btn;
  }
}
