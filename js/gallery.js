/**
 * ============================================================
 * VOZES E MEMÓRIAS — Galeria filtrável + Lightbox
 * Etapa 7
 *
 * Carrega assets/media-manifest.json e renderiza todos os 25 itens
 * na grade da galeria (capítulo 7), com filtros por categoria e
 * um lightbox para navegação entre as fotografias.
 *
 * Categorias de filtro: Todos, Fotografias, Cartas, Áudios,
 * Vídeos, Imprensa.
 *
 * Como "Cartas" e "Imprensa" não são campos nativos do manifesto
 * (que usa apenas tipo: foto/audio/video), a categorização é
 * derivada aqui, de forma explícita e documentada, a partir do id
 * de cada item — sem alterar o arquivo-fonte do manifesto.
 * ============================================================
 */

const MANIFEST_PATH = "assets/media-manifest.json";

/**
 * Mapeamento explícito de IDs que pertencem às subcategorias
 * "carta" e "imprensa" dentro do tipo "foto". Baseado no que já
 * foi registrado no mapa editorial (docs/02-mapa-editorial.md):
 *  - foto-11: cartas e envelopes
 *  - foto-12: carta com homenagem de Ângela
 *  - foto-08: recorte de jornal (imprensa)
 */
const CARTA_IDS = new Set(["foto-11", "foto-12"]);
const IMPRENSA_IDS = new Set(["foto-08"]);

const TIPO_ICONS = {
  foto: "🖼",
  audio: "♪",
  video: "▶",
};

let manifestCache = null;
let galleryItemsData = [];
let currentLightboxIndex = -1;
let lastFocusedBeforeLightbox = null;
let lightboxRoot = null;

/* ============================================================
   CARREGAMENTO DO MANIFESTO
   ============================================================ */

async function loadManifest() {
  if (manifestCache) return manifestCache;
  try {
    const response = await fetch(MANIFEST_PATH);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    manifestCache = await response.json();
  } catch (error) {
    console.error("[gallery] Não foi possível carregar o manifesto de mídia.", error);
    manifestCache = { midias: [] };
  }
  return manifestCache;
}

/**
 * Deriva a(s) categoria(s) de filtro aplicáveis a um item do manifesto.
 * Um item pode pertencer a mais de uma categoria simultaneamente
 * (ex.: foto-11 é, ao mesmo tempo, "foto" e "carta").
 * @param {Object} item
 * @returns {string[]} lista de categorias, ex.: ['foto'], ['foto', 'carta']
 */
function resolveCategories(item) {
  // Se o item tiver uma subcategoria (como 'carta'), a etiqueta será APENAS 'carta'
  if (item.subcategoria) {
    return [item.subcategoria];
  }

  // Se não tiver subcategoria, a etiqueta será o tipo normal ('foto', 'audio' ou 'video')
  return [item.tipo];
}

/* ============================================================
   RENDERIZAÇÃO DA GRADE
   ============================================================ */

/**
 * Cria o elemento de card de um item da galeria.
 * @param {Object} item
 * @param {number} index
 * @returns {HTMLElement}
 */
function createGalleryCard(item, index) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "gallery__item";
  card.dataset.categories = resolveCategories(item).join(" ");
  card.dataset.index = String(index);
  card.setAttribute("aria-label", `${item.marcador_editorial} — ${item.legenda_original || "ver detalhes"}`);

  const thumb = document.createElement("div");
  thumb.className = `gallery__thumb gallery__thumb--${item.tipo}`;

  if (item.status === "placeholder_pending" || !item.caminho_ficticio) {
    thumb.classList.add("gallery__thumb--pending");
    const icon = document.createElement("span");
    icon.className = "gallery__thumb-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = TIPO_ICONS[item.tipo] || "•";
    thumb.appendChild(icon);
  } else if (item.tipo === "foto") {
    const img = document.createElement("img");
    img.src = item.caminho_ficticio;
    img.alt = item.legenda_original || item.marcador_editorial;
    img.loading = "lazy";
    thumb.appendChild(img);
  } else {
    const icon = document.createElement("span");
    icon.className = "gallery__thumb-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = TIPO_ICONS[item.tipo] || "•";
    thumb.appendChild(icon);
  }

  const typeBadge = document.createElement("span");
  typeBadge.className = "gallery__thumb-badge";
  typeBadge.textContent = item.marcador_editorial;
  thumb.appendChild(typeBadge);

  const caption = document.createElement("span");
  caption.className = "gallery__item-caption";
  caption.textContent = truncateText(item.legenda_original || "", 90);

  card.appendChild(thumb);
  card.appendChild(caption);

  card.addEventListener("click", () => openLightbox(index));

  return card;
}

/**
 * Trunca um texto para exibição compacta no card da galeria,
 * sem alterar o texto original armazenado nos dados (apenas a
 * apresentação visual do card é encurtada).
 * @param {string} text
 * @param {number} maxLength
 * @returns {string}
 */
