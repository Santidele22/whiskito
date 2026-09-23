import { WhiskitoElement } from "./base-element.js";
import { shortAddress } from "../js/format.js";

const STATUS_TEXT = {
  pending: "Procesando transacción...",
  success: "¡Whiskito enviado!",
  error: "No se pudo completar la transacción",
  idle: "",
};

/**
 * El dueño de la página no se dona a sí mismo (la regla vive en
 * `viewer-role.js` y la landing la aplica igual): con `canDonate = false` el
 * botón queda deshabilitado y el motivo se ve donde se ven los otros avisos.
 * Es copia literal del mensaje de `app.js`, para que las dos páginas digan lo
 * mismo.
 */
const SELF_DONATION_MESSAGE =
  "Estás en tu propia página: compartí el link para recibir";

export class WhiskitoDonateCard extends WhiskitoElement {
  static observedAttributes = [
    "amount",
    "eth-price",
    "min-usd",
    "status",
    "message",
    // Modo demo: lo decide la página que usa la tarjeta (ver `get demo`).
    "demo",
    // Opt-in de la página de donación (`/u/0x…`): sin estos atributos la
    // tarjeta se comporta y se ve exactamente como en la landing.
    "recipient",
    "viewer",
    "show-connect",
    // Opt-in del bloqueo por rol: `canDonate = false` deshabilita el botón de
    // donar. Sin el atributo (la landing) vale `true` y todo queda igual.
    "can-donate",
  ];

