/**
 * Runtime de parallax + animações scroll-linked (timeline).
 *
 * Dois recursos num só animator (compartilham o mesmo loop de scroll):
 *   - `data-parallax="<factor>"` (-1..1, default 0):
 *       Translata o elemento no eixo Y proporcionalmente ao deslocamento entre
 *       o centro do elemento e o centro da viewport. Positivo = movimento na
 *       mesma direção do scroll (mais lento, "afundado"); negativo = mais
 *       rápido. Factor 0 é equivalente a desligado.
 *   - `data-scroll-link="1"` (combinado com `data-animate`):
 *       Em vez de a animação tocar uma única vez quando o elemento entra na
 *       viewport, ela é "esfregada" pelo scroll. O runtime grava
 *       `--wa-progress` (0 quando o elemento entra; 1 quando vai sair) e o
 *       CSS interpola transform/opacity a partir dessa variável.
 *
 * Respeita `prefers-reduced-motion` (devolve um animator no-op).
 */

const PARALLAX_SELECTOR = '[data-parallax]:not([data-parallax="0"]):not([data-parallax=""])';
const SCROLL_LINK_SELECTOR = '[data-animate][data-scroll-link="1"]:not([data-animate=""])';
const COMBINED_SELECTOR = `${PARALLAX_SELECTOR}, ${SCROLL_LINK_SELECTOR}`;

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

function readyTarget(scope) {
  if (scope === document || scope == null) return document.documentElement;
  return scope;
}

/**
 * Cria um animator de parallax/scroll-link.
 *
 * @param {{ root?: Element|null }} [opts]
 *   `root` é o elemento de SCROLL (no editor, `.editor-canvas-wrapper`; na
 *   página publicada, `null` = window). Posição do elemento é medida via
 *   `getBoundingClientRect` (já está em coords da viewport visível, então o
 *   `root` só importa para escolher onde escutar `scroll`).
 * @returns {{ rescan: (scope?: Element|Document) => void, destroy: () => void }}
 */
export function createParallaxAnimator(opts = {}) {
  const reduce = prefersReducedMotion();
  const root = opts.root ?? null;
  const items = [];        // [{ el, parallax: number|null, scrollLink: boolean }]
  const seen = new WeakSet();
  let raf = null;

  if (reduce) {
    return {
      rescan(scope = document) {
        // Mesmo com reduced-motion, mantém wa-ready (para fallback do CSS).
        readyTarget(scope).classList.add('wa-ready');
      },
      destroy() {},
    };
  }

  function viewportRect() {
    if (root === null) {
      return { top: 0, height: window.innerHeight || 0 };
    }
    const r = root.getBoundingClientRect();
    return { top: r.top, height: r.height };
  }

  function tick() {
    raf = null;
    const vp = viewportRect();
    const viewCenter = vp.top + vp.height / 2;
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (!it.el.isConnected) {
        items.splice(i, 1);
        continue;
      }
      const r = it.el.getBoundingClientRect();
      if (it.parallax != null) {
        const elCenter = r.top + r.height / 2;
        // Quanto mais distante do centro da viewport, maior o offset.
        const dy = -(elCenter - viewCenter) * it.parallax;
        it.el.style.setProperty('--wa-parallax-y', `${dy.toFixed(1)}px`);
      }
      if (it.scrollLink) {
        // Progress = quanto do elemento já passou pelo viewport.
        // 0 quando o topo do elemento toca a base do viewport;
        // 1 quando a base do elemento toca o topo do viewport.
        const elTopInVp = r.top - vp.top;
        const range = vp.height + r.height;
        const raw = 1 - (elTopInVp + r.height) / range;
        const p = Math.max(0, Math.min(1, raw));
        it.el.style.setProperty('--wa-progress', p.toFixed(3));
      }
    }
  }

  function schedule() {
    if (raf == null) raf = requestAnimationFrame(tick);
  }

  function add(el) {
    if (seen.has(el)) return;
    const pfRaw = el.getAttribute('data-parallax');
    const pf = pfRaw == null || pfRaw === '' ? null : parseFloat(pfRaw);
    const validParallax = Number.isFinite(pf) && pf !== 0 ? Math.max(-1, Math.min(1, pf)) : null;
    const sl = el.getAttribute('data-scroll-link') === '1';
    if (validParallax == null && !sl) return;
    seen.add(el);
    items.push({ el, parallax: validParallax, scrollLink: sl });
  }

  const scroller = root ?? window;
  scroller.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);

  return {
    rescan(scope = document) {
      const s = scope && scope.querySelectorAll ? scope : document;
      readyTarget(s).classList.add('wa-ready');
      for (const el of s.querySelectorAll(COMBINED_SELECTOR)) add(el);
      // Re-syncroniza os já registrados (factor pode ter mudado).
      for (const it of items) {
        const pfRaw = it.el.getAttribute('data-parallax');
        const pf = pfRaw == null || pfRaw === '' ? null : parseFloat(pfRaw);
        it.parallax = Number.isFinite(pf) && pf !== 0 ? Math.max(-1, Math.min(1, pf)) : null;
        it.scrollLink = it.el.getAttribute('data-scroll-link') === '1';
      }
      schedule();
    },
    destroy() {
      scroller.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (raf != null) cancelAnimationFrame(raf);
      raf = null;
      items.length = 0;
    },
  };
}

/**
 * Atalho de uso único (página publicada): cria o animator e escaneia `root`.
 */
export function initParallax(root = document, opts) {
  const animator = createParallaxAnimator(opts);
  animator.rescan(root);
  return animator;
}
