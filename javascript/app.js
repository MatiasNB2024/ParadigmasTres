/* ==========================================================================
   app.js - Monitor de Inventario y Alerta de Estado Crítico (stockproductos.html)

   - Desacoplamiento: TODOS los eventos se registran acá con addEventListener();
     el HTML no tiene atributos onclick / onsubmit / onchange.
   - Asincronía: el inventario y el umbral crítico se consultan con fetch()
     (async / await) al archivo local data/stock.json.
   - Persistencia: los cambios del usuario (altas, ediciones) se guardan en
     localStorage, que es propio del origen (ej.: http://localhost:8000).
   - Opción 8 (Visor de información técnica): los datos de data/detalles.json se
     piden con fetch() al iniciar, junto con stock.json. Cada producto muestra su
     ubicación en la tabla y un botón "Detalle técnico" que alterna un panel con
     el resto de la ficha. Es la "vista avanzada" del modelo VSDM.
   - Los datos técnicos que edita el administrador se guardan en localStorage
     (clave stockDetalles) y se superponen a los de detalles.json.
   - Selección de nodos: se usa querySelector() en todo el archivo.
   - Sesión y roles (VSDM): antes de dibujar, espera a Sesion.cargar() (sesion.js, que
     consulta el endpoint privado api/perfil.php). Tres vistas sobre los mismos datos:
       visitante      -> vista pública: alertas, tabla y ubicación (solo lectura)
       empleado       -> además alta y edición de productos y el detalle técnico
       administrador  -> además umbral crítico, "Verificar stock" y edición de
                         los datos técnicos
   ========================================================================== */
'use strict';

const RUTA_STOCK = 'data/stock.json';
const RUTA_DETALLES = 'data/detalles.json';
const CLAVE_PRODUCTOS = 'stockProducts';   // misma clave que usaba el sistema antes
const CLAVE_UMBRAL = 'stockUmbral';
const UMBRAL_POR_DEFECTO = 10;
const LADO_MAX_IMAGEN = 300;               // px; evita llenar el límite (~5 MB) de localStorage
const CLAVE_DETALLES = 'stockDetalles';     // datos técnicos editados por el administrador
const COLUMNAS_TABLA = 8;                  // imagen, descripción, cantidad, ubicación, fecha, proveedor, precio, acciones
const LARGO_MAX_DATO_TECNICO = 100;
const SIN_UBICACION = 'Sin asignar';

/* Campos del detalle técnico (claves de detalles.json).
   editable: qué puede modificar el administrador. 'siVacio' = solo se carga si
   todavía no tiene valor (el SKU identifica al producto y no se cambia después). */
const CAMPOS_TECNICOS = [
    { clave: 'sku', etiqueta: 'Código (SKU)', editable: 'siVacio' },
    { clave: 'ubicacion', etiqueta: 'Ubicación', editable: true, ayuda: 'Ej.: Depósito A - Estante 1' },
    { clave: 'lote', etiqueta: 'Lote', editable: true },
    { clave: 'vencimiento', etiqueta: 'Vencimiento', editable: true, tipo: 'date', formatear: (v) => formatearFecha(v) },
    { clave: 'peso', etiqueta: 'Peso / Contenido', editable: true },
    { clave: 'medidas', etiqueta: 'Medidas', editable: true },
    { clave: 'almacenamiento', etiqueta: 'Almacenamiento', editable: true },
    { clave: 'contacto', etiqueta: 'Contacto proveedor', editable: true }
];

/* Estado en memoria de la pantalla */
const estado = {
    productos: [],
    umbral: UMBRAL_POR_DEFECTO,
    editandoId: null,
    imagenNueva: '',         // imagen (data URL) elegida en el formulario de alta
    detalles: {},            // detalles.json + ediciones del administrador, por id de producto
    detallesAbiertos: new Set(),  // ids con el panel técnico desplegado (sobrevive a los re-render)
    editandoDetalleId: null, // producto cuyo detalle técnico está editando el administrador
    sesion: { autenticado: false, usuario: null }  // se completa en iniciar() con Sesion.cargar()
};

/* Atajo de document.querySelector: recibe un selector CSS completo (ej.: '#productName'). */
const $ = (selector) => document.querySelector(selector);

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

