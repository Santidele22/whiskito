/**
 * Base de los web components de Birrita.
 *
 * Monta el markup de `static template` dentro de `root`, una sola vez.
 * Hoy `root` es el propio elemento (light DOM), así que el CSS global sigue
 * aplicando igual. Cuando pasemos a Shadow DOM, cambia solo `root`.
 */
const TEMPLATES = new WeakMap();

export class BirritaElement extends HTMLElement {
  /** Markup del componente; cada subclase lo sobreescribe. */
  static template = "";

  #rendered = false;

  connectedCallback() {
    if (this.#rendered) return;
    this.#rendered = true;
    this.root.append(BirritaElement.templateFor(this.constructor).content.cloneNode(true));
  }

  /** Raíz de montaje: light DOM por ahora. */
  get root() {
    return this;
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
