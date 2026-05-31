/**
 * Helpers para reaproveitar conjuntos comuns de controles entre blocos.
 * Reduzem repetição em `Block.settings()`.
 */

/**
 * Controle compound de cor (classe Bootstrap + custom + gradiente).
 *   target: 'text' (cor de texto/ícone) | 'bg' (cor de fundo, suporta gradiente).
 *   label opcional (default: "Cor (texto)" / "Cor de fundo").
 */
export function colorControl(target, label) {
  const defaultLabel = target === 'bg' ? 'Cor de fundo' : 'Cor';
  return [
    { tab: 'style', type: 'color', label: label ?? defaultLabel,
      bind: { kind: 'color', target } },
  ];
}

/**
 * Tipografia composta (família + tamanho + peso + itálico).
 * Substitui a combinação de selects separados de "Tamanho da fonte" e "Peso"
 * por um único bloco visual. Lê/escreve classes Bootstrap (fs-*, fw-*,
 * fst-italic, font-monospace).
 */
export function typographyControl(label = 'Tipografia') {
  return [
    { tab: 'style', type: 'typography', label,
      bind: { kind: 'typography' } },
  ];
}

/** Margem + padding responsivos. Spread em qualquer settings(). */
export function spacingControls() {
  return [
    { tab: 'style', type: 'spacing', label: 'Margem (T / D / B / E)',
      bind: { kind: 'spacing', property: 'm', responsive: true } },
    { tab: 'style', type: 'spacing', label: 'Padding (T / D / B / E)',
      bind: { kind: 'spacing', property: 'p', responsive: true } },
  ];
}

/** Alinhamento de texto responsivo (radio com 3 opções). */
export function textAlignControl() {
  return [
    { tab: 'style', type: 'radio-group', label: 'Alinhamento',
      options: [
        { value: 'text-{bp}-start',  label: 'Esquerda', icon: 'text-left' },
        { value: 'text-{bp}-center', label: 'Centro',   icon: 'text-center' },
        { value: 'text-{bp}-end',    label: 'Direita',  icon: 'text-right' },
      ],
      bind: { kind: 'classGroup', responsive: true,
        group: ['text-{bp}-start', 'text-{bp}-center', 'text-{bp}-end'] } },
  ];
}

/**
 * Visibilidade / display por breakpoint (utilitários `d-*` do Bootstrap).
 * Responsivo: usa o switch de breakpoint do inspector. Combinando breakpoints
 * dá o padrão clássico "oculto no mobile, visível no desktop"
 * (ex.: Geral→Oculto + MD→Bloco gera `d-none d-md-block`).
 */
export function displayControls() {
  return [
    { tab: 'advanced', type: 'select', label: 'Display (visibilidade)',
      help: 'Use o switch de breakpoint acima. "Oculto" no Geral + "Bloco/Flex" '
          + 'num breakpoint maior = aparece só a partir dele.',
      options: [
        { value: '',                  label: '— padrão (herda) —' },
        { value: 'd-{bp}-none',         label: 'Oculto' },
        { value: 'd-{bp}-block',        label: 'Bloco' },
        { value: 'd-{bp}-flex',         label: 'Flex' },
        { value: 'd-{bp}-inline',       label: 'Inline' },
        { value: 'd-{bp}-inline-block', label: 'Inline-block' },
        { value: 'd-{bp}-grid',         label: 'Grid' },
      ],
      bind: { kind: 'classGroup', responsive: true,
        group: ['d-{bp}-none', 'd-{bp}-block', 'd-{bp}-flex', 'd-{bp}-inline',
                'd-{bp}-inline-block', 'd-{bp}-grid', 'd-{bp}-table',
                'd-{bp}-inline-flex'] } },
  ];
}

