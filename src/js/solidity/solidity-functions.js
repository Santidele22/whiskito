import { formatEther, parseEther } from "https://esm.sh/viem";
import { FUND_ABI } from "./fund-abi.js";
import { getPublicClient, getActiveNetwork, getWalletClient } from "./chain.js";
import { shortAddress, relativeTime } from "../utils/format.js";
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
 * Precio POL→USD, ya normalizado a 18 decimales.
 */
export async function readPolPrice() {
  return Number(
    formatEther(await readContract("getConversionRate", [10n ** 18n]))
  );
}

/**
 * Cuántos bloques abarca cada pedido de eventos `Funded`, caminando hacia atrás
 * desde el head.
 *
 * Por qué existe: medido contra los RPC públicos de Amoy con `eth_getLogs`, el
 * que usa la app (publicnode) corta el rango en **10.000 bloques**. Pedir desde
 * el deploy no es una opción en una red real: son ~48 millones de bloques y,
 * además, el head de Amoy avanza cada ~2 s, así que un único pedido grande
 * dejaría de entrar en el tope a las pocas horas. 5.000 deja la mitad del tope
 * como margen.
 */
const EVENT_WINDOW_BLOCKS = 5000n;

/**
 * Todas las donaciones que recibió `professional`, más nuevas primero, con la
 * forma que pinta la tabla del historial (`donorShort` / `amountPol`).
 *
 * El `limit` (200 por defecto) existe para que una dirección con miles de
 * donaciones no vuelque todo en la tabla: se descartan las más viejas
 * y quedan las últimas `limit`. El orden es más nuevas primero porque es el
 * orden en el que uno quiere ver la historia al abrir la página.
 *
 * El `usd` sale del propio evento (`usdValue`), no de multiplicar por el precio
 * de ahora: es el valor que el contrato dejó grabado en el momento de donar.
 *
 * Por qué la fila lleva `donor`, `txHash` y `blockNumber` de más (se agregaron
 * para la página `/historial`, que necesita identificar cada donación y linkear
 * su transacción): `donorShort` es la dirección ACORTADA —con eso no se puede
 * reconstruir la dirección completa ni comparar dos filas del mismo donante de
 * forma confiable— y ni el hash ni el bloque venían en la fila. Son campos
 * ADITIVOS: se agregan al final de cada fila y no cambian el nombre, el
 * significado ni el orden de los cuatro que ya existían, así que `readDonations`
 * —que desestructura sólo esos cuatro— sigue leyendo lo mismo. Tampoco cambian el
 * `limit`, el `usd` ni el orden (más nuevas primero).
 *
 * `blockNumber` viaja como **string** (`String(event.blockNumber)`), decidido y
 * no accidental: el resto de los campos de la fila son texto y así una fila se
 * puede serializar sin sorpresas con un `bigint` adentro. Para comparar u
 * ordenar, se convierte con `BigInt(...)`.
 */
export async function readDonationHistory(professional, { limit = 200 } = {}) {
  const client = getPublicClient();
  const network = getActiveNetwork();
  // El piso lo declara cada red en `NETWORKS` (config.js): es el primer bloque
  // en el que existe el contrato, o sea el deploy. Por debajo no hay eventos y
  // pedirlos es tirar el rango a la basura (en Amoy, 48 millones de bloques).
  const floor = BigInt(network.deployBlock ?? 0n);
  const head = await client.getBlockNumber();
  // Se pide por ventanas hacia atrás desde el head, sin bajar del deploy, y se
  // corta al juntar `limit` eventos: así el pedido entra en el tope del RPC por
  // más que la chain crezca, y sigue trayendo lo mismo (lo más nuevo primero).
  let events = [];
  let toBlock = head;
  while (events.length < limit && toBlock >= floor) {
    const fromBlock =
      toBlock - EVENT_WINDOW_BLOCKS + 1n > floor
        ? toBlock - EVENT_WINDOW_BLOCKS + 1n
        : floor;
    const chunk = await client.getContractEvents({
      address: network.fund,
      abi: FUND_ABI,
      eventName: "Funded",
      args: { professional },
      fromBlock,
      toBlock,
    });
    // Cada ventana llega de más viejo a más nuevo y las ventanas van hacia
    // atrás, así que lo viejo se ANTEPONE a lo acumulado y el orden queda igual
    // al de un pedido único.
    events = chunk.concat(events);
    toBlock = fromBlock - 1n;
  }
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
      amountPol: formatEther(event.args.ethAmount),
      usd: Number(formatEther(event.args.usdValue)).toFixed(2),
      when: relativeTime(await timestampOf(event.blockNumber)),
      // Aditivos, para la página `/historial`: la dirección COMPLETA del
      // donante (tal cual viene en el evento, sin acortar), el hash de la
      // transacción y el bloque. Ver la nota de arriba.
      donor: event.args.donor,
      txHash: event.transactionHash,
      blockNumber: String(event.blockNumber),
    }))
  );
}

/**
 * Las últimas 10 donaciones, con la forma del panel de resumen
 * (`address` / `pol`). Traduce las filas de `readDonationHistory`: la lectura de
 * eventos y el formateo viven en un solo lugar.
 */
export async function readDonations(professionalAddress) {
  const rows = await readDonationHistory(professionalAddress, { limit: 10 });
  // El panel del resumen habla de `address`/`pol`: la traducción vive acá.
  return rows.map(({ donorShort, amountPol, usd, when }) => ({
    address: donorShort,
    pol: amountPol,
    usd,
    when,
  }));
}

/**
 * El balance disponible de `address`, ya en POL como texto.
 *
 * Es la ÚNICA lectura de `balances`: la usan el portfolio de la página y el saldo
 * que la tabla del historial muestra en la vista del profesional. Dos lecturas
 * del mismo dato en dos lugares es justamente lo que hacía que una isla pudiera
 * quedar mostrando un saldo viejo.
 */
export async function readBalance(address) {
  return formatEther(await readContract("balances", [address]));
}

export async function readPortfolio(professionalAddress) {
  const balancePol = await readBalance(professionalAddress);
  const polPrice = await readPolPrice();
  return {
    balancePol,
    balanceUsd: (Number(balancePol) * polPrice).toFixed(2),
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
 * Retira `amount` POL (no wei: se convierte acá) del balance de quien firma y
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
