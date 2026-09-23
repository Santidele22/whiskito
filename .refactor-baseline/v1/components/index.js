// Registro de web components. `define` una sola vez: importar el módulo dos
// veces (p. ej. recarga en caliente) no debe romper.
import { BirritaNavbar } from "./birrita-navbar.js";
import { BirritaHero } from "./birrita-hero.js";
import { BirritaHowItWorks } from "./birrita-how-it-works.js";
import { BirritaDonateCard } from "./birrita-donate-card.js";
import { BirritaPanel } from "./birrita-panel.js";
import { BirritaTrust } from "./birrita-trust.js";
import { BirritaFaq } from "./birrita-faq.js";
import { BirritaFooter } from "./birrita-footer.js";

const REGISTRY = [
  ["birrita-navbar", BirritaNavbar],
  ["birrita-hero", BirritaHero],
  ["birrita-how-it-works", BirritaHowItWorks],
  ["birrita-donate-card", BirritaDonateCard],
  ["birrita-panel", BirritaPanel],
  ["birrita-trust", BirritaTrust],
  ["birrita-faq", BirritaFaq],
  ["birrita-footer", BirritaFooter],
];

for (const [name, ctor] of REGISTRY) {
  if (!customElements.get(name)) customElements.define(name, ctor);
}
