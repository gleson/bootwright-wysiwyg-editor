/**
 * Templates pré-definidos (built-in). Diferentes dos templates do usuário
 * (CustomizationStore.templates) por: vivem em código, têm id estável com
 * prefixo `builtin:`, e são imutáveis (não podem ser editados nem removidos).
 *
 * Shape igual ao dos templates do usuário (CustomizationStore.addTemplate):
 *   { id, name, icon, kind: 'page'|'block', tree?|nodes?, builtIn: true }
 *
 * Para `kind: 'page'`, usar `nodes: [...]` (cada item é uma subárvore top-level).
 * Para `kind: 'block'`, usar `tree: {...}` (uma única subárvore).
 *
 * IDs (props) dos nós são intencionalmente omitidos — `createNode` gera novos
 * ao inserir, garantindo que cada inserção crie nós únicos.
 */

const HERO_TEMPLATE = {
  id: 'builtin:hero',
  name: 'Hero',
  icon: 'star',
  kind: 'block',
  builtIn: true,
  tree: {
    type: 'section',
    props: {},
    classes: ['container-fluid', 'py-5', 'bg-light'],
    attrs: {},
    children: [{
      type: 'row',
      props: {},
      classes: ['row', 'justify-content-center'],
      attrs: {},
      children: [{
        type: 'column',
        props: {},
        classes: ['col-md-8', 'text-center'],
        attrs: {},
        children: [
          {
            type: 'heading',
            props: { level: 1, text: 'Transforme suas ideias em realidade' },
            classes: ['mb-3'],
            attrs: {},
            children: [],
          },
          {
            type: 'paragraph',
            props: { text: 'Crie páginas profissionais em minutos com nosso editor visual. Sem código, sem complicação — só resultado.' },
            classes: ['lead', 'mb-4'],
            attrs: {},
            children: [],
          },
          {
            type: 'button',
            props: { text: 'Começar agora', href: '#', target: '' },
            classes: ['btn', 'btn-primary', 'btn-lg'],
            attrs: {},
            children: [],
          },
        ],
      }],
    }],
  },
};

const CTA_TEMPLATE = {
  id: 'builtin:cta',
  name: 'Chamada para ação (CTA)',
  icon: 'megaphone',
  kind: 'block',
  builtIn: true,
  tree: {
    type: 'section',
    props: {},
    classes: ['container', 'py-4'],
    attrs: {},
    children: [{
      type: 'row',
      props: {},
      classes: ['row', 'align-items-center', 'g-3'],
      attrs: {},
      children: [
        {
          type: 'column',
          props: {},
          classes: ['col-md-8'],
          attrs: {},
          children: [
            {
              type: 'heading',
              props: { level: 3, text: 'Pronto para começar?' },
              classes: ['mb-2'],
              attrs: {},
              children: [],
            },
            {
              type: 'paragraph',
              props: { text: 'Cadastre-se em segundos e teste grátis por 14 dias.' },
              classes: ['mb-0'],
              attrs: {},
              children: [],
            },
          ],
        },
        {
          type: 'column',
          props: {},
          classes: ['col-md-4', 'text-md-end'],
          attrs: {},
          children: [{
            type: 'button',
            props: { text: 'Cadastrar grátis', href: '#', target: '' },
            classes: ['btn', 'btn-success', 'btn-lg'],
            attrs: {},
            children: [],
          }],
        },
      ],
    }],
  },
};

const GRID_3_COLS_TEMPLATE = {
  id: 'builtin:grid-3-cols',
  name: 'Grid 3 colunas',
  icon: 'layout-three-columns',
  kind: 'block',
  builtIn: true,
  tree: {
    type: 'section',
    props: {},
    classes: ['container', 'py-5'],
    attrs: {},
    children: [{
      type: 'row',
      props: {},
      classes: ['row', 'g-4'],
      attrs: {},
      children: [1, 2, 3].map((i) => ({
        type: 'column',
        props: {},
        classes: ['col-md-4'],
        attrs: {},
        children: [
          {
            type: 'heading',
            props: { level: 4, text: `Recurso ${i}` },
            classes: ['mb-2'],
            attrs: {},
            children: [],
          },
          {
            type: 'paragraph',
            props: { text: 'Descreva aqui o benefício deste recurso em uma ou duas frases.' },
            classes: [],
            attrs: {},
            children: [],
          },
        ],
      })),
    }],
  },
};

export const BUILT_IN_TEMPLATES = [
  HERO_TEMPLATE,
  CTA_TEMPLATE,
  GRID_3_COLS_TEMPLATE,
];

export function isBuiltInTemplateId(id) {
  return typeof id === 'string' && id.startsWith('builtin:');
}

export function getBuiltInTemplate(id) {
  return BUILT_IN_TEMPLATES.find((t) => t.id === id) ?? null;
}
