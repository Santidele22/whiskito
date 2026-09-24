# Verificación del refactor a Web Components

Andamiaje de verificación, **no parte de la app**. Se puede borrar entero
(`rm -rf .refactor-baseline`) cuando el trabajo esté commiteado. Conviene
conservarlo hasta entonces: el repo no tiene ningún commit, así que el
`index.html` congelado de acá es la única copia del original.

| archivo | qué es |
|---|---|
| `index.html` | **copia congelada** del `src/index.html` original monolítico (pre-refactor). No se toca. |
| `styles.css`, `main.js` | copias congeladas, para que el `index.html` congelado se vea igual al abrirlo. |
| `v1/` | copia congelada del estado de la **clase 1** (web components, sin reactividad): `components/`, `styles.css`, `main.js`, `index.html`. Sirve para diffear y comprobar que cada clase cambia sólo lo previsto. |
| `islands.html` | verificador de la **clase 2** (islas reactivas): acciona los componentes y comprueba estados. |
| `donate-probe.html` | sonda de la **página que se comparte** (`/u/0x…`): la ruta, la tarjeta, el modal, la guardia del dueño y el **cambio de cuenta** (bloque S). La corre `verify-refactor/run-donate-probe.py`. |
| `verify-refactor/run-donate-probe.py` | runner de esa sonda: copia el probe a `src/`, sirve la app con el dev server (el único con la ruta `/u/0x…`) y colecta el veredicto con `serve.py`. |
| `zoom.html` | visor para inspección visual: carga la app en un iframe y hace scroll a un selector (`?sel=%23panel`). |
| `serve.py` | servidor que sirve el workspace, retiene el evento `load` y manda `no-store`. |
| `redesign-static.html` | **ancla vigente de F1–F5**: copia congelada del markup estático ya rediseñado ("Blues Poster '62"). La genera `capture-static.html`. |
| `capture-static.html` | herramienta de una sola vez: renderiza la app, le quita los `<script>` y sube el resultado como `redesign-static.html`. |
| `DESIGN-SPEC.md` | el contrato de copy y estructura del rediseño; no es verificación, es la especificación que se implementó. |

## Clases 2 a 5 — islas reactivas, Shadow DOM y widget flotante (`islands.html`)

```bash
cd <raíz del proyecto>
mkdir -p .refactor-baseline/.ff   # Firefox necesita que el perfil exista
python3 .refactor-baseline/serve.py "$PWD" 8899 20 &

firefox --headless --no-remote --profile "$PWD/.refactor-baseline/.ff" \
  --screenshot /tmp/out.png --window-size=300,200 \
  "http://127.0.0.1:8899/.refactor-baseline/islands.html"

# inspección visual de una zona concreta (por selector CSS)
firefox --headless --no-remote --profile "$PWD/.refactor-baseline/.ff" \
  --screenshot /tmp/zoom.png --window-size=1440,900 \
  "http://127.0.0.1:8899/.refactor-baseline/zoom.html?sel=%23donar"
```

El reporte sale en la consola del servidor (`fetch` a `/__report__?d=...`) y
también en el `<pre>` de la página. El harness consulta las islas a través de
`el.shadowRoot ?? el`, así que el mismo archivo sirve antes y después de Shadow
DOM (y por eso las 72 aserciones de la clase 2 siguen valiendo adentro del shadow).

Qué comprueba (257 aserciones):

- **A** — los 11 componentes montan (light DOM o shadow root); `main.js` inyecta precio y portfolio; el panel pinta las 3 filas.
- **F** — las secciones **estáticas** (hero, cómo funciona sin la tarjeta, seguridad, preguntas, footer) siguen idénticas al original congelado (el subárbol dinámico se enmascara).
- **B** — isla de donación: equivalente en USD, mínimo de 0.01 USD (el hint dice `El mínimo es 0.01 USD ≈ … POL`), redondeo hacia arriba de los chips, chip activo (uno solo), hint de mínimo, eventos `whiskito:amount-change` y `whiskito:fund-request`, estados de transacción (`pending`/`success`/`error`/`idle`) y comportamiento sin precio.
- **C** — isla del navbar: estados `disconnected`/`connecting`/`connected`/`unsupported`, dirección acortada, `title` sólo cuando corresponde; y **desconectar**: el botón aparece sólo con la wallet conectada, el botón de conectar **no** vuelve a pedir conexión estando conectado, y al desconectar se revierte todo (navbar a `disconnected`, tarjeta de compartir bloqueada y cerrada, panel de vuelta al preview) más el botón que se esconde.
- **D** — isla del panel: lista reactiva, estado vacío, balance.
- **E** — integración: click en "Invitar un Whiskito" → `pending` → `success` → el panel suma la donación y actualiza el balance. Con el modo demo (el default) el mensaje dice demo y **no** promete on-chain.
- **N** — **modo demo (de la landing) y "Mi Panel"**: en la **landing** la tarjeta avisa que la donación es una demo; sin wallet no hay botón de Mi Panel y con la wallet conectada sí; donar en demo **no pide ninguna firma** (la wallet falsa del bloque sólo sabe identificarse: si la app intentara firmar, el flujo terminaría en error), **no suma nada al resumen del panel** y **no deja rastro local**; en demo el **dueño** también puede probar la donación en su propia página (N18). Y "Mi Panel" muestra la historia **real**: el harness manda una donación de verdad (`fund(address)` desde una cuenta desbloqueada de anvil) a la cuenta conectada —una dirección fresca por corrida, así la tabla arranca vacía— y verifica que la tabla la liste con donante, monto y USD del evento, que el resumen sume la ronda, de qué cuenta son y que **no diga "demo" en ninguna parte**; también que `Escape`, la `×` y la desconexión lo cierren y que el panel entre en la ventana. El bloque **R** carga la misma página con **`?demo=0`** para ejercitar el camino real (firma con el calldata del dueño): es el control positivo de que "no firmó" significa algo.
- **S** (clase 3) — Shadow DOM: las 3 islas tienen shadow root y las 5 estáticas no; cada isla lleva su `<style>` adentro; el markup de las islas ya no está en el documento; los tokens de `:root` **sí** atraviesan la frontera; el CSS del documento **no** entra; el CSS de la isla **no** se filtra afuera; el CSS global **sigue vivo** para las secciones en light DOM; el navbar sigue sticky al scrollear; `getElementById("panel")` y el ancla `#panel` siguen vivos; la geometría de las 3 islas es la misma que antes de Shadow DOM; y el spinner del estado pendiente **gira** (o sea, los `@keyframes` viajaron con la isla).
- **H** (clases 4 y 5) — la isla de compartir: vive en un shadow root; el panel arranca **cerrado** y el trigger está fijo abajo a la derecha; el click lo abre, `#shareClose` y `Escape` lo cierran, y la propiedad `open` (la que usa `main.js` al conectar) también; **el widget no se mueve al scrollear 2000px** y no se sale de la ventana; el **`×` está por encima** (`elementFromPoint`, o sea que un usuario puede clickearlo); bloqueada muestra el link de ejemplo, el candado y compartir deshabilitado; activa muestra el link completo y habilita todo; el **QR en pantalla es cuadrado y queda entero dentro de la tarjeta**; las 4 redes abren la URL correcta y emiten `whiskito:share`; "Copiar link" deja la URL **en el portapapeles** y da feedback; "Descargar QR" produce un PNG válido; y al cambiar la dirección el QR se regenera.
- **G** (entornos, leyes §2.8d–8e) — `?chain=`: un chainId que no está en `NETWORKS` **se descarta entero** (con aviso) y cae a la red del origen, nunca mezcla el `chainId` de una red con el `fund`/`rpc` de otra; `?chain=80002` sigue devolviendo Amoy completa y `?rpc=`/`?fund=` se conservan. Y el **desajuste de red de la wallet**: con la URL en `?chain=31337` y la wallet en `80002`, conectar le **pide** el cambio (`wallet_switchEthereumChain` con `0x7a69`), y si rechaza (4001) **no firma nada** y lo dice con las dos redes en el mensaje; la app se suscribe **una sola vez** a `chainChanged` y sigue el cambio sin recargar; y la guarda de **escritura** (`requireSigningNetwork`) frena la donación antes de simular y de firmar, mientras las **lecturas siguen andando** (van por HTTP y no dependen de la wallet).