function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

/**
 * Renderiza todos os itens do manifesto na grade da galeria.
 * @param {HTMLElement} gridEl
 * @param {Object[]} items
 */
function renderGalleryGrid(gridEl, items) {
  gridEl.innerHTML = "";
  const fragment = document.createDocumentFragment();

  items.forEach((item, index) => {
    fragment.appendChild(createGalleryCard(item, index));
  });

  gridEl.appendChild(fragment);
}

/* ============================================================
   FILTROS
   ============================================================ */

/**
 * Aplica um filtro de categoria à grade já renderizada, ocultando
 * (via atributo hidden) os cards que não pertencem à categoria.
 * @param {HTMLElement} gridEl
 * @param {string} filterValue - 'all' | 'foto' | 'carta' | 'audio' | 'video' | 'imprensa'
 */
function applyGalleryFilter(gridEl, filterValue) {
  const cards = gridEl.querySelectorAll(".gallery__item");
  cards.forEach((card) => {
    const categories = (card.dataset.categories || "").split(" ");
    const matches = filterValue === "all" || categories.includes(filterValue);
    card.hidden = !matches;
  });
}

/**
 * Liga os botões de filtro à função de filtragem, atualizando o
 * estado visual "is-active" do botão selecionado.
 * @param {HTMLElement} filtersEl
 * @param {HTMLElement} gridEl
 */
function setupGalleryFilters(filtersEl, gridEl) {
  const filterButtons = filtersEl.querySelectorAll(".gallery__filter");

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      filterButtons.forEach((btn) => btn.classList.remove("is-active"));
      button.classList.add("is-active");
      applyGalleryFilter(gridEl, button.dataset.filter);
    });
  });
}

/* ============================================================
   LIGHTBOX
   ============================================================ */

/**
 * Cria a estrutura DOM do lightbox uma única vez.
 * @returns {HTMLElement}
 */
function ensureLightboxRoot() {
  if (lightboxRoot) return lightboxRoot;

  lightboxRoot = document.createElement("div");
  lightboxRoot.className = "lightbox";
  lightboxRoot.setAttribute("role", "dialog");
  lightboxRoot.setAttribute("aria-modal", "true");
  lightboxRoot.setAttribute("aria-label", "Visualizador de imagem ampliada");
  lightboxRoot.hidden = true;

  const overlay = document.createElement("div");
  overlay.className = "lightbox__overlay";
  overlay.addEventListener("click", closeLightbox);

  const panel = document.createElement("div");
  panel.className = "lightbox__panel";

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "lightbox__close";
  closeBtn.setAttribute("aria-label", "Fechar visualizador");
  closeBtn.innerHTML = "&times;";
  closeBtn.addEventListener("click", closeLightbox);

  const prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.className = "lightbox__nav lightbox__nav--prev";
  prevBtn.setAttribute("aria-label", "Item anterior");
  prevBtn.innerHTML = "&#8592;";
  prevBtn.addEventListener("click", () => navigateLightbox(-1));

  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "lightbox__nav lightbox__nav--next";
  nextBtn.setAttribute("aria-label", "Próximo item");
  nextBtn.innerHTML = "&#8594;";
  nextBtn.addEventListener("click", () => navigateLightbox(1));

  const mediaArea = document.createElement("div");
  mediaArea.className = "lightbox__media-area";

  const captionArea = document.createElement("p");
  captionArea.className = "lightbox__caption";

  const counterArea = document.createElement("span");
  counterArea.className = "lightbox__counter";

  panel.appendChild(closeBtn);
  panel.appendChild(mediaArea);
  panel.appendChild(captionArea);
  panel.appendChild(counterArea);
  panel.appendChild(prevBtn);
  panel.appendChild(nextBtn);

  lightboxRoot.appendChild(overlay);
  lightboxRoot.appendChild(panel);
  document.body.appendChild(lightboxRoot);

  document.addEventListener("keydown", handleLightboxKeydown);

  return lightboxRoot;
}

/**
 * Lida com navegação por teclado dentro do lightbox: ESC fecha,
 * setas esquerda/direita navegam, Tab é preso dentro do painel.
 * @param {KeyboardEvent} event
 */
