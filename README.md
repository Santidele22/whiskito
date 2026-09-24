# Whiskito — donaciones on-chain en ETH

Landing para **recibir donaciones en ETH** a través de un contrato inteligente, con el monto
mínimo validado **en dólares** (no en un ETH fijo) contra un oráculo de precio de Chainlink.

Proyecto del curso **Web3 full stack de Cyfrin** (el «Buy Me a Coffee» del curso, acá extendido a
una plataforma de donaciones por creador). Nació con otro nombre y se rediseñó como **Whiskito**: el
renombre alcanzó a los web components (`whiskito-*`), a sus clases y a los eventos `whiskito:*`.

> **Alcance:** sólo testnet y desarrollo local; no hay intención de operar en mainnet ni con valor
> real. En desarrollo corre contra **anvil** (`chainId 31337`) y la red publicada es **Polygon
> Amoy** (`chainId 80002`), que es donde se despliega el contrato (§6.1). **Sepolia es otra red**
> (Ethereum, `chainId 11155111`) y sigue prevista pero no desplegada: su entrada está comentada en
> `src/js/config/config.js` y no se confunde con Amoy.

## 0. Estado del proyecto

El plan original era más grande que el código. **El token de recompensa, el canje y los NFT
todavía no existen**: no hay una línea de ERC20 ni de ERC721 en el repo. Esta tabla es el contrato
de lo que hay hoy y lo que falta.

| pieza | estándar | rol | estado |
|---|---|---|---|
| **Fund** | contrato propio | recibe donaciones, valida el mínimo en USD vía Chainlink y acumula el saldo de cada beneficiario | ✅ `src/script/fund.sol` |
| **Frontend** | web components + viem | landing, roles, donar, retirar, compartir | ✅ `src/` |
| **WhiskitoCoin** | ERC20 | token de recompensa por donar | 🔲 futuro |
| **RedeemShop** | contrato propio | canjea el token por premios | 🔲 futuro |
| **BadgeNFT** | ERC721 | coleccionables, por canje o por hito | 🔲 futuro |
| **Factory** | contrato propio | un `Fund` por creador | 🔲 futuro — hoy hay **un contrato compartido** |
| **Deploy en Polygon Amoy** | — | red pública de pruebas donde se publica la app | ⚠️ el `Fund` desplegado (`0xc92b…3fEF8`, bloque 48371056) **sigue valuando POL con el precio de ETH y con el piso viejo**: medido en la chain, `getConversionRate(1e18)` = **$2.692,52** y `MINIMUM_USD()` = **0,5 USD** (el repo ya dice 0,01). El redeploy del `PolUsdAdapter` + `Fund` nuevos está **pendiente** (§6.1) |
| **Publicación en Vercel** | — | publicar el `dist/` del build | ✅ **https://whiskito.vercel.app** — proyecto `whiskito`, conectado al repo: `main` despliega solo (§6.1) |

## 1. Resumen

Un visitante entra a la página de un creador, conecta su wallet y dona la moneda nativa de la red
(ETH en anvil, POL en Amoy). El contrato valida que la donación equivalga a **al menos 0,01 USD**
con el precio del oráculo, la acredita al saldo de **ese** creador y emite un evento con el
detalle. El creador, desde su propia wallet, retira lo acumulado a su favor.

Todo lo demás del plan (recompensar al donante con un token, canjearlo por premios, mintear
insignias) es roadmap: ver §8.

## 2. Arquitectura (la que existe hoy)

```
donante ──fund(profesional)──▶ Fund ──▶ balances[profesional] ──withdraw()──▶ creador
                                 │
                                 └── getConversionRate() ──▶ AggregatorV3Interface
                                                              (mock ETH/USD en anvil;
                                                               PolUsdAdapter POL/USD en Amoy)
```

| pieza | dónde | qué hace |
|---|---|---|
| contrato `Fund` | `src/script/fund.sol` | donaciones, validación en USD, saldos por beneficiario, retiros |
| script de deploy local | `src/script/deploy.sol` | despliega un `MockV3Aggregator(8, 2000e8)` y el `Fund` (sólo local) |
| adaptador POL/USD | `src/script/pol-usd-adapter.sol` | `AggregatorV3Interface` que **deriva** POL/USD = LINK/USD ÷ LINK/MATIC (§3.2) |
| script de deploy en Amoy | `src/script/deploy-amoy.sol` | despliega el `PolUsdAdapter` (POL/USD derivado) y el `Fund` apuntándole (§6.1) |
| módulos de la app | `src/js/` | config, clientes, lecturas/escrituras, roles, formato, iconos, modo demo y su ledger |
| islas (componentes) | `src/components/` | 13 web components que se pintan solos y avisan por eventos |
| verificación | `.refactor-baseline/` | harness e2e en navegador real, sondas y anclas congeladas |

### 2.1 Diagramas de arquitectura

Tres diagramas de la app, generados con **[archify](https://github.com/tt-a1i/archify)** (skill de
agente, MIT, instalada como plugin de DSH `@tt-a1i/archify-dsh@0.1.0`) y versionados en el repo —
spec JSON como fuente, HTML como artefacto:

| diagrama | spec (fuente) | HTML | qué muestra |
|---|---|---|---|
| arquitectura de runtime | `docs/architecture/runtime.architecture.json` | `docs/architecture/runtime.architecture.html` | las 12 islas y su frontera (`islands.js`), los flujos (`main.js` → `app.js`/`donate.js`), los módulos de acceso a la chain y las dos fronteras externas (wallet EIP-1193 y RPC por HTTP), con la frontera de confianza |
| secuencia de la donación | `docs/architecture/donation.sequence.json` | `docs/architecture/donation.sequence.html` | el camino real de `/u/0x…`: precio por HTTP, conexión (y el pedido de cambio de red), la guarda del dueño, simular → firmar → confirmar, y las ramas de fallo (rechazo 4001, `status: 0x0`, `StalePrice()`) |
| flujo de fondos | `docs/architecture/funds.dataflow.json` | `docs/architecture/funds.dataflow.html` | el valor nativo (donante → `Fund` → `balances[professional]` → `withdraw`/`withdrawAll`), el precio (oráculo → `usdValue` en el struct `Donation` y en el evento `Funded`) y las lecturas (eventos reales por ventanas de 5.000 bloques → islas) |

Los diagramas **describen** la app: no son parte de la puerta de verificación (§7) y ningún job del
CI los mira.

**Instalar el plugin** (una vez por perfil; va con versión exacta a propósito):

```bash
dsh plugin --profile web add @tt-a1i/archify-dsh@0.1.0
```

**Regenerarlos.** El CLI es Node puro y cero dependencias: no toca `package.json` y se invoca por
ruta absoluta.

