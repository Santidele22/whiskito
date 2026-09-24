//LIBRARIES
import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  http,
} from "https://esm.sh/viem";

//CONFIGURACIÓN (redes y constantes de la app)
import { DEFAULT_CHAIN_ID, effectiveNetwork } from "../config/config.js";

let walletClient;
let publicClient;
/** Red con la que está trabajando la app: la de la wallet, o la de por defecto. */
let activeNetwork = effectiveNetwork(DEFAULT_CHAIN_ID);
/**
 * La red en la que está la WALLET conectada, según la última vez que nos lo
 * dijo (`eth_chainId` al conectar, o el evento `chainChanged`). Es la realidad
 * que hay que comparar contra `activeNetwork`, que puede pedir otra cosa.
 */
let walletChainId = null;

/** Handlers registrados para `accountsChanged` (ver `onWalletAccountsChange`). */
const accountChangeHandlers = new Set();

/**
 * ¿Ya hay UNA suscripción a `accountsChanged`? Sin esta bandera, cada handler
 * registrado agregaría otra: la wallet avisaría tantas veces como registros haya.
 */
let accountsSubscribed = false;

/** Handlers registrados para `chainChanged` (ver `onWalletChainChange`). */
const chainChangeHandlers = new Set();

/**
 * ¿Ya hay UNA suscripción a `chainChanged`? Es una bandera PROPIA: registrar un
 * handler de red no puede compartir (ni duplicar) la suscripción de cuentas.
 */
let chainSubscribed = false;

const DEFAULT_NATIVE_CURRENCY = { name: "POL", symbol: "POL", decimals: 18 };

export function chainFromConfig(config) {
  return defineChain({
    id: config.chainId,
    name: config.name,
    nativeCurrency: config.nativeCurrency ?? DEFAULT_NATIVE_CURRENCY,
    rpcUrls: { default: { http: [config.rpc] } },
  });
}

/** La red con la que está trabajando la app (null si la wallet está en otra). */
export function getActiveNetwork() {
  return activeNetwork;
}

/** El cliente de la WALLET. Sólo existe después de conectar. */
export function getWalletClient() {
  return walletClient;
}

/** El cliente de LECTURA. Puede no existir (o haber quedado en undefined). */
export function getPublicClient() {
  return publicClient;
}

/**
 * El cliente de LECTURA: va por HTTP (no por la wallet) para que las lecturas
 * funcionen aunque nadie haya conectado. El sondeo corto es para que la espera
 * del recibo (`waitForTransactionReceipt`) no tarde los 4 s por defecto.
 */
export function createReadClient() {
  return createPublicClient({
    chain: chainFromConfig(activeNetwork),
    transport: http(activeNetwork.rpc),
    pollingInterval: 1000,
  });
}

/**
 * Crea el cliente de lectura y lo deja como el activo. Sirve para que el
 * arranque pueda leer la chain sin que haya ninguna wallet conectada.
 */
export function startReadClient() {
  publicClient = createReadClient();
  return publicClient;
}

/** ¿Hay una wallet inyectada en el navegador? (`window.ethereum`) */
export function hasWallet() {
  return typeof window.ethereum !== "undefined";
}

/**
 * La red en la que está la WALLET; `null` si no hay conexión. Es la REALIDAD:
 * `activeNetwork` es lo que la app necesita, y puede no ser lo mismo.
 */
export function getWalletChainId() {
  return walletClient ? walletChainId : null;
}

/**
 * ¿La wallet conectada está en la red activa? Sólo entonces la firma tiene
 * sentido: la escritura sale de la wallet y va al contrato de `activeNetwork`.
 */
export function walletMatchesActiveNetwork() {
  const wallet = getWalletChainId();
  return (
    wallet !== null && activeNetwork !== null && wallet === activeNetwork.chainId
  );
}

/**
 * El texto del desajuste, en un solo lugar: lo dicen igual la conexión y la
 * guarda de escritura (`tx.js`), y nombra SIEMPRE las dos redes.
 */
