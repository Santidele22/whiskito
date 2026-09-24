// ── ISLAS REACTIVAS ──────────────────────────────────────────────────
function findIsland(selector) {
  return document.querySelector(selector);
}

/** Estado de la conexión de la wallet: `disconnected | connecting | connected | unsupported`. */
export function setConnectionState(state) {
  const navbar = findIsland("whiskito-navbar");
  if (!navbar) return;
  navbar.connectionState = state;
}

/** La cuenta conectada, para que el navbar la muestre. */
export function setNavbarAccount(address) {
  const navbar = findIsland("whiskito-navbar");
  if (!navbar) return;
  navbar.account = address;
}

/**
 * El navbar de una página APARTE (`/historial`): con la base del sitio, sus
 * cuatro links apuntan a la landing con su ancla y aparece el control de volver
 * al inicio. Sin llamarlo —o con `""`— el navbar queda en su modo de siempre, el
 * de la landing.
 */
export function setNavbarBase(base) {
  const navbar = findIsland("whiskito-navbar");
  if (!navbar) return;
  navbar.base = base ?? "";
}

/** El panel: de quién es la página y quién mira (la isla deriva isOwner / notOwner). */
export function setPanelViewer({ owner, viewer }) {
  const panel = findIsland("whiskito-panel");
  if (!panel) return;
  panel.owner = owner;
  panel.viewer = viewer;
}

export function showPortfolio({ balancePol, balanceUsd, donations }) {
  const panel = findIsland("whiskito-panel");
  if (!panel) return;
  panel.balancePol = balancePol;
  panel.balanceUsd = balanceUsd;
  panel.donations = donations;
}

/**
 * Estado de la retirada; el mensaje sólo se pisa si viene uno.
 *
 * El veredicto es uno solo y hay DOS islas que retiran (el panel y la tabla del
 * historial de la vista del profesional), así que se escribe en las dos: si el
 * retiro salió de la tabla, el panel de atrás también tiene que dejar de mentir
 * —y al revés—. Una sola verdad para dos islas.
 */
export function setWithdrawStatus(status, message) {
  for (const island of [
    findIsland("whiskito-panel"),
    findIsland("whiskito-history-table"),
  ]) {
    if (!island) continue;
    island.withdrawStatus = status;
    if (message !== undefined) island.withdrawMessage = message;
  }
}

/** El precio POL→USD que la tarjeta usa para el equivalente en dólares. */
export function setPolPrice(price) {
  const donateCard = findIsland("whiskito-donate-card");
  if (!donateCard) return;
  donateCard.polPrice = price;
}

/** Estado del envío; el mensaje sólo se pisa si viene uno. */
export function setDonateStatus(status, message) {
  const donateCard = findIsland("whiskito-donate-card");
  if (!donateCard) return;
  donateCard.status = status;
  if (message !== undefined) donateCard.message = message;
}

/** La dirección a la que se dona, para que la tarjeta la muestre arriba. */
export function setDonateRecipient(recipient) {
  const donateCard = findIsland("whiskito-donate-card");
  if (!donateCard) return;
  donateCard.recipient = recipient;
}

/** La cuenta conectada que va a donar; vacío = todavía no hay ninguna. */
export function setDonateViewer(account) {
  const donateCard = findIsland("whiskito-donate-card");
  if (!donateCard) return;
  donateCard.viewer = account;
}

/** Muestra u oculta la fila de conexión de la tarjeta (opt-in de `/u/0x…`). */
export function setDonateConnectVisible(visible) {
  const donateCard = findIsland("whiskito-donate-card");
  if (!donateCard) return;
  donateCard.showConnect = visible;
}

/**
 * Permiso de donar de esta página: `false` cuando la cuenta conectada es el
 * dueño (no se dona a sí mismo). El default de la isla es `true`, así que la
 * landing —que no llama a esto— queda igual.
 */
export function setDonateCanDonate(canDonate) {
  const donateCard = findIsland("whiskito-donate-card");
  if (!donateCard) return;
  donateCard.canDonate = canDonate;
}

/** Base del link para compartir (el sitio). */
export function setShareBase(base) {
  const shareCard = findIsland("whiskito-share-card");
  if (!shareCard) return;
  shareCard.shareBase = base;
}

/**
 * El link al explorador del footer: la base del explorador de la red efectiva y
 * la dirección del contrato en ESA red. Sin explorador (anvil) el footer esconde
 * el link en vez de dejarlo apuntando a `#`.
 *
 * Se pasan como dos datos y no como una URL armada: quién arma el link es la
 * isla, que es la dueña de su DOM.
 */
export function setExplorer({ explorer, fund } = {}) {
  const footer = findIsland("whiskito-footer");
  if (!footer) return;
  footer.explorer = explorer ?? "";
  footer.fund = fund ?? "";
}

/** La dirección que se comparte; vacío = todavía no hay QR que mostrar. */
export function setShareAddress(address) {
  const shareCard = findIsland("whiskito-share-card");
  if (!shareCard) return;
  shareCard.address = address;
}

/** Muestra u oculta la tarjeta de compartir. */
export function setShareVisible(visible) {
  const shareCard = findIsland("whiskito-share-card");
  if (!shareCard) return;
  shareCard.toggleAttribute("hidden", !visible);
}

/** Abre o cierra el panel de compartir (el QR). */
export function setShareOpen(open) {
  const shareCard = findIsland("whiskito-share-card");
  if (!shareCard) return;
  shareCard.open = open;
}

