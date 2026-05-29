import { el, icon, clear } from '../utils/dom.js';

/**
 * Notify — sistema de notificação não-bloqueante.
 *
 *   editor.notify.toast('Salvo')          — toast info, auto-dismiss
 *   editor.notify.toast('Erro', 'error')  — toast vermelho
 *   await editor.notify.confirm('OK?')    — Promise<boolean>
 *   await editor.notify.prompt('Nome:', 'Default') — Promise<string|null>
 *
 * Substitui alert()/confirm()/prompt() nativos: visual integrado, foco
 * gerenciado, fechamento por Esc, click no backdrop NÃO fecha (evita
 * cancelar inadvertidamente).
 */
export class Notify {
  constructor() {
    this.toastContainer = null;
  }

  mount() {
    this.toastContainer = el('div', {
      class: 'editor-toast-container',
      role: 'region',
      'aria-label': 'Notificações',
      'aria-live': 'polite',
    });
    document.body.appendChild(this.toastContainer);
  }

  /* ---------- Toast ---------- */

  /**
   * @param {string} message
   * @param {'info'|'success'|'warning'|'error'} type
   * @param {{ duration?: number, action?: { label, onClick } }} opts
   */
  toast(message, type = 'info', opts = {}) {
    if (!this.toastContainer) this.mount();
    const duration = opts.duration ?? (type === 'error' ? 6000 : 3500);
    const iconName = TOAST_ICONS[type] ?? 'info-circle';

    const closeBtn = el('button', {
      type: 'button',
      class: 'editor-toast__close',
      title: 'Fechar',
      'aria-label': 'Fechar notificação',
    }, [icon('x')]);

    const toast = el('div', {
      class: `editor-toast editor-toast--${type}`,
      role: type === 'error' ? 'alert' : 'status',
    }, [
      icon(iconName, 'editor-toast__icon'),
      el('span', { class: 'editor-toast__msg' }, String(message)),
      opts.action ? this._actionBtn(opts.action, () => dismiss()) : null,
      closeBtn,
    ]);

    let timer = null;
    const dismiss = () => {
      if (timer) clearTimeout(timer);
      toast.classList.add('editor-toast--exit');
      setTimeout(() => toast.remove(), 200);
    };
    closeBtn.addEventListener('click', dismiss);
    if (duration > 0) timer = setTimeout(dismiss, duration);

    this.toastContainer.appendChild(toast);
    return dismiss;
  }

  _actionBtn({ label, onClick }, dismiss) {
    const btn = el('button', {
      type: 'button',
      class: 'editor-toast__action btn btn-sm btn-link p-0',
    }, label);
    btn.addEventListener('click', () => {
      try { onClick(); } finally { dismiss(); }
    });
    return btn;
  }

  /* ---------- Confirm ---------- */

  /**
   * @param {string} message
   * @param {{ title?, okLabel?, cancelLabel?, danger?: boolean }} opts
   * @returns {Promise<boolean>}
   */
  confirm(message, opts = {}) {
    return new Promise((resolve) => {
      const dialog = this._buildDialog({
        title: opts.title ?? 'Confirmação',
        body: el('p', { class: 'mb-0' }, String(message)),
        actions: [
          { label: opts.cancelLabel ?? 'Cancelar', value: false, secondary: true },
          {
            label: opts.okLabel ?? 'OK',
            value: true,
            primary: true,
            danger: opts.danger === true,
          },
        ],
      }, resolve);
      this._open(dialog);
    });
  }

  /* ---------- Prompt ---------- */

  /**
   * @param {string} message
   * @param {string} defaultValue
   * @param {{ title?, okLabel?, cancelLabel?, placeholder?, multiline?: boolean }} opts
   * @returns {Promise<string|null>} null = cancelado
   */
  prompt(message, defaultValue = '', opts = {}) {
    return new Promise((resolve) => {
      const input = opts.multiline
        ? el('textarea', {
            class: 'form-control form-control-sm',
            rows: 4, placeholder: opts.placeholder ?? '',
          })
        : el('input', {
            type: 'text',
            class: 'form-control form-control-sm',
            placeholder: opts.placeholder ?? '',
          });
      input.value = defaultValue ?? '';

      const body = el('div', {}, [
        el('p', { class: 'mb-2' }, String(message)),
        input,
      ]);

      const onResolve = (val) => resolve(val);

      const dialog = this._buildDialog({
        title: opts.title ?? 'Entrada',
        body,
        actions: [
          { label: opts.cancelLabel ?? 'Cancelar', value: null, secondary: true },
          { label: opts.okLabel ?? 'OK',           value: () => input.value, primary: true },
        ],
      }, onResolve);

      // Enter (single-line) confirma
      if (!opts.multiline) {
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            dialog.querySelector('[data-action="primary"]').click();
          }
        });
      }

