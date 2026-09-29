/* ==========================================================================
   app.js - Monitor de Inventario y Alerta de Estado Crítico (stockproductos.html)

   - Desacoplamiento: TODOS los eventos se registran acá con addEventListener();
     el HTML no tiene atributos onclick / onsubmit / onchange.
   - Asincronía: el inventario y el umbral crítico se consultan con fetch()
     (async / await) al archivo local data/stock.json.
   - Persistencia: los cambios del usuario (altas, ediciones) se guardan en
     localStorage, que es propio del origen (ej.: http://localhost:8000).
   ========================================================================== */
'use strict';

const RUTA_STOCK = 'data/stock.json';
const CLAVE_PRODUCTOS = 'stockProducts';   // misma clave que usaba el sistema antes
const CLAVE_UMBRAL = 'stockUmbral';
const UMBRAL_POR_DEFECTO = 10;
const LADO_MAX_IMAGEN = 300;               // px; evita llenar el límite (~5 MB) de localStorage

/* Estado en memoria de la pantalla */
const estado = {
    productos: [],
    umbral: UMBRAL_POR_DEFECTO,
    editandoId: null,
    imagenNueva: ''          // imagen (data URL) elegida en el formulario de alta
};

const $ = (id) => document.getElementById(id);

/* ------------------------------------------------------------------ */
/* Persistencia (localStorage)                                        */
/* ------------------------------------------------------------------ */
function leerProductosGuardados() {
    try {
        const crudo = localStorage.getItem(CLAVE_PRODUCTOS);
        if (crudo === null) return null;              // nunca se guardó nada
        const lista = JSON.parse(crudo);
        if (!Array.isArray(lista)) return null;
        /* Compatibilidad: productos guardados por la versión anterior no tenían id */
        let base = Date.now();
        return lista.map((p) => (p.id ? p : { ...p, id: base++ }));
    } catch (error) {
        console.error('No se pudo leer el inventario guardado:', error);
        return null;
    }
}

function guardarProductos() {
    try {
        localStorage.setItem(CLAVE_PRODUCTOS, JSON.stringify(estado.productos));
        return true;
    } catch (error) {
        /* Normalmente QuotaExceededError: imágenes demasiado pesadas */
        mostrarMensaje('No hay espacio para guardar los datos. Probá con una imagen más liviana.', 'error');
        return false;
    }
}

function guardarUmbral() {
    try {
        localStorage.setItem(CLAVE_UMBRAL, String(estado.umbral));
    } catch (error) {
        console.error('No se pudo guardar el umbral:', error);
    }
}

function leerUmbralGuardado() {
    const valor = Number(localStorage.getItem(CLAVE_UMBRAL));
    return localStorage.getItem(CLAVE_UMBRAL) !== null && Number.isFinite(valor) && valor >= 0 ? valor : null;
}

/* ------------------------------------------------------------------ */
/* Llamada HTTP asíncrona (fetch + async/await)                       */
/* ------------------------------------------------------------------ */
async function consultarStockServidor() {
    const respuesta = await fetch(RUTA_STOCK, { cache: 'no-store' });
    if (!respuesta.ok) {
        throw new Error(`HTTP ${respuesta.status} al pedir ${RUTA_STOCK}`);
    }
    return respuesta.json();
}

/* ------------------------------------------------------------------ */
/* Mensajes en pantalla                                               */
/* ------------------------------------------------------------------ */
function mostrarMensaje(texto, tipo) {
    const caja = $('estadoCarga');
    caja.textContent = texto;
    caja.className = `estado-carga estado-${tipo}`;
    caja.hidden = !texto;
}

function mostrarErrorFormulario(texto) {
    const p = $('errorMessage');
    p.textContent = texto;
    p.style.display = texto ? 'block' : 'none';
}

/* ------------------------------------------------------------------ */
/* Lógica de negocio: stock crítico                                   */
/* ------------------------------------------------------------------ */
function esCritico(producto) {
    return Number(producto.quantity) < estado.umbral;
}

