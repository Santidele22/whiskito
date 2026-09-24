import { WhiskitoElement } from "./base-element.js";

/**
 * Isla "Saludo del profesional": la banda que abre la vista del profesional,
 * arriba de la tabla del historial.
 *
 * Reemplaza al viejo bloque-CTA `whiskito-pro-history`: la vista del profesional
 * ya no ofrece la puerta a `/historial` (la tabla se muestra INLINE, montada por
 * el router debajo de este saludo), así que acá sólo queda el encabezado de esa
 * vista: el saludo, de quién es la barra y qué es lo que viene abajo.
 *
 * API por propiedades, con el mismo estilo del panel y de la tabla del historial
 * (el atributo ES el estado):
 *   address  la cuenta conectada, de la que es el historial de abajo. Sin ella
 *            se muestra el saludo igual, pero SIN la línea de la cuenta: no se
 *            inventan datos (ni una dirección de ejemplo ni un "conectá tu
 *            wallet": en la vista del profesional siempre hay una cuenta).
 *
 * No muestra balance a propósito: el balance (a diferencia de las donaciones) SÍ
 * cambia con un retiro, y el retiro sale de la tabla del historial, que es la que
 * lo muestra y la que lo refresca. Un balance acá quedaría viejo (y sería una
 * segunda copia del mismo dato).
 *
 * Es una isla con shadow root: el reset global y los `@keyframes` no cruzan la
 * frontera, así que cada uno va declarado acá adentro.
 */

/** Máximo de caracteres de la dirección que se muestran (6 + … + 4). */
const ADDRESS_HEAD = 6;
const ADDRESS_TAIL = 4;

export class WhiskitoProGreeting extends WhiskitoElement {
  static observedAttributes = ["address"];

  static styles = /* css */ `
    /* El reset universal de styles.css no cruza la frontera del shadow root: se
       copia acá (y sigue en el global) para que margin, padding y box-sizing
       queden iguales al resto del sistema. */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    /* La isla sí genera caja: es una banda del flujo, como el panel. */
    :host {
      display: block;
    }

    /* Nuestro CSS no puede ganarle al display:none que trae [hidden]. */
    [hidden] {
      display: none !important;
    }

    /* La banda de tinta, como la del panel: es el mismo backstage.
       En la vista del profesional el fondo de la PÁGINA ya es var(--ink), así que
       esta banda no agrega un segundo color (es el mismo token, literal). Eso es
       a propósito: la banda tiene que seguir siendo tinta aunque algún día se
       monte en otro fondo —no depende de quién la contenga—, y el pedido de "un
       solo color de fondo" se cumple por identidad de color, no apagando la
       regla. Por lo mismo el border-top (que era el filo de la banda contra el
       papel de la landing) es del mismo color: acá no hay filo que marcar. */
    .greeting {
      background: var(--ink);
      color: var(--paper);
      border-top: 3px solid var(--ink);
    }

    .greeting-inner {
      max-width: 1200px;
      margin: 0 auto;
      padding: 72px 32px 40px;
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
      color: var(--mustard);
      margin-bottom: 14px;
    }

    .eyebrow::before,
    .eyebrow::after {
      content: '★';
      font-size: 0.7rem;
    }

    .greeting-title {
      font-family: var(--display);
      font-size: clamp(2rem, 4.5vw, 3rem);
      text-transform: uppercase;
      line-height: 0.98;
      margin-bottom: 12px;
    }

    .greeting-help {
      color: #b3a48d;
      font-size: 1.08rem;
    }

    /* De quién es la barra: en mostaza, como el sello del panel. */
    .greeting-address {
      font-family: 'Courier New', monospace;
      font-weight: 700;
      font-size: 0.9rem;
      color: var(--mustard);
      word-break: break-all;
      margin-top: 14px;
    }

    @media (max-width: 768px) {
      .greeting-inner {
        padding: 56px 24px 32px;
      }
    }
  `;

  static template = /* html */ `
    <section class="greeting">
      <div class="greeting-inner">
        <span class="eyebrow">Tu barra</span>
        <h2 class="greeting-title">¡Hola!</h2>
        <p class="greeting-help">
          Estas son todas las donaciones que recibiste.
        </p>
        <p
          class="greeting-address"
          id="greetingAddress"
          data-text="addressLabel"
          data-attr="title:addressFull; hidden:noAddress"
        ></p>
      </div>
    </section>
  `;

  /** La cuenta conectada, de la que es el historial de abajo. Vacío = sin dato. */
  get address() {
    return this.getAttribute("address") ?? "";
  }
  set address(v) {
    this.setAttribute("address", String(v ?? ""));
  }

  /** La dirección acortada: 6 primeros + `...` + 4 últimos. */
  get #addressShort() {
    return this.address
      ? `${this.address.slice(0, ADDRESS_HEAD)}...${this.address.slice(-ADDRESS_TAIL)}`
      : "";
  }

  /** Valores a pintar (hook de pintado de la base). */
  get state() {
    const address = this.address;
    return {
      hasAddress: Boolean(address),
      noAddress: !address,
      addressLabel: this.#addressShort,
      // El `title` lleva la COMPLETA: la vista muestra la acortada.
      addressFull: address,
    };
  }
}
