import { Block } from '../Block.js';
import { spacingControls, advancedControls } from '../common-controls.js';
import { buildFieldWrapper } from './Form.js';

/**
 * FormSelect — `<select>` com opções como array de `{ value, label }`.
 *
 * Retrocompat: aceita formato legado em string ("valor | rótulo" por linha).
 * `_parseOptions` normaliza qualquer forma para array.
 */
export class FormSelect extends Block {
  static type = 'form-select';
  static label = 'Seleção';
  static icon = 'menu-button-wide';
  static category = 'forms';
  static schema = {
    props: {
      name: '',
      label: 'Escolha',
      options: [
        { value: 'op1', label: 'Opção 1' },
        { value: 'op2', label: 'Opção 2' },
        { value: 'op3', label: 'Opção 3' },
      ],
      required: false,
      multiple: false,
      help: '',
      errorMessage: '',
      placeholder: 'Selecione…',
      disabled: false,
    },
    classes: ['mb-3'],
    attrs: {},
  };
  static essentialClasses = ['mb-3'];
  static allowedChildren = null;

  static render(node) {
    const p = node.props;
    const sel = document.createElement('select');
    sel.className = 'form-select';
    if (p.name)     sel.name = p.name;
    if (p.required) sel.required = true;
    if (p.multiple) sel.multiple = true;
    if (p.disabled) sel.disabled = true;

    if (p.placeholder && !p.multiple) {
      const o = document.createElement('option');
      o.value = '';
      o.textContent = p.placeholder;
      o.selected = true;
      o.disabled = true;
      sel.appendChild(o);
    }

    for (const opt of FormSelect._parseOptions(p.options)) {
      const value = opt.value ?? '';
      const label = opt.label || value;
      if (!value && !label) continue;
      const o = document.createElement('option');
      o.value = value;
      o.textContent = label;
      sel.appendChild(o);
    }

    return buildFieldWrapper({
      label:    p.label,
      required: p.required,
      help:     p.help,
      error:    p.errorMessage,
      name:     p.name,
      input:    sel,
    });
  }

  static _parseOptions(raw) {
    if (Array.isArray(raw)) {
      return raw.map((o) => typeof o === 'string'
        ? FormSelect._parseLine(o)
        : { value: o.value ?? '', label: o.label ?? '' }
      );
    }
    return String(raw ?? '').split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map(FormSelect._parseLine);
  }

  static _parseLine(line) {
    const parts = String(line).split('|').map((s) => s.trim());
    const value = parts[0] || '';
    const label = parts[1] ?? value;
    return { value, label };
  }

  static settings(node) {
    return [
      { tab: 'content', type: 'text', label: 'Nome (name)',
        bind: { kind: 'prop', key: 'name' } },
      { tab: 'content', type: 'text', label: 'Rótulo',
        bind: { kind: 'prop', key: 'label' } },

      { tab: 'content', type: 'items-list',
        bind: { kind: 'prop', key: 'options' },
        fields: [
          { key: 'value', label: 'Valor (value)', placeholder: 'op1' },
          { key: 'label', label: 'Rótulo visível', placeholder: 'Opção 1' },
        ],
        defaultItem: { value: '', label: '' },
        parse: FormSelect._parseOptions,
        addLabel: 'Adicionar opção',
        itemLabel: (it, i) => `Opção ${i + 1}` },

      { tab: 'content', type: 'text', label: 'Placeholder',
        help: 'Primeira opção desabilitada (oculta em modo "múltiplo").',
        bind: { kind: 'prop', key: 'placeholder' } },
      { tab: 'content', type: 'toggle', label: 'Obrigatório',
        toggleLabel: 'required',
        bind: { kind: 'prop', key: 'required' } },
      { tab: 'content', type: 'toggle', label: 'Múltiplo',
        toggleLabel: 'Permite seleção de múltiplas opções (Ctrl/Cmd para somar).',
        bind: { kind: 'prop', key: 'multiple' } },
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
