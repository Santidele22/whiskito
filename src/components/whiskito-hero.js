import { WhiskitoElement } from "./base-element.js";

export class WhiskitoHero extends WhiskitoElement {
  static template = /* html */ `
    <!-- ============================================================
     1. HERO — EL CARTEL
     ============================================================ -->
    <section class="hero">
      <div class="marquee" aria-hidden="true">
        <i></i>
        <i></i>
        <i></i>
        <i></i>
        <i></i>
        <i></i>
        <i></i>
        <i></i>
        <i></i>
        <i></i>
        <i></i>
        <i></i>
        <i></i>
        <i></i>
        <i></i>
        <i></i>
        <i></i>
        <i></i>
        <i></i>
        <i></i>
        <i></i>
        <i></i>
        <i></i>
        <i></i>
        <i></i>
        <i></i>
        <i></i>
        <i></i>
        <i></i>
        <i></i>
      </div>

      <div class="hero-inner">
        <div class="hero-copy">
          <p class="hero-badge">★ Esta noche: gracias, buen trabajo ★</p>

          <h1 class="hero-title">
            Invitame un <span class="fill-red">Whiskito</span>
          </h1>

          <p class="hero-subtitle">
            Una pequeña donación en <em>ETH</em> que viaja directo de tu
            <span
              class="tt"
              tabindex="0"
              data-tip="Wallet = tu cuenta de cripto. Una app gratuita (como MetaMask) que guarda tus fondos y te identifica. No necesita email ni contraseña."
              >wallet</span
            >
            a la de quien te gusta apoyar. Servido neat:
            <em>sin nadie en el medio</em>. Sin registro, sin comisiones, sin
            empresas cobrando entrada.
          </p>

          <div class="hero-actions">
            <a href="#donar" class="btn btn-primary btn-lg"
              ><i data-lucide="glass-water"></i> Quiero invitar un whisky</a
            >
            <a href="#recibir" class="btn btn-outline btn-lg"
              ><i data-lucide="hand-coins"></i> Quiero recibir donaciones</a
            >
          </div>

          <div class="hero-trust">
            <span><i class="tick" data-lucide="check"></i> 0% de comisión</span>
            <span
              ><i class="tick" data-lucide="check"></i> Directo a la wallet de quien recibe</span
            >
            <span><i class="tick" data-lucide="check"></i> Todo público y verificable</span>
          </div>
        </div>

        <div class="hero-visual" aria-hidden="true">
          <div class="vinyl"></div>
          <div class="glass-glow"><i data-lucide="glass-water"></i></div>

          <div class="float-card main-card">
            <p class="mc-label">★ Última ronda</p>
            <div class="mc-row">
              <div class="mc-who">
                <div class="mc-avatar"><i data-lucide="glass-water"></i></div>
                <div>
                  <code>0x7a3f...9c2e</code>
                  <p class="mc-action">te invitó un whisky</p>
                </div>
              </div>
              <div class="mc-amount">
                <strong>0.0015 ETH</strong>
                <span>≈ $5.00 USD</span>
              </div>
            </div>
            <p class="mc-time">hace 2 min · confirmado <i data-lucide="circle-check"></i></p>
          </div>

          <div class="float-card chip-a">
            <i data-lucide="database"></i> Archivado en la blockchain
          </div>
          <div class="float-card chip-b">
            <i data-lucide="wallet"></i> <code>0x3f...b8a1</code> llegó al club
          </div>

          <div class="stamp-seal">Sin comisión<br />0%<br />★</div>
        </div>
      </div>

      <div class="hero-stats">
        <div class="stat"><b>0%</b><span>comisión de plataforma</span></div>
        <div class="stat"><b>100%</b><span>público y verificable</span></div>
        <div class="stat"><b>~12s</b><span>en confirmarse</span></div>
        <div class="stat"><b>0.5 USD</b><span>mínimo por sorbo</span></div>
      </div>
    </section>
  `;
}
