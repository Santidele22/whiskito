import * as islands from "./islands.js";

import { PROFESSIONAL, SITE } from "./config.js";

import {
  VIEWER_ROLE,
  canDonate,
  canWithdraw,
  resolveEffectiveOwner,
  resolvePageOwner,
  resolveViewerRole,
} from "./viewer-role.js";

import { DEMO_ETH_PRICE, PREVIEW } from "./constants.js";

import { DEMO } from "./demo-mode.js";

import {
  connectWallet,
  disconnectWallet,
  getWalletClient,
  hasWallet,
  onWalletAccountsChange,
  revokeWalletPermissions,
  startReadClient,
  switchWalletAccount,
} from "./chain.js";

import {
  fund,
  readBalance,
  readDonationHistory,
  readEthPrice,
  readPortfolio,
  withdraw,
  withdrawAll,
} from "./solidity-functions.js";

// ── VIEWER ROLE ──────────────────────────────────────────────────────
const pageOwnerFromUrl = resolvePageOwner();
let account = "";
let role = VIEWER_ROLE.GUEST;
let pageOwner = pageOwnerFromUrl;
/** ¿Está abierto "Mi Panel"? Se sigue acá porque el modal se cierra solo. */
let dashboardOpen = false;

function applyRole() {
  pageOwner = resolveEffectiveOwner({
    account,
    pageOwner: pageOwnerFromUrl,
  });
  role = resolveViewerRole({ account, pageOwner: pageOwnerFromUrl });
  islands.setPanelViewer({ owner: pageOwner ?? "", viewer: account });

  const isOwner = role === VIEWER_ROLE.OWNER;
  const landingWithoutOwner = !pageOwnerFromUrl;
  islands.setShareAddress(isOwner ? pageOwner ?? "" : "");
  islands.setShareVisible(isOwner || landingWithoutOwner);
}

/**
 * El portfolio de la PÁGINA. Sin dueño conocido (ni URL ni wallet) no hay a
 * quién leerle nada, así que queda la vista previa: es lo que se ve en la
 * landing sin `?u=`.
 */
async function readPagePortfolio() {
  if (!pageOwner) return PREVIEW;
  return readPortfolio(pageOwner);
}

/**
 * Cierra "Mi Panel" y lo recuerda. Cubre las tres vías de cierre de la isla (la
 * ×, Escape y el fondo, que llegan como `whiskito:dashboard-close`) y las que
 * decide este flujo (desconectar, cambiar de cuenta). Sin este dato, un refresco
 * después de un retiro volvería a abrir un modal que el usuario ya había
 * cerrado.
 */
function closeDashboard() {
  dashboardOpen = false;
  islands.hideDashboard();
}

// ── REACCIONES: la isla avisa, app.js responde ───────────────────────
async function onConnectRequest() {
  islands.setConnectionState("connecting");
  try {
    await showConnectedAccount(await connectWallet());
  } catch (error) {
    // Sin wallet instalada: la isla lo muestra en el botón, no rompemos nada.
    islands.setConnectionState(hasWallet() ? "disconnected" : "unsupported");
    console.warn(error);
  }
}

/**
 * Deja la app pintada como "conectado desde `address`": es exactamente el mismo
 * camino que una conexión, y lo comparten las tres entradas —conectar, cambiar
 * de cuenta a pedido del usuario, y el cambio que avisa la wallet—.
 */
async function showConnectedAccount(address) {
  account = address;
  islands.setNavbarAccount(address);
  islands.setConnectionState("connected");
  // El panel de la cuenta anterior (si estaba abierto) ya no describe a ésta.
  closeDashboard();
  applyRole();
  // Sólo si es el dueño tiene sentido abrirle su QR para compartir.
  if (role === VIEWER_ROLE.OWNER) islands.setShareOpen(true);
  // El panel muestra el portfolio DEL DUEÑO DE LA PÁGINA (es público), no el
  // de la cuenta conectada: en la página de otro, el visitante es donante.
  try {
    islands.showPortfolio(await readPagePortfolio());
  } catch (error) {
    console.warn("No se pudo leer el portfolio de la chain:", error.message);
  }
}

/**
 * Cambiar de cuenta (el botón del navbar o el de la tarjeta): la wallet abre su
 * SELECTOR de cuentas. Si el usuario cancela, `switchWalletAccount()` devuelve
 * `null` y acá no se cambia absolutamente nada: la conexión anterior sigue
 * válida y usable.
 */
async function onSwitchAccountRequest() {
  try {
    const address = await switchWalletAccount();
    if (address === null) return;
    await showConnectedAccount(address);
    // La cuenta cambió: el cartel de la donación anterior (por ejemplo el de
    // "estás en tu propia página") ya no describe lo que puede hacer esta
    // cuenta, así que se limpia.
    islands.setDonateStatus("idle", "");
  } catch (error) {
    console.warn("No se pudo cambiar de cuenta:", error?.message ?? error);
  }
}