function etiquetaEstado(producto) {
    if (Number(producto.quantity) === 0) return 'Agotado';
    return esCritico(producto) ? 'Stock crítico' : '';
}

/* ------------------------------------------------------------------ */
/* Render (se arma con la API del DOM; sin innerHTML con datos de usuario) */
/* ------------------------------------------------------------------ */
function crearCelda(texto) {
    const td = document.createElement('td');
    td.textContent = texto;
    return td;
}

function crearBoton(texto, accion, clase) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = texto;
    b.dataset.accion = accion;
    b.className = clase;
    return b;
}

function crearInput(tipo, valor, campo, extra = {}) {
    const input = document.createElement('input');
    input.type = tipo;
    input.value = valor;
    input.dataset.campo = campo;
    input.setAttribute('aria-label', campo);
    Object.entries(extra).forEach(([k, v]) => input.setAttribute(k, v));
    return input;
}

function crearFila(producto) {
    const tr = document.createElement('tr');
    tr.dataset.id = producto.id;
    const enEdicion = estado.editandoId === producto.id;
    const critico = esCritico(producto);
    if (critico) tr.classList.add('stock-critico');

    /* Imagen */
    const tdImg = document.createElement('td');
    const contImg = document.createElement('div');
    contImg.className = 'image-upload';
    const img = document.createElement('img');
    img.className = 'preview';
    img.src = producto.image;
    img.alt = producto.productName;
    contImg.appendChild(img);
    if (enEdicion) {
        contImg.appendChild(crearInput('file', '', 'imagen', { accept: 'image/*' }));
    }
    tdImg.appendChild(contImg);
    tr.appendChild(tdImg);

    if (enEdicion) {
        const celdas = [
            crearInput('text', producto.productName, 'productName'),
            crearInput('number', producto.quantity, 'quantity', { min: '0', step: '1' }),
            crearInput('date', producto.receiptDate, 'receiptDate'),
            crearInput('text', producto.supplier, 'supplier'),
            crearInput('number', producto.purchasePrice, 'purchasePrice', { min: '0', step: '0.01' })
        ];
        celdas.forEach((input) => {
            const td = document.createElement('td');
            td.appendChild(input);
            tr.appendChild(td);
        });
    } else {
        tr.appendChild(crearCelda(producto.productName));

        /* Cantidad + insignia de alerta */
        const tdCant = crearCelda(String(producto.quantity));
        const etiqueta = etiquetaEstado(producto);
        if (etiqueta) {
            const badge = document.createElement('span');
            badge.className = 'badge-critico';
            badge.textContent = etiqueta;
            tdCant.appendChild(badge);
        }
        tr.appendChild(tdCant);

        tr.appendChild(crearCelda(producto.receiptDate));
        tr.appendChild(crearCelda(producto.supplier));
        tr.appendChild(crearCelda(`$${Number(producto.purchasePrice).toFixed(2)}`));
    }

    /* Acciones */
    const tdAcc = document.createElement('td');
    if (enEdicion) {
        tdAcc.appendChild(crearBoton('Guardar', 'guardar', 'edit-button'));
        tdAcc.appendChild(crearBoton('Cancelar', 'cancelar', 'delete-button'));
    } else {
        tdAcc.appendChild(crearBoton('Editar', 'editar', 'edit-button'));
    }
    tr.appendChild(tdAcc);

    return tr;
}

function renderResumen() {
    const total = estado.productos.length;
    const criticos = estado.productos.filter(esCritico);
    $('resumenTotal').textContent = total;
    $('resumenCriticos').textContent = criticos.length;
    $('resumenOk').textContent = total - criticos.length;

    const alerta = $('alertaStock');
    if (criticos.length === 0) {
        alerta.hidden = true;
        alerta.textContent = '';
        return;
    }
    alerta.hidden = false;
    const nombres = criticos.map((p) => `${p.productName} (${p.quantity})`).join(', ');
    alerta.textContent = `Atención: ${criticos.length} producto(s) por debajo del umbral de ${estado.umbral} unidades: ${nombres}.`;
}

