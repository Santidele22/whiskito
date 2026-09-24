import * as islands from "../dom/islands.js";

import { currentView, VIEW, showView } from "../../pages/index.js";

import { professionalFor, SITE } from "../config/config.js";

import {
  VIEWER_ROLE,
  canDonate,
  canWithdraw,
  resolveEffectiveOwner,
  resolvePageOwner,
  resolveViewerRole,
} from "../roles/viewer-role.js";

import { DEMO_POL_PRICE, PREVIEW } from "../config/constants.js";

import { DEMO } from "../config/demo-mode.js";

import {
  connectWallet,
  disconnectWallet,
  getActiveNetwork,
  getWalletClient,
  hasWallet,
  onWalletAccountsChange,
  onWalletChainChange,
  restoreWallet,
  revokeWalletPermissions,
  startReadClient,
  switchWalletAccount,
} from "../solidity/chain.js";

import {
  fund,
  readBalance,
  readDonationHistory,
  readPolPrice,
  readPortfolio,
  withdraw,
  withdrawAll,
} from "../solidity/solidity-functions.js";

// ── VIEWER ROLE ──────────────────────────────────────────────────────
const pageOwnerFromUrl = resolvePageOwner();
let account = "";
let role = VIEWER_ROLE.GUEST;
let pageOwner = pageOwnerFromUrl;
/** Última lectura del historial inline pedida (para descartar una vieja). */
let proHistoryRead = 0;

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
  applyView();
}

/**
 * La vista de la PÁGINA: la landing conectada es la del profesional, todo lo
 * demás es la del visitante.
 *
 * Ojo con el disparador, que NO es el rol aunque casi siempre coincida. El rol
 * también es `owner` cuando la URL nombra al dueño (`/u/0x…`, el link que se
 * comparte) y esa cuenta conecta; ahí la página se queda en la del visitante, y
 * ése es justamente el caso que mantiene viva la ley §2.12: el dueño que abre su
 * propio link sigue pudiendo probar la donación en demo desde la tarjeta, que la
 * vista del profesional esconde. Lo que enciende la vista del profesional es la
 * LANDING sin dueño en la URL: el flujo "conectá tu wallet y empezá a recibir".
 *
 * Corre desde `applyRole()` porque ése ya es el único lugar que se ejecuta en
 * TODAS las entradas —arranque, conexión, cambio de cuenta, cambio de red y
 * desconexión—, así que el rol y la vista no pueden discrepar.
 */
function applyView() {
  const professional = Boolean(account) && !pageOwnerFromUrl;
  showView(professional ? VIEW.PROFESIONAL : VIEW.VISITOR, {
    // Sin dueño en la URL, el dueño efectivo de la página es la cuenta que
    // conecta: es su dirección la que el historial tiene que mostrar.
    address: professional ? account : "",
    base: SITE,
  });
  // La tabla del historial de la vista del profesional se llena con la chain:
  // el router ya montó las islas (arriba), así que acá sólo se piden los datos.
  if (professional) {
    // Se dispara sin `await` a propósito: `applyView()` corre en el camino
    // síncrono de la conexión y la lectura es HTTP contra el RPC (no puede
    // bloquear el pintado de la vista). `loadProHistory` atrapa lo suyo.
    loadProHistory(account).catch((error) =>
      console.warn(
        "No se pudo leer el historial del profesional:",
        error?.message ?? error
      )
    );
  }
}

/**
 * La tabla del historial INLINE de la vista del profesional: las donaciones que
 * recibió la CUENTA CONECTADA (es el dueño de la página el que mira su propia
 * barra; hoy es el único lugar donde el profesional retira, y comparte
 * `readDonationHistory` con la página `/historial`).
 *
 * Por qué se acepta el costo de una lectura de eventos por ventanas de 5.000
 * bloques al ENCENDER la vista: es el pedido que ya hacía la página `/historial`,
 * sólo que adelantado para que el historial esté a la vista sin un click de
 * más. No se repite por temporizador ni por cada pintado: sólo
 * cuando la vista se enciende (conexión, cambio de cuenta o de red), y el bucle
 * de `readDonationHistory` corta al juntar `limit` eventos o al llegar al bloque
 * del deploy —así que en una barra con donaciones es UN pedido, y sin ninguna,
 * uno por cada 5.000 bloques de vida del contrato.
 *
 * NO refresca por retiro: retirar devuelve el saldo, no borra los eventos
 * `Funded`, así que el historial no cambia. Lo que sí cambia es el saldo, y para
 * eso está `refreshProBalance()` —que el retiro exitoso llama—.
 */
