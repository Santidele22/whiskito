import { BirritaElement } from "./base-element.js";

export class BirritaNavbar extends BirritaElement {
  static template = /* html */ `
    <!-- ========== NAVBAR ========== -->
    <nav class="navbar">
      <div class="nav-logo">
        <span class="logo-icon">🍺</span>
        <span class="logo-text">Birrita</span>
      </div>
      <ul class="nav-links">
        <li><a href="#donar">Donar</a></li>
        <li><a href="#como-funciona">Cómo funciona</a></li>
        <li><a href="#panel">Mi Panel</a></li>
        <li><a href="#faq">Preguntas</a></li>
      </ul>
      <button id="connectButton" class="btn btn-primary btn-nav">
        🦊 Conectar Wallet
      </button>
    </nav>
  `;
}
