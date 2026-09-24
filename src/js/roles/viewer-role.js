/**
 * Viewer role: quién está mirando esta página y qué puede hacer.
 *   - **page owner**   → el profesional dueño de la página (el que recibe).
 *   - **viewer**       → quien está mirando; puede ser el dueño, un donante, o nadie.
 *   - **viewer role**  → `guest | donor | owner`. Se DERIVA, no se elige.
 *   - **isOwner**      → la comparación cuenta ↔ dueño.
 *   - **role gating**  → mostrar/ocultar acciones según el rol.
 */

export const VIEWER_ROLE = {
  /** Sin wallet: puede mirar, no puede actuar. */
  GUEST: "guest",
  /** Conectado, pero no es el dueño de esta página: puede donar. */
  DONOR: "donor",
  /** Conectado y *es* el dueño: puede retirar. */
  OWNER: "owner",
};

export function isOwner(account, pageOwner) {
  if (!account || !pageOwner) return false;
  return account.toLowerCase() === pageOwner.toLowerCase();
}

export function resolveViewerRole({ account, pageOwner } = {}) {
  if (!account) return VIEWER_ROLE.GUEST;
  // Ojo: se compara contra el dueño EFECTIVO, no contra el de la URL. Si la URL
  // no dice de quién es la página, el que conecta es el dueño (es el flujo
  // "conectá y empezá a recibir"); si la dice, sólo ese es el dueño.
  const effectiveOwner = resolveEffectiveOwner({ account, pageOwner });
  return isOwner(account, effectiveOwner) ? VIEWER_ROLE.OWNER : VIEWER_ROLE.DONOR;
}

/**
 * El dueño de la página, según la URL: `?u=0x…` o la ruta `/u/0x…`.
 * Devuelve null si la URL no lo dice (ahí la página no tiene dueño todavía).
 */
export function resolvePageOwner(url = globalThis.location) {
  if (!url) return null;
  const ownerFromQuery = new URLSearchParams(url.search ?? "").get("u");
  const ownerFromPath = String(url.pathname ?? "").match(
    /\/u\/(0x[0-9a-fA-F]{40})/
  )?.[1];
  return ownerFromQuery ?? ownerFromPath ?? null;
}

/**
 * ¿Puede donar? El dueño no se dona a sí mismo.
 *
 * En modo demo (`demo: true`) sí puede: no se firma nada, así que probar la
 * donación en tu propia página no puede hacer daño —y es justo lo que uno quiere
 * probar al abrir su `/u/0x…`—. Con donaciones reales la regla no cambia, porque
 * el contrato acredita al dueño y donarse a uno mismo no tiene sentido.
 *
 * El default es `false` para que las llamadas que ya existen sigan significando
 * exactamente lo mismo que antes.
 */
export function canDonate(role, { demo = false } = {}) {
  return demo || role !== VIEWER_ROLE.OWNER;
}

/**
 * ¿Puede retirar? Sólo el dueño. Y si la UI se equivoca, el contrato revierte
 * igual: `withdraw` usa `balances[msg.sender]`, no un parámetro.
 */
export function canWithdraw(role) {
  return role === VIEWER_ROLE.OWNER;
}

/**
 * El dueño efectivo de la página: el de la URL, o el que conecta si la URL no
 * dice nada (es el flujo "conectá y empezá a recibir", donde la página es tuya).
 */
export function resolveEffectiveOwner({ account, pageOwner } = {}) {
  return pageOwner ?? account ?? null;
}
