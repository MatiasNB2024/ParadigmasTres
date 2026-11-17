/* ============================================================
   Vista Stock de productos
   Casos de Uso:
     CU04 Consultar stock (y el de la otra sucursal) · Consultar producto
     CU01 Registrar producto · Modificar producto · Eliminar producto  (administrador)
     CU06 Validar concurrencia: si otro usuario modificó el producto, el
          servidor responde 409 y el formulario se recarga con los datos actuales.
   (evolución de stockproductos.html de la AE1/AE2)
   ============================================================ */

import { api, ErrorApi } from '../api.js';
import { Sesion } from '../sesion.js';
import {
    $, $$, anunciar, clonarPlantilla, crear, datosFormulario, fecha, filaVacia,
    llenarSelect, marcarEnviando, moneda, mostrarMensaje, textoOculto
} from '../ui.js';

const TAMANIO_MAXIMO_IMAGEN = 2 * 1024 * 1024;

export async function montar(contenedor, contexto) {
    contenedor.replaceChildren(clonarPlantilla('tpl-stock'));

    const estado = {
        contenedor,
        contexto,
        productos: [],
        sucursales: [],
        abiertos: new Set(),      // productos con el detalle desplegado
        confirmandoBaja: null,    // id del producto que se está por dar de baja
        editando: null,           // producto que se está modificando (null = alta)
        urlVistaPrevia: null
    };

    // Las secciones de administrador solo se muestran a ese rol (la API igual lo valida).
    $$('[data-solo-admin]', contenedor).forEach((el) => { el.hidden = !Sesion.esAdministrador(); });

    const [{ data: sucursales }, { data: categorias }] = await Promise.all([api.sucursales(), api.categorias()]);
    if (!contexto.vigente()) return;
    estado.sucursales = sucursales;

    const opcionesCategoria = categorias.map((c) => ({ valor: c.id, texto: c.nombre }));
    llenarSelect($('#busqueda-categoria', contenedor), opcionesCategoria, { conservarPrimera: true });
    llenarSelect($('#producto-categoria', contenedor), opcionesCategoria);
    armarEncabezados(estado);
    armarCamposUbicacion(estado);
    registrarEventos(estado);

    await cargarProductos(estado);
}

// ------------------------------------------------------------------
// Estructura que depende de las sucursales
// ------------------------------------------------------------------

/** Una columna por sucursal (cantidad y ubicación), antes de "Total". */
function armarEncabezados(estado) {
    const fila = $('#stock-encabezados', estado.contenedor);
    const total = fila.children[fila.children.length - 2];
    estado.sucursales.forEach((sucursal) => {
        fila.insertBefore(crear('th', { scope: 'col', texto: sucursal.nombre }), total);
    });
}

function armarCamposUbicacion(estado) {
    $('#producto-ubicaciones', estado.contenedor).replaceChildren(...estado.sucursales.map((sucursal) =>
        crear('div', { className: 'form-field' },
            crear('label', { for: `producto-ubicacion-${sucursal.id}`, texto: sucursal.nombre }),
            crear('input', {
                type: 'text', id: `producto-ubicacion-${sucursal.id}`, maxlength: 100,
                placeholder: 'Ej.: Depósito A - Estante 1', dataset: { sucursal: sucursal.id }
            }))));
}

const totalColumnas = (estado) => 6 + estado.sucursales.length;

// ------------------------------------------------------------------
// Eventos (addEventListener, sin atributos onclick en el HTML)
// ------------------------------------------------------------------

