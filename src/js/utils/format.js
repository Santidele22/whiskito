export const shortAddress = (address) =>
  address && address.length > 10
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : address ?? "";

/**
 * Redondea al número de decimales pedido sin los arrastres del binario.
 *
 * Vive acá —y no en cada isla— porque los formateadores de monto los comparten
 * el panel, la tabla del historial y su resumen: una sola implementación, igual
 * que el resto de los formateadores de este módulo.
 */
function roundTo(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Formatea un monto nativo (ETH/POL) con `decimals` decimales, sin ceros de
 * cola: `formatEth(0.0842)` → `"0.0842"`.
 *
 * El default es 4 decimales (la lectura de un saldo); el resumen de la tabla
 * del historial usa 6, el mismo criterio con el que suma.
 *
 * @param {string|number} value
 * @param {number} [decimals]
 * @returns {string}
 */
export function formatEth(value, decimals = 4) {
  return String(roundTo(Number(value) || 0, decimals));
}

/** Formatea un monto en dólares: siempre 2 decimales (`269.4` → `269.40`). */
export function formatUsd(value) {
  return (Number(value) || 0).toFixed(2);
}

/** "hace 2 min", "ayer"… a partir del timestamp del bloque. */
export function relativeTime(timestampSeconds) {
  const seconds = Math.max(
    0,
    Math.floor(Date.now() / 1000 - Number(timestampSeconds))
  );
  if (seconds < 60) return "hace un instante";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "ayer" : `hace ${days} días`;
}