```bash
SKILL="$HOME/.dsh/profiles/web/node_modules/@tt-a1i/archify-dsh/skills/archify"

# 1. validar el spec (JSON tipado: uno que no valida no se entrega).
#    El de arquitectura declara evidencia del repo (`sources`), por eso lleva --repo-root.
node "$SKILL/bin/archify.mjs" validate architecture docs/architecture/runtime.architecture.json \
  --quality showcase --json --repo-root .
node "$SKILL/bin/archify.mjs" validate sequence docs/architecture/donation.sequence.json --quality showcase --json
node "$SKILL/bin/archify.mjs" validate dataflow docs/architecture/funds.dataflow.json --quality showcase --json

# 2. entregar: escribe el HTML y devuelve los SHA-256 del spec y del artefacto.
node "$SKILL/bin/archify.mjs" deliver architecture docs/architecture/runtime.architecture.json \
  docs/architecture/runtime.architecture.html --quality showcase --json --repo-root .
node "$SKILL/bin/archify.mjs" deliver sequence docs/architecture/donation.sequence.json \
  docs/architecture/donation.sequence.html --quality showcase --json
node "$SKILL/bin/archify.mjs" deliver dataflow docs/architecture/funds.dataflow.json \
  docs/architecture/funds.dataflow.html --quality showcase --json

# 3. comprobar el HTML ya entregado (`check` toma UN archivo por vez).
node "$SKILL/bin/archify.mjs" check docs/architecture/runtime.architecture.html
node "$SKILL/bin/archify.mjs" check docs/architecture/donation.sequence.html
node "$SKILL/bin/archify.mjs" check docs/architecture/funds.dataflow.html
```

Dos aclaraciones honestas: el skill empaquetado en `@tt-a1i/archify-dsh@0.1.0` es **v2.14.0**
(`skills/archify/package.json`), **atrás de upstream**; y los HTML **no son 100 % autocontenidos**:
la plantilla de archify carga la tipografía JetBrains Mono desde Google Fonts (asíncrona, con
fallback a monoespaciada del sistema), así que ése es el único pedido de red — todo lo demás
(SVG, CSS, JS del visor) va embebido, y los links a GitHub son `<a href>` de evidencia.

## 3. Contrato `Fund`

### 3.1 Responsabilidades

- Recibir ETH por una función `payable`: `fund(address professional)`.
- Rechazar el envío vacío (`ZeroAmount`) y la dirección cero como beneficiario (`ProfessionalNotPass`).
- Validar que el monto equivalga a **≥ 0,01 USD** con el precio que devuelve el oráculo
  (`MINIMUM_USD = 1 * 1e16`). El piso bajó desde 0,5 USD por la valuación real de POL (§3.2).
- Registrar quién donó y cuánto (`mapping(address => uint256) donation`, interno) y **acumular el
  saldo de cada beneficiario** (`mapping(address => uint256) balances`, público).
- Guardar el historial consultable por índice (`getDonations(uint256)` sobre el array `donations`).
- Dejar que **cada beneficiario retire su propio saldo**, no el de otro.

**No hay `owner`.** A diferencia del borrador del proyecto, el contrato no tiene dueño ni
`onlyOwner`: la autoridad es `balances[msg.sender]`, así que la dirección que firma sólo puede
retirar lo suyo. La página decide *a quién* se le dona (`fund(professional)`) y el contrato no
opina sobre quién es un creador legítimo: cualquier dirección puede recibir.

### 3.2 Integración con Chainlink Price Feeds

Se usa `AggregatorV3Interface` para leer el precio on-chain. **El contrato es agnóstico al feed**:
lo recibe por constructor, le pregunta `decimals()` y multiplica por `msg.value`; lo único que
importa es que el feed valué **la moneda que se envía**.

- **De dónde sale la dirección del feed:** de la documentación oficial de Chainlink para ese par y
  esa red (`docs.chain.link/data-feeds/price-feeds/addresses`), **nunca de memoria**. En el deploy
  local no se usa un feed real: `deploy.sol` despliega un `MockV3Aggregator` propio con respuesta
  `2000e8` (2000 USD, 8 decimales) y es esa dirección la que recibe el constructor.
- **En Amoy no hay feed POL/USD publicado** (el directorio oficial no lo lista), pero sí las dos
  patas que lo componen. `MATIC` y `POL` son el **mismo activo** (Polygon renombró MATIC a POL; los
  feeds conservan el nombre viejo), así que el `Fund` de Amoy recibe un **`PolUsdAdapter`**
  (`src/script/pol-usd-adapter.sol`) que lo deriva:

  | pata | proxy en Amoy | `decimals()` | heartbeat |
  |---|---|---|---|
  | `LINK / USD` | `0xc2e2848e28B9fE430Ab44F55a8437a33802a219C` | 8 | 120 s |
  | `LINK / MATIC` | `0x408D97c89c141e60872C0835e18Dd1E670CD8781` | 18 | 3600 s |

  `POL/USD = (LINK/USD) ÷ (LINK/MATIC)`. El adaptador lee los decimales de cada pata en el
  constructor (nunca los asume), devuelve el resultado en **8 decimales** —la convención de los
  feeds de USD, para ser intercambiable con cualquier otro aggregator—, toma `updatedAt` como el
  **mínimo** de las dos patas (el compuesto es tan fresco como su pata más vieja) y revierte si
  alguna supera `maxAge` (**7200 s** = 2× el heartbeat más lento), si su precio es ≤ 0 o si su
  `updatedAt` es 0 o futuro. `getRoundData()` revierte: un precio compuesto no tiene rondas propias
  que componer. **`Fund` no cambió su interfaz**: entra por constructor donde antes iba el feed
  ETH/USD, porque el adaptador implementa `AggregatorV3Interface`.
- **El método está validado contra mainnet:** el feed que **sí** publica el precio en Polygon
  mainnet, `MATIC / USD` (`0xAB594600376Ec9fD91F8e885dADF0CE036862dE0`, heartbeat 27 s), marcaba
  **$0,10032** mientras la derivación daba **$0,10055**: **0,23 % de diferencia**.
- **El piso bajó a 0,01 USD por esta valuación**: con el precio real de POL (≈ $0,10), un mínimo de
  0,5 USD serían **~5 POL por donación**, y el faucet de Amoy da 0,5–1 POL: la demo quedaría
  inusable. Con `MINIMUM_USD = 1 * 1e16` el mínimo es ~0,1 POL.
- **Pendiente**: el `Fund` que está hoy en la chain (y el `priceFeed` de `config.js`) siguen siendo
  el feed ETH/USD `0xF0d50568e3A7e8259E16663972b11910F89BD8e7` (`description()` = `"ETH / USD"`,
  `decimals()` = 8): el redeploy del adaptador + `Fund` nuevos está pendiente (§6.1).

Validaciones sobre el precio recibido (no se lee y se confía):

| validación | dónde | estado |
|---|---|---|
| `price > 0` — un feed roto puede devolver 0 o negativo | `getLatestPrice()` → `InvalidPrice()` | ✅ |
| `updatedAt != 0` y no futuro (`updatedAt <= block.timestamp`) | `getLatestPrice()` → `StalePrice()` | ✅ |
| `block.timestamp - updatedAt <= 3 hours` (`STALENESS_THRESHOLD`) | `getLatestPrice()` → `StalePrice()` | ✅ |
| `answeredInRound >= roundId` — que la ronda se haya completado | — | 🔲 **falta** |