function registrarEventos(estado) {
    const { contenedor } = estado;

    const formBusqueda = $('#form-busqueda', contenedor);
    formBusqueda.addEventListener('submit', (evento) => {
        evento.preventDefault();
        cargarProductos(estado).catch((error) => console.error(error));
    });
    formBusqueda.addEventListener('reset', () => {
        // "reset" ocurre antes de limpiar los campos: se espera al próximo ciclo.
        window.setTimeout(() => cargarProductos(estado).catch((error) => console.error(error)), 0);
    });

    // Delegación: un solo listener atiende los botones de todas las filas.
    $('#tabla-stock-cuerpo', contenedor).addEventListener('click', (evento) => {
        const boton = evento.target.closest('button[data-accion]');
        if (boton) alAccionarFila(estado, boton);
    });

    if (!Sesion.esAdministrador()) return;

    $('#btn-nuevo-producto', contenedor).addEventListener('click', (evento) => {
        abrirFormulario(estado, null, evento.currentTarget);
    });
    $('#form-producto', contenedor).addEventListener('submit', (evento) => {
        evento.preventDefault();
        guardarProducto(estado).catch((error) => console.error(error));
    });
    $('[data-accion="cancelar-producto"]', contenedor).addEventListener('click', () => cerrarFormulario(estado));
    $('#producto-imagen', contenedor).addEventListener('change', (evento) => mostrarVistaPrevia(estado, evento.currentTarget));
}

function alAccionarFila(estado, boton) {
    const id = Number(boton.dataset.id);
    const producto = estado.productos.find((p) => p.id === id);
    if (!producto) return;

    switch (boton.dataset.accion) {
        case 'detalle':
            alternarDetalle(estado, producto, boton);
            break;
        case 'editar':
            abrirFormulario(estado, producto, boton);
            break;
        case 'baja':
            estado.confirmandoBaja = id;
            renderizar(estado);
            $(`button[data-accion="confirmar-baja"][data-id="${id}"]`, estado.contenedor).focus();
            break;
        case 'cancelar-baja':
            estado.confirmandoBaja = null;
            renderizar(estado);
            $(`button[data-accion="baja"][data-id="${id}"]`, estado.contenedor).focus();
            break;
        case 'confirmar-baja':
            darDeBaja(estado, producto).catch((error) => console.error(error));
            break;
    }
}

// ------------------------------------------------------------------
// CU04: consultar stock
// ------------------------------------------------------------------

async function cargarProductos(estado) {
    const { contenedor, contexto } = estado;
    const indicador = $('#stock-estado', contenedor);
    const filtros = datosFormulario($('#form-busqueda', contenedor));
    indicador.textContent = 'Buscando productos…';

    try {
        const { data } = await api.productos({ buscar: filtros.buscar.trim(), categoria_id: filtros.categoria_id });
        if (!contexto.vigente()) return;
        estado.productos = data;
        renderizar(estado);
        const bajos = data.filter((p) => p.stock.some((s) => s.cantidad < p.stock_minimo)).length;
        indicador.textContent = data.length === 0
            ? 'No se encontraron productos con esa búsqueda.'
            : `${data.length} producto(s) encontrados. ${bajos} con bajo stock en alguna sucursal.`;
    } catch (error) {
        if (contexto.vigente()) indicador.textContent = error.message;
    }
}

function renderizar(estado) {
    const cuerpo = $('#tabla-stock-cuerpo', estado.contenedor);
    if (estado.productos.length === 0) {
        cuerpo.replaceChildren(filaVacia(totalColumnas(estado), 'No hay productos para mostrar.'));
        return;
    }
    cuerpo.replaceChildren(...estado.productos.flatMap((producto) => [crearFila(estado, producto), crearFilaDetalle(estado, producto)]));
}

