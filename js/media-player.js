/**
 * ============================================================
 * VOZES E MEMÓRIAS — Players de mídia (áudio, vídeo, documentos)
 * Etapa 6
 *
 * Este módulo:
 *  - Carrega assets/media-manifest.json uma única vez;
 *  - Constrói players de áudio customizados (HTMLAudioElement);
 *  - Constrói players de vídeo HTML5 responsivos;
 *  - Constrói um visualizador modal (lightbox) para documentos/cartas;
 *  - Garante que apenas um áudio toque por vez;
 *  - Nunca usa autoplay;
 *  - Não possui nenhum caminho de arquivo hardcoded: tudo vem do
 *    manifesto (assets/media-manifest.json) e dos atributos
 *    data-media-ref já presentes no HTML.
 * ============================================================
 */

const MANIFEST_PATH = "assets/media-manifest.json";

/** Guarda a lista de players de áudio ativos para controle de "um por vez". */
const activeAudioPlayers = [];

/** Cache do manifesto, carregado uma única vez. */
let mediaManifestCache = null;

/**
 * Carrega e cacheia o manifesto de mídia.
 * @returns {Promise<Object>} o manifesto completo
 */
async function loadMediaManifest() {
  if (mediaManifestCache) {
    return mediaManifestCache;
  }
  try {
    const response = await fetch(MANIFEST_PATH);
    if (!response.ok) {
      throw new Error(`Falha ao carregar manifesto: HTTP ${response.status}`);
    }
    mediaManifestCache = await response.json();
    return mediaManifestCache;
  } catch (error) {
    console.error("[media-player] Não foi possível carregar o manifesto de mídia.", error);
    // Retorna uma estrutura vazia segura para não quebrar o restante da página.
    mediaManifestCache = { midias: [] };
    return mediaManifestCache;
  }
}

/**
 * Busca um item do manifesto pelo seu id.
 * @param {Object} manifest
 * @param {string} id
 * @returns {Object|null}
 */
function findMediaItem(manifest, id) {
  if (!manifest || !Array.isArray(manifest.midias)) return null;
  return manifest.midias.find((item) => item.id === id) || null;
}

/**
 * Formata segundos em mm:ss para exibição de tempo.
 * @param {number} totalSeconds
 * @returns {string}
 */
