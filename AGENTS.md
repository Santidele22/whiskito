# AGENTS.md — Whiskito (`buy-me-a-coffe-1`)

> **Ámbito:** este proyecto. Se suma al `AGENTS.md` global (`$DSH_HOME/AGENTS.md`), que
> manda sobre el harness; acá vive lo de **esta** app.
> **Idioma:** español para lo humano; identificadores, rutas y comandos en su forma original.
> **Mantenelo compacto** y sin estado efímero: es una guía, no un diario.

## 0. Qué es esto

Proyecto del curso *blockchain-fullstack*: la landing **Whiskito**, para recibir donaciones
on-chain (estilo Cafecito) sobre un contrato `Fund` en Solidity — la moneda nativa de la red:
ETH en anvil, **POL** en Amoy. Es un proyecto **didáctico por
clases** (1 → 6) y su página se sirve como módulos ES tal cual —sin bundler en ese camino, que es
el de la verificación—, con `viem` desde `esm.sh` y `lucide` desde `node_modules`. Aparte hay un
build de Vite (`bun run build` → `dist/`) que existe **sólo para publicar** y que sí empaqueta
las dependencias adentro.

Consecuencia práctica: el **`README.md` de la raíz documenta el proyecto** (producto, contrato,
frontend, cómo correrlo y verificarlo, el deploy en Polygon Amoy y el roadmap: token ERC20,
RedeemShop, BadgeNFT, Factory, verificar en Polygonscan, Sepolia). El detalle de la verificación y de cada
clase del curso está en `.refactor-baseline/README.md`, y el contrato de copy y estructura del
rediseño «Blues Poster '62» en `.refactor-baseline/DESIGN-SPEC.md`.

**Estado de red:** el desarrollo es **anvil** (`chainId 31337`) y la red **publicada** es **Polygon
Amoy** (`chainId 80002`, nativa **POL**, feed POL/USD **derivado** por `PolUsdAdapter`, explorer
`amoy.polygonscan.com`). **Sepolia
es otra red** (Ethereum, `11155111`) y sólo está prevista. El sitio **está publicado** en
<https://whiskito.vercel.app> (proyecto Vercel `whiskito`) y el repo está **conectado a Vercel**:
`main` despliega a producción solo y los PRs sacan preview (§3).

## 1. Mapa

