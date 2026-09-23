// Registro de web components. `define` una sola vez: importar el módulo dos
// veces (p. ej. recarga en caliente) no debe romper.
import { WhiskitoNavbar } from "./whiskito-navbar.js";
import { WhiskitoHero } from "./whiskito-hero.js";
import { WhiskitoHowItWorks } from "./whiskito-how-it-works.js";
import { WhiskitoDonateCard } from "./whiskito-donate-card.js";
import { WhiskitoPanel } from "./whiskito-panel.js";
import { WhiskitoDashboard } from "./whiskito-dashboard.js";
import { WhiskitoShareCard } from "./whiskito-share-card.js";
import { WhiskitoRadio } from "./whiskito-radio.js";
import { WhiskitoTrust } from "./whiskito-trust.js";
import { WhiskitoFaq } from "./whiskito-faq.js";
import { WhiskitoFooter } from "./whiskito-footer.js";

const REGISTRY = [
  ["whiskito-navbar", WhiskitoNavbar],
  ["whiskito-hero", WhiskitoHero],
  ["whiskito-how-it-works", WhiskitoHowItWorks],
  ["whiskito-donate-card", WhiskitoDonateCard],
  ["whiskito-panel", WhiskitoPanel],
  ["whiskito-dashboard", WhiskitoDashboard],
  ["whiskito-share-card", WhiskitoShareCard],
  ["whiskito-radio", WhiskitoRadio],
  ["whiskito-trust", WhiskitoTrust],
  ["whiskito-faq", WhiskitoFaq],
  ["whiskito-footer", WhiskitoFooter],
];

for (const [name, ctor] of REGISTRY) {
  if (!customElements.get(name)) customElements.define(name, ctor);
}