function formatTime(totalSeconds) {
  if (!isFinite(totalSeconds) || totalSeconds < 0) return "00:00";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Cria um elemento DOM a partir de uma string de tag e classes.
 * @param {string} tag
 * @param {string} [className]
 * @returns {HTMLElement}
 */
function el(tag, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

/* ============================================================
   ÁUDIO — Player customizado
   ============================================================ */

/**
 * Constrói e injeta um player de áudio customizado dentro do container.
 * @param {HTMLElement} container - elemento com classe .js-audio-player
 * @param {Object|null} mediaItem - item correspondente do manifesto, ou null se não encontrado
 */
function buildAudioPlayer(container, mediaItem) {
  const mediaRef = container.dataset.mediaRef || "desconhecido";
  const isAvailable = Boolean(mediaItem && mediaItem.caminho_ficticio);

  const wrapper = el("div", "audio-player");
  wrapper.setAttribute("role", "group");
  wrapper.setAttribute("aria-label", `Player de áudio — ${mediaItem ? mediaItem.marcador_editorial : mediaRef}`);

  // ----- Cabeçalho: título/identificação + origem -----
  const header = el("div", "audio-player__header");

  const title = el("span", "audio-player__title");
  title.textContent = mediaItem ? mediaItem.marcador_editorial : `Áudio (${mediaRef})`;
  header.appendChild(title);

  if (mediaItem && mediaItem.credito_fonte && mediaItem.credito_fonte !== "Não especificado no documento-fonte.") {
    const source = el("span", "audio-player__source");
    source.textContent = mediaItem.credito_fonte;
    header.appendChild(source);
  }

  wrapper.appendChild(header);

  // ----- Linha de controles -----
  const controls = el("div", "audio-player__controls");

  const playButton = el("button", "audio-player__play-btn");
  playButton.type = "button";
  playButton.setAttribute("aria-label", "Reproduzir áudio");
  playButton.innerHTML = '<span class="audio-player__play-icon" aria-hidden="true">▶</span>';

  const progressWrapper = el("div", "audio-player__progress-wrapper");
  const progressBar = el("input", "audio-player__progress");
  progressBar.type = "range";
  progressBar.min = "0";
  progressBar.max = "100";
  progressBar.value = "0";
  progressBar.setAttribute("aria-label", "Progresso do áudio");
  progressWrapper.appendChild(progressBar);

  const timeDisplay = el("span", "audio-player__time");
  timeDisplay.textContent = "00:00 / 00:00";

  const volumeWrapper = el("div", "audio-player__volume-wrapper");
  const volumeIcon = el("span", "audio-player__volume-icon");
  volumeIcon.setAttribute("aria-hidden", "true");
  volumeIcon.textContent = "🔊";
  const volumeControl = el("input", "audio-player__volume");
  volumeControl.type = "range";
  volumeControl.min = "0";
  volumeControl.max = "1";
  volumeControl.step = "0.05";
  volumeControl.value = "1";
  volumeControl.setAttribute("aria-label", "Volume");
  volumeWrapper.appendChild(volumeIcon);
  volumeWrapper.appendChild(volumeControl);

  controls.appendChild(playButton);
  controls.appendChild(progressWrapper);
  controls.appendChild(timeDisplay);
  controls.appendChild(volumeWrapper);
  wrapper.appendChild(controls);

  // ----- Estado de indisponibilidade (placeholder ainda pendente) -----
  if (!isAvailable) {
    wrapper.classList.add("audio-player--pending");
    playButton.disabled = true;
    progressBar.disabled = true;
    volumeControl.disabled = true;
    const pendingNote = el("p", "audio-player__pending-note");
    pendingNote.textContent = "Áudio pendente de publicação.";
    wrapper.appendChild(pendingNote);
  }

  // ----- Elemento <audio> real (sem autoplay, preload metadata apenas) -----
  const audioEl = document.createElement("audio");
  audioEl.preload = "none";
  audioEl.setAttribute("aria-hidden", "true");
  if (isAvailable) {
    audioEl.src = mediaItem.caminho_ficticio;
  }
  wrapper.appendChild(audioEl);

  // ----- Transcrição expansível (somente se houver no manifesto/HTML) -----
  const transcriptSourceId = container.dataset.transcriptRef;
  let transcriptText = null;

  if (transcriptSourceId) {
    const transcriptNode = document.getElementById(transcriptSourceId);
    if (transcriptNode) {
      transcriptText = transcriptNode.innerHTML;
    }
  }

  if (transcriptText) {
    const transcriptToggle = el("button", "audio-player__transcript-toggle");
    transcriptToggle.type = "button";
    transcriptToggle.textContent = "Ver transcrição";
    transcriptToggle.setAttribute("aria-expanded", "false");

    const transcriptBody = el("div", "audio-player__transcript-body");
    transcriptBody.hidden = true;
    transcriptBody.innerHTML = transcriptText;

    transcriptToggle.addEventListener("click", () => {
      const isExpanded = transcriptToggle.getAttribute("aria-expanded") === "true";
      transcriptToggle.setAttribute("aria-expanded", String(!isExpanded));
      transcriptBody.hidden = isExpanded;
      transcriptToggle.textContent = isExpanded ? "Ver transcrição" : "Ocultar transcrição";
    });

    wrapper.appendChild(transcriptToggle);
    wrapper.appendChild(transcriptBody);
  }

  // ----- Eventos (somente se o áudio estiver disponível) -----
  if (isAvailable) {
    playButton.addEventListener("click", () => {
      if (audioEl.paused) {
        pauseAllAudioExcept(audioEl);
        audioEl.play().catch((err) => {
          console.warn("[media-player] Não foi possível reproduzir o áudio:", err);
        });
      } else {
        audioEl.pause();
      }
    });

    audioEl.addEventListener("play", () => {
      playButton.innerHTML = '<span class="audio-player__play-icon" aria-hidden="true">❚❚</span>';
      playButton.setAttribute("aria-label", "Pausar áudio");
      wrapper.classList.add("audio-player--playing");
    });

    audioEl.addEventListener("pause", () => {
      playButton.innerHTML = '<span class="audio-player__play-icon" aria-hidden="true">▶</span>';
      playButton.setAttribute("aria-label", "Reproduzir áudio");
      wrapper.classList.remove("audio-player--playing");
    });

    audioEl.addEventListener("ended", () => {
      progressBar.value = "0";
      timeDisplay.textContent = `00:00 / ${formatTime(audioEl.duration)}`;
    });

    audioEl.addEventListener("loadedmetadata", () => {
      timeDisplay.textContent = `00:00 / ${formatTime(audioEl.duration)}`;
    });

    audioEl.addEventListener("timeupdate", () => {
      if (audioEl.duration > 0) {
        progressBar.value = String((audioEl.currentTime / audioEl.duration) * 100);
      }
      timeDisplay.textContent = `${formatTime(audioEl.currentTime)} / ${formatTime(audioEl.duration)}`;
    });

    progressBar.addEventListener("input", () => {
      if (audioEl.duration > 0) {
        audioEl.currentTime = (Number(progressBar.value) / 100) * audioEl.duration;
      }
    });

    volumeControl.addEventListener("input", () => {
      audioEl.volume = Number(volumeControl.value);
      volumeIcon.textContent = Number(volumeControl.value) === 0 ? "🔇" : "🔊";
    });

    audioEl.addEventListener("error", () => {
      wrapper.classList.add("audio-player--error");
      const errorNote = el("p", "audio-player__pending-note");
      errorNote.textContent = "Não foi possível carregar este áudio no momento.";
      wrapper.appendChild(errorNote);
      playButton.disabled = true;
    });

    activeAudioPlayers.push(audioEl);
  }

  // Substitui o conteúdo original do container pelo player construído,
  // preservando a legenda (.media-caption) que já existia no HTML.
  const caption = container.querySelector(".media-caption");
  container.innerHTML = "";
  container.appendChild(wrapper);
  if (caption) {
    container.appendChild(caption);
  }
}

/**
 * Pausa todos os áudios ativos, exceto o informado.
 * Garante a regra "apenas um player tocando por vez".
 * @param {HTMLAudioElement} exceptAudioEl
 */
function pauseAllAudioExcept(exceptAudioEl) {
  activeAudioPlayers.forEach((audioEl) => {
    if (audioEl !== exceptAudioEl && !audioEl.paused) {
      audioEl.pause();
    }
  });
}

/* ============================================================
   VÍDEO — Player HTML5 responsivo
   ============================================================ */

/**
 * Constrói e injeta um player de vídeo dentro do container.
 * @param {HTMLElement} container - elemento com classe .js-video-player
 * @param {Object|null} mediaItem
 */
function buildVideoPlayer(container, mediaItem) {
  const mediaRef = container.dataset.mediaRef || "desconhecido";
  // O vídeo só é renderizado se o caminho existir e o status for 'publicado'
  const isAvailable = Boolean(mediaItem && mediaItem.caminho_ficticio && mediaItem.status === "publicado");

  const wrapper = el("div", "video-player");
  const frame = el("div", "video-player__frame");

  if (isAvailable) {
    const iframe = document.createElement("iframe");
    iframe.className = "video-player__element";
    // Usa o ID do YouTube que você colocou no caminho_ficticio
    iframe.src = `https://www.youtube.com/embed/${mediaItem.caminho_ficticio}?rel=0&modestbranding=1`;
    iframe.setAttribute("allowfullscreen", "true");
    iframe.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture");
    iframe.style.border = "none";
    iframe.title = mediaItem.legenda_original || mediaItem.marcador_editorial || "Vídeo da reportagem";

    frame.appendChild(iframe);
  } else {
    // Mantém o visual de "Vídeo Pendente" cinza quando o status não for "publicado"
    wrapper.classList.add("video-player--pending");
    frame.classList.add("video-player__frame--placeholder");
    frame.innerHTML = `
      <span class="video-player__icon" aria-hidden="true">▶</span>
      <span class="video-player__pending-note">Vídeo pendente de publicação${mediaItem ? " — " + mediaItem.marcador_editorial : ""}</span>
    `;
  }

  wrapper.appendChild(frame);

  // Preserva a legenda que já estava no HTML
  const caption = container.querySelector(".media-caption");
  container.innerHTML = "";
  container.appendChild(wrapper);
  if (caption) {
    container.appendChild(caption);
  }
}

/* ============================================================
   DOCUMENTOS / CARTAS — Visualizador modal (lightbox)
   ============================================================ */

let modalRoot = null;
let lastFocusedElementBeforeModal = null;

/**
 * Cria a estrutura do modal uma única vez e a anexa ao final do body.
 * @returns {HTMLElement} o elemento raiz do modal
 */
function ensureModalRoot() {
  if (modalRoot) return modalRoot;

  modalRoot = el("div", "document-modal");
  modalRoot.setAttribute("role", "dialog");
  modalRoot.setAttribute("aria-modal", "true");
  modalRoot.setAttribute("aria-hidden", "true");
  modalRoot.hidden = true;

  const overlay = el("div", "document-modal__overlay");
  overlay.addEventListener("click", closeDocumentModal);

  const panel = el("div", "document-modal__panel");

  const closeBtn = el("button", "document-modal__close");
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "Fechar visualizador de documento");
  closeBtn.innerHTML = "&times;";
  closeBtn.addEventListener("click", closeDocumentModal);

  const imageArea = el("div", "document-modal__image-area");
  const transcriptArea = el("div", "document-modal__transcript-area");

  panel.appendChild(closeBtn);
  panel.appendChild(imageArea);
  panel.appendChild(transcriptArea);
  modalRoot.appendChild(overlay);
  modalRoot.appendChild(panel);
  document.body.appendChild(modalRoot);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modalRoot.hidden) {
      closeDocumentModal();
    }
    if (event.key === "Tab" && !modalRoot.hidden) {
      trapFocusInModal(event, panel);
    }
  });

  return modalRoot;
}