function crearFila(estado, producto) {
    const celdaImagen = producto.imagen
        ? crear('td', {}, crear('img', { src: producto.imagen, alt: producto.nombre, className: 'producto-imagen', width: 64, height: 64, loading: 'lazy' }))
        : crear('td', { className: 'texto-secundario', texto: 'Sin imagen' });

    const celdasSucursal = estado.sucursales.map((sucursal) => {
        const fila = producto.stock.find((s) => s.sucursal_id === sucursal.id) || { cantidad: 0, ubicacion: '' };
        const celda = crear('td', {}, crear('span', { className: 'cantidad', texto: fila.cantidad }));
        if (fila.cantidad === 0) {
            celda.append(' ', crear('span', { className: 'badge badge-critico', texto: 'Agotado' }));
        } else if (fila.cantidad < producto.stock_minimo) {
            celda.append(' ', crear('span', { className: 'badge badge-alerta', texto: 'Bajo stock' }));
        }
        celda.append(crear('span', {
            className: fila.ubicacion ? 'ubicacion' : 'ubicacion sin-ubicacion',
            texto: fila.ubicacion ? `Ubicación: ${fila.ubicacion}` : 'Sin ubicación asignada'
        }));
        return celda;
    });

    return crear('tr', {},
        celdaImagen,
        crear('td', { texto: producto.codigo }),
        crear('td', {},
            crear('span', { className: 'producto-nombre', texto: producto.nombre }),
            producto.presentacion ? crear('span', { className: 'texto-secundario', texto: producto.presentacion }) : null),
        crear('td', { texto: producto.categoria }),
        ...celdasSucursal,
        crear('td', { className: 'cantidad', texto: producto.stock_total }),
        crear('td', {}, crear('div', { className: 'acciones' }, ...botonesDeAccion(estado, producto))));
}

function botonesDeAccion(estado, producto) {
    const abierto = estado.abiertos.has(producto.id);
    const detalle = crear('button', {
        type: 'button', className: 'btn btn-detalle', 'data-accion': 'detalle', 'data-id': producto.id,
        'aria-expanded': String(abierto), 'aria-controls': `detalle-${producto.id}`
    }, abierto ? 'Ocultar detalle' : 'Ver detalle', textoOculto(` de ${producto.nombre}`));

    // Relación Stock -> Movimientos: lleva al historial del producto y lo deja elegido
    // para registrar una entrada, salida o transferencia (CU02, CU03).
    const movimientos = crear('a', {
        className: 'btn btn-secundario', href: `#/movimientos?producto=${producto.id}`
    }, 'Movimientos', textoOculto(` de ${producto.nombre}`));

    if (!Sesion.esAdministrador()) return [detalle, movimientos];

    if (estado.confirmandoBaja === producto.id) {
        return [
            crear('span', { className: 'confirmacion', texto: '¿Dar de baja este producto?' }),
            crear('button', { type: 'button', className: 'btn btn-peligro', 'data-accion': 'confirmar-baja', 'data-id': producto.id },
                'Sí, dar de baja', textoOculto(` ${producto.nombre}`)),
            crear('button', { type: 'button', className: 'btn btn-secundario', 'data-accion': 'cancelar-baja', 'data-id': producto.id },
                'Cancelar')
        ];
    }
    return [
        detalle,
        movimientos,
        crear('button', { type: 'button', className: 'btn', 'data-accion': 'editar', 'data-id': producto.id },
            'Editar', textoOculto(` ${producto.nombre}`)),
        crear('button', { type: 'button', className: 'btn btn-peligro', 'data-accion': 'baja', 'data-id': producto.id },
            'Dar de baja', textoOculto(` ${producto.nombre}`))
    ];
}

/** Fila con la ficha técnica completa (vista avanzada del producto). */
function crearFilaDetalle(estado, producto) {
    const datos = [
        ['Código', producto.codigo],
        ['Categoría', producto.categoria],
        ['Peso o cantidad', producto.presentacion],
        ['Característica del paquete', producto.caracteristica],
        ['Precio de compra', moneda(producto.precio)],
        ['Proveedor', producto.proveedor],
        ['Vencimiento', fecha(producto.vencimiento)],
        ['Lote', producto.lote],
        ['Medidas', producto.medidas],
        ['Almacenamiento', producto.almacenamiento],
        ['Stock mínimo por sucursal', producto.stock_minimo],
        ...producto.stock.map((s) => [`Ubicación en ${s.sucursal}`, s.ubicacion || 'Sin asignar'])
    ];
    const lista = crear('dl', { className: 'ficha-tecnica' }, ...datos.map(([titulo, valor]) =>
        crear('div', {}, crear('dt', { texto: titulo }), crear('dd', { texto: valor === '' || valor === null ? '-' : valor }))));

    return crear('tr', { id: `detalle-${producto.id}`, className: 'fila-detalle', hidden: !estado.abiertos.has(producto.id) },
        crear('td', { colspan: totalColumnas(estado) },
            crear('h3', { className: 'visually-hidden', texto: `Ficha técnica de ${producto.nombre}` }),
            lista));
}