export function networkMismatchMessage() {
  return `Tu wallet está en la red ${getWalletChainId()} y esta página es de la red ${
    getActiveNetwork()?.chainId
  }. Cambiá de red en tu wallet para firmar.`;
}

/** EIP-1193 4902: la wallet no conoce esa red (se agrega con `wallet_addEthereumChain`). */
function isUnknownChain(error) {
  if (error?.code === 4902) return true;
  return /unrecognized chain|unknown chain|no such chain/i.test(
    String(error?.message ?? "")
  );
}

/** La red de la wallet, preguntada a la wallet misma (`eth_chainId`). */
async function readWalletChainId() {
  if (!hasWallet() || typeof window.ethereum?.request !== "function") return null;
  try {
    const id = Number(await window.ethereum.request({ method: "eth_chainId" }));
    return Number.isFinite(id) ? id : null;
  } catch {
    return null;
  }
}

/**
 * Le PIDE a la wallet que se mueva a la red activa (con `?chain=` la URL es una
 * instrucción, y la wallet es la realidad: o se mueve, o no se firma).
 *
 * Nunca lanza. Devuelve `true` sólo si la wallet QUEDÓ en la red activa; `false`
 * si el usuario rechazó (4001), si la wallet no puede, o si contestó que sí
 * pero siguió en otra red. Si la wallet no conoce la red (4902) se la agrega
 * con `wallet_addEthereumChain`, derivando los params de la config de ESA red.
 */
export async function switchToActiveNetwork() {
  if (!activeNetwork) return false;
  if (!hasWallet() || typeof window.ethereum?.request !== "function") {
    return false;
  }
  const chainIdHex = "0x" + activeNetwork.chainId.toString(16);
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainIdHex }],
    });
  } catch (error) {
    // El usuario cerró el pedido: no hay nada más que hacer.
    if (isUserRejection(error)) return false;
    // Cualquier otra cosa que no sea "no conozco esa red" o "no sé hacer eso"
    // también es un no: no se firma contra una red que no es la activa.
    if (!isUnknownChain(error) && !isUnsupportedMethod(error)) return false;
    try {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: chainIdHex,
            chainName: activeNetwork.name,
            nativeCurrency:
              activeNetwork.nativeCurrency ?? DEFAULT_NATIVE_CURRENCY,
            rpcUrls: [activeNetwork.rpc],
            blockExplorerUrls: activeNetwork.explorer
              ? [activeNetwork.explorer]
              : [],
          },
        ],
      });
    } catch {
      return false; // el usuario rechazó el alta (o la wallet no pudo)
    }
    // Muchas wallets cambian solas al agregar; otras no. Se lo pedimos igual y
    // el veredicto lo da la lectura de la red, no el silencio de la wallet.
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainIdHex }],
      });
    } catch {
      /* puede haber cambiado ya con el alta: lo decide la lectura de abajo */
    }
  }
  walletChainId = await readWalletChainId();
  return walletChainId === activeNetwork.chainId;
}

/**
 * El transporte EIP-1193 de la wallet inyectada. Es UNO solo: lo usan tanto el
 * cliente de sondeo (con el que se le pregunta a la wallet antes de comprometer
 * nada) como el `walletClient` de la app, así que no se arman dos puentes
 * distintos hacia la misma wallet.
 */
function walletTransport() {
  return custom(window.ethereum);
}

/**
 * Adopta como propia la sesión de la wallet con la cuenta `address`: resuelve
 * con qué red trabaja la app (la de la wallet, o la que manda `?chain=`),
 * construye el `walletClient`, se asegura de que la wallet esté en esa red
 * —pidiéndole que se mueva si no—, rehace el cliente de lectura y deja las
 * suscripciones a `accountsChanged` / `chainChanged`.
 *
 * Es el estado COMPARTIDO de `connectWallet()` y de `restoreWallet()`: una
 * cuenta recién autorizada y una cuenta YA autorizada tienen que dejar la app
 * exactamente igual (misma red, mismo `walletClient`, mismas lecturas), y por
 * eso la lógica vive acá una sola vez.
 *
 * Lanza si la wallet no se mueve a la red activa, y en ese caso NO deja
 * `walletClient` usable: no hay quién firme.
 */
