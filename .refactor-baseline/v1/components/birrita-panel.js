import { BirritaElement } from "./base-element.js";

export class BirritaPanel extends BirritaElement {
  static template = /* html */ `
    <!-- ============================================================
     3. TU PANEL
     ============================================================ -->
    <section class="section" id="panel">
      <div class="panel-split">
        <div class="panel-copy">
          <span class="eyebrow">02 · tu barra</span>
          <h2>Tu panel, tus fondos, tu control 🏠</h2>
          <p>
            Conectás tu wallet y aparece tu barra personal. Solo ves lo tuyo:
          </p>

          <ul class="panel-points">
            <li>
              <span class="pp-icon">💰</span>
              <div>
                <b>Cuánto te donaron en total</b>
                <span class="d"
                  >El acumulado de todas las birras que te invitaron.</span
                >
              </div>
            </li>
            <li>
              <span class="pp-icon">📜</span>
              <div>
                <b>Quién te invitó, y cuándo</b>
                <span class="d"
                  >Historial completo con montos y sus equivalentes en
                  dólares.</span
                >
              </div>
            </li>
            <li>
              <span class="pp-icon">💸</span>
              <div>
                <b>Cuánto tenés disponible ahora mismo</b>
                <span class="d"
                  >Listo para retirar, total o parcialmente, cuando se te
                  cante.</span
                >
              </div>
            </li>
          </ul>

          <div class="panel-note">
            <span>🔐</span>
            <p>
              <b>Privado para operar, público para verificar.</b>
              Retirar solo puede hacerlo el dueño de la wallet. Que los datos
              sean públicos en la blockchain (cualquiera puede auditarlos) no
              significa que alguien más pueda mover tus fondos. Tus birras, tus
              reglas.
            </p>
          </div>
        </div>

        <!-- Mockup estático del panel -->
        <div class="panel-demo" aria-hidden="true">
          <span class="pd-eyebrow"
            >💰 Balance disponible
            <span class="pd-badge">vista previa</span></span
          >
          <p class="pd-balance">
            <span id="balanceDisplay">0.0842</span>
            <span class="balance-unit">ETH</span>
          </p>
          <p class="pd-usd" id="balanceUsd">≈ $269.44 USD</p>

          <p class="pd-history-title">📜 Últimas birras recibidas</p>

          <div id="donationsList">
            <div class="pd-item">
              <code>0x7a3f...9c2e</code>
              <span class="amt">+0.005 ETH <small>≈ $16</small></span>
              <span class="when">hace 2 min</span>
            </div>
            <div class="pd-item">
              <code>0x1b9e...44f0</code>
              <span class="amt">+0.0025 ETH <small>≈ $8</small></span>
              <span class="when">ayer</span>
            </div>
            <div class="pd-item">
              <code>0x9c21...aa77</code>
              <span class="amt">+0.0015 ETH <small>≈ $5</small></span>
              <span class="when">hace 3 días</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}