function alternarDetalle(estado, producto, boton) {
    const fila = $(`#detalle-${producto.id}`, estado.contenedor);
    const abrir = fila.hidden;
    fila.hidden = !abrir;
    if (abrir) estado.abiertos.add(producto.id); else estado.abiertos.delete(producto.id);
    boton.setAttribute('aria-expanded', String(abrir));
    boton.firstChild.textContent = abrir ? 'Ocultar detalle' : 'Ver detalle';
}

// ------------------------------------------------------------------
// CU01 Registrar producto · Modificar producto (administrador)
// ------------------------------------------------------------------

function abrirFormulario(estado, producto, origen) {
    const { contenedor } = estado;
    const seccion = $('#seccion-producto', contenedor);
    const form = $('#form-producto', contenedor);

    estado.editando = producto;
    estado.origenFoco = origen;
    form.reset();
    mostrarMensaje($('#producto-mensaje', contenedor), '', 'info');
    $('#titulo-form-producto', contenedor).textContent = producto ? `Modificar producto: ${producto.nombre}` : 'Registrar producto';
    $('#btn-guardar-producto', contenedor).textContent = producto ? 'Guardar cambios' : 'Registrar producto';
    if (producto) llenarFormulario(estado, producto);
    else limpiarVistaPrevia(estado);

    seccion.hidden = false;
    $('#btn-nuevo-producto', contenedor).setAttribute('aria-expanded', 'true');
    $('#titulo-form-producto', contenedor).focus();
}

function llenarFormulario(estado, producto) {
    const { contenedor } = estado;
    const campos = ['codigo', 'nombre', 'presentacion', 'caracteristica', 'precio', 'proveedor', 'lote', 'medidas', 'almacenamiento'];
    campos.forEach((campo) => { $(`[name="${campo}"]`, contenedor).value = producto[campo] ?? ''; });
    $('#producto-categoria', contenedor).value = String(producto.categoria_id);
    $('#producto-vencimiento', contenedor).value = producto.vencimiento || '';
    $('#producto-stock-minimo', contenedor).value = String(producto.stock_minimo);
    producto.stock.forEach((s) => {
        const campo = $(`#producto-ubicacion-${s.sucursal_id}`, contenedor);
        if (campo) campo.value = s.ubicacion;
    });
    limpiarVistaPrevia(estado);
    if (producto.imagen) {
        const vista = $('#producto-imagen-vista', contenedor);
        vista.src = producto.imagen;
        vista.hidden = false;
    }
}

function cerrarFormulario(estado) {
    const { contenedor } = estado;
    $('#seccion-producto', contenedor).hidden = true;
    $('#btn-nuevo-producto', contenedor).setAttribute('aria-expanded', 'false');
    limpiarVistaPrevia(estado);
    estado.editando = null;
    const origen = estado.origenFoco && estado.origenFoco.isConnected ? estado.origenFoco : $('#btn-nuevo-producto', contenedor);
    origen.focus();
}

function mostrarVistaPrevia(estado, input) {
    const vista = $('#producto-imagen-vista', estado.contenedor);
    const archivo = input.files[0];
    limpiarVistaPrevia(estado);
    if (!archivo) return;
    estado.urlVistaPrevia = URL.createObjectURL(archivo);
    vista.src = estado.urlVistaPrevia;
    vista.hidden = false;
}

function limpiarVistaPrevia(estado) {
    if (estado.urlVistaPrevia) URL.revokeObjectURL(estado.urlVistaPrevia);
    estado.urlVistaPrevia = null;
    const vista = $('#producto-imagen-vista', estado.contenedor);
    vista.removeAttribute('src');
    vista.hidden = true;
}