Control negativo: rompé a propósito algo que el harness espera y comprobá que
falla. Por ejemplo:

```bash
cd <raíz del proyecto>
cp src/components/whiskito-donate-card.js .card.bak
python3 - <<'EOF'
import re, pathlib
p = pathlib.Path("src/components/whiskito-donate-card.js")
p.write_text(re.sub(r"\n\s*@keyframes\s+spin\s*\{[^}]*\}", "", p.read_text()))
EOF
# correr el harness → FALLOS(1/86) en la aserción del spinner
cp .card.bak src/components/whiskito-donate-card.js
```

Ese control es el más útil de todos: **el pixel-diff no lo ve** (las capturas dan
idénticas), sólo lo ve la aserción que mira el `transform` del spinner dos veces
separadas 140 ms. Si con el componente roto el harness sigue diciendo `OK`, el
harness no sirve.

### Verificación del QR (clase 4)

Un QR "que se ve bien" no prueba nada: hay que **decodificarlo**. La cadena es:

1. el harness dibuja el QR en el `<canvas>` de la isla (como lo hace la página);
2. sube el PNG con `canvas.toDataURL()` a `POST /__upload__?name=qr-share`;
3. `serve.py` lo guarda en `.refactor-baseline/qr-share.png`;
4. y afuera, **`zbarimg`** (un decodificador independiente del que lo generó) dice a qué apunta:

```bash
zbarimg --raw -q .refactor-baseline/qr-share.png    # → http://127.0.0.1:8899/u/0x71C7...876F
zbarimg --raw -q .refactor-baseline/qr-share-2.png  # → la segunda dirección (el QR se regeneró)
```

Que dos implementaciones independientes coincidan en el contenido es evidencia real;
que el canvas tenga píxeles oscuros, no. Antes de escribir el componente se validó el
recorrido completo con `qrencode` + `zbarimg` y con una página de prueba
(`qrtest.html`, ya retirada).

### Verificación visual (clase 3)

La migración a Shadow DOM no debía cambiar **nada** de lo que se ve, así que el
criterio es una comparación de píxeles:

```bash
# antes de tocar el CSS, congelar el baseline en 3 anchos
for w in 1440 900 420; do firefox ... --screenshot .refactor-baseline/pre-$w.png --window-size=$w,2600 \
  "http://127.0.0.1:8899/src/index.html"; done
# después del cambio, lo mismo en post-$w.png y comparar
cmp .refactor-baseline/pre-$w.png .refactor-baseline/post-$w.png
```

Los 3 anchos importan: `@media (max-width: 980px)` y `(max-width: 768px)` alcanzan
a las islas (`.navbar`, `.nav-links`, `.section`, `.donate-card`, `.panel-split`,
`.panel-demo`, `.pd-balance`), y una regla responsive que se quede en el CSS
global se rompe **en silencio** en el ancho que nadie mira.

### Trampas ya pagadas

- Sin `Cache-Control: no-store` (que agrega `serve.py`) más un cache-buster
  `?cb=<ts>` en cada iframe, Firefox reusa copias viejas de `index.html` y la
  comparación se hace contra el archivo anterior: da `OK` falso.
- `/__hold__` retiene el evento `load` (Firefox saca la foto y se cierra ahí):
  sin eso el navegador termina antes de que el harness mida y no hay reporte.
- Las aserciones ignoran el whitespace entre elementos pero **no** el texto
  visible: el espaciado que se ve lo cubre la comparación de texto renderizado.
- Los nodos de texto que son sólo espacios entre elementos no se renderizan: si
  el serializador no los ignora, aparecen falsos positivos en cada costura de
  template.