  static styles = /* css */ `
    /* El reset universal de styles.css no cruza la frontera del shadow root: se
       copia acá (y sigue en el global) para que margin, padding y box-sizing
       queden iguales a cuando la isla vivía en light DOM. */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    /* Iconos Lucide (ver DESIGN-SPEC §5.1.5): la hoja global no cruza la
       frontera del shadow root, así que la regla vive también acá. El SVG mide
       1em y dibuja con currentColor: hereda el font-size y el color del slot. */
    .icon {
      width: 1em;
      height: 1em;
      flex: none;
      vertical-align: -0.15em;
    }

    /* Tooltip del sistema (ficha técnica bajo el cobalto): copia literal. */
    .tt {
      position: relative;
      border-bottom: 2px dotted var(--cobalt);
      cursor: help;
      outline: none;
      font-style: italic;
    }

    .tt::after {
      content: attr(data-tip);
      position: absolute;
      bottom: calc(100% + 12px);
      left: 50%;
      transform: translateX(-50%) translateY(4px);
      width: max-content;
      max-width: 280px;
      white-space: normal;
      background: var(--cobalt);
      color: var(--paper);
      font-family: var(--cond);
      font-size: 0.92rem;
      font-style: normal;
      letter-spacing: 0.3px;
      line-height: 1.4;
      padding: 12px 16px;
      border: 2px solid var(--ink);
      box-shadow: 5px 5px 0 var(--ink);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s, transform 0.2s;
      z-index: 150;
    }

    .tt:hover::after,
    .tt:focus::after {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }

    /* Botones del sistema Blues Poster '62: copia literal de styles.css
       (mismos valores, mismo orden). */
    .btn {
      border: 3px solid var(--ink);
      border-radius: 6px;
      padding: 14px 28px;
      font-family: var(--cond);
      font-weight: 700;
      font-size: 1.15rem;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
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

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-primary {
      background: var(--blues-red);
      color: var(--paper);
    }

    .btn-lg {
      padding: 18px 36px;
      font-size: 1.3rem;
    }

    .btn-block {
      width: 100%;
    }

    /* La carta del bar: papel crema, tinta y sombra dura cobalto. */
    .donate-card {
      position: relative;
      background: #fffdf6;
      border: 3px solid var(--ink);
      border-radius: 6px;
      box-shadow: 9px 9px 0 var(--cobalt);
      padding: 40px 36px;
    }

    .card-title {
      font-family: var(--display);
      font-size: 1.8rem;
      text-transform: uppercase;
      margin-bottom: 4px;
    }

    .card-subtitle {
      font-family: var(--cond);
      font-weight: 600;
      font-size: 1.05rem;
      color: var(--stamp);
      margin-bottom: 26px;
      border-bottom: 3px double var(--ink);
      padding-bottom: 14px;
    }

    /* Aviso de demo: que se vea EN la tarjeta que esto es una demostración de
       cómo funciona el link de Whiskito (se prueba sin wallet y sin gas). Es un
       cartelito, no una alarma: caja punteada, fondo de papel y texto chico.
       Regla propia de la isla (el sistema no la define). */
    .card-demo {
      display: flex;
      gap: 8px;
      align-items: flex-start;
      border: 2px dashed var(--ink);
      border-radius: 4px;
      background: var(--paper);
      color: var(--ink);
      font-family: var(--cond);
      font-weight: 600;
      font-size: 0.85rem;
      line-height: 1.4;
      padding: 10px 12px;
      margin-bottom: 22px;
    }

    /* El icono va alineado con la PRIMERA línea del texto: en un contenedor flex
       vertical-align no hace nada, así que se corrige con el margen. */
    .card-demo .icon {
      margin-top: 0.15em;
    }

    .card-demo b {
      color: var(--blues-red);
    }

    /* El display:flex de arriba le gana al hidden: sin esta regla el aviso no se
       oculta nunca (misma trampa que un host con display propio). */
    .card-demo[hidden] {
      display: none;
    }

    .quick-amounts {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 26px;
    }

    .chip {
      background: var(--paper);
      border: 2px solid var(--ink);
      border-radius: 4px;
      color: var(--ink);
      padding: 9px 15px;
      cursor: pointer;
      font-family: var(--cond);
      font-weight: 700;
      font-size: 1rem;
      letter-spacing: 0.5px;
      transition: all 0.15s;
    }

    .chip:hover {
      background: var(--mustard);
      transform: translate(-1px, -1px);
      box-shadow: 3px 3px 0 var(--ink);
    }

    /* Estado seleccionado: lo pone la isla al elegir un monto rápido. El sistema
       lo llama .active y render() marca .is-active: van las dos. */
    .chip.active,
    .chip.is-active {
      background: var(--blues-red);
      color: var(--paper);
      box-shadow: 3px 3px 0 var(--ink);
      transform: translate(-1px, -1px);
    }

    /* Sin precio ETH/USD no hay conversión posible: los chips quedan inertes.
       El sistema no define el estado deshabilitado: se arma con el look del
       poster (vuelve al papel y pierde el relieve). */
    .chip:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    .chip:disabled:hover {
      background: var(--paper);
      box-shadow: none;
      transform: none;
    }

    .input-group {
      margin-bottom: 24px;
    }

    .input-label {
      display: block;
      font-family: var(--cond);
      font-weight: 700;
      font-size: 0.9rem;
      letter-spacing: 2.5px;
      text-transform: uppercase;
      color: var(--stamp);
      margin-bottom: 8px;
    }

    .input-wrapper {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      background: var(--paper);
      border: 3px solid var(--ink);
      border-radius: 6px;
      padding: 12px 16px;
      transition: box-shadow 0.15s;
    }

    .input-wrapper:focus-within {
      box-shadow: 5px 5px 0 var(--cobalt);
    }

    .input-currency {
      font-family: var(--display);
      font-size: 1.5rem;
      color: var(--blues-red);
    }

    .input-wrapper input {
      flex: 1;
      min-width: 120px;
      background: transparent;
      border: none;
      outline: none;
      color: var(--ink);
      font-family: var(--cond);
      font-weight: 700;
      font-size: 1.5rem;
    }

    .input-wrapper input::placeholder {
      color: var(--stamp);
      opacity: 0.6;
    }

    .input-wrapper input::-webkit-outer-spin-button,
    .input-wrapper input::-webkit-inner-spin-button {
      -webkit-appearance: none;
    }

    .usd-equiv {
      width: 100%;
      text-align: right;
      font-family: var(--cond);
      font-weight: 600;
      font-size: 1rem;
      color: var(--cobalt);
    }

    /* Aviso cuando el monto no llega al mínimo on-chain: regla propia de la isla
       (el sistema no la define), escrita en el idioma del poster. */
    p.card-hint {
      font-family: var(--cond);
      color: var(--blues-red);
      text-align: center;
      margin-top: 12px;
      font-size: 0.9rem;
    }

    .card-footnote {
      margin-top: 20px;
      font-size: 0.85rem;
      color: var(--stamp);
      text-align: center;
    }

    /* Estado de tx */
    .tx-status {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      margin-top: 20px;
      padding: 14px;
      background: var(--paper-dark);
      border: 2px dashed var(--ink);
      border-radius: 4px;
      font-family: var(--cond);
      font-weight: 600;
      font-size: 1.05rem;
    }

    .tx-status[hidden] {
      display: none;
    }

    .tx-status.tx-success {
      background: #dce8d2;
      border-style: solid;
    }

    .tx-status.tx-error {
      background: #f0d6d0;
      border-style: solid;
    }

    /* El spinner es SÓLO del estado pendiente. Si sigue girando al lado del
       resultado, el cartel parece decir "todavía cargando" justo cuando ya
       terminó (era el bug: giraba siempre). */
    .tx-spinner {
      display: none;
      width: 18px;
      height: 18px;
      border: 3px solid var(--paper-dark);
      border-top-color: var(--blues-red);
      border-radius: 50%;
      animation: spinfast 0.8s linear infinite;
      flex-shrink: 0;
    }

    .tx-status.tx-pending .tx-spinner {
      display: block;
    }

    @keyframes spinfast {
      to {
        transform: rotate(360deg);
      }
    }

    @media (max-width: 768px) {
      .donate-card {
        padding: 32px 24px;
      }
    }

    /* ── Opt-in de la página de donación ──────────────────────────────
       La línea del destinatario y la fila de conexión nacen ocultas y sólo se
       muestran si la página setea recipient / show-connect: en la landing no
       pintan nada y no agregan caja. Van SIN iconos a propósito: los marcadores
       data-lucide se hidratan aunque el elemento esté oculto, y el conteo de
       iconos de la tarjeta es parte de lo verificado. */

    /* A quién se le dona, arriba de todo: el donante tiene que saberlo. */
    p.recipient-line {
      font-family: var(--cond);
      font-weight: 700;
      font-size: 0.95rem;
      letter-spacing: 0.5px;
      color: var(--cobalt);
      border-bottom: 2px solid var(--ink);
      padding-bottom: 10px;
      margin-bottom: 16px;
      word-break: break-all;
    }

    .connect-row {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 16px;
    }

    .connect-who {
      font-family: var(--cond);
      font-weight: 600;
      font-size: 0.95rem;
      color: var(--cobalt);
      text-align: center;
      word-break: break-all;
    }

    /* El atributo hidden tiene que ganarle al display de las reglas de arriba:
       si no, no oculta nada (misma trampa que un host con display propio). */
    p.recipient-line[hidden],
    .connect-row[hidden],
    .connect-who[hidden],
    #connectWallet[hidden],
    #switchWallet[hidden] {
      display: none;
    }

    /* Conectar no es la acción principal de la tarjeta (esa es donar): mismo
       lenguaje que .btn, sin el relleno rojo. */
    .btn-ghost {
      background: var(--paper);
      color: var(--cobalt);
    }
  `;

