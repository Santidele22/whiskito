import { WhiskitoElement } from "./base-element.js";
// Los formateadores de monto YA existen (los comparten el panel y esta tabla): se
// usan, no se reescriben. Y la dirección acortada también vive ahí.
import { formatEth, formatUsd, shortAddress } from "../js/utils/format.js";

/** Texto por defecto de la retirada, según su estado (los mismos del panel). */
const WITHDRAW_LABELS = {
  pending: "Retirando…",
  success: "¡Retirado!",
  error: "No se pudo retirar",
  idle: "",
};

/**
 * Isla "Historial de donaciones": la tabla COMPLETA de lo que recibió una
 * dirección. Vive sola en su propia página (`/historial`) y también INLINE en la
 * vista del profesional de la landing.
 *
 * Es sólo la isla: quién la llena, de qué dirección y con qué explorador lo
 * decide el flujo (hoy `js/entries/historial.js` y `js/entries/app.js` a través de
 * `js/dom/islands.js`), no este archivo. La isla NO lee la chain: le pasan las filas.
 *
 * API por propiedades, con el mismo estilo que `whiskito-panel.js` (el atributo
 * ES el estado):
 *   address   dirección de la que son las donaciones (se muestra acortada).
 *   message   aviso: estado de error, o el aviso de que todavía no hay de quién
 *             leer. Vacío = resumen calculado con las filas.
 *   explorer  base del explorador de la red activa (vacío en anvil, que no
 *             tiene): sin él la columna "Tx" no se dibuja.
 *   loading   booleano — atributo booleano `loading`: la lectura está en curso.
 *   connect   booleano — atributo booleano `connect`: esta página TODAVÍA no
 *             sabe de quién leer (la URL no traía dirección), así que ofrece el
 *             único camino que queda, conectar la wallet. El botón vive acá
 *             adentro y avisa hacia afuera con `whiskito:connect-request` (el
 *             mismo evento que emite la tarjeta de donación); quien conecta es
 *             el flujo. Apagado, el botón no se dibuja: una página con
 *             dirección no tiene nada que ofrecer.
 *   balanceEth / balanceUsd  el saldo DISPONIBLE del dueño (POL y su
 *             equivalente en dólares), el mismo dato y el mismo formato que el
 *             panel. Sólo se pinta con `canWithdraw`: es un dato de operación,
 *             no de historial.
 *   canWithdraw  booleano — atributo booleano `canWithdraw`: OPT-IN. Sin que
 *             nadie lo autorice la isla no ofrece retirar, así que `/historial`
 *             (cuyo flujo no lo prende) sigue siendo una página de lectura y
 *             sólo la vista del profesional —donde el panel está oculto— retira
 *             desde acá. Con el permiso puesto, la tarjeta muestra el saldo y las
 *             dos vías de retiro del panel: **Retirar todo** (`amount: null`) y
 *             **Retirar una parte** (`amount: "<texto en POL>"`), las dos con el
 *             MISMO evento `whiskito:withdraw-request` que ya existía.
 *   withdrawStatus / withdrawMessage  el veredicto de la retirada, con los
 *             mismos nombres y los mismos textos por defecto que el panel: una
 *             sola verdad para las dos islas que retiran.
 *   rows      array de `{ donorShort, amountEth, usd, when, donor, txHash,
 *             blockNumber }`. NO es atributo: se guarda en un campo privado y el
 *             `set` repinta.
 *
 * El error NUNCA puede verse como "no recibiste nada": si hay `message`, se
 * dice, y el estado vacío no se dibuja.
 *
 * Es una isla con shadow root: el reset global y los `@keyframes` no cruzan la
 * frontera, así que cada uno va declarado acá adentro.
 */

/**
 * Decimales a los que se redondean los TOTALES del resumen.
 *
 * Por qué se redondea: los montos de cada fila llegan como texto decimal
 * (`formatEther` de `solidity-functions.js`, hasta 18 decimales), así que
 * sumarlos en `Number` arrastra el polvo binario del punto flotante (`0.1 + 0.2`
 * no da `0.3`). Se redondean los totales —no las filas, que se muestran tal cual
 * vinieron— a los decimales con los que se leen: 6 para POL y 2 para USD.
 */
