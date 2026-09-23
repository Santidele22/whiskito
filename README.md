# Whiskito — donaciones on-chain en ETH

Landing para **recibir donaciones en ETH** a través de un contrato inteligente, con el monto
mínimo validado **en dólares** (no en un ETH fijo) contra un oráculo de precio de Chainlink.

Proyecto del curso **Web3 full stack de Cyfrin** (el «Buy Me a Coffee» del curso, acá extendido a
una plataforma de donaciones por creador). Nació con otro nombre y se rediseñó como **Whiskito**: el
renombre alcanzó a los web components (`whiskito-*`), a sus clases y a los eventos `whiskito:*`.

> **Alcance:** sólo testnet y desarrollo local; no hay intención de operar en mainnet ni con valor
> real. Hoy corre contra **anvil** (`chainId 31337`). **Sepolia está previsto pero no desplegado**:
> la entrada existe comentada en `src/js/config.js`.

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
| **Deploy en Sepolia** | — | red pública de pruebas | 🔲 futuro — hoy sólo local |

## 1. Resumen

Un visitante entra a la página de un creador, conecta su wallet y dona ETH. El contrato valida que
la donación equivalga a **al menos 0.5 USD** usando el precio ETH/USD del oráculo, la acredita al
saldo de **ese** creador y emite un evento con el detalle. El creador, desde su propia wallet,
retira lo acumulado a su favor.

Todo lo demás del plan (recompensar al donante con un token, canjearlo por premios, mintear
insignias) es roadmap: ver §8.

## 2. Arquitectura (la que existe hoy)

```
donante ──fund(profesional)──▶ Fund ──▶ balances[profesional] ──withdraw()──▶ creador
                                 │
                                 └── getConversionRate() ──▶ AggregatorV3Interface (ETH/USD)
```

| pieza | dónde | qué hace |
|---|---|---|
| contrato `Fund` | `src/script/fund.sol` | donaciones, validación en USD, saldos por beneficiario, retiros |
| script de deploy | `src/script/deploy.sol` | despliega un `MockV3Aggregator(8, 2000e8)` y el `Fund` (sólo local) |
| módulos de la app | `src/js/` | config, clientes, lecturas/escrituras, roles, formato, iconos, modo demo y su ledger |
| islas (componentes) | `src/components/` | 11 web components que se pintan solos y avisan por eventos |
| verificación | `.refactor-baseline/` | harness e2e en navegador real, sondas y anclas congeladas |

## 3. Contrato `Fund`

### 3.1 Responsabilidades

- Recibir ETH por una función `payable`: `fund(address professional)`.
- Rechazar el envío vacío (`ZeroAmount`) y la dirección cero como beneficiario (`ProfessionalNotPass`).
- Validar que el monto equivalga a **≥ 0.5 USD** con el precio actual de ETH/USD (`MINIMUM_USD = 50 * 1e16`).
- Registrar quién donó y cuánto (`mapping(address => uint256) donation`, interno) y **acumular el
  saldo de cada beneficiario** (`mapping(address => uint256) balances`, público).
- Guardar el historial consultable por índice (`getDonations(uint256)` sobre el array `donations`).
- Dejar que **cada beneficiario retire su propio saldo**, no el de otro.

**No hay `owner`.** A diferencia del borrador del proyecto, el contrato no tiene dueño ni
`onlyOwner`: la autoridad es `balances[msg.sender]`, así que la dirección que firma sólo puede
retirar lo suyo. La página decide *a quién* se le dona (`fund(professional)`) y el contrato no
opina sobre quién es un creador legítimo: cualquier dirección puede recibir.

### 3.2 Integración con Chainlink Price Feeds

Se usa `AggregatorV3Interface` para leer ETH/USD on-chain.

- **De dónde sale la dirección del feed:** de la documentación oficial de Chainlink para ese par y
  esa red (`docs.chain.link/data-feeds/price-feeds/addresses`), **nunca de memoria**. En el deploy
  local no se usa un feed real: `deploy.sol` despliega un `MockV3Aggregator` propio con respuesta
  `2000e8` (2000 USD, 8 decimales) y es esa dirección la que recibe el constructor.
- **Los decimales no se asumen:** `priceFeedDecimals` se lee del feed en el constructor.

Validaciones sobre el precio recibido (no se lee y se confía):

