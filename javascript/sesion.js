/* ==========================================================================
   sesion.js - Estado de sesión compartido por las pantallas del sistema

   Al cargar la página consulta el endpoint PRIVADO api/perfil.php con fetch():
     - 200 -> hay sesión iniciada (el servidor devuelve los datos del usuario)
     - 401 -> no hay sesión (visitante)

   Contrato de la API: { estado: "exito" | "error", mensaje, data: { id, nombre, email, rol } }

   Con ese resultado alterna el DOM mediante atributos de datos:
     data-solo-autenticado    se muestra solo con sesión iniciada
     data-solo-visitante      se muestra solo sin sesión
     data-solo-rol="administrador"  se muestra solo si el rol del usuario coincide (VSDM)
     data-usuario-nombre      se completa con el nombre del usuario
     data-usuario-email       se completa con el correo del usuario
     data-usuario-rol         se completa con el rol (administrador / empleado)
     data-accion="cerrar-sesion"  botón que llama a api/logout.php
     <body data-requiere-sesion>  si no hay sesión, redirige al login

   SEGURIDAD (XSS): los datos del usuario se escriben SIEMPRE con .textContent,
   que los trata como texto plano. Nunca se usa innerHTML con esos datos, así que
   un nombre como "<img src=x onerror=...>" se muestra literal y no se ejecuta.

   Nota: ocultar elementos es solo la capa de presentación. La protección real
   está en el servidor (api/perfil.php responde 401 sin sesión).
   ========================================================================== */
'use strict';

const RUTA_PERFIL = 'api/perfil.php';
const RUTA_LOGOUT = 'api/logout.php';
const PAGINA_LOGIN = 'iniciosesion.html';

const Sesion = (() => {
    let consultaEnCurso = null;
    let actual = { autenticado: false, usuario: null };

    /* Pregunta al servidor quién está logueado. Nunca lanza: ante cualquier falla, "visitante". */
    async function comprobarSesion() {
        try {
            const respuesta = await fetch(RUTA_PERFIL, {
                credentials: 'same-origin',
                headers: { 'Accept': 'application/json' }
            });

            if (respuesta.status === 401) {
                return { autenticado: false, usuario: null };
            }
            if (!respuesta.ok) {
                throw new Error(`HTTP ${respuesta.status} al pedir ${RUTA_PERFIL}`);
            }

            const resultado = await respuesta.json();
            if (resultado.estado !== 'exito' || !resultado.data) {
                return { autenticado: false, usuario: null };
            }
            return { autenticado: true, usuario: resultado.data };
        } catch (error) {
            console.error('No se pudo verificar la sesión:', error);
            return { autenticado: false, usuario: null };
        }
    }

    /* Una sola consulta por carga de página: los demás scripts reutilizan la misma promesa. */
    function cargar() {
        if (!consultaEnCurso) {
            consultaEnCurso = comprobarSesion().then((estado) => {
                actual = estado;
                return estado;
            });
        }
        return consultaEnCurso;
    }

    /* Muestra u oculta bloques y completa los datos del usuario (siempre con textContent). */
    function aplicarAlDOM(estado) {
        document.querySelectorAll('[data-solo-autenticado]').forEach((nodo) => {
            nodo.hidden = !estado.autenticado;
        });
        document.querySelectorAll('[data-solo-visitante]').forEach((nodo) => {
            nodo.hidden = estado.autenticado;
        });

        /* Vista según el rol (Administrador / Empleado) */
        document.querySelectorAll('[data-solo-rol]').forEach((nodo) => {
            nodo.hidden = !(estado.autenticado && estado.usuario.rol === nodo.dataset.soloRol);
        });

        const nombre = estado.usuario ? estado.usuario.nombre : '';
        const email = estado.usuario ? estado.usuario.email : '';
        const rol = estado.usuario ? estado.usuario.rol : '';
        document.querySelectorAll('[data-usuario-nombre]').forEach((nodo) => {
            nodo.textContent = nombre;
        });
        document.querySelectorAll('[data-usuario-email]').forEach((nodo) => {
            nodo.textContent = email;
        });
        document.querySelectorAll('[data-usuario-rol]').forEach((nodo) => {
            nodo.textContent = rol;
        });
    }

    async function cerrar() {
        try {
            await fetch(RUTA_LOGOUT, { method: 'POST', credentials: 'same-origin' });
        } catch (error) {
            console.error('No se pudo cerrar la sesión en el servidor:', error);
        }
        window.location.replace(PAGINA_LOGIN);
    }

    return {
        cargar,
        cerrar,
        aplicarAlDOM,
        esAdministrador: () => actual.autenticado && actual.usuario.rol === 'administrador',
        get actual() { return actual; }
    };
})();

document.addEventListener('DOMContentLoaded', async () => {
    const estado = await Sesion.cargar();

    /* Pantallas que exigen sesión: sin ella, al login */
    if (document.body.hasAttribute('data-requiere-sesion') && !estado.autenticado) {
        window.location.replace(PAGINA_LOGIN);
        return;
    }

    Sesion.aplicarAlDOM(estado);
    document.body.classList.add('sesion-lista');
});

/* Delegación: cualquier botón con data-accion="cerrar-sesion" */
document.addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-accion="cerrar-sesion"]');
    if (!boton) return;
    evento.preventDefault();
    Sesion.cerrar();
});
