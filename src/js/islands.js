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

/** El panel: de quién es la página y quién mira (la isla deriva isOwner / notOwner). */
export function setPanelViewer({ owner, viewer }) {
  const panel = findIsland("whiskito-panel");
  if (!panel) return;
  panel.owner = owner;
  panel.viewer = viewer;
}

export function showPortfolio({ balanceEth, balanceUsd, donations }) {
  const panel = findIsland("whiskito-panel");
  if (!panel) return;
  panel.balanceEth = balanceEth;
  panel.balanceUsd = balanceUsd;
  panel.donations = donations;
}

/**
 * Estado de la retirada; el mensaje sólo se pisa si viene uno.
 *
 * El veredicto es uno solo y hay DOS islas que retiran (el panel y el modal "Mi
 * Panel"), así que se escribe en las dos: si el retiro salió del modal, el panel
 * de atrás también tiene que dejar de mentir.
 */
export function setWithdrawStatus(status, message) {
  for (const island of [findIsland("whiskito-panel"), findIsland("whiskito-dashboard")]) {
    if (!island) continue;
    island.withdrawStatus = status;
    if (message !== undefined) island.withdrawMessage = message;
  }
}

/** El precio ETH→USD que la tarjeta usa para el equivalente en dólares. */
export function setEthPrice(price) {
  const donateCard = findIsland("whiskito-donate-card");
  if (!donateCard) return;
  donateCard.ethPrice = price;
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
 * Abre "Mi Panel" con TODO lo que muestra: la dirección, sus donaciones, el
 * aviso de lectura, el balance de la cuenta conectada (ETH y USD) y si esa
 * cuenta puede retirar.
 *
 * Los que no vengan usan el mismo criterio de default de siempre: vacío para la
 * dirección y el aviso, lista vacía para las donaciones, y —como el panel— `0` /
 * `0.00` para un balance que nadie leyó. `canWithdraw` es opt-in: sin que nadie
 * lo autorice, la isla no ofrece retirar.
 */
export function showDashboard({
  address,
  donations,
  message,
  balanceEth,
  balanceUsd,
  canWithdraw,
} = {}) {
  const dashboard = findIsland("whiskito-dashboard");
  if (!dashboard) return;
  dashboard.address = address ?? "";
  dashboard.donations = Array.isArray(donations) ? donations : [];
  dashboard.message = message ?? "";
  dashboard.balanceEth = balanceEth ?? "0";
  dashboard.balanceUsd = balanceUsd ?? "0.00";
  dashboard.canWithdraw = Boolean(canWithdraw);
  dashboard.open = true;
}

/** Cierra el panel si esta página lo tiene (si no, no hace nada). */
export function hideDashboard() {
  const dashboard = findIsland("whiskito-dashboard");
  if (!dashboard) return;
  dashboard.open = false;
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
  dashboard,
  dashboardClose,
} = {}) {
  if (connect) document.addEventListener("whiskito:connect-request", connect);
  if (disconnect)
    document.addEventListener("whiskito:disconnect-request", disconnect);
  if (switchAccount)
    document.addEventListener("whiskito:switch-account-request", switchAccount);
  if (withdraw)
    document.addEventListener("whiskito:withdraw-request", withdraw);
  if (dashboard)
    document.addEventListener("whiskito:dashboard-request", dashboard);
  // "Mi Panel" también avisa cuando se CIERRA (la ×, Escape o el fondo): el
  // flujo necesita saberlo para no reabrirlo al refrescar sus datos después de
  // un retiro.
  if (dashboardClose)
    document.addEventListener("whiskito:dashboard-close", dashboardClose);
  const donateCard = findIsland("whiskito-donate-card");
  if (fund && donateCard) {
    donateCard.addEventListener("whiskito:fund-request", fund);
  }
}