| validación | dónde | estado |
|---|---|---|
| `price > 0` — un feed roto puede devolver 0 o negativo | `getLatestPrice()` → `InvalidPrice()` | ✅ |
| `updatedAt != 0` y no futuro (`updatedAt <= block.timestamp`) | `getLatestPrice()` → `StalePrice()` | ✅ |
| `block.timestamp - updatedAt <= 3 hours` (`STALENESS_THRESHOLD`) | `getLatestPrice()` → `StalePrice()` | ✅ |
| `answeredInRound >= roundId` — que la ronda se haya completado | — | 🔲 **falta** |

> La cuarta es la que el plan daba por obligatoria y hoy no está. Se puede agregar sin cambiar la
> interfaz; queda anotada como endurecimiento pendiente.

### 3.3 Conversión de unidades

`msg.value` llega en wei (18 decimales). El feed devuelve el precio con los decimales que diga
`priceFeed.decimals()` (8 en el mock, pero nunca asumido). `getConversionRate(ethAmount)` calcula
`scaleFactor = 10 ** (18 - decimals)` y escala **todo a 18 decimales** antes de comparar contra el
piso de 0.5 USD, para no mezclar magnitudes.

### 3.4 Errores personalizados

Se usan `error Nombre();` + `revert Nombre();` en vez de `require(cond, "texto")`: más baratos en
gas (no hay strings en el bytecode) y el error viaja decodificado a la UI.

| error | cuándo |
|---|---|
| `InvalidPrice()` | el feed devolvió un precio ≤ 0 |
| `StalePrice()` | `updatedAt` en 0, en el futuro, o más viejo que 3 h |
| `InsufficientAmount()` | la donación no llega a 0.5 USD |
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
   `src/js/viewer-role.js` deriva de ahí el rol de quien mira (`guest` / `donor` / `owner`).
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
`src/js/config.js`). Así el QR que generás mientras desarrollás abre **tu** app y la donación se
puede probar de punta a punta sin publicar nada; con un dominio fijo, el QR de dev mandaba a
producción, donde no hay nada que probar. `?site=https://…` lo fuerza y, fuera del navegador
(los scripts de verificación importan `config.js` con Node), cae al dominio canónico.

Eso obliga a que la ruta del link (`/u/0x…`) **exista**: el servidor de desarrollo la sirve con
`appType: "spa"` (Vite la reescribe a `index.html`). Al publicar, el host tiene que hacer esa
misma reescritura (`/u/*` → `/index.html`); si no, los links compartidos dan 404 en producción.

### 5.1 Dos clientes, dos roles

| cliente | transporte | para qué |
|---|---|---|
| `publicClient` | HTTP al RPC de la red | **sólo lectura**: saldos, precio, eventos. No firma ni cuesta gas; funciona sin nadie conectado |
| `walletClient` | `custom(window.ethereum)` | **firma y envía** en nombre del usuario (donar, retirar). Abre la wallet y cuesta gas |

Las lecturas van por HTTP a propósito, no por la wallet: así el precio y el panel se ven aunque no
haya conexión, y la red se elige con el `chainId` que reporta la wallet.

Para hablar con el contrato hacen falta dos datos, y cada uno vive en un solo lugar:

- **la dirección**: `src/js/config.js` (`NETWORKS` por `chainId`, con override por URL
  `?chain=31337&rpc=http://…&fund=0x…`);
- **el ABI**: `src/js/fund-abi.js` (legible, escrito a mano) y `src/fund.abi.json` (generado por
  `forge build`). Son dos copias: si cambia el contrato, se actualizan las dos.

### 5.2 Escrituras: simular → firmar → confirmar

Toda escritura pasa por `src/js/tx.js`:

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
(`src/js/viewer-role.js`). Ese rol sólo decide qué se muestra: la autoridad final es el contrato.

El botón **Cambiar cuenta** (navbar y tarjeta de donación) abre el selector de cuentas de la
wallet con `wallet_requestPermissions` —`eth_requestAccounts` ya no pregunta nada una vez dado el
permiso— y la app además **sigue** los cambios de cuenta que el usuario haga en su propia wallet
suscribiéndose a `accountsChanged` (`onWalletAccountsChange` en `src/js/chain.js`), sin recargar la
página.

### 5.4 Modo demo (sólo la landing) y "Mi Panel"

**El modo demo es de la landing, no de la app.** El "Acto II" de la landing —la tarjeta de la
sección *Querés invitar un whiskito*— invita en demo: simula la donación en el front (mismo
retardo de 1200 ms), **no firma nada** y **no deja rastro en ningún lado**. El flag vive en
`src/js/demo-mode.js` (`DEMO`, default `true`) y se apaga ahí con **`?demo=0`** (o `?real=1`), que
devuelve el camino on-chain: simular → firmar → confirmar.