| ruta | qué hay |
|---|---|
| `src/script/fund.sol` | el contrato: `fund(address professional) payable`, `withdraw(uint256)`, `withdrawAll()`, eventos `Funded`/`Withdrawn`, errores custom |
| `src/script/deploy.sol` | deploy **local y nada más** (anvil): `MockV3Aggregator(8, 2000e8)` + `Fund` |
| `src/script/deploy-amoy.sol` | deploy en **Polygon Amoy**: despliega el `PolUsdAdapter` (POL/USD derivado) y el `Fund` apuntándole — **redeploy pendiente**: la chain todavía tiene el `Fund` con ETH/USD; lo corre `bun run deploy:amoy` = `forge script … --rpc-url amoy --broadcast --account deployer --with-gas-price 35gwei --priority-gas-price 30gwei` (ver §4) |
| `src/script/pol-usd-adapter.sol` | adaptador `AggregatorV3Interface` que **deriva** POL/USD = LINK/USD ÷ LINK/MATIC con las dos patas reales de Amoy: 8 decimales, `updatedAt` = el mínimo, `maxAge` por constructor, `getRoundData()` revierte |
| `src/js/entries/main.js` | punto de entrada: registra los componentes y llama a `startApp()`; **sin lógica** |
| `src/js/entries/app.js` | el flujo: rol del visitante, conectar/desconectar, donar, retirar y el bootstrap |
| `src/js/dom/islands.js` | **la única frontera con el DOM**: busca las islas **al usarlas** (tolera que falten) y les escribe propiedades |
| `src/donate.html` | la página que se comparte en `/u/0x…`: **sólo** la tarjeta de donación (y **cobra de verdad**: no hay ningún aviso de demo) |
| `src/js/entries/donate.js` | el flujo de esa página: destinatario, precio, conectar la wallet y donar |
| `src/js/solidity/tx.js` | **las verificaciones de toda escritura** (ver §2, punto 1) |
| `src/js/solidity/solidity-functions.js` | lecturas (`readContract`, `readPolPrice`, `readDonationHistory`, `readDonations`, `readPortfolio`) y escrituras (`fund`, `withdraw`, `withdrawAll`) |
| `src/js/solidity/chain.js` | clientes: red activa, cliente de lectura HTTP, cliente de wallet |
| `src/js/solidity/errors.js` | módulo hoja: errores de la wallet (EIP-1193: rechazo del usuario, red desconocida, método no soportado) y el texto del desajuste de red (`networkMismatchMessage`) |
| `src/js/roles/viewer-role.js` | rol derivado (`guest`/`donor`/`owner`), `canDonate`, `canWithdraw` |
| `src/js/config/demo-mode.js` | módulo hoja: `DEMO`, el modo **de la landing** (default **true**; `?demo=0` o `?real=1` lo apagan). La página del link no lo usa |
| `src/js/config/config.js` | módulo hoja: `NETWORKS` por chainId (con `professional` por red), `professionalFor(chainId)`, `DEFAULT_CHAIN_ID` según el origen, `SITE` |
| `vite.config.js` | Vite: servidor de desarrollo y `bun run build` → `dist/` (bundle sin CDN); raíz `src` |
| `scripts/dev.sh` | lo que corre `bun run dev`: anvil (si falta), deploy (si falta) y Vite, con limpieza |
| `src/components/` | 13 web components ("islas"); `base-element.js` es la base |
| `src/components/whiskito-tx-modal.js` | isla del veredicto de la transacción (aceptada / cancelada); **sólo la página de donación la registra** |
| `src/components/whiskito-history-table.js` | isla "Historial de donaciones": la **tabla de todas las donaciones recibidas** por una cuenta, con las filas que le pasa el flujo (**eventos `Funded` reales de la chain**); vive sola en su página `/historial` y también INLINE en la vista del profesional |
| `src/fund.abi.json` | ABI generado por forge — **y una segunda copia a mano** en `src/js/solidity/fund-abi.js` |
| `.refactor-baseline/` | andamiaje de verificación, **descartable**; incluye anclas congeladas y `serve.py` |
| `docs/architecture/` | tres diagramas de la app (spec JSON + HTML) generados con **archify**: arquitectura de runtime, secuencia de la donación y flujo de fondos. Describen, no verifican (README §2.1) |
| `test/PolUsdAdapter.t.sol` | **18 tests de forge** (ya no está vacío): derivación, frescura por pata (`vm.warp`), decimales mixtos, precios 0/negativos, `updatedAt` = mínimo, `getRoundData`, y el piso de `Fund` (`MINIMUM_USD == 1e16`) |

## 2. Leyes de arquitectura (no romper)

1. **Toda escritura al contrato pasa por `src/js/solidity/tx.js`.** El camino es
   `writeAndConfirm({ functionName, args, value })` = simular → firmar → confirmar el recibo.
   Las piezas sueltas (`simulateWrite`, `confirmReceipt`) y las guardas (`requireNetwork`,
   `requireSigningNetwork`, `requirePublicClient`, `requireWalletClient`) viven ahí y **se
   reutilizan, no se copian**.
2. **`writeContract` no existe en el cliente de lectura**: es una acción de *wallet*. Usar
   `getPublicClient().writeContract(...)` es `TypeError` en runtime.
3. **`waitForTransactionReceipt` resuelve aunque la transacción se haya revertido**
   (`status: "reverted"`, viem 2.56.5: no lanza). Sin mirar el status, la UI reporta
   "¡Retirado!" con el saldo intacto. Para eso está `confirmReceipt`. Y no es teórico: **anvil
   mina la transacción que revierte con `status: 0x0`, no la rechaza al enviarla** (medido: sólo
   `eth_call`/`eth_estimateGas` revierten antes de mandar).
