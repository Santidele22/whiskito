import { BirritaElement } from "./base-element.js";

export class BirritaHero extends BirritaElement {
  static template = /* html */ `
    <!-- ============================================================
     1. HERO
     ============================================================ -->
    <section class="hero">
      <div class="bubbles" aria-hidden="true">
        <span></span><span></span><span></span> <span></span><span></span
        ><span></span>
      </div>

      <div class="hero-inner">
        <div class="hero-copy">
          <p class="hero-badge">
            ⚡ Como Cafecito, pero en
            <span
              class="tt"
              tabindex="0"
              data-tip="Blockchain = un registro público y compartido donde cada movimiento queda grabado para siempre y nadie puede editarlo ni borrarlo."
              >blockchain</span
            >
          </p>

          <h1 class="hero-title">
            Invitame una <span class="highlight">birrita</span> 🍺
          </h1>

          <p class="hero-subtitle">
            Birrita es la forma más simple de decirle
            <em>"gracias, ¡buen trabajo!"</em>
            a quien quieras: una pequeña donación en ETH que viaja directo de tu
            <span
              class="tt"
              tabindex="0"
              data-tip="Wallet = tu cuenta de cripto. Una app gratuita (como MetaMask) que guarda tus fondos y te identifica. No necesita email ni contraseña."
              >wallet</span
            >
            a la suya. Sin registrarte, sin comisiones, sin empresas en el
            medio.
          </p>

          <div class="hero-actions">
            <a href="#donar" class="btn btn-primary btn-lg"
              >🍺 Quiero invitar una birra</a
            >
            <a href="#recibir" class="btn btn-outline btn-lg"
              >💸 Quiero recibir donaciones</a
            >
          </div>

          <div class="hero-trust">
            <span><i class="tick">✓</i> 0% de comisión</span>
            <span
              ><i class="tick">✓</i> Directo a la wallet de quien recibe</span
            >
            <span><i class="tick">✓</i> Todo público y verificable</span>
          </div>
        </div>

        <div class="hero-visual" aria-hidden="true">
          <div class="beer-glow">🍺</div>

          <div class="float-card main-card">
            <p class="mc-label">Así se ve una birra recibida</p>
            <div class="mc-row">
              <div class="mc-who">
                <div class="mc-avatar">🍺</div>
                <div>
                  <code>0x7a3f...9c2e</code>
                  <p class="mc-action">te invitó una birra</p>
                </div>
              </div>
              <div class="mc-amount">
                <strong>0.0015 ETH</strong>
                <span>≈ $5.00 USD</span>
              </div>
            </div>
            <p class="mc-time">hace 2 min · confirmada ✅</p>
          </div>

          <div class="float-card chip-a">
            ⛓️ Grabada en la blockchain, para siempre
          </div>
          <div class="float-card chip-b">
            🦊 <code>0x3f...b8a1</code> conectó su wallet
          </div>
        </div>
      </div>

      <div class="hero-stats">
        <div class="stat"><b>0%</b><span>comisión de plataforma</span></div>
        <div class="stat"><b>100%</b><span>público y verificable</span></div>
        <div class="stat"><b>~12s</b><span>en confirmarse</span></div>
        <div class="stat"><b>0.5 USD</b><span>mínimo por birra</span></div>
      </div>
    </section>
  `;
}
