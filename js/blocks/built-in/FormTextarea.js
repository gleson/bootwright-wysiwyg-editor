import { Block } from '../Block.js';
import { spacingControls, advancedControls } from '../common-controls.js';
import { buildFieldWrapper } from './Form.js';

export class FormTextarea extends Block {
  static type = 'form-textarea';
  static label = 'Área de texto';
  static icon = 'textarea-resize';
  static category = 'forms';
  static schema = {
    props: {
      name: '',
      label: 'Mensagem',
      placeholder: '',
      rows: 4,
      required: false,
      help: '',
      errorMessage: '',
      defaultValue: '',
      maxLength: '',
      readonly: false,
      disabled: false,
    },
    classes: ['mb-3'],
    attrs: {},
  };
  static essentialClasses = ['mb-3'];
  static allowedChildren = null;

  static render(node) {
    const p = node.props;
    const ta = document.createElement('textarea');
    ta.className = 'form-control';
    ta.rows = Number(p.rows) || 3;
    if (p.name)         ta.name        = p.name;
    if (p.placeholder)  ta.placeholder = p.placeholder;
    if (p.required)     ta.required    = true;
    if (p.defaultValue) ta.value       = p.defaultValue;
    if (p.maxLength !== '' && p.maxLength != null) ta.maxLength = Number(p.maxLength);
    if (p.readonly)     ta.readOnly    = true;
    if (p.disabled)     ta.disabled    = true;
    return buildFieldWrapper({
      label:    p.label,
      required: p.required,
      help:     p.help,
      error:    p.errorMessage,
      name:     p.name,
      input:    ta,
    });
  }

  static settings(node) {
    return [
      { tab: 'content', type: 'text', label: 'Nome (name)',
        help: 'Identificador no backend.',
        bind: { kind: 'prop', key: 'name' } },
      { tab: 'content', type: 'text', label: 'Rótulo',
        bind: { kind: 'prop', key: 'label' } },
      { tab: 'content', type: 'text', label: 'Placeholder',
        bind: { kind: 'prop', key: 'placeholder' } },
      { tab: 'content', type: 'number', label: 'Linhas (rows)',
        min: 1, max: 30, step: 1,
        bind: { kind: 'prop', key: 'rows' } },
      { tab: 'content', type: 'textarea', label: 'Valor padrão',
        bind: { kind: 'prop', key: 'defaultValue' } },
      { tab: 'content', type: 'toggle', label: 'Obrigatório',
        toggleLabel: 'required',
        bind: { kind: 'prop', key: 'required' } },
      { tab: 'content', type: 'text', label: 'Texto de ajuda',
        bind: { kind: 'prop', key: 'help' } },
      { tab: 'content', type: 'text', label: 'Mensagem de erro',
        help: 'Marcação invalid-feedback do Bootstrap — exibida quando o campo é inválido.',
        bind: { kind: 'prop', key: 'errorMessage' } },

      { tab: 'advanced', type: 'number', label: 'Máx. de caracteres',
        min: 1, step: 1,
        bind: { kind: 'prop', key: 'maxLength' } },
      { tab: 'advanced', type: 'toggle', label: 'Somente leitura',
        toggleLabel: 'readonly',
        bind: { kind: 'prop', key: 'readonly' } },
      { tab: 'advanced', type: 'toggle', label: 'Desabilitado',
        toggleLabel: 'disabled (não é enviado)',
        bind: { kind: 'prop', key: 'disabled' } },

      ...spacingControls(),
      ...advancedControls(),
    ];
  }
}
