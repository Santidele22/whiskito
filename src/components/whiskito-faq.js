import { WhiskitoElement } from "./base-element.js";

export class WhiskitoFaq extends WhiskitoElement {
  static template = /* html */ `
    <!-- ============================================================
     5. FAQ — PREGUNTAS DEL PÚBLICO
     ============================================================ -->
    <section class="faq-section" id="faq">
      <div class="section">
        <div class="faq-wrap">
          <div class="faq-intro">
            <span class="eyebrow" style="justify-content: center"
              >04 · Preguntas</span
            >
            <h2>Preguntas del público</h2>
            <p>
              Las dudas que todos tenemos la primera vez, respondidas sin
              tecnicismos.
            </p>
          </div>

          <details>
            <summary>¿Qué es una wallet y cómo consigo una?</summary>
            <p>
              Una <b>wallet</b> (billetera) es una app que guarda tus
              criptomonedas y te identifica: es tu cuenta, tu firma y tu bóveda,
              todo en uno. La más popular es <b>MetaMask</b>: es gratis, se
              instala como extensión de navegador (también hay para celular) y te
              guía paso a paso al crearla. Una vez lista, volvés a Whiskito,
              tocás "Conectar Wallet" y listo: esa es tu identidad acá.
            </p>
          </details>

          <details>
            <summary>¿Necesito registrarme con email?</summary>
            <p>
              <b>No.</b> Ni email, ni contraseña, ni datos personales. Tu wallet
              <b>es</b> tu cuenta: la conectás y ya estás adentro. Menos
              formularios, menos contraseñas que olvidar, y ningún dato tuyo
              guardado en nuestros servidores (porque ni siquiera los pedimos).
            </p>
          </details>

          <details>
            <summary>¿Qué pasa si dono por error?</summary>
            <p>
              Las donaciones en blockchain son <b>irreversibles</b>: una vez
              confirmadas, no se pueden cancelar ni devolver automáticamente —
              para nadie. Por eso la interfaz te muestra el equivalente en
              dólares <b>antes</b> de confirmar, y tu wallet te pide confirmar de
              nuevo. Si igual te equivocaste, lo único posible es contactar a la
              persona y contarle: que te devuelva el whiskito es su decisión.
            </p>
          </details>

          <details>
            <summary>¿Hay algún costo aparte del monto que dono?</summary>
            <p>
              Whiskito cobra <b>0% de comisión</b>: el 100% de tu donación llega
              a quien la recibe. Pero existe algo llamado <b>gas</b> (una pequeña
              tarifa que cobra la red Polygon por procesar cada transacción — va
              para la red, no para nosotros). Tu wallet siempre te muestra el
              costo total antes de confirmar: sin sorpresas.
            </p>
          </details>

          <details>
            <summary>¿Cómo sé que el dinero llegó de verdad?</summary>
            <p>
              Porque queda <b>grabado en la blockchain</b>: un libro contable
              público que nadie puede editar ni borrar. En segundos ves tu
              donación confirmada, con un enlace a <b>Polygonscan</b> (el buscador
              de Polygon), donde podés ver la transacción tal como quedó
              registrada. Para siempre. Sin pedirle a nadie que te crea: está a
              la vista de todos.
            </p>
          </details>
        </div>
      </div>
    </section>
  `;
}
