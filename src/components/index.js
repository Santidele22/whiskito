// Registro de web components. `define` una sola vez: importar el módulo dos
// veces (p. ej. recarga en caliente) no debe romper.
import { WhiskitoNavbar } from "./whiskito-navbar.js";
import { WhiskitoHero } from "./whiskito-hero.js";
import { WhiskitoHowItWorks } from "./whiskito-how-it-works.js";
import { WhiskitoDonateCard } from "./whiskito-donate-card.js";
import { WhiskitoPanel } from "./whiskito-panel.js";
import { WhiskitoShareCard } from "./whiskito-share-card.js";
import { WhiskitoRadio } from "./whiskito-radio.js";
import { WhiskitoTrust } from "./whiskito-trust.js";
import { WhiskitoFaq } from "./whiskito-faq.js";
import { WhiskitoFooter } from "./whiskito-footer.js";
import { WhiskitoProGreeting } from "./whiskito-pro-greeting.js";
// La tabla del historial la comparte la página `/historial`, que la registra por
// su cuenta (`js/entries/historial.js`, con su propia guarda): acá se registra para que
// la LANDING pueda montarla inline en la vista del profesional. Las dos guardas
// `customElements.get` conviven: la primera que corre define, la otra no repite.
import { WhiskitoHistoryTable } from "./whiskito-history-table.js";

const REGISTRY = [
  ["whiskito-navbar", WhiskitoNavbar],
  ["whiskito-hero", WhiskitoHero],
  ["whiskito-how-it-works", WhiskitoHowItWorks],
  ["whiskito-donate-card", WhiskitoDonateCard],
  ["whiskito-panel", WhiskitoPanel],
  ["whiskito-share-card", WhiskitoShareCard],
  ["whiskito-radio", WhiskitoRadio],
  ["whiskito-trust", WhiskitoTrust],
  ["whiskito-faq", WhiskitoFaq],
  ["whiskito-footer", WhiskitoFooter],
  // Las dos que la vista del profesional monta en runtime (saludo arriba,
  // historial inline abajo).
  ["whiskito-pro-greeting", WhiskitoProGreeting],
  ["whiskito-history-table", WhiskitoHistoryTable],
];

for (const [name, ctor] of REGISTRY) {
  if (!customElements.get(name)) customElements.define(name, ctor);
}
