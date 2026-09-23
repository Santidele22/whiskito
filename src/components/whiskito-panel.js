import { WhiskitoElement } from "./base-element.js";
import { isOwner } from "../js/viewer-role.js";

/** Texto por defecto de la retirada, según su estado. */
const WITHDRAW_LABELS = {
  pending: "Retirando…",
  success: "¡Retirado!",
  error: "No se pudo retirar",
  idle: "",
};

export class WhiskitoPanel extends WhiskitoElement {
  static observedAttributes = [
    "balance-eth",
    "balance-usd",
    "owner",
    "viewer",
    "withdraw-status",
    "withdraw-message",
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
       frontera del shadow root, así que la regla vive también acá. Los
       marcadores data-lucide se hidratan a un gráfico de 1em que dibuja con
       currentColor: hereda el font-size y el color del slot. */
    .icon {
      width: 1em;
      height: 1em;
      flex: none;
      vertical-align: -0.15em;
    }

    /* El eyebrow del cartel: ★ a los costados, como el resto del sistema. */
    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      font-family: var(--cond);
      font-weight: 700;
      font-size: 0.85rem;
      letter-spacing: 4px;
      text-transform: uppercase;
      color: var(--blues-red);
      margin-bottom: 14px;
    }

    .eyebrow::before,
    .eyebrow::after {
      content: '★';
      font-size: 0.7rem;
    }

    /* La banda de tinta: ocupa todo el ancho de la vista y el contenedor de
       adentro (.panel-split) es el que se centra en 1200px. */
    .backstage {
      background: var(--ink);
      color: var(--paper);
      border-top: 3px solid var(--ink);
    }

    .backstage .eyebrow {
      color: var(--mustard);
    }

    .panel-split {
      max-width: 1200px;
      margin: 0 auto;
      padding: 96px 32px;
      display: grid;
      grid-template-columns: 0.9fr 1.1fr;
      gap: 64px;
      align-items: center;
    }

    .panel-copy h2 {
      font-family: var(--display);
      font-size: clamp(2.2rem, 5vw, 3.4rem);
      text-transform: uppercase;
      line-height: 0.98;
      margin-bottom: 16px;
    }

    .panel-copy > p {
      color: #b3a48d;
      margin-bottom: 28px;
      font-size: 1.08rem;
    }

    /* De quién es el panel: sólo se ve cuando NO es tuyo. La dirección va en
       mostaza, como el sello de la banda. */
    p.panel-owner {
      font-family: var(--cond);
      font-size: 0.85rem;
      color: var(--mustard);
      word-break: break-all;
    }

    p.panel-owner[hidden] {
      display: none;
    }

    .panel-points {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 18px;
      margin-bottom: 32px;
    }

    .panel-points li {
      display: flex;
      gap: 16px;
      align-items: flex-start;
    }

    .panel-points .pp-icon {
      font-size: 1.4rem;
      flex-shrink: 0;
    }

    .panel-points b {
      color: var(--paper);
      font-family: var(--cond);
      font-weight: 700;
      font-size: 1.15rem;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }

    .panel-points span.d {
      color: #b3a48d;
      font-size: 0.95rem;
      display: block;
    }

    .panel-note {
      display: flex;
      gap: 16px;
      background: rgba(242, 232, 213, 0.07);
      border: 2px dashed var(--mustard);
      border-radius: 6px;
      padding: 20px 24px;
      font-size: 0.95rem;
      color: #cfc2ab;
    }

    .panel-note b {
      color: var(--mustard);
    }

    /* ---------- Botones: tinta con sombra dura ---------- */
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

    .btn-block {
      width: 100%;
    }

