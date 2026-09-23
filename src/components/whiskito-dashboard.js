import { WhiskitoElement } from "./base-element.js";

/**
 * Isla "Mi Panel": el modal con el LIBRO DE BARRA completo — todas las
 * donaciones que recibió una dirección, en una tabla—.
 *
 * Es sólo la isla: quién lo abre y de dónde salen las filas lo decide el flujo
 * (hoy `app.js` a través de `islands.js`), no este archivo.
 *
 * API por propiedades, con el mismo estilo que `whiskito-panel.js` (el atributo
 * ES el estado):
 *   open     booleano — atributo booleano `open`: el modal se ve o no.
 *   address  dirección de la que son las donaciones (se muestra acortada).
 *   message  texto de aviso para el resumen; vacío = resumen calculado.
 *   donations  array de `{ donorShort, amountEth, usd, when }`. No es atributo:
 *              se guarda en un campo privado y el `set` repinta.
 *
 * Al cerrarse —por `#closeButton`, por Escape o por click en el fondo— pone
 * `open = false` y emite `whiskito:dashboard-close` (bubbles + composed).
 *
 * Es una isla con shadow root: el reset global y los `@keyframes` no cruzan la
 * frontera, así que cada uno va declarado acá adentro.
 */

/** Milisegundos antes de mover el foco (el modal tiene que estar visible ya). */
const FOCUS_DELAY_MS = 30;

/**
 * Texto por defecto de la retirada, según su estado. Son los MISMOS textos del
 * panel (`whiskito-panel.js`): el veredicto tiene que leerse igual en las dos
 * islas.
 */
const WITHDRAW_LABELS = {
  pending: "Retirando…",
  success: "¡Retirado!",
  error: "No se pudo retirar",
  idle: "",
};

/** Máximo de decimales con los que se muestra un monto en ETH. */
const ETH_DECIMALS = 4;