async function adoptWalletSession(transport, probeWalletClient, address) {
  // La red la manda la wallet: si está en otra, se usa la config de ESA red. El
  // `?chain=` de la URL gana igual (lo resuelve `effectiveNetwork`): es una
  // instrucción, y quien tiene que moverse es la wallet.
  let walletChain = null;
  try {
    walletChain = await probeWalletClient.getChainId();
    activeNetwork = effectiveNetwork(walletChain);
  } catch (error) {
    // Conectado, pero en una red que no está en config.js: sin datos de chain.
    console.warn(error.message, "→ se conecta igual, pero sin datos de chain.");
    activeNetwork = null;
  }
  const chain = activeNetwork ? chainFromConfig(activeNetwork) : undefined;

  walletClient = createWalletClient({
    account: address,
    chain,
    transport,
  });
  walletChainId = walletChain;

  // Si la wallet no está en la red que la página necesita, se le pide que se
  // mueva. Si no se mueve, acá NO hay quién firme: se suelta el cliente y se
  // dice el desajuste (el mismo mensaje que muestra la UI de error de conexión).
  if (activeNetwork && !walletMatchesActiveNetwork()) {
    const moved = await switchToActiveNetwork();
    if (!moved) {
      const mensaje = networkMismatchMessage();
      walletClient = undefined;
      walletChainId = null;
      throw new Error(mensaje);
    }
  }
  // Las LECTURAS no van por la wallet: van por HTTP, así no dependen de que
  // MetaMask esté autorizado ni de la red en la que esté el usuario.
  if (activeNetwork) publicClient = createReadClient();
  // Recién acá hay wallet segura: es el segundo momento en que se aseguran las
  // suscripciones a `accountsChanged` y a `chainChanged` (ver sus `ensure…`).
  ensureAccountsSubscription();
  ensureChainSubscription();
}

/**
 * Conectar la wallet: le PIDE permiso al usuario (`eth_requestAccounts`, que en
 * MetaMask es el popup de autorización) y adopta la sesión con la cuenta que
 * devuelva.
 */
export async function connectWallet() {
  //Solo detecta la wallet solamente si el usuario tiene descargado el plugin en su browser.
  if (!hasWallet()) {
    //Investigar que tipo de error aparece en un proyecto real
    throw new Error("No hay wallet visible, por favor instala una");
  }
  const transport = walletTransport();
  const probeWalletClient = createWalletClient({ transport });
  const [address] = await probeWalletClient.requestAddresses();

  await adoptWalletSession(transport, probeWalletClient, address);
  return address;
}

/**
 * Reconexión SILENCIOSA: si la wallet YA autorizó este sitio, la app vuelve a
 * quedar conectada al cargar la página —así navegar de una página a otra no
 * "desloguea"— sin abrirle ningún prompt al usuario.
 *
 * Por qué es silenciosa, y no un `connectWallet()`: acá se pregunta con
 * `eth_accounts` (`walletClient.getAddresses()`), que devuelve las cuentas YA
 * autorizadas SIN pedirle nada a nadie. El que abre el popup es
 * `eth_requestAccounts` (`requestAddresses()`), y por eso NO se usa: cargar una
 * página no puede hacer saltar un diálogo.
 *
 * Si la wallet contesta `[]` —no hay wallet, el usuario nunca autorizó este
 * sitio, o desconectó explícitamente—, esto no hace absolutamente nada y
 * devuelve `null`: la landing queda como está hoy. Ese último caso es el que
 * hace que el arreglo conviva con `disconnectWallet()`: después de revocar el
 * permiso (`wallet_revokePermissions`) la wallet deja de devolver la cuenta en
 * `eth_accounts`, así que no se reconecta sola.
 *
 * No hay estado local de por medio (nada de `localStorage`, `sessionStorage` ni
 * cookies): la fuente de verdad es la WALLET, que es la única que sabe si este
 * sitio sigue autorizado.
 *
 * Sin wallet devuelve `null` sin lanzar y sin tocar el estado. Puede lanzar si
 * hay cuenta autorizada pero la wallet no se mueve a la red activa: es el mismo
 * desajuste —y el mismo error— que en `connectWallet()`, y quien la llama tiene
 * que decidir qué hacer.
 */
