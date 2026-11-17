/* ============================================================
   ui.js — Utilidades de interfaz compartidas por las vistas

   Mitigación de XSS (OWASP A03): todo dato que llega del servidor o del
   usuario se inserta con .textContent (o como atributo con setAttribute).
   En todo el proyecto no se usa innerHTML.
   ============================================================ */

/** Busca un elemento dentro de una raíz (por defecto, el documento). */
export const $ = (selector, raiz = document) => raiz.querySelector(selector);
export const $$ = (selector, raiz = document) => [...raiz.querySelectorAll(selector)];

/**
 * Crea un elemento del DOM de forma segura.
 *   crear('td', { className: 'x', texto: dato }, hijo1, hijo2)
 * "texto" se asigna con textContent: nunca se interpreta como HTML.
 */
export function crear(etiqueta, propiedades = {}, ...hijos) {
    const elemento = document.createElement(etiqueta);
    Object.entries(propiedades).forEach(([clave, valor]) => {
        if (valor === undefined || valor === null || valor === false) return;
        if (clave === 'texto') {
            elemento.textContent = String(valor);
        } else if (clave === 'className') {
            elemento.className = valor;
        } else if (clave === 'dataset') {
            Object.assign(elemento.dataset, valor);
        } else if (clave === 'hidden') {
            elemento.hidden = Boolean(valor);
        } else {
            elemento.setAttribute(clave, valor === true ? '' : String(valor));
        }
    });
    hijos.flat().forEach((hijo) => {
        if (hijo === null || hijo === undefined || hijo === false) return;
        elemento.append(hijo instanceof Node ? hijo : document.createTextNode(String(hijo)));
    });
    return elemento;
}

/** Texto solo para lectores de pantalla (completa el nombre accesible de un botón). */
export const textoOculto = (texto) => crear('span', { className: 'visually-hidden', texto });

/** Clona una <template> del index.html. */
export function clonarPlantilla(id) {
    return document.getElementById(id).content.cloneNode(true);
}

/** Anuncio global para lectores de pantalla (región aria-live="polite"). */
export function anunciar(texto) {
    const region = document.getElementById('anuncios');
    region.textContent = '';
    // Pequeña espera para que el lector detecte el cambio aunque el texto se repita.
    window.setTimeout(() => { region.textContent = texto; }, 50);
}

/**
 * Muestra un mensaje en un párrafo con aria-live.
 * tipo: 'ok' | 'error' | 'info'
 */
export function mostrarMensaje(elemento, texto, tipo = 'info') {
    elemento.textContent = texto;
    elemento.classList.remove('mensaje-ok', 'mensaje-error', 'mensaje-info');
    if (texto) elemento.classList.add(`mensaje-${tipo}`);
}

/** Deshabilita los botones de un formulario mientras se espera al servidor. */
export function marcarEnviando(formulario, enviando) {
    formulario.setAttribute('aria-busy', String(enviando));
    $$('button', formulario).forEach((boton) => { boton.disabled = enviando; });
}

/** Fila única para tablas sin resultados (las cabeceras siempre tienen celdas). */
export function filaVacia(columnas, texto) {
    return crear('tr', {}, crear('td', { colspan: columnas, className: 'celda-vacia', texto }));
}

/** Llena un <select> con opciones { valor, texto }, conservando las opciones iniciales si se pide. */
export function llenarSelect(select, opciones, { conservarPrimera = false } = {}) {
    const primera = conservarPrimera ? select.options[0] : null;
    select.replaceChildren(...(primera ? [primera] : []),
        ...opciones.map(({ valor, texto }) => crear('option', { value: valor, texto })));
}

const formatoMoneda = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });
export const moneda = (valor) => formatoMoneda.format(Number(valor) || 0);

/** '2027-03-15' -> '15/03/2027' */
export function fecha(iso) {
    if (!iso) return '-';
    const [anio, mes, dia] = String(iso).slice(0, 10).split('-');
    return dia ? `${dia}/${mes}/${anio}` : String(iso);
}

/** '2026-11-15 13:05:10' -> '15/11/2026 13:05' */
export function fechaHora(texto) {
    if (!texto) return '-';
    const [dia, hora = ''] = String(texto).split(' ');
    return `${fecha(dia)} ${hora.slice(0, 5)}`.trim();
}

/** Parámetros de la ruta actual: '#/movimientos?producto=5' -> URLSearchParams { producto: '5' } */
export function parametrosRuta() {
    return new URLSearchParams(window.location.hash.split('?')[1] || '');
}

/** Devuelve los datos de un formulario como objeto { nombre: valor }. */
export function datosFormulario(formulario) {
    return Object.fromEntries(new FormData(formulario).entries());
}