/**
 * Bordas (presença/lado), cor da borda, espessura e cantos arredondados —
 * utilitários do Bootstrap 5.3. Cada grupo é independente, então combinam
 * livremente (ex.: `border border-primary border-2 rounded-3`).
 *
 * Observação: cor e espessura só ficam visíveis com uma borda ativa; deixe
 * "Borda" em "Todos os lados" (ou um lado) para vê-las.
 */
export function borderControls() {
  return [
    { tab: 'style', type: 'select', label: 'Borda',
      options: [
        { value: '',              label: '— padrão —' },
        { value: 'border',        label: 'Todos os lados' },
        { value: 'border-top',    label: 'Superior' },
        { value: 'border-end',    label: 'Direita' },
        { value: 'border-bottom', label: 'Inferior' },
        { value: 'border-start',  label: 'Esquerda' },
        { value: 'border-0',      label: 'Sem borda (forçar)' },
      ],
      bind: { kind: 'classGroup',
        group: ['border', 'border-top', 'border-end', 'border-bottom',
                'border-start', 'border-0'] } },
    { tab: 'style', type: 'select', label: 'Cor da borda',
      options: [
        { value: '',                 label: '— padrão —' },
        { value: 'border-primary',   label: 'Primária' },
        { value: 'border-secondary', label: 'Secundária' },
        { value: 'border-success',   label: 'Sucesso' },
        { value: 'border-danger',    label: 'Perigo' },
        { value: 'border-warning',   label: 'Aviso' },
        { value: 'border-info',      label: 'Info' },
        { value: 'border-light',     label: 'Clara' },
        { value: 'border-dark',      label: 'Escura' },
        { value: 'border-white',     label: 'Branca' },
      ],
      bind: { kind: 'classGroup',
        group: ['border-primary', 'border-secondary', 'border-success',
                'border-danger', 'border-warning', 'border-info',
                'border-light', 'border-dark', 'border-white'] } },
    { tab: 'style', type: 'select', label: 'Espessura da borda',
      options: [
        { value: '',         label: '— padrão (1px) —' },
        { value: 'border-1', label: '1' },
        { value: 'border-2', label: '2' },
        { value: 'border-3', label: '3' },
        { value: 'border-4', label: '4' },
        { value: 'border-5', label: '5' },
      ],
      bind: { kind: 'classGroup',
        group: ['border-1', 'border-2', 'border-3', 'border-4', 'border-5'] } },
    { tab: 'style', type: 'select', label: 'Cantos arredondados',
      options: [
        { value: '',               label: '— padrão —' },
        { value: 'rounded-0',      label: 'Nenhum (reto)' },
        { value: 'rounded-1',      label: 'Pequeno' },
        { value: 'rounded',        label: 'Médio' },
        { value: 'rounded-3',      label: 'Grande' },
        { value: 'rounded-4',      label: 'Maior' },
        { value: 'rounded-5',      label: 'Máximo' },
        { value: 'rounded-pill',   label: 'Pílula' },
        { value: 'rounded-circle', label: 'Círculo' },
      ],
      bind: { kind: 'classGroup',
        group: ['rounded-0', 'rounded-1', 'rounded', 'rounded-2', 'rounded-3',
                'rounded-4', 'rounded-5', 'rounded-pill', 'rounded-circle'] } },
  ];
}

/**
 * Sombra (elevação) — utilitários `shadow-*` do Bootstrap. Grupo único.
 */
export function shadowControl() {
  return [
    { tab: 'style', type: 'select', label: 'Sombra',
      options: [
        { value: '',            label: '— nenhuma —' },
        { value: 'shadow-sm',   label: 'Pequena' },
        { value: 'shadow',      label: 'Média' },
        { value: 'shadow-lg',   label: 'Grande' },
        { value: 'shadow-none', label: 'Forçar sem sombra' },
      ],
      bind: { kind: 'classGroup',
        group: ['shadow-sm', 'shadow', 'shadow-lg', 'shadow-none'] } },
  ];
}

