/* ============================================================
   Vista Gestión de usuarios (solo administrador)
   Caso de Uso: "Gestionar usuarios" — crear, cambiar el rol y
   deshabilitar o volver a habilitar usuarios.
   ============================================================ */

import { api, ErrorApi } from '../api.js';
import { Sesion } from '../sesion.js';
import { $, anunciar, clonarPlantilla, crear, datosFormulario, filaVacia, marcarEnviando, mostrarMensaje, textoOculto } from '../ui.js';

export async function montar(contenedor, contexto) {
    contenedor.replaceChildren(clonarPlantilla('tpl-usuarios'));
    const estado = { contenedor, contexto, usuarios: [] };

    $('#tabla-usuarios', contenedor).addEventListener('click', (evento) => {
        const boton = evento.target.closest('button[data-accion]');
        if (boton) alAccionar(estado, boton).catch((error) => console.error(error));
    });
    $('#form-usuario', contenedor).addEventListener('submit', (evento) => {
        evento.preventDefault();
        crearUsuario(estado).catch((error) => console.error(error));
    });

    await cargar(estado);
}

async function cargar(estado) {
    const { contenedor, contexto } = estado;
    const indicador = $('#usuarios-estado', contenedor);
    try {
        const { data } = await api.usuarios();
        if (!contexto.vigente()) return;
        estado.usuarios = data;
        renderizar(estado);
        const inactivos = data.filter((u) => !u.activo).length;
        indicador.textContent = `${data.length} usuario(s), ${inactivos} deshabilitado(s).`;
    } catch (error) {
        if (contexto.vigente()) indicador.textContent = error.message;
    }
}

function renderizar(estado) {
    const yo = Sesion.usuario().id;
    const cuerpo = $('#tabla-usuarios', estado.contenedor);
    if (estado.usuarios.length === 0) {
        cuerpo.replaceChildren(filaVacia(5, 'No hay usuarios.'));
        return;
    }
    cuerpo.replaceChildren(...estado.usuarios.map((usuario) => {
        const esYo = usuario.id === yo;
        const idSelect = `rol-usuario-${usuario.id}`;
        const select = crear('select', { id: idSelect, disabled: esYo },
            crear('option', { value: 'empleado', texto: 'Empleado' }),
            crear('option', { value: 'administrador', texto: 'Administrador' }));
        select.value = usuario.rol;

        const acciones = esYo
            ? [crear('span', { className: 'texto-secundario', texto: 'Es tu usuario' })]
            : [
                crear('button', { type: 'button', className: 'btn', 'data-accion': 'rol', 'data-id': usuario.id },
                    'Aplicar rol', textoOculto(` a ${usuario.nombre}`)),
                crear('button', {
                    type: 'button', className: usuario.activo ? 'btn btn-peligro' : 'btn btn-secundario',
                    'data-accion': 'estado', 'data-id': usuario.id
                }, usuario.activo ? 'Deshabilitar' : 'Habilitar', textoOculto(` a ${usuario.nombre}`))
            ];

        return crear('tr', { className: usuario.activo ? '' : 'fila-inactiva' },
            crear('td', { texto: usuario.nombre }),
            crear('td', { texto: usuario.email }),
            crear('td', {}, crear('label', { for: idSelect, className: 'visually-hidden', texto: `Rol de ${usuario.nombre}` }), select),
            crear('td', {}, crear('span', { className: usuario.activo ? 'badge badge-ok' : 'badge badge-critico', texto: usuario.activo ? 'Activo' : 'Deshabilitado' })),
            crear('td', {}, crear('div', { className: 'acciones' }, ...acciones)));
    }));
}

async function alAccionar(estado, boton) {
    const id = Number(boton.dataset.id);
    const usuario = estado.usuarios.find((u) => u.id === id);
    if (!usuario) return;
    const indicador = $('#usuarios-estado', estado.contenedor);

    const cambios = boton.dataset.accion === 'rol'
        ? { rol: $(`#rol-usuario-${id}`, estado.contenedor).value }
        : { activo: !usuario.activo };

    boton.disabled = true;
    try {
        const { data } = await api.editarUsuario(id, cambios);
        await cargar(estado);
        const texto = boton.dataset.accion === 'rol'
            ? `${data.nombre} ahora es ${data.rol}.`
            : `${data.nombre} fue ${data.activo ? 'habilitado' : 'deshabilitado'}.`;
        mostrarMensaje(indicador, texto, 'ok');
        anunciar(texto);
        // El foco vuelve al mismo botón de la fila redibujada.
        const mismo = $(`button[data-accion="${boton.dataset.accion}"][data-id="${id}"]`, estado.contenedor);
        if (mismo) mismo.focus();
    } catch (error) {
        boton.disabled = false;
        mostrarMensaje(indicador, error instanceof ErrorApi ? error.message : 'No se pudo actualizar el usuario.', 'error');
    }
}

async function crearUsuario(estado) {
    const form = $('#form-usuario', estado.contenedor);
    const mensaje = $('#usuario-mensaje', estado.contenedor);
    const datos = datosFormulario(form);

    if (!datos.nombre.trim() || !datos.email.trim() || datos.password.length < 8) {
        mostrarMensaje(mensaje, 'Completá nombre, correo y una contraseña de al menos 8 caracteres.', 'error');
        return;
    }

    marcarEnviando(form, true);
    try {
        const { data } = await api.crearUsuario({ ...datos, nombre: datos.nombre.trim(), email: datos.email.trim() });
        form.reset();
        await cargar(estado);   // primero se actualiza la tabla, después se avisa
        mostrarMensaje(mensaje, `Usuario ${data.nombre} creado como ${data.rol}.`, 'ok');
    } catch (error) {
        mostrarMensaje(mensaje, error.message, 'error');
    } finally {
        marcarEnviando(form, false);
    }
}