**La página del link (`/u/0x…`) no es demo: cobra de verdad.** Su flujo (`src/js/donate.js`) no le
pasa el modo a `fund()`, así que firma contra el contrato siempre, y no muestra ningún aviso de
demo (el aviso `.card-demo` de la tarjeta lo prende el flujo que corresponde: `app.js` en la
landing, nadie en el link).

- **Qué se simula:** sólo la donación de la landing. Las **lecturas** van a la chain (precio y
  saldos) y el **retiro** es real: el saldo del panel es el del contrato.
- **Sin wallet no hay quién firme**, ni en la landing ni en el link: ése es el único caso en que
  el link simula, y lo dice como *"simulada"* (no como *"demo"*).
- **La donación demo no es plata**, así que no se anota en ningún lado: el resumen del panel y la
  tabla de "Mi Panel" muestran la verdad de la chain (eventos `Funded`) y una prueba simulada no
  puede aparecer ahí como si hubiera entrado.
- **La guardia del dueño se relaja sólo en la landing en demo:** `canDonate(role, { demo })` deja
  que el dueño pruebe la donación en su propia página, porque no hay firma que proteger. En el
  link nunca se relaja: esa página cobra de verdad, así que el dueño está bloqueado siempre.
- **"Mi Panel"** es la isla `whiskito-dashboard`: el botón del navbar (visible sólo con la wallet
  conectada) abre un modal con la **tabla de todas las donaciones recibidas** por esa cuenta —
  cuándo, quién, ETH y el equivalente en USD que grabó el evento—, leídas de la chain con
  `readDonationHistory()` (hasta 200, más nuevas primero). Si la lectura falla, el modal lo dice
  en vez de mostrar una tabla vacía. La sección `#panel` de la landing queda como **resumen y
  decoración** (saldo, últimas rondas y el botón de retirar).

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
el navegador pediría `/u/js/donate.js` y recibiría el HTML con un 200 — el módulo no cargaría y la
página quedaría muerta sin un solo error a la vista. En el build las rutas salen absolutas
(`/assets/…`), así que al publicar un rewrite del host (`/u/*` → `/donate.html?u=:splat`) puede
conservar la URL linda.

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
"Ver en el explorador". La abre el flujo de la página (`src/js/donate.js`) en los **tres
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
#    en src/js/config.js; check-config verifica que no se hayan corrido.
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

## 7. Verificación

```bash
# lo mismo que corre el CI (.github/workflows/test.yml)
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
**no** pida ninguna firma, que no ensucie el resumen del panel, y que "Mi Panel" liste las
**donaciones reales** de la chain (el harness manda una donación de verdad a una cuenta fresca y
la busca en la tabla).
Hoy son **196 aserciones**. Necesita anvil corriendo con el deploy hecho y el oráculo fresco (el
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

`test/` está vacío: `forge test` pasa sin correr nada. La verificación real de este proyecto es el
harness de navegador, no una suite de Solidity.

## 8. Roadmap

Lo que falta, en el orden en que se sostiene solo:

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
5. **Deploy en Sepolia** — con el aggregator **real** de Chainlink (no el mock local): hay que
   descomentar y completar la entrada de `NETWORKS` en `src/js/config.js` con la dirección que salga
   de la documentación de Chainlink para esa red.

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
  fund.abi.json            ABI generado por forge
  index.html               la landing (importmap: lucide → node_modules)
  styles.css               hoja global (tokens, reset, secciones en light DOM)
  js/
    main.js                cableado: datos hacia las islas, eventos hacia afuera
    chain.js               red activa y los dos clientes
    tx.js                  verificaciones y envío de toda escritura
    solidity-functions.js  lecturas y escrituras del contrato
    viewer-role.js         rol derivado (guest/donor/owner) y la guardia de auto-donación
    demo-mode.js           ¿demo (default) o camino real on-chain (`?demo=0`)?
    config.js              redes, direcciones y constantes de la app
    fund-abi.js            ABI legible del contrato
    constants.js format.js icons.js
  components/              11 web components ("islas") + base-element.js
                           (whiskito-dashboard es el modal "Mi Panel")
test/                      vacío
.refactor-baseline/        andamiaje de verificación (descartable)
.github/workflows/test.yml CI: forge fmt / build / test
```