function render() {
    const tbody = $('productTable').tBodies[0];
    tbody.replaceChildren(...estado.productos.map(crearFila));
    $('productTableContainer').style.display = estado.productos.length > 0 ? 'block' : 'none';
    $('umbralCritico').value = estado.umbral;
    renderResumen();
}

/* ------------------------------------------------------------------ */
/* Imágenes: se reducen antes de guardarlas en localStorage            */
/* ------------------------------------------------------------------ */
function reducirImagen(archivo) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(archivo);
        const img = new Image();
        img.onload = () => {
            const escala = Math.min(1, LADO_MAX_IMAGEN / Math.max(img.width, img.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.width * escala);
            canvas.height = Math.round(img.height * escala);
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('El archivo no es una imagen válida.'));
        };
        img.src = url;
    });
}

/* ------------------------------------------------------------------ */
/* Manejadores de eventos                                             */
/* ------------------------------------------------------------------ */
async function alElegirImagen(evento) {
    const archivo = evento.target.files[0];
    const vista = $('preview');
    if (!archivo) {
        estado.imagenNueva = '';
        vista.removeAttribute('src');
        vista.style.display = 'none';
        return;
    }
    try {
        estado.imagenNueva = await reducirImagen(archivo);
        vista.src = estado.imagenNueva;
        vista.style.display = 'block';
    } catch (error) {
        estado.imagenNueva = '';
        vista.style.display = 'none';
        mostrarErrorFormulario(error.message);
    }
}

function alEnviarFormulario(evento) {
    evento.preventDefault();

    const productName = $('productName').value.trim();
    const quantity = $('quantity').value.trim();
    const receiptDate = $('receiptDate').value;
    const supplier = $('supplier').value.trim();
    const purchasePrice = $('purchasePrice').value.trim();

    if (!productName || !quantity || !receiptDate || !supplier || !purchasePrice || !estado.imagenNueva) {
        mostrarErrorFormulario('Por favor, complete todos los campos antes de guardar.');
        return;
    }
    if (!Number.isInteger(Number(quantity)) || Number(quantity) < 0 || Number(purchasePrice) < 0) {
        mostrarErrorFormulario('La cantidad debe ser un entero y el precio no puede ser negativo.');
        return;
    }

    estado.productos.push({
        id: Date.now(),
        productName,
        quantity: Number(quantity),
        receiptDate,
        supplier,
        purchasePrice: Number(purchasePrice),
        image: estado.imagenNueva
    });

    if (!guardarProductos()) {
        estado.productos.pop();       // no se pudo persistir: se revierte el alta
        return;
    }

    mostrarErrorFormulario('');
    $('stockProductForm').reset();
    estado.imagenNueva = '';
    $('preview').removeAttribute('src');
    $('preview').style.display = 'none';
    render();
}

async function guardarEdicion(fila, producto) {
    const leer = (campo) => fila.querySelector(`[data-campo="${campo}"]`);
    const productName = leer('productName').value.trim();
    const quantity = leer('quantity').value.trim();
    const receiptDate = leer('receiptDate').value;
    const supplier = leer('supplier').value.trim();
    const purchasePrice = leer('purchasePrice').value.trim();

    if (!productName || !quantity || !receiptDate || !supplier || !purchasePrice
        || !Number.isInteger(Number(quantity)) || Number(quantity) < 0 || Number(purchasePrice) < 0) {
        mostrarMensaje('Revisá los datos: no puede haber campos vacíos, la cantidad debe ser un entero y el precio no puede ser negativo.', 'error');
        return;
    }

    const copia = { ...producto, productName, quantity: Number(quantity), receiptDate, supplier, purchasePrice: Number(purchasePrice) };

    const archivo = leer('imagen').files[0];
    if (archivo) {
        try {
            copia.image = await reducirImagen(archivo);
        } catch (error) {
            mostrarMensaje(error.message, 'error');
            return;
        }
    }

    const indice = estado.productos.findIndex((p) => p.id === producto.id);
    const anterior = estado.productos[indice];
    estado.productos[indice] = copia;
    if (!guardarProductos()) {
        estado.productos[indice] = anterior;
        return;
    }
    estado.editandoId = null;
    mostrarMensaje('', 'ok');
    render();
}

