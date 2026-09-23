import { WhiskitoElement } from "./base-element.js";

/**
 * La radio de Whiskito: widget flotante de música (playlist de YouTube).
 *
 * Vive abajo a la izquierda (la isla de compartir ya ocupa la derecha) y tiene
 * su propio volumen y su propia parada. Habla el idioma del cartel: papel,
 * tinta, sombra dura cobalto, títulos en `var(--display)`.
 *
 * Las cuatro reglas de producto (son el punto del componente):
 *
 *   1. **Nunca arranca sola.** No hay autoplay en ningún lado: la música
 *      empieza cuando la persona toca play (`autoplay: 0` también en playerVars).
 *   2. **La pantalla del video queda visible.** No se oculta el reproductor ni
 *      se usa como audio de fondo: los términos de YouTube no permiten separar
 *      el audio del video, así que el iframe se muestra chico y a la vista.
 *   3. **El script de YouTube se carga recién cuando piden música.** Un
 *      visitante que nunca toca play no descarga nada de YouTube ni recibe sus
 *      cookies: hasta ese momento el documento no tiene ni `iframe` ni el script
 *      `iframe_api`. La carga está guardada por una promesa a nivel de módulo
 *      (`#apiYouTube`), así que dos clicks seguidos no inyectan el script dos
 *      veces ni crean dos players.
 *   4. **Si YouTube no carga** (sin red, bloqueado), la página no se rompe:
 *      `estado = "error"` con un texto claro y el link a la playlist siempre a
 *      mano.
 *
 * El estado vive en los atributos (`abierto`, `estado`, `volumen`, `muteado`):
 * el atributo ES el estado y `get state()` deriva lo que se pinta.
 *
 * Los iconos que dependen del estado son DOS iconos estáticos que se alternan
 * con marcadores, no uno que cambia de nombre: cuando el estado cambia, el
 * marcador de play ya es un SVG, y escribirle encima el nombre del otro icono
 * no lo vuelve a dibujar (la hidratación corre una sola vez, al montar).
 */

/** Id de la playlist: "Música Rock Sin Copyright". */
const PLAYLIST = "PL-xVUW9dZgbcaN_ZmfinemsU7QdACG2fv";

/** Link público que se ofrece siempre, aunque YouTube no cargue. */
const PLAYLIST_URL = `https://www.youtube.com/playlist?list=${PLAYLIST}`;

/** Script de la IFrame Player API (el único recurso externo que se inyecta). */
const IFRAME_API_URL = "https://www.youtube.com/iframe_api";

/** Origen que exige el `origin` de la API (no crea una petición de red). */
const ORIGEN_YOUTUBE = "https://www.youtube.com";

/** Volumen inicial cuando el atributo `volumen` no está. */
const VOLUMEN_INICIAL = 60;

/** Si la API no responde en este tiempo, se avisa en vez de quedarse colgado. */
const ESPERA_API_MS = 12000;
/** Cuánto se espera a que YouTube reproduzca antes de avisar que está bloqueado. */
const ESPERA_REPRODUCCION_MS = 5000;

/** Texto de la línea de estado, por `estado`. */
const ESTADO_TEXTO = {
  apagado: "Dale play y suena",
  cargando: "Cargando la radio…",
  sonando: "Sonando",
  pausado: "En pausa",
  parado: "Parada",
  // YouTube dejó el video *cued*: el navegador bloqueó el arranque automático de
  // un iframe de otro origen. Se destraba tocando play en la pantalla del video.
  bloqueado: "Tocá play en la pantalla",
  error: "No se pudo cargar YouTube",
};

/**
 * Carga la IFrame Player API una sola vez y bajo demanda. Devuelve siempre la
 * misma promesa: dos clicks seguidos no pueden inyectar el script dos veces.
 *
 * @type {Promise<object>|null}
 */
let apiYouTube = null;

