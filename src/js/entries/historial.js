// ── PÁGINA DE HISTORIAL (`/historial?u=0x…`) ─────────────────────────
// Copia el patrón de la página del link (`js/entries/donate.js`): HTML mínimo, la
// página registra SUS PROPIAS islas con `customElements.define` guardado —no
// importa `components/index.js`, que traería las islas de la landing— y un
// flujo con `bootstrap()`.
import { WhiskitoHistoryTable } from "../../components/whiskito-history-table.js";

// El header de esta página es el navbar de la LANDING reusado: con `base`, sus
// cuatro links llevan a la landing y aparece el control de volver al inicio.
import { WhiskitoNavbar } from "../../components/whiskito-navbar.js";

import * as islands from "../dom/islands.js";

import { SITE } from "../config/config.js";

import { resolvePageOwner } from "../roles/viewer-role.js";

import { connectWallet, getActiveNetwork, onWalletAccountsChange, startReadClient } from "../solidity/chain.js";

import { readDonationHistory } from "../solidity/solidity-functions.js";

// Mismo registro con guarda que `components/index.js`: `define` una sola vez.
if (!customElements.get("whiskito-history-table")) {
  customElements.define("whiskito-history-table", WhiskitoHistoryTable);
}

if (!customElements.get("whiskito-navbar")) {
  customElements.define("whiskito-navbar", WhiskitoNavbar);
}

/**
 * Cuántas donaciones se leen. La tabla de esta página es el historial
 * COMPLETO, así que el tope es alto: es el mismo `limit` que acepta
 * `readDonationHistory`, sólo que acá se pide el máximo razonable en vez de las
 * 200 de la vista del profesional. El tope sigue siendo un tope: una dirección
 * con más de 500 donaciones ve las 500 más nuevas.
 */
const HISTORY_LIMIT = 500;

const NO_ADDRESS_MESSAGE =
  "Este historial todavía no dice de quién es: conectá tu wallet y te muestro las donaciones que recibiste";

const READ_ERROR_MESSAGE = "No pudimos leer el historial de la chain";

/** `0x` + 40 hex: la misma forma que valida `resolvePageOwner`. */
const ADDRESS_IN_PATH = /^0x[0-9a-fA-F]{40}$/;

/**
 * La dirección de la que es este historial, sacada de la URL.
 *
 * `resolvePageOwner` ya entiende las dos formas que existen (`?u=0x…` y la ruta
 * `/u/0x…`, que es la de la página que se comparte). Acá se le suma la propia
 * de esta página, `/historial/0x…`, que es trivial: el último segmento de la
 * ruta. Va DESPUÉS de `resolvePageOwner` para que `?u=` siga mandando (y con
 * eso `/historial/0x…?u=0x…` no es ambiguo: gana el query).
 */
function resolveHistoryAddress() {
  const owner = resolvePageOwner();
  if (owner) return owner;
  const segments = String(globalThis.location?.pathname ?? "").split("/");
  const last = segments[segments.length - 1] ?? "";
  return ADDRESS_IN_PATH.test(last) ? last : null;
}

/**
 * Lee el historial de `address` y se lo pasa a la isla.
 *
 * Las tres cosas van juntas: primero el estado de carga —para que la tabla no
 * afirme "no recibiste nada" mientras se lee—, después la lectura (eventos
 * `Funded` reales de la chain, público y sin wallet), y al final las filas con
 * el explorador de la red ACTIVA (en anvil es `null`, y entonces la isla no
 * dibuja la columna de la transacción).
 *
 * Si la lectura falla se DICE, con la tabla vacía y el aviso: nunca una tabla
 * vacía muda, que se leería como "no recibiste nada".
 *
 * `connect: false` en los tres avisos: acá YA hay una dirección que leer, así que
 * el botón de conectar no tiene nada que ofrecer (y un error de la chain no se
 * arregla conectando la wallet). El único estado que lo enciende es "todavía no
 * sé de quién", más abajo.
 */