/**
 * Largura e altura relativas (utilitários `w-*` / `h-*`). Não responsivos —
 * o Bootstrap não fornece variantes por breakpoint para estes.
 */
export function sizingControls() {
  return [
    { tab: 'style', type: 'select', label: 'Largura',
      options: [
        { value: '',       label: '— automática —' },
        { value: 'w-25',   label: '25%' },
        { value: 'w-50',   label: '50%' },
        { value: 'w-75',   label: '75%' },
        { value: 'w-100',  label: '100%' },
        { value: 'w-auto', label: 'Auto (conteúdo)' },
      ],
      bind: { kind: 'classGroup',
        group: ['w-25', 'w-50', 'w-75', 'w-100', 'w-auto'] } },
    { tab: 'style', type: 'select', label: 'Altura',
      options: [
        { value: '',       label: '— automática —' },
        { value: 'h-25',   label: '25%' },
        { value: 'h-50',   label: '50%' },
        { value: 'h-75',   label: '75%' },
        { value: 'h-100',  label: '100%' },
        { value: 'h-auto', label: 'Auto (conteúdo)' },
      ],
      bind: { kind: 'classGroup',
        group: ['h-25', 'h-50', 'h-75', 'h-100', 'h-auto'] } },
  ];
}

/**
 * Modo de cor (claro/escuro) via atributo `data-bs-theme` (Bootstrap 5.3).
 * Aplicado num contêiner, força o esquema de cores dos descendentes.
 * Valor vazio = herdar do contexto pai.
 */
export function themeControl() {
  return [
    { tab: 'style', type: 'select', label: 'Modo de cor (data-bs-theme)',
      help: 'Define o esquema de cores deste contêiner e seus filhos (Bootstrap 5.3). Vazio = herdar.',
      options: [
        { value: '',      label: '— herdar —' },
        { value: 'light', label: 'Claro' },
        { value: 'dark',  label: 'Escuro' },
      ],
      bind: { kind: 'attr', key: 'data-bs-theme' } },
  ];
}

/**
 * Cores "suaves" que se adaptam ao modo claro/escuro (Bootstrap 5.3):
 * fundo `bg-*-subtle`, texto `text-*-emphasis` e borda `border-*-subtle`.
 * Combinam bem com themeControl() para layouts cientes de tema.
 */
export function subtleColorControls() {
  const TONES = [
    ['primary', 'Primária'], ['secondary', 'Secundária'], ['success', 'Sucesso'],
    ['danger', 'Perigo'], ['warning', 'Aviso'], ['info', 'Info'],
    ['light', 'Clara'], ['dark', 'Escura'],
  ];
  const bgGroup = TONES.map(([t]) => `bg-${t}-subtle`);
  const textGroup = TONES.map(([t]) => `text-${t}-emphasis`);
  const borderGroup = TONES.map(([t]) => `border-${t}-subtle`);
  return [
    { tab: 'style', type: 'select', label: 'Fundo suave (adapta ao tema)',
      options: [{ value: '', label: '— nenhum —' },
        ...TONES.map(([t, l]) => ({ value: `bg-${t}-subtle`, label: l }))],
      bind: { kind: 'classGroup', group: bgGroup } },
    { tab: 'style', type: 'select', label: 'Texto realçado (adapta ao tema)',
      options: [{ value: '', label: '— nenhum —' },
        ...TONES.map(([t, l]) => ({ value: `text-${t}-emphasis`, label: l }))],
      bind: { kind: 'classGroup', group: textGroup } },
    { tab: 'style', type: 'select', label: 'Borda suave (adapta ao tema)',
      options: [{ value: '', label: '— nenhuma —' },
        ...TONES.map(([t, l]) => ({ value: `border-${t}-subtle`, label: l }))],
      bind: { kind: 'classGroup', group: borderGroup } },
  ];
}

/**
 * Ajuste de conteúdo de mídia (imagens/vídeo) via `object-fit-*` (Bootstrap 5.3).
 */
