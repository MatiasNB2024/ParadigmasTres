/* ============================================================
   Vista Movimientos de mercadería
   Casos de Uso:
     CU02 Registrar entrada de mercadería   (antes "Productos recibidos")
     CU03 Registrar salida de mercadería    (antes "Productos a entregar")
     Transferir stock entre sucursales
     Consultar movimientos (historial)
   El servidor actualiza el stock solo (CU "Actualizar stock") y rechaza con
   409 una salida o transferencia mayor a lo disponible.
   ============================================================ */

import { api, ErrorApi } from '../api.js';
import {
    $, $$, anunciar, clonarPlantilla, crear, datosFormulario, fechaHora, filaVacia,
    llenarSelect, marcarEnviando, mostrarMensaje, parametrosRuta
} from '../ui.js';

const ETIQUETAS_OBSERVACION = {
    entrada: 'Proveedor o remito',
    salida: 'Cliente o motivo (venta, entrega…)',
    transferencia: 'Motivo de la transferencia'
};
const NOMBRES_TIPO = { entrada: 'Entrada', salida: 'Salida', transferencia: 'Transferencia' };

export async function montar(contenedor, contexto) {
    contenedor.replaceChildren(clonarPlantilla('tpl-movimientos'));
    const estado = { contenedor, contexto, productos: [], sucursales: [] };

    const [{ data: productos }, { data: sucursales }] = await Promise.all([api.productos(), api.sucursales()]);
    if (!contexto.vigente()) return;
    estado.productos = productos;
    estado.sucursales = sucursales;

    const opcionesProducto = productos.map((p) => ({ valor: p.id, texto: `${p.codigo} - ${p.nombre}${p.presentacion ? ` (${p.presentacion})` : ''}` }));
    const opcionesSucursal = sucursales.map((s) => ({ valor: s.id, texto: s.nombre }));
    llenarSelect($('#mov-producto', contenedor), opcionesProducto);
    ['#mov-sucursal', '#mov-origen', '#mov-destino'].forEach((id) => llenarSelect($(id, contenedor), opcionesSucursal));
    if (sucursales.length > 1) $('#mov-destino', contenedor).value = String(sucursales[1].id);
    llenarSelect($('#hist-producto', contenedor), opcionesProducto, { conservarPrimera: true });
    llenarSelect($('#hist-sucursal', contenedor), opcionesSucursal, { conservarPrimera: true });

    const form = $('#form-movimiento', contenedor);
    $$('.btn-opcion', form).forEach((boton) => boton.addEventListener('click', () => {
        $('#mov-tipo', contenedor).value = boton.dataset.tipo;
        actualizarCampos(estado);
    }));
    $('#mov-producto', contenedor).addEventListener('change', () => mostrarDisponible(estado));
    form.addEventListener('submit', (evento) => {
        evento.preventDefault();
        registrar(estado).catch((error) => console.error(error));
    });

    const formHistorial = $('#form-historial', contenedor);
    formHistorial.addEventListener('submit', (evento) => {
        evento.preventDefault();
        cargarHistorial(estado).catch((error) => console.error(error));
    });
    formHistorial.addEventListener('reset', () => {
        window.setTimeout(() => cargarHistorial(estado).catch((error) => console.error(error)), 0);
    });

    // Si se llegó desde Stock ("Movimientos" de un producto), ese producto queda elegido
    // en el formulario y el historial se filtra por él.
    const desdeStock = estado.productos.find((p) => String(p.id) === parametrosRuta().get('producto'));
    if (desdeStock) {
        $('#mov-producto', contenedor).value = String(desdeStock.id);
        $('#hist-producto', contenedor).value = String(desdeStock.id);
    }

    actualizarCampos(estado);
    await cargarHistorial(estado);
}

const tipoElegido = (contenedor) => $('#mov-tipo', contenedor).value;

/** Muestra los campos de sucursal que corresponden al tipo de movimiento. */
function actualizarCampos(estado) {
    const { contenedor } = estado;
    const tipo = tipoElegido(contenedor);
    const esTransferencia = tipo === 'transferencia';
    $$('.btn-opcion', contenedor).forEach((boton) => {
        boton.setAttribute('aria-pressed', String(boton.dataset.tipo === tipo));
    });
    $('[data-campo-mov="sucursal"]', contenedor).hidden = esTransferencia;
    $('[data-campo-mov="origen"]', contenedor).hidden = !esTransferencia;
    $('[data-campo-mov="destino"]', contenedor).hidden = !esTransferencia;
    $('#mov-observacion-etiqueta', contenedor).textContent = ETIQUETAS_OBSERVACION[tipo];
    mostrarDisponible(estado);
}