4. **Las lecturas van por `readContract(functionName, args)`** (único lugar con la dirección y
   el ABI) y por HTTP, **no** por la wallet: leer tiene que funcionar sin nadie conectado.
5. **El rol es UI; la autoridad es el contrato.** `canWithdraw`/`canDonate` sólo esconden
   botones; `withdraw`/`withdrawAll` usan `balances[msg.sender]`, así que **nunca** se les pasa
   una dirección como parámetro.
6. **El modo demo es de la LANDING, no de la app.** El "Acto II" de la landing invita en demo
   (`src/js/config/demo-mode.js` exporta `DEMO`, default **`true`**; `?demo=0` y `?real=1` lo apagan) y
   `app.js` se lo pasa a `fund({ …, demo: DEMO })`: ahí **no se firma** —devuelve
   `{ donor, demo: true }` con el retardo simulado— y la tarjeta lo avisa con `get demo` (lo
   prende el flujo con `islands.setDonateDemo`).
   **La página del link (`/u/0x…`) cobra de verdad**: `donate.js` **no** le pasa `demo` a
   `fund()`, así que firma contra el contrato. No le pongas el flag ni el aviso: no hay ninguna
   demo ahí. Sin wallet no hay quién firme en ninguna de las dos páginas, y ése es el único caso
   en que el link simula (y lo dice: *"sin wallet"*, no *"demo"*).
   **La donación demo no es plata: no se anota en ningún lado.** El resumen del panel y la tabla
   del historial son la verdad de la chain (eventos `Funded`), y una prueba simulada no puede
   aparecer ahí como si hubiera entrado.
7. **Islas**: cada componente es dueño de su DOM (shadow root si declara `static styles`) y
   avisa hacia afuera con eventos `whiskito:*` (`bubbles` + `composed`). `app.js` sólo pasa
   datos y escucha, y **siempre** a través de `islands.js`, que es la única frontera con el DOM.
   No reintroduzcas búsquedas de `id`, `querySelector` ni `innerHTML` fuera de `islands.js`.
   Vale también para la tabla del historial: el navbar **sólo** emite `whiskito:connect-request`,
   `whiskito:disconnect-request` y `whiskito:switch-account-request`, y quien lee la chain
   (`readDonationHistory`) y le pasa las filas a la isla es `app.js` (`islands.showHistory`).
   Ninguna isla lee la chain ni `localStorage` por su cuenta.
8. **`config.js` es módulo hoja**: no importa nada ni toca el DOM. Direcciones por `chainId`,
   con override por URL (`?chain=31337&rpc=http://…&fund=0x…`) para demos y para probar un nodo
   caído.
8b. **La red por defecto depende del ORIGEN, no de una constante.** `DEFAULT_CHAIN_ID` resuelve a
   **31337** si el hostname es local (`localhost`, loopback, `file://`/sin `location`, red privada
   `10.`/`192.168.`/`172.16–31.`, o `.local` — así el QR de dev, que abre el server local desde el
   celular por IP de LAN, sigue apuntando a anvil) y a **80002** en cualquier otro origen (el sitio
   publicado en Vercel). El override `?chain=` de la URL gana siempre.
   Esos dos orígenes **son los entornos**: **dev** = anvil `31337` (`bun run dev`, gratis y sin
   faucet); **qa** = Polygon Amoy `80002` (el sitio publicado, o local con `bun run dev` + abrir
   `http://localhost:5173/?chain=80002` / `bunx --bun vite --open "/?chain=80002"`, sin levantar
   anvil ni deployar; POL de faucet **sólo al firmar**, porque leer es gratis); **prod** = Polygon
   mainnet `137`, **prevista y sin deploy**: no hay entrada en `NETWORKS` ni contrato deployado, así
   que se documenta como el destino, nunca como algo hecho. El atajo de qa-desde-local es
   `bun run dev:qa` (`bunx --bun vite --open "/?chain=80002"`): abre Vite apuntado a Amoy, **sin**
   levantar anvil ni deployar nada.
