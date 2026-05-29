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

/** ID HTML + classes brutas + animação on-scroll (aba Avançado). */
export function advancedControls() {
  return [
    { tab: 'advanced', type: 'text', label: 'ID HTML',
      bind: { kind: 'attr', key: 'id' } },
    { tab: 'advanced', type: 'class-picker',
      label: 'Adicionar classe personalizada',
      help: 'Classes detectadas no CSS personalizado (Personalização → CSS).' },
    { tab: 'advanced', type: 'textarea', label: 'Classes (todas)',
      bind: { kind: 'classes' } },
    ...animationControls(),
  ];
}