/** Informa cuánto hay del producto elegido en cada sucursal (CU04). */
function mostrarDisponible(estado) {
    const { contenedor } = estado;
    const producto = estado.productos.find((p) => String(p.id) === $('#mov-producto', contenedor).value);
    const salida = $('#mov-disponible', contenedor);
    if (!producto) {
        salida.textContent = '';
        return;
    }
    const detalle = producto.stock.map((s) => `${s.sucursal}: ${s.cantidad}`).join(' · ');
    salida.textContent = `Stock actual de ${producto.nombre}: ${detalle}.`;
}

async function registrar(estado) {
    const { contenedor } = estado;
    const form = $('#form-movimiento', contenedor);
    const mensaje = $('#mov-mensaje', contenedor);
    const valores = datosFormulario(form);
    const cantidad = Number(valores.cantidad);

    if (!valores.producto_id) {
        mostrarMensaje(mensaje, 'Seleccioná un producto.', 'error');
        return;
    }
    if (!Number.isInteger(cantidad) || cantidad < 1) {
        mostrarMensaje(mensaje, 'La cantidad debe ser un número entero mayor que 0.', 'error');
        $('#mov-cantidad', contenedor).focus();
        return;
    }

    const datos = {
        tipo: valores.tipo,
        producto_id: Number(valores.producto_id),
        cantidad,
        observacion: valores.observacion.trim()
    };
    if (valores.tipo === 'transferencia') {
        datos.sucursal_origen_id = Number(valores.sucursal_origen_id);
        datos.sucursal_destino_id = Number(valores.sucursal_destino_id);
        if (datos.sucursal_origen_id === datos.sucursal_destino_id) {
            mostrarMensaje(mensaje, 'La sucursal de origen y la de destino deben ser distintas.', 'error');
            return;
        }
    } else {
        datos.sucursal_id = Number(valores.sucursal_id);
    }

    marcarEnviando(form, true);
    try {
        const { mensaje: textoServidor, data: movimiento } = await api.registrarMov(datos);
        // Se actualiza el stock del producto con lo que quedó en el servidor.
        const { data: actualizado } = await api.producto(movimiento.producto_id);
        estado.productos = estado.productos.map((p) => (p.id === actualizado.id ? actualizado : p));
        mostrarDisponible(estado);

        $('#mov-cantidad', contenedor).value = '';
        $('#mov-observacion', contenedor).value = '';
        await cargarHistorial(estado);   // primero se actualiza el historial, después se avisa

        const texto = `${textoServidor} ${movimiento.cantidad} unidad(es) de ${movimiento.producto}.`;
        mostrarMensaje(mensaje, texto, 'ok');
        anunciar(texto);
    } catch (error) {
        let texto = error.message;
        if (error instanceof ErrorApi && error.estado === 409) {
            texto = `${error.message} No se registró el movimiento.`;
        }
        mostrarMensaje(mensaje, texto, 'error');
    } finally {
        marcarEnviando(form, false);
    }
}

async function cargarHistorial(estado) {
    const { contenedor, contexto } = estado;
    const indicador = $('#historial-estado', contenedor);
    const filtros = datosFormulario($('#form-historial', contenedor));
    if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) {
        indicador.textContent = 'La fecha "desde" no puede ser posterior a la fecha "hasta".';
        return;
    }
    indicador.textContent = 'Consultando historial…';

    try {
        const { data } = await api.movimientos({ ...filtros, limite: 100 });
        if (!contexto.vigente()) return;
        const cuerpo = $('#tabla-historial', contenedor);
        cuerpo.replaceChildren(...(data.length === 0
            ? [filaVacia(8, 'No hay movimientos para esos filtros.')]
            : data.map((m) => crear('tr', {},
                crear('td', { texto: fechaHora(m.fecha) }),
                crear('td', {}, crear('span', { className: `badge badge-${m.tipo}`, texto: NOMBRES_TIPO[m.tipo] })),
                crear('td', { texto: `${m.producto} (${m.codigo})` }),
                crear('td', { className: 'cantidad', texto: m.cantidad }),
                crear('td', { texto: m.sucursal_origen || '-' }),
                crear('td', { texto: m.sucursal_destino || '-' }),
                crear('td', { texto: m.observacion || '-' }),
                crear('td', { texto: m.usuario })))));
        indicador.textContent = data.length === 100
            ? 'Se muestran los 100 movimientos más recientes. Usá los filtros para acotar.'
            : `${data.length} movimiento(s).`;
    } catch (error) {
        if (contexto.vigente()) indicador.textContent = error.message;
    }
}