async function loadProHistory(address) {
  // Un solo lector a la vez: si la vista se vuelve a encender mientras una
  // lectura está en vuelo (cambio de cuenta rápido), la vieja no puede pintar
  // encima de la nueva.
  const token = ++proHistoryRead;
  islands.showHistory({ address, rows: [], loading: true, connect: false });
  // El saldo va en paralelo con las filas: es la misma foto de la cuenta, y si
  // el precio (un adorno) falla, la tabla igual sirve. Se dispara sin `await`.
  refreshProBalance(address).catch(() => {});
  try {
    // Mismo `limit` por defecto que la tabla de la página `/historial` (200): no
    // se inventa otro tope.
    const rows = await readDonationHistory(address);
    if (token !== proHistoryRead) return;
    islands.showHistory({
      address,
      rows,
      // El explorador de la red ACTIVA: en anvil es `null` y la columna de la
      // transacción no se dibuja, igual que en `/historial`.
      explorer: getActiveNetwork()?.explorer ?? "",
      loading: false,
      connect: false,
      // La tabla es donde el profesional retira: es el único lugar de esta vista
      // que ofrece el retiro (el panel del backstage está oculto, y el modal "Mi
      // Panel" ya no existe). Sin este permiso la isla no dibuja ni el saldo ni
      // los botones.
      canWithdraw: canWithdraw(role),
    });
  } catch (error) {
    if (token !== proHistoryRead) return;
    // Nunca una tabla vacía muda: se dice, y se dice como aviso (no como "no
    // recibiste nada"). `connect: false`: acá ya hay una cuenta leída, y un
    // error de la chain no se arregla conectando la wallet.
    islands.showHistory({
      address,
      rows: [],
      message: "No pudimos leer tus donaciones de la chain",
      loading: false,
      connect: false,
      canWithdraw: canWithdraw(role),
    });
    console.warn(
      "No se pudo leer el historial del profesional:",
      error?.message ?? error
    );
  }
}

/**
 * El saldo disponible de la cuenta conectada, a la tabla del historial.
 *
 * Existe aparte de `loadProHistory` porque el saldo es lo ÚNICO que cambia con un
 * retiro: las filas son eventos `Funded`, que no se borran. Después de retirar se
 * llama a esto y no a la lectura de eventos, así la tabla no queda mintiendo con
 * el saldo de antes sin pagar el costo de releer la historia entera.
 *
 * El equivalente en dólares es un adorno: si el precio no está, el retiro igual
 * se mide en POL (el mismo criterio de siempre).
 */
