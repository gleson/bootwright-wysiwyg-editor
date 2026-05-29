/**
 * Runtime de animações on-scroll.
 *
 * Compartilhado por dois consumidores:
 *   - O editor (canvas): `ScrollAnimator` (js/ui/) cria um animator e o
 *     re-escaneia a cada render para o usuário pré-visualizar a animação.
 *   - A página publicada (Django): `scroll-animate.auto.js` chama
 *     `initScrollAnimations(document)` no carregamento.
 *
 * Como funciona: blocos com `data-animate="<efeito>"` começam escondidos
 * (CSS em `css/scroll-animate.css`) e ganham a classe `wa-in-view` quando
 * entram na viewport — um IntersectionObserver dispara a transição. Anima
 * uma vez por elemento. `data-animate-duration` / `data-animate-delay` (ms)
 * ajustam o tempo via custom properties.
 *
 * Degradação graciosa: o CSS só esconde o conteúdo sob um ancestral com a
 * classe `wa-ready` — adicionada por este runtime. Se o JS não rodar, nada
 * fica invisível. `prefers-reduced-motion` mostra tudo no estado final sem
 * transição.
 */

// Elementos com `data-scroll-link="1"` são responsabilidade do runtime de
// parallax (parallax.js): lá o efeito é "esfregado" pelo scroll em vez de
// disparar uma transição one-shot.
const SELECTOR = '[data-animate]:not([data-animate=""]):not([data-scroll-link="1"])';

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

/** Aplica a animação a `elm` agora: lê os data-attrs e marca `wa-in-view`. */
function play(elm) {
  const dur = parseInt(elm.getAttribute('data-animate-duration'), 10);
  const delay = parseInt(elm.getAttribute('data-animate-delay'), 10);
  if (Number.isFinite(dur) && dur >= 0) elm.style.setProperty('--wa-duration', `${dur}ms`);
  if (Number.isFinite(delay) && delay >= 0) elm.style.setProperty('--wa-delay', `${delay}ms`);
  elm.classList.add('wa-in-view');
}

/** Resolve o escopo de marcação `wa-ready` para um root (Element ou Document). */
function readyTarget(scope) {
  if (scope === document || scope == null) return document.documentElement;
  return scope;
}

/**
 * Cria um animator reutilizável. `rescan(scope)` é idempotente — elementos já
 * observados são ignorados, então pode ser chamado a cada render do editor.
 *
 * `opts.root` é o elemento de SCROLL contra o qual a visibilidade é medida
 * (no editor, o `.editor-canvas-wrapper`; na página publicada, null = a
 * viewport). É diferente do `scope` de `rescan`, que é só onde procurar os
 * elementos animáveis.
 *
 * @param {{ root?: Element|null, threshold?: number, rootMargin?: string }} [opts]
 * @returns {{ rescan: (scope?: Element|Document) => void, destroy: () => void }}
 */
export function createScrollAnimator(opts = {}) {
  const seen = new WeakSet();
  const reduce = prefersReducedMotion();
  const hasIO = typeof IntersectionObserver !== 'undefined';

  let observer = null;
  if (!reduce && hasIO) {
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        play(entry.target);
        observer.unobserve(entry.target); // anima uma vez
      }
    }, {
      root: opts.root ?? null,
      threshold: opts.threshold ?? 0.15,
      rootMargin: opts.rootMargin ?? '0px 0px -10% 0px',
    });
  }

  return {
    rescan(root = document) {
      const scope = root && root.querySelectorAll ? root : document;
      // Sinaliza ao CSS que pode esconder o conteúdo animável deste escopo.
      readyTarget(scope).classList.add('wa-ready');

      for (const elm of scope.querySelectorAll(SELECTOR)) {
        if (seen.has(elm)) continue;
        seen.add(elm);
        if (observer) observer.observe(elm);
        else play(elm); // reduced-motion ou sem IO: estado final imediato
      }
    },
    destroy() {
      observer?.disconnect();
    },
  };
}

/**
 * Atalho de uso único (página publicada): cria um animator e escaneia `root`
 * uma vez. Retorna o animator caso queira re-escanear depois (conteúdo
 * carregado via AJAX, por exemplo).
 */
export function initScrollAnimations(root = document, opts) {
  const animator = createScrollAnimator(opts);
  animator.rescan(root);
  return animator;
}
