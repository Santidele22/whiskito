import { WhiskitoElement } from "./base-element.js";

/** Texto del botón según el estado de conexión. */
const LABELS = {
  disconnected: "Conectar Wallet",
  connecting: "Conectando…",
  connected: "Conectado",
  unsupported: "Sin wallet detectada",
};

export class WhiskitoNavbar extends WhiskitoElement {
  static observedAttributes = ["state", "address"];

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

    /* El display de autor le gana al [hidden] del navegador: el botón de
       conectar alterna sus dos iconos con los marcadores data-attr, así que
       hace falta reponer el ocultado. */
    .icon[hidden] {
      display: none;
    }

    /* Botones del sistema Blues Poster '62: copiados literales de styles.css
       (mismos valores, mismo orden). Las custom properties de :root sí cruzan
       la frontera del shadow root. */
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

    .btn-nav {
      padding: 9px 18px;
      font-size: 1rem;
    }

    /* Pegajoso sobre el papel: el navbar es la cabecera del cartel. */
    .navbar {
      position: sticky;
      top: 0;
      z-index: 100;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      padding: 14px 32px;
      background: var(--paper);
      border-bottom: 3px solid var(--ink);
    }

    .nav-logo {
      display: flex;
      align-items: center;
      gap: 10px;
      font-family: var(--display);
      font-size: 1.5rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--ink);
      text-decoration: none;
    }

    .logo-icon {
      font-size: 1.9rem;
    }

    .nav-links {
      display: flex;
      list-style: none;
      gap: 26px;
    }

    .nav-links a {
      font-family: var(--cond);
      font-weight: 700;
      font-size: 1.05rem;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: var(--ink);
      text-decoration: none;
      border-bottom: 3px solid transparent;
      padding-bottom: 2px;
      transition: border-color 0.15s, color 0.15s;
    }

    .nav-links a:hover {
      color: var(--blues-red);
      border-bottom-color: var(--blues-red);
    }

    /* Estado de conexión: la isla del navbar muestra la dirección acortada */
    .nav-account {
      display: inline-flex;
      align-items: center;
    }

    .nav-account[hidden] {
      display: none;
    }

    /* La dirección vive dentro del botón rojo: se pinta sobre el papel. */
    .nav-account code {
      font-family: 'Courier New', monospace;
      font-weight: 700;
      font-size: 0.8rem;
      color: var(--paper);
      opacity: 0.9;
    }

    /* Agrupación de los botones de conexión: mantiene el flex del .navbar en
       tres columnas (logo · links · acciones) aunque haya uno o dos botones. */
    .nav-actions {
      display: inline-flex;
      align-items: center;
      gap: 10px;
    }

    /* Desconectar: sólo con la wallet conectada. Look de cartel: fondo
       transparente, borde de tinta y tipografía condensada en mayúsculas. */
    .nav-disconnect {
      padding: 9px 18px;
      font-family: var(--cond);
      font-weight: 700;
      font-size: 1rem;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: var(--ink);
      background: transparent;
      border: 2px solid var(--ink);
      border-radius: 4px;
      cursor: pointer;
      transition: color 0.15s, border-color 0.15s;
    }

    .nav-disconnect:hover:not(:disabled) {
      color: var(--blues-red);
      border-color: var(--blues-red);
    }

    .nav-disconnect:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .nav-disconnect[hidden] {
      display: none;
    }

    /* Mi Panel: mismo look de cartel que "Desconectar", con el acento mostaza.
       Sólo existe con la wallet conectada. */
    .nav-dashboard {
      padding: 9px 18px;
      font-family: var(--cond);
      font-weight: 700;
      font-size: 1rem;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: var(--mustard);
      background: transparent;
      border: 2px solid var(--ink);
      border-radius: 4px;
      cursor: pointer;
      transition: color 0.15s, border-color 0.15s;
    }

    .nav-dashboard:hover {
      color: var(--blues-red);
      border-color: var(--blues-red);
    }

    /* El display propio le gana al [hidden] del navegador: sin esto el botón
       se vería también sin wallet. */
    .nav-dashboard[hidden] {
      display: none;
    }

    @media (max-width: 768px) {
      .nav-links {
        display: none;
      }
      .navbar {
        padding: 12px 20px;
      }
      .nav-disconnect {
        padding: 9px 12px;
        font-size: 0.8rem;
      }
      .nav-dashboard {
        padding: 9px 12px;
        font-size: 0.8rem;
      }
    }
  `;

  static template = /* html */ `
    <!-- ========== NAVBAR ========== -->
    <nav class="navbar">
      <div class="nav-logo">
        <span class="logo-icon" data-lucide="glass-water"></span>
        <span class="logo-text">Whiskito</span>
      </div>
      <ul class="nav-links">
        <li><a href="#donar">Donar</a></li>
        <li><a href="#como-funciona">Cómo funciona</a></li>
        <li><a href="#panel">Resumen</a></li>
        <li><a href="#faq">Preguntas</a></li>
      </ul>
      <div class="nav-actions">
        <button
          id="dashboardButton"
          class="nav-dashboard"
          type="button"
          title="Ver todas las donaciones que recibiste"
          data-attr="hidden:notConnected"
        >
          <i data-lucide="receipt"></i> Mi Panel
        </button>
        <button
          id="connectButton"
          class="btn btn-primary btn-nav"
          data-attr="disabled:isBusy; title:title"
        >
          <i data-lucide="wallet" data-attr="hidden:isConnected"></i>
          <i data-lucide="circle-check" data-attr="hidden:notConnected"></i>
          <span data-text="label"></span>
          <span class="nav-account" data-attr="hidden:notConnected"
            ><code data-text="shortAddress"></code
          ></span>
        </button>
        <button
          id="switchButton"
          class="nav-disconnect"
          type="button"
          title="Elegir otra cuenta en la wallet"
          data-attr="hidden:notConnected; disabled:isBusy"
        >
          Cambiar cuenta
        </button>
        <button
          id="disconnectButton"
          class="nav-disconnect"
          type="button"
          title="Desconectar la wallet"
          data-attr="hidden:notConnected; disabled:isBusy"
        >
          Desconectar
        </button>
      </div>
    </nav>
  `;

  #wired = false;

  /** Estado de conexión: valor del atributo `state`. */
  get connectionState() {
    return this.getAttribute("state") ?? "disconnected";
  }
  set connectionState(v) {
    this.setAttribute("state", v);
  }

  /** Dirección de la cuenta conectada: valor del atributo `address`. */
  get account() {
    return this.getAttribute("address") ?? "";
  }
  set account(v) {
    this.setAttribute("address", v);
  }

  /** Valores a pintar (hook de pintado de la base). */
  get state() {
    const { connectionState, account } = this;
    const isConnected = connectionState === "connected" && account !== "";
    return {
      label: LABELS[connectionState] ?? LABELS.disconnected,
      isBusy: connectionState === "connecting",
      isConnected,
      notConnected: !isConnected,
      shortAddress: account
        ? `${account.slice(0, 6)}...${account.slice(-4)}`
        : "",
      title:
        connectionState === "unsupported"
          ? "No detectamos una wallet en este navegador"
          : "",
    };
  }

  connectedCallback() {
    super.connectedCallback();
    if (this.#wired) return;
    this.#wired = true;
    this.root.querySelector("#connectButton")?.addEventListener("click", () => {
      // La política la decide quien escucha: el navbar no sabe si hay wallet.
      // Ya conectado no vuelve a pedir conexión: eso lo maneja "Desconectar".
      if (this.state.isBusy || this.state.isConnected) return;
      this.emit("whiskito:connect-request");
    });
    this.root.querySelector("#dashboardButton")?.addEventListener("click", () => {
      // Mi Panel existe sólo con la wallet conectada: sin conexión no hay
      // dirección de la que mostrar donaciones.
      if (!this.state.isConnected) return;
      this.emit("whiskito:dashboard-request");
    });
    this.root.querySelector("#switchButton")?.addEventListener("click", () => {
      // Cambiar de cuenta es cosa de la wallet (abre su selector): la política
      // la decide quien escucha, acá sólo se avisa.
      if (this.state.isBusy || !this.state.isConnected) return;
      this.emit("whiskito:switch-account-request");
    });
    this.root.querySelector("#disconnectButton")?.addEventListener("click", () => {
      if (this.state.isBusy) return;
      this.emit("whiskito:disconnect-request");
    });
  }
}
