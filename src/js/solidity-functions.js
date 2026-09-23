import { formatEther, parseEther } from "https://esm.sh/viem";
import { FUND_ABI } from "./fund-abi.js";
import { getPublicClient, getActiveNetwork, getWalletClient } from "./chain.js";
import { shortAddress, relativeTime } from "./format.js";
// Las verificaciones que TODA escritura comparte (red, wallet, simulación
// previa, status del recibo). Acá no se repite ninguna: ver `tx.js`.
import { requireNetwork, requirePublicClient, writeAndConfirm } from "./tx.js";

/** Una lectura al contrato. Un solo lugar donde están la dirección y el ABI. */
export function readContract(functionName, args = []) {
  const network = requireNetwork();
  return requirePublicClient().readContract({
    address: network.fund,
    abi: FUND_ABI,
    functionName,
    args,
  });
}

/**
 * Precio ETH→USD, ya normalizado a 18 decimales.
 */
export async function readEthPrice() {
  return Number(
    formatEther(await readContract("getConversionRate", [10n ** 18n]))
  );
}

/**
 * Todas las donaciones que recibió `professional`, más nuevas primero, con la
 * forma que pinta "Mi Panel" (`donorShort` / `amountEth`).
 *
 * El `limit` (200 por defecto) existe para que una dirección con miles de
 * donaciones no vuelque todo en la tabla del modal: se descartan las más viejas
 * y quedan las últimas `limit`. El orden es más nuevas primero porque es el
 * orden en el que uno quiere ver la historia al abrir el panel.
 *
 * El `usd` sale del propio evento (`usdValue`), no de multiplicar por el precio
 * de ahora: es el valor que el contrato dejó grabado en el momento de donar.
 */
export async function readDonationHistory(professional, { limit = 200 } = {}) {
  const client = getPublicClient();
  const events = await client.getContractEvents({
    address: getActiveNetwork().fund,
    abi: FUND_ABI,
    eventName: "Funded",
    args: { professional },
    fromBlock: 0n, // en anvil alcanza; en una red real conviene acotar el rango
  });
  // Los eventos llegan de más viejo a más nuevo: se cortan los últimos y se
  // invierte. Se calcula el índice en vez de usar `slice(-limit)` porque con
  // `limit = 0` ese `-0` no corta nada y devolvería la historia entera.
  const recentEvents = events
    .slice(Math.max(0, events.length - limit))
    .reverse();
  // Varios eventos pueden caer en el MISMO bloque, así que el timestamp se pide
  // por bloque único: sin esto, 200 donaciones serían 200 `getBlock` de más. Se
  // cachea la promesa (no el valor) para que dos eventos del mismo bloque
  // compartan UNA sola petición aunque se pidan en paralelo.
  const blocks = new Map();
  const timestampOf = (blockNumber) => {
    if (!blocks.has(blockNumber)) {
      blocks.set(
        blockNumber,
        client.getBlock({ blockNumber }).then((block) => block.timestamp)
      );
    }
    return blocks.get(blockNumber);
  };
  return Promise.all(
    recentEvents.map(async (event) => ({
      donorShort: shortAddress(event.args.donor),
      amountEth: formatEther(event.args.ethAmount),
      usd: Number(formatEther(event.args.usdValue)).toFixed(2),
      when: relativeTime(await timestampOf(event.blockNumber)),
    }))
  );
}

/**
 * Las últimas 10 donaciones, con la forma del panel de resumen
 * (`address` / `eth`). Traduce las filas de `readDonationHistory`: la lectura de
 * eventos y el formateo viven en un solo lugar.
 */
export async function readDonations(professionalAddress) {
  const rows = await readDonationHistory(professionalAddress, { limit: 10 });
  // El panel del resumen habla de `address`/`eth`: la traducción vive acá.
  return rows.map(({ donorShort, amountEth, usd, when }) => ({
    address: donorShort,
    eth: amountEth,
    usd,
    when,
  }));
}

/**
 * El balance disponible de `address`, ya en ETH como texto.
 *
 * Es la ÚNICA lectura de `balances`: la usan el portfolio de la página y el
 * modal "Mi Panel" (que muestra el balance de la cuenta conectada). Dos lecturas
 * del mismo dato en dos lugares es justamente lo que hacía que el modal pudiera
 * quedar mostrando un saldo viejo.
 */
export async function readBalance(address) {
  return formatEther(await readContract("balances", [address]));
}

export async function readPortfolio(professionalAddress) {
  const balanceEth = await readBalance(professionalAddress);
  const ethPrice = await readEthPrice();
  return {
    balanceEth,
    balanceUsd: (Number(balanceEth) * ethPrice).toFixed(2),
    donations: await readDonations(professionalAddress),
  };
}

/**
 * Manda el whiskito: firma con la wallet y espera el recibo de verdad.
 *
 * El modo lo decide la PÁGINA y lo pasa el flujo en `demo`:
 *   - la **landing** invita en modo demo (`app.js` pasa `DEMO`, el default de
 *     `demo-mode.js`): simula el retardo y no firma nada, aunque haya wallet;
 *   - la **página del link** (`/u/0x…`) cobra de verdad: `donate.js` no pasa
 *     `demo`, así que se firma contra el contrato.
 * Sin wallet no hay quién firme en ninguna de las dos, así que ahí también se
 * simula; el recibo lo dice con `demo: true` y el flujo elige qué anunciar.
 */
export async function fund({ amount, professional, demo = false }) {
  const wallet = getWalletClient();
  // `demo` lo decide la PÁGINA que dona y lo pasa su flujo: la landing invita en
  // modo demo (no se firma nada) y la página del link (`/u/0x…`) cobra de
  // verdad. Sin wallet no hay quién firme en ninguna de las dos: ahí también se
  // simula, y el recibo lo dice con `demo: true`.
  if (demo || !wallet) {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    return { donor: wallet?.account?.address ?? "", demo: true };
  }
  const { hash, account } = await writeAndConfirm({
    functionName: "fund",
    // A quién le dona: el dueño de ESTA página (`/u/0x…`), o el de config.js
    // como último recurso para la demo local.
    args: [professional],
    value: parseEther(String(amount)),
  });
  return { donor: account, hash };
}

/** Retira TODO el balance de quien firma y espera el recibo. Devuelve el hash. */
export async function withdrawAll() {
  const { hash } = await writeAndConfirm({ functionName: "withdrawAll" });
  return hash;
}

/**
 * Retira `amount` ETH (no wei: se convierte acá) del balance de quien firma y
 * espera el recibo. Devuelve el hash.
 *
 * No recibe a quién retirarle: el contrato usa `balances[msg.sender]`, así que
 * el destinatario es siempre la cuenta que firma. Pedirle una dirección sería
 * una mentira en la firma.
 */
export async function withdraw(amount) {
  const { hash } = await writeAndConfirm({
    functionName: "withdraw",
    args: [parseEther(String(amount))],
  });
  return hash;
}
