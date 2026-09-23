import { BirritaElement } from "./base-element.js";

export class BirritaFooter extends BirritaElement {
  static template = /* html */ `
    <!-- ============================================================
     6. FOOTER
     ============================================================ -->
    <footer class="footer">
      <div class="footer-inner">
        <div class="footer-brand">
          <div class="footer-logo">🍺 Birrita</div>
          <p class="footer-tagline">
            Hecho con ETH y buen rollito. No hay plataforma que se quede con tu
            birra: el apoyo va directo de wallet a wallet.
          </p>
        </div>
        <nav class="footer-links">
          <a href="#donar">Donar</a>
          <a href="#como-funciona">Cómo funciona</a>
          <a href="#panel">Mi Panel</a>
          <a href="#faq">Preguntas frecuentes</a>
          <a href="#" target="_blank" rel="noopener"
            >Contrato verificado en Etherscan ↗</a
          >
        </nav>
      </div>

      <p class="footer-warning">
        ⚠️ <b>Importante:</b> las donaciones en cripto son irreversibles. Una
        vez confirmada, una birra no se puede recuperar. Doná con cabeza,
        birrero.
      </p>

      <p class="footer-copy">
        Birrita · Donaciones en ETH para profesionales independientes · El
        contrato es público y auditable por cualquiera
      </p>
    </footer>
  `;
}
