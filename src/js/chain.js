//LIBRARIES
import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  http,
} from "https://esm.sh/viem";

//CONFIGURACIÓN (redes y constantes de la app)
import { DEFAULT_CHAIN_ID, effectiveNetwork } from "./config.js";

let walletClient;
let publicClient;
/** Red con la que está trabajando la app: la de la wallet, o la de por defecto. */
let activeNetwork = effectiveNetwork(DEFAULT_CHAIN_ID);

/** Handlers registrados para `accountsChanged` (ver `onWalletAccountsChange`). */
const accountChangeHandlers = new Set();
/**
 * ¿Ya hay UNA suscripción a `accountsChanged`? Sin esta bandera, cada handler
 * registrado agregaría otra: la wallet avisaría tantas veces como registros haya.
 */
let accountsSubscribed = false;

/**
 * La moneda nativa de la red. Cada entrada de `NETWORKS` (config.js) la declara
 * —anvil usa Ether, Amoy usa POL—; si una red no la declara, se cae a Ether/ETH.
 */
const DEFAULT_NATIVE_CURRENCY = { name: "Ether", symbol: "ETH", decimals: 18 };

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

export async function connectWallet() {
  //Solo detecta la wallet solamente si el usuario tiene descargado el plugin en su browser.
  if (!hasWallet()) {
    //Investigar que tipo de error aparece en un proyecto real
    throw new Error("No hay wallet visible, por favor instala una");
  }
  const transport = custom(window.ethereum);
  const probeWalletClient = createWalletClient({ transport });
  const [address] = await probeWalletClient.requestAddresses();

  // La red la manda la wallet: si está en otra, se usa la config de ESA red.
  try {
    activeNetwork = effectiveNetwork(await probeWalletClient.getChainId());
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
  // Las LECTURAS no van por la wallet: van por HTTP, así no dependen de que
  // MetaMask esté autorizado ni de la red en la que esté el usuario.
  if (activeNetwork) publicClient = createReadClient();
  // Recién acá hay wallet segura: es el segundo momento en que se asegura la
  // suscripción a `accountsChanged` (ver `ensureAccountsSubscription`).
  ensureAccountsSubscription();
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