  static template = /* html */ `
          <div class="donate-card">
            <p class="recipient-line" hidden data-attr="hidden:recipientHidden" data-text="recipientText"></p>

            <h3 class="card-title">La carta</h3>
            <p class="card-subtitle">
              Elegí tu veneno: un monto rápido o el tuyo.
            </p>

            <p class="card-demo" data-attr="hidden:demoHidden">
              <i data-lucide="flask-conical"></i>
              <span><b>Demo:</b> así funciona el link de Whiskito. Probala con o sin wallet: no se firma nada, no se gasta gas y no queda en la blockchain.</span>
            </p>

            <div class="quick-amounts">
              <button class="chip" data-usd="0.5" data-attr="disabled:noPrice"><i data-lucide="glass-water"></i> Un sorbo</button>
              <button class="chip" data-usd="1" data-attr="disabled:noPrice"><i data-lucide="glass-water"></i> Un whisky</button>
              <button class="chip" data-usd="5" data-attr="disabled:noPrice"><i data-lucide="glass-water"></i> Una ronda</button>
              <button class="chip" data-usd="20" data-attr="disabled:noPrice"><i data-lucide="bottle-wine"></i> La botella entera</button>
            </div>

            <div class="input-group">
              <label for="ehtAmount" class="input-label">Monto en ETH</label>
              <div class="input-wrapper">
                <span class="input-currency">Ξ</span>
                <input
                  type="number"
                  id="ehtAmount"
                  placeholder="0.0002"
                  min="0"
                  step="0.0001"
                  autocomplete="off"
                />
                <span class="usd-equiv" id="usdEquivalent" data-text="usdText">≈ $0.00 USD</span>
              </div>
            </div>

            <p class="card-hint" id="cardHint" data-attr="hidden:hintHidden" data-text="hintText"></p>

            <div class="connect-row" hidden data-attr="hidden:connectHidden">
              <span class="connect-who" hidden data-attr="hidden:viewerHidden" data-text="viewerText"></span>
              <button
                type="button"
                id="connectWallet"
                class="btn btn-block btn-ghost"
                hidden
                data-attr="hidden:connectButtonHidden"
              >
                Conectar wallet
              </button>
              <button
                type="button"
                id="switchWallet"
                class="btn btn-block btn-ghost"
                hidden
                data-attr="hidden:switchHidden"
              >
                Cambiar cuenta
              </button>
            </div>

            <button id="fundButton" class="btn btn-primary btn-lg btn-block" data-attr="disabled:isDisabled">
              <i data-lucide="glass-water"></i> Invitar un Whiskito
            </button>

            <div id="txStatus" class="tx-status" hidden data-attr="hidden:statusHidden" data-class="tx-success:isSuccess; tx-error:isError; tx-pending:isPending">
              <span class="tx-spinner" aria-hidden="true"></span>
              <span class="tx-text" id="txText" data-text="statusText">Procesando transacción...</span>
            </div>

            <p class="card-footnote">
              <i data-lucide="lock"></i> Mínimo: 0.5 USD, calculado con el precio en tiempo real de un
              <span
                class="tt"
                tabindex="0"
                data-tip="Oráculo = un servicio que trae datos del mundo real (como el precio del dólar) adentro de la blockchain, de forma confiable y verificable."
                >oráculo</span
              >
              on-chain.
            </p>
          </div>
  `;