- **El reset `*` no cruza la frontera del shadow root.** Un `* { margin: 0; padding: 0; box-sizing: border-box }` en el documento no alcanza al contenido de un shadow root: vuelven los estilos del UA (márgenes de `h2`/`p`, `padding` de `ul`, `box-sizing: content-box`). Por eso cada isla lleva su copia del reset al principio de sus estilos. Control: quitarlo de una isla → la geometría cambia (la tarjeta pasa de 508x647 a 508x691) y las capturas dejan de ser idénticas.
- **Los `@keyframes` se resuelven en el árbol del shadow, no en el documento.** Si la isla no se lleva la definición, la animación se apaga sin error y sin cambio de píxeles (el spinner sólo se ve en el estado pendiente). Control: quitarlo → `FALLOS(1/86)` en la aserción del spinner, con las capturas idénticas.
- **`this.querySelector` no ve adentro del shadow root.** Los listeners y las consultas de un componente tienen que usar `this.root.querySelector`; si no, el botón no recibe el click y nadie se entera hasta que falla una aserción de comportamiento.
- **`.chip` tiene `transition: all 0.2s`:** leer un color computado justo después del click devuelve el valor **interpolado** (parece que el estado no se aplicó). Hay que esperar a que termine la transición antes de medir.
- **Un `id` adentro del shadow root no existe para el documento.** `getElementById` y las anclas `#panel` no lo ven: la identidad tiene que vivir en el host (light DOM). Y el host necesita **caja**: con `display: contents` el navegador no tiene a dónde scrollear (medido en el harness: con `block` el ancla lleva a 2874 px; con `contents`, a 0).
- **El orden de los bloques del harness importa:** un `const` usado antes de su declaración tira todo el reporte abajo con `can't access lexical declaration ... before initialization` (me pasó al insertar la geometría antes del bloque S).
- **Una librería puede ensuciar el elemento con estilos inline.** `qrcode` deja `style="width: 512px; height: 512px"` en el canvas, y un estilo inline le gana al `height: auto` de la hoja: el canvas terminaba midiendo **220x512**, con el QR estirado 2.3× en vertical (la aserción que mide la caja lo detectó; a ojo, sobre una captura reescalada, se discute). Se arregla sacando los inline después de dibujar.
- **`scrollIntoView` sobre un host con `display: contents` no hace nada**, porque no tiene caja: es la misma raíz que el ancla `#panel`. El visor `zoom.html` baja al primer descendiente que sí tenga caja (incluidos los de un shadow root).
- **Un click sintético no da activación de usuario**, así que `navigator.clipboard.writeText` rechaza y el botón "Copiar link" no se puede verificar así. Se resuelve con el pref de pruebas de Firefox en el perfil: `mkdir -p .refactor-baseline/.ff && echo 'user_pref("dom.events.testing.asyncClipboard", true);' > .refactor-baseline/.ff/user.js`. No cambia la app, sólo permite ejercitar el botón en headless y **leer** el portapapeles para comparar lo copiado con la URL. Sin ese archivo, las aserciones del portapapeles fallan (ruidosamente, que es lo correcto).
- **`elemento.click()` programático no prueba que un usuario pueda clickear.** El `×` de cerrar del panel existía (32x32, `visibility: visible`, `opacity: 1`, dentro del panel) pero estaba **detrás de la tarjeta** por orden de pintado —los dos posicionados con `z-index: auto` y la tarjeta después en el DOM—: invisible e inclickeable para una persona. Se detecta con `shadowRoot.elementFromPoint()` (devuelve lo que hay arriba de verdad; `document.elementFromPoint` devuelve el host) o mirando un recorte ampliado de esa región.
- **Un flex item se encoge, y su `overflow: hidden` recorta el contenido.** En una ventana de 1000x600 la tarjeta medía 396x287 con un QR de 220px que terminaba en y=408: el QR salía **cortado por la mitad** y no se podía escanear. Se detecta pasando `zbarimg` a una **captura hecha en ventana baja**: si el QR está entero, el decodificador lo lee de la pantalla; si está recortado, falla. Hay que probar los dos tamaños, no sólo el cómodo.
- **`probe.html`** (medir cajas, `position`, `overflow` y si el panel scrollea, a un viewport dado): `.../probe.html?w=1000&h=600`. Cuando una captura "se ve rara", esto convierte la sospecha en números.

## Clase 6 — datos reales de la chain (`src/js/config/config.js`)

La configuración vive en un módulo hoja, `src/js/config/config.js`, con dos secciones:

- **`NETWORKS`** por `chainId`: dónde está el contrato, el oráculo, el RPC y el
  explorador. Es configuración: no se puede derivar y cambia según dónde esté
  desplegado. Lo dinámico es *cuál* entrada se usa: se elige en runtime con la
  cadena en la que está la wallet (`effectiveNetwork(await walletClient.getChainId())`).
- **Constantes de app**: `SITE` (base de los links que se comparten) y, **por
  red**, `professional` + `professionalFor(chainId)` (a quién le donan; en el
  producto real sale de la URL, y en anvil es la cuenta 0).

Lo que **no** va ahí: el precio, los saldos y las donaciones (se leen de la
chain) ni la dirección del usuario (sale de la wallet).

```bash
# que las direcciones de config.js sean las del último deploy de Foundry
node .refactor-baseline/check-config.mjs      # → OK :: config.js coincide con el último deploy
```

Control negativo: cambiá una dirección en `config.js` y da `DRIFT(1)` con el
detalle de qué difiere. Las direcciones de anvil son determinísticas (mismo
deployer, mismo nonce), pero si alguien agrega un `new` antes en el script de
deploy se corren todas.

**Override por URL** (para probar contra otra red o contra otro nodo sin tocar
el archivo):

```
/src/index.html?chain=31337&rpc=http://127.0.0.1:8545&fund=0x…
```

**Las aserciones de chain necesitan anvil corriendo con el deploy hecho**: el
precio del contrato sale de `getConversionRate(1 ETH)` y con el
`MockV3Aggregator` del deploy local son 2000 USD. El harness **deriva sus cuentas
del precio que lee la tarjeta** (no de una constante), así que si el precio
cambia, las aserciones siguen valiendo.

**Degradación** (que un nodo caído no rompa la página):

```bash
firefox … "http://127.0.0.1:8899/.refactor-baseline/probe.html?w=1200&h=800&qs=rpc=http://127.0.0.1:9"
```

Con el RPC roto la página se dibuja igual, las 4 islas montan, el panel muestra
la vista previa y el precio cae al valor de ejemplo (3400) en lugar de
`undefined`.

## La página que se comparte (`/u/0x…`): sonda y runner

