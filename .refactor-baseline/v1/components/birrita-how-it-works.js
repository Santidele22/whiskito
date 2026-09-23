import { BirritaElement } from "./base-element.js";

export class BirritaHowItWorks extends BirritaElement {
  static template = /* html */ `
    <!-- ============================================================
     2. CÓMO FUNCIONA — dos públicos, dos tracks
     ============================================================ -->
    <section class="section section--band" id="como-funciona">
      <div class="section-head">
        <span class="eyebrow">01 · cómo funciona</span>
        <h2>Simple para los dos lados de la birra</h2>
        <p>
          Nunca usaste cripto? No importa: acá está todo explicado sin vueltas.
          Elegí tu equipo — invitar o recibir — y seguí los tres pasos.
        </p>
      </div>

      <!-- ---- TRACK A: RECIBIR ---- -->
      <div class="track" id="recibir">
        <div class="track-head">
          <h3>💸 Querés recibir birras</h3>
          <span
            >para diseñadores, devs, escritores, artistas y cualquier
            profesional</span
          >
        </div>

        <div class="timeline">
          <span class="timeline-dot td-1"></span>
          <span class="timeline-dot td-2"></span>
          <span class="timeline-dot td-3"></span>

          <article class="step step-1">
            <span class="step-ghost">01</span>
            <div class="step-emoji">🦊</div>
            <h4>Conectá tu wallet</h4>
            <p>
              Una
              <span
                class="tt"
                tabindex="0"
                data-tip="Wallet = tu cuenta de cripto. Guarda tus fondos y te identifica. La más conocida es MetaMask, gratis, como extensión de navegador."
                >wallet</span
              >
              es tu cuenta de cripto: una app gratuita (como MetaMask) que
              guarda tus fondos y te identifica. Nada de email ni contraseña: si
              tenés la wallet, tenés la cuenta.
            </p>
          </article>

          <article class="step step-2">
            <span class="step-ghost">02</span>
            <div class="step-emoji">🔗</div>
            <h4>Copiá y compartí tu link</h4>
            <p>
              Al conectar tu wallet se genera tu página personal:
              <code>birrita.app/u/tu-wallet</code>. Pegala en tu bio, tus redes
              o tu firma de mail. ¿En persona? Compartí tu código QR y que te
              escaneen al toque.
            </p>
          </article>

          <article class="step step-3">
            <span class="step-ghost">03</span>
            <div class="step-emoji">🏧</div>
            <h4>Retirá cuando quieras</h4>
            <p>
              Todo de una o en partes, vos decidís cuándo. Y tranquilo: solo
              vos, con tu wallet, podés retirar tus fondos. Nadie más puede
              tocarlos — ni siquiera nosotros.
            </p>
          </article>
        </div>
      </div>

      <!-- ---- TRACK B: DONAR ---- -->
      <div class="track" id="donar">
        <div class="track-head">
          <h3>🍺 Querés invitar una birra</h3>
          <span>al que hizo el trabajo que te gustó</span>
        </div>

        <div class="donate-track">
          <ul class="steps-v">
            <li>
              <span class="step-num">1</span>
              <div>
                <h4>Entrá al link de la persona</h4>
                <p>
                  Cada quien tiene su propia página:
                  <code>birrita.app/u/su-wallet</code>. Ahí está todo listo para
                  invitarle una birra.
                </p>
              </div>
            </li>
            <li>
              <span class="step-num">2</span>
              <div>
                <h4>Elegí cuánto invitás</h4>
                <p>
                  Conectá tu wallet, poné el monto en
                  <span
                    class="tt"
                    tabindex="0"
                    data-tip="ETH = la moneda de Ethereum, la red blockchain más usada del mundo. 1 ETH ≈ unos pocos miles de dólares, pero podés donar fracciones mínimas."
                    >ETH</span
                  >
                  (la moneda de Ethereum) y mirá el equivalente en dólares al
                  lado: sabés exactamente cuánto estás invitando
                  <strong>antes</strong> de confirmar.
                </p>
              </div>
            </li>
            <li>
              <span class="step-num">3</span>
              <div>
                <h4>Confirmá y listo</h4>
                <p>
                  Tu donación queda grabada en la
                  <span
                    class="tt"
                    tabindex="0"
                    data-tip="Blockchain = un registro público que nadie puede editar. Cada donación queda ahí para siempre, como un recibo digital que cualquiera puede consultar."
                    >blockchain</span
                  >
                  en segundos: es pública y cualquiera puede verificarla. Eso
                  sí, en cripto no hay botón de arrepentimiento: la donación es
                  irreversible.
                </p>
              </div>
            </li>
          </ul>

          <!-- Demo card funcional-ready (IDs intactos para tu JS) -->
          <birrita-donate-card></birrita-donate-card>
        </div>
      </div>
    </section>
  `;
}
