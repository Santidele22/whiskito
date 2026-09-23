#!/usr/bin/env node
/**
 * Chequeo de drift: que las direcciones de `src/config.js` sean las del último
 * deploy de Foundry.
 *
 * Las direcciones de anvil son determinísticas (mismo deployer, mismo nonce),
 * pero si alguien agrega un `new` antes en el script, o cambia el orden, se
 * corren todas. Este chequeo lo detecta antes de que la app le hable a un
 * contrato que ya no existe en esa dirección.
 *
 * Uso:  node .refactor-baseline/check-config.mjs
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const BROADCAST = join(ROOT, "broadcast");

const { NETWORKS } = await import(pathToFileURL(join(ROOT, "src/js/config.js")).href);

if (!existsSync(BROADCAST)) {
  console.log("No hay broadcast/ todavía: no hay deploy con el que comparar.");
  process.exit(0);
}

// El último run de cada chainId
const corridas = [];
for (const script of readdirSync(BROADCAST)) {
  const dir = join(BROADCAST, script);
  if (!existsSync(dir) || !readdirSync(dir).some(() => true)) continue;
  for (const chain of readdirSync(dir)) {
    const ultimo = join(dir, chain, "run-latest.json");
    if (existsSync(ultimo)) corridas.push({ script, chain, archivo: ultimo });
  }
}

if (!corridas.length) {
  console.log("No encontré ningún run-latest.json en broadcast/.");
  process.exit(0);
}

const problemas = [];
for (const { script, chain, archivo } of corridas) {
  const data = JSON.parse(readFileSync(archivo, "utf8"));
  const desplegados = new Map(
    (data.transactions ?? [])
      .filter((t) => t.contractAddress)
      .map((t) => [t.contractName, t.contractAddress.toLowerCase()]),
  );
  const red = NETWORKS[Number(chain)];
  if (!red) {
    problemas.push(`broadcast de la red ${chain} (${script}) sin entrada en NETWORKS`);
    continue;
  }
  // `priceFeed` puede ser el mock local (anvil) o el adaptador POL/USD (Amoy): los dos
  // implementan `AggregatorV3Interface` y el `Fund` los recibe igual por constructor.
  for (const [clave, contratos] of [
    ["fund", ["Fund"]],
    ["priceFeed", ["MockV3Aggregator", "PolUsdAdapter"]],
  ]) {
    const real = contratos.map((n) => desplegados.get(n)).find(Boolean);
    if (!real) continue; // esta red no desplegó ese contrato
    const esperado = red[clave]?.toLowerCase();
    if (esperado !== real) {
      problemas.push(
        `red ${chain} · ${clave}: config.js dice ${red[clave]} y el broadcast dice ${real} (${contratos.join(" o ")})`,
      );
    }
  }
  console.log(
    `red ${chain} · ${script}: ${[...desplegados].map(([n, a]) => `${n}=${a}`).join(" · ")}`,
  );
}

if (problemas.length) {
  console.log(`\nDRIFT(${problemas.length}):`);
  for (const p of problemas) console.log(" - " + p);
  process.exit(1);
}
console.log("\nOK :: config.js coincide con el último deploy");
