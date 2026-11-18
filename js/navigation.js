/**
 * ============================================================
 * VOZES E MEMÓRIAS — Navegação
 * Etapa 7
 *
 * Responsável por:
 *  - Barra de progresso de leitura baseada no scroll real;
 *  - Índice de capítulos (desktop fixo / mobile off-canvas);
 *  - Destaque do capítulo ativo (header + índice) via IntersectionObserver;
 *  - Botão/atalho de voltar ao topo;
 *  - Toggle acessível do menu mobile (teclado + ARIA).
 * ============================================================
 */

const SELECTORS = {
  header: "#site-header",
  headerChapterIndicator: "#header-chapter-indicator",
  progressFill: "#reading-progress-fill",
  progressBar: "#reading-progress",
  indexPanel: "#chapter-index-panel",
  indexOverlay: "#chapter-index-overlay",
  indexCloseBtn: "#chapter-index-close",
  menuToggleBtn: "#menu-toggle",
  indexLinks: "#chapter-index-panel a[data-chapter]",
  chapters: ".chapter[id]",
  backToTop: ".site-footer__back-to-top, .js-back-to-top",
};

let headerEl = null;
let progressFillEl = null;
let indexPanelEl = null;
let indexOverlayEl = null;
let menuToggleBtn = null;
let indexCloseBtn = null;
let indexLinks = [];
let chapterSections = [];
let lastFocusedBeforeMenu = null;

/* ============================================================
   BARRA DE PROGRESSO DE LEITURA
   ============================================================ */

/**
 * Atualiza a largura da barra de progresso com base na posição de
 * rolagem real da página (0% no topo, 100% ao final do documento).
 */
function updateReadingProgress() {
  if (!progressFillEl) return;

  const scrollTop = window.scrollY || document.documentElement.scrollTop;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  const progress = docHeight > 0 ? Math.min(100, Math.max(0, (scrollTop / docHeight) * 100)) : 0;

  progressFillEl.style.width = `${progress}%`;

  const progressBarEl = document.querySelector(SELECTORS.progressBar);
  if (progressBarEl) {
    progressBarEl.setAttribute("aria-valuenow", String(Math.round(progress)));
  }
}

/**
 * Adiciona/remove a classe de "scrolled" no header para dar
 * feedback visual sutil (sombra/borda) quando o usuário rola a página.
 */
function updateHeaderScrolledState() {
  if (!headerEl) return;
  const scrolled = (window.scrollY || document.documentElement.scrollTop) > 12;
  headerEl.classList.toggle("is-scrolled", scrolled);
}

/* ============================================================
   CAPÍTULO ATIVO — IntersectionObserver
   ============================================================ */

/**
 * Observa todos os capítulos e atualiza:
 *  - o texto do indicador de capítulo no header;
 *  - a classe "is-active" no link correspondente do índice.
 */
function setupActiveChapterObserver() {
  if (chapterSections.length === 0) return;

  const observerOptions = {
    root: null,
    // Considera "ativo" o capítulo cujo título cruza uma faixa
    // próxima ao topo da viewport, para refletir o que o leitor
    // está lendo no momento, não apenas o que está parcialmente visível.
    rootMargin: "-15% 0px -70% 0px",
    threshold: 0,
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        setActiveChapter(entry.target.id);
      }
    });
  }, observerOptions);

  chapterSections.forEach((section) => observer.observe(section));
}

/**
 * Aplica o estado "ativo" visualmente no header e no índice de capítulos.
 * @param {string} chapterId - id do elemento <article class="chapter"> ativo
 */