8c. **El profesional por defecto es POR RED**: `NETWORKS[red].professional` + `professionalFor(chainId)`
   (reemplaza a la vieja constante `PROFESSIONAL`). En anvil es la cuenta 0
   (`0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266`), en Amoy la del dueño
   (`0x74ffced34e75fb4b31f18889fa2a4de66be34523`). El link `/u/0x…` y `?u=0x…` siguen mandando
   sobre ese valor.
8d. **Un `?chain=` que no está en `NETWORKS` se descarta ENTERO** (con un `console.warn`) y se cae a
   la red del ORIGEN: `urlConfig` **nunca** devuelve un `chainId` distinto del de la config que
   devuelve. La trampa que eso evita: conservar el `chainId` de la URL con el `fund`/`rpc`/`priceFeed`
   de la red por defecto —dos redes mezcladas— haría que la app firmara contra el contrato de una
   creyendo estar en la otra. `?rpc=` y `?fund=` son perillas independientes (probar un nodo caído,
   apuntar a otro deploy) y se conservan tal cual vengan. Lo verifican `G1a`–`G1i`.
8e. **La URL es una instrucción; la wallet es la realidad.** Sin `?chain=`, `activeNetwork` sale de
   la chain de la wallet, así que un desajuste es imposible. Con `?chain=`, la app le **pide** a la
   wallet que se mueva (`wallet_switchEthereumChain`, y `wallet_addEthereumChain` si no conoce la
   red) y, si el usuario rechaza, `connectWallet()` **lanza** y **no deja wallet client usable**: no
   hay quién firme. El desajuste también puede aparecer *después* de conectar (la wallet se cambia
   de red), así que la guarda que manda en la escritura es `requireSigningNetwork()` de `tx.js`
   —corre antes de simular y de firmar—. **`requireNetwork()`, que comparten las lecturas, NO mira la
   wallet**: leer va por HTTP al RPC de la red activa y no necesita a nadie conectado (§2.4); si la
   guarda viviera ahí, un desajuste dejaría la página sin datos. Lo verifican `G2a`–`G2k`.
9. **Identificadores en inglés, describiendo lo que hacen** (`writeAndConfirm`, `simulateWrite`,
   `confirmReceipt`); comentarios y texto de cara al usuario en español.
10. **El ABI está dos veces** (`src/js/solidity/fund-abi.js` a mano y `src/fund.abi.json` de forge): si
    cambia el contrato, se actualizan las dos.
11. **La base de los links que se comparten es el origen que sirve la página** (`SITE`, en
    `config.js`), no un dominio fijo: así el QR de dev abre tu servidor local y la donación se
    puede probar sin publicar. El link es `/u/0x…` y **esa ruta abre una página aparte**
    (`src/donate.html`: sólo la tarjeta de donación, con el destinatario y el botón de conectar
    la wallet), no la landing. La sirve el plugin de `vite.config.js` **con un redirect**, y no
    puede ser un rewrite: en dev los assets del HTML son relativos y el navegador los pediría
    bajo `/u/` (ver §3). `?site=https://…` fuerza la base.
12. **El dueño de la página no se dona a sí mismo.** La regla vive en `viewer-role.js`
    (`canDonate(role, { demo })`) y **toda** página que done tiene que aplicarla antes de firmar:
    la landing en `app.js`, la de donación en `donate.js`. Y ahí hay una trampa: el rol se tiene
    que **recalcular DESPUÉS de la conexión on-demand** dentro del handler, porque si no, un dueño
    que va derecho a donar —sin pasar por "Conectar wallet"— se dona a sí mismo (el rol todavía era
    `guest`). Sin wallet conectada, el visitante común dona en **modo demo** como siempre.
    **En la landing en demo la guardia no aplica** (no hay firma que proteger): el dueño puede
    probar la donación en su propia página. **En el link nunca se relaja** —esa página cobra de
    verdad, así que el dueño está bloqueado siempre— y las aserciones lo verifican en las dos.