La landing la verifica `islands.html`; la **página aparte** que abre el link
compartido la verifica `donate-probe.html`, y su runner es
`verify-refactor/run-donate-probe.py`. Son 57 aserciones: los bloques de siempre
**D/E/M/P/Q/F/N** (la ruta abre la card, la card dice a quién le donás, ofrece
conectar y **no dice "demo" en ningún lado** —esta página cobra de verdad—, sin
wallet la donación se simula y lo dice, el spinner gira en `pending` y se apaga
al terminar, el modal abre/cierra por las tres vías, el dueño **no** se dona a sí
mismo —tampoco yendo derecho a donar sin conectar—, cancelar no es fallar, sin
destinatario no se dona a cualquiera, y con una wallet que reenvía la firma a
anvil la donación **se confirma on-chain**) más el bloque **S** (cambio de
cuenta).

```bash
cd <raíz del proyecto>
rm -f .refactor-baseline/.ff/.parentlock
python3 .refactor-baseline/verify-refactor/run-donate-probe.py 8899   # exit 0 si PASS
```

### Qué cuida el bloque S

El bug que caza: una vez que la dApp tiene el permiso `eth_accounts`, la wallet
contesta **siempre la misma cuenta** y no abre nada, así que una app que sólo
sabe llamar a `eth_requestAccounts` queda pegada a una cuenta para siempre. Lo
que abre el selector es `wallet_requestPermissions`, que es método de la
**wallet** (`window.ethereum.request`), no de viem.

| aserción | qué cuida |
|---|---|
| **S1** | con la cuenta DUEÑA conectada, el botón "Cambiar cuenta" de la tarjeta existe, dice el texto exacto y es **clickeable de verdad** (`shadowRoot.elementFromPoint` sobre su centro devuelve el botón o un hijo suyo). |
| **S2** | ese click pide el selector con `wallet_requestPermissions` (lo ve la wallet) y **no** con un `eth_requestAccounts` a secas. |
| **S3** | después de elegir OTRA cuenta en el popup, la tarjeta dice que se dona desde la nueva, el botón de donar queda habilitado y el aviso de "tu propia página" desaparece. |
| **S4** | `accountsChanged` hacia la cuenta DUEÑA deshabilita donar y muestra el aviso **sin recargar la página** (el caso "el usuario cambió de cuenta en MetaMask"); la marca se comprueba sobre el `window` del iframe, que una recarga perdería. |
| **S5** | `accountsChanged` con `[]` (la wallet soltó todas las cuentas) deja la página desconectada —el viewer se limpia y vuelve a ofrecerse conectar— y **no** se llama a `wallet_revokePermissions` (la wallet ya lo hizo). |
| **S6** | cancelar el selector (4001) devuelve `null` y no cambia nada: misma cuenta, mismo estado del botón, ningún error de conexión. |
| **S7** | wallet sin `wallet_requestPermissions` (`-32601`): se revoca el permiso y se vuelve a pedir, y la app queda conectada y usable. |
| **S8** | en la landing (`/`), `#switchButton` existe, dice el texto exacto, es clickeable de verdad, emite `whiskito:switch-account-request`, y un `accountsChanged` deja el navbar mostrando la cuenta nueva. |
| **S9** | la suscripción a `accountsChanged` es **una sola**, aunque la app haya conectado dos veces (sin la bandera de `chain.js`, cada `connectWallet()` agregaría otro `.on` y la wallet avisaría dos veces). |
| **S10** | en `/u/0x…` el **cartel de estado** (`#txStatus`, que `onFundRequest` llena con el mismo texto de "tu propia página") no sobrevive al cambio de cuenta con el botón de la tarjeta: antes está el cartel (`status=error` + `cartel visible`), después queda `idle`, sin mensaje y con el botón habilitado. |
| **S11** | lo mismo cuando el cambio lo avisa la wallet (`accountsChanged` con otra cuenta). |
| **S12** | y lo mismo cuando la wallet suelta todas las cuentas (`accountsChanged` con `[]`), que además deja la página desconectada ofreciendo conectar. |
| **S13** | en la landing, después del "Cambiar cuenta" del navbar la tarjeta de donación no queda con el cartel viejo del dueño (ahí el que bloquea y llena el cartel es `app.js`, no la isla). |
| **S14/S15** | las otras dos ramas de `accountsChanged` de `app.js` (cuenta nueva y `[]`) también limpian el cartel en la landing. |

**S10–S15 existen porque el aviso del rol y el cartel de estado son nodos
distintos**: `applyRole` limpia el `hintText` (derivado del rol) pero `#txStatus`
lo llenaba `onFundRequest`, así que después de cambiar de cuenta quedaba un
cartel de error contradiciendo al botón de donar ya habilitado. Las tres
aserciones de `/u/0x…` arrancan de una página donde el dueño fue **derecho a
donar** sin conectar antes: con la cuenta dueña ya conectada el botón está
deshabilitado y un click no emite nada, así que ése es el único camino que llena
el cartel. Y cada una comprueba que **antes** había cartel: si no, pasarían
solas.

La wallet falsa (`inyectarWallet`) registra **todos** los métodos que pasan por
`request()` y guarda los `.on(...)`, así que las aserciones miran lo que la
wallet vio de verdad —no lo que la app dice que hizo—: `wallet.metodos`,
`wallet.emitir("accountsChanged", [cuenta])` y `wallet.suscripciones(evento)`.

### Cómo queda servido (y por qué no con `serve.py` solo)

El probe se copia a `src/__donate-probe.html` para ser **del mismo origen** que
la página (si no, no se le puede leer el DOM del iframe). Las páginas las sirve
el **dev server del repo** (`vite.config.js`, root `src`), que es el único que
tiene la ruta `/u/0x…`; el reporte lo colecta `serve.py` en 8899 (`/__hold__` y
`/__report__`) y el runner lo lee del log. Medido, no supuesto:

```
serve.py  ROOT=<repo>  GET /u/0xf39f…2266 → 404
serve.py  ROOT=<repo>  GET /              → 200 (listado de directorio, no la landing)
serve.py  ROOT=<src>   GET /u/0xf39f…2266 → 404
serve.py  ROOT=<src>   GET /donate.html?u=… → 200
serve.py  POST /__report__                → 404   (su do_POST sólo maneja /__upload__)
vite      GET /u/0xf39f…2266              → 302 → /donate.html?u=…
```

