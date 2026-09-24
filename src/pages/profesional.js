/**
 * Vista del profesional: el backstage de quien recibe las donaciones.
 *
 * El cambio de vista es SÓLO CSS (ocultar) más dos islas nuevas montadas en
 * runtime. Las 11 islas del visitante no se desmontan ni se reescriben: los
 * bloques que el profesional no muestra se esconden con la clase del body y las
 * reglas de `styles.css` (los hosts del visitante están en `display: contents`,
 * así que el `[hidden]` del navegador no alcanza: hace falta un selector más
 * específico, el `body.is-profesional > :is(…)`).
 */

/** Clase del body que enciende la vista del profesional. */
export const PROFESSIONAL_CLASS = "is-profesional";

/**
 * TagNames que la vista del profesional NO muestra.
 *
 * El `whiskito-panel` está acá porque su contenido no es el de esta vista: el
 * backstage ya no muestra el resumen del panel (balance, donaciones y botones de
 * retiro) porque el historial va INLINE, con la tabla completa. El retiro sigue
 * accesible, y ahora vive en esa tabla: la isla
 * `whiskito-history-table` es la que lo ofrece (`canWithdraw`) cuando el flujo
 * enciende la vista del profesional. El panel no se toca: sigue siendo el recinto
 * de retiro de la vista del visitante.
 *
 * El orden del DOM es el que manda para el resto de los bloques: el profesional
 * ve `whiskito-navbar`, después el saludo (`whiskito-pro-greeting`) y la tabla
 * del historial (`whiskito-history-table`), montados en runtime, más
 * `whiskito-share-card` (mi link; es un widget `position: fixed`, su lugar en el
 * flujo no se ve).
 *
 * Esta lista es el espejo en JS de la regla CSS de `styles.css`: acá se declara
 * QUÉ se oculta y allá CÓMO (una sola regla, misma lista de tags).
 */
export const HIDDEN_IN_PROFESSIONAL = [
  "whiskito-hero",
  "whiskito-how-it-works",
  "whiskito-panel",
  "whiskito-trust",
  "whiskito-faq",
  "whiskito-footer",
  "whiskito-radio",
];

/** El tag del saludo del profesional (se crea en runtime, no está en el HTML). */
export const PRO_GREETING_TAG = "whiskito-pro-greeting";

/** El tag de la tabla del historial inline (tampoco está en el HTML). */
export const PRO_HISTORY_TABLE_TAG = "whiskito-history-table";

/**
 * El host después del cual se montan las dos islas.
 *
 * Es el navbar y no el panel —como era antes— porque el panel ya no pertenece a
 * esta vista: el orden visual del profesional es navbar → saludo → historial.
 */
const INSERT_AFTER_SELECTOR = "whiskito-navbar";

/**
 * Devuelve la isla `tag`, creándola y montándola si todavía no existe.
 * Idempotente: si ya está en el documento, la reusa (no la duplica).
 *
 * `after` es el host después del cual va cuando hay que crearla.
 */
function ensureIsland(tag, after) {
  const existing = document.querySelector(tag);
  if (existing) return existing;

  const island = document.createElement(tag);
  const anchor =
    after ?? document.querySelector(INSERT_AFTER_SELECTOR) ?? null;
  if (anchor?.parentElement) {
    anchor.after(island);
  } else {
    // Sin ancla (otra página, o una landing sin el host) la isla igual se monta.
    document.body.append(island);
  }
  return island;
}

/**
 * Enciende la vista del profesional: el saludo y, debajo, la tabla del historial
 * inline.
 *
 * Idempotente: llamarla dos veces no duplica las islas y siempre reescribe
 * `address` (los datos pueden cambiar entre llamadas). El orden es el del DOM:
 * el saludo primero, la tabla después.
 *
 * @param {{ address?: string, base?: string }} [context] `base` se acepta por el
 *   contrato del router pero ya no se usa: las dos islas nuevas no arman ningún
 *   href (la tabla se muestra inline, no linkea a `/historial`).
 * @returns {{ greeting: HTMLElement, table: HTMLElement }|null}
 */
export function showProfesional({ address = "" } = {}) {
  const body = document.body;
  if (!body) return null;

  body.classList.add(PROFESSIONAL_CLASS);

  const greeting = ensureIsland(PRO_GREETING_TAG);
  // La tabla va DESPUÉS del saludo: `after` es el saludo recién asegurado.
  const table = ensureIsland(PRO_HISTORY_TABLE_TAG, greeting);
  greeting.address = address;
  table.address = address;
  return { greeting, table };
}

/**
 * Apaga la vista del profesional: quita la clase del body y desmonta LAS DOS
 * islas (las únicas piezas que la vista del visitante no tiene en su HTML).
 */
export function hideProfesional() {
  const body = document.body;
  if (!body) return;
  body.classList.remove(PROFESSIONAL_CLASS);
  document.querySelector(PRO_GREETING_TAG)?.remove();
  document.querySelector(PRO_HISTORY_TABLE_TAG)?.remove();
}
