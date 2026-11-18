/**
 * ============================================================
 * VOZES E MEMÓRIAS — Ponto de entrada principal
 * Etapa 7
 *
 * Importa e inicializa, em ordem, todos os módulos da aplicação.
 * Este é o único arquivo referenciado diretamente pelo <script
 * type="module"> no index.html.
 * ============================================================
 */

import { initMediaPlayers } from "./media-player.js";
import { initNavigation } from "./navigation.js";
import { initScrollAnimations } from "./animations.js";
import { initGallery } from "./gallery.js";

document.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  initScrollAnimations();

  initMediaPlayers().catch((err) => {
    console.error("[main] Erro ao inicializar players de mídia:", err);
  });

  initGallery().catch((err) => {
    console.error("[main] Erro ao inicializar galeria:", err);
  });
});