Por eso el `serve.py` de esta sonda es **sólo el colector**: el reporte viaja con
`GET /__report__?d=…` (que es lo que `run-harness.py` ya parsea del log) porque
`POST` no existe ahí, y el probe lo manda cross-origin con `no-cors`. Servir la
página con `serve.py` y un atajo para `/u/…` (symlinks, `<base>`, un HTML
copiado) **no es una opción**: eso neutralizaría justo la trampa que D1 caza
—la página servida BAJO `/u/` con assets relativos baja muerta aunque el status
sea 200—, y el atajo aprobaría aunque el plugin real estuviera roto.

El runner usa el Vite del propio repo (`node_modules/.bin/vite`, la config real:
root `src` + el plugin `sharedLinkRoute`) en un puerto libre, y `serve.py` en el
8899 libre más cercano; si algo está ocupado corre al siguiente (medido: 8900 y
5291). Vite extrae el `<script type="module">` inline del probe a un módulo
`html-proxy` e inyecta `/@vite/client`: el probe corre igual.

### Control negativo

Se rompió a propósito **una** pieza de la cadena: en `src/js/solidity/chain.js`, el método
que pide el selector pasó a llamarse `wallet_requestPermissions-ROTO` (o sea: la
app deja de abrir el selector y vuelve a quedar pegada a una cuenta, que es el
bug original). La cabeza del veredicto crudo (las 4 que fallan; las otras 41
siguen `ok`, incluidos los 36 viejos):

```
FALLOS(4/45) :: FALLA S2 ese click pide el SELECTOR con wallet_requestPermissions (método que ve la wallet, no viem) y no con eth_requestAccounts a secas <clickeado=true metodos=[wallet_requestPermissions-ROTO,eth_requestAccounts,eth_chainId]> ;; FALLA S3 después de elegir OTRA cuenta la tarjeta dice que se dona desde la nueva, el botón de donar queda habilitado y el aviso de 'tu propia página' desaparece <viewer=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 diceDesde=false disabled=true canDonate=false avisoPropia=true> ;; FALLA S6 cancelar el selector (4001) devuelve null y no cambia nada: sigue la misma cuenta, el mismo estado del botón y ningún error de conexión <metodos=[wallet_requestPermissions-ROTO,eth_requestAccounts,eth_chainId] viewer=0x70997970C51812dc3A010C7d01b50e0d17dc79C8 (antes 0x70997970C51812dc3A010C7d01b50e0d17dc79C8) disabled=false (antes false) status=idle (antes idle) msj=""> ;; FALLA S7 con una wallet sin wallet_requestPermissions (-32601) se revoca el permiso y se vuelve a pedir, y la app queda conectada y usable <metodos=[wallet_requestPermissions-ROTO,eth_requestAccounts,eth_chainId] viewer=0x70997970C51812dc3A010C7d01b50e0d17dc79C8 disabled=false canDonate=true status=idle>
```

Restaurado el archivo (`sha256` idéntico al de antes de romperlo:
`e46e86a90dff13ff4b66662c2c9f65efca1161e2fc972dfa7fcabd81d1fadb06`) la sonda
vuelve a `OK(45/45)`. La única pieza que se tocó fue esa; el resto de `src/` no
se modificó.

El segundo control es el del **cartel viejo**: se revirtieron (a mano y
temporalmente) las tres líneas `islands.setDonateStatus("idle", "")` que
`donate.js` agregó en `onSwitchAccountRequest` y en las dos ramas de
`accountsChanged`. Con eso, el cartel de error del dueño **sobrevive** al cambio
de cuenta y sólo fallan S10/S11/S12:

```
FALLOS(3/51) :: FALLA S10 … <clickDonar=true ANTES=<status=error msj="Estás en tu propia página: compartí el link para recibir" cartel=true disabled=true viewer=0xf39F…2266> DESPUÉS=<status=error msj="Estás en tu propia página: compartí el link para recibir" cartel=true disabled=false viewer=0x7099…79C8>> ;; FALLA S11 … ;; FALLA S12 … <… DESPUÉS=<status=error msj="Estás en tu propia página: compartí el link para recibir" cartel=true disabled=false viewer=> conectaVisible=true cambiaVisible=false>
```

Las 48 restantes siguen `ok` (S13/S14/S15 salen de `app.js` y no de esas líneas,
así que no se mueven). Restaurado, `sha256` idéntico
(`ea7ca8591a90193207c3161b248aaffb9ce67c8bf0f7b3d566d07eb1c9444bae`) y
`OK(51/51)`.

### Trampas pagadas (sonda de donación)

- **`serve.py` no sabe servir `/u/0x…`**: 404 en las dos raíces probadas, y `/`
  es un listado de directorio. La ruta vive en el plugin de `vite.config.js`, así
  que el runner necesita el dev server además del colector.
- **`POST /__report__` contra `serve.py` es 404** (`do_POST` sólo maneja
  `/__upload__`): el veredicto viaja por `GET /__report__?d=…` y se lee del log,
  que es como lo hace `run-harness.py`.
- **`.click()` no prueba nada**: el probe usa `shadowRoot.elementFromPoint` sobre
  el centro del botón y recién ahí despacha el click **sobre el nodo que está
  arriba**. Un botón tapado por orden de pintado pasa el `.click()` y no esto.
- **La copia del probe en `src/` no puede quedar**: el runner la borra en un
  `finally`, así `src/` no termina con archivos nuevos.
- **Sin borrar `.refactor-baseline/.ff/.parentlock`** el navegador arranca pero
  no pide ni la primera URL: el run sale `NO REPORT RECEIVED` y parece un fallo
  de la app. El runner lo borra solo, y además lo hace el `rm -f` del ejemplo.
- **`html { scroll-behavior: smooth }` (styles.css) no se puede ignorar al
  medir**: el botón de donar de la landing vive abajo del pliegue (y≈2614 en un
  viewport de 900), así que hay que bajar hasta él para que `elementFromPoint`
  devuelva algo. Con la bajada animada el iframe —que está fuera de pantalla—
  no la avanza: medido, `scrollY` se quedaba en **0** y el hit-test daba
  `<nada>`. Se baja por posición absoluta y con `behavior: "instant"` (más
  `scrollBehavior = "auto"` inline, por las dudas).

