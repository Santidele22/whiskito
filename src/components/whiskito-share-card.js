import { WhiskitoElement } from "./base-element.js";

/**
 * Isla de compartir: nace bloqueada (sin wallet) y se activa sola cuando
 * `main.js` le escribe `address`. En ese momento dibuja el QR de
 * `${shareBase}/u/${address}` y habilita los botones de compartir.
 *
 * Es un web component con shadow root (declara estilos propios), así que su CSS
 * es autosuficiente: el reset global no cruza la frontera y los @keyframes se
 * resuelven adentro del árbol. No está en el cartel de referencia, pero habla el
 * mismo idioma: papel crema, tinta, sombra dura, rojo cartel, mostaza y cobalto.
 */

/** Texto que acompaña al link en cada red. */
export const SHARE_TEXT = "Invitame un whiskito 🥃";

/** Título del share nativo (Web Share API). */
export const SHARE_TITLE = "Invitame un whiskito 🥃";

/** Fallback del shareBase cuando el atributo no está. */
const DEFAULT_SHARE_BASE = "https://whiskito.app";

/** URL que se muestra mientras no hay wallet conectada. */
const LOCKED_DISPLAY_URL = "whiskito.app/u/tu-wallet";

/** Etiquetas del botón de copiar (feedback temporal). */
const COPY_LABEL = "Copiar link";
const COPIED_LABEL = "¡Copiado!";
const COPY_FEEDBACK_MS = 2000;

/**
 * URL de destino de cada red que comparte por link. Función pura: no toca el
 * DOM, así se puede testear (y reusar) sin navegador.
 *
 * `native`, `copy` y `download` no se resuelven con una URL, por eso devuelven
 * `null` (el componente los maneja con la Web Share API / clipboard / canvas).
 *
 * @param {string} network  native | whatsapp | x | telegram | facebook | copy | download
 * @param {string} url      link a compartir
 * @param {string} [text]   texto que acompaña al link
 * @returns {string|null}
 */
export function shareTarget(network, url, text = SHARE_TEXT) {
  const link = String(url ?? "");
  const message = String(text ?? SHARE_TEXT);
  switch (network) {
    case "whatsapp":
      return "https://wa.me/?text=" + encodeURIComponent(`${message} ${link}`);
    case "x":
      return (
        "https://twitter.com/intent/tweet?text=" +
        encodeURIComponent(message) +
        "&url=" +
        encodeURIComponent(link)
      );
    case "telegram":
      return (
        "https://t.me/share/url?url=" +
        encodeURIComponent(link) +
        "&text=" +
        encodeURIComponent(message)
      );
    case "facebook":
      return "https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(link);
    default:
      return null;
  }
}

export class WhiskitoShareCard extends WhiskitoElement {
  static observedAttributes = ["address", "share-base", "open"];

