/* ============================================================
   sesion.js — Estado de la sesión en el cliente

   El cliente NO decide quién es ni qué rol tiene: lo pregunta al servidor
   (api/perfil.php). Ocultar botones según el rol es solo comodidad; la
   autorización real la hace la API (401 / 403) en cada pedido.
   ============================================================ */

import { api, ErrorApi } from './api.js';

let usuario = null;

export const Sesion = {
    /** Consulta al servidor si hay una sesión activa. */
    async cargar() {
        try {
            const respuesta = await api.perfil();
            usuario = respuesta.data;
        } catch (error) {
            if (!(error instanceof ErrorApi) || error.estado !== 401) {
                console.error('No se pudo verificar la sesión:', error);
            }
            usuario = null;
        }
        return usuario;
    },

    usuario: () => usuario,
    autenticado: () => usuario !== null,
    esAdministrador: () => usuario !== null && usuario.rol === 'administrador',
    limpiar() { usuario = null; }
};