/**
 * Muestra el modal del veredicto de una transacción (`/u/0x…`).
 *
 * Es el enchufe de la isla: acá sólo se le pasan las propiedades. Quién lo abre
 * y con qué veredicto es decisión del flujo, no de este módulo.
 *
 * Los textos van con `?? ""` para que un `undefined` no escriba la cadena
 * "undefined" en pantalla.
 */
export function showTxModal({ kind, title, message, hash, explorer } = {}) {
  const modal = findIsland("whiskito-tx-modal");
  if (!modal) return;
  modal.kind = kind ?? "";
  modal.title = title ?? "";
  modal.message = message ?? "";
  modal.hash = hash ?? "";
  modal.explorer = explorer ?? "";
  modal.open = true;
}

/** Cierra el modal si esta página lo tiene (si no, no hace nada). */
export function hideTxModal() {
  const modal = findIsland("whiskito-tx-modal");
  if (!modal) return;
  modal.open = false;
}

/**
 * El saludo de la vista del profesional (`whiskito-pro-greeting`): de quién es
 * la barra. Vacío = sin cuenta, y entonces la isla muestra el saludo sin la
 * línea de la dirección (no se inventan datos).
 *
 * La tabla de abajo se llena con `showHistory`, la misma función que usa la
 * página `/historial`: las dos islas del profesional son las mismas piezas en
 * otro contexto.
 */
export function setGreetingAddress(address) {
  const greeting = findIsland("whiskito-pro-greeting");
  if (!greeting) return;
  greeting.address = address ?? "";
}

/**
 * La página del historial (`/historial?u=0x…`): la tabla completa de las
 * donaciones recibidas por una dirección.
 *
 * Mismos defaults tolerantes que el resto —lo que no venga queda vacío— y
 * `loading` / `connect` / `canWithdraw` son opt-in: los tres arrancan apagados
 * en la isla. `connect` es el permiso para ofrecer el botón de conectar la
 * wallet, que es la única salida cuando la URL no trae dirección (leer es
 * público, así que la página sirve igual; lo que no hay es a quién leerle).
 * `canWithdraw` es el permiso para OFRECER el retiro: sin él la isla no dibuja
 * ni el saldo ni los botones, así que `/historial` —que no lo prende— sigue
 * siendo una página de lectura y sólo la vista del profesional retira desde acá.
 *
 * `balancePol` / `balanceUsd` son el saldo disponible del dueño (el mismo dato y
 * el mismo formato que el panel): sólo se pintan con `canWithdraw` prendido.
 *
 * La usa la página `/historial` y también la landing: la vista del profesional
 * monta esa misma tabla INLINE, con las donaciones de la cuenta conectada.
 */
export function showHistory({
  address,
  rows,
  message,
  explorer,
  loading,
  connect,
  balancePol,
  balanceUsd,
  canWithdraw,
} = {}) {
  const table = findIsland("whiskito-history-table");
  if (!table) return;
  table.address = address ?? "";
  table.rows = Array.isArray(rows) ? rows : [];
  table.message = message ?? "";
  table.explorer = explorer ?? "";
  table.loading = Boolean(loading);
  table.connect = Boolean(connect);
  // El saldo y el permiso de retirar son la misma foto que las filas: van acá y
  // no en una función aparte sólo para el caso "sólo cambió el saldo" —para eso
  // está `setHistoryBalance`, que no toca las filas—.
  if (balancePol !== undefined) table.balancePol = balancePol;
  if (balanceUsd !== undefined) table.balanceUsd = balanceUsd;
  if (canWithdraw !== undefined) table.canWithdraw = Boolean(canWithdraw);
}

/**
 * Sólo el saldo disponible de la tabla del historial: las filas (las donaciones
 * recibidas) no cambian con un retiro, así que repintarlas sería rehacer una
 * lectura de eventos para nada. Lo usa el retiro exitoso, que es exactamente
 * cuando el saldo que se ve queda viejo.
 *
 * Mismo default tolerante que `showHistory` para lo que no venga.
 */
export function setHistoryBalance(balancePol, balanceUsd) {
  const table = findIsland("whiskito-history-table");
  if (!table) return;
  if (balancePol !== undefined) table.balancePol = balancePol;
  if (balanceUsd !== undefined) table.balanceUsd = balanceUsd;
}

/**
 * El aviso de demo de la tarjeta. Lo decide la PÁGINA que la usa: la landing
 * invita en modo demo y lo prende; la página del link cobra de verdad y no lo
 * prende (el default de la isla es apagado).
 */
export function setDonateDemo(demo) {
  const donateCard = findIsland("whiskito-donate-card");
  if (!donateCard) return;
  donateCard.demo = Boolean(demo);
}

/**
 * Registra los listeners de las islas. Un solo listener para cualquier isla que
 * pida conectar: el navbar y la tarjeta de compartir emiten el mismo evento, que
 * burbujea hasta el documento. Lo mismo vale para cambiar de cuenta: el navbar y
 * la tarjeta de donación emiten `whiskito:switch-account-request`.
 *
 * Los handlers son OPCIONALES: una página que sólo tiene la tarjeta pasa
 * `{ fund }` y nada más, sin listeners de sobra para islas que no existen.
 */
export function onRequest({
  connect,
  disconnect,
  switchAccount,
  withdraw,
  fund,
} = {}) {
  if (connect) document.addEventListener("whiskito:connect-request", connect);
  if (disconnect)
    document.addEventListener("whiskito:disconnect-request", disconnect);
  if (switchAccount)
    document.addEventListener("whiskito:switch-account-request", switchAccount);
  if (withdraw)
    document.addEventListener("whiskito:withdraw-request", withdraw);
  const donateCard = findIsland("whiskito-donate-card");
  if (fund && donateCard) {
    donateCard.addEventListener("whiskito:fund-request", fund);
  }
}
