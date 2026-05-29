import { Block } from '../Block.js';
import { spacingControls, advancedControls } from '../common-controls.js';
import { generateId } from '../../utils/id.js';

/**
 * Helper compartilhado pelos blocos de campo (FormInput, FormTextarea, etc.).
 *
 * Estrutura padrão Bootstrap:
 *   <div class="(node.classes — geralmente 'mb-3')">
 *     <label class="form-label" for="id_email">Rótulo <span>*</span></label>
 *     <input class="form-control" id="id_email" aria-describedby="...">
 *     <div class="invalid-feedback" id="id_email-error">Mensagem de erro</div>
 *     <div class="form-text" id="id_email-help">Texto de ajuda</div>
 *   </div>
 *
 * Acessibilidade: gera um `id` estável (convenção Django `id_<name>` quando há
 * `name`), liga `<label for>` ao input e aponta `aria-describedby` para a ajuda
 * e a mensagem de erro. Quando `inline === true` (checkbox/radio), o input vem
 * antes do label (visual de form-check).
 */
export function buildFieldWrapper({
  label, required, help, error, input,
  inline = false, labelClass = 'form-label', name = '',
}) {
  const wrap = document.createElement('div');

  const fieldId = input.id || (name ? `id_${name}` : `field-${generateId().slice(0, 8)}`);
  input.id = fieldId;

  const describedBy = [];

  const lbl = label ? document.createElement('label') : null;
  if (lbl) {
    lbl.className = labelClass;
    lbl.htmlFor = fieldId;
    lbl.textContent = label;
    if (required) {
      const star = document.createElement('span');
      star.className = 'text-danger';
      star.textContent = ' *';
      star.setAttribute('aria-hidden', 'true');
      lbl.appendChild(star);
    }
  }

  if (inline) {
    wrap.appendChild(input);
    if (lbl) wrap.appendChild(lbl);
  } else {
    if (lbl) wrap.appendChild(lbl);
    wrap.appendChild(input);
  }

  // Mensagem de erro Bootstrap — fica escondida até o <form> ganhar
  // `was-validated` (ou o campo receber `is-invalid`). Quem valida de verdade
  // é o Django no servidor ou o JS do site; o editor só monta a marcação.
  if (error) {
    const errId = `${fieldId}-error`;
    const errEl = document.createElement('div');
    errEl.className = 'invalid-feedback';
    errEl.id = errId;
    errEl.textContent = error;
    wrap.appendChild(errEl);
    describedBy.push(errId);
  }

  if (help) {
    const helpId = `${fieldId}-help`;
    const helpEl = document.createElement('div');
    helpEl.className = 'form-text';
    helpEl.id = helpId;
    helpEl.textContent = help;
    wrap.appendChild(helpEl);
    describedBy.push(helpId);
  }

  if (describedBy.length) {
    input.setAttribute('aria-describedby', describedBy.join(' '));
  }

  // Sinaliza no canvas quando falta `name` — sem ele o campo não é enviado.
  // Removido na exportação por _stripEditorAttrs (ver Editor.js).
  if (!name) {
    wrap.dataset.editorWarn = 'Defina o "name" — sem ele o campo não é enviado.';
  }

  return wrap;
}

/**
 * Form — container `<form>` Bootstrap-friendly.
 *
 * Integração com Django:
 *   - `action` vazio = posta na URL atual (padrão).
 *   - `method` POST por padrão.
 *   - `djangoCsrf` (ligado por padrão): na **exportação**, injeta
 *     `{% csrf_token %}` como primeiro filho do `<form>` quando o método é POST.
 *     Desligue se o form for GET ou se você for inserir o token manualmente.
 */
export class Form extends Block {
  static type = 'form';
  static label = 'Formulário';
  static icon = 'ui-checks';
  static category = 'forms';
  static schema = {
    props: {
      action: '',
      method: 'POST',
      enctype: '',
      djangoCsrf: true,
    },
    classes: [],
    attrs: { novalidate: 'true' },
  };
  static essentialClasses = [];
  static allowedChildren = '*';

  static render(node) {
    const f = document.createElement('form');
    if (node.props.action)  f.action = node.props.action;
    if (node.props.method)  f.method = node.props.method;
    if (node.props.enctype) f.enctype = node.props.enctype;
    // Hint visual no canvas — some na exportação (_stripEditorAttrs).
    const isPost = String(node.props.method || 'POST').toUpperCase() === 'POST';
    if (node.props.djangoCsrf && isPost) {
      f.dataset.editorHint = '{% csrf_token %} injetado na exportação';
    }
    return f;
  }

  /**
   * Hook de exportação (ver Block.js) — injeta o `{% csrf_token %}` do Django
   * como primeiro filho. Só em POST: GET não exige CSRF e o token sujaria a
   * query string.
   */
  static decorateExport(node, element) {
    if (!node.props.djangoCsrf) return;
    if (String(node.props.method || 'POST').toUpperCase() !== 'POST') return;
    element.insertBefore(document.createTextNode('{% csrf_token %}'), element.firstChild);
  }

  static settings(node) {
    return [
      { tab: 'content', type: 'text', label: 'Action (URL)',
        help: 'Vazio = posta na URL atual.',
        bind: { kind: 'prop', key: 'action' } },
      { tab: 'content', type: 'select', label: 'Método HTTP',
        options: [
          { value: 'POST', label: 'POST' },
          { value: 'GET',  label: 'GET' },
        ],
        bind: { kind: 'prop', key: 'method' } },
      { tab: 'content', type: 'select', label: 'Enctype',
        help: 'Use multipart/form-data se houver upload de arquivo.',
        options: [
          { value: '',                   label: 'Padrão (urlencoded)' },
          { value: 'multipart/form-data', label: 'multipart/form-data (uploads)' },
          { value: 'text/plain',          label: 'text/plain' },
        ],
        bind: { kind: 'prop', key: 'enctype' } },
      { tab: 'content', type: 'toggle', label: 'CSRF do Django',
        toggleLabel: 'Injetar {% csrf_token %} na exportação (apenas POST)',
        help: 'Desligue para forms GET ou se for inserir o token manualmente.',
        bind: { kind: 'prop', key: 'djangoCsrf' } },

      ...spacingControls(),
      ...advancedControls(),
    ];
  }
}