## 3. Verificación: el bucle obligatorio

```bash
export PATH="$HOME/.foundry/bin:$PATH"

forge fmt --check && forge build --sizes && forge test   # job `check` del CI: dos jobs, ver abajo
node .refactor-baseline/check-config.mjs        # ¿config.js coincide con el último deploy?
node .refactor-baseline/verify-refactor/resolve-imports.mjs . src/index.html   # grafo de imports
for f in $(find src/js src/components -type f -name '*.js' | sort); do node --check "$f" || echo "FALLA $f"; done  # sintaxis (recursivo)
python3 .refactor-baseline/verify-refactor/run-harness.py 8899   # e2e: exit 0 si PASS
python3 .refactor-baseline/verify-refactor/run-donate-probe.py 8899  # la página del link
```

- `run-harness.py` levanta `serve.py` (con `no-store`), abre `.refactor-baseline/islands.html` en
  Firefox headless y reporta `OK(n/n)` o `FALLOS(k/n)` más los status HTTP (un 404 delata una
  ruta rota) y los módulos que la página bajó de verdad. **Es la puerta de aceptación.** Hoy son
  **257 aserciones**, e incluyen el modo demo (que donar **no** pida firma ni deje rastro), la
  tabla del historial leyendo donaciones reales de la chain (P5–P6), el camino real con `?demo=0`
  y el bloque **G** de entornos (que elegir red no mienta: §2.8d–8e).
- Necesita **anvil en `http://127.0.0.1:8545` (chainId 31337) con el deploy hecho y el oráculo
  fresco**. El harness se prepara su propio estado: dona de verdad y retira.
- Qué correr según el cambio: tocaste módulos → `resolve-imports`; tocaste el contrato o el
  deploy → `check-config` + `forge build`; **siempre** el harness.
- El bundle **no** es parte de la puerta: la verificación mira la página sin bundler. Para
  comprobar el artefacto publicado está `.refactor-baseline/build-probe.html`: se copia a
  `dist/`, se sirve `dist/` con `serve.py`, y el navegador reporta si la app arranca, si hidratan
  los iconos, si el QR se dibuja (se sube y se decodifica con `zbarimg`) y si la página pidió
  **alguna** CDN — no debe pedir ninguna.
- Los diagramas de `docs/architecture/` **no** son parte de la puerta: describen la app, no la
  verifican. Se regeneran a mano con la skill archify (comandos en README §2.1) y **ningún job del
  CI los mira**.
- **Una corrida sin el veredicto crudo pegado no es evidencia.** Y un harness que no puede fallar
  no sirve: si agregás una aserción, comprobá que falla cuando el código está mal (control
  negativo; `.refactor-baseline/README.md` tiene varios ejemplos ya hechos).
- La página que se comparte se verifica con `.refactor-baseline/donate-probe.html` (se copia a
  `src/` para ser del mismo origen, se sirve con un dev server propio y el navegador reporta: la
  ruta abre la página, **ninguna isla de la landing**, la card dice a quién le donás, ofrece
  conectar, avisa si no hay wallet, la donación termina en `success`, el spinner gira en `pending`
  y se apaga al terminar, el modal abre/cierra por las tres vías, y con una **wallet EIP-1193
  falsa** inyectada en el iframe: la cuenta dueña deja el botón deshabilitado y **no firma nada**
  —tampoco yendo derecho a donar sin conectar—, mientras que otra cuenta sí firma).
  **Trampa que ese probe caza**: la ruta puede contestar `200` con el HTML correcto y la página
  estar **muerta** igual, porque el módulo no carga (assets relativos resueltos bajo `/u/`); mirar
  el status HTTP no alcanza.
- `.refactor-baseline/tx-modal-probe.html` (con `run-tx-modal-probe.py` y
  `vite.tx-modal-probe.config.js`) es una sonda más ambiciosa del modal, escrita por un subagente:
  **no corre en este sandbox** (se cuelga antes del veredicto; su diseño con XHR síncrono era para
  un entorno donde los timers de página no disparan). Se conserva como referencia, pero **no es
  puerta de nada**.