## Clase 1 — equivalencia estructural exacta (histórico)

La clase 1 verificaba que el markup renderizado fuera **idéntico** al original.
Ese invariante dejó de valer a propósito cuando las islas empezaron a cambiar su
DOM según el estado (el botón se deshabilita, la lista se genera, el navbar
muestra la dirección). Los verificadores de esa clase (`harness.html`,
`check-static.mjs`) se retiraron para no quedar como falsos negativos; la
comprobación de que **lo estático no se movió** sigue viva en las aserciones
**F1–F5** de `islands.html`, y el estado previo queda en `v1/`.

## Rediseño «Blues Poster '62» (Whiskito)

El rediseño cambia **a propósito** el CSS y el markup de toda la página: pasa del
tema oscuro original (🍺) al cartel de papel crema "Whiskito" (🥃). Eso mueve
varias anclas del harness, que estaban fijadas al diseño viejo. Qué se hizo con
cada una, y por qué:

| aserción | qué pasó | por qué |
|---|---|---|
| **F1–F5** | **re-ancladas** | Comparaban contra `index.html` (el original monolítico, diseño previo al rediseño). El rediseño cambia ese markup por pedido, así que contra el ancla vieja F sólo podía decir "cambió el diseño". El ancla nueva es `redesign-static.html`, congelada del render ya rediseñado: así F vuelve a significar "una sección estática no se movió **después** de congelada". |
| **S6** | sonda actualizada | Probaba `var(--beer-gold-soft)`, token que ya no existe. Ahora prueba `var(--paper)`, que es el color real del chip activo. Sigue comprobando lo mismo: que un token de `:root` cruza la frontera del shadow root y que la isla lo usa. |
| **S12, S13, S13a** | **reformuladas** | Eran píxeles absolutos del diseño previo al rediseño (508x647 · panelY 3022 · nav 79 · panel 590x513). Re-medirlos habría re-codificado el diseño nuevo como golden de píxeles, y encima no son estables: la altura del recibo depende de cuántas donaciones inyecta `main.js`, y el ancho baila con la barra de scroll. Ahora cuidan el invariante de layout que de verdad importa: el host de la tarjeta **no genera caja** (`display:contents`) y la tarjeta sigue siendo el grid item de `.donate-track`; el navbar y el recibo tienen caja no degenerada; y el recibo sigue dentro de `.backstage`. |
| **S15** | valor actualizado | Esperaba `hero.paddingTop = 96px`; el hero nuevo tiene `padding: 56px 32px 0`. Sigue comprobando que el CSS global alcanza a las secciones en light DOM. |
| **B30** | copy actualizado | Esperaba el texto viejo del `STATUS_TEXT` de la isla (el que llevaba el 🍺 y el nombre anterior de la marca). |
| selectores `pd-*` | renombrados | `.pd-item` → `.r-item`, `.pd-empty` → `.r-empty`, `.panel-demo` → `.receipt`: son los nombres del diseño nuevo y viven dentro del shadow root del panel. |
| URL del sitio | **ahora es el origen que sirve la página** | `SITE` (config.js) ya no es un dominio fijo: es `location.origin`, así que en la verificación el QR apunta a `http://127.0.0.1:8899/u/…` (la app que se está probando) y no a producción. El harness deriva su `URL_ESPERADA` de su propio `location.origin` —no de `config.js`— para que la expectativa siga siendo independiente del código bajo prueba. |

### S8 obligó a limpiar la hoja global

`S8` ("el CSS de la isla no se filtra al documento") crea un `.chip` suelto en el
documento y comprueba que **no** quede estilado. Falló, y con razón: al escribir el
sistema de diseño se había dejado en `src/styles.css` una copia de las reglas de
las islas (`.chip`, `.donate-card`, `.navbar`, `.receipt`, `.backstage`, …). Son
CSS **muerto** —ningún elemento en light DOM usa esas clases— y además rompía la
aserción. Se quitaron de la hoja global (8,5 KB) y quedan sólo donde se usan: en el
`static styles` de cada isla. La hoja global ahora es: tokens de `:root`, reset,
primitivas compartidas (`.btn`, `.tt`, `.section`, `.eyebrow`) y las secciones en
light DOM.

### Control negativo

El harness tiene que poder fallar. Se quitó `@keyframes spinfast` del CSS de la isla
de donación (rotura **invisible** en una captura: el spinner sólo se ve en el estado
*pending*) y el reporte dio exactamente:

```
FALLOS(1/152) :: S14 el spinner del pending gira (los @keyframes viajaron con la isla) <none -> none anims=0>
```

Restaurado el archivo, `OK(152/152)`. La única aserción que lo ve es la que mira el
`transform` del spinner dos veces separadas 140 ms. (Eran 152 aserciones en ese
momento: el bloque **L** de iconos, más abajo, sumó 5 y hoy el total es **157**.)

### Cómo se re-corre

```bash
cd <raíz del proyecto>
python3 .refactor-baseline/serve.py "$PWD" 8902 150 &   # HOLD largo: el harness tarda >25 s
mkdir -p .refactor-baseline/.ff
echo 'user_pref("dom.events.testing.asyncClipboard", true);' > .refactor-baseline/.ff/user.js
firefox --headless --no-remote --profile "$PWD/.refactor-baseline/.ff" \
  --screenshot /tmp/harness.png --window-size=1440,900 \
  "http://127.0.0.1:8902/.refactor-baseline/islands.html"
# el veredicto sale en el stderr del servidor (GET /__report__?d=…)

# inspección visual de una sección:
firefox … --screenshot /tmp/panel.png --window-size=1440,1000 \
  "http://127.0.0.1:8902/.refactor-baseline/zoom.html?sel=%23panel&w=1440&h=1000"
```

Ojo con el `HOLD`: con el valor corto del ejemplo original (20 s) el navegador saca
la foto y se cierra **antes** de que el harness mande el reporte, y el run queda sin
veredicto. Con 150 s alcanza.