/**
 * Mantém o foco de teclado dentro do modal enquanto ele estiver aberto.
 * @param {KeyboardEvent} event
 * @param {HTMLElement} panel
 */
function trapFocusInModal(event, panel) {
  const focusableSelectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
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

/**
 * Abre o modal de documento com a imagem (ou placeholder) e a transcrição.
 * @param {Object|null} mediaItem
 * @param {string|null} transcriptHtml
 * @param {HTMLElement} triggerElement - elemento que disparou a abertura, para devolver o foco ao fechar
 */
function openDocumentModal(mediaItem, transcriptHtml, triggerElement) {
  const modal = ensureModalRoot();
  lastFocusedElementBeforeModal = triggerElement;

  const imageArea = modal.querySelector(".document-modal__image-area");
  const transcriptArea = modal.querySelector(".document-modal__transcript-area");

  imageArea.innerHTML = "";
  transcriptArea.innerHTML = "";

  const isAvailable = Boolean(mediaItem && mediaItem.caminho_ficticio);

  if (isAvailable) {
    const img = document.createElement("img");
    img.src = mediaItem.caminho_ficticio;
    img.alt = mediaItem.legenda_original || mediaItem.marcador_editorial || "Documento digitalizado";
    img.className = "document-modal__image";
    img.addEventListener("error", () => {
      imageArea.innerHTML = '<p class="document-modal__pending-note">Não foi possível carregar esta imagem no momento.</p>';
    });
    imageArea.appendChild(img);
  } else {
    const pendingNote = el("p", "document-modal__pending-note");
    pendingNote.textContent = `Imagem pendente de publicação${mediaItem ? " — " + mediaItem.marcador_editorial : ""}.`;
    imageArea.appendChild(pendingNote);
  }

  if (mediaItem && mediaItem.legenda_original) {
    const caption = el("p", "document-modal__caption");
    caption.textContent = mediaItem.legenda_original;
    imageArea.appendChild(caption);
  }

  if (transcriptHtml) {
    const transcriptTitle = el("h3", "document-modal__transcript-title");
    transcriptTitle.textContent = "Transcrição";
    const transcriptBody = el("div", "document-modal__transcript-body");
    transcriptBody.innerHTML = transcriptHtml;
    transcriptArea.appendChild(transcriptTitle);
    transcriptArea.appendChild(transcriptBody);
  }

  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("has-modal-open");

  const closeBtn = modal.querySelector(".document-modal__close");
  closeBtn.focus();
}

/**
 * Fecha o modal e devolve o foco ao elemento que o abriu.
 */
function closeDocumentModal() {
  if (!modalRoot || modalRoot.hidden) return;
  modalRoot.hidden = true;
  modalRoot.setAttribute("aria-hidden", "true");
  document.body.classList.remove("has-modal-open");
  if (lastFocusedElementBeforeModal && typeof lastFocusedElementBeforeModal.focus === "function") {
    lastFocusedElementBeforeModal.focus();
  }
}

/**
 * Prepara um container de documento/carta para abrir o modal ao ser ativado.
 * @param {HTMLElement} container - elemento com classe .js-document-viewer
 * @param {Object|null} mediaItem
 */
function buildDocumentViewer(container, mediaItem) {
  container.setAttribute("role", "button");
  container.setAttribute("tabindex", "0");
  const label = mediaItem ? `Ampliar documento — ${mediaItem.marcador_editorial}` : "Ampliar documento";
  container.setAttribute("aria-label", label);
  container.classList.add("js-document-viewer--ready");

  const transcriptRefId = container.dataset.transcriptRef;
  const transcriptHtml = transcriptRefId ? document.getElementById(transcriptRefId)?.innerHTML || null : null;

  const activate = () => openDocumentModal(mediaItem, transcriptHtml, container);

  container.addEventListener("click", activate);
  container.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      activate();
    }
  });
}