      this._open(dialog);
      // Foco no input com texto pré-selecionado.
      requestAnimationFrame(() => {
        input.focus();
        if (typeof input.select === 'function') input.select();
      });
    });
  }

  /* ---------- Link dialog ---------- */

  /**
   * Dialog dedicado para edição de link com URL + opções comuns.
   *
   * @param {{ url?, target?, rel?, hasLink?: boolean }} current
   * @returns {Promise<null | { url: string, target: string, rel: string, remove?: boolean }>}
   *   - resolve(null) → cancelado
   *   - resolve({ remove: true }) → usuário clicou "Remover link"
   *   - resolve({ url, target, rel }) → aplicar
   */
  linkDialog(current = {}) {
    return new Promise((resolve) => {
      const urlIn = el('input', {
        type: 'url',
        class: 'form-control form-control-sm',
        placeholder: 'https://exemplo.com',
        value: current.url ?? '',
      });

      const newTabId = `lk-newtab-${Date.now()}`;
      const newTabChk = el('input', {
        type: 'checkbox', class: 'form-check-input', id: newTabId,
      });
      newTabChk.checked = current.target === '_blank';

      const nofollowId = `lk-nofollow-${Date.now()}`;
      const nofollowChk = el('input', {
        type: 'checkbox', class: 'form-check-input', id: nofollowId,
      });
      nofollowChk.checked = /\bnofollow\b/i.test(current.rel ?? '');

      const body = el('div', {}, [
        el('label', { class: 'form-label small mb-1' }, 'URL'),
        urlIn,
        el('small', { class: 'text-muted d-block mt-1 mb-2' },
          'https://, mailto:, tel: ou âncora interna (#secao).'),
        el('div', { class: 'form-check form-switch mt-2' }, [
          newTabChk,
          el('label', { class: 'form-check-label small', for: newTabId },
            'Abrir em nova aba (target=_blank)'),
        ]),
        el('div', { class: 'form-check form-switch mt-1' }, [
          nofollowChk,
          el('label', { class: 'form-check-label small', for: nofollowId },
            'Não seguir (rel=nofollow) — útil para links pagos ou não confiáveis'),
        ]),
      ]);

      const buildResult = () => {
        const url = urlIn.value.trim();
        if (!url) return null;
        const target = newTabChk.checked ? '_blank' : '';
        const rels = [];
        if (newTabChk.checked) rels.push('noopener', 'noreferrer');
        if (nofollowChk.checked) rels.push('nofollow');
        return { url, target, rel: [...new Set(rels)].join(' ') };
      };

      const actions = [
        { label: 'Cancelar', value: null, secondary: true },
      ];
      if (current.hasLink) {
        actions.push({ label: 'Remover link', value: { remove: true }, danger: true });
      }
      actions.push({ label: 'Aplicar', value: buildResult, primary: true });

      const dialog = this._buildDialog({
        title: current.hasLink ? 'Editar link' : 'Inserir link',
        body, actions,
      }, resolve);

      // Enter no campo URL aplica.
      urlIn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          dialog.querySelector('[data-action="primary"]').click();
        }
      });

      this._open(dialog);
      requestAnimationFrame(() => {
        urlIn.focus();
        if (typeof urlIn.select === 'function') urlIn.select();
      });
    });
  }

  /* ---------- Form genérico ---------- */

  /**
   * Modal genérico com múltiplos campos editáveis.
   *
   * @param {{
   *   title: string,
   *   description?: string,
   *   fields: Array<{ key, label, type?: 'text'|'textarea', value?, placeholder?, help? }>,
   *   okLabel?, cancelLabel?,
   *   extraActions?: Array<{ label, value }>,
   * }} opts
   * @returns {Promise<null | { [key]: string } | any>}
   *   - null = cancelado
   *   - object = valores dos campos
   *   - extraAction.value = quando o usuário clicou numa ação extra
   */
  formDialog(opts) {
    return new Promise((resolve) => {
      const inputs = {};
      const bodyChildren = [];
      if (opts.description) {
        bodyChildren.push(el('p', { class: 'small text-muted mb-2' }, opts.description));
      }
      for (const f of opts.fields) {
        const id = `nf-${f.key}-${Date.now()}`;
        const input = f.type === 'textarea'
          ? el('textarea', { id, class: 'form-control form-control-sm', rows: 3,
                             placeholder: f.placeholder ?? '' })
          : el('input', { id, type: 'text', class: 'form-control form-control-sm',
                          placeholder: f.placeholder ?? '' });
        input.value = f.value ?? '';
        inputs[f.key] = input;
        bodyChildren.push(el('div', { class: 'mb-2' }, [
          el('label', { class: 'form-label small mb-1', for: id }, f.label),
          input,
          f.help ? el('small', { class: 'text-muted d-block mt-1' }, f.help) : null,
        ]));
      }
      const body = el('div', {}, bodyChildren);

      const collect = () => {
        const out = {};
        for (const [k, inp] of Object.entries(inputs)) out[k] = inp.value;
        return out;
      };

      const actions = [
        { label: opts.cancelLabel ?? 'Cancelar', value: null, secondary: true },
      ];
      for (const ex of opts.extraActions ?? []) {
        actions.push({ label: ex.label, value: ex.value, danger: ex.danger });
      }
      actions.push({ label: opts.okLabel ?? 'Salvar', value: collect, primary: true });

      const dialog = this._buildDialog({ title: opts.title, body, actions }, resolve);
      // Enter no primeiro input single-line confirma.
      const firstInput = bodyChildren.flatMap((c) => Array.from(c.querySelectorAll?.('input,textarea') ?? []))[0];
      if (firstInput && firstInput.tagName === 'INPUT') {
        firstInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            dialog.querySelector('[data-action="primary"]').click();
          }
        });
      }
      this._open(dialog);
      requestAnimationFrame(() => {
        firstInput?.focus();
        if (typeof firstInput?.select === 'function') firstInput.select();
      });
    });
  }

  /* ---------- Helpers internos ---------- */

  _buildDialog({ title, body, actions }, resolve) {
    const dialog = el('dialog', { class: 'editor-modal' });

    const header = el('div', { class: 'editor-modal__header' }, [
      el('strong', {}, title),
      this._closeBtn(() => { dialog.close(); resolve(actions[0]?.value ?? null); }),
    ]);

    const bodyWrap = el('div', { class: 'editor-modal__body' }, [body]);

    const footer = el('div', { class: 'editor-modal__footer' });
    for (const a of actions) {
      const cls = a.primary
        ? (a.danger ? 'btn btn-sm btn-danger' : 'btn btn-sm btn-primary')
        : (a.danger ? 'btn btn-sm btn-outline-danger' : 'btn btn-sm btn-secondary');
      const btn = el('button', {
        type: 'button', class: cls,
        dataset: { action: a.primary ? 'primary' : 'secondary' },
      }, a.label);
      btn.addEventListener('click', () => {
        const v = typeof a.value === 'function' ? a.value() : a.value;
        dialog.close();
        resolve(v);
      });
      footer.appendChild(btn);
    }

    dialog.append(header, bodyWrap, footer);

    dialog.addEventListener('close', () => dialog.remove());
    // Esc nativo dispara cancel→close → resolve com primeiro action (cancelar).
    dialog.addEventListener('cancel', () => resolve(actions[0]?.value ?? null));
    return dialog;
  }

  _closeBtn(onClick) {
    const btn = el('button', {
      type: 'button',
      class: 'editor-modal__close',
      title: 'Fechar (Esc)',
      'aria-label': 'Fechar',
    }, [icon('x-lg')]);
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    });
    return btn;
  }

  _open(dialog) {
    document.body.appendChild(dialog);
    if (typeof dialog.showModal === 'function') dialog.showModal();
    // Foco no botão primário por padrão (sobrescrito por prompt).
    requestAnimationFrame(() => {
      dialog.querySelector('[data-action="primary"]')?.focus();
    });
  }
}

const TOAST_ICONS = {
  info:    'info-circle',
  success: 'check-circle',
  warning: 'exclamation-triangle',
  error:   'x-octagon',
};