export async function restoreWallet() {
  if (!hasWallet()) return null;
  const transport = walletTransport();
  const probeWalletClient = createWalletClient({ transport });
  // `getAddresses()` = `eth_accounts`: lee, no pide permiso.
  const [address] = await probeWalletClient.getAddresses();
  if (!address) return null;

  await adoptWalletSession(transport, probeWalletClient, address);
  return address;
}

/**
 * Códigos EIP-1193 que la app tiene que distinguir para decidir un camino:
 * la wallet no conoce el método, o el usuario cerró el pedido.
 */
function isUnsupportedMethod(error) {
  const code = error?.code;
  const text = String(error?.message ?? "");
  return (
    code === -32601 ||
    /not supported|unsupported|does not exist|no such method/i.test(text)
  );
}

function isUserRejection(error) {
  const code = error?.code;
  const text = String(error?.message ?? "");
  return code === 4001 || /reject|denied|cancel/i.test(text);
}

/**
 * Se suscribe a `accountsChanged` de la wallet, UNA sola vez y de forma perezosa:
 * se llama al registrar un handler y otra vez al final de un `connectWallet()`
 * exitoso, porque el caso real es una wallet inyectada TARDE (el módulo arranca
 * antes que `window.ethereum`). Idempotente: nunca dos `.on("accountsChanged")`.
 */
function ensureAccountsSubscription() {
  if (accountsSubscribed) return;
  if (!hasWallet() || typeof window.ethereum.on !== "function") return;
  window.ethereum.on("accountsChanged", (accounts) => {
    const list = Array.isArray(accounts) ? accounts : [];
    for (const handler of accountChangeHandlers) {
      try {
        handler(list);
      } catch (error) {
        // Un handler que revienta no puede romper la suscripción ni la página.
        console.warn(
          "Un handler de accountsChanged falló:",
          error?.message ?? error
        );
      }
    }
  });
  accountsSubscribed = true;
}

/**
 * Registra un handler para los cambios de cuenta que haga el usuario EN SU
 * WALLET (MetaMask avisa por `accountsChanged`; la dApp no pregunta). Devuelve
 * la función para desregistrarlo.
 *
 * Sin wallet —o con una wallet sin `.on`— no lanza: devuelve un no-op. El
 * handler se llama siempre dentro de un try/catch, así que uno que reviente no
 * rompe la suscripción ni la página.
 */
export function onWalletAccountsChange(handler) {
  if (typeof handler !== "function") return () => {};
  accountChangeHandlers.add(handler);
  ensureAccountsSubscription();
  return () => {
    accountChangeHandlers.delete(handler);
  };
}

/**
 * Se suscribe a `chainChanged`, UNA sola vez y de forma perezosa: mismo patrón
 * que `ensureAccountsSubscription` —y con bandera propia, para que registrar un
 * handler de red no toque la suscripción de cuentas—.
 *
 * Cuando la wallet avisa que cambió de red: la app recalcula su red activa (con
 * `?chain=` la URL sigue ganando), rehace el cliente de lectura —o lo suelta,
 * para no seguir leyendo la red que la wallet acaba de dejar— y avisa a los
 * handlers. Cada handler va en su try/catch: uno que revienta no puede romper la
 * suscripción ni la página.
 */
