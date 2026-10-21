/* ==========================================================================
   jsproductosrecibidos.js - Productos Recibidos (productosrecibidos.html)

   - Desacoplamiento: no hay onclick / onsubmit / onchange en el HTML ni en el
     HTML generado por este archivo; todo se registra con addEventListener().
   - Los botones de la tabla se atienden con delegación de eventos: un único
     listener sobre el <tbody> sirve para todas las filas (presentes y futuras).
   - Las filas se construyen con la API del DOM (textContent), sin innerHTML.
   - Nodos: se seleccionan con querySelector().
   ========================================================================== */
'use strict';

const CLAVE_STORAGE = 'receivedProducts';

const $ = (selector, raiz = document) => raiz.querySelector(selector);

/* ------------------------------------------------------------------ */
/* Persistencia                                                       */
/* ------------------------------------------------------------------ */
function leerProductos() {
    return JSON.parse(localStorage.getItem(CLAVE_STORAGE)) || [];
}

function guardarProductos(lista) {
    try {
        localStorage.setItem(CLAVE_STORAGE, JSON.stringify(lista));
        return true;
    } catch (error) {
        mostrarError('No hay espacio para guardar los datos. Probá con una imagen más liviana.');
        return false;
    }
}

/* ------------------------------------------------------------------ */
/* Mensajes                                                           */
/* ------------------------------------------------------------------ */
const MENSAJE_CAMPOS = 'Por favor, complete todos los campos antes de guardar.';

function mostrarError(texto) {
    const mensaje = $('#errorMessage');
    mensaje.textContent = texto;
    mensaje.style.display = 'block';
}

function ocultarError() {
    $('#errorMessage').style.display = 'none';
}

/* ------------------------------------------------------------------ */
/* Imagen: vista previa                                               */
/* ------------------------------------------------------------------ */
function mostrarVistaPrevia(input, salida) {
    const archivo = input.files && input.files[0];

    if (!archivo) {
        salida.removeAttribute('src');
        salida.style.display = 'none';
        return;
    }

    const lector = new FileReader();
    lector.addEventListener('load', () => {
        salida.src = lector.result;
        salida.style.display = 'block';
    });
    lector.readAsDataURL(archivo);
}

/* ------------------------------------------------------------------ */
/* Render de la tabla                                                 */
/* ------------------------------------------------------------------ */
function crearCelda(texto) {
    const td = document.createElement('td');
    td.textContent = texto;
    td.contentEditable = 'true';
    return td;
}

function crearBoton(texto, accion, clase) {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.textContent = texto;
    boton.dataset.accion = accion;
    boton.className = clase;
    return boton;
}

function crearFila(producto, indice) {
    const tr = document.createElement('tr');
    tr.dataset.indice = indice;

    const tdImagen = document.createElement('td');
    const contenedor = document.createElement('div');
    contenedor.className = 'image-upload';
    const img = document.createElement('img');
    img.className = 'preview';
    img.alt = producto.productName;
    img.src = producto.image;
    contenedor.appendChild(img);
    tdImagen.appendChild(contenedor);

    const tdAcciones = document.createElement('td');
    tdAcciones.append(
        crearBoton('Editar', 'editar', 'edit-button'),
        crearBoton('Eliminar', 'eliminar', 'delete-button')
    );

    tr.append(
        tdImagen,
        crearCelda(producto.productName),
        crearCelda(producto.quantity),
        crearCelda(producto.receiptDate),
        crearCelda(producto.supplier),
        crearCelda(`$${Number.parseFloat(producto.purchasePrice).toFixed(2)}`),
        tdAcciones
    );
    return tr;
}

function renderTabla() {
    const productos = leerProductos();
    $('#productTable tbody').replaceChildren(...productos.map(crearFila));
    $('#productTableContainer').style.display = productos.length > 0 ? 'block' : 'none';
}

/* ------------------------------------------------------------------ */
/* Alta de un producto                                                */
/* ------------------------------------------------------------------ */
function reiniciarFormulario() {
    $('#receivedProductForm').reset();
    const vista = $('#preview');
    vista.removeAttribute('src');
    vista.style.display = 'none';
}

