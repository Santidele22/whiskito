# WHISKITO — contrato de diseño y copy (para el rediseño Blues Poster '62)

Documento de trabajo del rediseño. **No es parte de la app.**

> **Estado: implementado y verificado.** El rediseño está aplicado en `src/`, y el
> harness `islands.html` da `OK(257/257)` con su ancla re-congelada. **La §5
> (iconos) también está implementada y verificada** — el harness le sumó las
> aserciones L1–L5, y L2 se probó como control negativo. Dos correcciones se
> hicieron sobre lo escrito acá, ya aplicadas en el código:
> 1. **`.chip-a` / `.chip-b` estaban invertidos.** La imagen de referencia pone
>    `🦊 0x3f…b8a1 llegó al club` en el medio-derecha (que el CSS posiciona como
>    `.chip-b`) y `⛓️ Archivado en la blockchain` abajo-derecha (`.chip-a`). El CSS
>    manda: es la única fuente de posiciones.
> 2. **`.track-act` no ganaba la cascada.** El CSS provisto lo deja en 0,1,0 y
>    `.track-head span` en 0,1,1, así que el chip del acto salía en color sello en
>    vez de papel sobre tinta. Se subió la especificidad en `src/styles.css`.
>
> Sobre la §5: el panel tiene **6** marcadores, no 7 (§5.3 cuenta 8 filas, dos de
> las cuales son borrados de emoji). Y el botón "Copiar link" de la share-card
> necesitó además un arreglo de JS fuera de la tabla: se pintaba con
> `button.textContent`, que borra el icono — ver la trampa en `README.md`.
>
> **Nota de estado (transición a POL).** Después de esa verificación la app pasó
> a **POL**: la moneda nativa y el copy de toda la interfaz (anvil sigue en ETH,
> que es su moneda), el piso de donación bajó de 0,5 a **0,01 USD**
> (`MINIMUM_USD = 1 * 1e16`, §4.4 / §4.7) y el link del explorador del footer
> dejó de estar hardcodeado: sale de la red (§4.6). El ancla se regeneró con
> `capture-static.html` y se comprobó con control negativo.
>
> El procedimiento de verificación (ancla de F, aserciones reformuladas, control
> negativo y receta para re-correr) está en `README.md`.

El sistema de diseño ya está escrito en `src/styles.css`: leelo antes de tocar
markup. Este archivo fija **la estructura y el copy exactos** para que cuatro
trabajadores en paralelo produzcan una página coherente.

---

## 0. Reglas que valen para todo

- **Marca:** el producto se llama **Whiskito** (🥃). No queda ninguna mención
  visible a la marca anterior ni a la cerveza (🍺) en el copy. Reemplazá la imagen
  de la cerveza por la del whisky (🥃) donde corresponda.
