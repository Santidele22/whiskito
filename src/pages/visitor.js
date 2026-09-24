import { PROFESSIONAL_CLASS } from "./profesional.js";

/**
 * Vista del visitante: la landing tal como viene en `src/index.html`.
 *
 * No reescribe el DOM a propósito. La puerta e2e mide los 11 hosts custom en
 * light DOM ANTES de conectar (aserción A1) y exige las islas vivas en el MISMO
 * documento DESPUÉS de conectar: desmontar o reescribir markup rompería las dos.
 * Por eso volver a la vista del visitante es sólo quitar la clase del body —las
 * reglas que ocultan los bloques del profesional viven colgadas de esa clase— y
 * el DOM que ya estaba sigue siendo, literalmente, el de siempre.
 */
export function showVisitor(root = document.body) {
  if (!root || !root.classList) return;
  root.classList.remove(PROFESSIONAL_CLASS);
}