function ensureChainSubscription() {
  if (chainSubscribed) return;
  if (!hasWallet() || typeof window.ethereum.on !== "function") return;
  window.ethereum.on("chainChanged", (chainId) => {
    const next = Number(chainId);
    walletChainId = Number.isFinite(next) ? next : null;
    try {
      activeNetwork = effectiveNetwork(walletChainId ?? DEFAULT_CHAIN_ID);
    } catch (error) {
      // La wallet se fue a una red que no está en config.js: sin datos de chain.
      console.warn(error.message, "→ se sigue sin datos de chain.");
      activeNetwork = null;
    }
    publicClient = activeNetwork ? createReadClient() : undefined;
    for (const handler of chainChangeHandlers) {
      try {
        handler(activeNetwork);
      } catch (error) {
        console.warn("Un handler de chainChanged falló:", error?.message ?? error);
      }
    }
  });
  chainSubscribed = true;
}

/**
 * Registra un handler para los cambios de RED que haga el usuario EN SU WALLET
 * (`chainChanged`; la dApp no pregunta). Devuelve la función para desregistrarlo.
 *
 * Mismo contrato que `onWalletAccountsChange`: sin wallet —o con una sin `.on`—
 * no lanza y devuelve un no-op, y el handler se llama dentro de un try/catch.
 */
export function onWalletChainChange(handler) {
  if (typeof handler !== "function") return () => {};
  chainChangeHandlers.add(handler);
  ensureChainSubscription();
  return () => {
    chainChangeHandlers.delete(handler);
  };
}

/**
 * Cambiar de cuenta: pide el SELECTOR de cuentas de la wallet (MetaMask) y
 * reconstruye los clientes con la cuenta elegida.
 *
 * Por qué no alcanza con `connectWallet()`: una vez que la dApp ya tiene el
 * permiso `eth_accounts`, `eth_requestAccounts` contesta con la cuenta
 * seleccionada **sin mostrar ningún popup**, así que la app quedaría pegada a la
 * misma cuenta para siempre. El selector lo abre `wallet_requestPermissions`
 * (método de la wallet, se llama por `window.ethereum` y NO por viem).
 *
 * Devuelve la cuenta nueva, o `null` si el usuario canceló —y en ese caso no
 * toca NADA: la conexión anterior sigue válida y usable—. Sin wallet lanza el
 * mismo error que `connectWallet`.
 */
export async function switchWalletAccount() {
  if (!hasWallet()) {
    throw new Error("No hay wallet visible, por favor instala una");
  }
  try {
    await window.ethereum.request({
      method: "wallet_requestPermissions",
      params: [{ eth_accounts: {} }],
    });
  } catch (error) {
    if (isUnsupportedMethod(error)) {
      // La wallet no tiene selector de cuentas. El fallback es soltar el permiso
      // y volver a pedirlo: ahí sí pregunta qué cuenta.
      await revokeWalletPermissions();
      return connectWallet();
    }
    if (isUserRejection(error)) return null; // cerró el selector: no toca nada
    throw error;
  }
  // Con el permiso renovado, la wallet ya pregunta: la cuenta elegida es la que
  // devuelve `eth_requestAccounts`.
  return connectWallet();
}

/** Suelta el estado de la wallet: la dApp deja de poder firmar y de leer. */
export function disconnectWallet() {
  walletClient = undefined;
  walletChainId = null;
  publicClient = undefined;
}

/**
 * Desconectar del lado de la dApp es soltar el estado; y si la wallet lo
 * soporta, además revocar el permiso para que no se reconecte sola.
 * Nunca lanza: muchas wallets todavía no soportan `wallet_revokePermissions`,
 * y quedarse sin revocar no puede romper la desconexión.
 */
export async function revokeWalletPermissions() {
  try {
    await window.ethereum?.request?.({
      method: "wallet_revokePermissions",
      params: [{ eth_accounts: {} }],
    });
  } catch {
    // Muchas wallets todavía no soportan wallet_revokePermissions: seguimos.
  }
}
