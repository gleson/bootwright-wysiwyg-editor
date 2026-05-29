import { Block } from '../Block.js';
import { spacingControls, advancedControls } from '../common-controls.js';
import { buildFieldWrapper } from './Form.js';

const AUTOCOMPLETE_OPTIONS = [
  { value: '',                 label: '— não definir —' },
  { value: 'on',               label: 'on' },
  { value: 'off',              label: 'off' },
  { value: 'name',             label: 'Nome completo' },
  { value: 'given-name',       label: 'Primeiro nome' },
  { value: 'family-name',      label: 'Sobrenome' },
  { value: 'email',            label: 'Email' },
  { value: 'username',         label: 'Usuário' },
  { value: 'new-password',     label: 'Nova senha' },
  { value: 'current-password', label: 'Senha atual' },
  { value: 'tel',              label: 'Telefone' },
  { value: 'url',              label: 'URL' },
  { value: 'organization',     label: 'Empresa' },
  { value: 'street-address',   label: 'Endereço' },
  { value: 'postal-code',      label: 'CEP' },
];

/**
 * FormInput — campo de input com tipo selecionável (text/email/password/etc.).
 * Ideal pra ser inserido dentro de um bloco Form, mas funciona standalone.
 */
export class FormInput extends Block {
  static type = 'form-input';
  static label = 'Campo de texto';
  static icon = 'input-cursor-text';
  static category = 'forms';
  static schema = {
    props: {
      type: 'text',          // text|email|password|tel|url|number|date|time
      name: '',
      label: 'Campo',
      placeholder: '',
      required: false,
      help: '',
      errorMessage: '',
      defaultValue: '',
      autocomplete: '',
      pattern: '',
      maxLength: '',
      min: '',
      max: '',
      step: '',
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
    const input = document.createElement('input');
    input.type = p.type || 'text';
    input.className = 'form-control';
    if (p.name)         input.name        = p.name;
    if (p.placeholder)  input.placeholder = p.placeholder;
    if (p.required)     input.required    = true;
    if (p.defaultValue) input.value       = p.defaultValue;
    if (p.autocomplete) input.setAttribute('autocomplete', p.autocomplete);
    if (p.pattern)      input.pattern     = p.pattern;
    if (p.maxLength !== '' && p.maxLength != null) input.maxLength = Number(p.maxLength);
    if (p.min  !== '' && p.min  != null) input.min  = p.min;
    if (p.max  !== '' && p.max  != null) input.max  = p.max;
    if (p.step !== '' && p.step != null) input.step = p.step;
    if (p.readonly)     input.readOnly    = true;
    if (p.disabled)     input.disabled    = true;
    return buildFieldWrapper({
      label:    p.label,
      required: p.required,
      help:     p.help,
      error:    p.errorMessage,
      name:     p.name,
      input,
    });
  }

  static settings(node) {
    return [
      { tab: 'content', type: 'select', label: 'Tipo',
        options: [
          { value: 'text',     label: 'Texto' },
          { value: 'email',    label: 'Email' },
          { value: 'password', label: 'Senha' },
          { value: 'tel',      label: 'Telefone' },
          { value: 'url',      label: 'URL' },
          { value: 'number',   label: 'Número' },
          { value: 'date',     label: 'Data' },
          { value: 'time',     label: 'Hora' },
        ],
        bind: { kind: 'prop', key: 'type' } },
      { tab: 'content', type: 'text', label: 'Nome (name)',
        help: 'Identificador no backend (ex.: "email"). Obrigatório para que o campo seja enviado.',
        bind: { kind: 'prop', key: 'name' } },
      { tab: 'content', type: 'text', label: 'Rótulo',
        bind: { kind: 'prop', key: 'label' } },
      { tab: 'content', type: 'text', label: 'Placeholder',
        bind: { kind: 'prop', key: 'placeholder' } },
      { tab: 'content', type: 'text', label: 'Valor padrão',
        bind: { kind: 'prop', key: 'defaultValue' } },
      { tab: 'content', type: 'toggle', label: 'Obrigatório',
        toggleLabel: 'required',
        bind: { kind: 'prop', key: 'required' } },
      { tab: 'content', type: 'text', label: 'Texto de ajuda',
        help: 'Aparece abaixo do campo (form-text).',
        bind: { kind: 'prop', key: 'help' } },
      { tab: 'content', type: 'text', label: 'Mensagem de erro',
        help: 'Marcação invalid-feedback do Bootstrap — exibida quando o campo é inválido.',
        bind: { kind: 'prop', key: 'errorMessage' } },

      { tab: 'advanced', type: 'select', label: 'Autocomplete',
        help: 'Dica ao navegador para o preenchimento automático.',
        options: AUTOCOMPLETE_OPTIONS,
        bind: { kind: 'prop', key: 'autocomplete' } },
      { tab: 'advanced', type: 'text', label: 'Pattern (regex)',
        help: 'Validação HTML5. Ex.: [0-9]{5}-[0-9]{3} para CEP.',
        bind: { kind: 'prop', key: 'pattern' } },
      { tab: 'advanced', type: 'number', label: 'Máx. de caracteres',
        min: 1, step: 1,
        bind: { kind: 'prop', key: 'maxLength' } },
      { tab: 'advanced', type: 'text', label: 'Mínimo (min)',
        help: 'Para tipos número / data / hora.',
        bind: { kind: 'prop', key: 'min' } },
      { tab: 'advanced', type: 'text', label: 'Máximo (max)',
        help: 'Para tipos número / data / hora.',
        bind: { kind: 'prop', key: 'max' } },
      { tab: 'advanced', type: 'text', label: 'Passo (step)',
        help: 'Para tipo número. Ex.: 0.01 para valores monetários.',
        bind: { kind: 'prop', key: 'step' } },
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