- **Voz:** español rioplatense, voseo, cálido y sin tecnicismos ("Invitame un
  whiskito", "elegí", "querés"). La metáfora es un **cartel de jazz/blues de
  1962**: la página es un poster, las secciones son actos de una noche en un
  club, los pasos son tickets, la tarjeta de donación es *la carta del bar*, el
  panel es *el backstage*.
- **Nada de emojis de cerveza** (🍺🍻🍾🥜) salvo 🍾/🎺 para "la botella entera" /
  "joda completa". El whisky es 🥃.
- **Idioma del código:** comentarios en español, igual que el resto del repo.
- **Prohibido** tocar `src/styles.css`, `src/js/entries/main.js`, `src/js/roles/viewer-role.js`,
  `src/js/config/config.js`, `src/components/base-element.js`, `src/components/index.js` y
  `.refactor-baseline/`. Cada trabajador toca **sólo sus archivos**.
- **Prohibido** cambiar nombres de custom elements (`whiskito-navbar`, …), de
  eventos (`whiskito:*`), de archivos, ni los `id`/`data-*` que lista el contrato
  de cada componente. El JS depende de ellos.
- Los textos visibles deben viajar **en el template**, no en JS (salvo donde el
  componente ya los pinta por estado).

## 1. Fuentes

`src/index.html` carga Anton + Barlow Condensed desde Google Fonts (lo hace el
orquestador). Los tokens ya están en `:root`:

```
--display: 'Anton', Impact, 'Arial Narrow', sans-serif;
--cond:    'Barlow Condensed', 'Arial Narrow', sans-serif;
--serif:   Georgia, 'Times New Roman', serif;
```

Usá siempre `var(--display)` / `var(--cond)` / `var(--serif)`, nunca la familia
literal.

## 2. Paleta

`--paper` (crema), `--paper-dark`, `--ink` (tinta), `--blues-red` (rojo cartel),
`--cobalt` (azul Blue Note), `--mustard` (mostaza = el whisky), `--stamp` (sello
gastado), `--success`, `--error`.

**No queda ningún token viejo**: `--beer-*`, `--bg-dark`, `--bg-card`,
`--bg-card-hover`, `--text-primary`, `--text-secondary`, `--border`,
`--radius-sm|md|lg`, `--shadow-gold` desaparecen por completo.

## 3. Islas con shadow root

`whiskito-navbar`, `whiskito-donate-card`, `whiskito-panel` y `whiskito-share-card`
declaran `static styles`: su CSS vive adentro y **no ve `src/styles.css`**. Cada
una lleva su copia de:

- el reset `* { margin: 0; padding: 0; box-sizing: border-box; }`
- las reglas que le tocan, **copiadas literalmente de `src/styles.css`** (mismos
  valores, mismo orden), usando los tokens `var(--…)` — las custom properties de
  `:root` **sí** cruzan la frontera del shadow root.

No inventes valores nuevos: si algo falta, copiá la regla del sistema.

---

## 4. Copy y estructura por componente

### 4.1 `whiskito-navbar.js` — shadow (isla)

Estructura: `.navbar` (nav) → `.nav-logo` (span.logo-icon + span.logo-text) ·
`ul.nav-links` (4 `li > a`) · `.nav-actions` (button#dashboardButton.nav-dashboard
+ button#connectButton.btn.btn-primary.btn-nav + button#switchButton.nav-disconnect
+ button#disconnectButton.nav-disconnect).

- logo-icon: `🥃` · logo-text: `Whiskito`
- links: `Donar` → `#donar`, `Cómo funciona` → `#como-funciona`, `Resumen` →
  `#panel`, `Preguntas` → `#faq`. **Ojo: en el navbar el link a `#panel` se llama
  `Resumen`, no `Mi Panel`** — `Mi Panel` es el texto del botón del modal
  (`#dashboardButton`, arriba). En el footer (§4.6), en cambio, el link a `#panel`
  sí dice `Mi Panel`.
- `LABELS` (texto del botón por estado): `disconnected: "🦊 Conectar Wallet"`,
  `connecting: "⏳ Conectando…"`, `connected: "✅ Conectado"`,
  `unsupported: "🦊 Sin wallet detectada"`
- botón desconectar: `Desconectar` (sin cambios)
- botón **Mi Panel** (`button#dashboardButton.nav-dashboard`, con el icono
  `receipt` adentro): la puerta del modal de donaciones recibidas. Nace
  `hidden` (`data-attr="hidden:notConnected"`) y lleva
  `title="Ver todas las donaciones que recibiste"`. Su click **no** lee nada: sólo
  emite `whiskito:dashboard-request`, que escucha `app.js` (la isla no toca la
  chain).
- botón **Cambiar cuenta** (`button#switchButton.nav-disconnect`, el look de
  "Desconectar"): `data-attr="hidden:notConnected; disabled:isBusy"` y
  `title="Elegir otra cuenta en la wallet"`. Emite
  `whiskito:switch-account-request` y quien lo atiende (`app.js`) pide el
  **selector** de cuentas de la wallet con `wallet_requestPermissions` —no
  `eth_requestAccounts` a secas: con el permiso ya dado ese método contesta la
  cuenta seleccionada sin abrir ningún popup— y reconstruye los clientes con la
  elegida (`switchWalletAccount()` de `chain.js`). Cancelar el selector no toca
  nada. El mismo botón vive en la tarjeta de donación (`#switchWallet`, §4.7).
- los cuatro botones de `.nav-actions` llevan `title`: el de conectar lo recibe
  del estado (`data-attr="…; title:title"`) y sólo avisa cuando no hay wallet
  detectada.

**Contrato (no tocar):** `observedAttributes`, `state`, ids `#dashboardButton`,
`#connectButton`, `#switchButton`, `#disconnectButton`, `.nav-dashboard`,
`.nav-account` con `[hidden]`, `<code data-text="shortAddress">`,
`<span data-text="label">` (el texto del botón de conectar), los `title`,
eventos `whiskito:connect-request` / `whiskito:disconnect-request` /
`whiskito:dashboard-request` / `whiskito:switch-account-request`.

**CSS propio:** reset + `.navbar` (sticky, `background: var(--paper)`,
`border-bottom: 3px solid var(--ink)`), `.nav-logo`, `.logo-icon`, `.nav-links` +
`.nav-links a`, `.nav-account`, `.nav-account[hidden]`, `.nav-actions`,
`.nav-disconnect` (+ `:hover`/`:disabled`/`[hidden]`), `.nav-dashboard`
(+ `:hover`/`[hidden]`), `.btn`, `.btn-primary`,
`.btn-nav`, y el `@media (max-width: 768px)` con `.nav-links { display: none }`.
Adaptá el look de `.nav-disconnect` al poster (borde 2px tinta, tipografía
`var(--cond)` mayúscula, fondo transparente).

### 4.2 `whiskito-hero.js` — light DOM (CSS global)

```
section.hero
├── div.marquee[aria-hidden]        → 30 × <i></i>
├── div.hero-inner
│   ├── div.hero-copy
│   │   ├── p.hero-badge            → ★ Esta noche: gracias, buen trabajo ★
│   │   ├── h1.hero-title           → Invitame un <span class="fill-red">Whiskito</span>
│   │   ├── p.hero-subtitle         → (ver copy)
│   │   ├── div.hero-actions        → a.btn.btn-primary.btn-lg + a.btn.btn-outline.btn-lg
│   │   └── div.hero-trust          → 3 × span con i.tick
│   └── div.hero-visual[aria-hidden]
│       ├── div.vinyl
│       ├── div.glass-glow          → 🥃
│       ├── div.float-card.main-card → div.mc-row (envuelve .mc-who + .mc-amount)
│       ├── div.float-card.chip-a
│       ├── div.float-card.chip-b
│       └── div.stamp-seal
└── div.hero-stats → 4 × div.stat (b + span)
```

**Copy exacto:**

- badge: `★ Esta noche: gracias, buen trabajo ★`
- title: `Invitame un` + `.fill-red` = `Whiskito`
- subtitle: `Una pequeña donación en` + `<em>POL</em>` + `que viaja directo de tu ` +
  tooltip `wallet` + ` a la de quien te gusta apoyar. Servido neat: ` +
  `<em>sin nadie en el medio</em>` + `. Sin registro, sin comisiones, sin
  empresas cobrando entrada.`
  El tooltip conserva el `data-tip` actual (wallet = tu cuenta de cripto…).
- acciones: `🥃 Quiero invitar un whisky` (href `#donar`, `.btn-primary .btn-lg`) y
  `💸 Quiero recibir donaciones` (href `#recibir`, `.btn-outline .btn-lg`)
- trust: `0% de comisión` · `Directo a la wallet de quien recibe` · `Todo público
  y verificable` (cada uno precedido por `<i class="tick">✓</i>`)
- `.main-card`:
  - `.mc-label`: `★ Última ronda`
  - `.mc-avatar`: `🥃`
  - `.mc-who` → `<code>0x7a3f...9c2e</code>` + `p.mc-action`: `te invitó un whisky`
  - `.mc-amount` → `<strong>50 POL</strong>` + `<span>≈ $5.00 USD</span>`
  - `.mc-time`: `hace 2 min · confirmado ✅`
- `.chip-a` (arriba a la derecha): `🦊 <code>0x3f...b8a1</code> llegó al club`
- `.chip-b` (abajo a la izquierda): `⛓️ Archivado en la blockchain`
- `.stamp-seal`: `Sin comisión` + `0%` + `★`
- stats: `0%` / `comisión de plataforma` · `100%` / `público y verificable` ·
  `~12s` / `en confirmarse` · `0.01 USD` / `mínimo por sorbo`

### 4.3 `whiskito-how-it-works.js` — light DOM

```
section.section#como-funciona
├── div.section-head          → span.eyebrow + h2 + p
├── div.track#recibir         → ACTO I
│   ├── div.track-head        → span.track-act + h3 + span
│   └── div.timeline          → 3 × article.step (span.step-ghost + div.step-emoji + h4 + p)
└── div.track#donar           → ACTO II
    ├── div.track-head        → span.track-act + h3 + span
    └── div.donate-track
        ├── ul.steps-v        → 3 × li (span.step-num + div > h4 + p)
        └── <whiskito-donate-card></whiskito-donate-card>
```

**Copy:** eyebrow `01 · El line-up` · h2 `Una noche, dos maneras de sumarse` ·
p de sección: `Nunca usaste cripto? No importa: acá está todo explicado sin
vueltas. Elegí tu equipo — invitar o recibir — y seguí los pasos.`

Track #recibir: `.track-act` = `Acto I` · h3 = `Querés recibir whiskys` · span =
`para quien hizo el trabajo que te gustó`.
Los tres tickets (`.step`, con `.step-ghost` `01` `02` `03`):

1. `🦊` · h4 `Conectá tu wallet` · p: `Una ` + tooltip `wallet` + ` es tu cuenta de
   cripto: una app gratuita (como MetaMask) que guarda tus fondos y te identifica.
   Nada de email ni contraseña: si tenés la wallet, tenés la cuenta.`
2. `🔗` · h4 `Copiá y compartí tu link` · p: `Al conectar tu wallet se genera tu
   página personal: ` + `<code>whiskito.app/u/tu-wallet</code>` + `. Pegala en tu
   bio, tus redes o tu firma de mail. ¿En persona? Compartí tu código QR y que te
   escaneen al toque.`
3. `🏧` · h4 `Retirá cuando quieras` · p: `Todo de una o en partes, vos decidís
   cuándo. Y tranquilo: solo vos, con tu wallet, podés retirar tus fondos. Nadie
   más puede tocarlos — ni siquiera nosotros.`

Track #donar: `.track-act` = `Acto II` · h3 = `Querés invitar un whiskito` · span =
`al que hizo el trabajo que te gustó`.
Los tres pasos (`ul.steps-v`):

1. h4 `Entrá al link de la persona` · p: `Cada quien tiene su propia página: ` +
   `<code>whiskito.app/u/su-wallet</code>` + `. Ahí está todo listo para invitarle
   un whiskito.`
2. h4 `Elegí cuánto invitás` · p: `Conectá tu wallet, poné el monto en ` +
   tooltip `POL` + ` (la moneda nativa de Polygon) y mirá el equivalente en dólares al
   lado: sabés exactamente cuánto estás invitando ` + `<strong>antes</strong>` +
   ` de confirmar.` (conservá el `data-tip` actual del tooltip POL)
3. h4 `Confirmá y listo` · p: `Tu donación queda grabada en la ` + tooltip
   `blockchain` + ` en segundos: es pública y cualquiera puede verificarla. Eso sí,
   en cripto no hay botón de arrepentimiento: la donación es irreversible.`
   (conservá el `data-tip` actual)

Se eliminan `.timeline-dot` y las clases `.step-1/2/3` (el CSS nuevo no las usa).

### 4.4 `whiskito-trust.js` — light DOM

```
section.section
└── div.trust-grid
    ├── div.trust-head   → span.eyebrow + h2 + p
    └── ul.trust-list    → 4 × li (span.trust-num + div > h4 + p)
```

**Copy:** eyebrow `03 · La etiqueta` · h2 `Lo que dice la etiqueta` · p: `Estas
garantías no son promesas de marketing: están escritas en el código que maneja
los whiskitos, y nadie puede cambiarlas por detrás.`

`.trust-num` = `01` `02` `03` `04` (reemplaza a los emojis `.trust-icon`).

1. h4 `Solo el dueño toca sus fondos` · p: `El código que gestiona los whiskitos
   no le permite a nadie mover tu dinero: ni a otro usuario, ni a Whiskito. Tu
   wallet es la única llave que abre esa caja.`
2. h4 `Mínimo: 0.01 USD por donación` · p: `Toda ronda tiene un piso equivalente a
   un centavo de dólar. Así se evitan donaciones vacías y errores de tipeo del estilo
   "quería poner 5 y puse 0.05".`
3. h4 `Precio real, nunca viejo` · p: `La conversión POL → dólares no la decidimos
   nosotros: viene de un ` + tooltip `oráculo` + ` (una fuente de precios confiable
   y verificada en tiempo real). Si el dato está desactualizado, la operación
   simplemente no se hace.` (conservá el `data-tip`)
4. h4 `Todo queda a la vista` · p: `Cada donación queda grabada en la blockchain:
   un registro público que nadie puede editar ni borrar. ¿Querés comprobarlo? Cada
   movimiento tiene su enlace a ` + tooltip `Polygonscan` + `, el buscador de
   transacciones de Polygon.` (conservá el `data-tip`)

### 4.5 `whiskito-faq.js` — light DOM

```
section.faq-section#faq
└── div.section
    └── div.faq-wrap
        ├── div.faq-intro   → span.eyebrow (style="justify-content: center") + h2 + p
        └── 5 × details > (summary + p)
```

**Copy:** eyebrow `04 · Preguntas` · h2 `Preguntas del público` · p: `Las dudas
que todos tenemos la primera vez, respondidas sin tecnicismos.`

Preguntas (mismas 5, reescritas a whiskito; `<b>` con los términos clave):

1. `¿Qué es una wallet y cómo consigo una?` — `Una <b>wallet</b> (billetera) es una
   app que guarda tus criptomonedas y te identifica: es tu cuenta, tu firma y tu
   bóveda, todo en uno. La más popular es <b>MetaMask</b>: es gratis, se instala
   como extensión de navegador (también hay para celular) y te guía paso a paso al
   crearla. Una vez lista, volvés a Whiskito, tocás "Conectar Wallet" y listo: esa
   es tu identidad acá.`
2. `¿Necesito registrarme con email?` — igual que hoy, con `<b>No.</b>` y
   `<b>es</b>`.
3. `¿Qué pasa si dono por error?` — igual que hoy (irreversible, `<b>antes</b>`).
4. `¿Hay algún costo aparte del monto que dono?` — `Whiskito cobra <b>0% de
   comisión</b>: el 100% de tu donación llega a quien la recibe. Pero existe algo
   llamado <b>gas</b> …`
5. `¿Cómo sé que el dinero llegó de verdad?` — igual que hoy.

### 4.6 `whiskito-footer.js` — light DOM

```
footer.footer
├── div.footer-inner → div.footer-brand (div.footer-logo + p.footer-tagline) + nav.footer-links (4 a + a.footer-explorer)
├── p.footer-warning
└── p.footer-copy
```

**Copy:** logo `🥃 Whiskito` · tagline `Hecho con POL y buen rollito. No hay
plataforma que se quede con tu whiskito: el apoyo va directo de wallet a wallet.`
· links: `Donar` (#donar), `Cómo funciona` (#como-funciona), `Mi Panel` (#panel),
`Preguntas frecuentes` (#faq) y el link del explorador (`Ver el contrato en el
explorador` + `<i data-lucide="arrow-up-right"></i>`, target `_blank`, rel
`noopener`; ver abajo) · warning: `⚠️ <b>Importante:</b> las donaciones en
cripto son irreversibles. Una vez confirmada, una ronda no se puede recuperar.
Doná con cabeza, whiskitero.` · copy: `Whiskito · Donaciones en POL para
profesionales independientes · El contrato es público y auditable por cualquiera`

**El link del explorador sale de la red, no del template.** El 5.º link es
`a.footer-explorer` con `data-attr="hidden:explorerHidden; href:explorerHref"`, y
su `<span data-text="explorerLabel">` es el que pinta el texto
(`Ver el contrato en el explorador`). El `href` **no está hardcodeado**: es
`NETWORKS[red].explorer` + `/address/` + `fund`, y se lo pasa `app.js` por la
frontera `islands.setExplorer()` (`islands.js` escribe `explorer` y `fund` como
atributos de la isla). En una red **sin** explorador (`explorer: null`, anvil) el
`<a>` queda `hidden`, no apunta a `#`. Es el mismo dato que el modal del
veredicto de la transacción.

**Trampa (no reintroducir):** el `data-text` va en el `<span>` y **no** en el
`<a>`, porque `update()` pinta con `textContent` y se llevaría el icono
`<i data-lucide="arrow-up-right"></i>`, que es **hermano** del span. Con el
marcador en el `<a>` quedaban 15 iconos en vez de 16 (la trampa está comentada en
`src/components/whiskito-footer.js`).

### 4.7 `whiskito-donate-card.js` — shadow (isla) — LA CARTA

Estructura: `div.donate-card` → `p.recipient-line` · `h3.card-title` ·
`p.card-subtitle` · `p.card-demo` · `div.quick-amounts` (4 `button.chip` con
`data-usd`) · `div.input-group`
(`label.input-label` + `div.input-wrapper` con `span.input-currency` +
`input#ehtAmount` + `span.usd-equiv#usdEquivalent`) · `p.card-hint#cardHint` ·
`div.connect-row` (`span.connect-who` +
`button#connectWallet.btn.btn-block.btn-ghost` +
`button#switchWallet.btn.btn-block.btn-ghost`) ·
`button#fundButton.btn.btn-primary.btn-lg.btn-block` · `div#txStatus.tx-status`
(`span.tx-spinner` + `span.tx-text#txText`) · `p.card-footnote`.

**Copy:** card-title `La carta` · card-subtitle `Elegí tu veneno: un monto rápido
o el tuyo.` · chips: `🥃 Un sorbo` (0.5) · `🥃 Un whisky` (1) · `🥃🥃 Una ronda`
(5) · `🍾 La botella entera` (20) · input-label `Monto en POL` · input-currency `Ξ`
· fundButton `🥃 Invitar un Whiskito` · footnote `🔒 Mínimo: 0.01 USD, calculado con
el precio en tiempo real de un ` + tooltip `oráculo` + ` on-chain.` (conservá el
`data-tip`).

Tres nodos de la carta que no son copy fija sino estado de la página que la usa
(`islands.js` les escribe la propiedad, el atributo ES el estado), más la copia
de estado del aviso de mínimo:

- `p.recipient-line`: a quién le donás. Lo pinta `data-text="recipientText"` y el
  texto se **interpola en JS**: `Le donás a ` + `shortAddress(recipient)` (o sea
  `Le donás a 0x1234...abcd`). Nace `hidden`
  (`data-attr="hidden:recipientHidden"`) y sólo
  aparece con el atributo `recipient` (`islands.setDonateRecipient`). Es la línea
  que hace que la página del link (`/u/0x…`) se explique sola.
- `p.card-demo`: el aviso de **modo demo**. Se muestra con
  `data-attr="hidden:demoHidden"` y lo prende la página, no la isla: la landing
  (`islands.setDonateDemo(DEMO)`, con `DEMO` en `true` por defecto), nunca la
  página del link, que cobra de verdad. Copy literal (el icono va adentro, en el
  mismo `<p>`, y el `Demo:` va en `<b>`): `<b>Demo:</b> así funciona el link de
  Whiskito. Probala con o sin wallet: no se firma nada, no se gasta gas y no queda
  en la blockchain.`
- `div.connect-row`: la fila de conexión para las páginas **sin navbar**, opt-in
  con el atributo booleano `show-connect` (`islands.setDonateConnectVisible`; la
  landing no lo setea). Nace `hidden` (`data-attr="hidden:connectHidden"`).
  Adentro:
  - `span.connect-who`: desde qué cuenta se dona. `data-text="viewerText"`, texto
    interpolado `Donás desde ` + `shortAddress(viewer)`
    (`Donás desde 0x1234...abcd`); sin cuenta conectada queda `hidden`
    (`data-attr="hidden:viewerHidden"`, atributo `viewer`).
  - `button#connectWallet.btn.btn-block.btn-ghost`: `Conectar wallet` (texto
    literal), visible sólo sin cuenta conectada
    (`data-attr="hidden:connectButtonHidden"`). Emite
    `whiskito:connect-request`, el mismo evento del navbar.
  - `button#switchWallet.btn.btn-block.btn-ghost`: **`Cambiar cuenta`** (texto
    literal, a propósito sin icono: el conteo de iconos de la isla está
    verificado). Visible sólo **con** una cuenta conectada
    (`data-attr="hidden:switchHidden"`). Emite
    `whiskito:switch-account-request`; la política es del flujo, no de la isla:
    `app.js` / `donate.js` piden el **selector** de cuentas con
    `wallet_requestPermissions` —no `eth_requestAccounts` a secas, que con el
    permiso ya dado devuelve la misma cuenta sin abrir nada— y reconstruyen los
    clientes con la elegida. En el navbar de la landing el mismo botón es
    `#switchButton` (§4.1). Lo verifica el probe de la página del link con las
    aserciones `S1`–`S15`.
- `p.card-hint#cardHint` pinta uno de dos avisos por `data-text="hintText"`
  (`data-attr="hidden:hintHidden"`): el piso, **interpolado en JS** — `El mínimo
  es ` + `minUsd.toFixed(2)` + ` USD ≈ ` + `minPol` + ` POL`, con el monto en POL
  redondeado hacia arriba a 6 decimales — y, si
  el visitante es el dueño de la página (atributo `can-donate="false"`,
  `islands.setDonateCanDonate`), el bloqueo del dueño: `Estás en tu propia página:
  compartí el link para recibir` (`SELF_DONATION_MESSAGE`, copia literal del
  mensaje de `app.js`). El bloqueo le gana al aviso del mínimo.

`STATUS_TEXT`: `pending: "Procesando transacción..."`, `success: "¡Whiskito
enviado! 🥃"`, `error: "No se pudo completar la transacción"`, `idle: ""`.

**Contrato (no tocar):** `observedAttributes`, getters/setters, `get state()`,
ids `#ehtAmount`, `#usdEquivalent`, `#cardHint`, `#connectWallet`, `#switchWallet`,
`#fundButton`, `#txStatus`, `#txText`, atributos `data-usd` de los chips,
`data-text`/`data-attr`/`data-class` existentes, eventos `whiskito:amount-change` /
`whiskito:connect-request` / `whiskito:switch-account-request` /
`whiskito:fund-request`.

Ojo: `render()` marca el chip elegido con la clase **`is-active`**. El CSS del
sistema usa `.chip.active`. En el CSS de la isla dejá **las dos**: `.chip.active,
.chip.is-active { … }` con el look del sistema. No toques `render()`.

**CSS propio:** reset + `.tt` (copia literal del sistema) + `.btn`, `.btn-primary`,
`.btn-lg`, `.btn-block` (del sistema) + `.btn-ghost` (el mismo lenguaje sin el
relleno rojo: lo usan los dos botones de `div.connect-row`) + `.donate-card`,
`.card-title`, `.card-subtitle`, `p.recipient-line` (+ `[hidden]`), `.card-demo`
(+ `.card-demo .icon`, `.card-demo b`, `[hidden]`), `.connect-row` (+ `[hidden]`),
`.connect-who` (+ `[hidden]`), `#connectWallet[hidden]` / `#switchWallet[hidden]`,
`.quick-amounts`, `.chip` (+ `:hover`, `:disabled`), `.input-group`,
`.input-label`, `.input-wrapper` (+ `:focus-within`), `.input-currency`,
`.input-wrapper input` (+ `::placeholder`, spin buttons), `.usd-equiv`,
`.card-footnote`, `.tx-status` (+ `[hidden]`, `.tx-success`, `.tx-error`),
`.tx-spinner`, `@keyframes spinfast`, y `@media (max-width: 768px)` con
`.donate-card { padding: 32px 24px }`.
Extra (no está en el sistema, inventalo en el idioma del poster): `p.card-hint`
— aviso de mínimo, tipografía `var(--cond)` en `var(--blues-red)`, centrado,
`margin-top: 12px`.

Se eliminan `.card-glow` (el CSS nuevo no lo usa).

### 4.8 `whiskito-panel.js` — shadow (isla) — EL BACKSTAGE

```
section.backstage
└── div.panel-split
    ├── div.panel-copy
    │   ├── span.eyebrow · h2 · p#panelOwner.panel-owner · p
    │   ├── ul.panel-points → 3 × li (span.pp-icon + div > b + span.d)
    │   └── div.panel-note → span + p > b
    └── div.receipt
        ├── div.receipt-head → texto + span.pd-badge
        ├── p.r-balance-label
        ├── p.receipt-balance → span#balanceDisplay + span.balance-unit
        ├── p.r-usd#balanceUsd
        ├── p.r-history-title
        ├── div#donationsList
        ├── p.r-empty (estado vacío, data-attr="hidden:hasDonations")
        ├── div.receipt-actions → button#withdrawButton.btn.btn-primary.btn-block
        │   · button#withdrawPartButton.btn.btn-block
        │   · div.withdraw-part#withdrawPart → label.withdraw-part-label +
        │     input#withdrawAmount.withdraw-part-input +
        │     p.withdraw-part-error#withdrawPartError +
        │     div.withdraw-part-actions (button#withdrawConfirmButton.btn.btn-primary
        │     + button#withdrawCancelButton.btn)
        │   · p.withdraw-status#withdrawStatus
        └── p.r-foot
```

**Copy:** eyebrow `02 · El backstage` · h2 `Tu backstage, tus fondos, tu control`
· p: `Conectás tu wallet y aparece tu barra personal. Solo ves lo tuyo:`
· panel-owner: `Panel de ` + `shortAddress(owner)` (`Panel de 0x1234...abcd`) — lo
pinta `ownerLabel`; sin dueño conocido (landing sin `?u=`) queda vacío y `hidden`
(`data-attr="hidden:noOwner"`), porque un `<p>` vacío igual ocupa una línea y
corre el layout.
· panel-points: `💰` `Cuánto te donaron en total` / `El acumulado de todas las
rondas que te invitaron.` · `📜` `Quién te invitó, y cuándo` / `Historial completo
con montos y sus equivalentes en dólares.` · `💸` `Cuánto tenés disponible ahora
mismo` / `Listo para retirar, total o parcialmente, cuando se te cante.`
· panel-note: `🔐` + `<b>Privado para operar, público para verificar.</b> Retirar
solo puede hacerlo el dueño de la wallet. Que los datos sean públicos en la
blockchain (cualquiera puede auditarlos) no significa que alguien más pueda mover
tus fondos. Tus whiskitos, tus reglas.`
· receipt-head: `🥃 Whiskito · Barra` + `span.pd-badge` `vista previa`
· r-balance-label: `Balance disponible`
· receipt-balance: `#balanceDisplay` (`data-text="balancePol"`, texto inicial
`0.0842`) + `span.balance-unit` `POL`
· r-usd: `#balanceUsd` `data-text="balanceUsd"`, texto `≈ $269.44 USD`
· r-history-title: `Últimas rondas recibidas`
· `#withdrawButton`: `💸 Retirar todo` (conserva `data-attr="hidden:notOwner;
  disabled:cannotWithdraw"`)
· `#withdrawPartButton`: `Retirar una parte` (texto literal, sin icono) — la
  segunda vía de retiro, al lado de "Retirar todo". Conserva
  `data-attr="hidden:withdrawPartButtonHidden; disabled:cannotWithdraw"`: se ve
  sólo para el dueño con saldo y **se esconde mientras la fila está abierta**.
· `#withdrawPart` (`div.withdraw-part`): la fila que despliega ese botón, con
  `data-attr="hidden:withdrawPartHidden"`. Adentro: `label.withdraw-part-label`
  `Monto a retirar (POL)` (`for="withdrawAmount"`), `input#withdrawAmount`
  (`type="number"`, `step="any"`, `min="0"`, `inputmode="decimal"`,
  `aria-describedby="withdrawPartError"`; **nace vacío** y su `placeholder` es el
  saldo disponible, lo escribe `render()`),
  `p.withdraw-part-error#withdrawPartError` (`data-text="withdrawPartErrorText"`,
  `data-attr="hidden:withdrawPartErrorHidden"`) con el veredicto del monto
  (`El monto tiene que ser mayor que 0` / `No podés retirar más de lo que tenés`)
  y `div.withdraw-part-actions` con `#withdrawConfirmButton` (`Confirmar retiro`,
  `data-attr="disabled:withdrawConfirmDisabled"`) y `#withdrawCancelButton`
  (`Cancelar`, sin marcadores: cierra la fila y limpia el input). Confirmar emite
  el mismo `whiskito:withdraw-request` que "Retirar todo", con el monto como
  texto decimal (`{ amount }`; el retiro total va con `{ amount: null }`).
· `#withdrawStatus`: conserva `data-text` + `data-attr="hidden:withdrawStatusHidden"`
  + `data-class="is-error:isWithdrawError; is-success:isWithdrawSuccess"`
· `WITHDRAW_LABELS` (texto por defecto cuando el mensaje viene vacío):
  `pending: "Retirando…"`, `error: "No se pudo retirar"`, `idle: ""` — el
  `success` está en §5.3.
· `template[data-item]` → `div.r-item` con `<code data-field="address">`,
  `span.amt` (`+<span data-field="eth">` POL `<small>≈ $<span data-field="usd">`
  `</small>`) y `span.when[data-field="when"]`
· estado vacío: `p.r-empty` con `data-attr="hidden:hasDonations"` y texto
  `Todavía no te invitaron ningún whiskito 🥃`
· r-foot: `Whiskito · recibo de barra · verificable en Polygonscan`

**Contrato (no tocar):** `observedAttributes`, todos los getters/setters y
`get state()`, ids `#panelOwner`, `#balanceDisplay`, `#balanceUsd`,
`#withdrawButton`, `#withdrawPartButton`, `#withdrawPart`, `#withdrawAmount`,
`#withdrawPartError`, `#withdrawConfirmButton`, `#withdrawCancelButton`,
`#withdrawStatus`, `#donationsList`, `template[data-item]`,
todos los `data-text` / `data-attr` / `data-class` / `data-field`, evento
`whiskito:withdraw-request`, la clase `.panel-owner` (usada por el id), y
`is-error` / `is-success` en `.withdraw-status`.

**CSS propio:** reset + `.eyebrow` (con `::before`/`::after` ★ como el sistema) +
`.backstage` (+ `.backstage .eyebrow`) + `.panel-split` + `.panel-copy h2` +
`.panel-copy > p` + `.panel-points*` + `.panel-note` + `.btn`, `.btn-primary`,
`.btn-block` + `.receipt*`, `.r-*`, `.receipt-balance`, `.r-usd`,
`.r-history-title`, `.r-item`, `.receipt-actions`, `.r-foot`, `.pd-badge` +
`@media (max-width: 980px)` y `(max-width: 768px)` del sistema.

**Ojo con el ancho:** `.backstage` es la banda de tinta a todo lo ancho y
`.panel-split` el contenedor centrado de 1200px. La banda tiene que verse de borde
a borde.

Extra (no está en el sistema): `p.panel-owner` → tipografía `var(--cond)`,
`color: var(--mustard)`, `word-break: break-all`, `[hidden] { display: none }`;
`p.r-empty` → `color: var(--stamp)`, `font-size: 0.9rem`, italic;
`p.withdraw-status` → `var(--cond)`, centrado, `margin-top: 10px`, con
`.is-error { color: var(--blues-red) }` y `.is-success { color: var(--success) }`
y `[hidden] { display: none }`;
`.withdraw-part*` (la fila de retiro parcial) → `.withdraw-part` en columna con
`gap: 10px`, fondo de tinta al 5 %, borde `2px dashed var(--ink)` y radio `6px`;
`.withdraw-part-label` en `var(--cond)` mayúscula; `.withdraw-part-input` en
`'Courier New'` con borde `2px solid var(--ink)` y `:focus` en `var(--cobalt)`;
`.withdraw-part-error` en `var(--blues-red)`; `.withdraw-part-actions` con
`.btn { flex: 1 1 auto }`. **Cada nodo que se muestra u oculta declara su
`[hidden] { display: none }`**: el `display` propio le gana al del navegador (la
misma trampa de `#withdrawButton`).

### 4.9 `whiskito-share-card.js` — shadow (isla) — widget flotante

No está en el diseño de referencia (es un overlay del dueño de la página), pero
**tiene que pertenecer al mismo mundo visual**: papel crema, tinta, sombra dura,
rojo cartel, mostaza, cobalto.

**Estructura** (dos raíces del shadow root, las dos `position: fixed`):

```
button#shareTrigger.share-trigger[aria-controls="sharePanel"][aria-expanded]
  → <i data-lucide="share2"></i> + span[data-text="triggerLabel"] → Compartir
    (el aria-expanded lo pinta data-attr="aria-expanded:expanded")

aside#sharePanel.share-panel[aria-label="Compartir mi link de Whiskito"][hidden]
  (data-attr="hidden:panelHidden")
├── button#shareClose.share-close[aria-label="Cerrar"] → ×
├── div.share-card#shareCard
│   ├── p.brand → WHISKITO
│   ├── h2.share-title#shareTitle → Invitame un <span class="gold">whiskito</span>
│   ├── div.qr-frame#qrFrame
│   │   ├── canvas#qrCanvas[width=512][height=512][aria-label="Código QR de mi link de Whiskito"]
│   │   ├── div.qr-fallback#qrFallback[hidden]
│   │   │   ├── span.fallback-icon[aria-hidden="true"]
│   │   │   ├── span → No pudimos generar el QR. Tu link sigue funcionando: copialo y compartilo igual.
│   │   │   └── span.fallback-hint → Revisá tu conexión y volvé a intentar.
│   │   └── div.qr-locked#shareLocked
│   │       ├── span.locked-icon[aria-hidden="true"]
│   │       └── span.locked-text → Conectá tu wallet para activar tu QR
│   ├── p.share-link#shareLink → span.link-prefix[data-text="linkPrefix"]
│   │   (whiskito.app/u/) + span.link-address[data-text="linkAddress"] (tu-wallet)
│   ├── p.share-trust → 3 × span (span.check + texto) separados por
│   │   span.dot[aria-hidden="true"] (·)
│   │   → Directo a mi wallet · 0% comisión · 100% verificable
│   └── button#shareConnectButton.share-connect[data-attr="hidden:connectHidden"]
│       → Conectá tu wallet
└── div.share-actions#shareActions
    ├── div.share-grid → 4 × button.share-btn[data-network]
    │   (data-attr="disabled:shareDisabled")
    │   → #shareWhatsappButton WhatsApp · #shareXButton X ·
    │     #shareTelegramButton Telegram · #shareFacebookButton Facebook
    └── div.share-row → 3 × button.share-btn[data-network]
        → #shareNativeButton Compartir (con
          data-attr="hidden:nativeHidden; disabled:shareDisabled": sólo si hay
          navigator.share) · #copyButton (adentro, span.copy-label →
          Copiar link) · #downloadButton Descargar QR
```

`open` (atributo booleano) es el estado del panel: decide `panelHidden` y
`expanded`, y lo cambian el trigger, `#shareClose`, `Escape` y el flujo. Todos
los `<i data-lucide>` de la isla —los de la tarjeta y los de los siete botones—
están en §5.3. **La visibilidad del QR no va por marcadores**: la maneja la isla
contra `#qrFrame` (clase `is-locked`), `#qrCanvas`,
`#qrFallback` (cuando el CDN de `qrcode` no responde) y `#shareLocked` (sin
`address`). `#copyButton` pinta `COPY_LABEL` / `COPIED_LABEL` en su
`span.copy-label` — y **no en el botón**, porque `textContent` se llevaría el
icono (la trampa está anotada en la cabecera).

- Reemplazá **todos** los tokens viejos por los nuevos: `--beer-gold` →
  `--mustard`, `--beer-gold-soft` → `--mustard`, `--beer-amber` → `--blues-red`,
  `--text-primary` → `--ink`, `--text-secondary` → `--stamp`, `--bg-card` →
  `--paper`, `--border` → `rgba(28, 21, 18, 0.35)`, `--success` → `var(--success)`,
  `--radius-sm|md|lg` → radios del poster (`4px`/`6px`).
- `#shareTrigger`: fondo `var(--blues-red)`, texto `var(--paper)`, borde
  `3px solid var(--ink)`, `box-shadow: 5px 5px 0 var(--ink)`, tipografía
  `var(--cond)` mayúscula con `letter-spacing`.
- La tarjeta: `background: var(--paper)`, `border: 3px solid var(--ink)`,
  `box-shadow: 8px 8px 0 var(--cobalt)`, títulos con `var(--display)`,
  textos con `var(--serif)` / `var(--cond)`, botones secundarios en mostaza.
- Textos visibles: `SHARE_TEXT` y `SHARE_TITLE` → `Invitame un whiskito 🥃`;
  `LOCKED_DISPLAY_URL` → `whiskito.app/u/tu-wallet`; los enlaces se siguen
  armando con `shareTarget()` (no toques esa función ni la firma).
- **No cambies** el contrato de posicionamiento: `position: fixed` en el trigger
  y el panel, y **nada** de `transform`/`filter`/`will-change` en un ancestro (el
  panel dejaría de seguir el scroll).

**Contrato (no tocar):** `observedAttributes`, `shareTarget()`, los ids de la
isla, `open`, `address`, `shareBase`, los eventos `whiskito:share`, el dibujo del
QR en canvas y los botones de copiar/descargar.

**Fuera de §4 y sin resolver (anotado, no arreglado):**

- **`whiskito-dashboard.js` no tiene subsección acá.** Es el modal "Mi Panel"
  (600+ líneas) y **duplica el bloque de retiro parcial de §4.8 con los mismos
  ids**: `#withdrawPartButton`, `#withdrawPart`, `#withdrawAmount`,
  `#withdrawPartError`, `#withdrawConfirmButton`, `#withdrawCancelButton`
  (`whiskito-dashboard.js:621-652` contra `whiskito-panel.js:565-611`). No hay
  colisión real —cada isla vive en su shadow root y los ids no cruzan— pero la
  funcionalidad está escrita dos veces y este contrato no la documenta. Falta
  decidir: deduplicar, o darle su propia subsección.
- **El botón "Cambiar cuenta" del navbar no está cubierto en la página del link.**
  El probe ejercita `S1`–`S7` sobre la tarjeta de donación y `S8` sobre el navbar
  **de la landing**; en `/u/0x…` el `#switchButton` existe pero ninguna aserción
  lo clickea. Es un hueco de cobertura, no un bug.

---

## 5. Iconos (Lucide) — reemplazo de los emoji

Los emoji que hacían de icono se reemplazan por **Lucide**. Ya está resuelto el
andamiaje; los componentes sólo escriben marcadores.

### 5.1 Cómo se escribe un icono

```html
<i data-lucide="glass-water"></i>
```

Al montar, `hydrateIcons()` (en `src/js/dom/icons.js`, llamada desde
`base-element.js`) lo reemplaza por el `<svg>` de Lucide, con la clase `icon`.
**No escribas `<svg>` a mano y no importes lucide en el componente.**

Reglas:

1. **El elemento que envuelve el emoji se conserva** y el `<i>` va adentro.
   Ese elemento ya tiene el `font-size` y el `color` del slot, y el icono mide
   `1em` y dibuja con `currentColor`: hereda las dos cosas sin tocar el CSS.
   ```html
   <!-- antes --> <div class="mc-avatar">🥃</div>
   <!-- después --> <div class="mc-avatar"><i data-lucide="glass-water"></i></div>
   ```
2. **Si el elemento existía sólo para el glifo** (`.tick`, `.logo-icon`,
   `.glass-glow`), puede llevar el atributo él mismo:
   ```html
   <!-- antes --> <i class="tick">✓</i>
   <!-- después --> <i class="tick" data-lucide="check"></i>
   ```
   Los atributos del `<i>` viajan al `<svg>`, así que la clase sigue aplicando.
3. **Dejá un espacio** entre el `<i>` y el texto cuando el contenedor no sea
   flex (los `.chip`, `.receipt-head`): `<i data-lucide="lock"></i> Mínimo…`.
4. **Los marcadores siguen funcionando sobre el icono**: `data-attr`,
   `data-class` y `data-text` viajan al `<svg>` con los demás atributos.
5. **Cada isla con shadow root agrega esta regla a su `static styles`** (la hoja
   global no cruza la frontera). En light DOM ya está en `src/styles.css`:
   ```css
   .icon { width: 1em; height: 1em; flex: none; vertical-align: -0.15em; }
   ```
6. **Nada de `font-size` ni `color` nuevos para los iconos**: si un icono hay que
   pintarlo distinto, se pinta desde su slot (que ya existe).

### 5.2 Qué NO se reemplaza

- **`★`**: es tipografía del cartel, no un icono. Queda el `content: '★'` de
  `.eyebrow::before/::after`, los `★` del badge del hero, de `.mc-label` y del
  sello.
- **`→` y `↔` en comentarios**: son prosa.
- **Emoji dentro de textos que salen de la página** (el `<title>` y el `meta
  description` de `index.html`, y `SHARE_TEXT` / `SHARE_TITLE` de la
  share-card): ahí no hay slot de icono posible, es copy de mensaje. Quedan.
- **Emoji al final de una frase** (mensajes de estado, estado vacío del panel):
  se **borran** (no se reemplazan): un icono no vive dentro de un nodo de texto.

### 5.3 Mapa por componente

Nombres exactos de Lucide (ya validados contra el paquete instalado). Si un
nombre no resuelve, Lucide deja el `<i>` sin reemplazar y avisa por consola.

#### `whiskito-hero.js`

| slot | emoji | queda |
|---|---|---|
| `.hero-actions` botón 1 | 🥃 | `<i data-lucide="glass-water"></i> Quiero invitar un whisky` |
| `.hero-actions` botón 2 | 💸 | `<i data-lucide="hand-coins"></i> Quiero recibir donaciones` |
| `.hero-trust .tick` ×3 | ✓ | `<i class="tick" data-lucide="check"></i>` |
| `.glass-glow` | 🥃 | adentro: `<i data-lucide="glass-water"></i>` |
| `.mc-avatar` | 🥃 | adentro: `<i data-lucide="glass-water"></i>` |
| `.mc-time` | ✅ | `hace 2 min · confirmado <i data-lucide="circle-check"></i>` |
| `.chip-a` | ⛓️ | `<i data-lucide="database"></i> Archivado en la blockchain` |
| `.chip-b` | 🦊 | `<i data-lucide="wallet"></i> <code>0x3f...b8a1</code> llegó al club` |

Quedan: los `★` del badge, de `.mc-label` y del sello.

#### `whiskito-how-it-works.js`

`div.step-emoji` **se renombra a `div.step-icon`** (el nombre viejo mentía) y
lleva el `<i>` adentro:

| paso | emoji | icono |
|---|---|---|
| 1 | 🦊 | `wallet` |
| 2 | 🔗 | `link` |
| 3 | 🏧 | `banknote` |

#### `whiskito-footer.js`

| slot | emoji | queda |
|---|---|---|
| `.footer-logo` | 🥃 | adentro: `<i data-lucide="glass-water"></i> Whiskito` |
| link del explorador (`a.footer-explorer`) | ↗ | se quita el `↗` y va `<i data-lucide="arrow-up-right"></i>` al final del texto, **hermano** del `<span data-text="explorerLabel">` (ver §4.6) |
| `.footer-warning` | ⚠️ | `<i data-lucide="triangle-alert"></i> <b>Importante:</b> …` |

#### `whiskito-navbar.js` (shadow)

- `.logo-icon` (span, sólo glifo): `<span class="logo-icon" data-lucide="glass-water"></span>`
- botón `#connectButton`: dos iconos estáticos que se alternan con los marcadores
  que ya existen (`isConnected` / `notConnected`). **No hace falta JS nuevo**:
  ```html
  <i data-lucide="wallet" data-attr="hidden:isConnected"></i>
  <i data-lucide="circle-check" data-attr="hidden:notConnected"></i>
  ```
- `LABELS` quedan sin emoji: `"Conectar Wallet"`, `"Conectando…"`, `"Conectado"`,
  `"Sin wallet detectada"`.
- Al `static styles` hay que agregarle `.icon {…}` (regla 5.1.5) **y**
  `.icon[hidden] { display: none; }`, porque un `display` de autor le gana al
  `[hidden]` del navegador.

#### `whiskito-donate-card.js` (shadow)

| slot | emoji | queda |
|---|---|---|
| chip 0.5 | 🥃 | `<i data-lucide="glass-water"></i> Un sorbo` |
| chip 1 | 🥃 | `<i data-lucide="glass-water"></i> Un whisky` |
| chip 5 | 🥃🥃 | `<i data-lucide="glass-water"></i> Una ronda` |
| chip 20 | 🍾 | `<i data-lucide="bottle-wine"></i> La botella entera` |
| `#fundButton` | 🥃 | adentro: `<i data-lucide="glass-water"></i> Invitar un Whiskito` |
| `.card-footnote` | 🔒 | `<i data-lucide="lock"></i> Mínimo: 0.01 USD, …` |
| `STATUS_TEXT.success` | 🥃 | `"¡Whiskito enviado!"` (sin emoji) |

Más `.icon {…}` en su `static styles`.

#### `whiskito-panel.js` (shadow)

| slot | emoji | queda |
|---|---|---|
| `.pp-icon` 1 | 💰 | adentro: `<i data-lucide="coins"></i>` |
| `.pp-icon` 2 | 📜 | adentro: `<i data-lucide="scroll-text"></i>` |
| `.pp-icon` 3 | 💸 | adentro: `<i data-lucide="banknote"></i>` |
| `.panel-note` | 🔐 | adentro del span: `<i data-lucide="shield-check"></i>` |
| `.receipt-head` | 🥃 | `<i data-lucide="glass-water"></i> Whiskito · Barra` |
| `p.r-empty` | 🥃 | se borra el emoji final |
| `#withdrawButton` | 💸 | adentro: `<i data-lucide="banknote"></i> Retirar todo` |
| `WITHDRAW_LABELS.success` | 🥃 | `"¡Retirado!"` |

Queda el `content: '★'` de su `.eyebrow`. Más `.icon {…}` en su `static styles`.

#### `whiskito-share-card.js` (shadow)

| slot | emoji | queda |
|---|---|---|
| `.brand` | 🥃 | adentro: `<i data-lucide="glass-water"></i> WHISKITO` |
| `.share-title` | 🥃 final | se borra el emoji final |
| `.fallback-icon` | 🧯 | adentro: `<i data-lucide="qr-code"></i>` |
| `.locked-icon` | 🔒 | adentro: `<i data-lucide="lock"></i>` |
| `.check` ×3 | ✓ | adentro: `<i data-lucide="check"></i>` |
| botón conectar | 🦊 | adentro: `<i data-lucide="wallet"></i> Conectá tu wallet` |
| WhatsApp | 💬 | `<i data-lucide="message-circle"></i>` |
| X | 🐦 | `<i data-lucide="hash"></i>` |
| Telegram | ✈️ | `<i data-lucide="send"></i>` |
| Facebook | 📘 | `<i data-lucide="thumbs-up"></i>` |
| Compartir (nativo) | 📤 | `<i data-lucide="upload"></i>` |
| Copiar link | 🔗 | `<i data-lucide="link"></i>` |
| Descargar QR | ⬇️ | `<i data-lucide="download"></i>` |
| `#shareTrigger` | 🥃 | adentro: `<i data-lucide="share2"></i>` |
| `COPY_LABEL` | 🔗 | `"Copiar link"` |
| `COPIED_LABEL` | ✓ | `"¡Copiado!"` |
| `triggerLabel` | 🥃 / 🔒 | `"Compartir"` (sin emoji, en los dos estados) |

Lucide **ya no tiene iconos de marca**: ni Twitter/X ni Facebook existen.
Se usan equivalentes genéricos (`hash`, `thumbs-up`) y los rótulos de texto
—"X", "Facebook"— son los que identifican la red. Queda anotado como decisión.

Más `.icon {…}` en su `static styles`.

---

## 6. La radio (widget de música con YouTube)

Un widget flotante, **abajo a la izquierda** (la isla de compartir ya ocupa la
derecha), que reproduce una playlist de YouTube con volumen y parada propios.

- Archivo nuevo: `src/components/whiskito-radio.js`, clase `WhiskitoRadio`,
  registrada como `whiskito-radio`.
- Playlist: `PL-xVUW9dZgbcaN_ZmfinemsU7QdACG2fv` — *"Música Rock Sin Copyright"*.

### 6.1 Reglas de producto (no negociables)

1. **Nunca arranca sola.** No hay autoplay: la música empieza cuando la persona
   toca play. (Además los navegadores bloquean el audio sin gesto del usuario.)
2. **La pantalla del video queda visible.** No se oculta el reproductor ni se
   usa como audio de fondo: los términos de YouTube no permiten separar el audio
   del video. Se muestra chico, integrado al cartel.
3. **El script de YouTube se carga recién cuando piden música.** Un visitante que
   nunca toca play no descarga nada de YouTube ni recibe sus cookies. Hasta ese
   momento el documento no tiene ni `iframe` ni el script `iframe_api`.
4. **Si YouTube no carga** (sin red, bloqueado), el widget no rompe la página:
   `estado = "error"` con un texto claro y el enlace a la playlist siempre a mano.

### 6.2 Estado como atributos (el patrón de la casa)

`observedAttributes = ["abierto", "estado", "volumen", "muteado"]`, con
getters/setters que escriben el atributo (el atributo ES el estado) y
`get state()` para lo que se pinta.

| atributo | valores | significado |
|---|---|---|
| `abierto` | presente / ausente | el panel está desplegado |
| `estado` | `apagado` \| `cargando` \| `sonando` \| `pausado` \| `parado` \| `bloqueado` \| `error` | qué está pasando |
| `volumen` | `0`–`100` | volumen actual |
| `muteado` | presente / ausente | silenciado (independiente del volumen) |

`state` deriva además: `estadoTexto` (`"Dale play y suena"`, `"Cargando la
radio…"`, `"Sonando"`, `"En pausa"`, `"Parada"`, `"Tocá play en la pantalla"`,
`"No se pudo cargar YouTube"`), `etiquetaPlay` (`"Pausar"` / `"Reproducir"`, para
el `aria-label`), y los pares `esSonando`/`noSonando` y `muteado`/`noMuteado`.

**`bloqueado` es el estado que hace usable el widget en el 90% de los casos.** Los
navegadores bloquean el arranque automático de un iframe de otro origen: después
de tocar play, YouTube deja el video *cued* (`-1`/`5`) y no reproduce hasta que
alguien toca play **en la pantalla del video**. Sin este estado la isla se queda
en "Cargando…" para siempre, que se ve exactamente igual que estar rota. Se
detecta con un watchdog de 5 s desde que se pide play (ver §6.4).

**Los iconos que dependen del estado son DOS iconos estáticos que se alternan con
marcadores, no uno que cambia de nombre.** Un `<i data-lucide="play">` ya es un
`<svg>` cuando el estado cambia: escribirle `data-lucide="pause"` después no lo
vuelve a dibujar. Entonces:

```html
<button id="radioPlay" class="radio-btn radio-btn-main" data-attr="aria-label:etiquetaPlay">
  <i data-lucide="play"  data-attr="hidden:esSonando"></i>
  <i data-lucide="pause" data-attr="hidden:noSonando"></i>
</button>
```

y lo mismo para el mute (`volume-2` visible salvo `muteado`, `volume-x` al revés).

### 6.3 Estructura

```
button#radioTrigger.radio-trigger[aria-expanded]   → fixed, abajo-izquierda
  <i data-lucide="radio"> + span.radio-trigger-label (data-text="etiqueta")
section#radioPanel.radio-panel[hidden]
├── div.radio-head    → <i data-lucide="music"> + p.radio-title + button#radioClose.radio-close (×)
├── p.radio-sub       → "Música rock sin copyright · de fondo"
├── div.radio-screen  → div#radioPlayer  (acá YouTube mete el iframe)
├── div.radio-controls
│   ├── button#radioPlay.radio-btn.radio-btn-main  → <i data-lucide=iconoPlay>
│   ├── button#radioStop.radio-btn                 → <i data-lucide="square">
│   └── span.radio-volume → button#radioMute (<i data-lucide="volume-2|volume-x">) + input#radioVolume[type=range][min=0][max=100]
├── p.radio-state (data-text="estadoTexto")
└── a.radio-link (target _blank, rel noopener) → "Ver la playlist en YouTube" + <i data-lucide="arrow-up-right">
```

`#radioPlayer` va **vacío** en el template: el `<iframe>` lo pone YouTube.

### 6.4 Cómo se habla con YouTube

- `iframe_api` se inyecta **una sola vez y bajo demanda**: un módulo con
  `let promesa = null` que devuelve siempre la misma promesa, y
  `window.onYouTubeIframeAPIReady` resolviéndola. Dos clicks seguidos no pueden
  inyectar el script dos veces ni crear dos players.
- `new YT.Player(elemento, {...})` **con el elemento, no con un id**: un `id`
  adentro de un shadow root no existe para `document.getElementById`.
- `playerVars: { listType: "playlist", list: PLAYLIST, controls: 1, rel: 0, playsinline: 1 }`
- `onReady` → `setVolume(volumen)`; si la persona ya había pedido play, `playVideo()`.
- `onStateChange` → mapear a `estado`: `1` (playing) → `sonando`, `2` (paused) →
  `pausado`, `3`/`5` (buffering/cued) → `cargando`, `0` (ended) → `sonando`
  (la playlist sigue), y `-1` (unstarted) o cualquier valor nuevo →
  **`cargando` si ya se pidió música, `apagado` si no**. `apagado` es el estado
  *previo al click*: si `-1` lo pisara, el cartel volvería a decir "Dale play y
  suena" un instante después de que la persona tocó play (bug medido, ver README).
- `onError` → `estado = "error"`.
- Controles: play/pause → `playVideo()`/`pauseVideo()`; parar → `stopVideo()`;
  volumen → `setVolume(0..100)`; mute → `mute()`/`unMute()`.
- **Todo acceso al player pasa por un helper que tolera que todavía no exista**
  (`#conPlayer((p) => …)`): los botones tienen que funcionar antes de que el
  reproductor esté listo, sin tirar excepciones.

### 6.5 CSS (va adentro, es isla)

Reset + `.icon { width: 1em; height: 1em; flex: none; vertical-align: -0.15em; }` +
`[hidden] { display: none !important; }` + el widget en el idioma del cartel:
papel `--paper`, borde `3px solid var(--ink)`, sombra dura
`8px 8px 0 var(--cobalt)`, títulos `var(--display)` en mayúscula, botones
`var(--cond)`.

- `#radioTrigger`: `position: fixed; left: 20px; bottom: 20px; z-index: 200`.
- `#radioPanel`: `position: fixed; left: 20px; bottom: 88px; width: min(380px, calc(100vw - 40px))`.
- `.radio-screen`: `aspect-ratio: 16 / 9`, fondo tinta, y el `iframe`/`div` del
  player ocupando el 100% (sin esto el iframe colapsa a 0 de alto).
- `input[type=range]`: riel de tinta y pulgar `--blues-red` (`accent-color` sirve,
  pero dejalo explícito con `::-webkit-slider-thumb` y `::-moz-range-thumb`).
- **Nada de `transform`, `filter` ni `will-change` en el trigger, el panel ni
  ningún ancestro suyo**: convertirían a ese ancestro en el containing block y el
  widget dejaría de seguir el scroll. Si querés animar la entrada, animate
  `opacity`, no `transform`.
- `@media (max-width: 768px)`: el panel ocupa el ancho disponible y el trigger se
  achica al ícono.

### 6.6 Accesibilidad

`aria-label` en los cuatro botones, `aria-expanded` en el trigger, `Escape`
cierra, al abrir el foco entra al panel y al cerrar vuelve al trigger.