  #wired = false;

  // --- API explícita: atributos ↔ propiedades -------------------------------
  // El atributo ES el estado. Cada `set` escribe el atributo, y eso es lo que
  // dispara attributeChangedCallback → update(): no hay estado paralelo en JS.

  get amount() {
    return this.getAttribute("amount") ?? "";
  }
  set amount(v) {
    this.setAttribute("amount", String(v));
  }

  get ethPrice() {
    return Number(this.getAttribute("eth-price") || 0);
  }
  set ethPrice(v) {
    this.setAttribute("eth-price", String(v));
  }

  get minUsd() {
    return Number(this.getAttribute("min-usd") ?? 0.5);
  }
  set minUsd(v) {
    this.setAttribute("min-usd", String(v));
  }

  get status() {
    return this.getAttribute("status") ?? "idle";
  }
  set status(v) {
    this.setAttribute("status", v);
  }

  get message() {
    return this.getAttribute("message") ?? "";
  }
  set message(v) {
    this.setAttribute("message", v);
  }

  /**
   * ¿Esta donación es una demostración? La decide la PÁGINA que usa la tarjeta:
   * la landing la prende (ahí se simula, no se firma) y la página del link
   * (`/u/0x…`, donación real) la deja apagada. La tarjeta sólo lo muestra.
   * Atributo booleano (`demo`), default `false`: sin atributo no hay aviso.
   * Mismo patrón que `open` de la share-card y del modal.
   */
  get demo() {
    return this.getAttribute("demo") !== null;
  }
  set demo(v) {
    if (v) this.setAttribute("demo", "");
    else this.removeAttribute("demo");
  }