/* Datos técnicos editados en este navegador: { "<id>": { ubicacion, lote, ... } } */
function leerDetallesGuardados() {
    try {
        const crudo = localStorage.getItem(CLAVE_DETALLES);
        const datos = crudo === null ? {} : JSON.parse(crudo);
        return datos && typeof datos === 'object' && !Array.isArray(datos) ? datos : {};
    } catch (error) {
        console.error('No se pudieron leer los datos técnicos guardados:', error);
        return {};
    }
}

function guardarDetalleTecnico(id, detalle) {
    const guardados = leerDetallesGuardados();
    guardados[id] = detalle;
    try {
        localStorage.setItem(CLAVE_DETALLES, JSON.stringify(guardados));
        return true;
    } catch (error) {
        console.error(error);
        mostrarMensaje('No se pudieron guardar los datos técnicos en este navegador.', 'error');
        return false;
    }
}

/* Lo editado por el administrador se superpone, campo a campo, a lo que trae detalles.json */
function combinarDetalles(delServidor) {
    const combinados = { ...delServidor };
    Object.entries(leerDetallesGuardados()).forEach(([id, editado]) => {
        combinados[id] = { ...(delServidor[id] || {}), ...editado };
    });
    return combinados;
}

function ubicacionDe(producto) {
    const detalle = estado.detalles[producto.id];
    return detalle && detalle.ubicacion ? detalle.ubicacion : '';
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
    const caja = $('#estadoCarga');
    caja.textContent = texto;
    caja.className = `estado-carga estado-${tipo}`;
    caja.hidden = !texto;
}