  static styles = /* css */ `
    /* El reset universal de styles.css no cruza la frontera del shadow root:
       se copia acá para que margin, padding y box-sizing no vuelvan al UA. */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    :host {
      display: block;
    }

    /* Nuestro CSS no puede ganarle al display:none que trae [hidden]. */
    [hidden] {
      display: none !important;
    }

    /* Los marcadores de icono se vuelven SVG con la clase .icon: mide 1em y
       dibuja con currentColor, así que hereda tamaño y color del slot donde
       vive. La hoja global no cruza la frontera del shadow root, por eso va acá. */
    .icon {
      width: 1em;
      height: 1em;
      flex: none;
      vertical-align: -0.15em;
    }

    /* ---------- Flotantes: trigger + panel ---------- */
    /* Todo lo que renderiza la isla es flotante: no ocupa lugar en el flujo de
       la página. Nada de transform/filter/will-change acá ni en un ancestro:
       convertirían a ese ancestro en el containing block de los fixed y el
       panel dejaría de seguir el scroll. */
    #shareTrigger {
      position: fixed;
      right: 20px;
      bottom: 20px;
      z-index: 200;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 12px 20px;
      border: 3px solid var(--ink);
      border-radius: 6px;
      background: var(--blues-red);
      color: var(--paper);
      font-family: var(--cond);
      font-size: 1rem;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      cursor: pointer;
      box-shadow: 5px 5px 0 var(--ink);
      transition: box-shadow 0.15s ease;
    }

    /* El hover corre la sombra dura, no la caja: sin transform, el trigger
       sigue clavado en la esquina. */
    #shareTrigger:hover {
      box-shadow: 8px 8px 0 var(--ink);
    }

    /* El panel es el contenedor flotante con scroll; la tarjeta de adentro es
       la que manda. Esta superficie propia (fondo + borde, sin filtros ni
       backdrop: crearían containing block y romperían el fixed de los hijos)
       unifica los botones que si no parecen flotar sueltos. */
    #sharePanel {
      position: fixed;
      right: 20px;
      bottom: 92px;
      z-index: 200;
      width: min(420px, calc(100vw - 40px));
      max-height: calc(100vh - 130px);
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
      /* Un poco de aire: con overflow-y el scrollport recorta, y sin padding
         la sombra de la tarjeta desaparecería contra los bordes. */
      padding: 14px 12px 12px;
      background: var(--paper-dark);
      border: 3px solid var(--ink);
      border-radius: 6px;
      box-shadow: 8px 8px 0 var(--cobalt);
      font-family: var(--cond);
      color: var(--ink);
      text-align: center;
    }

    /* Entrada suave sólo con opacidad: un transform acá movería las cajas
       mientras dura la animación (y ensuciaría la medición del harness). */
    #sharePanel:not([hidden]) {
      animation: share-panel-in 0.22s ease-out;
    }

    @keyframes share-panel-in {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    /* La tarjeta es un hermano posicionado que viene después en el DOM: con
       z-index auto el orden de pintado la pone encima del ×, que queda
       invisible e inclickable. El z-index lo sube por arriba de la tarjeta. */
    #shareClose {
      position: absolute;
      top: 10px;
      right: 10px;
      z-index: 2;
      width: 32px;
      height: 32px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 2px solid var(--ink);
      border-radius: 4px;
      background: var(--paper);
      color: var(--ink);
      font-family: var(--cond);
      font-size: 1.15rem;
      font-weight: 700;
      line-height: 1;
      cursor: pointer;
      box-shadow: 2px 2px 0 var(--ink);
    }

    #shareClose:hover {
      background: var(--blues-red);
      color: var(--paper);
    }

    /* ---------- Tarjeta: la carta del bar ---------- */
    .share-card {
      position: relative;
      width: min(460px, 100%);
      /* Es flex item del panel: sin esto, cuando el panel topea su max-height
         la tarjeta se encoge y su propio overflow: hidden corta el QR al
         medio. El que scrollea es el panel, no la tarjeta. */
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding: 36px 32px 32px;
      background-color: var(--paper);
      /* Textura de papel: los mismos puntos de impresión de styles.css. */
      background-image: radial-gradient(
        rgba(28, 21, 18, 0.045) 1px,
        transparent 1.5px
      );
      background-size: 5px 5px;
      border: 3px solid var(--ink);
      border-radius: 6px;
      box-shadow: 8px 8px 0 var(--cobalt);
      overflow: hidden;
    }

    .brand {
      position: relative;
      font-family: var(--cond);
      font-size: 0.82rem;
      font-weight: 700;
      letter-spacing: 3px;
      text-transform: uppercase;
      color: var(--blues-red);
    }

    .share-title {
      position: relative;
      font-family: var(--display);
      font-size: 1.6rem;
      font-weight: 700;
      line-height: 1.15;
      text-transform: uppercase;
      color: var(--ink);
    }

    .share-title .gold {
      color: var(--mustard);
    }

    /* ---------- QR ---------- */
    /* El blanco de .qr-frame es la zona de silencio del QR: no se saca. */
    .qr-frame {
      position: relative;
      /* El marco abraza al QR en vez de ocupar todo el ancho de la tarjeta:
         cuadrado y apenas más grande que el código. El padding es la zona de
         silencio del QR, así que se queda. */
      width: fit-content;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      background: #fff;
      border: 3px solid var(--ink);
      border-radius: 6px;
      box-shadow: 4px 4px 0 rgba(28, 21, 18, 0.25);
    }

    .qr-frame.is-locked {
      background: var(--paper-dark);
      border: 3px dashed var(--stamp);
      box-shadow: none;
    }

    #qrCanvas {
      display: block;
      width: 100%;
      max-width: 220px;
      height: auto;
      border-radius: 4px;
    }

    .qr-locked,
    .qr-fallback {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      width: 100%;
      max-width: 220px;
      min-height: 220px;
      font-size: 0.9rem;
      line-height: 1.45;
    }

    .qr-locked {
      color: var(--stamp);
    }

    .locked-icon {
      font-size: 1.9rem;
      animation: locked-pulse 2.4s ease-in-out infinite;
    }

    /* Los @keyframes se resuelven dentro del shadow root: van declarados acá.
       Sólo opacidad: sin transform, para no crear containing block ni mover
       cajas mientras corre. */
    @keyframes locked-pulse {
      0%,
      100% {
        opacity: 0.55;
      }
      50% {
        opacity: 1;
      }
    }

    .qr-fallback {
      color: var(--ink);
    }

    .fallback-icon {
      font-size: 1.8rem;
    }

    .fallback-hint {
      font-size: 0.78rem;
      color: var(--stamp);
    }

    /* ---------- Link ---------- */
    .share-link {
      position: relative;
      max-width: 100%;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 0.84rem;
      line-height: 1.5;
      color: var(--stamp);
      /* Sin break-all: la dirección sólo se parte si no entra ni sola. */
      overflow-wrap: break-word;
    }

    /* La dirección viaja como una caja atómica: si no entra al lado del
       prefijo, baja entera a la línea siguiente en vez de partirse en medio
       del hex (…5A4B / 3C2D876F). Va en cobalto, como los <code> del sistema. */
    .share-link .link-address {
      display: inline-block;
      color: var(--cobalt);
    }

    /* ---------- Línea de confianza ---------- */
    .share-trust {
      position: relative;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 4px 10px;
      font-size: 0.76rem;
      color: var(--stamp);
    }

    .share-trust .check {
      color: var(--success);
      font-weight: 700;
    }

    .share-trust .dot {
      opacity: 0.5;
    }

    /* ---------- Botón de conexión (estado bloqueado) ---------- */
    .share-connect {
      position: relative;
      width: 100%;
      margin-top: 4px;
      padding: 14px 24px;
      border: 3px solid var(--ink);
      border-radius: 6px;
      background: var(--mustard);
      color: var(--ink);
      font-family: var(--cond);
      font-size: 1.1rem;
      font-weight: 700;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      cursor: pointer;
      box-shadow: 5px 5px 0 var(--ink);
      transition: box-shadow 0.2s ease;
    }

    .share-connect:hover {
      box-shadow: 8px 8px 0 var(--ink);
    }

    /* ---------- Botones de compartir ---------- */
    .share-actions {
      /* También flex item del panel: no se encoge, scrollea el panel. */
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      width: 100%;
      max-width: 620px;
    }

    /* Las cuatro redes en dos columnas parejas. */
    .share-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      width: 100%;
    }

    /* Compartir nativo, copiar y descargar: fila propia abajo de la grilla. */
    .share-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 10px;
      width: 100%;
    }

    .share-grid .share-btn {
      justify-content: center;
    }

    /* Secundarios en mostaza, como los del cartel. */
    .share-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 18px;
      border: 2px solid var(--ink);
      border-radius: 4px;
      background: var(--mustard);
      color: var(--ink);
      font-family: var(--cond);
      font-size: 0.95rem;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      cursor: pointer;
      transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease,
        box-shadow 0.2s ease;
    }

    .share-btn:hover:not(:disabled) {
      background: var(--paper);
      border-color: var(--ink);
      color: var(--ink);
      box-shadow: 3px 3px 0 var(--ink);
    }

    .share-btn:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    .share-btn.is-copied {
      background: var(--paper);
      border-color: var(--success);
      color: var(--success);
    }

    @media (max-width: 768px) {
      #sharePanel {
        right: 12px;
        bottom: 84px;
        width: calc(100vw - 24px);
      }

      #shareTrigger {
        right: 12px;
        bottom: 12px;
        padding: 10px 16px;
        font-size: 0.86rem;
      }

      .share-card {
        width: 100%;
        padding: 28px 20px 24px;
      }

      #qrCanvas {
        max-width: 180px;
      }

      .qr-locked,
      .qr-fallback {
        min-height: 180px;
      }
    }
  `;

