/* ==========================================================================
   jsiniciosesion.js - Inicio de sesión y registro (iniciosesion.html)

   Autenticación contra el servidor (PHP + MySQL):
     - api/registro.php  recibe JSON, guarda el hash BCRYPT de la clave
     - api/login.php     verifica con password_verify() e inicia la sesión PHP
   Ya no se guardan usuarios ni contraseñas en localStorage.

   Los mensajes se escriben con textContent (nunca innerHTML).
   ========================================================================== */
'use strict';

const $ = (selector) => document.querySelector(selector);

const RUTA_LOGIN = 'api/login.php';
const RUTA_REGISTRO = 'api/registro.php';
const MENU_PRINCIPAL = 'menuinicio.html';
const PANTALLA_INICIO = 'index.html';
const MS_MENSAJE_VISIBLE = 4000;
const LARGO_MINIMO_CLAVE = 8;
const MENSAJE_SIN_SERVIDOR = 'No se pudo conectar con el servidor. Verificá que Apache y MySQL estén iniciados.';

/* Muestra un mensaje y lo oculta solo después de unos segundos */
function mostrarMensaje(elemento, texto) {
    elemento.textContent = texto;
    elemento.style.display = 'block';
    clearTimeout(elemento.temporizador);
    elemento.temporizador = setTimeout(() => { elemento.style.display = 'none'; }, MS_MENSAJE_VISIBLE);
}

/* POST con cuerpo JSON. Devuelve { ok, estado, datos } sin lanzar por códigos 4xx/5xx. */
async function enviarJSON(ruta, cuerpo) {
    const respuesta = await fetch(ruta, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(cuerpo)
    });

    let datos = {};
    try {
        datos = await respuesta.json();
    } catch (error) {
        /* La respuesta no traía JSON (ej.: error de Apache): se informa con el código HTTP */
    }
    /* Éxito = código HTTP 2xx Y estado "exito" en el cuerpo (contrato de la API) */
    return { ok: respuesta.ok && datos.estado === 'exito', estado: respuesta.status, datos };
}

/* ---------------- Inicio de sesión ---------------- */
async function login(evento) {
    evento.preventDefault();

    const boton = $('#login-form-element input[type="submit"]');
    const errorMessage = $('#error-message');
    boton.disabled = true;

    try {
        const respuesta = await enviarJSON(RUTA_LOGIN, {
            email: $('#email').value.trim(),
            password: $('#password').value
        });

        if (respuesta.ok) {
            window.location.href = MENU_PRINCIPAL;
            return;
        }
        mostrarMensaje(errorMessage, respuesta.datos.mensaje || `No se pudo iniciar sesión (HTTP ${respuesta.estado})`);
    } catch (error) {
        console.error(error);
        mostrarMensaje(errorMessage, MENSAJE_SIN_SERVIDOR);
    } finally {
        boton.disabled = false;
    }
}

/* ---------------- Registro ---------------- */
async function register(evento) {
    evento.preventDefault();

    const nombre = $('#register-name').value.trim();
    const email = $('#register-email').value.trim();
    const password = $('#register-password').value;
    const confirmPassword = $('#confirm-password').value;
    const registerMessage = $('#register-message');
    const boton = $('#register-form-element input[type="submit"]');

    /* Validaciones de comodidad (el servidor vuelve a validar todo) */
    if (password !== confirmPassword) {
        mostrarMensaje(registerMessage, 'Las contraseñas no coinciden');
        return;
    }
    if (password.length < LARGO_MINIMO_CLAVE) {
        mostrarMensaje(registerMessage, `La contraseña debe tener al menos ${LARGO_MINIMO_CLAVE} caracteres`);
        return;
    }

    boton.disabled = true;
    try {
        const registro = await enviarJSON(RUTA_REGISTRO, { nombre, email, password });
        if (!registro.ok) {
            mostrarMensaje(registerMessage, registro.datos.mensaje || `No se pudo registrar (HTTP ${registro.estado})`);
            return;
        }

        /* Registro correcto: se inicia sesión automáticamente con las mismas credenciales */
        const acceso = await enviarJSON(RUTA_LOGIN, { email, password });
        if (acceso.ok) {
            window.location.href = MENU_PRINCIPAL;
            return;
        }
        mostrarMensaje(registerMessage, 'Usuario registrado. Ahora iniciá sesión.');
        mostrarFormularioLogin();
    } catch (error) {
        console.error(error);
        mostrarMensaje(registerMessage, MENSAJE_SIN_SERVIDOR);
    } finally {
        boton.disabled = false;
    }
}

/* ---------------- Navegación entre formularios ---------------- */
function mostrarFormularioRegistro() {
    $('#login-form').style.display = 'none';
    $('#registration-form').style.display = 'block';
}

function mostrarFormularioLogin() {
    $('#registration-form').style.display = 'none';
    $('#login-form').style.display = 'block';
}

function volverAlInicio() {
    window.location.href = PANTALLA_INICIO;
}

/* ---------------- Registro de eventos ---------------- */
$('#login-form-element').addEventListener('submit', login);
$('#register-form-element').addEventListener('submit', register);
$('[data-accion="mostrar-registro"]').addEventListener('click', mostrarFormularioRegistro);
document.querySelectorAll('[data-accion="volver"]').forEach((boton) => {
    boton.addEventListener('click', volverAlInicio);
});