function alEnviarFormulario(evento) {
    evento.preventDefault();

    const productName = $('#productName').value.trim();
    const quantity = $('#quantity').value;
    const receiptDate = $('#receiptDate').value;
    const supplier = $('#supplier').value.trim();
    const purchasePrice = $('#purchasePrice').value;
    const image = $('#preview').getAttribute('src');

    /* Valida que todos los campos estén completos antes de guardar */
    if (!productName || !quantity || !receiptDate || !supplier || !purchasePrice || !image) {
        mostrarError(MENSAJE_CAMPOS);
        return;
    }

    const productos = leerProductos();
    productos.push({ productName, quantity, receiptDate, supplier, purchasePrice, image });
    if (!guardarProductos(productos)) return;

    renderTabla();
    reiniciarFormulario();
    ocultarError();
}

/* ------------------------------------------------------------------ */
/* Edición / eliminación (delegación de eventos sobre el <tbody>)     */
/* ------------------------------------------------------------------ */
function activarEdicion(fila, boton) {
    /* Se agrega un selector de archivo para poder cambiar la imagen */
    const contenedor = $('.image-upload', fila);
    const selector = document.createElement('input');
    selector.type = 'file';
    selector.accept = 'image/*';
    contenedor.prepend(selector);

    boton.textContent = 'Guardar';
    boton.dataset.accion = 'guardar';
}

function guardarEdicion(fila) {
    const indice = Number(fila.dataset.indice);
    const productos = leerProductos();
    const producto = productos[indice];
    if (!producto) return;

    const celdas = fila.cells;
    producto.productName = celdas[1].textContent.trim();
    producto.quantity = celdas[2].textContent.trim();
    producto.receiptDate = celdas[3].textContent.trim();
    producto.supplier = celdas[4].textContent.trim();
    producto.purchasePrice = celdas[5].textContent.replace('$', '').trim();

    const finalizar = () => {
        if (guardarProductos(productos)) renderTabla();
    };

    /* Actualiza la imagen solo si se eligió un archivo nuevo */
    const archivo = $('input[type="file"]', fila).files[0];
    if (!archivo) {
        finalizar();
        return;
    }

    const lector = new FileReader();
    lector.addEventListener('load', () => {
        producto.image = lector.result;
        finalizar();
    });
    lector.readAsDataURL(archivo);
}

function eliminarProducto(fila) {
    const productos = leerProductos();
    productos.splice(Number(fila.dataset.indice), 1);
    if (!guardarProductos(productos)) return;

    renderTabla();
    if (productos.length === 0) reiniciarFormulario();
}

function alClickEnTabla(evento) {
    const boton = evento.target.closest('button[data-accion]');
    if (!boton) return;

    const fila = boton.closest('tr');

    switch (boton.dataset.accion) {
        case 'editar':
            activarEdicion(fila, boton);
            break;
        case 'guardar':
            guardarEdicion(fila);
            break;
        case 'eliminar':
            eliminarProducto(fila);
            break;
    }
}

/* Vista previa de la imagen elegida mientras se edita una fila */
function alCambiarArchivoEnFila(evento) {
    if (!evento.target.matches('input[type="file"]')) return;
    const imagenFila = $('img.preview', evento.target.closest('.image-upload'));
    if (evento.target.files[0]) mostrarVistaPrevia(evento.target, imagenFila);
}

/* ------------------------------------------------------------------ */
/* Registro de eventos                                                */
/* ------------------------------------------------------------------ */
document.addEventListener('DOMContentLoaded', () => {
    $('#receivedProductForm').addEventListener('submit', alEnviarFormulario);
    $('#fileInput').addEventListener('change', (evento) => mostrarVistaPrevia(evento.target, $('#preview')));

    const cuerpo = $('#productTable tbody');
    cuerpo.addEventListener('click', alClickEnTabla);
    cuerpo.addEventListener('change', alCambiarArchivoEnFila);

    renderTabla();
});