    /* El botón de retirar se oculta con [hidden]: el display del .btn gana la
       pulseada contra el [hidden] del navegador, así que hay que declararlo. */
    #withdrawButton[hidden] {
      display: none;
    }

    /* ---------- El recibo de barra ---------- */
    .receipt {
      position: relative;
      background: var(--paper);
      color: var(--ink);
      border-radius: 4px;
      padding: 36px 32px;
      font-family: 'Courier New', monospace;
      box-shadow: 10px 10px 0 var(--cobalt), 10px 10px 0 2px rgba(242, 232, 213, 0.15);
      transform: rotate(1.2deg);
    }

    /* Bordes dentados de recibo */
    .receipt::before,
    .receipt::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      height: 12px;
      background:
        linear-gradient(135deg, var(--ink) 25%, transparent 25%) -6px 0 / 12px 12px,
        linear-gradient(225deg, var(--ink) 25%, transparent 25%) -6px 0 / 12px 12px;
    }

    .receipt::before {
      top: -12px;
    }

    .receipt::after {
      bottom: -12px;
      transform: scaleY(-1);
    }

    .receipt-head {
      text-align: center;
      font-family: var(--cond);
      font-weight: 700;
      letter-spacing: 4px;
      text-transform: uppercase;
      font-size: 0.9rem;
      padding-bottom: 16px;
      border-bottom: 2px dashed var(--ink);
      margin-bottom: 20px;
    }

    .receipt-head .pd-badge {
      display: inline-block;
      font-size: 0.72rem;
      background: var(--cobalt);
      color: var(--paper);
      padding: 3px 12px;
      border-radius: 3px;
      margin-top: 8px;
      letter-spacing: 2px;
    }

    .r-balance-label {
      font-size: 0.8rem;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--stamp);
      margin-bottom: 6px;
    }

    .receipt-balance {
      font-size: 3rem;
      font-weight: 700;
      line-height: 1;
      display: flex;
      align-items: baseline;
      gap: 10px;
    }

    .receipt-balance .balance-unit {
      font-size: 1.1rem;
      color: var(--blues-red);
    }

    .r-usd {
      color: var(--stamp);
      margin: 10px 0 22px;
      font-size: 0.95rem;
    }

    .r-history-title {
      font-size: 0.8rem;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--stamp);
      padding-top: 18px;
      border-top: 2px dashed var(--ink);
      margin-bottom: 14px;
    }

    .r-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      padding: 10px 0;
      border-bottom: 1px dotted rgba(28, 21, 18, 0.3);
      font-size: 0.9rem;
    }

    .r-item code {
      font-size: 0.85rem;
    }

    .r-item .amt {
      font-weight: 700;
      color: var(--success);
    }

    .r-item .amt small {
      font-weight: 400;
      color: var(--stamp);
    }

    .r-item .when {
      font-size: 0.78rem;
      color: var(--stamp);
    }

    /* Barra sin whiskitos todavía */
    p.r-empty {
      color: var(--stamp);
      font-size: 0.9rem;
      font-style: italic;
    }

    .receipt-actions {
      margin-top: 24px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .receipt-actions .btn {
      font-family: var(--cond);
    }

    /* Estado de la retirada: lo pinta la isla con is-error / is-success. */
    p.withdraw-status {
      font-family: var(--cond);
      text-align: center;
      margin-top: 10px;
    }

    p.withdraw-status.is-error {
      color: var(--blues-red);
    }

    p.withdraw-status.is-success {
      color: var(--success);
    }

    p.withdraw-status[hidden] {
      display: none;
    }

    .r-foot {
      text-align: center;
      margin-top: 20px;
      padding-top: 14px;
      border-top: 2px dashed var(--ink);
      font-size: 0.78rem;
      color: var(--stamp);
      letter-spacing: 1px;
    }

    @media (max-width: 980px) {
      .panel-split {
        grid-template-columns: 1fr;
        gap: 48px;
        padding: 72px 24px;
      }

      .receipt {
        transform: none;
        max-width: 440px;
        margin: 0 auto;
      }
    }

    @media (max-width: 768px) {
      .receipt-balance {
        font-size: 2.4rem;
      }
    }
  `;

  static template = /* html */ `
    <!-- ============================================================
     3. EL BACKSTAGE — la banda de tinta con el recibo de barra
     ============================================================ -->
    <section class="backstage">
      <div class="panel-split">
        <div class="panel-copy">
          <span class="eyebrow">02 · El backstage</span>
          <h2>Tu backstage, tus fondos, tu control</h2>
          <p
            class="panel-owner"
            id="panelOwner"
            data-text="ownerLabel"
            data-attr="hidden:noOwner"
          ></p>
          <p>
            Conectás tu wallet y aparece tu barra personal. Solo ves lo tuyo:
          </p>

          <ul class="panel-points">
            <li>
              <span class="pp-icon"><i data-lucide="coins"></i></span>
              <div>
                <b>Cuánto te donaron en total</b>
                <span class="d"
                  >El acumulado de todas las rondas que te invitaron.</span
                >
              </div>
            </li>
            <li>
              <span class="pp-icon"><i data-lucide="scroll-text"></i></span>
              <div>
                <b>Quién te invitó, y cuándo</b>
                <span class="d"
                  >Historial completo con montos y sus equivalentes en
                  dólares.</span
                >
              </div>
            </li>
            <li>
              <span class="pp-icon"><i data-lucide="banknote"></i></span>
              <div>
                <b>Cuánto tenés disponible ahora mismo</b>
                <span class="d"
                  >Listo para retirar, total o parcialmente, cuando se te
                  cante.</span
                >
              </div>
            </li>
          </ul>

          <div class="panel-note">
            <span><i data-lucide="shield-check"></i></span>
            <p>
              <b>Privado para operar, público para verificar.</b>
              Retirar solo puede hacerlo el dueño de la wallet. Que los datos
              sean públicos en la blockchain (cualquiera puede auditarlos) no
              significa que alguien más pueda mover tus fondos. Tus whiskitos,
              tus reglas.
            </p>
          </div>
        </div>

        <!-- El recibo de barra: la única parte del panel con datos vivos. -->
        <div class="receipt">
          <div class="receipt-head">
            <i data-lucide="glass-water"></i> Whiskito · Barra
            <span class="pd-badge">vista previa</span>
          </div>

          <p class="r-balance-label">Balance disponible</p>
          <p class="receipt-balance">
            <span id="balanceDisplay" data-text="balanceEth">0.0842</span>
            <span class="balance-unit">ETH</span>
          </p>
          <p class="r-usd" id="balanceUsd" data-text="balanceUsd">≈ $269.44 USD</p>

          <p class="r-history-title">Últimas rondas recibidas</p>

          <div id="donationsList"></div>

          <p class="r-empty" data-attr="hidden:hasDonations">
            Todavía no te invitaron ningún whiskito
          </p>

          <div class="receipt-actions">
            <button
              id="withdrawButton"
              class="btn btn-primary btn-block"
              type="button"
              data-attr="hidden:notOwner; disabled:cannotWithdraw"
            >
              <i data-lucide="banknote"></i> Retirar todo
            </button>

            <p
              class="withdraw-status"
              id="withdrawStatus"
              data-text="withdrawText"
              data-attr="hidden:withdrawStatusHidden"
              data-class="is-error:isWithdrawError; is-success:isWithdrawSuccess"
            ></p>
          </div>

          <p class="r-foot">
            Whiskito · recibo de barra · verificable en Etherscan
          </p>

          <template data-item>
            <div class="r-item">
              <code data-field="address"></code>
              <span class="amt"
                >+<span data-field="eth"></span> ETH
                <small>≈ $<span data-field="usd"></span></small></span
              >
              <span class="when" data-field="when"></span>
            </div>
          </template>
        </div>
      </div>
    </section>
  `;

  #donations = [];
  #wired = false;

  /** Balance en ETH, como texto. */
  get balanceEth() {
    return this.getAttribute("balance-eth") ?? "0";
  }
  set balanceEth(v) {
    this.setAttribute("balance-eth", String(v));
  }

  /** Balance en USD, como texto. */
  get balanceUsd() {
    return this.getAttribute("balance-usd") ?? "0.00";
  }
  set balanceUsd(v) {
    this.setAttribute("balance-usd", String(v));
  }

  /** Dueño de la página (el que recibe). Vacío = todavía no hay dueño. */
  get owner() {
    return this.getAttribute("owner") ?? "";
  }
  set owner(v) {
    this.setAttribute("owner", v);
  }

  /** Quien está mirando: la cuenta conectada, o vacío si no hay wallet. */
  get viewer() {
    return this.getAttribute("viewer") ?? "";
  }
  set viewer(v) {
    this.setAttribute("viewer", v);
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

  /** Donaciones recibidas: array de `{ address, eth, usd, when }`. */
  get donations() {
    return this.#donations;
  }
  set donations(list) {
    this.#donations = Array.isArray(list) ? list : [];
    this.update(); // a mano: no es un atributo
  }

  /** El `owner` acortado: 6 primeros + `...` + 4 últimos. */
  get #ownerShort() {
    return this.owner ? `${this.owner.slice(0, 6)}...${this.owner.slice(-4)}` : "";
  }

  /** Valores a pintar (hook de pintado de la base). */
  get state() {
    const isOwnerViewer = isOwner(this.viewer, this.owner);
    const hasBalance = Number(this.balanceEth) > 0;
    const { withdrawStatus, withdrawMessage } = this;
    const ownerShort = this.#ownerShort;
    return {
      balanceEth: this.balanceEth,
      balanceUsd: `≈ $${this.balanceUsd} USD`,
      hasDonations: this.donations.length > 0,
      isOwner: isOwnerViewer,
      notOwner: !isOwnerViewer,
      ownerShort,
      ownerLabel: ownerShort ? `Panel de ${ownerShort}` : "",
      // Sin dueño conocido (landing sin `?u=`) la línea va vacía: si no, un <p>
      // vacío igual ocupa una línea y corre el layout del panel.
      noOwner: !ownerShort,
      hasBalance,
      cannotWithdraw: !(isOwnerViewer && hasBalance),
      withdrawStatusHidden: withdrawStatus === "idle",
      isWithdrawPending: withdrawStatus === "pending",
      isWithdrawSuccess: withdrawStatus === "success",
      isWithdrawError: withdrawStatus === "error",
      withdrawText: withdrawMessage !== "" ? withdrawMessage : WITHDRAW_LABELS[withdrawStatus] ?? "",
    };
  }

  /** Pinta la lista de donaciones: lo que los marcadores no cubren. */
  render(state) {
    const list = this.root.querySelector("#donationsList");
    const itemTemplate = this.root.querySelector("template[data-item]");
    if (!list || !itemTemplate) return;

    const rows = this.donations.map((donation) => {
      const row = itemTemplate.content.firstElementChild.cloneNode(true);
      for (const field of row.querySelectorAll("[data-field]")) {
        field.textContent = donation[field.dataset.field] ?? "";
      }
      return row;
    });

    list.replaceChildren(...rows);
  }

  connectedCallback() {
    super.connectedCallback();
    if (this.#wired) return;
    this.#wired = true;
    this.root.querySelector("#withdrawButton")?.addEventListener("click", () => {
      // La política la decide quien escucha: acá sólo se avisa, igual que en el
      // navbar. Deshabilitado no se emite nada (el botón ya está oculto si no
      // sos el dueño).
      if (this.state.cannotWithdraw) return;
      this.emit("whiskito:withdraw-request");
    });
  }
}
