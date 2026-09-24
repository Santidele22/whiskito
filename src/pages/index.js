/**
 * Router de vistas de la landing.
 *
 * Son dos vistas —visitante y profesional— y una sola página: el cambio es la
 * clase del body (`is-profesional`) más la isla del historial que el profesional
 * monta en runtime. Acá sólo se decide CUÁL de las dos manda; quién oculta y
 * quién monta vive en cada vista.
 */
import { hideProfesional, showProfesional } from "./profesional.js";
import { showVisitor } from "./visitor.js";

/** Las dos vistas posibles. */
export const VIEW = {
  VISITOR: "visitor",
  PROFESIONAL: "profesional",
};

/** La última vista que se pidió (arranca en la del visitante). */
let current = VIEW.VISITOR;

/** La vista que quedó puesta. */
export function currentView() {
  return current;
}

/**
 * Enciende una vista y la recuerda.
 *
 * Siempre llama a la función de la vista (las dos son idempotentes), así que
 * pedir dos veces la misma vista no duplica nada ni deja basura. Cualquier valor
 * que no sea `VIEW.PROFESIONAL` cae a la vista del visitante.
 *
 * @param {string} view `VIEW.VISITOR` o `VIEW.PROFESIONAL`.
 * @param {{ address?: string, base?: string }} [context] datos del profesional.
 * @returns {string} la vista que quedó puesta.
 */
export function showView(view, context = {}) {
  if (view === VIEW.PROFESIONAL) {
    showProfesional(context);
    current = VIEW.PROFESIONAL;
  } else {
    showVisitor();
    // Y la isla que la vista del profesional monta se DESMONTA: la landing del
    // visitante es el DOM que viene en `index.html` y nada más, así que después
    // de conectar y desconectar el documento vuelve a tener sus 11 hosts y no
    // queda una isla del profesional escondida por CSS. `showVisitor` sola no lo
    // hace porque también se la puede llamar por su cuenta, sin router.
    hideProfesional();
    current = VIEW.VISITOR;
  }
  return current;
}