  static template = /* html */ `
    <button
      id="shareTrigger"
      class="share-trigger"
      type="button"
      aria-controls="sharePanel"
      aria-expanded="false"
      data-attr="aria-expanded:expanded"
    >
      <i data-lucide="share2"></i>
      <span data-text="triggerLabel">Compartir</span>
    </button>

    <aside
      id="sharePanel"
      class="share-panel"
      aria-label="Compartir mi link de Whiskito"
      hidden
      data-attr="hidden:panelHidden"
    >
      <button id="shareClose" class="share-close" type="button" aria-label="Cerrar">×</button>

      <div class="share-card" id="shareCard">
        <p class="brand"><i data-lucide="glass-water"></i> WHISKITO</p>
        <h2 class="share-title" id="shareTitle">
          Invitame un <span class="gold">whiskito</span>
        </h2>

        <div class="qr-frame" id="qrFrame">
          <canvas id="qrCanvas" width="512" height="512" aria-label="Código QR de mi link de Whiskito"></canvas>

          <div class="qr-fallback" id="qrFallback" hidden>
            <span class="fallback-icon" aria-hidden="true"><i data-lucide="qr-code"></i></span>
            <span>No pudimos generar el QR. Tu link sigue funcionando: copialo y compartilo igual.</span>
            <span class="fallback-hint">Revisá tu conexión y volvé a intentar.</span>
          </div>

          <div class="qr-locked" id="shareLocked">
            <span class="locked-icon" aria-hidden="true"><i data-lucide="lock"></i></span>
            <span class="locked-text">Conectá tu wallet para activar tu QR</span>
          </div>
        </div>

        <p class="share-link" id="shareLink">
          <span class="link-prefix" data-text="linkPrefix">whiskito.app/u/</span><span
            class="link-address"
            data-text="linkAddress"
            >tu-wallet</span
          >
        </p>

        <p class="share-trust">
          <span><span class="check"><i data-lucide="check"></i></span> Directo a mi wallet</span>
          <span class="dot" aria-hidden="true">·</span>
          <span><span class="check"><i data-lucide="check"></i></span> 0% comisión</span>
          <span class="dot" aria-hidden="true">·</span>
          <span><span class="check"><i data-lucide="check"></i></span> 100% verificable</span>
        </p>

        <button
          id="shareConnectButton"
          class="share-connect"
          type="button"
          data-attr="hidden:connectHidden"
        >
          <i data-lucide="wallet"></i> Conectá tu wallet
        </button>
      </div>

      <div class="share-actions" id="shareActions">
        <div class="share-grid">
          <button
            id="shareWhatsappButton"
          class="share-btn"
          type="button"
          data-network="whatsapp"
          data-attr="disabled:shareDisabled"
        >
          <i data-lucide="message-circle"></i> WhatsApp
        </button>
        <button
          id="shareXButton"
          class="share-btn"
          type="button"
          data-network="x"
          data-attr="disabled:shareDisabled"
        >
          <i data-lucide="hash"></i> X
        </button>
        <button
          id="shareTelegramButton"
          class="share-btn"
          type="button"
          data-network="telegram"
          data-attr="disabled:shareDisabled"
        >
          <i data-lucide="send"></i> Telegram
        </button>
        <button
          id="shareFacebookButton"
          class="share-btn"
          type="button"
          data-network="facebook"
          data-attr="disabled:shareDisabled"
        >
          <i data-lucide="thumbs-up"></i> Facebook
        </button>
        </div>

        <div class="share-row">
          <button
            id="shareNativeButton"
            class="share-btn"
            type="button"
            data-network="native"
            data-attr="hidden:nativeHidden; disabled:shareDisabled"
          >
          <i data-lucide="upload"></i> Compartir
        </button>
        <button
          id="copyButton"
          class="share-btn"
          type="button"
          data-network="copy"
          data-attr="disabled:shareDisabled"
        >
          <i data-lucide="link"></i>
          <span class="copy-label">Copiar link</span>
        </button>
        <button
          id="downloadButton"
          class="share-btn"
          type="button"
          data-network="download"
          data-attr="disabled:shareDisabled"
        >
          <i data-lucide="download"></i> Descargar QR
        </button>
        </div>
      </div>
    </aside>
  `;