- **El CI son dos jobs** (`.github/workflows/test.yml`, detalle en `.github/workflows/README.md`):
  `check` —fmt, build, `forge test -vvv` (18 tests de `test/PolUsdAdapter.t.sol`), `node --check`,
  `resolve-imports`, `check-config` y
  `bun run build`— y `e2e`, que corre **esta misma puerta** (harness + probe, secuenciales) en
  ~3,5 min. Si el CI ya la corrió sobre tu commit, **no la repitas a mano**.
- Los dos runners de la puerta exigen anvil en **8545**: no aceptan otro puerto, así que **no se
  paralelizan** entre sí ni con un harness local — comparten chain y saldos.

## 4. Trampas ya pagadas (no las vuelvas a pagar)

- **El oráculo se pone viejo**: `getLatestPrice()` revierte con `StalePrice()` si
  `block.timestamp - updatedAt > 3 hours` (y el mock del deploy local arranca con la hora del
  deploy). Se refresca sin permisos:
  `cast send 0x5fbdb2315678afecb367f032d93f642f64180aa3 "updateAnswer(int256)" 200000000000 --unlocked --from 0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266 --rpc-url http://127.0.0.1:8545`.
  **No cambies el 2000e8**: varias aserciones derivan de ese precio.
- **El deploy necesita firmante explícito, en local y en Amoy**: con `forge` 1.8.3, `forge script …
  --broadcast` **sin** `--account`/`--sender`/`--private-key` usa el *default sender* de Foundry,
  **no despliega nada** (`cast code <dirección>` → `0x`) y **igual escribe** el
  `broadcast/<script>/<chainId>/run-latest.json` (con las direcciones de esa otra cuenta): queda un
  `check-config` en DRIFT sin nada en la chain, y el run *parece* exitoso.
  - Local: la forma que sí reproduce `config.js` es `--unlocked --sender 0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266`
    (cuenta 0 de anvil, la de `professionalFor(31337)`): es lo que corre `bun run deploy`.
  - Amoy: la firma sale del **keystore de Foundry** (`cast wallet import deployer --interactive`,
    una sola vez) y el `.env` **no** lleva claves privadas. Es lo que corre `bun run deploy:amoy`
    (`--account deployer --with-gas-price 35gwei --priority-gas-price 30gwei`, ver la trampa de gas
    de abajo); después la address del `Fund` se pega en `NETWORKS[80002].fund` y lo confirma
    `node .refactor-baseline/check-config.mjs` (`OK :: config.js coincide con el último deploy`).
- **El gas de Amoy miente dos veces, y las dos se pagan**: (1) `eth_gasPrice` sugiere **~128 gwei**
  cuando el piso real medido es **25–30 gwei** (80 bloques: 53 tx, la más barata 25; 51 vacíos), y el
  nodo valida `gas × maxFeePerGas` **antes** de aceptar: con 0,1 POL en la cuenta esa sugerencia da
  *fondos insuficientes* aunque el costo real (1.029.377 de gas) sea 0,031 POL; (2)
  `--with-gas-price` **solo no alcanza**, porque Foundry deja `maxPriorityFeePerGas` en **1 gwei**
  (medido en un fork) y con el base fee en 0 el precio efectivo quedaría por debajo del piso que
  aplica la red. Por eso el deploy va con **`--with-gas-price 35gwei --priority-gas-price 30gwei`**.
- **viem estima el gas antes de firmar**, así que una transacción que revierte a propósito nunca
  se manda. Para minar una que revierta igual hay que pasar `gas` explícito (o
  `cast send --gas-limit …`).
- **Firefox headless** necesita `.refactor-baseline/.ff` creado (si no existe, falla con
  `Could not find profile folder.` **y sale 0 igual**), y para las aserciones del portapapeles
  un `user.js` con `dom.events.testing.asyncClipboard=true`. Con un `HOLD` corto el navegador se
  cierra antes del reporte y el run queda sin veredicto.
