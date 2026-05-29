import { Block } from '../Block.js';
import { spacingControls, advancedControls } from '../common-controls.js';
import { buildFieldWrapper } from './Form.js';

export class FormCheckbox extends Block {
  static type = 'form-checkbox';
  static label = 'Checkbox';
  static icon = 'check2-square';
  static category = 'forms';
  static schema = {
    props: {
      name: '',
      label: 'Aceito os termos',
      value: 'on',
      required: false,
      defaultChecked: false,
      help: '',
      errorMessage: '',
      asSwitch: false,
      disabled: false,
    },
    classes: ['form-check', 'mb-3'],
    attrs: {},
  };
  static essentialClasses = ['form-check'];
  static allowedChildren = null;

  static render(node) {
    const p = node.props;
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'form-check-input';
    if (p.name)           input.name     = p.name;
    if (p.value)          input.value    = p.value;
    if (p.required)       input.required = true;
    if (p.defaultChecked) input.checked  = true;
    if (p.disabled)       input.disabled = true;

    // Mesma estrutura/acessibilidade dos demais campos — inline (input antes
    // do label) e labelClass form-check-label para o visual de form-check.
    const wrap = buildFieldWrapper({
      label:      p.label,
      required:   p.required,
      help:       p.help,
      error:      p.errorMessage,
      name:       p.name,
      input,
      inline:     true,
      labelClass: 'form-check-label',
    });
    if (p.asSwitch) wrap.classList.add('form-switch');
    return wrap;
  }

  static settings(node) {
    return [
      { tab: 'content', type: 'text', label: 'Nome (name)',
        bind: { kind: 'prop', key: 'name' } },
      { tab: 'content', type: 'text', label: 'Rótulo',
        bind: { kind: 'prop', key: 'label' } },
      { tab: 'content', type: 'text', label: 'Valor enviado (value)',
        help: 'Valor postado quando marcado. Default: "on".',
        bind: { kind: 'prop', key: 'value' } },
      { tab: 'content', type: 'toggle', label: 'Marcado por padrão',
        toggleLabel: 'checked',
        bind: { kind: 'prop', key: 'defaultChecked' } },
      { tab: 'content', type: 'toggle', label: 'Obrigatório',
        toggleLabel: 'required',
        bind: { kind: 'prop', key: 'required' } },
      { tab: 'content', type: 'toggle', label: 'Visual de switch',
        toggleLabel: 'form-switch (toggle estilo iOS)',
        bind: { kind: 'prop', key: 'asSwitch' } },
      { tab: 'content', type: 'text', label: 'Texto de ajuda',
        bind: { kind: 'prop', key: 'help' } },
      { tab: 'content', type: 'text', label: 'Mensagem de erro',
        help: 'Marcação invalid-feedback do Bootstrap — exibida quando o campo é inválido.',
        bind: { kind: 'prop', key: 'errorMessage' } },

      { tab: 'advanced', type: 'toggle', label: 'Desabilitado',
        toggleLabel: 'disabled (não é enviado)',
        bind: { kind: 'prop', key: 'disabled' } },

      ...spacingControls(),
      ...advancedControls(),
    ];
  }
}