/* Delegación de eventos: un único listener para todos los botones de la tabla */
function alClickEnTabla(evento) {
    const boton = evento.target.closest('button[data-accion]');
    if (!boton) return;

    const fila = boton.closest('tr');
    const id = Number(fila.dataset.id);
    const producto = estado.productos.find((p) => p.id === id);
    if (!producto) return;

    switch (boton.dataset.accion) {
        case 'editar':
            estado.editandoId = id;
            render();
            break;
        case 'cancelar':
            estado.editandoId = null;
            mostrarMensaje('', 'ok');
            render();
            break;
        case 'guardar':
            guardarEdicion(fila, producto);
            break;
    }
}

function alCambiarUmbral(evento) {
    const valor = Number(evento.target.value);
    if (evento.target.value === '' || !Number.isFinite(valor) || valor < 0) return;
    estado.umbral = valor;
    guardarUmbral();
    render();
}

/* Vuelve a consultar el "servidor" (stock.json) y re-evalúa las alertas */
async function alVerificarStock() {
    const boton = $('btnVerificar');
    boton.disabled = true;
    mostrarMensaje('Consultando el servidor...', 'info');
    try {
        const datos = await consultarStockServidor();
        if (Number.isFinite(datos.umbralCritico)) {
            estado.umbral = datos.umbralCritico;
            guardarUmbral();
        }
        render();
        const hora = new Date().toLocaleTimeString('es-AR');
        $('ultimaVerificacion').textContent = `Última verificación: ${hora}`;
        mostrarMensaje(`Stock verificado. Umbral crítico del servidor: ${estado.umbral}.`, 'ok');
    } catch (error) {
        console.error(error);
        mostrarMensaje('No se pudo consultar stock.json. Verificá que estés usando un servidor local (localhost).', 'error');
    } finally {
        boton.disabled = false;
    }
}

/* ------------------------------------------------------------------ */
/* Inicialización                                                     */
/* ------------------------------------------------------------------ */
async function iniciar() {
    const guardados = leerProductosGuardados();
    const umbralGuardado = leerUmbralGuardado();

    try {
        const datos = await consultarStockServidor();
        estado.umbral = umbralGuardado ?? (Number.isFinite(datos.umbralCritico) ? datos.umbralCritico : UMBRAL_POR_DEFECTO);
        /* Primera vez: se siembra el inventario con los datos del JSON.
           Después manda lo que el usuario ya guardó en este navegador. */
        estado.productos = guardados ?? datos.productos ?? [];
        if (guardados === null) guardarProductos();
        mostrarMensaje('', 'ok');
    } catch (error) {
        console.error(error);
        estado.umbral = umbralGuardado ?? UMBRAL_POR_DEFECTO;
        estado.productos = guardados ?? [];
        mostrarMensaje('No se pudo cargar data/stock.json (¿abriste el archivo sin servidor?). Se muestran solo los datos guardados en este navegador.', 'error');
    }
    render();
}

/* Registro de todos los eventos (desacoplado del HTML) */
document.addEventListener('DOMContentLoaded', () => {
    $('stockProductForm').addEventListener('submit', alEnviarFormulario);
    $('fileInput').addEventListener('change', alElegirImagen);
    $('productTable').tBodies[0].addEventListener('click', alClickEnTabla);
    $('umbralCritico').addEventListener('input', alCambiarUmbral);
    $('btnVerificar').addEventListener('click', alVerificarStock);
    iniciar();
});