export function objectFitControl() {
  return [
    { tab: 'style', type: 'select', label: 'Ajuste do conteúdo (object-fit)',
      help: 'Como a imagem preenche suas dimensões. Útil com largura/altura fixas.',
      options: [
        { value: '',                   label: '— padrão —' },
        { value: 'object-fit-contain', label: 'Conter (contain)' },
        { value: 'object-fit-cover',   label: 'Cobrir (cover)' },
        { value: 'object-fit-fill',    label: 'Preencher (fill)' },
        { value: 'object-fit-scale',   label: 'Escala (scale-down)' },
        { value: 'object-fit-none',    label: 'Nenhum (none)' },
      ],
      bind: { kind: 'classGroup', group: ['object-fit-contain','object-fit-cover','object-fit-fill','object-fit-scale','object-fit-none'] } },
  ];
}

/**
 * Utilitários de texto: truncar com reticências, quebrar palavras longas e
 * controlar wrap/nowrap. Úteis em títulos e parágrafos.
 */
export function textUtilControls() {
  return [
    { tab: 'style', type: 'toggle', label: 'Truncar com reticências',
      toggleLabel: 'text-truncate (corta em uma linha com …)',
      help: 'Requer largura limitada (ex.: w-50 ou contêiner estreito).',
      bind: { kind: 'classToggle', class: 'text-truncate' } },
    { tab: 'style', type: 'toggle', label: 'Quebrar palavras longas',
      toggleLabel: 'text-break (quebra URLs/palavras grandes)',
      bind: { kind: 'classToggle', class: 'text-break' } },
    { tab: 'style', type: 'select', label: 'Quebra de linha',
      options: [
        { value: '',            label: '— padrão —' },
        { value: 'text-wrap',   label: 'Permitir quebra' },
        { value: 'text-nowrap', label: 'Sem quebra (uma linha)' },
      ],
      bind: { kind: 'classGroup', group: ['text-wrap', 'text-nowrap'] } },
  ];
}

/**
 * Posicionamento CSS (`position-*`) + centralização absoluta (`translate-middle`).
 * Aba Avançado — útil para sobreposições / elementos flutuantes.
 */
export function positionControls() {
  return [
    { tab: 'advanced', type: 'select', label: 'Posição',
      help: 'position-* do Bootstrap. Para "absoluta/fixa" o elemento-pai normalmente precisa de position-relative.',
      options: [
        { value: '',                  label: '— padrão (estática) —' },
        { value: 'position-relative', label: 'Relativa' },
        { value: 'position-absolute', label: 'Absoluta' },
        { value: 'position-fixed',    label: 'Fixa (viewport)' },
        { value: 'position-sticky',   label: 'Fixa ao rolar (sticky)' },
      ],
      bind: { kind: 'classGroup',
        group: ['position-static', 'position-relative', 'position-absolute',
                'position-fixed', 'position-sticky'] } },
    { tab: 'advanced', type: 'toggle', label: 'Centralizar no ponto de ancoragem',
      toggleLabel: 'translate-middle',
      help: 'Desloca o elemento em -50%/-50%. Combine com top-*/start-* para centralizar sobreposições.',
      bind: { kind: 'classToggle', class: 'translate-middle' } },
  ];
}

/**
 * Espaçamento entre itens de um contêiner flex/grid (`gap-*`).
 */
export function gapControl() {
  return [
    { tab: 'style', type: 'select', label: 'Espaço entre itens (gap)',
      help: 'Aplica gap-* — vale para filhos diretos em layout flex/grid.',
      options: [
        { value: '',      label: '— nenhum —' },
        { value: 'gap-0', label: '0' },
        { value: 'gap-1', label: '1' },
        { value: 'gap-2', label: '2' },
        { value: 'gap-3', label: '3' },
        { value: 'gap-4', label: '4' },
        { value: 'gap-5', label: '5' },
      ],
      bind: { kind: 'classGroup',
        group: ['gap-0', 'gap-1', 'gap-2', 'gap-3', 'gap-4', 'gap-5'] } },
  ];
}