- **`run-harness.py` se cuelga si existe `.refactor-baseline/.ff/.parentlock`**: ese archivo de
  0 bytes queda cuando Firefox muere por SIGTERM (que es lo que hace el driver), y con él el
  navegador arranca pero **no pide ni la primera URL**: el run sale `NO REPORT RECEIVED` con
  `HTTP requests seen: 0`, que parece un fallo de la app y no lo es. Borralo antes de cada
  corrida: `rm -f .refactor-baseline/.ff/.parentlock`.
- **`firefox --screenshot` no escribe el PNG en este entorno** (`RenderCompositorSWGL failed
  mapping default framebuffer`) y el lanzador vuelve al instante: para capturar o medir, no
  dependas del screenshot — dejá el navegador vivo, esperá el reporte y matalo vos.
- **`.click()` programático no prueba que una persona pueda clickear**: un botón puede estar
  tapado por orden de pintado. Se comprueba con `shadowRoot.elementFromPoint()`.
- **Nunca un icono adentro de un elemento que se pinta con `textContent`** (o que lleva
  `data-text`): `update()` corre después de hidratar y borra el SVG de Lucide. Vale para
  cualquier hijo: un sello o un badge adentro de un `[data-text]` desaparece en el primer
  `update()` (le pasó al sello `demo` del `#dashSummary`); el hijo va en un elemento hermano.
- **Un comentario con backticks adentro de `static template` / `static styles` cierra el template
  literal**: el módulo queda con error de sintaxis, `components/index.js` no registra **ninguna**
  isla y el harness falla con `card is null` (o con módulos que la página nunca baja), que se
  parece a un problema de carga y es un typo. `for f in $(find src/js src/components -type f -name '*.js' | sort); do node --check "$f"; done`
  (el paquete es `type: module`) lo caza en un segundo: corrélo antes de la puerta.
- **El perfil de Firefox conserva `localStorage` entre corridas**: una aserción del tipo "no
  quedó nada guardado" tiene que **limpiar la clave antes**, o el dato que dejó una versión
  anterior de la app la hace fallar (y parece un bug del código nuevo).
- **Una aserción sobre el panel de la landing puede estar mirando un panel que ya acumuló
  donaciones reales** de los bloques anteriores del propio harness: medí **antes y después** (o
  mirá el panel de la página que corresponde) en vez de comparar contra un número fijo. Con
  `<iframe>`s conviviendo, `rows()` de un scope no es "el panel de la página que acabo de cargar".
- **Shadow DOM**: el reset y los `@keyframes` **no cruzan** la frontera (cada isla lleva los
  suyos); `this.querySelector` no ve adentro (va `this.root`); un host con `display: contents` no
  tiene caja, así que las anclas y `scrollIntoView` no hacen nada.
- **`grep -v` puede matchear la RUTA y no el contenido**: un barrido de marca que filtra por el
  nombre del archivo da "limpio" sin haber mirado nada.
- **Importar el barril de Lucide** (`import { createIcons } from 'lucide'`) dispara ~1850
  peticiones: se importa icono por icono (`src/js/dom/icons.js`) y se hidrata con `replaceElement`
  sobre el `root` del componente.
- **`.refactor-baseline/` no es un lugar seguro para artefactos únicos**: ya desaparecieron
  archivos por actividad concurrente en el workspace. Lo congelado que importa está versionado
  ahí mismo y no se regenera sin querer.
- **La historia está en `origin`** (`github.com/Santidele22/whiskito`): lo pusheado es la fuente de
  verdad, y `main` despliega el sitio solo (§0, §3).