async function loadHistory(address) {
  islands.showHistory({ address, rows: [], loading: true, connect: false });
  try {
    const rows = await readDonationHistory(address, { limit: HISTORY_LIMIT });
    islands.showHistory({
      address,
      rows,
      explorer: getActiveNetwork()?.explorer ?? "",
      loading: false,
      connect: false,
    });
  } catch (error) {
    islands.showHistory({
      address,
      rows: [],
      message: READ_ERROR_MESSAGE,
      loading: false,
      connect: false,
    });
    console.warn(
      "No se pudo leer el historial de donaciones:",
      error?.message ?? error
    );
  }
}

// ── REACCIÓN: la página pide conectar, este módulo responde ──────────
/**
 * Sin dirección en la URL, el camino es conectar la wallet y mostrar el
 * historial de ESA cuenta (es el flujo "conectá y mirá lo tuyo"). Lo mismo que
 * la página del link: la conexión es ON DEMAND, no al entrar: leer es público,
 * así que la página ya sirvió antes de que nadie conecte.
 *
 * Quien emite el pedido es el botón "Conectá tu wallet" de la isla (el mismo
 * evento `whiskito:connect-request` que escucha `donate.js`).
 */
async function onConnectRequest() {
  islands.showHistory({
    address: "",
    rows: [],
    message: "Conectando la wallet…",
    loading: true,
    // Mientras conecta, el botón se apaga: si el usuario ya pidió, ofrecérselo
    // otra vez es ruido (y un segundo pedido encima del primero).
    connect: false,
  });
  try {
    const connected = await connectWallet();
    await loadHistory(connected);
  } catch (error) {
    // Sin wallet instalada o permiso rechazado: se dice, y NO se cae a mostrar
    // una tabla vacía (parecería que la cuenta no recibió nada). El botón VUELVE
    // (connect: true): sin él, un rechazo dejaría la página sin salida hasta
    // recargar, que es justo el callejón que este botón vino a abrir.
    islands.showHistory({
      address: "",
      rows: [],
      message:
        error?.shortMessage ??
        error?.message ??
        "No se pudo conectar la wallet",
      loading: false,
      connect: true,
    });
  }
}

/**
 * La wallet avisa que cambiaron SUS cuentas: si la página está mostrando el
 * historial de la cuenta conectada (o sea, no tiene dirección propia en la
 * URL), se sigue el cambio sin recargar.
 */
async function onAccountsChanged(accounts) {
  const next = accounts[0] ?? "";
  if (next === "" || resolveHistoryAddress()) return;
  await loadHistory(next);
}

// ── ARRANQUE ─────────────────────────────────────────────────────────
async function bootstrap() {
  // El navbar, en su modo "fuera de la landing": los links apuntan a la landing
  // (con `SITE`, que es el origen que sirve esta página) y aparece el control de
  // volver al inicio. Sus controles de wallet quedan ocultos —acá no hay landing
  // y el botón de conectar de la isla ya es la salida—, así que esta página NO
  // registra los pedidos de wallet.
  islands.setNavbarBase(SITE);

  const address = resolveHistoryAddress();

  if (!address) {
    // Sin dirección no hay nada que leer: se dice, y se ofrece conectar la
    // wallet. Quien emite el pedido es el botón "Conectá tu wallet" de la propia
    // isla (el mismo evento `whiskito:connect-request` que escucha `donate.js`);
    // esta página se registra para responderlo. Por eso va `connect: true`: sin
    // el botón, el aviso invitaba a una acción que no existía.
    islands.showHistory({
      address: "",
      rows: [],
      message: NO_ADDRESS_MESSAGE,
      connect: true,
    });
  }

  // Leer es público: el cliente de LECTURA se crea SIEMPRE, aunque no haya
  // nadie conectado —la página tiene que funcionar sin wallet—. Mismo patrón y
  // mismo aviso que `bootstrap()` de `donate.js`.
  try {
    startReadClient();
  } catch (error) {
    console.warn("No se pudo crear el cliente de lectura:", error.message);
  }

  if (!address) return;
  await loadHistory(address);
}

// Sólo interesa el pedido de conectar: no hay navbar, ni panel, ni tarjeta de
// donación en esta página.
islands.onRequest({ connect: onConnectRequest });
// Las cuentas que el usuario cambia en su propia wallet se siguen solas.
onWalletAccountsChange(onAccountsChanged);
bootstrap().catch((error) =>
  console.error("No se pudo inicializar el historial", error)
);