> La cuarta es la que el plan daba por obligatoria y hoy no está. Se puede agregar sin cambiar la
> interfaz; queda anotada como endurecimiento pendiente. El adaptador valida el precio y la frescura
> en **cada pata** (con `maxAge` en vez de las 3 h); `answeredInRound` de las patas tampoco se mira.

### 3.3 Conversión de unidades

`msg.value` llega en wei (18 decimales). El feed devuelve el precio con los decimales que diga
`priceFeed.decimals()` (8 en el mock local y también en el `PolUsdAdapter` de Amoy, pero nunca
asumido). `getConversionRate(ethAmount)` calcula
`scaleFactor = 10 ** (18 - decimals)` y escala **todo a 18 decimales** antes de comparar contra el
piso de 0,01 USD, para no mezclar magnitudes.

### 3.4 Errores personalizados

Se usan `error Nombre();` + `revert Nombre();` en vez de `require(cond, "texto")`: más baratos en
gas (no hay strings en el bytecode) y el error viaja decodificado a la UI.

| error | cuándo |
|---|---|
| `InvalidPrice()` | el feed devolvió un precio ≤ 0 |
| `StalePrice()` | `updatedAt` en 0, en el futuro, o más viejo que 3 h |
| `InsufficientAmount()` | la donación no llega a 0,01 USD |
| `ZeroAmount()` | `msg.value == 0`, o retiro por 0 |
| `ProfessionalNotPass()` | beneficiario `address(0)` |
| `DonationIndexOutOfBounds()` | índice fuera del array de donaciones |
| `InsufficientBalance()` | se intenta retirar más que el saldo propio |
| `NoBalanceToWithdraw()` | `withdrawAll()` sin saldo |
| `TransferFailed()` | el envío de ETH devolvió `false` |
| `ProfessionalIndexOutOfBounds()` | **declarado y sin uso**: quedó de una iteración anterior |

### 3.5 API

| función | tipo | qué hace |
|---|---|---|
| `fund(address professional)` | `payable` | dona a esa dirección; valida el mínimo en USD y emite `Funded` |
| `withdraw(uint256 amount)` | escritura | retira `amount` wei del saldo de quien firma |
| `withdrawAll()` | escritura | retira todo el saldo de quien firma |
| `balances(address)` | `view` | saldo acumulado de un beneficiario |
| `getConversionRate(uint256 ethAmount)` | `view` | cuánto valen esos wei en USD (18 decimales) |
| `getLatestPrice()` | `view` | precio crudo del feed, ya validado |
| `getDonations(uint256 index)` | `view` | `(donor, amount)` de una donación del historial |
| `MINIMUM_USD` / `STALENESS_THRESHOLD` | `view` | constantes del contrato |

Eventos: `Funded(donor indexed, professional indexed, ethAmount, usdValue)` y
`Withdrawn(professional indexed, amount)`.

### 3.6 Retiros: checks-effects-interactions

El orden importa cuando se manda ETH hacia afuera:

1. **Checks** — hay saldo, el monto no es cero, no se retira más de lo propio.
2. **Effects** — se descuenta el saldo **antes** de enviar.
3. **Interactions** — recién ahí, `payable(msg.sender).call{value: amount}("")`, validando el
   `bool` de retorno con `revert TransferFailed()`.

Invertir 2 y 3 abre la puerta a *reentrancy* (el bug detrás del hack de The DAO en 2016): el
receptor podría volver a llamar a `withdraw()` antes de que el estado se actualice y drenar fondos.
Se usa `call{value:}` y no `transfer()`, porque `transfer()` tiene un límite fijo de gas que rompe
con receptores más complejos.

`forge build` avisa igual `warning[reentrancy-events]` porque el `emit Withdrawn` va **después**
del `call`: el estado ya está actualizado (no hay riesgo de fondos), pero el log queda después de
la interacción. Es un aviso de lint, no un error, y no rompe el build.

## 4. Multi-creador: cómo funciona hoy

No hace falta desplegar nada para recibir:

1. Un creador abre la página y **conecta su wallet** — esa dirección ya es su identidad (no hay
   login usuario/contraseña).
2. Si la URL no dice de quién es la página, el que conecta **es** el dueño: el panel muestra *su*
   saldo y aparece su widget de compartir con el link y el QR.
3. El link para compartir lleva la dirección en la URL (`?u=0x…` o `/u/0x…`) y
   `src/js/roles/viewer-role.js` deriva de ahí el rol de quien mira (`guest` / `donor` / `owner`).
4. Los visitantes donan **a esa** dirección: `fund(professional)`.
5. Sólo esa dirección puede retirar lo suyo, porque el contrato usa `balances[msg.sender]`.

El aislamiento de fondos se logra **con un solo contrato compartido** y un `balances` por
dirección, no con un contrato por creador. El patrón **Factory** (un `Fund` por creador, más
aislamiento a cambio de más gas por deploy) es el paso siguiente del roadmap.

## 5. Frontend (viem)

La app tiene **dos caminos, y no son el mismo artefacto**:

| camino | qué se sirve | de dónde salen las dependencias |
|---|---|---|
| **desarrollo y verificación** | los módulos ES tal cual (`/src/index.html`) | `viem` desde `esm.sh` y Lucide desde `node_modules`, resueltos por el `importmap` del HTML |
| **publicación** (`bun run build`) | `dist/` — bundle con hash | `viem`, `lucide` y `qrcode` **empaquetados adentro**: `dist/` no pide nada a una CDN |

El camino sin bundler no es nostalgia: es el que usa el **harness de aceptación** (`serve.py`, con
`/__hold__` y `/__report__`), y el que hace que cada módulo del curso se lea tal cual se escribió.
El bundle es para publicar. `vite.config.js` traduce las URLs de CDN a paquetes locales con
`resolve.alias`, así que el mismo código fuente alimenta los dos caminos sin ramas ni `if`.

**El `qrcode` es un caso aparte**: la isla de compartir lo importa con `await import(...)` para que
un CDN caído no rompa la página (queda el link y el fallback), y el build lo empaqueta como chunk
propio (`dist/assets/browser-*.js`).

**El link que se comparte** (y por lo tanto el QR) usa como base **el origen que sirve la
página**: `http://localhost:5173` en dev, el dominio real en producción (`SITE`, en
`src/js/config/config.js`). Así el QR que generás mientras desarrollás abre **tu** app y la donación se
puede probar de punta a punta sin publicar nada; con un dominio fijo, el QR de dev mandaba a
producción, donde no hay nada que probar. `?site=https://…` lo fuerza y, fuera del navegador
(los scripts de verificación importan `config.js` con Node), cae al dominio canónico.

Eso obliga a que la ruta del link (`/u/0x…`) **exista**: el servidor de desarrollo la sirve con
`appType: "spa"` (Vite la reescribe a `index.html`). Al publicar, el host tiene que llevar esa ruta
a `/donate.html` **con un redirect** —no con un rewrite: §5.5 explica por qué—, porque si no los
links compartidos dan 404 o, peor, abren una página muerta.

**La red por defecto depende del origen de la página** (`DEFAULT_CHAIN_ID`, en `src/js/config/config.js`),
porque el mismo código sirve al desarrollo local y al sitio publicado:

| origen | red por defecto |
|---|---|
| local —sin `location`, `file://`, `localhost`, loopback, IP de red privada (`10.`, `192.168.`, `172.16–31.`) o `.local` | **31337** (anvil) |
| cualquier otro (el sitio publicado en Vercel, una IP pública) | **80002** (Polygon Amoy) |

El motivo del caso local es concreto: el QR de desarrollo abre el servidor local desde el celular
por la IP de LAN, y esa visita tiene que seguir apuntando a anvil. El override `?chain=` de la URL
(§5.1) sigue ganando siempre.

Y **el profesional por defecto también es por red**: `NETWORKS[red].professional` más
`professionalFor(chainId)` en `config.js` — en anvil es la cuenta 0
(`0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266`) y en Amoy la del dueño
(`0x74ffced34e75fb4b31f18889fa2a4de66be34523`). El link `/u/0x…` y `?u=0x…` siguen mandando sobre
ese valor.

### 5.1 Dos clientes, dos roles

| cliente | transporte | para qué |
|---|---|---|
| `publicClient` | HTTP al RPC de la red | **sólo lectura**: saldos, precio, eventos. No firma ni cuesta gas; funciona sin nadie conectado |
| `walletClient` | `custom(window.ethereum)` | **firma y envía** en nombre del usuario (donar, retirar). Abre la wallet y cuesta gas |

Las lecturas van por HTTP a propósito, no por la wallet: así el precio y el panel se ven aunque no
haya conexión, y la red se elige con el `chainId` que reporta la wallet.

Para hablar con el contrato hacen falta dos datos, y cada uno vive en un solo lugar:

- **la red y la dirección**: `src/js/config/config.js` (`NETWORKS` por `chainId`, con override por URL
  `?chain=31337&rpc=http://…&fund=0x…`); en Amoy `NETWORKS[80002].fund` se completa con la address
  que imprime el deploy (§6.1);
- **el ABI**: `src/js/solidity/fund-abi.js` (legible, escrito a mano) y `src/fund.abi.json` (generado por
  `forge build`). Son dos copias: si cambia el contrato, se actualizan las dos.

### 5.2 Escrituras: simular → firmar → confirmar

Toda escritura pasa por `src/js/solidity/tx.js`:

1. `simulateWrite()` pregunta a la chain qué pasaría (`eth_call`, con el `msg.sender` real): si va
   a revertir, revienta **antes** de abrir la wallet y sin gastar gas, con el error del contrato ya
   decodificado (`InsufficientBalance()`, `StalePrice()`…).
2. `walletClient.writeContract(...)` firma y manda.
3. `confirmReceipt(hash)` **espera el recibo y mira el status**. Detalle que engaña: viem resuelve
   `waitForTransactionReceipt` incluso cuando la transacción se revirtió, así que sin este chequeo
   la UI diría «¡Retirado!» con el saldo intacto.

Los tres pasos juntos son `writeAndConfirm({ functionName, args, value })`, y las guardas de
entorno (`requireNetwork`, `requirePublicClient`, `requireWalletClient`) viven en el mismo módulo
para no repetirlas en cada función.

### 5.3 Identidad y rol

La wallet conectada **es** la identidad. No hay base de datos propia: no hace falta para donar ni
para retirar. Un backend off-chain sólo tendría sentido para metadata no crítica (nombre, foto,
bio del creador), y hoy no existe.

El rol (`guest` / `donor` / `owner`) se **deriva** de la URL más la cuenta conectada, no se elige
(`src/js/roles/viewer-role.js`). Ese rol sólo decide qué se muestra: la autoridad final es el contrato.

El botón **Cambiar cuenta** (navbar y tarjeta de donación) abre el selector de cuentas de la
wallet con `wallet_requestPermissions` —`eth_requestAccounts` ya no pregunta nada una vez dado el
permiso— y la app además **sigue** los cambios de cuenta que el usuario haga en su propia wallet
suscribiéndose a `accountsChanged` (`onWalletAccountsChange` en `src/js/solidity/chain.js`), sin recargar la
página.

### 5.4 Modo demo (sólo la landing) y la tabla del historial

**El modo demo es de la landing, no de la app.** El "Acto II" de la landing —la tarjeta de la
sección *Querés invitar un whiskito*— invita en demo: simula la donación en el front (mismo
retardo de 1200 ms), **no firma nada** y **no deja rastro en ningún lado**. El flag vive en
`src/js/config/demo-mode.js` (`DEMO`, default `true`) y se apaga ahí con **`?demo=0`** (o `?real=1`), que
devuelve el camino on-chain: simular → firmar → confirmar.

**La página del link (`/u/0x…`) no es demo: cobra de verdad.** Su flujo (`src/js/entries/donate.js`) no le
pasa el modo a `fund()`, así que firma contra el contrato siempre, y no muestra ningún aviso de
demo (el aviso `.card-demo` de la tarjeta lo prende el flujo que corresponde: `app.js` en la
landing, nadie en el link).

- **Qué se simula:** sólo la donación de la landing. Las **lecturas** van a la chain (precio y
  saldos) y el **retiro** es real: el saldo del panel es el del contrato.
- **Sin wallet no hay quién firme**, ni en la landing ni en el link: ése es el único caso en que
  el link simula, y lo dice como *"simulada"* (no como *"demo"*).
- **La donación demo no es plata**, así que no se anota en ningún lado: el resumen del panel y la
  tabla del historial muestran la verdad de la chain (eventos `Funded`) y una prueba simulada no
  puede aparecer ahí como si hubiera entrado.
- **La guardia del dueño se relaja sólo en la landing en demo:** `canDonate(role, { demo })` deja
  que el dueño pruebe la donación en su propia página, porque no hay firma que proteger. En el
  link nunca se relaja: esa página cobra de verdad, así que el dueño está bloqueado siempre.
- **La tabla del historial** es la isla `whiskito-history-table`: la **tabla de todas las donaciones
  recibidas** por esa cuenta —cuándo, quién, el monto en POL y el equivalente en USD que grabó el
  evento—, leídas de la chain con `readDonationHistory()` (hasta 200, más nuevas primero). Vive
  sola en su página `/historial` y también INLINE en la vista del profesional de la landing, que es
  donde esa vista retira (`canWithdraw`); si la lectura falla, lo dice en vez de mostrar una tabla
  vacía. La sección `#panel` de la landing queda como **resumen y decoración** (saldo, últimas
  rondas y el botón de retirar).
- **Los montos se etiquetan en POL** en la tarjeta de donación, el panel y la tabla del historial
  ("Monto en POL", la unidad del balance, la columna de la tabla y el resumen). Los
  identificadores internos dicen POL también —`readPolPrice`, `balancePol`, `amountPol`,
  `formatPol`, `data-field="pol"`—: son la API entre islas y harness, y un vocabulario partido
  (código diciendo ETH, pantalla diciendo POL) se lee como si fueran dos monedas distintas.
  Quedan en ETH los dos **atributos HTML** de las islas (`eth-price`, `balance-eth`): no son JS
  sino markup, y `redesign-static.html` —la copia congelada contra la que compara el bloque F— los
  lleva escritos, así que renombrarlos obliga a regenerarla con `capture-static.html` y volver a
  pasar el control negativo (AGENTS.md §5).
  Las secciones **estáticas** (hero, trust, footer, cómo funciona) también dicen POL, y el link del
  footer dejó de ser un `href="#"` muerto: sale de `NETWORKS[red].explorer` + `fund` —Polygonscan en
  Amoy— y queda `hidden` en una red sin explorador (anvil).