/* ============================================================
   INICIALIZAÇÃO GERAL
   ============================================================ */

/**
 * Ponto de entrada: carrega o manifesto e inicializa todos os
 * players/visualizadores presentes na página.
 */
export async function initMediaPlayers() {
  const manifest = await loadMediaManifest();

  const audioContainers = document.querySelectorAll(".js-audio-player");
  audioContainers.forEach((container) => {
    const mediaItem = findMediaItem(manifest, container.dataset.mediaRef);
    buildAudioPlayer(container, mediaItem);
  });

  const videoContainers = document.querySelectorAll(".js-video-player");
  videoContainers.forEach((container) => {
    const mediaItem = findMediaItem(manifest, container.dataset.mediaRef);
    buildVideoPlayer(container, mediaItem);
  });

  const documentContainers = document.querySelectorAll(".js-document-viewer");
  documentContainers.forEach((container) => {
    const mediaItem = findMediaItem(manifest, container.dataset.mediaRef);
    buildDocumentViewer(container, mediaItem);
  });
}

// Auto-inicialização quando este módulo é carregado via <script type="module">
document.addEventListener("DOMContentLoaded", () => {
  initMediaPlayers().catch((err) => {
    console.error("[media-player] Erro ao inicializar players de mídia:", err);
  });
});