/**
 * La wallet avisa que cambiaron SUS cuentas: el usuario cambió de cuenta en
 * MetaMask (o las soltó). La app sigue ese cambio sin recargar la página.
 *
 * Ojo con el `await` de adentro: este handler corre dentro del try/catch de
 * `chain.js`, que NO puede atrapar una promesa rechazada, así que cada rama
 * atrapa lo suyo y sigue con un `console.warn`.
 */
async function onAccountsChanged(accounts) {
  const next = accounts[0] ?? "";
  if (next === "") {
    // La wallet soltó todas las cuentas: mismo camino que desconectar, pero SIN
    // revocar el permiso (ya lo hizo la wallet; revocarlo sería volver a pedirlo).
    disconnectWallet();
    account = "";
    islands.setNavbarAccount("");
    islands.setConnectionState("disconnected");
    islands.setShareOpen(false);
    closeDashboard();
    applyRole();
    // Desconectado: el cartel de la donación anterior ya no corresponde.
    islands.setDonateStatus("idle", "");
    // Sin wallet sigue siendo público: se vuelve a leer el panel de la página.
    try {
      islands.showPortfolio(await readPagePortfolio());
    } catch (error) {
      islands.showPortfolio(PREVIEW);
    }
    return;
  }
  // La misma cuenta de siempre: no se toca nada (nada de parpadeos).
  if (next.toLowerCase() === account.toLowerCase()) return;
  try {
    // `connectWallet()` reconstruye walletClient y red con la cuenta nueva.
    await showConnectedAccount(await connectWallet());
    // Y el cartel de la donación anterior se limpia: hablaba de otra cuenta.
    islands.setDonateStatus("idle", "");
  } catch (error) {
    console.warn(
      "No se pudo seguir el cambio de cuenta:",
      error?.message ?? error
    );
  }
}

async function onDisconnectRequest() {
  // Desconectar del lado de la dApp es soltar el estado; y si la wallet lo
  // soporta, además revocar el permiso para que no se reconecte sola.
  await revokeWalletPermissions();
  disconnectWallet();
  account = "";
  islands.setNavbarAccount("");
  islands.setConnectionState("disconnected");
  islands.setShareOpen(false);
  closeDashboard();
  applyRole();
  // Sin wallet sigue siendo público: se vuelve a leer el panel de la página.
  try {
    islands.showPortfolio(await readPagePortfolio());
  } catch (error) {
    islands.showPortfolio(PREVIEW);
  }
}

/**
 * Retirar. Sólo el dueño, y sólo con wallet: hay que FIRMAR. Si la UI se
 * equivocara, el contrato revierte igual (`balances[msg.sender]`).
 *
 * El pedido llega con `detail.amount`:
 *   - un string decimal en ETH → retiro PARCIAL (`withdraw` lo convierte);
 *   - `null` → retiro TOTAL (`withdrawAll`).
 * A `withdraw`/`withdrawAll` nunca se les pasa una dirección: el contrato usa
 * `balances[msg.sender]`, o sea la cuenta que firma.
 */
async function onWithdrawRequest(event) {
  const amount = event?.detail?.amount ?? null;
  if (!canWithdraw(role) || !getWalletClient()) return;
  islands.setWithdrawStatus("pending");
  try {
    await (amount === null ? withdrawAll() : withdraw(amount));
    islands.setWithdrawStatus("success", "¡Retirado!");
    // La chain es la verdad: se relee el panel de LA PÁGINA y, si el modal está
    // abierto, también sus datos —si no, el modal seguiría mostrando el saldo
    // de antes del retiro (y con él un botón que ya no corresponde)—.
    islands.showPortfolio(await readPagePortfolio());
    if (dashboardOpen) await loadDashboard();
  } catch (error) {
    islands.setWithdrawStatus(
      "error",
      error?.shortMessage ?? error?.message ?? "No se pudo retirar"
    );
  }
}

async function onFundRequest(event) {
  const { amount } = event.detail;
  // En demo no se firma nada, así que la guardia del dueño no aplica: probar la
  // donación en tu propia página es justamente lo que uno quiere hacer. Con
  // donaciones reales (`?demo=0`) la regla es la de siempre.
  if (!canDonate(role, { demo: DEMO })) {
    islands.setDonateStatus(
      "error",
      "Estás en tu propia página: compartí el link para recibir."
    );
    return;
  }
  islands.setDonateStatus("pending");
  try {
    // Ojo con `??`: sin dueño, `pageOwner` es "" (no null), y "" no dispara el
    // fallback. Con `||` la demo vuelve a mostrar PROFESSIONAL, como antes.
    const recipient = pageOwner || PROFESSIONAL;
    const receipt = await fund({ amount, professional: recipient, demo: DEMO });
    if (receipt.demo) {
      // Modo demo: no se firmó nada ni se gastó gas, y tampoco se anota en
      // ningún lado. El resumen del panel es la verdad de la chain: una donación
      // simulada no tiene por qué aparecer como si hubiera entrado plata.
      islands.setDonateStatus("success", "¡Whiskito enviado! (demo, sin gas)");
    } else {
      islands.setDonateStatus(
        "success",
        "¡Whiskito enviado! Confirmada on-chain"
      );
      // Con wallet, la fuente de verdad es la chain: se vuelve a leer el panel
      // de LA PÁGINA (el donante puede no ser el dueño).
      islands.showPortfolio(await readPagePortfolio());
    }
  } catch (error) {
    islands.setDonateStatus(
      "error",
      error?.message ?? "No se pudo completar la transacción"
    );
  }
}