function setActiveChapter(chapterId) {
  const activeSection = document.getElementById(chapterId);
  const chapterTitle = activeSection ? activeSection.dataset.chapterTitle : "";

  const headerIndicator = document.querySelector(SELECTORS.headerChapterIndicator);
  if (headerIndicator && chapterTitle) {
    headerIndicator.textContent = chapterTitle;
  }

  indexLinks.forEach((link) => {
    const isActive = link.getAttribute("href") === `#${chapterId}`;
    link.classList.toggle("is-active", isActive);
    if (isActive) {
      link.setAttribute("aria-current", "true");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

/* ============================================================
   ÍNDICE DE CAPÍTULOS — abrir/fechar (mobile off-canvas)
   ============================================================ */

/**
 * Abre o painel de índice de capítulos (usado em qualquer largura de
 * tela, mas com comportamento visual off-canvas em mobile via CSS).
 */
function openChapterIndex() {
  if (!indexPanelEl) return;
  lastFocusedBeforeMenu = document.activeElement;

  indexPanelEl.classList.add("is-open");
  indexOverlayEl?.classList.add("is-visible");
  menuToggleBtn?.setAttribute("aria-expanded", "true");
  document.body.classList.add("has-index-open");

  // Move o foco para o primeiro elemento focável do painel.
  const firstFocusable = indexPanelEl.querySelector("a, button");
  firstFocusable?.focus();
}

/**
 * Fecha o painel de índice de capítulos e devolve o foco ao botão
 * que o abriu originalmente.
 */
function closeChapterIndex() {
  if (!indexPanelEl) return;

  indexPanelEl.classList.remove("is-open");
  indexOverlayEl?.classList.remove("is-visible");
  menuToggleBtn?.setAttribute("aria-expanded", "false");
  document.body.classList.remove("has-index-open");

  if (lastFocusedBeforeMenu && typeof lastFocusedBeforeMenu.focus === "function") {
    lastFocusedBeforeMenu.focus();
  } else {
    menuToggleBtn?.focus();
  }
}

/**
 * Alterna entre abrir e fechar o índice, conforme o estado atual.
 */
function toggleChapterIndex() {
  if (!indexPanelEl) return;
  const isOpen = indexPanelEl.classList.contains("is-open");
  if (isOpen) {
    closeChapterIndex();
  } else {
    openChapterIndex();
  }
}

/**
 * Mantém o foco de teclado dentro do painel de índice enquanto aberto
 * (focus trap), e fecha com ESC.
 * @param {KeyboardEvent} event
 */
function handleIndexKeydown(event) {
  if (!indexPanelEl || !indexPanelEl.classList.contains("is-open")) return;

  if (event.key === "Escape") {
    closeChapterIndex();
    return;
  }

  if (event.key === "Tab") {
    const focusableSelectors = "a, button";
    const focusableElements = Array.from(indexPanelEl.querySelectorAll(focusableSelectors));
    if (focusableElements.length === 0) return;

    const first = focusableElements[0];
    const last = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}

/**
 * Fecha o índice automaticamente ao clicar em um link de capítulo,
 * permitindo que a rolagem suave (CSS scroll-behavior) assuma o controle.
 */
function setupIndexLinkClicks() {
  indexLinks.forEach((link) => {
    link.addEventListener("click", () => {
      closeChapterIndex();
    });
  });
}

/* ============================================================
   VOLTAR AO TOPO
   ============================================================ */

/**
 * Rola suavemente a página até o topo (respeitando prefers-reduced-motion
 * através do scroll-behavior já definido em CSS/JS condicional).
 * @param {Event} event
 */
function handleBackToTopClick(event) {
  event.preventDefault();
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({
    top: 0,
    behavior: prefersReducedMotion ? "auto" : "smooth",
  });
  // Move o foco para o início da página por acessibilidade.
  const topAnchor = document.getElementById("topo");
  topAnchor?.setAttribute("tabindex", "-1");
  topAnchor?.focus();
}

function setupBackToTop() {
  const backToTopLinks = document.querySelectorAll(SELECTORS.backToTop);
  backToTopLinks.forEach((link) => {
    link.addEventListener("click", handleBackToTopClick);
  });
}

/* ============================================================
   THROTTLE DE SCROLL (performance)
   ============================================================ */

let scrollTicking = false;

function onScroll() {
  if (!scrollTicking) {
    window.requestAnimationFrame(() => {
      updateReadingProgress();
      updateHeaderScrolledState();
      scrollTicking = false;
    });
    scrollTicking = true;
  }
}

/* ============================================================
   COMPARADOR ANTES / ATUAL
   ============================================================ */

/**
 * Inicializa todos os comparadores antes/atual presentes na página.
 * Controla o slider tanto por mouse/touch (input range nativo)
 * quanto por teclado (setas esquerda/direita, já nativas do
 * elemento <input type="range">).
 */
function initBeforeAfterComparators() {
  const comparators = document.querySelectorAll(".js-before-after");

  comparators.forEach((comparator) => {
    const afterImage = comparator.querySelector(".before-after__image--after");
    const divider = comparator.querySelector(".before-after__divider");
    const slider = comparator.querySelector(".before-after__slider");

    if (!afterImage || !slider) return;

    const updateComparator = (value) => {
      afterImage.style.clipPath = `inset(0 0 0 ${value}%)`;
      if (divider) {
        divider.style.left = `${value}%`;
      }
    };

    // Estado inicial (50%, conforme o atributo value do input).
    updateComparator(slider.value);

    slider.addEventListener("input", (event) => {
      updateComparator(event.target.value);
    });
  });
}

/* ============================================================
   INICIALIZAÇÃO
   ============================================================ */

/**
 * Inicializa todos os componentes de navegação. Deve ser chamado
 * uma única vez, após o DOM estar pronto.
 */
export function initNavigation() {
  headerEl = document.querySelector(SELECTORS.header);
  progressFillEl = document.querySelector(SELECTORS.progressFill);
  indexPanelEl = document.querySelector(SELECTORS.indexPanel);
  indexOverlayEl = document.querySelector(SELECTORS.indexOverlay);
  menuToggleBtn = document.querySelector(SELECTORS.menuToggleBtn);
  indexCloseBtn = document.querySelector(SELECTORS.indexCloseBtn);
  indexLinks = Array.from(document.querySelectorAll(SELECTORS.indexLinks));
  chapterSections = Array.from(document.querySelectorAll(SELECTORS.chapters));

  // Progresso e header: estado inicial + listener de scroll.
  updateReadingProgress();
  updateHeaderScrolledState();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", updateReadingProgress);

  // Capítulo ativo.
  if ("IntersectionObserver" in window) {
    setupActiveChapterObserver();
  }

  // Índice de capítulos (abrir/fechar).
  menuToggleBtn?.addEventListener("click", toggleChapterIndex);
  indexCloseBtn?.addEventListener("click", closeChapterIndex);
  indexOverlayEl?.addEventListener("click", closeChapterIndex);
  document.addEventListener("keydown", handleIndexKeydown);
  setupIndexLinkClicks();

  // Voltar ao topo.
  setupBackToTop();

  // Comparador antes/atual.
  initBeforeAfterComparators();
}
