import { WhiskitoElement } from "./base-element.js";

/**
 * El pie del cartel. Es **light DOM** (no declara `static styles`), así que su
 * markup lo estiliza la hoja global.
 *
 * El link al explorador NO está hardcodeado: el flujo (`app.js`) le pasa por
 * `islands.setExplorer()` el explorador y el contrato de la red efectiva, y acá
 * se pintan con marcadores. En una red sin explorador (anvil) el `<a>` queda
 * `hidden` en vez de apuntar a `#`, que sería un link muerto.
 *
 * La propiedad y su estado se llaman `explorer*` a propósito: el explorador es
 * un dato de la RED, no de la moneda, y el vocabulario del flujo ya es ése
 * (`showTxModal({ …, explorer })`).
 *
 * OJO con los marcadores: el `data-text` va en un `<span>` y NO en el `<a>`,
 * porque `update()` pinta con `textContent` y se lleva TODO el contenido del
 * elemento. Con el marcador en el `<a>`, el icono (que es un hijo suyo) se
 * borraba en el primer `update()` y quedaban 15 iconos en vez de 16.
 */
export class WhiskitoFooter extends WhiskitoElement {
  static observedAttributes = ["explorer", "fund"];

  /** Base del explorador de la red (`""` = la red no tiene uno). */
  get explorer() {
    return this.getAttribute("explorer") ?? "";
  }

  set explorer(value) {
    this.setAttribute("explorer", String(value ?? ""));
  }

  /** Dirección del contrato en esa red; sin ella no hay nada que enlazar. */
  get fund() {
    return this.getAttribute("fund") ?? "";
  }

  set fund(value) {
    this.setAttribute("fund", String(value ?? ""));
  }

  get state() {
    const hayLink = this.explorer !== "" && this.fund !== "";
    return {
      explorerLabel: "Ver el contrato en el explorador",
      explorerHref: hayLink ? `${this.explorer}/address/${this.fund}` : "",
      explorerHidden: !hayLink,
    };
  }

  static template = /* html */ `
    <!-- ============================================================
     6. FOOTER — PIE DE CARTEL
     ============================================================ -->
    <footer class="footer">
      <div class="footer-inner">
        <div class="footer-brand">
          <div class="footer-logo"><i data-lucide="glass-water"></i> Whiskito</div>
          <p class="footer-tagline">
            Hecho con POL y buen rollito. No hay plataforma que se quede con tu
            whiskito: el apoyo va directo de wallet a wallet.
          </p>
        </div>
        <nav class="footer-links">
          <a href="#donar">Donar</a>
          <a href="#como-funciona">Cómo funciona</a>
          <a href="#panel">Mi Panel</a>
          <a href="#faq">Preguntas frecuentes</a>
          <a
            class="footer-explorer"
            target="_blank"
            rel="noopener"
            data-attr="hidden:explorerHidden; href:explorerHref"
            ><span data-text="explorerLabel"></span
            ><i data-lucide="arrow-up-right"></i
          ></a>
        </nav>
      </div>

      <p class="footer-warning">
        <i data-lucide="triangle-alert"></i> <b>Importante:</b> las donaciones en cripto son irreversibles. Una
        vez confirmada, una ronda no se puede recuperar. Doná con cabeza,
        whiskitero.
      </p>

      <p class="footer-copy">
        Whiskito · Donaciones en POL para profesionales independientes · El
        contrato es público y auditable por cualquiera
      </p>
    </footer>
  `;
}