/** Redondea al número de decimales pedido sin los arrastres del binario. */
function roundTo(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Formatea un monto en ETH: hasta 4 decimales, sin ceros de cola. */
export function formatEth(value) {
  return String(roundTo(Number(value) || 0, ETH_DECIMALS));
}

/** Formatea un monto en USD: siempre 2 decimales (`269.4` → `269.40`). */
export function formatUsd(value) {
  return (Number(value) || 0).toFixed(2);
}

/**
 * Resumen calculado con las filas: `12 rondas · 0.0842 POL · ≈ $269.44 USD`.
 * Sin filas devuelve `""` (no hay nada que resumir). Función pura.
 *
 * @param {Array<{amountEth: string|number, usd: string|number}>} donations
 * @returns {string}
 */
export function buildSummary(donations) {
  if (donations.length === 0) return "";
  const totalEth = donations.reduce(
    (total, row) => total + (Number(row.amountEth) || 0),
    0
  );
  const totalUsd = donations.reduce(
    (total, row) => total + (Number(row.usd) || 0),
    0
  );
  const rondas = donations.length === 1 ? "1 ronda" : `${donations.length} rondas`;
  return `${rondas} · ${formatEth(totalEth)} POL · ≈ $${formatUsd(totalUsd)} USD`;
}

export class WhiskitoDashboard extends WhiskitoElement {
  static observedAttributes = [
    "open",
    "address",
    "message",
    "balance-eth",
    "balance-usd",
    "can-withdraw",
    "withdraw-status",
    "withdraw-message",
  ];

  static styles = /* css */ `
    /* El reset universal de styles.css no cruza la frontera del shadow root:
       se copia acá (y sigue en el global) para que margin, padding y box-sizing
       queden iguales al resto del sistema. */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    /* La isla no genera caja propia: lo que pinta es flotante, igual que el
       modal de la transacción. Declararlo acá también la deja parada sola en
       cualquier página. */
    :host {
      display: contents;
    }

    /* Nuestro CSS no puede ganarle al display:none que trae [hidden] (ni al
       display propio del overlay y de la tabla): cerrado, el modal no existe. */
    [hidden] {
      display: none !important;
    }

    /* Iconos de Lucide: la hoja global no cruza la frontera del shadow root,
       así que la regla de 1em (que dibuja con currentColor) vive también acá. */
    .icon {
      width: 1em;
      height: 1em;
      flex: none;
      vertical-align: -0.15em;
    }

    /* ---------- Fondo ---------- */
    /* Tapa la pantalla. Sin filtros ni backdrop-filter: crearían containing
       block y el fixed de los hijos dejaría de ser de la ventana. */
    .dash-overlay {
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
    .dash-overlay:not([hidden]) {
      animation: dash-overlay-in 0.16s ease-out;
    }

    @keyframes dash-overlay-in {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    /* ---------- El diálogo: el mismo recibo de barra del panel ---------- */
    .dash-dialog {
      position: relative;
      width: min(660px, 100%);
      max-height: calc(100vh - 48px);
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 30px 30px 24px;
      background: var(--paper);
      color: var(--ink);
      border: 3px solid var(--ink);
      border-radius: 6px;
      /* Sombra dura, como el recibo del panel. */
      box-shadow: 9px 9px 0 var(--ink);
    }

    .dash-dialog:focus {
      outline: none;
    }

    .dash-overlay:not([hidden]) .dash-dialog {
      animation: dash-dialog-in 0.18s ease-out;
    }

    @keyframes dash-dialog-in {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    /* ---------- Cabecera tipo recibo ---------- */
    .dash-head {
      display: flex;
      align-items: center;
      gap: 12px;
      padding-bottom: 14px;
      border-bottom: 2px dashed var(--ink);
    }

    .dash-head-icon {
      font-size: 1.6rem;
      color: var(--cobalt);
    }

    .dash-head-titles {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .dash-title {
      font-family: var(--display);
      font-size: 1.6rem;
      font-weight: 700;
      line-height: 1;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: var(--ink);
    }

    .dash-address {
      font-family: 'Courier New', monospace;
      font-size: 0.82rem;
      font-weight: 700;
      color: var(--cobalt);
      word-break: break-all;
    }

    /* El botón de cerrar: arriba a la derecha, como el de un recibo. */
    .dash-close {
      margin-left: auto;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      font-family: var(--cond);
      font-weight: 700;
      font-size: 0.95rem;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: var(--ink);
      background: transparent;
      border: 2px solid var(--ink);
      border-radius: 4px;
      cursor: pointer;
      transition: color 0.15s, background 0.15s;
    }

    .dash-close:hover {
      color: var(--paper);
      background: var(--blues-red);
    }

    /* ---------- Subtítulo y resumen ---------- */
    .dash-sub {
      font-family: var(--cond);
      font-weight: 600;
      font-size: 1.05rem;
      color: var(--stamp);
    }

    .dash-summary {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      font-family: 'Courier New', monospace;
      font-size: 0.95rem;
      font-weight: 700;
      color: var(--ink);
    }

    /* Aviso de que la lectura de la chain falló: la tabla vacía no significa
       "no recibiste nada". Sólo cambia el color, no el tamaño ni el peso: se
       lee como un aviso, no como un título. */
    .dash-summary.is-error {
      color: var(--blues-red);
    }

    /* ---------- La tabla del libro de barra ---------- */
    .dash-scroll {
      overflow-y: auto;
      border-top: 2px dashed var(--ink);
    }

    table.dash-table {
      width: 100%;
      border-collapse: collapse;
      font-family: 'Courier New', monospace;
      font-size: 0.9rem;
    }

    /* Encabezados en versalitas condensadas. */
    .dash-table th {
      position: sticky;
      top: 0;
      padding: 10px 8px;
      text-align: left;
      font-family: var(--cond);
      font-weight: 700;
      font-size: 0.78rem;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--stamp);
      background: var(--paper);
      border-bottom: 2px solid var(--ink);
    }

    .dash-table th.dash-num,
    .dash-table td.dash-num {
      text-align: right;
    }

    /* Filas con separador punteado, como el historial del recibo. */
    .dash-table td {
      padding: 11px 8px;
      border-bottom: 1px dotted rgba(28, 21, 18, 0.3);
      vertical-align: baseline;
    }

    .dash-when {
      font-size: 0.8rem;
      color: var(--stamp);
    }

    .dash-table code {
      font-family: 'Courier New', monospace;
      font-size: 0.85rem;
      color: var(--ink);
    }

    .dash-amt {
      font-weight: 700;
      color: var(--success);
    }

    .dash-usd {
      font-weight: 400;
      color: var(--stamp);
    }

    /* El título de la tabla se anuncia pero no se ve: la tabla ya tiene sus
       encabezados. */
    .dash-visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }

    /* Barra sin whiskitos todavía. */
    .dash-empty {
      display: block;
      padding: 22px 8px;
      text-align: center;
      font-family: var(--cond);
      font-weight: 600;
      font-size: 1.05rem;
      color: var(--stamp);
      font-style: italic;
    }

    /* ---------- Retiro: balance disponible y acciones ---------- */
    .dash-withdraw {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-top: 12px;
      border-top: 2px dashed var(--ink);
    }

    .dash-balance-label {
      font-family: 'Courier New', monospace;
      font-size: 0.76rem;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--stamp);
    }

    .dash-balance {
      display: flex;
      align-items: baseline;
      gap: 8px;
      font-family: 'Courier New', monospace;
      font-size: 1.7rem;
      font-weight: 700;
      line-height: 1;
      color: var(--ink);
    }

    .dash-balance-unit {
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--blues-red);
    }

    .dash-balance-usd {
      font-family: 'Courier New', monospace;
      font-size: 0.85rem;
      color: var(--stamp);
    }

    .dash-withdraw-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    /* Botón de tinta con sombra dura, como el .btn del panel. Los [hidden] los
       cubre la regla de arriba (display: none !important). */
    .dash-btn {
      flex: 1 1 auto;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 18px;
      font-family: var(--cond);
      font-weight: 700;
      font-size: 0.98rem;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: var(--ink);
      background: transparent;
      border: 2px solid var(--ink);
      border-radius: 4px;
      cursor: pointer;
      box-shadow: 4px 4px 0 var(--ink);
      transition: transform 0.15s, box-shadow 0.15s;
    }

    .dash-btn:hover {
      transform: translate(-2px, -2px);
      box-shadow: 6px 6px 0 var(--ink);
    }

    .dash-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
      box-shadow: 4px 4px 0 var(--ink);
    }

    .dash-btn-primary {
      background: var(--blues-red);
      color: var(--paper);
    }

    /* La fila inline del retiro parcial. */
    .dash-withdraw-part {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px;
      background: rgba(28, 21, 18, 0.05);
      border: 2px dashed var(--ink);
      border-radius: 4px;
    }

    .dash-withdraw-label {
      font-family: var(--cond);
      font-weight: 700;
      font-size: 0.8rem;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: var(--stamp);
    }

    .dash-withdraw-input {
      width: 100%;
      padding: 9px 12px;
      font-family: 'Courier New', monospace;
      font-size: 1rem;
      font-weight: 700;
      color: var(--ink);
      background: var(--paper);
      border: 2px solid var(--ink);
      border-radius: 4px;
    }

    .dash-withdraw-input:focus {
      outline: 2px solid var(--cobalt);
      outline-offset: 1px;
    }

    .dash-withdraw-error {
      font-family: var(--cond);
      font-size: 0.9rem;
      color: var(--blues-red);
    }

    /* El veredicto de la retirada: mismos textos y colores que el panel. */
    .dash-status {
      font-family: var(--cond);
      text-align: center;
    }

    .dash-status.is-error {
      color: var(--blues-red);
    }

    .dash-status.is-success {
      color: var(--success);
    }

    /* ---------- Pie ---------- */
    .dash-foot {
      padding-top: 12px;
      border-top: 2px dashed var(--ink);
      text-align: center;
      font-family: var(--cond);
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: var(--stamp);
    }

    @media (max-width: 768px) {
      .dash-dialog {
        padding: 24px 18px 18px;
      }

      .dash-head {
        flex-wrap: wrap;
      }

      .dash-title {
        font-size: 1.35rem;
      }

      .dash-table th,
      .dash-table td {
        padding: 9px 4px;
      }
    }
  `;

  static template = /* html */ `
    <div
      class="dash-overlay"
      id="overlay"
      role="presentation"
      data-attr="hidden:overlayHidden"
    >
      <div
        class="dash-dialog"
        id="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dashTitle"
      >
        <header class="dash-head">
          <span class="dash-head-icon"
            ><i data-lucide="receipt" aria-hidden="true"></i
          ></span>
          <div class="dash-head-titles">
            <h2 class="dash-title" id="dashTitle">Mi Panel</h2>
            <code class="dash-address" id="dashAddress" data-text="addressShort"></code>
          </div>
          <button
            id="closeButton"
            class="dash-close"
            type="button"
            aria-label="Cerrar Mi Panel"
            title="Cerrar el panel"
          >
            <i data-lucide="x" aria-hidden="true"></i>
          </button>
        </header>

        <p class="dash-sub">Todas las donaciones que recibiste</p>

        <p
          class="dash-summary"
          id="dashSummary"
          data-text="summaryText"
          data-class="is-error:messageIsError"
        ></p>

        <div class="dash-scroll">
          <table
            class="dash-table"
            id="dashboardTable"
            data-attr="hidden:notHasDonations"
          >
            <caption class="dash-visually-hidden">Donaciones recibidas</caption>
            <thead>
              <tr>
                <th scope="col">Cuándo</th>
                <th scope="col">Quién</th>
                <th scope="col" class="dash-num">POL</th>
                <th scope="col" class="dash-num">USD</th>
              </tr>
            </thead>
            <tbody id="donationsBody"></tbody>
          </table>

          <p class="dash-empty" data-attr="hidden:hasDonations">
            Todavía no recibiste ningún whiskito
          </p>
        </div>

        <div class="dash-withdraw">
          <p class="dash-balance-label">Balance disponible</p>
          <p class="dash-balance">
            <span id="dashBalance" data-text="balanceEth"></span>
            <span class="dash-balance-unit">POL</span>
          </p>
          <p class="dash-balance-usd" data-text="balanceUsdText"></p>

          <div class="dash-withdraw-actions">
            <button
              id="withdrawButton"
              class="dash-btn dash-btn-primary"
              type="button"
              data-attr="hidden:withdrawButtonsHidden; disabled:cannotWithdraw"
            >
              Retirar todo
            </button>

            <button
              id="withdrawPartButton"
              class="dash-btn"
              type="button"
              data-attr="hidden:withdrawPartButtonHidden; disabled:cannotWithdraw"
            >
              Retirar una parte
            </button>
          </div>

          <div
            class="dash-withdraw-part"
            id="withdrawPart"
            data-attr="hidden:withdrawPartHidden"
          >
            <label class="dash-withdraw-label" for="withdrawAmount"
              >Monto a retirar (POL)</label
            >
            <input
              id="withdrawAmount"
              class="dash-withdraw-input"
              type="number"
              step="any"
              min="0"
              inputmode="decimal"
              placeholder=""
              aria-describedby="withdrawPartError"
            />
            <p
              class="dash-withdraw-error"
              id="withdrawPartError"
              data-text="withdrawPartErrorText"
              data-attr="hidden:withdrawPartErrorHidden"
            ></p>
            <div class="dash-withdraw-actions">
              <button
                id="withdrawConfirmButton"
                class="dash-btn dash-btn-primary"
                type="button"
                data-attr="disabled:withdrawConfirmDisabled"
              >
                Confirmar retiro
              </button>
              <button id="withdrawCancelButton" class="dash-btn" type="button">
                Cancelar
              </button>
            </div>
          </div>

          <p
            class="dash-status"
            id="withdrawStatus"
            data-text="withdrawText"
            data-attr="hidden:withdrawStatusHidden"
            data-class="is-error:isWithdrawError; is-success:isWithdrawSuccess"
          ></p>
        </div>

        <p class="dash-foot">whiskito · libro de barra</p>

        <template data-row>
          <tr>
            <td class="dash-when" data-field="when"></td>
            <td class="dash-donor"><code data-field="donorShort"></code></td>
            <td class="dash-amt dash-num" data-field="amountEth"></td>
            <td class="dash-usd dash-num" data-field="usd"></td>
          </tr>
        </template>
      </div>
    </div>
  `;

  #donations = [];
  #wired = false;
  /** La fila de retiro parcial está desplegada. */
  #partOpen = false;
  /** Lo escrito en el input, en ETH como texto (vacío = todavía nada). */
  #amountText = "";
  /** Quién tenía el foco antes de abrir, para devolvérselo al cerrar. */
  #previousFocus = null;
  /** Valor de `body.style.overflow` antes de bloquear el scroll. */
  #previousOverflow = "";
  /** Timer del foco diferido (el modal tiene que estar visible para enfocar). */
  #focusTimer = 0;

  // --- API explícita: propiedades y atributos --------------------------------
  // El atributo ES el estado: cada `set` escribe el atributo y eso dispara
  // attributeChangedCallback → update(). No hay estado paralelo en JS.

  /** Abierto o cerrado: atributo booleano `open`. */
  get open() {
    return this.getAttribute("open") !== null;
  }
  set open(v) {
    if (!v) {
      this.removeAttribute("open");
      return;
    }
    // Abrir limpia el veredicto y la fila del retiro ANTERIOR: el modal nace en
    // idle, colapsado y con el input vacío. Sólo en la transición cerrado →
    // abierto: refrescar los datos de un modal que ya está abierto (después de
    // un retiro) no puede borrar el "¡Retirado!" que se acaba de mostrar.
    if (!this.open) this.#resetWithdraw();
    this.setAttribute("open", "");
  }

  /** Dirección de la que son las donaciones (acá no se acorta: eso es la vista). */
  get address() {
    return this.getAttribute("address") ?? "";
  }
  set address(v) {
    this.setAttribute("address", String(v ?? ""));
  }

  /**
   * Aviso para el resumen. Existe porque la tabla puede quedar vacía por dos
   * motivos que NO son lo mismo: de verdad no recibiste ninguna donación, o la
   * lectura de la chain falló. Sin este texto, una lectura rota mostraría una
   * tabla vacía mintiendo "no recibiste nada". Vacío = resumen calculado con
   * las filas.
   */
  get message() {
    return this.getAttribute("message") ?? "";
  }
  set message(v) {
    this.setAttribute("message", String(v ?? ""));
  }

  /** Balance disponible en ETH, como texto (mismas convenciones que el panel). */
  get balanceEth() {
    return this.getAttribute("balance-eth") ?? "0";
  }
  set balanceEth(v) {
    this.setAttribute("balance-eth", String(v));
  }

  /** Balance disponible en USD, como texto. */
  get balanceUsd() {
    return this.getAttribute("balance-usd") ?? "0.00";
  }
  set balanceUsd(v) {
    this.setAttribute("balance-usd", String(v));
  }

  /**
   * ¿Esta cuenta puede retirar? Lo decide el flujo (`canWithdraw(role)`): el rol
   * es UI y la autoridad es el contrato. El default es `false` —si nadie lo
   * autorizó, la isla no ofrece retirar—, y el balance lo termina de decidir:
   * sin saldo no hay nada que retirar.
   */
  get canWithdraw() {
    return this.getAttribute("can-withdraw") === "true";
  }
  set canWithdraw(v) {
    this.setAttribute("can-withdraw", v ? "true" : "false");
  }

  /** Estado de la retirada: `idle | pending | success | error`. */
  get withdrawStatus() {
    return this.getAttribute("withdraw-status") ?? "idle";
  }
  set withdrawStatus(v) {
    this.setAttribute("withdraw-status", v);
  }

  /** Mensaje de la retirada; vacío = se usa el texto por defecto del estado. */
  get withdrawMessage() {
    return this.getAttribute("withdraw-message") ?? "";
  }
  set withdrawMessage(v) {
    this.setAttribute("withdraw-message", v);
  }

  /**
   * Filas del libro de barra: array de `{ donorShort, amountEth, usd, when }`.
   * No es atributo, así que el `set` repinta a mano, igual que en el panel.
   * Sin setear arranca vacío: la isla no inventa datos.
   */
  get donations() {
    return this.#donations;
  }
  set donations(rows) {
    this.#donations = Array.isArray(rows) ? rows : [];
    this.update(); // a mano: no es un atributo
  }

  /** El overlay del fondo (para el click de cierre). */
  get #overlay() {
    return this.root.querySelector("#overlay");
  }

  /** La dirección acortada: 6 primeros + `...` + 4 últimos. */
  get #addressShort() {
    const address = this.address;
    return address
      ? `${address.slice(0, 6)}...${address.slice(-4)}`
      : "";
  }

  /** El monto escrito, como número en ETH. `NaN` si no es un número. */
  get #amountValue() {
    const text = this.#amountText.trim();
    if (text === "") return NaN;
    const value = Number(text);
    return Number.isFinite(value) ? value : NaN;
  }

  /**
   * El veredicto del monto escrito, como texto de error. Vacío = se puede
   * confirmar. Es UI, no autoridad: el contrato revierte solo si el monto no
   * cierra, pero acá se avisa antes de pedir la firma.
   */
  get #amountError() {
    const amount = this.#amountValue;
    if (!(amount > 0)) return "El monto tiene que ser mayor que 0";
    if (amount > Number(this.balanceEth)) {
      return "No podés retirar más de lo que tenés";
    }
    return "";
  }

  /** Valores a pintar (hook de pintado de la base). */
  get state() {
    const donations = this.donations;
    const hasDonations = donations.length > 0;
    const addressShort = this.#addressShort;
    // El aviso manda sobre el resumen calculado: si la lectura falló, el
    // resumen de las filas (que están vacías) mentiría.
    const messageIsError = this.message !== "";
    // El retiro: el rol lo trae el flujo y el saldo lo dice la chain. Sin los
    // dos, no se ofrece retirar (`canWithdraw` es opt-in).
    const roleCanWithdraw = this.canWithdraw;
    const hasBalance = Number(this.balanceEth) > 0;
    const partOpen = this.#partOpen;
    const amountError = this.#amountError;
    const { withdrawStatus, withdrawMessage } = this;
    return {
      overlayHidden: !this.open,
      addressShort,
      hasDonations,
      notHasDonations: !hasDonations,
      messageIsError,
      // El resumen sale de las filas, salvo que haya un aviso que mostrar.
      summaryText: messageIsError ? this.message : buildSummary(donations),
      emptyText: hasDonations ? "" : "Todavía no recibiste ningún whiskito",
      balanceEth: this.balanceEth,
      balanceUsdText: `≈ $${this.balanceUsd} USD`,
      // Los dos botones viven o mueren con el rol; sin saldo quedan apagados
      // (el botón es el mismo, sólo no hay nada para retirar).
      withdrawButtonsHidden: !roleCanWithdraw,
      cannotWithdraw: !(roleCanWithdraw && hasBalance),
      // Retiro parcial: la fila se despliega, el botón que la abre se esconde
      // mientras está abierta, y el veredicto del monto se pinta sólo con la
      // fila abierta (el input nace vacío, y vacío es inválido a propósito).
      withdrawPartHidden: !partOpen,
      withdrawPartButtonHidden: !roleCanWithdraw || partOpen,
      withdrawPartErrorHidden: !(partOpen && amountError !== ""),
      withdrawPartErrorText: amountError,
      withdrawConfirmDisabled: !(partOpen && amountError === ""),
      withdrawStatusHidden: withdrawStatus === "idle",
      isWithdrawError: withdrawStatus === "error",
      isWithdrawSuccess: withdrawStatus === "success",
      withdrawText:
        withdrawMessage !== ""
          ? withdrawMessage
          : WITHDRAW_LABELS[withdrawStatus] ?? "",
    };
  }

  /** Pinta la tabla: lo que los marcadores no cubren. */
  render(_state) {
    // El placeholder del retiro parcial es el saldo disponible: el input nace
    // vacío porque el monto lo escribe la persona, no la isla.
    const amountInput = this.root.querySelector("#withdrawAmount");
    if (amountInput) amountInput.placeholder = this.balanceEth;

    const body = this.root.querySelector("#donationsBody");
    const rowTemplate = this.root.querySelector("template[data-row]");
    if (!body || !rowTemplate) return;

    const rows = this.donations.map((donation) => {
      const row = rowTemplate.content.firstElementChild.cloneNode(true);
      const when = row.querySelector('[data-field="when"]');
      const donor = row.querySelector('[data-field="donorShort"]');
      const amount = row.querySelector('[data-field="amountEth"]');
      const usd = row.querySelector('[data-field="usd"]');
      // `when` y `donorShort` van tal cual; el monto lleva el signo y la
      // unidad, y el equivalente en dólares sólo si vino.
      if (when) when.textContent = donation.when ?? "";
      if (donor) donor.textContent = donation.donorShort ?? "";
      if (amount) amount.textContent = `+${donation.amountEth ?? ""} POL`;
      if (usd) {
        usd.textContent =
          donation.usd === undefined || donation.usd === null || donation.usd === ""
            ? ""
            : `≈ $${donation.usd}`;
      }
      return row;
    });

    body.replaceChildren(...rows);

    // El foco y el bloqueo del scroll siguen al atributo `open`, no al pintado:
    // van acá (y no en un marcador) porque son efectos sobre el documento.
    if (this.open) this.#enter();
    else this.#leave();
  }

  /** Despliega la fila de retiro parcial, con el input en blanco. */
  #openWithdrawPart() {
    this.#partOpen = true;
    this.#clearAmount();
    this.update();
    this.root.querySelector("#withdrawAmount")?.focus();
  }

  /** Colapsa la fila y limpia el input (el error se deriva del monto). */
  #closeWithdrawPart() {
    this.#partOpen = false;
    this.#clearAmount();
    this.update();
  }

  /** Vacía el input: su valor vive en el DOM y en `#amountText`. */
  #clearAmount() {
    this.#amountText = "";
    const input = this.root.querySelector("#withdrawAmount");
    if (input) input.value = "";
  }

  /**
   * Al abrir, el retiro vuelve a foja cero: fila colapsada, input vacío y
   * veredicto en `idle`. Los atributos se escriben sólo si cambian (si no, cada
   * `set` dispararía un `update()` de más).
   */
  #resetWithdraw() {
    this.#partOpen = false;
    this.#clearAmount();
    if (this.withdrawStatus !== "idle") this.withdrawStatus = "idle";
    if (this.withdrawMessage !== "") this.withdrawMessage = "";
    this.update();
  }

  connectedCallback() {
    super.connectedCallback();
    if (this.#wired) return;
    this.#wired = true;

    // Escape cierra, pero sólo si el panel está abierto (la tecla se escucha en
    // el documento porque el foco puede estar adentro del modal o no).
    document.addEventListener("keydown", this.#onKeydown);

    this.root.querySelector("#closeButton")?.addEventListener("click", () => {
      this.close();
    });

    // Click en el fondo (el overlay), no en la tarjeta: si el click nació
    // adentro del diálogo, el panel se queda abierto.
    this.#overlay?.addEventListener("click", (event) => {
      if (event.target === this.#overlay) this.close();
    });

    // ── Retiro: mismas dos vías que el panel ────────────────────────────
    this.root.querySelector("#withdrawButton")?.addEventListener("click", () => {
      // Deshabilitado no se emite nada (la isla sólo avisa, la política la
      // decide quien escucha). Sin monto en el `detail`: retiro TOTAL.
      if (this.state.cannotWithdraw) return;
      this.emit("whiskito:withdraw-request", { amount: null });
    });

    this.root
      .querySelector("#withdrawPartButton")
      ?.addEventListener("click", () => {
        if (this.state.cannotWithdraw) return;
        this.#openWithdrawPart();
      });

    this.root.querySelector("#withdrawAmount")?.addEventListener("input", (event) => {
      this.#amountText = event.target.value;
      this.update();
    });

    this.root
      .querySelector("#withdrawConfirmButton")
      ?.addEventListener("click", () => {
        if (this.state.withdrawConfirmDisabled) return;
        // El monto va como texto decimal en ETH: `withdraw()` lo convierte.
        this.emit("whiskito:withdraw-request", { amount: this.#amountText });
      });

    this.root
      .querySelector("#withdrawCancelButton")
      ?.addEventListener("click", () => this.#closeWithdrawPart());

    // Si la isla arrancó con `open` puesto, el estado del documento ya toca.
    this.render(this.state);
  }

  disconnectedCallback() {
    document.removeEventListener("keydown", this.#onKeydown);
    clearTimeout(this.#focusTimer);
    // Desmontada: no se puede dejar el body sin scroll para siempre.
    this.#leave();
  }

  /** Cierra el panel y avisa hacia afuera. Es lo que usan las tres vías. */
  close() {
    if (!this.open) return;
    this.open = false;
    this.emit("whiskito:dashboard-close");
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
