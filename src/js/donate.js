// ── PÁGINA DE DONACIÓN (`/u/0x…`) ────────────────────────────────────
import { WhiskitoDonateCard } from "../components/whiskito-donate-card.js";

import { WhiskitoTxModal } from "../components/whiskito-tx-modal.js";

import * as islands from "./islands.js";

import {
  canDonate as canDonateRole,
  resolvePageOwner,
  resolveViewerRole,
} from "./viewer-role.js";

import { DEMO_ETH_PRICE } from "./constants.js";


import {
  connectWallet,
  disconnectWallet,
  getActiveNetwork,
  getWalletClient,
  hasWallet,
  onWalletAccountsChange,
  onWalletChainChange,
  startReadClient,
  switchWalletAccount,
} from "./chain.js";

//CONTRATO: leer el precio y donar.
import { fund, readEthPrice } from "./solidity-functions.js";

// Mismo registro con guarda que `components/index.js`: `define` una sola vez.
if (!customElements.get("whiskito-donate-card")) {
  customElements.define("whiskito-donate-card", WhiskitoDonateCard);
}
if (!customElements.get("whiskito-tx-modal")) {
  customElements.define("whiskito-tx-modal", WhiskitoTxModal);
}

// ── EL DESTINATARIO ──────────────────────────────────────────────────
const owner = resolvePageOwner();

const NO_OWNER_MESSAGE = "Este link no dice a quién donarle";

const SELF_DONATION_MESSAGE =
  "Estás en tu propia página: compartí el link para recibir";

/**
 * ¿El usuario canceló la firma en la wallet? viem marca ese caso con
 * `UserRejectedRequestError` y un `shortMessage` del estilo "User rejected the
 * request". **Cancelar no es fallar**: el modal lo dice distinto (y con eso el
 * usuario sabe que puede volver a intentar).
 */
function esCancelacion(error) {
  const texto = `${error?.name ?? ""} ${error?.shortMessage ?? ""} ${
    error?.message ?? ""
  }`;
  return /reject|denied|cancel|rechaz/i.test(texto);
}

// ── EL ROL DEL QUE MIRA ──────────────────────────────────────────────
let account = "";
let allowedToDonate = true;

/** Recalcula el rol con la cuenta de ahora y se lo cuenta a la tarjeta. */
function applyRole(nextAccount = account) {
  account = nextAccount ?? "";
  const role = resolveViewerRole({ account, pageOwner: owner });
  allowedToDonate = canDonateRole(role);
  // El botón de donar se deshabilita (y muestra el motivo) cuando no se puede.
  islands.setDonateCanDonate(allowedToDonate);
}

// ── REACCIÓN: la tarjeta pide conectar, este módulo responde ─────────
async function onConnectRequest() {
  islands.setDonateStatus("pending", "Conectando la wallet…");
  try {
    const connected = await connectWallet();
    // La tarjeta pasa a mostrar desde qué cuenta se va a donar.
    islands.setDonateViewer(connected);
    applyRole(connected);
    islands.setDonateStatus("idle", "");
  } catch (error) {
    // Sin wallet instalada o permiso rechazado: se dice, y NO se cae a la
    // simulación: un error de conexión no puede parecer una donación.
    islands.setDonateStatus(
      "error",
      error?.shortMessage ?? error?.message ?? "No se pudo conectar la wallet"
    );
  }
}

async function onSwitchAccountRequest() {
  try {
    const connected = await switchWalletAccount();
    if (connected === null) return;
    islands.setDonateViewer(connected);
    applyRole(connected);
    // La cuenta cambió: el cartel de la donación anterior (por ejemplo el de
    // "estás en tu propia página") hablaba de otra cuenta, así que se limpia.
    islands.setDonateStatus("idle", "");
  } catch (error) {
    islands.setDonateStatus(
      "error",
      error?.shortMessage ?? error?.message ?? "No se pudo cambiar de cuenta"
    );
  }
}

/**
 * La wallet avisa que cambiaron SUS cuentas: la app sigue ese cambio sin
 * recargar la página. El rol se recalcula siempre, porque es lo que habilita o
 * bloquea el botón de donar según quién sea la cuenta dueña.
 */
