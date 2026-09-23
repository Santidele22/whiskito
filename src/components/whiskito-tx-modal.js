import { WhiskitoElement } from "./base-element.js";

/**
 * Isla del veredicto: el modal que avisa si la transacción se ACEPTÓ o se
 * CANCELÓ. Es sólo la isla: la lógica de cuándo abrirlo y con qué veredicto la
 * escribe el flujo (hoy la página de donación), no este archivo.
 *
 * API por propiedades (declaradas en `observedAttributes`):
 *   open      booleano — el modal se ve o no existe para el usuario.
 *   kind      "success" (default) | "error" — icono, color del sello y rótulo.
 *   title     el título grande; sin él hay uno por defecto según `kind`.
 *   message   la explicación (el motivo de la cancelación, por ejemplo).
 *   hash      hash de la transacción: se muestra acortado al medio y el texto
 *             completo va en el `title` del elemento (para copiarlo o verlo).
 *   explorer  base del explorador (p. ej. https://sepolia.etherscan.io): con
 *             `hash` habilita el link a `${explorer}/tx/${hash}`.
 *
 * Al cerrarse —por el botón `#closeButton`, por Escape o por click en el fondo—
 * emite `whiskito:tx-modal-close` con `emit` (bubbles + composed).
 *
 * Es una isla con shadow root: el reset global y los `@keyframes` no cruzan la
 * frontera, así que cada uno va declarado acá adentro.
 */

/** Rótulos por defecto cuando el flujo no manda un título. */
const DEFAULT_TITLE = {
  success: "Transacción aceptada",
  error: "Transacción cancelada",
};

/** Etiqueta del link al explorador. */
const EXPLORER_LABEL = "Ver en el explorador";

/** Milisegundos antes de mover el foco (el modal tiene que estar visible ya). */
const FOCUS_DELAY_MS = 30;

/**
 * Acorta un hash por el medio: `0x1234…abcd`. Los cortos se devuelven enteros.
 * Función pura: se puede probar sin navegador.
 *
 * @param {string} hash
 * @param {number} [head]  caracteres de la cabeza
 * @param {number} [tail]  caracteres de la cola
 * @returns {string}
 */