async function guardarProducto(estado) {
    const { contenedor } = estado;
    const form = $('#form-producto', contenedor);
    const mensaje = $('#producto-mensaje', contenedor);
    const valores = datosFormulario(form);
    const archivo = $('#producto-imagen', contenedor).files[0];

    // Validación de comodidad (la definitiva la hace el servidor y responde 400).
    if (!valores.codigo.trim() || !valores.nombre.trim() || valores.precio === '' || valores.stock_minimo === '') {
        mostrarMensaje(mensaje, 'Completá los campos obligatorios: código, nombre, precio y stock mínimo.', 'error');
        return;
    }
    if (archivo && archivo.size > TAMANIO_MAXIMO_IMAGEN) {
        mostrarMensaje(mensaje, 'La imagen no puede superar los 2 MB.', 'error');
        return;
    }

    const datos = {
        codigo: valores.codigo.trim(),
        nombre: valores.nombre.trim(),
        categoria_id: Number(valores.categoria_id),
        presentacion: valores.presentacion.trim(),
        caracteristica: valores.caracteristica.trim(),
        precio: Number(valores.precio),
        proveedor: valores.proveedor.trim(),
        vencimiento: valores.vencimiento || null,
        lote: valores.lote.trim(),
        medidas: valores.medidas.trim(),
        almacenamiento: valores.almacenamiento.trim(),
        stock_minimo: Number(valores.stock_minimo),
        imagen: estado.editando ? estado.editando.imagen : null
    };
    const ubicaciones = {};
    $$('[data-sucursal]', form).forEach((input) => { ubicaciones[input.dataset.sucursal] = input.value.trim(); });

    marcarEnviando(form, true);
    mostrarMensaje(mensaje, 'Guardando…', 'info');
    try {
        if (archivo) {
            const formulario = new FormData();
            formulario.append('imagen', archivo);
            datos.imagen = (await api.subirImagen(formulario)).data.ruta;
        }

        let guardado;
        if (estado.editando) {
            datos.version = estado.editando.version;
            guardado = (await api.editarProducto(estado.editando.id, datos)).data;
            // La ubicación se guarda en la tabla stock (api/stock.php), una por sucursal.
            for (const fila of guardado.stock) {
                const nueva = ubicaciones[fila.sucursal_id] ?? fila.ubicacion;
                if (nueva !== fila.ubicacion) await api.ubicacion(guardado.id, fila.sucursal_id, nueva);
            }
        } else {
            datos.ubicaciones = ubicaciones;
            guardado = (await api.crearProducto(datos)).data;
        }

        const texto = estado.editando ? `Producto "${guardado.nombre}" actualizado.` : `Producto "${guardado.nombre}" registrado.`;
        marcarEnviando(form, false);
        cerrarFormulario(estado);
        await cargarProductos(estado);
        mostrarMensaje(mensaje, '', 'info');
        anunciar(texto);
        mostrarMensaje($('#stock-estado', contenedor), texto, 'ok');
    } catch (error) {
        marcarEnviando(form, false);
        if (error instanceof ErrorApi && error.estado === 409 && error.cuerpo.data) {
            // CU06: otro usuario guardó antes. Se cargan sus datos para no pisarlos.
            estado.editando = error.cuerpo.data;
            llenarFormulario(estado, error.cuerpo.data);
        }
        mostrarMensaje(mensaje, error.message, 'error');
    }
}

// ------------------------------------------------------------------
// Eliminar producto (baja lógica, administrador)
// ------------------------------------------------------------------

async function darDeBaja(estado, producto) {
    try {
        await api.bajaProducto(producto.id);
        estado.confirmandoBaja = null;
        estado.abiertos.delete(producto.id);
        await cargarProductos(estado);
        const texto = `Producto "${producto.nombre}" dado de baja.`;
        anunciar(texto);
        mostrarMensaje($('#stock-estado', estado.contenedor), texto, 'ok');
        $('#busqueda-texto', estado.contenedor).focus();
    } catch (error) {
        estado.confirmandoBaja = null;
        renderizar(estado);
        mostrarMensaje($('#stock-estado', estado.contenedor), error.message, 'error');
    }
}