function cargarApiYouTube() {
  if (apiYouTube) return apiYouTube;

  apiYouTube = new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("sin window"));
      return;
    }
    if (window.YT && typeof window.YT.Player === "function") {
      resolve(window.YT);
      return;
    }

    // La API avisa por acá cuando terminó de cargar. Se pisa el callback previo
    // a propósito: es la única forma de que la promesa se resuelva.
    window.onYouTubeIframeAPIReady = () => resolve(window.YT);

    let script = document.querySelector(`script[src="${IFRAME_API_URL}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = IFRAME_API_URL;
      script.async = true;
      script.addEventListener("error", () =>
        reject(new Error("no se pudo cargar el script de YouTube")),
      );
      document.head.append(script);
    }
  });

  // Sin esto, un rechazo temprano sería un "unhandled rejection" en consola: la
  // promesa se guarda para siempre y nadie la mira hasta que haya un click.
  apiYouTube.catch(() => {});

  return apiYouTube;
}

export class WhiskitoRadio extends WhiskitoElement {
  static observedAttributes = ["abierto", "estado", "volumen", "muteado"];

  static styles = /* css */ `
    /* El reset universal de styles.css no cruza la frontera del shadow root:
       se copia acá para que margin, padding y box-sizing no vuelvan al UA. */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    :host {
      display: block;
    }

    /* Nuestro CSS no puede ganarle al display:none que trae [hidden]. */
    [hidden] {
      display: none !important;
    }

    /* Los marcadores de icono se vuelven SVG con la clase .icon: mide 1em y
       dibuja con currentColor, así que hereda tamaño y color del slot donde
       vive. La hoja global no cruza la frontera del shadow root, por eso va acá. */
    .icon {
      width: 1em;
      height: 1em;
      flex: none;
      vertical-align: -0.15em;
    }

    /* ---------- Flotantes: trigger + panel ---------- */
    /* Todo lo que renderiza la isla es flotante: no ocupa lugar en el flujo de
       la página. Nada de transform/filter/will-change acá ni en ningún ancestro:
       convertirían a ese ancestro en el containing block de los fixed y el
       widget dejaría de seguir el scroll. Si hay que animar la entrada, se
       anima la opacidad, no la caja. */
    #radioTrigger {
      position: fixed;
      left: 20px;
      bottom: 20px;
      z-index: 200;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 12px 20px;
      border: 3px solid var(--ink);
      border-radius: 6px;
      background: var(--cobalt);
      color: var(--paper);
      font-family: var(--cond);
      font-size: 1rem;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      cursor: pointer;
      box-shadow: 5px 5px 0 var(--ink);
      transition: box-shadow 0.15s ease;
    }

    /* El hover corre la sombra dura, no la caja: sin transform, el trigger
       sigue clavado en la esquina. */
    #radioTrigger:hover {
      box-shadow: 8px 8px 0 var(--ink);
    }

    #radioPanel {
      position: fixed;
      left: 20px;
      bottom: 88px;
      z-index: 200;
      width: min(380px, calc(100vw - 40px));
      /* En una ventana baja (un celular apaisado, ~400px de alto) el panel no
         entra entre el disparador y el borde de arriba: se limita y scrollea
         adentro. Sin esto se le sale la cabeza por arriba de la pantalla. */
      max-height: calc(100vh - 108px);
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 14px;
      background: var(--paper);
      border: 3px solid var(--ink);
      border-radius: 6px;
      box-shadow: 8px 8px 0 var(--cobalt);
      font-family: var(--cond);
      color: var(--ink);
    }

    /* Entrada suave sólo con opacidad: un transform movería la caja mientras
       dura la animación (y ensuciaría la medición del harness). */
    #radioPanel:not([hidden]) {
      animation: radio-panel-in 0.22s ease-out;
    }

    @keyframes radio-panel-in {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    /* ---------- Cabecera ---------- */
    .radio-head {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .radio-title {
      flex: 1;
      font-family: var(--display);
      font-size: 1.25rem;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: var(--ink);
    }

    #radioClose {
      flex: none;
      width: 30px;
      height: 30px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 2px solid var(--ink);
      border-radius: 4px;
      background: var(--paper);
      color: var(--ink);
      font-family: var(--cond);
      font-size: 1.1rem;
      font-weight: 700;
      line-height: 1;
      cursor: pointer;
      box-shadow: 2px 2px 0 var(--ink);
    }

    #radioClose:hover {
      background: var(--blues-red);
      color: var(--paper);
    }

    .radio-sub {
      font-size: 0.82rem;
      letter-spacing: 0.5px;
      color: var(--stamp);
    }

    /* ---------- Pantalla del video ---------- */
    /* La pantalla queda a la vista (regla 2). Sin alto, el iframe que mete
       YouTube colapsa a 0 y la pantalla desaparece. */
    .radio-screen {
      aspect-ratio: 16 / 9;
      width: 100%;
      background: var(--ink);
      border: 3px solid var(--ink);
      border-radius: 4px;
      overflow: hidden;
    }

    #radioPlayer,
    .radio-screen iframe {
      width: 100%;
      height: 100%;
      border: 0;
      display: block;
    }

    /* ---------- Controles ---------- */
    .radio-controls {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .radio-btn {
      flex: none;
      width: 40px;
      height: 40px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 2px solid var(--ink);
      border-radius: 4px;
      background: var(--paper-dark);
      color: var(--ink);
      font-family: var(--cond);
      font-size: 1.1rem;
      cursor: pointer;
      box-shadow: 3px 3px 0 var(--ink);
      transition: box-shadow 0.15s ease, background 0.15s ease, color 0.15s ease;
    }

    .radio-btn:hover {
      background: var(--mustard);
      box-shadow: 5px 5px 0 var(--ink);
    }

    .radio-btn-main {
      background: var(--blues-red);
      color: var(--paper);
      font-size: 1.25rem;
    }

    .radio-volume {
      flex: 1;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }

    .radio-volume .radio-btn {
      width: 34px;
      height: 34px;
      font-size: 0.95rem;
    }

    #radioVolume {
      flex: 1;
      min-width: 0;
      height: 22px;
      accent-color: var(--blues-red);
      cursor: pointer;
    }

    /* El riel de tinta y el pulgar rojo cartel, explícitos: el accent-color
       del navegador no alcanza en todos los motores. */
    #radioVolume::-webkit-slider-runnable-track {
      height: 6px;
      background: var(--ink);
      border-radius: 3px;
    }

    #radioVolume::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 16px;
      height: 16px;
      margin-top: -5px;
      border: 2px solid var(--ink);
      border-radius: 50%;
      background: var(--blues-red);
    }

    #radioVolume::-moz-range-track {
      height: 6px;
      background: var(--ink);
      border-radius: 3px;
    }

    #radioVolume::-moz-range-thumb {
      width: 14px;
      height: 14px;
      border: 2px solid var(--ink);
      border-radius: 50%;
      background: var(--blues-red);
    }

    /* ---------- Estado y link ---------- */
    .radio-state {
      font-size: 0.86rem;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      color: var(--stamp);
    }

    .radio-link {
      align-self: flex-start;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.86rem;
      font-weight: 700;
      letter-spacing: 0.5px;
      color: var(--cobalt);
      text-decoration: underline;
    }

    .radio-link:hover {
      color: var(--blues-red);
    }

    @media (max-width: 768px) {
      #radioTrigger {
        left: 12px;
        bottom: 12px;
        padding: 10px;
        font-size: 1.2rem;
      }

      /* En pantalla chica el trigger se achica al ícono. */
      .radio-trigger-label {
        display: none;
      }

      #radioPanel {
        left: 12px;
        bottom: 76px;
        width: calc(100vw - 24px);
      }
    }
  `;

  static template = /* html */ `
    <button
      id="radioTrigger"
      class="radio-trigger"
      type="button"
      aria-controls="radioPanel"
      aria-label="Abrir la radio de Whiskito"
      data-attr="aria-expanded:abierto"
    >
      <i data-lucide="radio"></i>
      <span class="radio-trigger-label" data-text="etiqueta">Radio</span>
    </button>

    <section
      id="radioPanel"
      class="radio-panel"
      aria-label="Radio de Whiskito"
      hidden
      data-attr="hidden:panelOculto"
    >
      <div class="radio-head">
        <i data-lucide="music"></i>
        <p class="radio-title">La radio</p>
        <button id="radioClose" class="radio-close" type="button" aria-label="Cerrar la radio">×</button>
      </div>

      <p class="radio-sub">Música rock sin copyright · de fondo</p>

      <div class="radio-screen">
        <div id="radioPlayer"></div>
      </div>

      <div class="radio-controls">
        <button
          id="radioPlay"
          class="radio-btn radio-btn-main"
          type="button"
          data-attr="aria-label:etiquetaPlay"
        >
          <i data-lucide="play" data-attr="hidden:esSonando"></i>
          <i data-lucide="pause" data-attr="hidden:noSonando"></i>
        </button>

        <button id="radioStop" class="radio-btn" type="button" aria-label="Parar la música">
          <i data-lucide="square"></i>
        </button>

        <span class="radio-volume">
          <button
            id="radioMute"
            class="radio-btn"
            type="button"
            data-attr="aria-label:etiquetaMute"
          >
            <i data-lucide="volume-2" data-attr="hidden:muteado"></i>
            <i data-lucide="volume-x" data-attr="hidden:noMuteado"></i>
          </button>
          <input
            id="radioVolume"
            class="radio-volume-slider"
            type="range"
            min="0"
            max="100"
            step="1"
            value="60"
            aria-label="Volumen de la radio"
          />
        </span>
      </div>

      <p class="radio-state" data-text="estadoTexto">Dale play y suena</p>

      <a
        class="radio-link"
        href="https://www.youtube.com/playlist?list=PL-xVUW9dZgbcaN_ZmfinemsU7QdACG2fv"
        target="_blank"
        rel="noopener noreferrer"
      >
        Ver la playlist en YouTube
        <i data-lucide="arrow-up-right"></i>
      </a>
    </section>
  `;

  /** Un solo cableado de DOM por instancia. */
  #wired = false;
  /** El player de YouTube (`YT.Player`), o `null` mientras no exista. */
  #player = null;
  /** ¿La persona ya pidió play? (si toca play antes de que la API esté lista). */
  #quiereSonar = false;
  /** Temporizador del aviso "no se pudo cargar YouTube". */
  #timerEspera = 0;
  /** Vigila que YouTube arranque de verdad después de pedir play. */
  #timerReproduccion = 0;

  /** Escape cierra el panel. keydown llega por documento o por ventana: el
      handler es idempotente, así que escuchamos (y limpiamos) los dos. */
  #onKeydown = (event) => {
    if (event.key !== "Escape" || !this.abierto) return;
    this.abierto = false;
    this.root.querySelector("#radioTrigger")?.focus();
  };

  // --- API explícita: atributos ↔ propiedades -------------------------------
  // El atributo ES el estado: cada `set` escribe el atributo y eso dispara
  // attributeChangedCallback → update().

  /** Panel desplegado o no: atributo booleano `abierto`. */
  get abierto() {
    return this.getAttribute("abierto") !== null;
  }
  set abierto(v) {
    if (v) this.setAttribute("abierto", "");
    else this.removeAttribute("abierto");
  }

  /** Qué está pasando: `apagado` | `cargando` | `sonando` | `pausado` | `parado` | `error`. */
  get estado() {
    return this.getAttribute("estado") ?? "apagado";
  }
  set estado(v) {
    this.setAttribute("estado", v);
  }

  /** Volumen actual, 0–100 (entero: es lo que espera `setVolume`). */
  get volumen() {
    const n = Number.parseFloat(this.getAttribute("volumen") ?? "");
    return Number.isFinite(n)
      ? Math.min(100, Math.max(0, Math.round(n)))
      : VOLUMEN_INICIAL;
  }
  set volumen(v) {
    const n = Math.round(Number(v));
    this.setAttribute("volumen", String(Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : VOLUMEN_INICIAL));
  }

  /** Silenciado: independiente del volumen (atributo booleano `muteado`). */
  get muteado() {
    return this.getAttribute("muteado") !== null;
  }
  set muteado(v) {
    if (v) this.setAttribute("muteado", "");
    else this.removeAttribute("muteado");
  }

  get state() {
    const estado = this.estado;
    const sonando = estado === "sonando";

    return {
      estadoTexto: ESTADO_TEXTO[estado] ?? ESTADO_TEXTO.apagado,
      etiqueta: "Radio",
      etiquetaPlay: sonando ? "Pausar" : "Reproducir",
      etiquetaMute: this.muteado ? "Activar el sonido" : "Silenciar",
      // `abierto` va como string: "" borraría el atributo aria-expanded.
      abierto: this.abierto ? "true" : "false",
      panelOculto: !this.abierto,
      // Pares excluyentes que alternan los dos iconos estáticos de cada botón.
      esSonando: sonando,
      noSonando: !sonando,
      muteado: this.muteado,
      noMuteado: !this.muteado,
    };
  }

  render(_state) {
    // El slider no se pinta por marcadores: es un input, no textContent.
    this.#syncVolumen();
  }

  connectedCallback() {
    super.connectedCallback();

    document.addEventListener("keydown", this.#onKeydown);
    window.addEventListener("keydown", this.#onKeydown);

    if (this.#wired) return;
    this.#wired = true;

    // Nada clave para el arranque: si el template todavía no está, no se cablea
    // nada y queda el panel cerrado.
    if (!this.root.querySelector("#radioPanel") || !this.root.querySelector("#radioTrigger")) return;

    this.root.querySelector("#radioTrigger")?.addEventListener("click", () => {
      this.abierto = !this.abierto;
      if (this.abierto) this.root.querySelector("#radioPlay")?.focus();
      else this.root.querySelector("#radioTrigger")?.focus();
    });

    this.root.querySelector("#radioClose")?.addEventListener("click", () => {
      this.abierto = false;
      this.root.querySelector("#radioTrigger")?.focus();
    });

    this.root.querySelector("#radioPlay")?.addEventListener("click", () => this.#togglePlay());
    this.root.querySelector("#radioStop")?.addEventListener("click", () => this.#parar());

    this.root.querySelector("#radioMute")?.addEventListener("click", () => {
      // El atributo primero (es el estado), el player después. `#conPlayer`
      // tolera que todavía no exista: el botón nunca tira una excepción.
      const silenciar = !this.muteado;
      this.muteado = silenciar;
      this.#conPlayer((p) => (silenciar ? p.mute() : p.unMute()));
    });

    // `input` mientras se arrastra y `change` al soltar: el volumen se aplica
    // igual porque el setter es idempotente.
    const slider = this.root.querySelector("#radioVolume");
    slider?.addEventListener("input", () => {
      this.volumen = slider.value;
      this.#conPlayer((p) => p.setVolume(this.volumen));
    });
    slider?.addEventListener("change", () => {
      this.volumen = slider.value;
      this.#conPlayer((p) => p.setVolume(this.volumen));
    });
  }

  disconnectedCallback() {
    clearTimeout(this.#timerEspera);
    this.#timerEspera = 0;
    clearTimeout(this.#timerReproduccion);
    this.#timerReproduccion = 0;
    document.removeEventListener("keydown", this.#onKeydown);
    window.removeEventListener("keydown", this.#onKeydown);
  }

  // --- Controles ------------------------------------------------------------

  #togglePlay() {
    if (this.estado === "sonando") {
      clearTimeout(this.#timerReproduccion);
      this.#timerReproduccion = 0;
      this.#conPlayer((p) => p.pauseVideo());
      this.estado = "pausado";
      return;
    }
    // Nunca autoplay: llegar acá es consecuencia de un click.
    this.#quiereSonar = true;
    this.#asegurarPlayer();
  }

  #parar() {
    this.#quiereSonar = false;
    clearTimeout(this.#timerReproduccion);
    this.#timerReproduccion = 0;
    this.#conPlayer((p) => p.stopVideo());
    this.estado = "parado";
  }

  /** El slider es un input, no un nodo de texto: no lo pinta un marcador. */
  #syncVolumen() {
    const volumen = this.volumen;
    const slider = this.root.querySelector("#radioVolume");
    if (slider && slider.value !== String(volumen)) slider.value = String(volumen);
    this.#conPlayer((p) => p.setVolume(volumen));
  }

  /**
   * Todo acceso al player pasa por acá: tolera que todavía no exista (los
   * botones funcionan antes de que el reproductor esté listo, sin excepciones)
   * y que el player haya muerto entre que se pidió la acción y se ejecutó.
   */
  #conPlayer(fn) {
    if (!this.#player || typeof this.#player.playVideo !== "function") return;
    try {
      fn(this.#player);
    } catch {
      // El player puede morir entre que se pidió la acción y se ejecutó.
    }
  }

  // --- Integración con YouTube ---------------------------------------------

  /** Crea el player la primera vez; después sólo reusa el que ya existe. */
  #asegurarPlayer() {
    if (this.#player) {
      this.#reanudar();
      return;
    }

    this.estado = "cargando";
    clearTimeout(this.#timerEspera);
    this.#timerEspera = window.setTimeout(() => {
      this.#timerEspera = 0;
      if (!this.#player) this.estado = "error";
    }, ESPERA_API_MS);

    cargarApiYouTube().then(
      (YT) => this.#crearPlayer(YT),
      () => {
        clearTimeout(this.#timerEspera);
        this.#timerEspera = 0;
        this.estado = "error";
      },
    );
  }

  #crearPlayer(YT) {
    // El widget pudo desmontarse mientras cargaba la API.
    if (!this.isConnected) return;
    if (this.#player) return;
    // `new YT.Player` necesita el ELEMENTO, no un id: un id adentro de un
    // shadow root no existe para `document.getElementById`.
    const contenedor = this.root.querySelector("#radioPlayer");
    if (!contenedor) return;

    try {
      this.#player = new YT.Player(contenedor, {
        // playerVars sin `autoplay`: la música arranca con el click (regla 1).
        playerVars: { listType: "playlist", list: PLAYLIST, controls: 1, rel: 0, playsinline: 1, autoplay: 0 },
        origin: ORIGEN_YOUTUBE,
        events: {
          onReady: (event) => this.#onReady(event),
          onStateChange: (event) => this.#onStateChange(event),
          onError: () => this.#onError(),
        },
      });
    } catch {
      this.#player = null;
      this.estado = "error";
    }
  }

  #onReady(event) {
    clearTimeout(this.#timerEspera);
    this.#timerEspera = 0;
    const player = event?.target ?? this.#player;
    this.#player = player;
    this.#conPlayer((p) => p.setVolume(this.volumen));
    if (this.#quiereSonar) this.#reanudar();
    else if (this.estado === "cargando") this.estado = "apagado";
  }

  #reanudar() {
    this.#quiereSonar = true;
    this.estado = "cargando";
    this.#conPlayer((p) => p.playVideo());
    // Si a los pocos segundos YouTube sigue sin reproducir, es que el navegador
    // bloqueó el arranque automático del iframe. Se avisa en vez de dejar la isla
    // en "Cargando…" para siempre, que se ve igual que estar rota.
    clearTimeout(this.#timerReproduccion);
    this.#timerReproduccion = window.setTimeout(() => {
      this.#timerReproduccion = 0;
      if (this.estado === "cargando") this.estado = "bloqueado";
    }, ESPERA_REPRODUCCION_MS);
  }

  #onStateChange(event) {
    if (!this.isConnected) return;
    switch (event?.data) {
      case 1: // playing
        clearTimeout(this.#timerReproduccion);
        this.#timerReproduccion = 0;
        this.estado = "sonando";
        break;
      case 2: // paused
        clearTimeout(this.#timerReproduccion);
        this.#timerReproduccion = 0;
        this.estado = "pausado";
        break;
      case 3: // buffering
      case 5: // cued
        this.estado = "cargando";
        break;
      case 0: // ended: la playlist sigue con el tema siguiente
        this.estado = "sonando";
        break;
      default:
        // -1 (unstarted) y cualquier valor nuevo. "apagado" es el estado PREVIO
        // al click: si ya se pidió música, volver ahí dejaría el cartel diciendo
        // "Dale play y suena" justo después de que la persona tocó play. Se queda
        // en "cargando" y, si YouTube no arranca, el watchdog avisa que está
        // bloqueado.
        this.estado = this.#quiereSonar ? "cargando" : "apagado";
        break;
    }
  }

  #onError() {
    clearTimeout(this.#timerEspera);
    this.#timerEspera = 0;
    this.estado = "error";
  }
}
