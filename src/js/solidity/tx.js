import {
  getPublicClient,
  getActiveNetwork,
  getWalletClient,
  getWalletChainId,
  walletMatchesActiveNetwork,
} from "./chain.js";
import { networkMismatchMessage } from "./errors.js";
import { FUND_ABI } from "./fund-abi.js";

/**
 * The configured network, or a clear error.
 *
 * Es la red de la PÁGINA y no exige nada de la wallet: las lecturas van por HTTP
 * al RPC de esa red y tienen que funcionar sin nadie conectado (ley §2.4). Por
 * eso la comparación con la red de la wallet NO vive acá.
 */
export function requireNetwork() {
  const network = getActiveNetwork();
  if (!network) throw new Error("Todavía no hay una red configurada");
  return network;
}

/**
 * La red configurada **y** que la wallet esté en ella.
 *
 * La firma sale de la wallet y va al contrato de la red activa: si la wallet
 * quedó en otra chain, la escritura se frena acá —antes de simular y de
 * firmar— en vez de mandar la transacción a la red equivocada. La comparación
 * vive en `chain.js` y el texto del desajuste en `errors.js`, no acá. **Sólo la
 * usa el camino de escritura**: leer no necesita wallet, así que un desajuste no
 * puede dejar la página sin datos.
 */
export function requireSigningNetwork() {
  const network = requireNetwork();
  if (getWalletClient() && !walletMatchesActiveNetwork()) {
    throw new Error(
      networkMismatchMessage(getWalletChainId(), network.chainId)
    );
  }
  return network;
}

/** The READ client, or a clear error: without it nothing can be verified. */
export function requirePublicClient() {
  const readClient = getPublicClient();
  if (!readClient) throw new Error("Todavía no hay un cliente de lectura");
  return readClient;
}

/** The WALLET client, or a clear error: no wallet means nobody to sign. */
export function requireWalletClient() {
  const wallet = getWalletClient();
  if (!wallet) throw new Error("No hay wallet conectada: no hay quién firme");
  return wallet;
}

/**
 * Check BEFORE signing: asks the chain what would happen with this write,
 * without writing it. Returns the already simulated `request`, ready to hand
 * over to `writeContract`.
 */
export async function simulateWrite({ functionName, args = [], value } = {}) {
  const network = requireSigningNetwork();
  const wallet = requireWalletClient();
  const { request } = await requirePublicClient().simulateContract({
    address: network.fund,
    abi: FUND_ABI,
    functionName,
    args,
    value,
    // `account` is the msg.sender of the simulation: without it the chain
    // simulates from the zero address and the result says nothing about the
    // real user.
    account: wallet.account,
  });
  return request;
}

/**
 * Check AFTER signing: waits for the receipt and requires that it mined fine.
 * A mined revert does not throw on its own: the status has to be looked at, or
 * the UI lies.
 */
export async function confirmReceipt(hash) {
  const receipt = await requirePublicClient().waitForTransactionReceipt({
    hash,
  });
  if (receipt.status !== "success")
    throw new Error("La transacción se revirtió");
  return receipt;
}

/**
 * The only way to WRITE to the contract, with the checks in order:
 * simulate → sign → confirm. Returns the hash and the account that signed.
 */
export async function writeAndConfirm({ functionName, args = [], value } = {}) {
  const wallet = requireWalletClient(); // the one that will sign
  const request = await simulateWrite({ functionName, args, value });
  const hash = await wallet.writeContract(request);
  await confirmReceipt(hash);
  return { hash, account: wallet.account.address };
}