### 5.5 La página que se comparte (`/u/0x…`)

El link que el profesional comparte en sus redes **no abre la landing**: abre una página aparte,
`src/donate.html`, con **una sola cosa en pantalla** —la tarjeta de donación, centrada— y lo
necesario para donar:

- **a quién le donás** (la dirección del link, cortada);
- **el monto** (input y chips, con el equivalente en dólares del precio que se lee de la chain);
- **conectar la wallet** desde la propia tarjeta (el botón emite el mismo `whiskito:connect-request`
  que el navbar; si no hay wallet instalada lo dice, y el monto se puede enviar igual en modo
  simulado, porque no hay quién firme);
- **donar**, ahí mismo, sin escanear ningún QR. **Esta página cobra de verdad**: la donación se
  firma contra el contrato y se confirma on-chain (§5.4 explica por qué el demo es sólo de la
  landing). No hay ningún aviso de demo acá, ni cartel ni texto.

La tarjeta no trae la fila de conexión ni el destinatario por defecto: son **opt-in**
(`recipient`, `viewer`, `showConnect`), así la card de la landing queda idéntica. Y esa página
sólo carga lo que usa: **4 archivos JS, sin la radio, sin el QR y sin la landing** (los otros 9
componentes no se registran).

Cómo llega el donante: `vite.config.js` tiene un plugin chico que manda `/u/<dirección>` a
`/donate.html?u=<dirección>`. Es un **redirect y no un rewrite**, y no es un detalle: en dev Vite
deja las rutas de los assets del HTML **relativas**, así que si la página se sirviera *en* `/u/…`
el navegador pediría `/u/js/entries/donate.js` y recibiría el HTML con un 200 — el módulo no cargaría y la
página quedaría muerta sin un solo error a la vista. En el build las rutas salen absolutas
(`/assets/…`).

Al publicar, esa misma trampa obliga a un **redirect** y no un rewrite: la URL tiene que cambiar a
`/donate.html`, porque con un rewrite la barra de direcciones sigue diciendo `/u/0x…` y el navegador
pediría los assets relativos del HTML bajo `/u/`. Por eso el `vercel.json` de la **raíz del repo**
—el que publica `dist/`— (§6.1) lleva un `redirect` de `/u/:addr` a `/donate.html`, no un `rewrite`.

**El dueño de la página no se dona a sí mismo** (con donaciones reales): si el que entra conecta
la cuenta **dueña**, la tarjeta deshabilita el botón de donar y lo dice (el mismo mensaje que la
landing). El rol se recalcula **también después de la conexión on-demand** dentro del handler de
donación: si no, un dueño que va derecho a "Invitar un Whiskito" —sin pasar por "Conectar
wallet"— se donaría a sí mismo, porque en ese momento el rol todavía era `guest`. **En esta página
la guardia no se relaja nunca** (cobra de verdad): el dueño que entra a su propio link queda
bloqueado y la tarjeta se lo dice. La excepción de demo es sólo de la landing.

**El veredicto de la transacción** (aceptada / cancelada) lo muestra la isla
`whiskito-tx-modal`: se abre con `islands.showTxModal({ kind, title, message, hash, explorer })` y
se cierra con el botón, `Escape` o un click en el fondo; con `hash` y `explorer` suma el enlace
"Ver en el explorador". La abre el flujo de la página (`src/js/entries/donate.js`) en los **tres
desenlaces**: **confirmada** (con el hash y el explorador de la red —en anvil no hay explorador,
así que el link no aparece), **simulada** (sin wallet conectada: lo dice, en vez de fingir una
confirmación on-chain) y **cancelada** (la firma rechazada en la wallet se distingue del error
real por `error.name`/`shortMessage`, que viem marca como `UserRejectedRequestError`). Cuando
corta la guardia de auto-donación el modal **no** se abre: eso no es un veredicto de transacción.

## 6. Correr el proyecto

