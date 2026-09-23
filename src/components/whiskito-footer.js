import { WhiskitoElement } from "./base-element.js";

export class WhiskitoFooter extends WhiskitoElement {
  static template = /* html */ `
    <!-- ============================================================
     6. FOOTER — PIE DE CARTEL
     ============================================================ -->
    <footer class="footer">
      <div class="footer-inner">
        <div class="footer-brand">
          <div class="footer-logo"><i data-lucide="glass-water"></i> Whiskito</div>
          <p class="footer-tagline">
            Hecho con ETH y buen rollito. No hay plataforma que se quede con tu
            whiskito: el apoyo va directo de wallet a wallet.
          </p>
        </div>
        <nav class="footer-links">
          <a href="#donar">Donar</a>
          <a href="#como-funciona">Cómo funciona</a>
          <a href="#panel">Mi Panel</a>
          <a href="#faq">Preguntas frecuentes</a>
          <a href="#" target="_blank" rel="noopener"
            >Contrato verificado en Etherscan <i data-lucide="arrow-up-right"></i></a
          >
        </nav>
      </div>

      <p class="footer-warning">
        <i data-lucide="triangle-alert"></i> <b>Importante:</b> las donaciones en cripto son irreversibles. Una
        vez confirmada, una ronda no se puede recuperar. Doná con cabeza,
        whiskitero.
      </p>

      <p class="footer-copy">
        Whiskito · Donaciones en ETH para profesionales independientes · El
        contrato es público y auditable por cualquiera
      </p>
    </footer>
  `;
}
