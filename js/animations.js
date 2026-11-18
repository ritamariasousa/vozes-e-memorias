/**
 * ============================================================
 * VOZES E MEMÓRIAS — Animações de entrada (scrollytelling leve)
 * Etapa 7
 *
 * Aplica fade-in / slide-up discreto a imagens, pull quotes e
 * módulos de mídia conforme entram na viewport, via IntersectionObserver.
 *
 * Respeita `prefers-reduced-motion`: quando o usuário tiver essa
 * preferência ativada, os elementos aparecem imediatamente, sem
 * transição, e o observer sequer é inicializado com efeito de
 * movimento (apenas a classe final "is-visible" é aplicada).
 * ============================================================
 */

const ANIMATABLE_SELECTOR = [".media-container", ".pull-quote", ".lyric-quote", ".timeline", ".letter-viewer", ".chapter__title", ".dialogue-block"].join(", ");

const REVEAL_CLASS = "is-visible";
const BASE_CLASS = "reveal-on-scroll";

/**
 * Verifica, em tempo real, se o usuário prefere movimento reduzido.
 * @returns {boolean}
 */
function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Marca todos os elementos elegíveis com a classe base de animação,
 * antes de observá-los. Isso permite que o CSS controle o estado
 * "oculto" inicial apenas quando JS está de fato ativo (progressive
 * enhancement: sem JS, nada fica escondido).
 */
function tagAnimatableElements() {
  const elements = document.querySelectorAll(ANIMATABLE_SELECTOR);
  elements.forEach((element) => {
    element.classList.add(BASE_CLASS);
  });
  return Array.from(elements);
}

/**
 * Inicializa o IntersectionObserver responsável por revelar os
 * elementos conforme entram na viewport.
 * @param {HTMLElement[]} elements
 */
function observeElements(elements) {
  const observerOptions = {
    root: null,
    rootMargin: "0px 0px -8% 0px",
    threshold: 0.12,
  };

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add(REVEAL_CLASS);
        // Após revelar uma vez, paramos de observar o elemento —
        // a reportagem é de leitura linear, não precisamos
        // re-animar ao rolar para cima e para baixo repetidamente.
        obs.unobserve(entry.target);
      }
    });
  }, observerOptions);

  elements.forEach((element) => observer.observe(element));
}

/**
 * Inicializa as animações de entrada. Se o usuário preferir
 * movimento reduzido, todos os elementos são marcados como
 * visíveis imediatamente, sem observer e sem transição.
 */
export function initScrollAnimations() {
  const elements = tagAnimatableElements();

  if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
    elements.forEach((element) => element.classList.add(REVEAL_CLASS));
    return;
  }

  observeElements(elements);
}