### Trampas nuevas (pagadas en este rediseño)

- **Un `grep -v` puede matchear la RUTA, no el contenido.** Un barrido de marca con
  `grep -vE "whiskito-"` filtraba *todas* las líneas, porque el propio nombre del
  archivo (`whiskito-share-card.js`) contiene `whiskito-`. El barrido daba "limpio" sin
  haber mirado nada, y así quedaron sin detectar `DEFAULT_SHARE_BASE` y
  `link.download = "whiskito-qr.png"`. Hay que filtrar sólo el campo de contenido.
- **`.refactor-baseline/` no es un lugar seguro para artefactos.** Entre las 15:38 y
  las 15:40 desaparecieron todos los PNG del directorio y el perfil `.ff`, sin que
  ninguno de los 4 subagentes que corrían entonces ejecutara un borrado (los cuatro
  lo negaron con su lista de comandos, y dos ya vieron el directorio limpio en su
  primera observación). Hubo actividad concurrente en el workspace (`state.json` en
  la raíz). Los originales congelados sobrevivieron; las capturas se rehicieron.
- **`firefox --dump-dom` no sirve acá**: escupe `[GFX1] RenderCompositorSWGL …` por
  stdout y la segunda corrida se colgó. Para congelar el render se usa
  `capture-static.html` + `POST /__upload__`.
- **`.ff` es un perfil de Firefox completo, no un directorio vacío**: si no existe,
  Firefox falla con `Could not find profile folder.` y **no** escribe la captura
  (el comando sale 0 igual). Hay que crearlo antes y, para las aserciones del
  portapapeles, dejarle el `user.js`.

## Iconos: de emoji a Lucide

Los emoji que hacían de icono se reemplazaron por **Lucide** `1.47.0` (el paquete
`lucide` que ya estaba instalado). El sistema de diseño no cambió: los iconos
heredan color y tamaño del slot donde viven.

### Cómo se cargan (y por qué no como dice la guía)

La guía de Lucide propone `import { createIcons, icons } from 'lucide'`. **En una
página sin bundler eso dispara ~1850 peticiones HTTP**: el barril re-exporta los
1848 módulos de icono (`iconsAndAliases.mjs` es una lista de 1848 `export … from
'./icons/x.mjs'`). Medido en el log del servidor, no deducido.

Lo que hace `src/icons.js`:

| decisión | por qué |
|---|---|
| importa **icono por icono** (`lucide/icons/glass-water.mjs`) | 23 archivos de ~250 B en vez de 1848 |
| hidrata con **`replaceElement`**, el módulo hoja | `createIcons` vive en el barril: importarlo arrastraría los 1848. `replaceElement` es lo que `createIcons` usa adentro, no una reimplementación |
| recorre **el `root` del componente**, no `document` | `createIcons` recorre el documento y **no ve adentro de un shadow root**, donde viven 4 de las 9 islas |

Resultado medido: **30 módulos de Lucide por carga** (23 iconos + 7 hojas), contra
~1850. El mapa de importaciones de `index.html` traduce `lucide/…` a
`node_modules`, que el servidor ya sirve:

```json
{ "imports": { "lucide/": "/node_modules/lucide/dist/esm/" } }
```

Detalle que cuesta un rato encontrar: **el nombre del archivo y el de la clave no
siempre coinciden**. El archivo es `icons/share-2.mjs` (kebab) pero la clave del
registro es `Share2` (PascalCase), que es lo que Lucide deriva del atributo
`data-lucide="share-2"`.

### La regla que hace barato el cambio

Lucide dibuja con `stroke="currentColor"` y el icono mide `1em`:

```css
.icon { width: 1em; height: 1em; flex: none; vertical-align: -0.15em; }
```

Como cada slot **ya** declara su `font-size` (2.6rem en un ticket, 8.5rem el vaso
del hero, 1.1rem un tick) y su `color`, no hubo que agregar ni una regla de tamaño
ni de color: el icono los sigue. Esa regla va en `src/styles.css` para el light DOM
y, copiada, en el `static styles` de cada isla.

Y `replaceElement` **copia los atributos del `<i>` al `<svg>`**, así que un icono
puede llevar `data-attr` / `data-class` / `data-text` y lo sigue gobernando el
pintado del componente. Eso es lo que permite que el botón de conectar alterne
billetera y check con los marcadores que ya existían, sin agregar estado en JS.

### Aserciones nuevas (bloque L)

| aserción | qué cuida |
|---|---|
| **L1** | no quedó ningún marcador `data-lucide` sin hidratar |
| **L2** | cada isla conserva **todos** sus iconos: `navbar=3 donate-card=6 panel=6 share-card=15`, y 16 en light DOM |
| **L3** | no quedó ningún emoji pictográfico en lo renderizado |
| **L4** | el icono mide `1em` y toma el color del slot (no trae los suyos) |
| **L5** | el marcador de estado sigue gobernando los iconos del navbar |

**L2 es la que caza el bug caro de este cambio**, y por eso se re-corrió como
control negativo: a un `<button>` que lleva el icono adentro y **además** se pinta
con `textContent`, `update()` —que corre justo después de hidratar— le borra el
SVG. Volviendo a meter ese bug en `#syncCopyButton` a propósito:

```
FALLOS(1/157) :: L2 cada isla conserva todos sus iconos hidratados <light=16 (esperado 16)
· navbar=3/3 donate-card=6/6 panel=6/6 share-card=14/15>
```

Restaurado, `OK(157/157)`.

### Trampas pagadas

- **`textContent` se lleva los iconos.** `#syncCopyButton()` escribía
  `button.textContent = this.#copyLabel`, y como `update()` corre después de
  hidratar, el icono del botón "Copiar link" desaparecía al montar y después de
  cada copiado. La regla: **nunca un icono adentro de un elemento que se pinta con
  `textContent`** (o que lleva `data-text`). El texto va a un `<span>` hermano del
  icono; es lo mismo que se hizo en `#shareTrigger`.
- **Lucide ya no tiene iconos de marca**: no existen `twitter`, `facebook` ni
  `x`. Se usan equivalentes genéricos (`hash` para X, `thumbs-up` para Facebook,
  `message-circle` para WhatsApp, `send` para Telegram) y el rótulo de texto es el
  que identifica la red.