const TOTAL_ETH_DECIMALS = 6;
const TOTAL_USD_DECIMALS = 2;

/** Redondea al número de decimales pedido, sin el polvo del binario. */
function roundTo(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Suma los montos en POL de las filas, redondeada a 6 decimales. */
export function sumEth(rows) {
  const total = rows.reduce((sum, row) => sum + (Number(row.amountEth) || 0), 0);
  return roundTo(total, TOTAL_ETH_DECIMALS);
}

/** Suma los montos en USD de las filas, redondeada a 2 decimales. */
export function sumUsd(rows) {
  const total = rows.reduce((sum, row) => sum + (Number(row.usd) || 0), 0);
  return roundTo(total, TOTAL_USD_DECIMALS);
}

/**
 * El resumen calculado con las filas: `12 rondas · 0.0842 POL · ≈ $269.44 USD`.
 * Sin filas devuelve `""` (no hay nada que resumir). Función pura: los mismos
 * formateadores que el resumen del panel.
 *
 * @param {Array<{amountEth: string|number, usd: string|number}>} rows
 * @returns {string}
 */
export function buildHistorySummary(rows) {
  if (rows.length === 0) return "";
  const rondas = rows.length === 1 ? "1 ronda" : `${rows.length} rondas`;
  return `${rondas} · ${formatEth(sumEth(rows))} POL · ≈ $${formatUsd(
    sumUsd(rows)
  )} USD`;
}

/** Cómo termina el link a la transacción en el explorador. */
const TX_PATH = "/tx/";

export class WhiskitoHistoryTable extends WhiskitoElement {
  static observedAttributes = [
    "address",
    "message",
    "explorer",
    "loading",
    "connect",
    "balance-eth",
    "balance-usd",
    "can-withdraw",
    "withdraw-status",
    "withdraw-message",
  ];

  static styles = /* css */ `
    /* El reset universal de styles.css no cruza la frontera del shadow root:
       se copia acá para que margin, padding y box-sizing queden iguales. */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    /* La isla ocupa TODO el ancho y el alto que le queda: la página
       (body.history-page) es una columna —navbar arriba— y esto es el resto.
       flex: 1 es lo que la estira en esa columna; min-height: 0 deja que el
       alto lo mande la página y no el contenido. */
    :host {
      display: flex;
      flex: 1;
      width: 100%;
      min-height: 0;
      /* El aire del host es, además, lo que le deja lugar a la sombra dura de
         .hist-card (9px 9px): sin padding, la sombra empujaría la página a un
         scroll horizontal. */
      padding: 24px;
      box-sizing: border-box;
    }

    /* Nuestro CSS no puede ganarle al display:none que trae [hidden]. */
    [hidden] {
      display: none !important;
    }

    /* La tarjeta: el mismo recibo de barra del panel (papel, tinta y sombra
       dura), pero parada en la página en vez de flotando en un modal. Se estira
       con el host: ocupa todo el ancho y todo el alto que sobra. */
    .hist-card {
      display: flex;
      flex-direction: column;
      flex: 1;
      width: 100%;
      gap: 12px;
      padding: 30px 30px 24px;
      background: var(--paper);
      color: var(--ink);
      border: 3px solid var(--ink);
      border-radius: 6px;
      box-shadow: 9px 9px 0 var(--ink);
    }

    /* ---------- Cabecera tipo recibo ---------- */
    .hist-head {
      display: flex;
      align-items: center;
      gap: 12px;
      padding-bottom: 14px;
      border-bottom: 2px dashed var(--ink);
    }

    .hist-head-icon {
      font-size: 1.6rem;
      color: var(--cobalt);
    }

    .hist-head-titles {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .hist-title {
      font-family: var(--display);
      font-size: 1.6rem;
      font-weight: 700;
      line-height: 1;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: var(--ink);
    }

    .hist-address {
      font-family: 'Courier New', monospace;
      font-size: 0.82rem;
      font-weight: 700;
      color: var(--cobalt);
      word-break: break-all;
    }

    /* ---------- Resumen y estados ---------- */
    .hist-summary {
      font-family: 'Courier New', monospace;
      font-size: 0.95rem;
      font-weight: 700;
      color: var(--ink);
    }

    /* El aviso de error: la tabla vacía no significa "no recibiste nada". Sólo
       cambia el color, no el tamaño ni el peso: se lee como aviso, no como
       título. */
    .hist-summary.is-error {
      color: var(--blues-red);
    }

    /* Cargando: apagado, para que no se lea como un dato firme. */
    .hist-summary.is-loading {
      color: var(--stamp);
    }

    /* ---------- La tabla ---------- */
    .hist-scroll {
      overflow-x: auto;
      border-top: 2px dashed var(--ink);
    }

    table.hist-table {
      width: 100%;
      border-collapse: collapse;
      font-family: 'Courier New', monospace;
      font-size: 0.9rem;
    }

    .hist-table th {
      padding: 10px 8px;
      text-align: left;
      font-family: var(--cond);
      font-weight: 700;
      font-size: 0.78rem;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--stamp);
      border-bottom: 2px solid var(--ink);
    }

    .hist-table th.hist-num,
    .hist-table td.hist-num {
      text-align: right;
    }

    /* Filas con separador punteado, igual que el libro de barra del panel. */
    .hist-table td {
      padding: 11px 8px;
      border-bottom: 1px dotted rgba(28, 21, 18, 0.3);
      vertical-align: baseline;
    }

    .hist-when {
      font-size: 0.8rem;
      color: var(--stamp);
      white-space: nowrap;
    }

    .hist-table code {
      font-family: 'Courier New', monospace;
      font-size: 0.85rem;
      color: var(--ink);
    }

    .hist-amt {
      font-weight: 700;
      color: var(--success);
    }

    .hist-usd {
      font-weight: 400;
      color: var(--stamp);
    }

    /* El link a la transacción: tinta con subrayado, como cualquier link del
       sistema. Sin explorador, la columna ni se dibuja. */
    .hist-tx {
      color: var(--cobalt);
      font-weight: 700;
      text-decoration: underline;
    }

    .hist-tx:hover {
      color: var(--blues-red);
    }

    /* Barra sin whiskitos todavía. */
    .hist-empty {
      display: block;
      padding: 22px 8px;
      text-align: center;
      font-family: var(--cond);
      font-weight: 600;
      font-size: 1.05rem;
      color: var(--stamp);
      font-style: italic;
    }

    /* El título de la tabla se anuncia pero no se ve: la tabla ya tiene sus
       encabezados. */
    .hist-visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }

    /* ---------- Botones ---------- */
    /* El botón primario de la casa: rojo cartel con tinta de papel, borde de
       tinta y sombra dura (el mismo tratamiento que el botón de conectar de la
       tarjeta de compartir y los primarios del panel).
       El hover corre SÓLO la sombra, sin transform: mover la caja ensuciaría las
       mediciones del harness y no hace falta. */
    .hist-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 14px 24px;
      border: 3px solid var(--ink);
      border-radius: 6px;
      font-family: var(--cond);
      font-size: 1.1rem;
      font-weight: 700;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      cursor: pointer;
      box-shadow: 5px 5px 0 var(--ink);
      transition: box-shadow 0.2s ease;
    }

    .hist-btn:hover:not(:disabled) {
      box-shadow: 8px 8px 0 var(--ink);
    }

    .hist-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* El display propio le gana al [hidden] del navegador: cada control que se
       muestra u oculta declara su [hidden]. */
    .hist-btn[hidden] {
      display: none;
    }

    /* La única "mancha" de color adentro de la tarjeta, y es tinta de texto
       sobre rojo, no un fondo de bloque. */
    .hist-btn-primary {
      background: var(--blues-red);
      color: var(--paper);
    }

    /* El mismo botón que el de conectar: es el que vive en el estado "todavía no
       sé de quién". */
    .hist-connect {
      background: var(--blues-red);
      color: var(--paper);
    }

    /* ---------- Retiro (opt-in canWithdraw) ---------- */
    /* El saldo disponible: mismo dato y formato que el del panel. */
    .hist-balance {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .hist-balance-label {
      font-family: var(--cond);
      font-size: 0.8rem;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--stamp);
    }

    .hist-balance-value {
      display: flex;
      align-items: baseline;
      gap: 10px;
      font-family: 'Courier New', monospace;
      font-size: 2.4rem;
      font-weight: 700;
      line-height: 1;
      color: var(--ink);
    }

    .hist-balance-unit {
      font-size: 1rem;
      color: var(--blues-red);
    }

    .hist-balance-usd {
      font-size: 0.95rem;
      color: var(--stamp);
    }

    .hist-withdraw-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }

    /* Retiro parcial: la fila inline, con el input y su veredicto. */
    .hist-withdraw-part {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 14px;
      border: 2px dashed var(--ink);
      border-radius: 6px;
    }

    .hist-withdraw-part[hidden] {
      display: none;
    }

    .hist-withdraw-label {
      font-family: var(--cond);
      font-weight: 700;
      font-size: 0.85rem;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: var(--stamp);
    }

    .hist-withdraw-input {
      width: 100%;
      padding: 10px 12px;
      font-family: 'Courier New', monospace;
      font-size: 1rem;
      font-weight: 700;
      color: var(--ink);
      background: var(--paper);
      border: 2px solid var(--ink);
      border-radius: 4px;
    }

    .hist-withdraw-input:focus {
      outline: 2px solid var(--cobalt);
      outline-offset: 1px;
    }

    .hist-withdraw-error {
      font-family: var(--cond);
      font-size: 0.9rem;
      color: var(--blues-red);
    }

    .hist-withdraw-error[hidden] {
      display: none;
    }

    .hist-withdraw-part-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .hist-withdraw-part-actions .hist-btn {
      flex: 1 1 auto;
      padding: 10px 14px;
      font-size: 0.95rem;
    }

    /* El veredicto de la retirada: lo pinta la isla con is-error / is-success. */
    .hist-withdraw-status {
      font-family: var(--cond);
      text-align: center;
      font-weight: 700;
      letter-spacing: 1px;
      color: var(--stamp);
    }

    .hist-withdraw-status.is-error {
      color: var(--blues-red);
    }

    .hist-withdraw-status.is-success {
      color: var(--success);
    }

    .hist-withdraw-status[hidden] {
      display: none;
    }

    /* ---------- Pie ---------- */
    .hist-foot {
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
      :host {
        padding: 16px 12px;
      }

      .hist-card {
        padding: 24px 18px 18px;
      }

      .hist-title {
        font-size: 1.35rem;
      }

      .hist-table th,
      .hist-table td {
        padding: 9px 4px;
      }
    }
  `;

  static template = /* html */ `
    <section class="hist-card" aria-labelledby="histTitle">
      <header class="hist-head">
        <span class="hist-head-icon"
          ><i data-lucide="scroll-text" aria-hidden="true"></i
        ></span>
        <div class="hist-head-titles">
          <h1 class="hist-title" id="histTitle">Historial de donaciones</h1>
          <code
            class="hist-address"
            id="histAddress"
            data-text="addressShort"
            data-attr="title:addressFull"
          ></code>
        </div>
      </header>

      <p
        class="hist-summary"
        id="histSummary"
        data-text="summaryText"
        data-attr="hidden:summaryHidden"
        data-class="is-error:isError; is-loading:isLoading"
      ></p>

      <!-- La salida cuando la URL no traía dirección: el icono va en su propio
           <i> y el texto del botón NO lleva el marcador data-text, así update()
           no borra el SVG ya hidratado. -->
      <button
        type="button"
        class="hist-btn hist-connect"
        id="histConnect"
        data-attr="hidden:connectHidden"
      >
        <i data-lucide="wallet" aria-hidden="true"></i> Conectá tu wallet
      </button>

      <div class="hist-scroll">
        <table
          class="hist-table"
          id="histTable"
          data-attr="hidden:tableHidden"
        >
          <caption class="hist-visually-hidden">
            Donaciones recibidas
          </caption>
          <thead>
            <tr>
              <th scope="col">Cuándo</th>
              <th scope="col">Quién</th>
              <th scope="col" class="hist-num">POL</th>
              <th scope="col" class="hist-num">USD</th>
              <th scope="col" id="histTxHead" data-attr="hidden:txColumnHidden">
                Tx
              </th>
            </tr>
          </thead>
          <tbody id="histBody"></tbody>
        </table>
      </div>

      <p class="hist-empty" data-attr="hidden:emptyHidden">
        Todavía no recibiste ningún whiskito
      </p>

      <!-- El retiro (opt-in canWithdraw): el saldo disponible y las dos vías,
           igual que el recibo del panel. Las dos emiten el MISMO
           whiskito:withdraw-request de siempre: amount null para el total y el
           texto decimal en POL para el parcial. El icono va en su propio i y los
           textos de los botones NO llevan data-text. -->
      <section class="hist-withdraw" data-attr="hidden:withdrawHidden">
        <p class="hist-balance-label">Balance disponible</p>
        <p class="hist-balance">
          <span class="hist-balance-value"
            ><span id="histBalance" data-text="balanceEth">0</span>
            <span class="hist-balance-unit">POL</span></span
          >
        </p>
        <p
          class="hist-balance-usd"
          id="histBalanceUsd"
          data-text="balanceUsd"
        ></p>

        <div class="hist-withdraw-actions">
          <button
            id="histWithdrawButton"
            class="hist-btn hist-btn-primary"
            type="button"
            data-attr="disabled:withdrawDisabled"
          >
            <i data-lucide="banknote" aria-hidden="true"></i> Retirar todo
          </button>

          <button
            id="histWithdrawPartButton"
            class="hist-btn"
            type="button"
            data-attr="hidden:withdrawPartButtonHidden; disabled:withdrawDisabled"
          >
            Retirar una parte
          </button>
        </div>

        <div
          class="hist-withdraw-part"
          id="histWithdrawPart"
          data-attr="hidden:withdrawPartHidden"
        >
          <label class="hist-withdraw-label" for="histWithdrawAmount"
            >Monto a retirar (POL)</label
          >
          <input
            id="histWithdrawAmount"
            class="hist-withdraw-input"
            type="number"
            step="any"
            min="0"
            inputmode="decimal"
            placeholder=""
            aria-describedby="histWithdrawPartError"
          />
          <p
            class="hist-withdraw-error"
            id="histWithdrawPartError"
            data-text="withdrawPartErrorText"
            data-attr="hidden:withdrawPartErrorHidden"
          ></p>
          <div class="hist-withdraw-part-actions">
            <button
              id="histWithdrawConfirmButton"
              class="hist-btn hist-btn-primary"
              type="button"
              data-attr="disabled:withdrawConfirmDisabled"
            >
              Confirmar retiro
            </button>
            <button
              id="histWithdrawCancelButton"
              class="hist-btn"
              type="button"
            >
              Cancelar
            </button>
          </div>
        </div>

        <p
          class="hist-withdraw-status"
          id="histWithdrawStatus"
          data-text="withdrawText"
          data-attr="hidden:withdrawStatusHidden"
          data-class="is-error:isWithdrawError; is-success:isWithdrawSuccess"
        ></p>
      </section>

      <p class="hist-foot">whiskito · historial completo</p>
    </section>

    <template data-row>
      <tr>
        <td class="hist-when" data-field="when"></td>
        <td class="hist-donor">
          <code data-field="donorShort"></code>
        </td>
        <td class="hist-amt hist-num" data-field="amountEth"></td>
        <td class="hist-usd hist-num" data-field="usd"></td>
        <td class="hist-tx-cell">
          <a
            class="hist-tx"
            data-field="tx"
            target="_blank"
            rel="noopener noreferrer"
            >ver tx</a
          >
        </td>
      </tr>
    </template>
  `;

  /** Las filas. No es atributo: el `set` repinta a mano, como en el panel. */
  #rows = [];

  /** Los listeners se cablean una sola vez, aunque la isla se reconecte. */
  #wired = false;

  /** La fila de retiro parcial está desplegada. */
  #partOpen = false;

  /** Lo escrito en el input, como texto en POL (vacío = todavía nada). */
  #amountText = "";

  // --- API explícita: propiedades y atributos --------------------------------

  /** Dirección de la que son las donaciones (acá no se acorta: eso es la vista). */
  get address() {
    return this.getAttribute("address") ?? "";
  }
  set address(v) {
    this.setAttribute("address", String(v ?? ""));
  }

  /**
   * Aviso a mostrar en lugar del resumen. Existe porque la tabla puede quedar
   * vacía por motivos que NO son "no recibiste nada": la lectura de la chain
   * falló, o todavía no hay ninguna dirección que leer. Sin este texto, esos
   * casos mostrarían una tabla vacía mintiendo. Vacío = resumen calculado.
   */
  get message() {
    return this.getAttribute("message") ?? "";
  }
  set message(v) {
    this.setAttribute("message", String(v ?? ""));
  }

  /** Base del explorador de la red activa; vacío = esa red no tiene. */
  get explorer() {
    return this.getAttribute("explorer") ?? "";
  }
  set explorer(v) {
    this.setAttribute("explorer", String(v ?? ""));
  }

  /** La lectura está en curso: atributo booleano `loading`. */
  get loading() {
    return this.getAttribute("loading") !== null;
  }
  set loading(v) {
    if (!v) {
      this.removeAttribute("loading");
      return;
    }
    this.setAttribute("loading", "");
  }

  /**
   * ¿Se ofrece conectar la wallet? Atributo booleano `connect`: lo prende el
   * flujo cuando la página no tiene dirección que leer. El atributo ES el estado
   * (presente = verdadero), como `loading`.
   */
  get connect() {
    return this.getAttribute("connect") !== null;
  }
  set connect(v) {
    this.toggleAttribute("connect", Boolean(v));
  }

  /** Balance disponible, como texto en POL. El mismo default que el panel. */
  get balanceEth() {
    return this.getAttribute("balance-eth") ?? "0";
  }
  set balanceEth(v) {
    this.setAttribute("balance-eth", String(v ?? "0"));
  }

  /** Balance disponible en dólares, como texto. Mismo default que el panel. */
  get balanceUsd() {
    return this.getAttribute("balance-usd") ?? "0.00";
  }
  set balanceUsd(v) {
    this.setAttribute("balance-usd", String(v ?? "0.00"));
  }

  /**
   * ¿Esta tabla puede retirar? Atributo booleano `canWithdraw`: es OPT-IN y el
   * default es NO.
   *
   * Es la bisagra entre las dos páginas que montan la misma isla: la vista del
   * profesional lo prende (ahí el panel del backstage está oculto y ésta es la
   * única salida del dinero) y `/historial` no lo prende nunca, así que sigue
   * siendo una página de lectura. Sin el permiso la isla no dibuja ni el saldo ni
   * los botones: nada que apretar, nada que ofrecer.
   */
  get canWithdraw() {
    return this.getAttribute("can-withdraw") !== null;
  }
  set canWithdraw(v) {
    this.toggleAttribute("can-withdraw", Boolean(v));
  }

  /** Estado de la retirada: `idle | pending | success | error` (como el panel). */
  get withdrawStatus() {
    return this.getAttribute("withdraw-status") ?? "idle";
  }
  set withdrawStatus(v) {
    this.setAttribute("withdraw-status", String(v ?? "idle"));
  }

  /** Mensaje de la retirada; vacío = se usa el texto por defecto del estado. */
  get withdrawMessage() {
    return this.getAttribute("withdraw-message") ?? "";
  }
  set withdrawMessage(v) {
    this.setAttribute("withdraw-message", String(v ?? ""));
  }

  /**
   * Filas del historial: array de `{ donorShort, amountEth, usd, when, donor,
   * txHash, blockNumber }`. No es atributo, así que el `set` repinta a mano,
   * igual que `donations` en el panel. Sin setear arranca vacío: la isla no
   * inventa datos.
   */
  get rows() {
    return this.#rows;
  }
  set rows(v) {
    this.#rows = Array.isArray(v) ? v : [];
    this.update(); // a mano: no es un atributo
  }

  /** La dirección COMPLETA, para el `title` (la vista muestra la acortada). */
  get #addressFull() {
    return this.address;
  }

  /** La dirección acortada: 6 primeros + `...` + 4 últimos. */
  get #addressShort() {
    return shortAddress(this.address);
  }

  /** ¿La red tiene explorador? Sin él, la columna "Tx" no se dibuja. */
  get #hasExplorer() {
    return this.explorer !== "";
  }

  /** El monto escrito, como número. `NaN` si no es un número. */
  get #amountValue() {
    const text = this.#amountText.trim();
    if (text === "") return NaN;
    const value = Number(text);
    return Number.isFinite(value) ? value : NaN;
  }

  /**
   * El veredicto del monto escrito, como texto de error. Vacío = se puede
   * confirmar. Es EXACTAMENTE el criterio del panel (es el mismo producto):
   * vacío y `0` son inválidos, un monto mayor al saldo también, y exactamente el
   * saldo es válido. Es UI, no autoridad: el contrato revierte solo si el monto
   * no cierra, pero acá se avisa antes de pedir la firma.
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
    const rows = this.rows;
    const loading = this.loading;
    // El aviso manda sobre todo lo demás: si la lectura falló —o no hay de
    // quién leer—, el resumen calculado (con las filas vacías) mentiría, y el
    // estado vacío también. Por eso `message` gana sobre `loading` y sobre las
    // filas.
    const hasMessage = this.message !== "";
    // Los estados son mutuamente excluyentes: cargando, aviso, o datos.
    const isError = hasMessage && !loading;
    const isLoading = loading && !hasMessage;
    const hasRows = rows.length > 0;
    const showTable = hasRows && !hasMessage;
    // El retiro: opt-in y con saldo. Un saldo en cero no es un retiro que se
    // pueda pedir, así que los botones quedan apagados (nunca escondidos: que el
    // dueño VEA que no tiene nada es información, no ruido).
    const canWithdraw = this.canWithdraw;
    const hasBalance = Number(this.balanceEth) > 0;
    const { withdrawStatus, withdrawMessage } = this;
    const partOpen = this.#partOpen;
    const amountError = this.#amountError;
    return {
      addressShort: this.#addressShort,
      addressFull: this.#addressFull,
      // Sólo el estado de error va en rojo: "cargando" se apaga, y un aviso de
      // "esto todavía no tiene dirección" no es un error de la chain.
      isError,
      isLoading,
      // Sin filas, sin aviso y sin lectura en curso no hay nada que resumir: el
      // estado vacío lo dice.
      summaryHidden: !hasRows && !hasMessage && !loading,
      summaryText: hasMessage
        ? this.message
        : isLoading
          ? "Leyendo la chain…"
          : buildHistorySummary(rows),
      tableHidden: !showTable,
      txColumnHidden: !this.#hasExplorer,
      emptyHidden: hasRows || hasMessage || loading,
      // El botón de conectar es la salida del estado "todavía no sé de quién":
      // su visibilidad la manda el permiso `connect` del flujo, no el mensaje.
      // Quien sabe si conectar es la salida es la página, no la isla.
      connectHidden: !this.connect,
      // ---- Retiro (todo apagado sin `canWithdraw`) ----
      withdrawHidden: !canWithdraw,
      balanceEth: formatEth(this.balanceEth),
      balanceUsd: `≈ $${formatUsd(this.balanceUsd)} USD`,
      withdrawDisabled: !hasBalance,
      withdrawStatusHidden: withdrawStatus === "idle",
      isWithdrawSuccess: withdrawStatus === "success",
      isWithdrawError: withdrawStatus === "error",
      withdrawText:
        withdrawMessage !== "" ? withdrawMessage : WITHDRAW_LABELS[withdrawStatus] ?? "",
      // Retiro parcial: la fila se despliega, el botón que la abre se esconde
      // mientras está abierta, y el veredicto del monto se pinta sólo con la fila
      // abierta (el input nace vacío, y vacío es inválido a propósito).
      withdrawPartHidden: !partOpen,
      withdrawPartButtonHidden: partOpen,
      withdrawPartErrorHidden: !(partOpen && amountError !== ""),
      withdrawPartErrorText: amountError,
      withdrawConfirmDisabled: !(partOpen && amountError === ""),
    };
  }

  /** Pinta la tabla: lo que los marcadores no cubren. */
  render(_state) {
    // El placeholder del monto es el saldo disponible: el input nace vacío
    // porque el monto lo escribe la persona, no la isla (igual que el panel).
    const input = this.root.querySelector("#histWithdrawAmount");
    if (input) input.placeholder = this.balanceEth;

    const body = this.root.querySelector("#histBody");
    const rowTemplate = this.root.querySelector("template[data-row]");
    if (!body || !rowTemplate) return;

    const { explorer } = this;
    const rows = this.rows.map((row) => {
      const node = rowTemplate.content.firstElementChild.cloneNode(true);
      const when = node.querySelector('[data-field="when"]');
      const donor = node.querySelector('[data-field="donorShort"]');
      const amount = node.querySelector('[data-field="amountEth"]');
      const usd = node.querySelector('[data-field="usd"]');
      const tx = node.querySelector('[data-field="tx"]');

      if (when) when.textContent = row.when ?? "";
      if (donor) {
        // Acá va la ACORTADA (la completa va en el `title`): es lo mismo que
        // muestra el libro de barra del panel.
        donor.textContent = row.donorShort ?? "";
        donor.title = row.donor ?? "";
      }
      // El monto lleva el signo y la unidad; el equivalente en dólares sólo si
      // vino (el `usd` es un adorno del evento).
      if (amount) amount.textContent = `+${row.amountEth ?? ""} POL`;
      if (usd) {
        usd.textContent =
          row.usd === undefined || row.usd === null || row.usd === ""
            ? ""
            : `≈ $${row.usd}`;
      }

      // Sin explorador la celda no se dibuja: va vacía y su <th> queda oculto,
      // así la tabla no queda con una columna fantasma (anvil no tiene
      // explorador).
      const cell = node.querySelector(".hist-tx-cell");
      if (tx) {
        if (explorer && row.txHash) {
          tx.href = `${explorer}${TX_PATH}${row.txHash}`;
        } else {
          tx.removeAttribute("href");
          cell?.setAttribute("hidden", "");
        }
      }
      return node;
    });

    body.replaceChildren(...rows);
  }

  /** Despliega la fila de retiro parcial, con el input en blanco. */
  #openWithdrawPart() {
    this.#partOpen = true;
    this.#clearAmount();
    this.update();
    this.root.querySelector("#histWithdrawAmount")?.focus();
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
    const input = this.root.querySelector("#histWithdrawAmount");
    if (input) input.value = "";
  }

  connectedCallback() {
    super.connectedCallback();

    // Los listeners van una sola vez (`#wired`), como en la tarjeta de
    // donación: el shadow root sobrevive a un reconnect y no hay que duplicar.
    if (this.#wired) return;
    this.#wired = true;

    // La isla no conecta: avisa. El mismo evento `whiskito:connect-request`
    // (sin `detail`) que emite la tarjeta de donación; burbujea y cruza el
    // shadow root hasta el documento, donde lo escucha la página.
    this.root.querySelector("#histConnect")?.addEventListener("click", () => {
      this.emit("whiskito:connect-request");
    });

    // El retiro avisa hacia afuera con los MISMOS eventos del panel: la isla es
    // UI y la política la decide quien escucha (`app.js`). Sin monto en el
    // `detail`: retiro TOTAL.
    this.root
      .querySelector("#histWithdrawButton")
      ?.addEventListener("click", () => {
        if (this.state.withdrawDisabled) return;
        this.emit("whiskito:withdraw-request", { amount: null });
      });

    this.root
      .querySelector("#histWithdrawPartButton")
      ?.addEventListener("click", () => {
        if (!this.canWithdraw) return;
        this.#openWithdrawPart();
      });

    this.root
      .querySelector("#histWithdrawAmount")
      ?.addEventListener("input", (event) => {
        this.#amountText = event.target.value;
        this.update();
      });

    this.root
      .querySelector("#histWithdrawConfirmButton")
      ?.addEventListener("click", () => {
        if (this.state.withdrawConfirmDisabled) return;
        // El monto va como texto decimal en POL: `withdraw()` lo convierte.
        this.emit("whiskito:withdraw-request", { amount: this.#amountText });
      });

    this.root
      .querySelector("#histWithdrawCancelButton")
      ?.addEventListener("click", () => this.#closeWithdrawPart());
  }
}