function handleLightboxKeydown(event) {
  if (!lightboxRoot || lightboxRoot.hidden) return;

  if (event.key === "Escape") {
    closeLightbox();
    return;
  }

  if (event.key === "ArrowLeft") {
    navigateLightbox(-1);
    return;
  }

  if (event.key === "ArrowRight") {
    navigateLightbox(1);
    return;
  }

  if (event.key === "Tab") {
    const panel = lightboxRoot.querySelector(".lightbox__panel");
    const focusableSelectors = "button";
    const focusableElements = Array.from(panel.querySelectorAll(focusableSelectors));
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
 * Renderiza o conteúdo do lightbox para o item no índice informado.
 * @param {number} index
 */
function renderLightboxContent(index) {
  const item = galleryItemsData[index];
  if (!item) return;

  const mediaArea = lightboxRoot.querySelector(".lightbox__media-area");
  const captionArea = lightboxRoot.querySelector(".lightbox__caption");
  const counterArea = lightboxRoot.querySelector(".lightbox__counter");

  mediaArea.innerHTML = "";

  // Agora ele verifica se a mídia tem caminho_ficticio OU youtube_id
  const hasMedia = Boolean(item.caminho_ficticio || item.youtube_id);
  const isAvailable = item.status !== "placeholder_pending" && hasMedia;

  if (!isAvailable) {
    const pending = document.createElement("p");
    pending.className = "lightbox__pending-note";
    pending.textContent = `Mídia pendente de publicação — ${item.marcador_editorial}.`;
    mediaArea.appendChild(pending);
  } else if (item.tipo === "foto") {
    // 1. Renderiza a fotografia
    const img = document.createElement("img");
    img.src = item.caminho_ficticio;
    img.alt = item.legenda_original || item.marcador_editorial;
    img.className = "lightbox__image";

    // 2. O GATILHO DO ZOOM: É esta função que o seu arquivo perdeu
    img.addEventListener("click", function () {
      img.classList.toggle("is-zoomed");
    });

    mediaArea.appendChild(img);
  } else if (item.tipo === "audio") {
    // 2. Renderiza PLAYER DE ÁUDIO
    const audio = document.createElement("audio");
    audio.controls = true;
    audio.src = item.caminho_ficticio;
    audio.style.width = "100%";
    audio.style.minWidth = "300px";
    mediaArea.appendChild(audio);
  } else if (item.tipo === "video") {
    // 3. Renderiza VÍDEO puxando a chave correta: item.youtube_id
    const iframe = document.createElement("iframe");

    iframe.src = `https://www.youtube.com/embed/${item.youtube_id}?rel=0`;

    iframe.setAttribute("title", "YouTube video player");
    iframe.setAttribute("frameborder", "0");
    iframe.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share");
    iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    iframe.setAttribute("allowfullscreen", "true");

    iframe.style.width = "100%";
    iframe.style.aspectRatio = "16/9";
    iframe.style.minWidth = "60vw";
    iframe.style.border = "none";
    iframe.style.borderRadius = "8px";

    mediaArea.appendChild(iframe);
  }

  // NOVO: Adiciona a dica visual para mobile APENAS se o item for uma imagem
  let textoLegenda = item.legenda_original || "";
  if (item.tipo === "foto") {
    textoLegenda += " 🔍 (Toque na foto para ampliar)";
  }
  captionArea.textContent = textoLegenda;
}

/**
 * Abre o lightbox a partir de um índice específico do array de itens.
 * @param {number} index
 */
function openLightbox(index) {
  const root = ensureLightboxRoot();
  lastFocusedBeforeLightbox = document.activeElement;
  currentLightboxIndex = index;

  renderLightboxContent(index);

  root.hidden = false;
  document.body.classList.add("has-lightbox-open");

  const closeBtn = root.querySelector(".lightbox__close");
  closeBtn.focus();
}

/**
 * Fecha o lightbox e devolve o foco ao elemento que o abriu.
 */
function closeLightbox() {
  if (!lightboxRoot || lightboxRoot.hidden) return;
  lightboxRoot.hidden = true;
  document.body.classList.remove("has-lightbox-open");

  if (lastFocusedBeforeLightbox && typeof lastFocusedBeforeLightbox.focus === "function") {
    lastFocusedBeforeLightbox.focus();
  }
}

/**
 * Navega para o item anterior/próximo dentro do lightbox, com
 * comportamento circular (do último volta ao primeiro, e vice-versa).
 * @param {number} direction - -1 para anterior, 1 para próximo
 */
function navigateLightbox(direction) {
  if (currentLightboxIndex === -1 || galleryItemsData.length === 0) return;
  const total = galleryItemsData.length;
  currentLightboxIndex = (currentLightboxIndex + direction + total) % total;
  renderLightboxContent(currentLightboxIndex);
}

/* ============================================================
   INICIALIZAÇÃO
   ============================================================ */

/**
 * Inicializa a galeria: carrega o manifesto, renderiza a grade
 * completa (todos os 25 itens, mesmo pendentes) e liga os filtros.
 */
export async function initGallery() {
  const gridEl = document.getElementById("gallery-grid");
  const filtersEl = document.getElementById("gallery-filters");

  if (!gridEl || !filtersEl) return;

  const manifest = await loadManifest();
  galleryItemsData = Array.isArray(manifest.midias) ? manifest.midias : [];

  renderGalleryGrid(gridEl, galleryItemsData);
  setupGalleryFilters(filtersEl, gridEl);
}