/**
 * Animação on-scroll: o bloco anima quando entra na viewport. Grava em
 * `data-animate*` (atributos exportados como estão no HTML). Pré-visualizada
 * no canvas; na página publicada precisa do runtime `scroll-animate.js`.
 */
export function animationControls() {
  return [
    { tab: 'advanced', type: 'select', label: 'Animação ao rolar',
      help: 'O bloco anima ao entrar na tela. Aparece no editor; no HTML '
          + 'exportado requer o runtime de animação na página (ver README).',
      options: [
        { value: '',           label: '— nenhuma —' },
        { value: 'fade',       label: 'Fade (surge)' },
        { value: 'fade-up',    label: 'Fade ↑ (sobe)' },
        { value: 'fade-down',  label: 'Fade ↓ (desce)' },
        { value: 'fade-right', label: 'Fade → (da esquerda)' },
        { value: 'fade-left',  label: 'Fade ← (da direita)' },
        { value: 'zoom-in',    label: 'Zoom in' },
        { value: 'zoom-out',   label: 'Zoom out' },
      ],
      bind: { kind: 'attr', key: 'data-animate' } },
    { tab: 'advanced', type: 'number', label: 'Duração da animação (ms)',
      help: 'Padrão: 600 ms.', min: 100, max: 4000, step: 50,
      bind: { kind: 'attr', key: 'data-animate-duration' } },
    { tab: 'advanced', type: 'number', label: 'Atraso da animação (ms)',
      min: 0, max: 4000, step: 50,
      bind: { kind: 'attr', key: 'data-animate-delay' } },
    { tab: 'advanced', type: 'select', label: 'Vincular ao scroll (timeline)',
      help: 'A animação é "esfregada" pelo scroll em vez de tocar uma vez. '
          + 'Combina com o efeito acima.',
      options: [
        { value: '',  label: '— desligado —' },
        { value: '1', label: 'Vincular ao scroll' },
      ],
      bind: { kind: 'attr', key: 'data-scroll-link' } },
    { tab: 'advanced', type: 'range', label: 'Parallax (intensidade)',
      help: 'Translata o bloco no eixo Y conforme o scroll. -1 = oposto e forte, '
          + '0 = desligado, 1 = mesma direção e forte. Sutil costuma ficar bem '
          + '(ex.: 0.2).',
      min: -1, max: 1, step: 0.05,
      bind: { kind: 'attr', key: 'data-parallax' } },
  ];
}

/**
 * Aba Avançado: adicionar classe (helper) + uma seção recolhível com a edição
 * "crua" do HTML (estilo inline, ID e classes) — agrupada para não poluir o
 * painel — e a animação on-scroll.
 *
 * Os controles que compartilham o mesmo `section.id` (consecutivos) são
 * renderizados dentro de um <details> pela SidebarRight.
 */
export function advancedControls() {
  const rawHtml = { id: 'rawhtml', label: 'Estilo inline & atributos' };
  return [
    { tab: 'advanced', type: 'class-picker',
      label: 'Adicionar classe personalizada',
      help: 'Classes detectadas no CSS personalizado (Personalização → CSS).' },
    { tab: 'advanced', type: 'textarea', label: 'Estilo inline (CSS)',
      help: 'CSS aplicado direto no atributo style do elemento. '
          + 'Ex.: color: #b30000; margin-top: 8px',
      bind: { kind: 'attr', key: 'style' }, section: rawHtml },
    { tab: 'advanced', type: 'text', label: 'ID HTML',
      bind: { kind: 'attr', key: 'id' }, section: rawHtml },
    { tab: 'advanced', type: 'textarea', label: 'Classes (todas)',
      bind: { kind: 'classes' }, section: rawHtml },
    ...animationControls(),
  ];
}
