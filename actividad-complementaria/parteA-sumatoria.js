/* ==========================================================================
   parteA-sumatoria.js - Actividad complementaria, Parte A
   El HTML no contiene JavaScript: este archivo se enlaza con <script defer>.
   ========================================================================== */
'use strict';

/* ============================================================
   Paso 1: capturar el evento del usuario.
   addEventListener escucha el clic sobre el botón; el código
   dentro de la función solo se ejecuta cuando el evento ocurre,
   sin recargar la página.
   ============================================================ */
document.querySelector('#btnCalcular').addEventListener('click', () => {

    /* Paso 2: leer los datos de entrada.
       .value siempre devuelve texto (string), por eso se convierte
       a número con Number() antes de operar. */
    const valor1 = Number(document.querySelector('#valor1').value);
    const valor2 = Number(document.querySelector('#valor2').value);

    /* Paso 3: calcular la sumatoria.
       "total" vive únicamente en la memoria RAM mientras dura la función. */
    const total = valor1 + valor2;

    /* Paso 4: evaluar el signo del resultado. */
    let mensaje;
    let clase;

    if (total > 0) {
        mensaje = `${total} (positivo)`;
        clase = 'positivo';
    } else if (total < 0) {
        mensaje = `${total} (negativo)`;
        clase = 'negativo';
    } else {
        mensaje = `${total} (cero)`;
        clase = 'cero';
    }

    /* Paso 5: inyectar el resultado en el árbol DOM (solo se modifica
       el <span id="resultado">, sin recargar la pestaña). */
    const resultadoSpan = document.querySelector('#resultado');
    resultadoSpan.textContent = mensaje;
    resultadoSpan.className = clase;
});