  /** A quién se le dona (mismas convenciones que `owner` del panel). */
  get recipient() {
    return this.getAttribute("recipient") ?? "";
  }
  set recipient(v) {
    this.setAttribute("recipient", String(v ?? ""));
  }

  /** La cuenta conectada que va a donar, si hay alguna (mismas convenciones
      que `viewer` del panel). */
  get viewer() {
    return this.getAttribute("viewer") ?? "";
  }
  set viewer(v) {
    this.setAttribute("viewer", String(v ?? ""));
  }

  /**
   * Opt-in de la fila de conexión: `false` por defecto, así la landing (que no
   * setea nada) queda con la tarjeta de siempre. Es un atributo booleano, como
   * `open` de la share-card.
   */
  get showConnect() {
    return this.getAttribute("show-connect") !== null;
  }
  set showConnect(v) {
    if (v) this.setAttribute("show-connect", "");
    else this.removeAttribute("show-connect");
  }

  /**
   * ¿Este visitante puede donar en esta página? Default `true` (el mismo
   * criterio opt-in de `recipient`/`showConnect`): la landing no setea nada y
   * la tarjeta se comporta igual que siempre. La página de donación lo pone en
   * `false` cuando la cuenta conectada es el dueño (el rol se deriva en
   * `viewer-role.js`: acá sólo se obedece).
   */
  get canDonate() {
    return this.getAttribute("can-donate") !== "false";
  }
  set canDonate(v) {
    this.setAttribute("can-donate", v === false ? "false" : "true");
  }

  /** Derivada: no es atributo propio, se calcula de amount × eth-price. */
  get usd() {
    return (Number(this.amount) || 0) * this.ethPrice;
  }

