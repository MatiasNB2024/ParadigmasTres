/* ============================================================
   app.js — Punto de entrada de la Single Page Application

   Es el único script que carga index.html. Se encarga de:
     - Consultar la sesión al servidor (api/perfil.php).
     - Enrutar: cada vista se identifica con el hash de la URL (#/stock,
       #/movimientos...). Cambiar de vista NO recarga la página: se clona
       la plantilla correspondiente y se piden los datos con fetch().
     - Proteger las rutas: sin sesión, solo se ve #/login. Las rutas de
       administrador se ocultan al empleado (y la API igual lo rechaza con 403).
     - Accesibilidad: al cambiar de vista actualiza el título del documento,
       marca el enlace activo con aria-current y lleva el foco al <h1>.

   Las vistas viven en js/vistas/ (un módulo por Caso de Uso o grupo de
   Casos de Uso), para que el código sea mantenible (ISO/IEC 25010).
   ============================================================ */

import { api, ErrorApi, registrarPerdidaDeSesion } from './api.js';
import { Sesion } from './sesion.js';
import { $, $$, anunciar, clonarPlantilla } from './ui.js';
import * as vistaLogin from './vistas/login.js';
import * as vistaInicio from './vistas/inicio.js';
import * as vistaStock from './vistas/stock.js';
import * as vistaMovimientos from './vistas/movimientos.js';
import * as vistaUsuarios from './vistas/usuarios.js';
import * as vistaPerfil from './vistas/perfil.js';

/* Rutas de la SPA y el Caso de Uso que atiende cada una */
const RUTAS = {
    '/login':       { titulo: 'Iniciar sesión',     vista: vistaLogin, publica: true },   // Iniciar sesión
    '/inicio':      { titulo: 'Inicio',             vista: vistaInicio },                 // CU05 · Bajo stock
    '/stock':       { titulo: 'Stock de productos', vista: vistaStock },                  // CU01 · CU04 · Modificar · Eliminar
    '/movimientos': { titulo: 'Movimientos',        vista: vistaMovimientos },            // CU02 · CU03 · Transferir · Historial
    '/usuarios':    { titulo: 'Usuarios',           vista: vistaUsuarios, admin: true },  // Gestionar usuarios
    '/perfil':      { titulo: 'Mi perfil',          vista: vistaPerfil }
};
const RUTA_INICIAL = '/inicio';

let navegacionActual = 0;      // se incrementa en cada cambio de vista
let primeraCarga = true;
let mensajeParaLogin = '';

/** Contexto que recibe cada vista. */
function crearContexto(numero) {
    return {
        /* false si el usuario ya se fue a otra vista: la vista deja de actualizar el DOM */
        vigente: () => numero === navegacionActual,
        navegar: (ruta) => { window.location.hash = `#${ruta}`; },
        actualizarEncabezado,
        tomarMensajeParaLogin() {
            const texto = mensajeParaLogin;
            mensajeParaLogin = '';
            return texto;
        }
    };
}

/** Muestra u oculta la navegación según la sesión y el rol. */
function actualizarEncabezado() {
    const usuario = Sesion.usuario();
    $('#navegacion').hidden = usuario === null;
    $('#usuario-nombre').textContent = usuario ? `Hola, ${usuario.nombre}` : '';
    $('#usuario-rol').textContent = usuario ? usuario.rol : '';
    $$('[data-solo-admin]', document).forEach((elemento) => {
        elemento.hidden = !Sesion.esAdministrador();
    });
}

/** Marca el enlace de la vista actual (aria-current="page"). */
function marcarEnlaceActivo(ruta) {
    $$('.navbar-links a').forEach((enlace) => {
        if (enlace.getAttribute('href') === `#${ruta}`) {
            enlace.setAttribute('aria-current', 'page');
        } else {
            enlace.removeAttribute('aria-current');
        }
    });
}

function mostrarError(contenedor, titulo, detalle) {
    contenedor.replaceChildren(clonarPlantilla('tpl-error'));
    $('h1', contenedor).textContent = titulo;
    $('#error-detalle', contenedor).textContent = detalle;
    document.title = `${titulo} - Benitez Despensas`;
}

/** Router: se ejecuta al cargar la página y en cada cambio de hash. */
async function enrutar() {
    const hash = window.location.hash;
    // Enlaces internos como "#contenido" (saltar al contenido) no son rutas.
    if (hash && !hash.startsWith('#/')) return;

    const ruta = hash ? hash.slice(1).split('?')[0] : RUTA_INICIAL;
    const definicion = RUTAS[ruta];
    const contenedor = $('#vista');

    if (definicion && !definicion.publica && !Sesion.autenticado()) {
        window.location.replace('#/login');
        return;
    }
    if (ruta === '/login' && Sesion.autenticado()) {
        window.location.replace(`#${RUTA_INICIAL}`);
        return;
    }

    navegacionActual += 1;
    const contexto = crearContexto(navegacionActual);
    actualizarEncabezado();
    marcarEnlaceActivo(ruta);

    if (!definicion) {
        mostrarError(contenedor, 'Página no encontrada', 'La sección que buscás no existe.');
    } else if (definicion.admin && !Sesion.esAdministrador()) {
        mostrarError(contenedor, 'Acceso restringido', 'Esta sección es solo para administradores.');
    } else {
        document.title = `${definicion.titulo} - Benitez Despensas`;
        try {
            await definicion.vista.montar(contenedor, contexto);
        } catch (error) {
            // 401: la sesión venció y registrarPerdidaDeSesion() ya está llevando al login.
            if (error instanceof ErrorApi && error.estado === 401) return;
            console.error(error);
            if (contexto.vigente()) {
                mostrarError(contenedor, 'Ocurrió un error', 'No se pudo cargar la sección. Recargá la página.');
            }
        }
    }

    // El foco va al título de la vista nueva, así el lector de pantalla la anuncia
    // y la navegación con Tab sigue desde el contenido (no desde el principio de la página).
    if (!primeraCarga && contexto.vigente()) {
        const titulo = $('h1', contenedor);
        if (titulo) titulo.focus();
    }
    primeraCarga = false;
}

/* Si cualquier pedido devuelve 401 (sesión vencida o usuario deshabilitado), al login. */
registrarPerdidaDeSesion(() => {
    if (!Sesion.autenticado()) return;
    Sesion.limpiar();
    actualizarEncabezado();
    mensajeParaLogin = 'Tu sesión terminó. Volvé a iniciar sesión.';
    window.location.hash = '#/login';
});

async function cerrarSesion(evento) {
    const boton = evento.currentTarget;
    boton.disabled = true;
    try {
        await api.logout();
    } catch (error) {
        console.error('No se pudo cerrar la sesión en el servidor:', error);
    } finally {
        boton.disabled = false;
    }
    Sesion.limpiar();
    actualizarEncabezado();
    anunciar('Sesión cerrada.');
    window.location.hash = '#/login';
}

/* Enlace "Saltar al contenido": mueve el foco sin cambiar el hash (que usa el router). */
function saltarAlContenido(evento) {
    evento.preventDefault();
    $('#contenido').focus();
}

async function iniciar() {
    $('#btn-cerrar-sesion').addEventListener('click', cerrarSesion);
    $('.saltar').addEventListener('click', saltarAlContenido);
    window.addEventListener('hashchange', () => {
        enrutar().catch((error) => console.error(error));
    });

    await Sesion.cargar();
    await enrutar();
}

document.addEventListener('DOMContentLoaded', () => {
    iniciar().catch((error) => {
        console.error(error);
        anunciar('No se pudo iniciar la aplicación. Recargá la página.');
    });
});
