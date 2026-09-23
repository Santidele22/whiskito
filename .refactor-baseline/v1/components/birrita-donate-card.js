import { BirritaElement } from "./base-element.js";

export class BirritaDonateCard extends BirritaElement {
  static template = /* html */ `
          <div class="donate-card">
            <div class="card-glow" aria-hidden="true"></div>

            <h3 class="card-title">Así se ve invitar 🍻</h3>
            <p class="card-subtitle">
              Probalo: elegí un monto rápido o escribí el tuyo.
            </p>

            <div class="quick-amounts">
              <button class="chip" data-usd="0.5">🥜 Birra chica</button>
              <button class="chip" data-usd="1">🍺 Una birra</button>
              <button class="chip" data-usd="5">🍻 Una ronda</button>
              <button class="chip" data-usd="20">🍾 Joda completa</button>
            </div>

            <div class="input-group">
              <label for="ehtAmount" class="input-label">Monto en ETH</label>
              <div class="input-wrapper">
                <span class="input-currency">Ξ</span>
                <input
                  type="number"
                  id="ehtAmount"
                  placeholder="0.0002"
                  min="0"
                  step="0.0001"
                  autocomplete="off"
                />
                <span class="usd-equiv" id="usdEquivalent">≈ $0.00 USD</span>
              </div>
            </div>

            <button id="fundButton" class="btn btn-primary btn-lg btn-block">
              🍺 Invitar una Birrita
            </button>

            <div id="txStatus" class="tx-status" hidden>
              <span class="tx-spinner" aria-hidden="true"></span>
              <span class="tx-text" id="txText">Procesando transacción...</span>
            </div>

            <p class="card-footnote">
              🔒 Mínimo: 0.5 USD, calculado con el precio en tiempo real de un
              <span
                class="tt"
                tabindex="0"
                data-tip="Oráculo = un servicio que trae datos del mundo real (como el precio del dólar) adentro de la blockchain, de forma confiable y verificable."
                >oráculo</span
              >
              on-chain.
            </p>
          </div>
  `;
}
