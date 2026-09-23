import { WhiskitoElement } from "./base-element.js";

export class WhiskitoTrust extends WhiskitoElement {
  static template = /* html */ `
    <!-- ============================================================
     4. SEGURIDAD — LA ETIQUETA DE LA BOTELLA
     ============================================================ -->
    <section class="section">
      <div class="trust-grid">
        <div class="trust-head">
          <span class="eyebrow">03 · La etiqueta</span>
          <h2>Lo que dice la etiqueta</h2>
          <p>
            Estas garantías no son promesas de marketing: están escritas en el
            código que maneja los whiskitos, y nadie puede cambiarlas por detrás.
          </p>
        </div>

        <ul class="trust-list">
          <li>
            <span class="trust-num">01</span>
            <div>
              <h4>Solo el dueño toca sus fondos</h4>
              <p>
                El código que gestiona los whiskitos no le permite a nadie mover
                tu dinero: ni a otro usuario, ni a Whiskito. Tu wallet es la
                única llave que abre esa caja.
              </p>
            </div>
          </li>
          <li>
            <span class="trust-num">02</span>
            <div>
              <h4>Mínimo: 0.01 USD por donación</h4>
              <p>
                Toda ronda tiene un piso equivalente a un centavo de dólar. Así se evitan
                donaciones vacías y errores de tipeo del estilo "quería poner 5 y
                puse 0.05".
              </p>
            </div>
          </li>
          <li>
            <span class="trust-num">03</span>
            <div>
              <h4>Precio real, nunca viejo</h4>
              <p>
                La conversión POL → dólares no la decidimos nosotros: viene de un
                <span
                  class="tt"
                  tabindex="0"
                  data-tip="Oráculo = un servicio confiable que publica datos del mundo real (como precios) dentro de la blockchain, y todos pueden verificar de dónde salen."
                  >oráculo</span
                >
                (una fuente de precios confiable y verificada en tiempo real). Si
                el dato está desactualizado, la operación simplemente no se hace.
              </p>
            </div>
          </li>
          <li>
            <span class="trust-num">04</span>
            <div>
              <h4>Todo queda a la vista</h4>
              <p>
                Cada donación queda grabada en la blockchain: un registro público
                que nadie puede editar ni borrar. ¿Querés comprobarlo? Cada
                movimiento tiene su enlace a
                <span
                  class="tt"
                  tabindex="0"
                  data-tip="Etherscan = el buscador de transacciones de Ethereum. Typeás una dirección y ves todo su historial, como un extracto bancario público."
                  >Etherscan</span
                >, el buscador de transacciones de Ethereum.
              </p>
            </div>
          </li>
        </ul>
      </div>
    </section>
  `;
}