Requisitos: [Foundry](https://book.getfoundry.sh/) (`anvil`, `forge`, `cast`), Python 3 y un
navegador. Las dependencias de JS se instalan con `bun install` (o `npm install`).

```bash
export PATH="$HOME/.foundry/bin:$PATH"          # anvil/forge/cast

# 1. chain local (chainId 31337, RPC en http://127.0.0.1:8545)
anvil

# 2. deploy: mock del oráculo + Fund. Las direcciones son determinísticas y están
#    en src/js/config/config.js; check-config verifica que no se hayan corrido.
bun run deploy
# = forge script src/script/deploy.sol --rpc-url http://127.0.0.1:8545 --broadcast \
#     --unlocked --sender 0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266
# El sender NO es opcional: sin `--sender`/`--private-key`, forge usa su *default
# sender*, no despliega nada y **igual** pisa `broadcast/…/run-latest.json`, así
# que el deploy "pasa" y el `check-config` siguiente da DRIFT sin nada en la chain.

# 3. servir la página (no hay build: se sirve el repo tal cual)
python3 .refactor-baseline/serve.py "$PWD" 8899 3600
# → http://127.0.0.1:8899/src/index.html
# → http://127.0.0.1:8899/src/index.html?u=0xf39f…  (la página de ese creador)

# 3b. o el entorno de desarrollo completo con UN comando (`scripts/dev.sh`):
#     levanta anvil —sólo si no hay ya una chain—, deploya —sólo si el contrato
#     todavía no está, así no corre los nonces— y sirve la app con recarga en
#     caliente. Al salir (Ctrl-C) baja el anvil que levantó él, y sólo ése.
bun run dev
# → http://localhost:5173/index.html        (Vite sirve desde `src/`)

# 4. publicar: el bundle de producción, con viem, lucide y qrcode adentro
bun run build      # → dist/index.html + dist/assets/*  (sin ninguna CDN)
bun run preview    # sirve dist/ tal cual → http://localhost:4173/index.html
```

Dos servidores, y no son intercambiables: **`serve.py` es el de la verificación** (sirve con
`Cache-Control: no-store` y tiene `/__hold__` y `/__report__`, que es de donde el harness saca el
veredicto), mientras que Vite es el del día a día. Si `serve.py` se borra, cualquier servidor de
archivos estáticos sirve la página, pero sin `no-store` el navegador reusa copias viejas y las
comparaciones dejan de valer.

Vite necesita sus `resolve.alias` en `vite.config.js`, y no son cosméticos: el `importmap` sólo
lo entiende el navegador, así que Vite resolvería con las reglas de Node cosas que ahí no existen.
Son tres: `lucide/…` (el paquete no publica `exports` ni una carpeta `icons/` en su raíz: los
archivos viven en `dist/esm/`), `https://esm.sh/viem` → `viem` y `https://esm.sh/qrcode@1.5.4` →
`qrcode`. Sin los últimos dos, el build dejaría esas URLs como imports externos y `dist/` seguiría
dependiendo de la red.

### 6.0 Entornos

Tres entornos, y sólo dos existen hoy: **dev** y **qa** corren; **prod** es el destino, no un hecho.

| entorno | red | `chainId` | cómo se llega | qué cuesta |
|---|---|---|---|---|
| **dev** | anvil | `31337` | `bun run dev` (levanta la chain, deploya si hace falta y sirve Vite en `:5173`) | gratis, sin faucet |
| **qa** | Polygon Amoy | `80002` | el sitio publicado en Vercel, **o** el frontend local apuntado a Amoy: `bun run dev` y abrir `http://localhost:5173/?chain=80002` | POL de faucet **sólo cuando se firma** |
| **prod** | Polygon mainnet | `137` | **no existe todavía**: no hay entrada en `NETWORKS` ni contrato deployado | — |

El atajo de qa-desde-local es **`bun run dev:qa`** (`bunx --bun vite --open "/?chain=80002"`): abre
Vite apuntado a Amoy, **sin** levantar anvil ni deployar nada. Equivale a `bun run dev` + la URL con
`?chain=80002`, pero sin la chain local de por medio.

**La red por defecto sale del ORIGEN** (`DEFAULT_CHAIN_ID`, `src/js/config/config.js`): en local
—`localhost`, loopback, `file://`/sin `location`, red privada o `.local`— la app apunta a **anvil**
(`31337`), y en cualquier otro origen apunta al sitio publicado, o sea a **Amoy** (`80002`). Es
deliberado: el QR del link de dev abre el server local desde el celular por IP de LAN, y esa visita
tiene que seguir apuntando a anvil. Los hostnames exactos están en la tabla de §5.

**Modos de trabajo contra qa** (ninguno necesita deployar nada):

- **Lectura contra Amoy desde local, gratis y sin faucet**: `http://localhost:5173/?chain=80002`.
  Es el mismo frontend local leyendo el `Fund` real de Amoy por su RPC público. `?chain=80002`
  **sola alcanza**: devuelve la configuración completa de esa red (`fund`, `priceFeed`, `rpc`,
  `explorer`), así que no hace falta ni `?rpc=` ni `?fund=`.
- **Firma contra Amoy**: lo mismo, con la wallet conectada **en Amoy** (la app le pide el cambio de
  red si no lo está). Recién ahí hace falta POL: es gas, y sale del faucet.
- **La página del link (`/u/0x…`) contra Amoy desde local**: entrar **directo** a
  `http://localhost:5173/donate.html?u=0x…&chain=80002`. El redirect `/u/:addr` —el de Vite en dev
  y el de `vercel.json` en producción— **sí conserva** los query params extra (Vite los reescribe a
  propósito en `vite.config.js`, y el de Vercel se comprobó en vivo: responde `307` con `?chain=`
  intacto), pero entrar directo no depende de eso.

**Anvil primero, deploy a Amoy después.** Todo se desarrolla y se verifica en anvil; el deploy a
Amoy es **deliberado**, lo corre el usuario con su keystore (`bun run deploy:amoy`) y ningún agente
lo dispara para «probar» (§6.1, y la prohibición en `AGENTS.md` §5).

**La puerta e2e es anvil-only, y esto conviene decirlo fuerte**: `run-harness.py` y
`run-donate-probe.py` exigen anvil en `8545` y el harness tiene la red clavada en `31337`, así que
**qa contra Amoy hoy es QA manual**: ninguna aserción automática toca el `chainId 80002`.

**`?chain=` es el override manual** y gana sobre el origen (§5). Un `chainId` que **no** está en
`NETWORKS` **se descarta entero** —con un aviso por consola— y la app cae a la red del origen: nunca
mezcla el `chainId` de una red con el `fund`/`rpc` de otra, así que un typo no puede hacer que firmes
contra el contrato equivocado. `?rpc=` y `?fund=` siguen siendo perillas independientes (apuntar a
otro nodo o a otro deploy) y se conservan tal cual vengan.

**Si la wallet está en otra red, la app no firma.** Con `?chain=` la app le **pide** a la wallet que
se mueva (y si no conoce la red, se la agrega); si el usuario rechaza, la conexión falla con un
mensaje que nombra las dos redes. Y si la wallet se cambia de red *después* de conectar, la app lo
sigue sin recargar y **frena la escritura antes de firmar** — mientras las lecturas siguen andando,
porque van por HTTP al RPC de la red de la página y no dependen de la wallet.

### 6.1 Deploy en Polygon Amoy

La red publicada es **Polygon Amoy**: `chainId 80002`, RPC público
`https://polygon-amoy-bor-rpc.publicnode.com`, explorer `https://amoy.polygonscan.com` y moneda
nativa **POL**.
(`https://rpc-amoy.polygon.technology` no resuelve DNS en este entorno y `rpc.ankr.com` pide API
key. El `.env` lleva `AMOY_RPC_URL`, que es lo que resuelve `--rpc-url amoy` vía `[rpc_endpoints]`
de `foundry.toml`.)

El script `src/script/deploy-amoy.sol` despliega el **`PolUsdAdapter`** (el POL/USD derivado de las
dos patas reales, §3.2) **y** el `Fund` apuntándole. El mock es cosa del deploy local. El código ya
está listo, pero **el redeploy está pendiente** (lo corre el usuario): el `Fund` que está hoy en la
chain todavía usa el feed ETH/USD.

```bash
# 1. una sola vez: keystore de Foundry para firmar el deploy sin poner la clave
#    en la línea de comandos (te pide una password y la guarda cifrada).
cast wallet import deployer --interactive

# 2. el deploy. Pide la password del keystore.
bun run deploy:amoy -- --with-gas-price 35gwei --priority-gas-price 30gwei
# = forge script src/script/deploy-amoy.sol --rpc-url amoy --broadcast --account deployer \
#     --with-gas-price 35gwei --priority-gas-price 30gwei
# (los DOS flags de gas son por la trampa de abajo: sin ellos Foundry manda maxFee 127 gwei
#  y prioridad 1 gwei, y con una cuenta de 0,1 POL el nodo rechaza la transacción)

# 3. el script imprime DOS addresses: la del adaptador y la del Fund. Se pegan en
#    src/js/config/config.js → NETWORKS[80002]: el Fund en `fund` y el adaptador en `priceFeed`
#    (y el bloque del deploy, que también imprime el run, en `deployBlock`)

# 4. ¿config.js coincide con el deploy?
node .refactor-baseline/check-config.mjs
# tiene que decir:  OK :: config.js coincide con el último deploy
# si dice DRIFT, la app le está hablando a un contrato que no es
```

- **El `.env` no lleva claves privadas**: la firma sale del keystore (`--account deployer`).
- **Trampa medida del proyecto** (la misma que en local, §6): `forge script … --broadcast` **sin**
  `--account`/`--sender`/`--private-key` usa el *default sender* de Foundry, **no despliega nada**
  (`cast code <dirección>` → `0x`) y **igual escribe** `broadcast/deploy-amoy.sol/80002/run-latest.json`.
  Un deploy "exitoso" con una address que no existe en la chain es exactamente lo que `check-config`
  marca como DRIFT.
- **Verificar el código** en el explorer necesita `ETHERSCAN_API_KEY` en el `.env` (Etherscan V2
  cubre Amoy con `--chain 80002`).
- **El RPC de la app es publicnode, no drpc** (medido con `eth_getLogs` del evento `Funded` del
  contrato real, contra los RPC públicos de Amoy; la fila de thirdweb es la medición del
  orquestador, no repetida acá):

  | RPC | `fromBlock: 0` | desde `deployBlock` (hoy ≈466 bloques) | 100 bloques |
  |---|---|---|---|
  | `https://polygon-amoy.drpc.org` (el que estaba) | rechaza (HTTP 400, `code 35`) | **rechaza** (HTTP 400) | OK |
  | `https://polygon-amoy-bor-rpc.publicnode.com` (el que está) | rechaza (`exceed maximum block range: 10000`) | OK (0 eventos) | OK (0 eventos) |
  | `https://80002.rpc.thirdweb.com` | rechaza (máx 1.000) | OK | OK |

  El plan free de `drpc` acepta a lo sumo **100 bloques** por pedido: un rango de 200 ya lo rechaza
  (y su mensaje —«ranges over 10000 blocks are not supported on free plan»— miente), así que no
  puede servir un panel que lee eventos: con drpc la tabla del historial quedaría vacía en el sitio
  publicado (en una medición previa, un rango de 466 bloques llegó a dar `HTTP 500`). publicnode
  sirve hasta **10.000 bloques de diferencia** por pedido (medido: 10.001 bloques andan, 10.002 no),
  y el head de Amoy avanza cada ~2 s, así que un pedido único "desde el deploy" dejaría de servir a
  las pocas horas: `readDonationHistory` lee los eventos **por ventanas de 5.000 bloques hacia
  atrás** desde el head, con piso en `NETWORKS[red].deployBlock` (`48371056` en Amoy, el bloque del
  deploy real; `0` en anvil, donde el deploy sale del bloque 0).
- **Gas, medido**: el deploy del `Fund` son **1.029.377 de gas** (~0,031 POL al precio efectivo
  real). Dos trampas juntas, las dos medidas:
  1. **`eth_gasPrice` en Amoy miente para el chequeo previo de saldo**: sugería **127,8 gwei**
     cuando el piso real es **25–30 gwei** (80 bloques: 53 transacciones, la más barata 25 gwei,
     51 bloques vacíos → no hay congestión). Como el nodo valida `gas × maxFeePerGas` **antes** de
     aceptar, esa sugerencia con 0,1 POL en la cuenta da *fondos insuficientes* aunque el costo
     real sea la cuarta parte. De ahí `--with-gas-price 35gwei` (deja el chequeo previo en
     0,036 POL).
  2. **Foundry deja la prioridad en 1 gwei** si no se la pasás (comprobado en un fork de Amoy), y
     con el base fee en 0 el precio efectivo sería 1 gwei: por debajo del piso que aplica la red.
     De ahí `--priority-gas-price 30gwei`, que es lo que pagaban las transacciones que sí entraron.
  La cuenta necesita POL de testnet; el faucet de Polygon está en
  [docs.polygon.technology/tools/gas/matic-faucet](https://docs.polygon.technology/tools/gas/matic-faucet).
- **Valuación en Amoy**: no hay feed POL/USD publicado, así que se **deriva** con `PolUsdAdapter`
  (§3.2). Mientras el redeploy no se haga, el `Fund` de la chain sigue valuando POL con el precio
  del ETH y el `priceFeed` de `config.js` sigue siendo el feed ETH/USD.

**Publicación del frontend**

- **El sitio está publicado** en <https://whiskito.vercel.app> (proyecto Vercel `whiskito`, cuenta
  `santidele22`). El build corre **en Vercel**, no en tu máquina: `vercel.json` (raíz del repo) fija
  `bun install` + `bun run build` y `outputDirectory: dist`, y el bundle servido trae los mismos
  hashes que el `dist/` local —es el mismo artefacto—. No hay que subir `dist/` a mano.
- **El repo está conectado a Vercel** (`vercel git connect`): **pushear a `main` despliega a
  producción solo**, y cada PR saca un *preview*. Para forzar un deploy desde el repo:
  `vercel deploy --prod --project whiskito`.
- **La ruta `/u/0x…` publicada es un redirect, no un rewrite** (`vercel.json`:
  `/u/:addr(0x[0-9a-fA-F]{40})` → `/donate.html?u=:addr`, más una variante para la barra final).
  Tiene que ser redirect: con un rewrite la barra de direcciones seguiría diciendo `/u/0x…` y el
  navegador pediría bajo `/u/` los assets relativos del HTML (la trampa de §5.5 y de
  `vite.config.js`). Verificado en vivo: `/` responde `200`; un link bien formado responde `307`
  conservando `?chain=` y `?demo=`; y una ruta con menos de 40 dígitos hex (`/u/0x1234`) da **404**
  en vez de redirigir, porque el patrón exige la dirección completa.

## 7. Verificación

```bash
# los chequeos sin navegador del job `check` del CI; el job `e2e` corre además esta puerta
# completa (harness + sonda). Detalle en .github/workflows/README.md
forge fmt --check && forge build --sizes && forge test

# ¿las direcciones de config.js coinciden con el último deploy?
node .refactor-baseline/check-config.mjs

# ¿algún import relativo roto o con espacios?
node .refactor-baseline/verify-refactor/resolve-imports.mjs . src/index.html

# end-to-end: navegador real contra la chain (sale 0 si pasa)
python3 .refactor-baseline/verify-refactor/run-harness.py 8899
```

El harness abre `.refactor-baseline/islands.html` en Firefox headless y acciona la app de verdad:
monta las islas, conecta una wallet falsa que reenvía las transacciones a anvil, **dona ETH real**
al contrato —en la página cargada con `?demo=0`— hace click en retirar y comprueba que el saldo en
la chain vuelva a cero. Además verifica el **modo demo de la landing** (su default): que donar
**no** pida ninguna firma, que no ensucie el resumen del panel, y que la tabla del historial
liste las **donaciones reales** de la chain (P6: el harness manda una donación de verdad a la
cuenta conectada y busca la fila en la tabla).
Hoy son **257 aserciones**. Necesita anvil corriendo con el deploy hecho y el oráculo fresco (el
mock arranca con la hora del deploy y el contrato rechaza precios de más de 3 h).

La página que se comparte (`/u/0x…`) tiene su propia sonda, sobre el dev server —el único que
sirve esa ruta— y con la misma wallet falsa:

```bash
python3 .refactor-baseline/verify-refactor/run-donate-probe.py 8899
```

**La sonda necesita el repo quieto**: Vite sirve la propia sonda desde `src/`, así que editar
cualquier archivo mientras corre la recarga entera y el run termina sin veredicto (`NO REPORT`).
Si estás tocando código, corré la sonda cuando termines (y anotá el checksum con el que pasó).

Las aserciones de esta etapa tienen **control negativo**, y en las dos páginas: rompiendo a
propósito la guardia que el demo relaja, el `donations:` que lee la chain y el sello "demo" que ya
no debe existir, fallan **6 en el harness**; y devolviendo el modo demo al link (o mostrando el
aviso de la tarjeta siempre), fallan **7 en la sonda**. Sin esos controles, "no firmó", "no dice
demo" o "firma de verdad" no probarían nada.

`test/PolUsdAdapter.t.sol` tiene **18 tests** de forge: la matemática de la derivación, la frescura
de cada pata con `vm.warp`, precios 0 y negativos, decimales mixtos, `updatedAt` = mínimo de las
dos, `getRoundData` que revierte, y del `Fund` el piso (`MINIMUM_USD() == 1e16`, donar justo en el
piso pasa y por debajo revierte `InsufficientAmount()`). `forge test` los corre de verdad: antes
`test/` estaba vacío y pasaba sin ejecutar nada. La puerta de aceptación del proyecto sigue siendo
el harness de navegador, no la suite de Solidity.

## 8. Roadmap

Lo que falta, en el orden en que se sostiene solo. **Publicar la app ya está hecho** (§6.1): el sitio
vive en <https://whiskito.vercel.app> contra Amoy y `main` despliega solo.

1. **WhiskitoCoin (ERC20)** — recompensa por donar. Cada donación dispara un `mint()` al donante, y
   esa función tiene que estar **restringida** (sólo los contratos autorizados pueden acuñar) para
   que nadie se mintee tokens sin donar. Hoy no hay OpenZeppelin declarado como dependencia
   directa (está en `node_modules` sólo como dependencia transitiva de `@chainlink/contracts`) ni
   remapping en `foundry.toml`: hay que agregar los dos.
2. **RedeemShop** — canje de WhiskitoCoin por premios: quema el token y, si el premio es un
   coleccionable, mintea el NFT directo a la wallet. Si el premio es un beneficio off-chain
   (descuento, merch), alcanza con emitir `Redeemed(user, itemId)` y que el equipo lo gestione: el
   contrato no necesita saber qué es el ítem.
3. **BadgeNFT (ERC721)** — `tokenId` único, metadata en IPFS vía `tokenURI` (el contrato guarda la
   referencia, no la imagen). Dos disparadores previstos: canje manual y hito automático desde
   `Fund`.
4. **Factory** — un `Fund` por creador, para aislar fondos entre creadores, aceptando el costo de
   gas de cada deploy. La identidad y la URL por creador ya funcionan hoy sin Factory.
5. **Verificar en Polygonscan** — el `Fund` de Amoy está **sin verificar**: falta
   `ETHERSCAN_API_KEY` en el `.env` (§6.1). Con el redeploy hay que verificar también el
   `PolUsdAdapter`.
6. **Redeploy en Amoy del `PolUsdAdapter` y del `Fund`** — el código ya está (§3.2), pero la chain
   todavía tiene el `Fund` viejo. Medido en la chain con `cast call`: `getConversionRate(1e18)` =
   **$2.692,52** (o sea, el feed ETH/USD) y `MINIMUM_USD()` = **5e17** (0,5 USD, no el `1e16` del
   repo). Contra el POL/USD real derivado de las dos patas de Amoy (≈ **$0,1010**), eso significa que
   hoy **todo importe en USD que muestra la UI está inflado ~26.660×** y que el piso efectivo es
   ~0,000186 POL, ≈533× por debajo del previsto para después del redeploy (0,099 POL). Lo corre el
   usuario con `bun run deploy:amoy` (§6.1), pega las dos direcciones en `config.js` y confirma con
   `check-config`.
7. **Sincronizar `DESIGN-SPEC.md`** — el spec del rediseño todavía dice «Mínimo: 0,5 USD» (el piso
   real es 0,01) y no documenta el link al explorador del footer, que ahora sale de la red. El ancla
   `redesign-static.html` **ya está regenerada** y su bloque F verificado con control negativo (§5.4).
8. **Deploy en Sepolia** — otra red (Ethereum, `chainId 11155111`), no la publicada: con el
   aggregator **real** de Chainlink (no el mock local) y descomentando y completando la entrada de
   `NETWORKS` en `src/js/config/config.js` con la dirección que salga de la documentación de Chainlink para
   esa red.

Endurecimientos pendientes del contrato actual: la validación `answeredInRound >= roundId` (§3.2),
sacar el error sin uso `ProfessionalIndexOutOfBounds`, y acotar el rango de bloques de
`getContractEvents` cuando la red deje de ser local (hoy lee desde el bloque 0).

## 9. Notas de alcance

- Todo el desarrollo y el despliegue ocurren en **testnet y en local**, sin valor real.
- Los nombres **WhiskitoCoin**, **RedeemShop** y **BadgeNFT** son los del plan original y quedan como
  nombres de trabajo hasta que existan.
- **Idioma:** identificadores en inglés describiendo lo que hacen (`writeAndConfirm`,
  `confirmReceipt`); comentarios, documentación y texto de la interfaz en español.
- El código está documentado en `AGENTS.md` (leyes de arquitectura, bucle de verificación y
  trampas ya pagadas) y en `.refactor-baseline/README.md` (el detalle de cada clase del curso y las
  trampas de la verificación en navegador).

## 10. Estructura del repo

```
src/
  script/fund.sol          el contrato
  script/deploy.sol        mock del oráculo + deploy local
  script/pol-usd-adapter.sol  adaptador POL/USD derivado (LINK/USD ÷ LINK/MATIC)
  script/deploy-amoy.sol   deploy en Polygon Amoy (adaptador POL/USD + Fund)
  fund.abi.json            ABI generado por forge
  index.html               la landing (importmap: lucide → node_modules)
  styles.css               hoja global (tokens, reset, secciones en light DOM)
  js/
    entries/main.js        punto de entrada: registra las islas y llama a startApp()
    entries/app.js         el flujo de la landing: datos hacia las islas, eventos hacia afuera
    entries/donate.js      el flujo de la página del link (`/u/0x…`), que cobra de verdad
    solidity/chain.js      red activa y los dos clientes
    solidity/errors.js     errores de la wallet (EIP-1193) y el texto del desajuste de red
    solidity/tx.js         verificaciones y envío de toda escritura
    solidity/solidity-functions.js  lecturas y escrituras del contrato
    solidity/fund-abi.js   ABI legible del contrato
    config/config.js       redes, direcciones y constantes de la app
    config/constants.js    constantes de la app
    config/demo-mode.js    ¿demo (default) o camino real on-chain (`?demo=0`)?
    dom/islands.js         la ÚNICA frontera con el DOM
    dom/icons.js           registro e hidratación de los iconos de Lucide
    utils/format.js        formateo (montos y direcciones cortas)
    roles/viewer-role.js   rol derivado (guest/donor/owner) y la guardia de auto-donación
  components/              13 web components ("islas") + base-element.js
                           (whiskito-history-table es la tabla del historial)
test/                      PolUsdAdapter.t.sol (18 tests de forge)
.refactor-baseline/        andamiaje de verificación (descartable)
.github/workflows/test.yml CI: dos jobs (`check` + `e2e`, ver su README)
```
