/* ==========================================================================
   jsiniciosesion.js - Inicio de sesión y registro (iniciosesion.html)
   Antes este código estaba dentro de <script> en el HTML y se enlazaba con
   atributos onsubmit / onclick. Ahora el HTML solo tiene estructura y los
   eventos se registran acá con addEventListener().
   ========================================================================== */
'use strict';

const $ = (selector) => document.querySelector(selector);

const MENU_PRINCIPAL = 'menuinicio.html';
const PANTALLA_INICIO = 'index.html';
const MS_MENSAJE_VISIBLE = 3000;

/* Muestra un mensaje de error y lo oculta solo después de unos segundos */
function mostrarMensaje(elemento, texto) {
    elemento.textContent = texto;
    elemento.style.display = 'block';
    setTimeout(() => { elemento.style.display = 'none'; }, MS_MENSAJE_VISIBLE);
}

function leerUsuarios() {
    return JSON.parse(localStorage.getItem('users')) || [];
}

/* Función de inicio de sesión */
function login(evento) {
    evento.preventDefault();

    const email = $('#email').value;
    const password = $('#password').value;
    const errorMessage = $('#error-message');

    /* Buscar el usuario por correo y contraseña entre los registrados */
    const user = leerUsuarios().find((u) => u.email === email && u.password === password);

    if (!user) {
        mostrarMensaje(errorMessage, 'Usuario o contraseña incorrectos');
        return;
    }

    /* Guardar el correo del usuario actual en sessionStorage */
    sessionStorage.setItem('currentUser', email);
    window.location.href = MENU_PRINCIPAL;
}

/* Alterna entre el formulario de login y el de registro */
function mostrarFormularioRegistro() {
    $('#login-form').style.display = 'none';
    $('#registration-form').style.display = 'block';
}

/* Función de registro de usuario */
function register(evento) {
    evento.preventDefault();

    const email = $('#register-email').value;
    const password = $('#register-password').value;
    const confirmPassword = $('#confirm-password').value;
    const registerMessage = $('#register-message');

    if (password !== confirmPassword) {
        mostrarMensaje(registerMessage, 'Las contraseñas no coinciden');
        return;
    }

    const users = leerUsuarios();

    if (users.find((u) => u.email === email)) {
        mostrarMensaje(registerMessage, 'El correo electrónico ya está registrado');
        return;
    }

    users.push({ email, password });
    localStorage.setItem('users', JSON.stringify(users));

    alert('Usuario registrado exitosamente');
    sessionStorage.setItem('currentUser', email);
    window.location.href = MENU_PRINCIPAL;
}

/* Volver a la pantalla de bienvenida */
function volverAlInicio() {
    window.location.href = PANTALLA_INICIO;
}

/* ---------------- Registro de eventos ---------------- */
$('#login-form-element').addEventListener('submit', login);
$('#register-form-element').addEventListener('submit', register);

/* Los botones se identifican por data-accion: un solo recorrido para ambos "Volver atrás" */
$('[data-accion="mostrar-registro"]').addEventListener('click', mostrarFormularioRegistro);
document.querySelectorAll('[data-accion="volver"]').forEach((boton) => {
    boton.addEventListener('click', volverAlInicio);
});