  /** Alias legible de `canDonate` para adentro del componente. */
  get #puedeDonar() {
    return this.canDonate;
  }

  get state() {
    const eth = Number(this.amount) || 0;
    const price = this.ethPrice;
    const minUsd = this.minUsd;
    const usd = this.usd;
    const status = this.status;

    const hasPrice = price > 0;
    const belowMin = hasPrice && eth > 0 && usd < minUsd;
    const minEth = hasPrice ? Math.ceil((minUsd / price) * 1e6) / 1e6 : 0;
    const canFund = hasPrice && eth > 0 && usd >= minUsd;
    const isBusy = status === "pending";
    // El bloqueo por rol es de la PÁGINA, no del monto: el dueño no se dona a sí
    // mismo, y eso se dice con el mismo texto que la landing.
    const blockedByRole = !this.canDonate;

    return {
      usdText: `≈ $${usd.toFixed(2)} USD`,
      hasPrice,
      noPrice: !hasPrice,
      belowMin,
      blockedByRole,
      // El motivo del bloqueo gana sobre el aviso del mínimo: si no se puede
      // donar, no importa cuánto se escriba en el monto.
      hintText: blockedByRole
        ? SELF_DONATION_MESSAGE
        : hasPrice
          ? `El mínimo es ${minUsd.toFixed(2)} USD ≈ ${minEth} ETH`
          : "",
      hintHidden: !(blockedByRole || belowMin),
      canFund,
      isBusy,
      isDisabled: !canFund || isBusy || blockedByRole,
      statusHidden: status === "idle",
      isSuccess: status === "success",
      isError: status === "error",
      isPending: status === "pending",
      statusText:
        this.message !== "" ? this.message : STATUS_TEXT[status] ?? "",
      // El aviso de demo depende de la página, no del módulo: la propiedad
      // `demo` (atributo booleano) se traduce a la clave que el marcador
      // `hidden:demoHidden` lee como cualquier otra.
      demoHidden: !this.demo,
      // Opt-in: sin `recipient` no hay línea, y sin `show-connect` no hay fila
      // de conexión; las dos nacen ocultas.
      recipientText: this.recipient
        ? `Le donás a ${shortAddress(this.recipient)}`
        : "",
      recipientHidden: this.recipient === "",
      connectHidden: !this.showConnect,
      viewerText: this.viewer
        ? `Donás desde ${shortAddress(this.viewer)}`
        : "",
      viewerHidden: !(this.showConnect && this.viewer !== ""),
      connectButtonHidden: !(this.showConnect && this.viewer === ""),
      // Cambiar de cuenta: sólo con una cuenta ya conectada. Es un botón de
      // texto (sin icono): el conteo de iconos de la isla es parte de lo
      // verificado y un icono nuevo acá lo rompería.
      switchHidden: this.viewer === "",
    };
  }

  render(state) {
    // El input se sincroniza sólo si el valor difiere: `data-attr="value:amount"`
    // pelearía con el cursor mientras el usuario tipea.
    const input = this.root.querySelector("#ehtAmount");
    if (input && input.value !== this.amount) input.value = this.amount;

    for (const chip of this.root.querySelectorAll(".chip")) {
      chip.classList.toggle(
        "is-active",
        state.hasPrice && Math.abs(this.usd - Number(chip.dataset.usd)) < 0.005
      );
    }
  }

  connectedCallback() {
    super.connectedCallback();
    if (this.#wired) return;
    this.#wired = true;

    this.root
      .querySelector("#ehtAmount")
      ?.addEventListener("input", (event) => {
        this.amount = event.target.value;
        this.emit("whiskito:amount-change", {
          amount: Number(this.amount) || 0,
          usd: this.usd,
        });
      });

    for (const chip of this.root.querySelectorAll(".chip")) {
      chip.addEventListener("click", () => {
        const price = this.ethPrice;
        if (!price) return;
        const usd = Number(chip.dataset.usd);
        // Redondeo hacia arriba a 6 decimales: nunca quedar por debajo del
        // mínimo on-chain por culpa del truncado.
        const eth = Math.ceil((usd / price) * 1e6) / 1e6;
        this.amount = String(eth);
        this.emit("whiskito:amount-change", { amount: eth, usd: eth * price });
      });
    }

    this.root.querySelector("#fundButton")?.addEventListener("click", () => {
      // La guarda del botón es la misma que la del estado: monto válido, sin
      // operación en curso y con permiso de rol (el dueño no se dona a sí mismo).
      if (this.state.isDisabled || !this.#puedeDonar) return;
      this.emit("whiskito:fund-request", {
        amount: Number(this.amount),
        usd: this.usd,
      });
    });

    // Conectar la wallet sin navbar: mismo evento que emiten el navbar y la
    // share-card, que burbujea y cruza el shadow root hasta el documento.
    this.root.querySelector("#connectWallet")?.addEventListener("click", () => {
      this.emit("whiskito:connect-request");
    });

    // Cambiar de cuenta desde la tarjeta: la wallet abre su selector. La
    // decisión (y el estado) son del flujo, no de la isla.
    this.root.querySelector("#switchWallet")?.addEventListener("click", () => {
      if (this.viewer === "") return;
      this.emit("whiskito:switch-account-request");
    });
  }
}
