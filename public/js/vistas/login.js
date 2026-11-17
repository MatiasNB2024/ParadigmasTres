/* ============================================================
   Vista pública: bienvenida, iniciar sesión y registro
   Caso de Uso: "Iniciar sesión"
   (evolución de index.html e iniciosesion.html de la AE1)
   ============================================================ */

import { api, ErrorApi } from '../api.js';
import { Sesion } from '../sesion.js';
import { $, anunciar, clonarPlantilla, datosFormulario, marcarEnviando, mostrarMensaje } from '../ui.js';

export async function montar(contenedor, contexto) {
    contenedor.replaceChildren(clonarPlantilla('tpl-login'));

    const formLogin = $('#form-login', contenedor);
    const formRegistro = $('#form-registro', contenedor);
    const mensajeLogin = $('#login-mensaje', contenedor);

    const pendiente = contexto.tomarMensajeParaLogin();
    if (pendiente) mostrarMensaje(mensajeLogin, pendiente, 'info');

    formLogin.addEventListener('submit', (evento) => alIniciarSesion(evento, contexto));
    formRegistro.addEventListener('submit', alRegistrarse);
    contenedor.addEventListener('click', (evento) => {
        const boton = evento.target.closest('[data-accion]');
        if (!boton) return;
        if (boton.dataset.accion === 'mostrar-registro') mostrarPanel(contenedor, 'registro');
        if (boton.dataset.accion === 'mostrar-login') mostrarPanel(contenedor, 'login');
    });
}

function mostrarPanel(contenedor, cual) {
    $('#panel-login', contenedor).hidden = cual !== 'login';
    $('#panel-registro', contenedor).hidden = cual !== 'registro';
    // El foco va al primer campo del panel visible.
    $(cual === 'login' ? '#login-email' : '#registro-nombre', contenedor).focus();
}

async function alIniciarSesion(evento, contexto) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const mensaje = $('#login-mensaje', formulario);
    const { email, password } = datosFormulario(formulario);

    if (!email.trim() || !password) {
        mostrarMensaje(mensaje, 'Ingresá tu correo y tu contraseña.', 'error');
        return;
    }

    marcarEnviando(formulario, true);
    mostrarMensaje(mensaje, 'Verificando…', 'info');
    try {
        await api.login(email.trim(), password);
        await Sesion.cargar();
        contexto.actualizarEncabezado();
        anunciar(`Sesión iniciada. Hola, ${Sesion.usuario().nombre}.`);
        contexto.navegar('/inicio');
    } catch (error) {
        const texto = error instanceof ErrorApi ? error.message : 'No se pudo iniciar sesión.';
        mostrarMensaje(mensaje, texto, 'error');
        $('#login-password', formulario).value = '';
        marcarEnviando(formulario, false);
    }
}

async function alRegistrarse(evento) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const mensaje = $('#registro-mensaje', formulario);
    const datos = datosFormulario(formulario);

    // Validación de comodidad en el cliente; la definitiva la hace el servidor.
    if (!datos.nombre.trim() || !datos.email.trim() || !datos.password) {
        mostrarMensaje(mensaje, 'Completá todos los campos.', 'error');
        return;
    }
    if (datos.password.length < 8) {
        mostrarMensaje(mensaje, 'La contraseña debe tener al menos 8 caracteres.', 'error');
        return;
    }
    if (datos.password !== datos.confirmar) {
        mostrarMensaje(mensaje, 'Las contraseñas no coinciden.', 'error');
        return;
    }

    marcarEnviando(formulario, true);
    try {
        await api.registro({ nombre: datos.nombre.trim(), email: datos.email.trim(), password: datos.password });
        const contenedor = formulario.closest('.pagina-login');
        formulario.reset();
        mostrarPanel(contenedor, 'login');
        $('#login-email', contenedor).value = datos.email.trim();
        $('#login-password', contenedor).focus();
        mostrarMensaje($('#login-mensaje', contenedor), 'Cuenta creada. Ya podés iniciar sesión.', 'ok');
    } catch (error) {
        mostrarMensaje(mensaje, error instanceof ErrorApi ? error.message : 'No se pudo registrar.', 'error');
    } finally {
        marcarEnviando(formulario, false);
    }
}