  #wired = false;

  /** Última URL con QR ya dibujado: evita redibujar y parpadear. */
  #lastQrUrl = "";
  /** URL del dibujo en curso (si cambia el atributo mientras importa). */
  #qrPendingUrl = "";
  /** Última URL que se intentó dibujar. */
  #qrAttemptUrl = "";
  /** true si el último intento de QR falló (CDN caído, canvas roto, …). */
  #qrFailed = false;

  /** Etiqueta actual del botón de copiar. */
  #copyLabel = COPY_LABEL;
  #copyTimer = 0;

  /** ¿El navegador puede compartir nativo? Se decide una vez. */
  #canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  /** keydown puede despacharse sobre el documento o sobre window; el handler
      es idempotente, así que escuchamos en los dos y limpiamos los dos. */
  #onKeydown = (event) => {
    if (event.key !== "Escape" || !this.open) return;
    this.open = false;
    this.root.querySelector("#shareTrigger")?.focus();
  };

  // --- API explícita: atributos ↔ propiedades -------------------------------
  // El atributo ES el estado: cada `set` escribe el atributo y eso dispara
  // attributeChangedCallback → update().

  get address() {
    return this.getAttribute("address") ?? "";
  }
  set address(v) {
    this.setAttribute("address", v);
  }

  get shareBase() {
    return this.getAttribute("share-base") ?? DEFAULT_SHARE_BASE;
  }
  set shareBase(v) {
    this.setAttribute("share-base", v);
  }

  /** Panel flotante abierto o cerrado: atributo booleano `open`. */
  get open() {
    return this.getAttribute("open") !== null;
  }
  set open(v) {
    if (v) this.setAttribute("open", "");
    else this.removeAttribute("open");
  }

  /** Link real que se comparte (vacío mientras no hay wallet). */
  get shareUrl() {
    return this.address ? `${this.shareBase}/u/${this.address}` : "";
  }

  /** Link como se muestra en pantalla, sin el protocolo. */
  get displayUrl() {
    return this.address
      ? `${this.shareBase.replace(/^https?:\/\//, "")}/u/${this.address}`
      : LOCKED_DISPLAY_URL;
  }

  get state() {
    const active = Boolean(this.address);
    // El link se pinta en dos tonos: prefijo + dirección, derivados del mismo
    // displayUrl (así lo testea el script de funciones puras).
    const shown = this.displayUrl;
    const cut = shown.lastIndexOf("/u/");
    const linkPrefix = cut >= 0 ? shown.slice(0, cut + 3) : shown;
    const linkAddress = cut >= 0 ? shown.slice(cut + 3) : "";

    return {
      isLocked: !active,
      linkPrefix,
      linkAddress,
      connectHidden: active,
      shareDisabled: !active,
      nativeHidden: !this.#canNativeShare,
      // El trigger es la puerta de entrada: siempre visible, y avisa si falta
      // conectar. `expanded` va como string porque "" borraría el atributo.
      triggerLabel: "Compartir",
      expanded: this.open ? "true" : "false",
      panelHidden: !this.open,
    };
  }

  render(_state) {
    this.#syncCopyButton();
    this.#syncQr();
    this.#ensureQr();
  }

  connectedCallback() {
    super.connectedCallback();

    // Escape cierra el panel. Se registra en cada conexión y se limpia al
    // desconectar; addEventListener con la misma referencia no se duplica.
    document.addEventListener("keydown", this.#onKeydown);
    window.addEventListener("keydown", this.#onKeydown);

    if (this.#wired) return;
    this.#wired = true;

    this.root.querySelector("#shareTrigger")?.addEventListener("click", () => {
      this.open = !this.open;
    });

    this.root.querySelector("#shareClose")?.addEventListener("click", () => {
      this.open = false;
    });

    this.root.querySelector("#shareConnectButton")?.addEventListener("click", () => {
      this.emit("whiskito:connect-request");
    });

    // Delegación: un solo listener para los siete botones.
    this.root.querySelector("#shareActions")?.addEventListener("click", (event) => {
      const button = event.target?.closest?.("[data-network]");
      if (!button || button.disabled) return;
      this.#handleShare(button.dataset.network);
    });
  }

  disconnectedCallback() {
    clearTimeout(this.#copyTimer);
    document.removeEventListener("keydown", this.#onKeydown);
    window.removeEventListener("keydown", this.#onKeydown);
  }

  // --- Visibilidad del QR ---------------------------------------------------
  // La maneja render()/ensureQr() y no los marcadores `data-attr`, para que el
  // resultado del import dinámico se refleje sin volver a disparar update().

  #syncQr() {
    const active = Boolean(this.address);
    const url = this.shareUrl;
    const drawn = active && !this.#qrFailed && url !== "" && this.#lastQrUrl === url;

    const frame = this.root.querySelector("#qrFrame");
    const canvas = this.root.querySelector("#qrCanvas");
    const fallback = this.root.querySelector("#qrFallback");
    const locked = this.root.querySelector("#shareLocked");

    if (frame) frame.classList.toggle("is-locked", !active);
    if (locked) locked.hidden = active;
    if (canvas) canvas.hidden = !drawn;
    if (fallback) fallback.hidden = !(active && this.#qrFailed);
  }

  /** Genera el QR una sola vez por URL. Bloqueado no importa la librería. */
  async #ensureQr() {
    const url = this.shareUrl;

    if (!url) {
      this.#lastQrUrl = "";
      this.#qrAttemptUrl = "";
      this.#qrFailed = false;
      return;
    }
    // Ya está dibujado, o ya falló con esta misma URL: no se reintenta en bucle.
    if (url === this.#lastQrUrl || url === this.#qrPendingUrl) return;
    if (this.#qrFailed && url === this.#qrAttemptUrl) return;

    const canvas = this.root.querySelector("#qrCanvas");
    if (!canvas) return;

    this.#qrPendingUrl = url;
    this.#qrAttemptUrl = url;
    try {
      // Import dinámico a propósito: si el CDN no responde, la isla igual se
      // dibuja y mostramos el fallback (link y compartir siguen andando).
      const mod = await import("https://esm.sh/qrcode@1.5.4");
      const QRCode = mod.default ?? mod;
      await QRCode.toCanvas(canvas, this.shareUrl, {
        width: 512,
        margin: 3,
        errorCorrectionLevel: "M",
      });
      // La librería ensucia el canvas con estilos inline (width/height en px) y
      // el inline le gana al `height: auto` de la hoja: sin limpiarlos el QR
      // queda estirado en vertical. Los saco para que mande el CSS.
      canvas.style.removeProperty("height");
      canvas.style.removeProperty("width");
      this.#lastQrUrl = url;
      this.#qrFailed = false;
    } catch {
      this.#lastQrUrl = "";
      this.#qrFailed = true;
    } finally {
      this.#qrPendingUrl = "";
      this.#syncQr();
    }
  }

  // --- Acciones de compartir ------------------------------------------------

  async #handleShare(network) {
    const url = this.shareUrl;
    if (!url) return;

    this.emit("whiskito:share", { network, url });

    switch (network) {
      case "native": {
        if (!this.#canNativeShare) return;
        try {
          await navigator.share({ title: SHARE_TITLE, text: SHARE_TEXT, url });
        } catch {
          // El usuario canceló el diálogo del sistema: no es un error nuestro.
        }
        return;
      }
      case "whatsapp":
      case "x":
      case "telegram":
      case "facebook": {
        const target = shareTarget(network, url, SHARE_TEXT);
        if (target) window.open(target, "_blank", "noopener");
        return;
      }
      case "copy":
        await this.#copyLink(url);
        return;
      case "download":
        this.#downloadQr();
        return;
      default:
        return;
    }
  }

  #syncCopyButton() {
    const button = this.root.querySelector("#copyButton");
    if (!button) return;
    const copied = this.#copyLabel === COPIED_LABEL;
    // El texto va a un <span> propio y NO al botón: el botón también contiene el
    // icono de Lucide, y `textContent` se lleva todos los hijos — con el icono
    // adentro. `update()` corre justo después de hidratar, así que escribirlo en
    // el botón lo borraba al montar (y después de cada "copiado").
    const label = button.querySelector(".copy-label") ?? button;
    label.textContent = this.#copyLabel;
    button.classList.toggle("is-copied", copied);
  }

  async #copyLink(url) {
    let copied = false;
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
    } catch {
      copied = this.#legacyCopy(url);
    }
    if (!copied) return;

    this.#copyLabel = COPIED_LABEL;
    this.#syncCopyButton();
    clearTimeout(this.#copyTimer);
    this.#copyTimer = setTimeout(() => {
      this.#copyLabel = COPY_LABEL;
      this.#syncCopyButton();
    }, COPY_FEEDBACK_MS);
  }

  /** Sin Clipboard API (o rechazada): textarea temporal + execCommand. */
  #legacyCopy(url) {
    try {
      const area = document.createElement("textarea");
      area.value = url;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.top = "-1000px";
      area.style.opacity = "0";
      document.body.append(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }

  #downloadQr() {
    const canvas = this.root.querySelector("#qrCanvas");
    if (!canvas || canvas.hidden) return;

    let href = "";
    try {
      href = canvas.toDataURL("image/png");
    } catch {
      return;
    }
    if (!href) return;

    const link = document.createElement("a");
    link.download = "whiskito-qr.png";
    link.href = href;
    link.rel = "noopener";
    document.body.append(link);
    link.click();
    link.remove();
  }
}
