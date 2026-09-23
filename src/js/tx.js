import { getPublicClient, getActiveNetwork, getWalletClient } from "./chain.js";
import { FUND_ABI } from "./fund-abi.js";

/** The configured network, or a clear error. */
export function requireNetwork() {
  const network = getActiveNetwork();
  if (!network) throw new Error("Todavía no hay una red configurada");
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
  const network = requireNetwork();
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