async function onAccountsChanged(accounts) {
  const next = accounts[0] ?? "";
  if (next === "") {
    // La wallet soltó todas las cuentas: mismo camino que desconectar, pero SIN
    // revocar el permiso (ya lo hizo la wallet). Vuelve a ser un visitante: el
    // rol vuelve a ser `guest`.
    disconnectWallet();
    islands.setDonateViewer("");
    applyRole("");
    // Desconectado: el cartel de la donación anterior ya no corresponde.
    islands.setDonateStatus("idle", "");
    return;
  }
  // La misma cuenta de siempre: no se toca nada (nada de parpadeos).
  if (next.toLowerCase() === account.toLowerCase()) return;
  try {
    const connected = await connectWallet();
    islands.setDonateViewer(connected);
    applyRole(connected);
    // El cartel viejo hablaba de la cuenta vieja: se limpia con la nueva.
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
 * hace `chain.js`) y se refresca SIN recargar la página. Es el mismo camino que
 * un cambio de cuenta: reconectar —que además revalida la red con la wallet— y
 * repintar la cuenta; el precio, que es de la red activa, se vuelve a leer.
 */
async function onChainChanged() {
  await applyEthPrice();
  if (!account) return; // sin cuenta conectada no hay nada que reconectar
  try {
    const connected = await connectWallet();
    islands.setDonateViewer(connected);
    applyRole(connected);
    // El cartel viejo hablaba de la red vieja: se limpia con la conexión nueva.
    islands.setDonateStatus("idle", "");
  } catch (error) {
    // La wallet quedó en otra red que la de esta página: no hay quién firme, y
    // se dice (en vez de dejar el botón prometiendo una donación que no sale).
    islands.setDonateStatus(
      "error",
      error?.message ?? "No se pudo seguir el cambio de red"
    );
    console.warn("La wallet quedó en otra red:", error?.message ?? error);
  }
}

// ── REACCIÓN: la tarjeta pide donar, este módulo responde ────────────
async function onFundRequest(event) {
  const { amount } = event.detail;
  if (!owner) {
    // Guarda defensiva: sin destinatario no se firma nada.
    islands.setDonateStatus("error", NO_OWNER_MESSAGE);
    return;
  }
  if (!allowedToDonate) {
    // El dueño de la página no se dona a sí mismo. Mismo mensaje que la landing
    // y NINGUNA firma: no es un error de la transacción, es que no corresponde
    // donarse a uno mismo.
    islands.setDonateStatus("error", SELF_DONATION_MESSAGE);
    return;
  }
  islands.setDonateStatus("pending");
  try {
    // Conectar ON DEMAND: esta página no tiene navbar con su botón, así que el
    // único momento en que tiene sentido pedir la wallet es cuando alguien ya
    // decidió donar. Si ya está conectada, no se vuelve a pedir permiso.
    if (hasWallet() && !getWalletClient()) {
      const connected = await connectWallet();
      islands.setDonateViewer(connected);
      // El rol se recalcula DESPUÉS de conectar, y esto no es un detalle: si el
      // que acaba de conectar es el DUEÑO de la página, no se firma. Sin esto, un
      // dueño que va derecho a "Invitar un Whiskito" (sin pasar por "Conectar
      // wallet") se donaba a sí mismo: el rol todavía era `guest`.
      applyRole(connected);
      if (!allowedToDonate) {
        islands.setDonateStatus("error", SELF_DONATION_MESSAGE);
        return;
      }
    }
    // `fund()` sin `demo`: esta página cobra de verdad. El único caso en que
    // devuelve `{ demo: true }` es que no haya wallet —no hay quién firme—, y
    // entonces el recibo lo dice en vez de fingir una confirmación on-chain.
    const receipt = await fund({ amount, professional: owner });
    if (receipt?.demo) {
      islands.setDonateStatus("success", "¡Whiskito enviado! (simulada)");
      islands.showTxModal({
        kind: "success",
        title: "¡Whiskito enviado!",
        message:
          "Fue una donación simulada: no había wallet conectada, así que no se movió nada on-chain.",
      });
    } else {
      islands.setDonateStatus(
        "success",
        "¡Whiskito enviado! Confirmada on-chain"
      );
      islands.showTxModal({
        kind: "success",
        title: "¡Donación confirmada!",
        message: "La transacción se firmó y ya está on-chain.",
        hash: receipt?.hash ?? "",
        // El link al explorador sólo tiene sentido si la red tiene uno: en anvil
        // es `null` y el modal no lo muestra.
        explorer: getActiveNetwork()?.explorer ?? "",
      });
    }
  } catch (error) {
    // Acá caen las dos cosas: la conexión rechazada o sin wallet inyectada, y la
    // transacción que no se pudo completar. Nunca un éxito silencioso.
    const motivo =
      error?.shortMessage ??
      error?.message ??
      "No se pudo completar la transacción";
    islands.setDonateStatus("error", motivo);
    // El veredicto que ve el usuario distingue **cancelar** de **fallar**: no es
    // lo mismo que uno cierre la wallet que la transacción reviente.
    islands.showTxModal(
      esCancelacion(error)
        ? {
            kind: "error",
            title: "Donación cancelada",
            message:
              "Cerraste o rechazaste la firma en la wallet: no se envió nada.",
          }
        : {
            kind: "error",
            title: "La transacción no se pudo completar",
            message: motivo,
          }
    );
  }
}

/**
 * El precio ETH→USD de la red ACTIVA, para la tarjeta. Si la chain no contesta
 * se usa el de ejemplo, con el mismo aviso de siempre. Es una sola pieza
 * porque la usan el arranque y el cambio de red.
 */
async function applyEthPrice() {
  try {
    islands.setEthPrice(await readEthPrice());
  } catch (error) {
    console.warn(
      "Sin chain para el precio, se usa el de ejemplo:",
      error.message
    );
    islands.setEthPrice(DEMO_ETH_PRICE);
  }
}

// ── ARRANQUE ─────────────────────────────────────────────────────────
async function bootstrap() {
  // El rol se aplica ANTES de pintar nada: al arrancar no hay cuenta conectada
  // (rol `guest`), así que la tarjeta queda habilitada como corresponde para un
  // visitante. Si después conecta la cuenta dueña, `applyRole` la bloquea.
  applyRole();
  // La tarjeta tiene que ser suficiente por sí sola: dice a quién se le dona y
  // ofrece conectar la wallet. `showConnect` va siempre en true (también sin
  // wallet instalada: ahí el click muestra el error claro, y el botón de donar
  // sigue andando en modo simulado, que es parte del contrato de `fund()`).
  islands.setDonateRecipient(owner ?? "");
  islands.setDonateConnectVisible(true);

  if (!owner) {
    // Sin destinatario la tarjeta lo dice y no se ofrece donar (el handler de
    // arriba es la guarda; esto es el aviso que se ve al entrar).
    islands.setDonateStatus("error", NO_OWNER_MESSAGE);
    return;
  }
  // El precio se lee de la chain aunque nadie haya conectado: la tarjeta lo
  // necesita para el equivalente en dólares y para habilitar los montos.
  // Mismo patrón y mismo aviso que `bootstrap()` de `app.js`.
  try {
    startReadClient();
  } catch (error) {
    // Sin cliente de lectura el precio no va a llegar: se dice, y el fallback
    // de `applyEthPrice()` deja el de ejemplo.
    console.warn("No se pudo crear el cliente de lectura:", error.message);
  }
  await applyEthPrice();
}

// Sólo interesan estos pedidos: no hay navbar ni panel que escuchar. La tarjeta
// también ofrece cambiar de cuenta, y las cuentas que cambia el usuario en su
// propia wallet se siguen solas (suscripción a `accountsChanged`).
islands.onRequest({
  connect: onConnectRequest,
  switchAccount: onSwitchAccountRequest,
  fund: onFundRequest,
});
onWalletAccountsChange(onAccountsChanged);
// Y la RED: si el usuario la cambia en su wallet, la página lo sigue sin
// recargar (con `?chain=` la URL manda y reconectar vuelve a pedir el cambio).
onWalletChainChange(onChainChanged);
bootstrap().catch((error) =>
  console.error("No se pudo inicializar la donación", error)
);