async function refreshProBalance(address = account) {
  if (!address) return;
  const balancePol = await readBalance(address);
  let balanceUsd = "0.00";
  try {
    balanceUsd = (Number(balancePol) * (await readPolPrice())).toFixed(2);
  } catch (error) {
    console.warn(
      "Sin precio para el equivalente en dólares:",
      error?.message ?? error
    );
  }
  islands.setHistoryBalance(balancePol, balanceUsd);
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

/**
 * La wallet avisa que cambió de RED: la app recalcula con qué red trabaja (lo
 * hace `chain.js`) y se refresca SIN recargar la página. El precio y el panel
 * son de la red activa, así que se vuelven a leer.
 *
 * Con una cuenta conectada se reconecta, que es exactamente el camino de
 * refresco del cambio de cuenta: además revalida la red con la wallet, así que
 * si la wallet no se mueve a la red que la página pide, la app no queda
 * "conectada" contra otra red: se dice y no hay quién firme.
 */
async function onChainChanged() {
  await applyPolPrice();
  if (!account) {
    // Sin cuenta conectada no hay firma que proteger: la wallet no manda, sólo
    // cambió la red de la página, así que alcanza con releer su panel.
    try {
      islands.showPortfolio(await readPagePortfolio());
    } catch (error) {
      islands.showPortfolio(PREVIEW);
    }
    return;
  }
  try {
    await showConnectedAccount(await connectWallet());
    islands.setDonateStatus("idle", "");
  } catch (error) {
    islands.setConnectionState("disconnected");
    console.warn("La wallet quedó en otra red:", error?.message ?? error);
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
 *   - un string decimal en POL → retiro PARCIAL (`withdraw` lo convierte);
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
    // La chain es la verdad: se relee el panel de LA PÁGINA y el saldo de la
    // tabla del profesional —si es la vista que está puesta—. Lo segundo es lo
    // que el flujo hacía con el modal "Mi Panel" cuando existía: sin eso, la
    // tabla seguiría mostrando el saldo de antes del retiro (y con él unos
    // botones que ya no corresponden).
    // Lo que NO se relee es el historial de la tabla: son eventos `Funded`, que
    // un retiro no toca.
    islands.showPortfolio(await readPagePortfolio());
    if (currentView() === VIEW.PROFESIONAL) {
      await refreshProBalance(account);
    }
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
    // fallback. Con `||` la demo cae al profesional de la red ACTIVA (la de la
    // wallet): en Amoy tiene que cobrar el dueño del deploy, no la cuenta 0 de
    // anvil. Sin red activa, el default de `professionalFor` ya resuelve.
    const recipient = pageOwner || professionalFor(getActiveNetwork()?.chainId);
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
 * El precio POL→USD de la red ACTIVA, para la tarjeta de donación. Si la chain
 * no contesta se usa el de ejemplo, con el mismo aviso de siempre. Es una sola
 * pieza porque la usan el arranque y el cambio de red.
 */
async function applyPolPrice() {
  try {
    islands.setPolPrice(await readPolPrice());
  } catch (error) {
    console.warn(
      "Sin chain para el precio, se usa el de ejemplo:",
      error.message
    );
    islands.setPolPrice(DEMO_POL_PRICE);
  }
}

// Estado inicial: las islas nacen sin datos, alguien se los tiene que dar.
async function bootstrap() {
  islands.setShareBase(SITE);
  // El link al explorador del footer sale de la RED (no está hardcodeado): en
  // Amoy apunta al contrato en Polygonscan y en anvil —que no tiene explorador—
  // el footer esconde el link. Es el mismo dato que `donate.js` le pasa al modal
  // del veredicto.
  const red = getActiveNetwork();
  islands.setExplorer({ explorer: red?.explorer, fund: red?.fund });
  // La landing invita en modo demo: el aviso vive en la tarjeta, y quien lo
  // prende es este flujo (la página del link no lo prende nunca).
  islands.setDonateDemo(DEMO);
  applyRole(); // visitante hasta que conecte alguien
  // El precio se lee de la chain aunque nadie haya conectado: la tarjeta de
  // donación lo necesita para mostrar el equivalente en dólares.
  try {
    startReadClient();
  } catch (error) {
    // Sin cliente de lectura el precio no va a llegar: se dice, y el fallback
    // de `applyPolPrice()` deja el de ejemplo.
    console.warn("No se pudo crear el cliente de lectura:", error.message);
  }
  await applyPolPrice();
  // El panel: si la página tiene dueño (por `?u=`), sus datos públicos; si no,
  // la vista previa de la landing.
  try {
    islands.showPortfolio(await readPagePortfolio());
  } catch (error) {
    islands.showPortfolio(PREVIEW);
  }
  // ── Reconexión silenciosa, AL FINAL del arranque ─────────────────────
  // Si la wallet ya autorizó este sitio, `restoreWallet()` devuelve la cuenta
  // (por `eth_accounts`, sin abrir ningún prompt) y la app se pinta como
  // conectada por el MISMO camino que una conexión real: `showConnectedAccount`.
  // Así, navegar de otra página a la landing no "desloguea".
  //
  // Va después de `applyRole()` y del resto del arranque —y no antes— por dos
  // razones: (1) si no hay cuenta autorizada no cambia NADA de lo que la
  // landing hace hoy (el orden y las lecturas de arriba quedan intactos: son
  // los que verifican las aserciones del arranque), y (2) el estado conectado
  // se pinta sobre una página ya armada, con `showConnectedAccount` haciendo
  // su propio `applyRole()` y su propia lectura del panel, igual que si el
  // usuario hubiera apretado "Conectar Wallet".
  //
  // Nunca puede romper el arranque: si lanza (una wallet que no se mueve de
  // red, una wallet rara), se atrapa y se sigue con la landing desconectada.
  try {
    const restored = await restoreWallet();
    if (restored) await showConnectedAccount(restored);
  } catch (error) {
    console.warn(
      "No se pudo reconectar la wallet al cargar:",
      error?.message ?? error
    );
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
  });

  // La wallet avisa cuando el usuario cambia de cuenta por su cuenta: la app lo
  // sigue. Se registra acá y no dentro del handler de conexión porque también
  // tiene que valer para una wallet inyectada tarde (la suscripción es perezosa
  // y se reintenta al final de cada `connectWallet()` exitoso).
  onWalletAccountsChange(onAccountsChanged);
  // Y lo mismo con la RED: el usuario puede cambiarla en MetaMask, y la app
  // tiene que seguirla sin recargar la página.
  onWalletChainChange(onChainChanged);

  bootstrap().catch((error) =>
    console.error("No se pudo inicializar el panel", error)
  );
}
