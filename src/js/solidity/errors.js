export function networkMismatchMessage(walletChainId, activeChainId) {
  return `Tu wallet está en la red ${walletChainId} y esta página es de la red ${activeChainId}. Cambiá de red en tu wallet para firmar.`;
}

/** EIP-1193 4902: la wallet no conoce esa red (se agrega con `wallet_addEthereumChain`). */
export function isUnknownChain(error) {
  if (error?.code === 4902) return true;
  return /unrecognized chain|unknown chain|no such chain/i.test(
    String(error?.message ?? "")
  );
}

/**
 * Códigos EIP-1193 que la app tiene que distinguir para decidir un camino:
 * la wallet no conoce el método, o el usuario cerró el pedido.
 */
export function isUnsupportedMethod(error) {
  const code = error?.code;
  const text = String(error?.message ?? "");
  return (
    code === -32601 ||
    /not supported|unsupported|does not exist|no such method/i.test(text)
  );
}

/** El usuario cerró el pedido en su wallet (o lo canceló): no es un fallo de la app. */
export function isUserRejection(error) {
  const code = error?.code;
  const text = String(error?.message ?? "");
  return code === 4001 || /reject|denied|cancel/i.test(text);
}