- **Un `<i data-lucide>` que no resuelve no rompe nada**: queda el `<i>` vacío y
  Lucide avisa por consola. Por eso conviene validar los nombres antes de
  escribirlos: `icons-probe.html` hace exactamente eso (y mide las peticiones).
- **F se volvió a congelar.** El cambio de iconos toca el markup de las secciones
  estáticas (hero, line-up, footer), así que el ancla anterior quedó vieja por
  diseño. Se regeneró con `capture-static.html` antes de correr el harness.

### Lo que quedó con 🥃 a propósito

- `SHARE_TEXT` / `SHARE_TITLE`: son el texto que viaja adentro del mensaje de
  WhatsApp/X, no un slot de la página; ahí no hay dónde poner un SVG.
- El comentario de cabecera de `src/styles.css`: es prosa, no se renderiza.
- El `<title>` y el `meta description` **sí** se limpiaron: en lugar del emoji de
  la pestaña hay un favicon SVG (`src/favicon.svg`) generado con la geometría del
  mismo `glass-water` de Lucide, así el icono de la pestaña es el mismo que el de
  la página.
- Los `★` del cartel (`.eyebrow::before/::after`, el badge del hero, `.mc-label`,
  el sello) y los `→` / `↔` de los comentarios: son tipografía y prosa, no iconos.

## La radio (widget de música con YouTube)

Widget flotante abajo a la izquierda (`whiskito-radio`) que reproduce la playlist
*"Música Rock Sin Copyright"* (`PL-xVUW9dZgbcaN_ZmfinemsU7QdACG2fv`) con volumen,
mute y parada propios. El contrato está en `DESIGN-SPEC.md` §6.

### Por qué el reproductor se ve

Los términos de YouTube **no permiten** usar el reproductor como audio de fondo
oculto: no se puede separar el audio del video. Por eso el widget muestra la
pantalla del video, chica pero visible, integrada al cartel. Y el script
`iframe_api` se carga **recién cuando alguien toca play**: un visitante que nunca
pide música no descarga nada de YouTube ni recibe sus cookies.

### Cómo se verifica (partido en dos, a propósito)

Un test que dependa de que YouTube cargue y reproduzca es un test que un día falla
por algo ajeno al código. Entonces:

| dónde | qué comprueba | por qué ahí |
|---|---|---|
| **harness, bloque M** (9 aserciones) | arranca cerrada; **ni un `iframe` ni el script `iframe_api`** antes del click; el disparador fijo abajo-izquierda; el slider escribe el volumen; play/parar/volumen **alcanzables de verdad** (`elementFromPoint`); ningún ancestro con `transform`/`filter`; no se mueve al scrollear 1400px; Escape cierra; pedir música no rompe | todo determinista, sin red |
| **sonda `zoom.html?radio=play`** (con red real) | la cadena completa: carga la API, crea el player, carga la playlist y **reporta el `estado` real** | es lo único que prueba que suena |

### El experimento que decidió el diseño

Con la sonda se ve el estado real a los 6 s y a los 16 s. Dos corridas, misma
página, lo único que cambia es la política de autoplay de Firefox:

```
# como lo tiene un navegador real (autoplay bloqueado)
RADIO t=6s  estado=bloqueado volumen=60 iframes=1 scriptApi=true
RADIO t=16s estado=bloqueado ... src=https://www.youtube.com/embed/?listType=playlist&list=PL-xVUW9dZgbcaN_ZmfinemsU7QdACG2fv&c…

# con media.autoplay.default=0 (experimento)
RADIO t=6s  estado=sonando   volumen=60 iframes=1 scriptApi=true
RADIO t=16s estado=sonando   ... src=…list=PL-xVUW9dZgbcaN_ZmfinemsU7QdACG2fv…
```

`sonando` sostenido 16 s con la playlist correcta en el `src` prueba que **toda la
cadena funciona**. Y `bloqueado` con el autoplay real prueba que el único freno es
la política del navegador, no el código. (La variable del experimento se agregó al
perfil `.ff` sólo para esa corrida y se sacó después: el perfil queda como estaba.)

### El bug que encontró esa medición

La primera corrida dio `estado=apagado` a los 6 s **y** a los 16 s, con el
reproductor ya creado. La captura mostró por qué: el video quedaba *cued* y la isla
decía **"Dale play y suena"** —el texto del estado previo al click— justo después
de que la persona había tocado play. La causa era el mapeo de `onStateChange`:
`-1` (unstarted, que es donde YouTube deja el video cuando el navegador bloquea el
arranque) se mapeaba a `apagado`, pisando lo que el usuario acababa de hacer.

Arreglo: `apagado` es **exclusivamente** el estado previo al click. Después de
pedir música, `-1` y cualquier valor desconocido quedan en `cargando`, y un
watchdog de 5 s pasa a `bloqueado` → **"Tocá play en la pantalla"**, que es la
verdad y además es accionable: el botón de YouTube está ahí mismo, en la pantalla
del video.

### Otras cosas que quedaron anotadas

- **El panel tiene `max-height: calc(100vh - 108px)` + `overflow-y: auto`.** Sin
  eso, en una ventana baja (un celular apaisado) se le sale la cabeza por arriba.
  Se agregó en integración, después de que el subagente entregara el componente.
- **El icono que depende del estado son dos iconos estáticos** alternados por
  marcadores `data-attr="hidden:…"` (play/pause, volume-2/volume-x): cuando el
  estado cambia, el `<i data-lucide>` ya es un `<svg>` y escribirle otro nombre de
  icono **no lo vuelve a dibujar**.
- **La sonda ahora sabe de la radio**: `zoom.html?radio=open` despliega el panel y
  `zoom.html?radio=play` además le da play y reporta el estado por
  `/__report__`, con dos tomas (6 s y 16 s).

### Estado de la verificación

`OK(166/166)`: las 157 anteriores más las 9 del bloque M. Lo que **no** quedó
medido: el efecto *audible* del slider de volumen (headless no tiene placa de
audio). Sí está verificado que el slider escribe el volumen en el componente (M5)
y que `setVolume()` se llama con ese valor en cada cambio y en `onReady`.