export function shortHash(hash, head = 10, tail = 8) {
  const value = String(hash ?? "");
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export class WhiskitoTxModal extends WhiskitoElement {
  static observedAttributes = [
    "open",
    "kind",
    "title",
    "message",
    "hash",
    "explorer",
  ];

  static styles = /* css */ `
    /* El reset universal de styles.css no cruza la frontera del shadow root:
       se copia acá para que margin, padding y box-sizing no vuelvan al UA. */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    /* La isla no genera caja propia: el overlay que pinta es flotante, igual
       que el resto de las islas del sistema (styles.css les da display:contents).
       Declararlo acá también deja la isla parada sola en cualquier página. */
    :host {
      display: contents;
    }

    /* Nuestro CSS no puede ganarle al display:none que trae [hidden] (tampoco
       al de las reglas de display de abajo): cerrado, el modal no existe. */
    [hidden] {
      display: none !important;
    }

    /* Los marcadores de icono se vuelven SVG con la clase .icon. La hoja global
       no cruza la frontera del shadow root, por eso la regla va acá. */
    .icon {
      width: 1em;
      height: 1em;
      flex: none;
      vertical-align: -0.15em;
    }

    /* ---------- Fondo ---------- */
    /* Tapa la pantalla. Sin filtros ni backdrop-filter: crearía containing
       block y el fixed de los hijos dejaría de ser de la ventana. */
    .tx-overlay {
      position: fixed;
      inset: 0;
      z-index: 3000; /* por encima de la textura de papel (z-index 2000) */
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: rgba(28, 21, 18, 0.62);
      overflow-y: auto;
    }

    /* Sólo opacidad: un transform movería cajas mientras corre la animación. */
    .tx-overlay:not([hidden]) {
      animation: tx-overlay-in 0.16s ease-out;
    }

    @keyframes tx-overlay-in {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    /* ---------- Diálogo ---------- */
    .tx-dialog {
      position: relative;
      width: min(460px, 100%);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
      padding: 34px 30px 28px;
      background-color: var(--paper);
      /* Textura de papel: los mismos puntos de impresión de styles.css. */
      background-image: radial-gradient(
        rgba(28, 21, 18, 0.045) 1px,
        transparent 1.5px
      );
      background-size: 5px 5px;
      border: 3px solid var(--ink);
      border-radius: 6px;
      box-shadow: 9px 9px 0 var(--ink);
      text-align: center;
      color: var(--ink);
    }

    .tx-dialog:focus {
      outline: none;
    }

    .tx-overlay:not([hidden]) .tx-dialog {
      animation: tx-dialog-in 0.18s ease-out;
    }

    @keyframes tx-dialog-in {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    /* ---------- Sello: el icono en su recuadro ---------- */
    .tx-stamp {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 68px;
      height: 68px;
      font-size: 2.1rem;
      border: 3px solid var(--ink);
      border-radius: 50%;
      box-shadow: 4px 4px 0 var(--ink);
    }

    /* Verde de confirmado / rojo cartel de cancelado: el color del sello es la
       señal más rápida de si la transacción se aceptó o no. */
    .tx-stamp.is-success {
      background: var(--paper);
      color: var(--success);
    }

    .tx-stamp.is-error {
      background: var(--paper);
      color: var(--blues-red);
    }

    /* ---------- Texto ---------- */
    .tx-title {
      font-family: var(--display);
      font-size: 1.55rem;
      font-weight: 700;
      line-height: 1.15;
      text-transform: uppercase;
      color: var(--ink);
    }

    .tx-message {
      font-family: var(--cond);
      font-weight: 600;
      font-size: 1.05rem;
      line-height: 1.5;
      color: var(--stamp);
      max-width: 40ch;
      overflow-wrap: break-word;
    }

    /* ---------- Hash: en mono y acortado; el completo va en el title ---------- */
    .tx-hash {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      justify-content: center;
      gap: 4px 8px;
      width: 100%;
      padding-top: 12px;
      border-top: 3px double var(--ink);
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 0.82rem;
      color: var(--ink);
    }

    .tx-hash .tx-hash-label {
      color: var(--stamp);
      letter-spacing: 1px;
      text-transform: uppercase;
      font-family: var(--cond);
      font-size: 0.78rem;
      font-weight: 700;
    }

    .tx-hash .tx-hash-value {
      color: var(--cobalt);
      cursor: help;
    }

    /* ---------- Botones ---------- */
    /* Mismo lenguaje que los .btn del sistema (copia de styles.css). */
    .btn {
      border: 3px solid var(--ink);
      border-radius: 6px;
      padding: 12px 24px;
      font-family: var(--cond);
      font-weight: 700;
      font-size: 1rem;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      text-decoration: none;
      box-shadow: 5px 5px 0 var(--ink);
      transition: transform 0.15s, box-shadow 0.15s;
    }

    .btn:hover {
      transform: translate(-2px, -2px);
      box-shadow: 8px 8px 0 var(--ink);
    }

    .btn:active {
      transform: translate(2px, 2px);
      box-shadow: 1px 1px 0 var(--ink);
    }

    .btn-explorer {
      background: var(--cobalt);
      color: var(--paper);
    }

    /* Cerrar no es la acción principal del modal: papel y tinta. */
    .btn-close {
      width: 100%;
      margin-top: 4px;
      background: var(--paper);
      color: var(--ink);
    }

    @media (max-width: 768px) {
      .tx-dialog {
        padding: 28px 20px 24px;
      }
    }
  `;

  static template = /* html */ `
    <div class="tx-overlay" id="overlay" role="presentation" data-attr="hidden:overlayHidden">
      <div
        class="tx-dialog"
        id="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="txTitle"
        data-attr="aria-labelledby:titleId"
      >
        <span class="tx-stamp" data-class="is-success:isSuccess; is-error:isError">
          <i data-lucide="circle-check" data-attr="hidden:successIconHidden" aria-hidden="true"></i>
          <i data-lucide="triangle-alert" data-attr="hidden:errorIconHidden" aria-hidden="true"></i>
        </span>

        <h2 class="tx-title" id="txTitle" data-text="title"></h2>
        <p class="tx-message" id="txMessage" data-text="message"></p>

        <p class="tx-hash" id="txHashRow" data-attr="hidden:hashHidden">
          <span class="tx-hash-label">Hash</span>
          <span
            class="tx-hash-value"
            id="txHash"
            data-text="shortHash"
            data-attr="title:hash"
          ></span>
        </p>

        <a
          class="btn btn-explorer"
          id="explorerLink"
          href="#"
          target="_blank"
          rel="noopener"
          hidden
          data-attr="hidden:explorerHidden; href:explorerHref"
        >
          ${EXPLORER_LABEL}
        </a>

        <button
          id="closeButton"
          class="btn btn-close"
          type="button"
          aria-label="Cerrar el aviso"
        >
          Cerrar
        </button>
      </div>
    </div>
  `;

  #wired = false;
  /** Quién tenía el foco antes de abrir, para devolvérselo al cerrar. */
  #previousFocus = null;
  /** Valor de `body.style.overflow` antes de bloquear el scroll. */
  #previousOverflow = "";
  /** Timer del foco diferido (el modal tiene que estar visible para enfocar). */
  #focusTimer = 0;

  // --- API explícita: propiedades ↔ atributos -------------------------------
  // El atributo ES el estado: cada `set` escribe el atributo y eso dispara
  // attributeChangedCallback → update(). No hay estado paralelo en JS.

  /** Abierto o cerrado: atributo booleano `open`, igual que el de la share-card. */
  get open() {
    return this.getAttribute("open") !== null;
  }
  set open(v) {
    if (v) this.setAttribute("open", "");
    else this.removeAttribute("open");
  }

  /** "success" o "error"; cualquier otra cosa se trata como éxito. */
  get kind() {
    return this.getAttribute("kind") === "error" ? "error" : "success";
  }
  set kind(v) {
    this.setAttribute("kind", String(v ?? ""));
  }

  get title() {
    return this.getAttribute("title") ?? "";
  }
  set title(v) {
    this.setAttribute("title", String(v ?? ""));
  }

  get message() {
    return this.getAttribute("message") ?? "";
  }
  set message(v) {
    this.setAttribute("message", String(v ?? ""));
  }

  /** Hash de la transacción, tal cual (acá no se acorta: eso es de la vista). */
  get hash() {
    return this.getAttribute("hash") ?? "";
  }
  set hash(v) {
    this.setAttribute("hash", String(v ?? ""));
  }

  /** Base del explorador; sin él no hay link, aunque haya hash. */
  get explorer() {
    return this.getAttribute("explorer") ?? "";
  }
  set explorer(v) {
    this.setAttribute("explorer", String(v ?? ""));
  }

  get state() {
    const isError = this.kind === "error";
    const explorer = this.explorer;
    const hash = this.hash;

    return {
      isError,
      isSuccess: !isError,
      // Cada bandera esconde SU icono: con veredicto de error se esconde el de
      // éxito y al revés. Estaban cruzadas con los iconos del template (y
      // `errorIconHidden` fijo en `false`): el icono de error no se veía nunca y
      // en el éxito se veían los dos.
      errorIconHidden: !isError,
      successIconHidden: isError,
      // Sin título propio hay uno por defecto según el veredicto.
      title: this.title !== "" ? this.title : DEFAULT_TITLE[this.kind],
      message: this.message,
      hash,
      shortHash: shortHash(hash),
      hashHidden: hash === "",
      titleId: "txTitle",
      // El link sólo existe con las dos cosas: base del explorador Y hash.
      explorerHref: hash !== "" ? `${explorer}/tx/${hash}` : "",
      explorerHidden: !(explorer !== "" && hash !== ""),
      overlayHidden: !this.open,
    };
  }

  render(state) {
    // El foco y el bloqueo del scroll siguen al atributo `open`, no al pintado:
    // van acá (y no en un marcador) porque son efectos sobre el documento.
    if (this.open) this.#enter(state);
    else this.#leave();
  }

  connectedCallback() {
    super.connectedCallback();
    if (this.#wired) return;
    this.#wired = true;

    // Escape cierra. Se escucha en el documento: el modal puede tener el foco
    // adentro o no, así que la tecla tiene que llegar igual.
    document.addEventListener("keydown", this.#onKeydown);

    this.root.querySelector("#closeButton")?.addEventListener("click", () => {
      this.close();
    });

    // Click en el fondo (el overlay), no en el diálogo: si el click nació
    // adentro de la tarjeta, el modal se queda abierto.
    this.root.querySelector("#overlay")?.addEventListener("click", (event) => {
      const dialog = this.root.querySelector("#dialog");
      if (dialog && (event.target === dialog || dialog.contains(event.target))) {
        return;
      }
      this.close();
    });

    // Si la isla arrancó con `open` puesto, el estado del documento ya toca.
    this.render(this.state);
  }

  disconnectedCallback() {
    document.removeEventListener("keydown", this.#onKeydown);
    clearTimeout(this.#focusTimer);
    // Cerrada por desmontaje: no se puede dejar el body sin scroll para siempre.
    this.#leave();
  }

  /** Cierra el modal y avisa hacia afuera. Es lo que usan las tres vías. */
  close() {
    if (!this.open) return;
    this.open = false;
    this.emit("whiskito:tx-modal-close", {
      kind: this.kind,
      hash: this.hash,
    });
  }

  #onKeydown = (event) => {
    if (event.key !== "Escape" || !this.open) return;
    this.close();
  };

  /** Al abrir: foco al botón de cerrar y el body deja de scrollear. */
  #enter() {
    if (this.#previousFocus === null) {
      this.#previousFocus =
        (this.getRootNode?.()?.activeElement ?? document.activeElement) ?? null;
      // El scroll se guarda una sola vez: abrir dos veces no pierde el valor
      // original del body.
      this.#previousOverflow = document.body.style.overflow;
    }
    document.body.style.overflow = "hidden";

    clearTimeout(this.#focusTimer);
    this.#focusTimer = setTimeout(() => {
      if (this.open) this.root.querySelector("#closeButton")?.focus();
    }, FOCUS_DELAY_MS);
  }

  /** Al cerrar: se devuelve el foco y se restaura el scroll del body. */
  #leave() {
    clearTimeout(this.#focusTimer);
    if (this.#previousFocus === null) return;

    const target = this.#previousFocus;
    this.#previousFocus = null;
    document.body.style.overflow = this.#previousOverflow;
    this.#previousOverflow = "";

    // El elemento que tenía el foco puede haberse ido del DOM mientras tanto.
    if (target.isConnected) target.focus?.();
  }
}