function mostrarErrorFormulario(texto) {
    const p = $('#errorMessage');
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

function crearCeldaUbicacion(producto) {
    const ubicacion = ubicacionDe(producto);
    const td = crearCelda(ubicacion || SIN_UBICACION);
    td.className = ubicacion ? 'celda-ubicacion' : 'celda-ubicacion sin-ubicacion';
    return td;
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
        celdas.forEach((input, posicion) => {
            const td = document.createElement('td');
            td.appendChild(input);
            tr.appendChild(td);
            /* La ubicación no se edita acá: es un dato técnico (lo cambia el administrador) */
            if (posicion === 1) tr.appendChild(crearCeldaUbicacion(producto));
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
        tr.appendChild(crearCeldaUbicacion(producto));

        tr.appendChild(crearCelda(producto.receiptDate));
        tr.appendChild(crearCelda(producto.supplier));
        tr.appendChild(crearCelda(`$${Number(producto.purchasePrice).toFixed(2)}`));
    }

    /* Acciones: solo para usuarios autenticados (el visitante tiene la vista pública) */
    if (!estado.sesion.autenticado) return tr;

    const tdAcc = document.createElement('td');
    if (enEdicion) {
        tdAcc.appendChild(crearBoton('Guardar', 'guardar', 'edit-button'));
        tdAcc.appendChild(crearBoton('Cancelar', 'cancelar', 'delete-button'));
    } else {
        tdAcc.appendChild(crearBoton('Editar', 'editar', 'edit-button'));

        /* Opción 8: el panel técnico es la vista avanzada (empleado y administrador) */
        const abierto = estado.detallesAbiertos.has(producto.id);
        const btnDetalle = crearBoton(abierto ? 'Ocultar detalle' : 'Detalle técnico', 'detalle', 'detail-button');
        btnDetalle.setAttribute('aria-expanded', String(abierto));
        btnDetalle.setAttribute('aria-controls', `detalle-${producto.id}`);
        tdAcc.appendChild(btnDetalle);
    }
    tr.appendChild(tdAcc);

    return tr;
}

/* ------------------------------------------------------------------ */
/* Opción 8 - Visor de información técnica (vista avanzada, VSDM)     */
/* ------------------------------------------------------------------ */

/* Fila oculta que queda debajo de cada producto y aloja el panel técnico */
function crearFilaDetalle(producto) {
    const abierto = estado.detallesAbiertos.has(producto.id);

    const tr = document.createElement('tr');
    tr.id = `detalle-${producto.id}`;
    tr.dataset.id = producto.id;            // la delegación de eventos identifica el producto
    tr.className = 'detail-row';
    tr.hidden = !abierto;

    const td = document.createElement('td');
    td.colSpan = COLUMNAS_TABLA;

    const panel = document.createElement('div');
    panel.className = 'tech-panel';
    if (abierto) llenarPanelDetalle(panel, producto);

    td.appendChild(panel);
    tr.appendChild(td);
    return tr;
}

/* Llamada HTTP asíncrona: la ficha técnica de todos los productos (detalles.json) */
async function consultarDetallesServidor() {
    const respuesta = await fetch(RUTA_DETALLES, { cache: 'no-store' });
    if (!respuesta.ok) {
        throw new Error(`HTTP ${respuesta.status} al pedir ${RUTA_DETALLES}`);
    }
    const datos = await respuesta.json();
    return datos && typeof datos === 'object' ? datos : {};
}

function formatearFecha(fechaISO) {
    const partes = String(fechaISO || '').split('-');
    return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : String(fechaISO || '-');
}

/* Se construye con la API del DOM (textContent), sin innerHTML */
function llenarPanelDetalle(panel, producto) {
    panel.replaceChildren();
    const detalle = estado.detalles[producto.id];
    const esAdmin = Sesion.esAdministrador();

    if (esAdmin && estado.editandoDetalleId === producto.id) {
        panel.appendChild(crearFormularioDetalle(producto, detalle || {}));
        return;
    }

    if (!detalle) {
        const aviso = document.createElement('p');
        aviso.className = 'muted';
        aviso.textContent = esAdmin
            ? 'Este producto todavía no tiene información técnica cargada.'
            : 'Este producto todavía no tiene información técnica cargada. Pedile al administrador que la complete.';
        panel.appendChild(aviso);
    } else {
        const lista = document.createElement('dl');
        lista.className = 'tech-grid';
        CAMPOS_TECNICOS.forEach(({ clave, etiqueta, formatear }) => {
            const item = document.createElement('div');
            const dt = document.createElement('dt');
            dt.textContent = etiqueta;
            const dd = document.createElement('dd');
            const valor = detalle[clave];
            const vacio = valor === undefined || valor === null || valor === '';
            dd.textContent = vacio ? '-' : (formatear ? formatear(valor) : String(valor));
            item.append(dt, dd);
            lista.appendChild(item);
        });
        panel.appendChild(lista);
    }

    /* Solo el administrador puede modificar la ficha técnica */
    if (esAdmin) {
        const acciones = document.createElement('div');
        acciones.className = 'tech-acciones';
        acciones.appendChild(crearBoton(detalle ? 'Editar datos técnicos' : 'Cargar datos técnicos', 'editar-detalle', 'edit-button'));
        panel.appendChild(acciones);
    }
}

/* Formulario del administrador. Se envía con el evento "submit" (delegado en el tbody). */
function crearFormularioDetalle(producto, detalle) {
    const form = document.createElement('form');
    form.className = 'tech-form';
    form.dataset.id = producto.id;
    form.noValidate = true;

    const titulo = document.createElement('p');
    titulo.className = 'tech-form-titulo';
    titulo.textContent = `Datos técnicos de: ${producto.productName}`;
    form.appendChild(titulo);

    const grilla = document.createElement('div');
    grilla.className = 'tech-grid';
    CAMPOS_TECNICOS.forEach(({ clave, etiqueta, editable, tipo, ayuda }) => {
        const campo = document.createElement('div');
        campo.className = 'form-field';

        const idInput = `tec-${producto.id}-${clave}`;
        const label = document.createElement('label');
        label.htmlFor = idInput;
        label.textContent = etiqueta;

        const input = document.createElement('input');
        input.id = idInput;
        input.type = tipo || 'text';
        input.dataset.tecnico = clave;
        input.maxLength = LARGO_MAX_DATO_TECNICO;
        /* Para un producto nuevo, el contacto arranca con el proveedor cargado en el alta */
        const valorInicial = detalle[clave] ?? (clave === 'contacto' ? producto.supplier : '');
        input.value = valorInicial || '';
        if (ayuda) input.placeholder = ayuda;
        const bloqueado = editable === false || (editable === 'siVacio' && Boolean(detalle[clave]));
        if (bloqueado) {
            input.readOnly = true;
            input.title = 'Este dato no se puede modificar';
        }

        campo.append(label, input);
        grilla.appendChild(campo);
    });
    form.appendChild(grilla);

    const error = document.createElement('p');
    error.className = 'error tech-form-error';
    error.setAttribute('role', 'alert');
    error.hidden = true;
    form.appendChild(error);

    const acciones = document.createElement('div');
    acciones.className = 'tech-acciones';
    const guardar = crearBoton('Guardar datos técnicos', 'guardar-detalle', 'edit-button');
    guardar.type = 'submit';
    acciones.append(guardar, crearBoton('Cancelar', 'cancelar-detalle', 'delete-button'));
    form.appendChild(acciones);
    return form;
}

function alternarDetalle(boton, id) {
    const fila = $(`#detalle-${id}`);
    const producto = estado.productos.find((p) => p.id === id);
    if (!fila || !producto) return;

    if (!fila.hidden) {
        fila.hidden = true;
        estado.detallesAbiertos.delete(id);
        if (estado.editandoDetalleId === id) estado.editandoDetalleId = null;
        boton.setAttribute('aria-expanded', 'false');
        boton.textContent = 'Detalle técnico';
        return;
    }

    llenarPanelDetalle(fila.querySelector('.tech-panel'), producto);
    estado.detallesAbiertos.add(id);
    fila.hidden = false;
    boton.setAttribute('aria-expanded', 'true');
    boton.textContent = 'Ocultar detalle';
}

/* Guarda lo que cargó el administrador en el formulario técnico */
function alGuardarDetalle(evento) {
    const form = evento.target.closest('form.tech-form');
    if (!form) return;
    evento.preventDefault();
    if (!Sesion.esAdministrador()) return;

    const id = Number(form.dataset.id);
    const anterior = estado.detalles[id] || {};
    const nuevo = { ...anterior };

    form.querySelectorAll('[data-tecnico]').forEach((input) => {
        if (input.readOnly) return;
        nuevo[input.dataset.tecnico] = input.value.trim();
    });

    const error = form.querySelector('.tech-form-error');
    const problema = validarDetalle(nuevo);
    if (problema) {
        error.textContent = problema;
        error.hidden = false;
        return;
    }

    /* Se guardan solo los campos que el administrador puede tocar (más el SKU si recién se cargó) */
    const editado = {};
    CAMPOS_TECNICOS.forEach(({ clave, editable }) => {
        if (editable && nuevo[clave] !== undefined) editado[clave] = nuevo[clave];
    });
    if (!guardarDetalleTecnico(id, editado)) return;

    estado.detalles[id] = nuevo;
    estado.editandoDetalleId = null;
    mostrarMensaje('Datos técnicos actualizados.', 'ok');
    render();
}

function validarDetalle(detalle) {
    if (detalle.vencimiento && !/^\d{4}-\d{2}-\d{2}$/.test(detalle.vencimiento)) {
        return 'La fecha de vencimiento no es válida.';
    }
    const largo = CAMPOS_TECNICOS.find(({ clave }) => String(detalle[clave] ?? '').length > LARGO_MAX_DATO_TECNICO);
    if (largo) {
        return `${largo.etiqueta}: máximo ${LARGO_MAX_DATO_TECNICO} caracteres.`;
    }
    return '';
}

function renderResumen() {
    const total = estado.productos.length;
    const criticos = estado.productos.filter(esCritico);
    $('#resumenTotal').textContent = total;
    $('#resumenCriticos').textContent = criticos.length;
    $('#resumenOk').textContent = total - criticos.length;

    const alerta = $('#alertaStock');
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
    const tbody = $('#productTable').tBodies[0];
    /* Las filas de detalle técnico (vista avanzada) solo existen con sesión iniciada */
    const filas = estado.sesion.autenticado
        ? estado.productos.flatMap((p) => [crearFila(p), crearFilaDetalle(p)])
        : estado.productos.map((producto) => crearFila(producto));
    tbody.replaceChildren(...filas);
    $('#productTableContainer').style.display = estado.productos.length > 0 ? 'block' : 'none';
    $('#umbralCritico').value = estado.umbral;
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
    const vista = $('#preview');
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
    if (!estado.sesion.autenticado) return;

    const productName = $('#productName').value.trim();
    const quantity = $('#quantity').value.trim();
    const receiptDate = $('#receiptDate').value;
    const supplier = $('#supplier').value.trim();
    const purchasePrice = $('#purchasePrice').value.trim();

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
    $('#stockProductForm').reset();
    estado.imagenNueva = '';
    $('#preview').removeAttribute('src');
    $('#preview').style.display = 'none';
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
    if (!estado.sesion.autenticado) return;
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
            /* Promesa encadenada con .catch(): ningún error queda silencioso */
            guardarEdicion(fila, producto).catch((error) => {
                console.error(error);
                mostrarMensaje('No se pudo guardar la edición. Intentá de nuevo.', 'error');
            });
            break;
        case 'detalle':
            alternarDetalle(boton, id);
            break;
        case 'editar-detalle':
            if (!Sesion.esAdministrador()) return;
            estado.editandoDetalleId = id;
            estado.detallesAbiertos.add(id);
            render();
            fila.ownerDocument.querySelector(`#detalle-${id} input:not([readonly])`)?.focus();
            break;
        case 'cancelar-detalle':
            estado.editandoDetalleId = null;
            render();
            break;
    }
}

function alCambiarUmbral(evento) {
    if (!Sesion.esAdministrador()) return;
    const valor = Number(evento.target.value);
    if (evento.target.value === '' || !Number.isFinite(valor) || valor < 0) return;
    estado.umbral = valor;
    guardarUmbral();
    render();
}

/* Vuelve a consultar el "servidor" (stock.json) y re-evalúa las alertas */
async function alVerificarStock() {
    if (!Sesion.esAdministrador()) return;
    const boton = $('#btnVerificar');
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
        $('#ultimaVerificacion').textContent = `Última verificación: ${hora}`;
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
    /* 1) ¿Hay sesión? Se consulta api/perfil.php (200 = autenticado, 401 = visitante).
          Sesion.cargar() nunca rechaza: ante una falla devuelve "visitante". */
    try {
        estado.sesion = await Sesion.cargar();
    } catch (error) {
        console.error(error);
        estado.sesion = { autenticado: false, usuario: null };
    }

    const guardados = leerProductosGuardados();
    const umbralGuardado = leerUmbralGuardado();

    /* 2) Inventario (stock.json) y ficha técnica (detalles.json) se piden en paralelo */
    const [stock, detalles] = await Promise.allSettled([consultarStockServidor(), consultarDetallesServidor()]);

    if (stock.status === 'fulfilled') {
        const datos = stock.value;
        estado.umbral = umbralGuardado ?? (Number.isFinite(datos.umbralCritico) ? datos.umbralCritico : UMBRAL_POR_DEFECTO);
        /* Primera vez: se siembra el inventario con los datos del JSON.
           Después manda lo que el usuario ya guardó en este navegador. */
        const delServidor = datos.productos ?? [];
        estado.productos = guardados ?? delServidor;
        /* Sincronización: si stock.json trae productos nuevos (id que este navegador
           todavía no tiene), se agregan sin pisar lo que el usuario ya editó. */
        const idsLocales = new Set(estado.productos.map((p) => p.id));
        const nuevos = delServidor.filter((p) => !idsLocales.has(p.id));
        estado.productos = [...estado.productos, ...nuevos];
        if (guardados === null || nuevos.length > 0) guardarProductos();
        mostrarMensaje('', 'ok');
    } else {
        console.error(stock.reason);
        estado.umbral = umbralGuardado ?? UMBRAL_POR_DEFECTO;
        estado.productos = guardados ?? [];
        mostrarMensaje('No se pudo cargar data/stock.json (¿abriste el archivo sin servidor?). Se muestran solo los datos guardados en este navegador.', 'error');
    }

    if (detalles.status === 'fulfilled') {
        estado.detalles = combinarDetalles(detalles.value);
    } else {
        console.error(detalles.reason);
        estado.detalles = combinarDetalles({});
        if (stock.status === 'fulfilled') {
            mostrarMensaje('No se pudo cargar data/detalles.json: la ubicación y el detalle técnico pueden aparecer incompletos.', 'error');
        }
    }
    render();
}

/* Registro de todos los eventos (desacoplado del HTML) */
document.addEventListener('DOMContentLoaded', () => {
    $('#stockProductForm').addEventListener('submit', alEnviarFormulario);
    $('#fileInput').addEventListener('change', alElegirImagen);
    $('#productTable').tBodies[0].addEventListener('click', alClickEnTabla);
    $('#umbralCritico').addEventListener('input', alCambiarUmbral);
    $('#btnVerificar').addEventListener('click', alVerificarStock);
    /* El formulario técnico se crea dinámicamente: su "submit" se delega en el tbody */
    $('#productTable').tBodies[0].addEventListener('submit', alGuardarDetalle);
    iniciar().catch((error) => {
        console.error(error);
        mostrarMensaje('Ocurrió un error al cargar el inventario. Recargá la página.', 'error');
    });
});