/**
 * "Mi Panel" (el botón del navbar): la tabla con TODAS las donaciones que
 * recibió la cuenta conectada, más su balance disponible y si puede retirar.
 *
 * Las filas son **reales**: se leen de la chain (los eventos `Funded` de esa
 * dirección). La demo no deja filas acá, porque no movió nada. Es a propósito la
 * cuenta conectada y no la dueña de la página: el botón vive en MI navbar, así
 * que muestra lo mío.
 *
 * Es reutilizable a propósito: la llama el pedido del navbar y TAMBIÉN el retiro
 * exitoso (`onWithdrawRequest`), para que el modal abierto no siga mostrando el
 * balance de antes.
 */
async function loadDashboard() {
  if (!account) return;
  try {
    // Las dos lecturas van juntas: la tabla y el balance son la misma foto.
    const [balanceEth, donations] = await Promise.all([
      readBalance(account),
      readDonationHistory(account),
    ]);
    // El equivalente en dólares es un adorno: si el precio no está, el modal
    // igual sirve (el retiro se mide en ETH, no en USD).
    let balanceUsd = "0.00";
    try {
      balanceUsd = (Number(balanceEth) * (await readEthPrice())).toFixed(2);
    } catch (error) {
      console.warn(
        "Sin precio para el equivalente en dólares:",
        error?.message ?? error
      );
    }
    islands.showDashboard({
      address: account,
      donations,
      balanceEth,
      balanceUsd,
      canWithdraw: canWithdraw(role),
    });
    dashboardOpen = true;
  } catch (error) {
    // Sin chain no hay historia. Se dice, en vez de mostrar una tabla vacía que
    // se leería como "no recibiste nada". Sin balance leído tampoco hay retiro
    // que ofrecer: los botones quedan apagados (el default de la isla es `0`).
    islands.showDashboard({
      address: account,
      donations: [],
      message: "No pudimos leer tus donaciones de la chain",
      canWithdraw: canWithdraw(role),
    });
    dashboardOpen = true;
    console.warn(
      "No se pudo leer la historia de donaciones:",
      error?.message ?? error
    );
  }
}

/** El pedido del navbar: cargar (y abrir) "Mi Panel". */
async function onDashboardRequest() {
  await loadDashboard();
}

/** La isla avisa que el modal se cerró (× , Escape o el fondo). */
function onDashboardClose() {
  dashboardOpen = false;
}

// Estado inicial: las islas nacen sin datos, alguien se los tiene que dar.
async function bootstrap() {
  islands.setShareBase(SITE);
  // La landing invita en modo demo: el aviso vive en la tarjeta, y quien lo
  // prende es este flujo (la página del link no lo prende nunca).
  islands.setDonateDemo(DEMO);
  applyRole(); // visitante hasta que conecte alguien
  // El precio se lee de la chain aunque nadie haya conectado: la tarjeta de
  // donación lo necesita para mostrar el equivalente en dólares.
  try {
    startReadClient();
    islands.setEthPrice(await readEthPrice());
  } catch (error) {
    console.warn(
      "Sin chain para el precio, se usa el de ejemplo:",
      error.message
    );
    islands.setEthPrice(DEMO_ETH_PRICE);
  }
  // El panel: si la página tiene dueño (por `?u=`), sus datos públicos; si no,
  // la vista previa de la landing.
  try {
    islands.showPortfolio(await readPagePortfolio());
  } catch (error) {
    islands.showPortfolio(PREVIEW);
  }
}

/** Registra los listeners de las islas y arranca el arranque. */
export function startApp() {
  islands.onRequest({
    connect: onConnectRequest,
    disconnect: onDisconnectRequest,
    switchAccount: onSwitchAccountRequest,
    withdraw: onWithdrawRequest,
    fund: onFundRequest,
    dashboard: onDashboardRequest,
    dashboardClose: onDashboardClose,
  });

  // La wallet avisa cuando el usuario cambia de cuenta por su cuenta: la app lo
  // sigue. Se registra acá y no dentro del handler de conexión porque también
  // tiene que valer para una wallet inyectada tarde (la suscripción es perezosa
  // y se reintenta al final de cada `connectWallet()` exitoso).
  onWalletAccountsChange(onAccountsChanged);

  bootstrap().catch((error) =>
    console.error("No se pudo inicializar el panel", error)
  );
}
