export const shortAddress = (address) =>
  address && address.length > 10
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : address ?? "";

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
