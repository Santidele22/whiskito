import { WhiskitoElement } from "./base-element.js";
// El icono del control de volver se hidrata cuando se monta (ver `render()`):
// se usa el mismo hidratador de siempre —el que ya usa la base—, no el barril.
import { hydrateIcons } from "../js/dom/icons.js";

/** Texto del botón según el estado de conexión. */
const LABELS = {
  disconnected: "Conectar Wallet",
  connecting: "Conectando…",
  connected: "Conectado",
  unsupported: "Sin wallet detectada",
};

export class WhiskitoNavbar extends WhiskitoElement {
  static observedAttributes = ["state", "address", "base"];

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

    /* El display propio de .btn (inline-flex) le gana al [hidden] del
       navegador: el botón de conectar se oculta en una página aparte, así que
       hay que reponer el ocultado o se vería igual. */
    .btn[hidden] {
      display: none;
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

    /* Volver al inicio: el control de una página APARTE (con base), no de la
       landing. Es un enlace de navegación —va a la landing, no dispara nada—,
       con el look de cartel de "Desconectar". */
    .nav-back {
      display: inline-flex;
      align-items: center;
      gap: 8px;
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
      text-decoration: none;
      cursor: pointer;
      transition: color 0.15s, border-color 0.15s;
    }

    .nav-back:hover {
      color: var(--blues-red);
      border-color: var(--blues-red);
    }

    /* El display propio le gana al [hidden] del navegador: en la landing el
       control no existe y tiene que quedar oculto de verdad. */
    .nav-back[hidden] {
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
      .nav-back {
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
        <li><a href="#donar" data-attr="href:donarHref">Donar</a></li>
        <li><a href="#como-funciona" data-attr="href:comoFuncionaHref">Cómo funciona</a></li>
        <li><a href="#panel" data-attr="href:panelHref">Resumen</a></li>
        <li><a href="#faq" data-attr="href:faqHref">Preguntas</a></li>
      </ul>
      <div class="nav-actions">
        <!-- Volver al inicio: el control de una página APARTE. Con base vacía
             (la landing) queda oculto y el navbar es exactamente el de siempre.
             Va acá y NO dentro de .nav-links: los cuatro links de la landing
             tienen que seguir siendo los mismos cuatro (y en ese orden).
             Sin href en el template: lo escribe el pintado con la base del
             sitio (backHref), que en la landing es vacío. -->
        <a
          id="backHome"
          class="nav-back"
          hidden
          data-attr="hidden:backHidden; href:backHref"
        >
          Volver al inicio
        </a>
        <!-- El icono de ese control, en un <template>: sus nodos NO están en el
             árbol, así que hydrateIcons —que corre al montar sobre el shadow
             root— no lo convierte en SVG en la LANDING, donde el control no
             existe (si estuviera suelto en el template, el navbar pasaría de 4
             iconos a 5 en su modo por defecto). Se clona y se hidrata sólo
             cuando el control se muestra (ver render()). -->
        <template data-back-icon
          ><i data-lucide="arrow-left" aria-hidden="true"></i
        ></template>
        <button
          id="connectButton"
          class="btn btn-primary btn-nav"
          data-attr="hidden:connectHidden; disabled:isBusy; title:title"
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
          data-attr="hidden:switchHidden; disabled:isBusy"
        >
          Cambiar cuenta
        </button>
        <button
          id="disconnectButton"
          class="nav-disconnect"
          type="button"
          title="Desconectar la wallet"
          data-attr="hidden:disconnectHidden; disabled:isBusy"
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

  /**
   * Base del sitio donde vive la landing. **Vacía (o ausente) = la LANDING**,
   * que es el modo por defecto y el de siempre. Con una base, el navbar es el de
   * una página APARTE (`/historial`): los cuatro links apuntan a la landing con
   * su ancla y aparece el control de volver al inicio.
   *
   * Las barras finales se recortan acá —una sola vez, para todos los links— para
   * no producir `…//#donar`.
   */
  get base() {
    return (this.getAttribute("base") ?? "").replace(/\/+$/, "");
  }
  set base(v) {
    this.setAttribute("base", String(v ?? ""));
  }

  /** Valores a pintar (hook de pintado de la base). */
  get state() {
    const { connectionState, account, base } = this;
    const isConnected = connectionState === "connected" && account !== "";
    /**
     * ¿El navbar está FUERA de la landing? (`base` no vacía.)
     *
     * En ese modo: los links llevan a la landing con su ancla, aparece el control
     * de volver y los controles de wallet se ocultan. Se ocultan porque en una
     * página aparte no hay landing a la que scrollear, y porque esa página ya
     * ofrece conectar la wallet cuando le falta la dirección.
     */
    const standalone = base !== "";
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
      // Las anclas: en la landing son las de siempre (`#donar`, …); con base,
      // la landing MÁS su ancla.
      donarHref: `${base}#donar`,
      comoFuncionaHref: `${base}#como-funciona`,
      panelHref: `${base}#panel`,
      faqHref: `${base}#faq`,
      // El control de volver apunta a la base PELADA (el inicio, sin ancla).
      backHref: standalone ? base : "",
      backHidden: !standalone,
      /**
       * UNA clave por elemento, no dos pares `hidden:`.
       *
       * El bucle de `data-attr` de la base procesa los pares EN ORDEN y el último
       * gana: `hidden:notConnected; hidden:standalone` haría que el segundo
       * `removeAttribute("hidden")` borre lo que puso el primero. Por eso el modo
       * y el estado de conexión se combinan acá: en la landing (`standalone`
       * falso) el resultado es EXACTAMENTE el de siempre.
       *
       * Las cuatro claves son las mismas de antes de que existiera "Mi Panel":
       * conectar es el único control que no depende de la conexión, y los tres de
       * wallet (cambiar cuenta, desconectar y —cuando existía— el panel) siguen
       * pidiendo las dos cosas: estar en la landing y tener cuenta.
       */
      connectHidden: standalone,
      switchHidden: standalone || !isConnected,
      disconnectHidden: standalone || !isConnected,
    };
  }

  /**
   * El icono del control de volver se monta recién cuando el control se muestra.
   *
   * Por qué no está suelto en el template: el template se hidrata ENTERO al
   * montar (`hydrateIcons` corre sobre el shadow root), así que un
   * `<i data-lucide>` suelto se convertiría en SVG también en la LANDING —donde
   * el control no existe— y el navbar pasaría de 4 iconos a 5 en su modo por
   * defecto. Por eso el marcador vive en un `<template data-back-icon>` (cuyos
   * nodos no están en el árbol y por lo tanto no se hidratan) y recién acá se
   * clona y se hidrata, en su propio nodo y fuera de cualquier `data-text` (que
   * `update()` pinta con `textContent` y borraría un SVG adentro).
   */
  render(state) {
    const link = this.root.querySelector("#backHome");
    const iconTemplate = this.root.querySelector("template[data-back-icon]");
    if (!link || !iconTemplate) return;
    const icon = link.querySelector("svg, i[data-lucide]");
    if (state.backHidden) {
      // Sin control no hay icono: el modo por defecto queda igual que siempre.
      icon?.remove();
      return;
    }
    if (icon) return;
    const node = iconTemplate.content.cloneNode(true);
    hydrateIcons(node);
    link.prepend(node);
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
