import { hydrateIcons } from "../js/dom/icons.js";

/**
 * Base de los web components de Whiskito.
 */
const TEMPLATES = new WeakMap();

export class WhiskitoElement extends HTMLElement {
  /** Markup del componente; cada subclase lo sobreescribe. */
  static template = "";
  /** CSS del componente. Declararlo lo convierte en componente con shadow root. */
  static styles = "";
  /** Atributos que disparan update(); cada subclase declara los suyos. */
  static observedAttributes = [];

  #mounted = false;

  connectedCallback() {
    if (this.#mounted) return;
    this.#mounted = true;
    const root = this.root;
    // El <style> va adentro del shadow root: es lo que lo mantiene encapsulado.
    if (this.constructor.styles && !root.querySelector("style")) {
      const style = document.createElement("style");
      style.textContent = this.constructor.styles.trim();
      root.append(style);
    }
    root.append(
      WhiskitoElement.templateFor(this.constructor).content.cloneNode(true)
    );
    // Los `<i data-lucide="…">` del template se vuelven SVG acá, una sola vez.
    // Se le pasa `root` (no el documento): así también se hidratan las islas que
    // viven en un shadow root.
    hydrateIcons(root);
    this.update();
  }

  attributeChangedCallback() {
    if (this.#mounted) this.update();
  }

  /**
   * Raíz de montaje. Con `static styles` es un shadow root (aislado); sin
   * estilos es el propio elemento (light DOM), para lo que comparte el CSS global.
   */
  get root() {
    if (!this.constructor.styles) return this;
    return this.shadowRoot ?? this.attachShadow({ mode: "open" });
  }

  /** Estado que se pinta. Cada subclase lo sobreescribe. */
  get state() {
    return {};
  }

  /** Pinta `state` en el DOM según los marcadores del template. */
  update() {
    const state = this.state;
    for (const el of this.#markers("[data-text]")) {
      const value = state[el.dataset.text];
      el.textContent =
        value === undefined || value === null ? "" : String(value);
    }
    for (const el of this.#markers("[data-attr]")) {
      for (const pair of el.dataset.attr.split(";")) {
        const [attr, key] = pair.split(":").map((s) => s.trim());
        if (!attr || !key) continue;
        const value = state[key];
        if (
          value === false ||
          value === "" ||
          value === undefined ||
          value === null
        ) {
          el.removeAttribute(attr);
        } else {
          el.setAttribute(attr, value === true ? "" : String(value));
        }
      }
    }
    for (const el of this.#markers("[data-class]")) {
      for (const pair of el.dataset.class.split(";")) {
        const [cls, key] = pair.split(":").map((s) => s.trim());
        if (cls && key) el.classList.toggle(cls, Boolean(state[key]));
      }
    }
    this.render(state);
  }

  /** Gancho para lo que los marcadores no cubren (chips, inputs, listas). */
  render(_state) {}

  /** Emite un evento del componente hacia afuera. */
  emit(type, detail) {
    this.dispatchEvent(
      new CustomEvent(type, { detail, bubbles: true, composed: true })
    );
  }

  /** Sólo los marcadores propios: los de un componente anidado no se tocan. */
  #markers(selector) {
    return [...this.root.querySelectorAll(selector)].filter((el) =>
      this.#owns(el)
    );
  }

  #owns(el) {
    for (let n = el.parentElement; n && n !== this.root; n = n.parentElement) {
      if (n.tagName.includes("-")) return false;
    }
    return true;
  }

  /** Construye el <template> una sola vez por clase. */
  static templateFor(ctor) {
    let tpl = TEMPLATES.get(ctor);
    if (!tpl) {
      tpl = document.createElement("template");
      tpl.innerHTML = ctor.template.trim();
      TEMPLATES.set(ctor, tpl);
    }
    return tpl;
  }
}
