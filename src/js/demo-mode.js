/**
 * ¿La LANDING está presentando la demo o el camino real on-chain?
 *
 * Ojo con el alcance: el modo demo es de la **landing** (el "Acto II", la
 * tarjeta de la sección "Querés invitar un whiskito"). La **página del link**
 * (`/u/0x…`) no lo usa: ahí la donación es real siempre, y su flujo
 * (`donate.js`) no le pasa `demo` a `fund()`. Quien sí se lo pasa es `app.js`.
 *
 * Es un módulo HOJA a propósito: no importa nada ni toca el DOM (igual que
 * `config.js`), así que se puede importar desde cualquier lado —incluidos los
 * scripts de verificación, que lo corren con Node— sin arrastrar la chain.
 *
 * El default es `true`: el visitante de la landing tiene que poder ver la
 * donación completa sin wallet y sin gas, y que la landing prometa el camino
 * real sin poder firmar sería una promesa vacía. `?demo=0` (o `?demo=false`)
 * devuelve el camino real también ahí, y `?real=1` es el mismo pedido dicho al
 * revés. Cualquier otro valor no se interpreta como "apagar": un typo no puede
 * convertir una demo en una firma.
 */
export const DEMO = (() => {
  const params = new URLSearchParams(globalThis.location?.search ?? "");
  if (params.get("demo") === "0" || params.get("demo") === "false") return false;
  if (params.get("real") === "1") return false;
  return true;
})();