- **El RPC de Amoy de `config.js` no puede ser `drpc`**, y el rango de eventos no puede ser "desde
  el bloque 0". Medido con `eth_getLogs` del evento `Funded` del contrato real: el plan free de
  `polygon-amoy.drpc.org` acepta a lo sumo **100 bloques** por pedido (200 ya los rechaza con HTTP
  400 y `fromBlock: 0` también; su mensaje «ranges over 10000 blocks» miente), así que la tabla del
  historial quedaría vacía en el sitio publicado. `…-bor-rpc.publicnode.com` sí los sirve, hasta
  10.000 bloques de diferencia por pedido (medido: 10.001 bloques andan, 10.002 no). Por eso el RPC
  es publicnode y `readDonationHistory` pide los eventos **por ventanas de 5.000 bloques** hacia
  atrás desde el head, con piso en `NETWORKS[red].deployBlock` (Amoy `48371056`, el bloque del
  deploy; anvil `0`): el head de Amoy avanza cada ~2 s, así que un pedido único desde el deploy
  dejaría de entrar en el tope a las pocas horas. Costo a tener en cuenta: el bucle sólo corta al
  juntar `limit` eventos o al llegar al piso, así que un panel **sin donaciones** cuesta un pedido
  por cada 5.000 bloques de vida del contrato (~2,8 h de chain): hoy es **1** pedido, al mes de
  chain serían ~260. Con donaciones corta antes.
- **En Amoy no hay feed POL/USD, y se deriva**: el directorio oficial no lo lista, pero sí las dos
  patas que lo componen, así que el `Fund` de Amoy recibe un `PolUsdAdapter`
  (`src/script/pol-usd-adapter.sol`): POL/USD = LINK/USD ÷ LINK/MATIC (MATIC y POL son el mismo
  activo; los feeds conservan el nombre viejo). Sale en **8 decimales** —la convención de los feeds
  de USD—, así que `Fund` no cambió su interfaz: entra por constructor igual que el feed ETH/USD.
  Validado contra el `MATIC/USD` de Polygon mainnet: **0,23 % de diferencia**. Por esa valuación
  real, `MINIMUM_USD` bajó de 0,5 a **0,01 USD** (`1 * 1e16`): con POL ≈ $0,10 el piso viejo eran
  ~5 POL por donación, y el faucet de Amoy da 0,5–1 POL (demo inusable). El redeploy en Amoy está
  **pendiente** (§1).

## 5. Prohibiciones

- **La página que se sirve no se buildea.** En desarrollo y en la verificación se sirven los
  módulos ES tal cual (ES modules + `importmap`), y el servidor de la verificación sigue siendo
  `serve.py` — el único con `no-store`, `/__hold__` y `/__report__`. `vite build` (`dist/`)
  existe **sólo para publicar** y empaqueta las dependencias adentro; el harness nunca mira
  `dist/`. Nada de frameworks, ni de `import` de barriles en el código fuente.
- No tocar `node_modules/`, `lib/` (submódulo forge-std), `out/`, `cache/`, `broadcast/`.
- No tocar las **anclas históricas** de `.refactor-baseline/` (`index.html`, `v1/**`): son el
  "antes" y no se editan ni se regeneran.
- `redesign-static.html` es distinto: **es una comparación viva** (el bloque F la compara contra
  la app), así que si el markup cambia a propósito se **regenera** con `capture-static.html`
  —nunca se edita a mano— y después se comprueba con un **control negativo** (romper a propósito
  algo estático y ver que F falla) que sigue siendo una comparación real y no un archivo que
  coincide trivialmente. Regenerarla sin ese control es lo que la prohibición original cuidaba.
- No matar el anvil del 8545 ni levantar otro ahí; no deployar a una red que no sea local sin que
  lo pidan. En Amoy el deploy es deliberado y lo corre el usuario con su keystore (`bun run
  deploy:amoy`): no lo dispares para "probar", y nunca escribas una address inventada en
  `NETWORKS[80002].fund`. **«Probar qa» no es una excepción**: la puerta e2e es anvil-only (§3),
  así que qa contra Amoy es QA manual y no hay deploy automático que lo cambie.
- No debilitar ni borrar aserciones para que una corrida pase. Si una aserción molesta, se discute
  su premisa y se explica en el reporte; no se afloja.
