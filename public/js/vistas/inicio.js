/* ============================================================
   Vista Inicio: resumen del inventario y alertas
   Casos de Uso: CU05 "Controlar vencimientos" y "Controlar bajo stock"
   ============================================================ */

import { api } from '../api.js';
import { Sesion } from '../sesion.js';
import { $, clonarPlantilla, crear, fecha, filaVacia } from '../ui.js';

export async function montar(contenedor, contexto) {
    contenedor.replaceChildren(clonarPlantilla('tpl-inicio'));
    const usuario = Sesion.usuario();
    $('#inicio-saludo', contenedor).textContent =
        `Hola, ${usuario.nombre}. Ingresaste como ${usuario.rol}.`;

    $('#form-vencimientos', contenedor).addEventListener('submit', (evento) => {
        evento.preventDefault();
        const dias = $('#vencimientos-dias', contenedor).value;
        cargarAlertas(contenedor, contexto, dias).catch((error) => console.error(error));
    });

    // Resumen y alertas se piden en paralelo (no bloquean la interfaz).
    await Promise.all([
        cargarResumen(contenedor, contexto),
        cargarAlertas(contenedor, contexto, $('#vencimientos-dias', contenedor).value)
    ]);
}

async function cargarResumen(contenedor, contexto) {
    const lista = $('#inicio-resumen', contenedor);
    try {
        const [{ data: productos }, { data: sucursales }] = await Promise.all([api.productos(), api.sucursales()]);
        if (!contexto.vigente()) return;

        const items = [crearItem('Productos activos', productos.length)];
        sucursales.forEach((sucursal) => {
            const unidades = productos.reduce((total, producto) => {
                const fila = producto.stock.find((s) => s.sucursal_id === sucursal.id);
                return total + (fila ? fila.cantidad : 0);
            }, 0);
            items.push(crearItem(`Unidades en ${sucursal.nombre}`, unidades));
        });
        lista.replaceChildren(...items);
    } catch (error) {
        if (contexto.vigente()) lista.replaceChildren(crear('li', { className: 'resumen-item', texto: error.message }));
    }
}

function crearItem(titulo, valor) {
    return crear('li', { className: 'resumen-item' },
        crear('span', { className: 'resumen-valor', texto: valor }),
        crear('span', { className: 'resumen-titulo', texto: titulo }));
}

async function cargarAlertas(contenedor, contexto, dias) {
    const estadoBajo = $('#bajo-stock-estado', contenedor);
    const estadoVenc = $('#vencimientos-estado', contenedor);
    estadoVenc.textContent = 'Consultando…';

    try {
        const { data } = await api.alertas(dias);
        if (!contexto.vigente()) return;

        // ---- Bajo stock ----
        const cuerpoBajo = $('#tabla-bajo-stock', contenedor);
        estadoBajo.textContent = data.bajo_stock.length === 0
            ? 'No hay productos por debajo del stock mínimo.'
            : `${data.bajo_stock.length} alerta(s) de bajo stock.`;
        cuerpoBajo.replaceChildren(...(data.bajo_stock.length === 0
            ? [filaVacia(5, 'Sin alertas.')]
            : data.bajo_stock.map((item) => crear('tr', { className: item.agotado ? 'fila-critica' : '' },
                crear('td', { texto: `${item.nombre} (${item.codigo})` }),
                crear('td', { texto: item.sucursal }),
                crear('td', {},
                    crear('span', { texto: item.cantidad }), ' ',
                    crear('span', { className: item.agotado ? 'badge badge-critico' : 'badge badge-alerta', texto: item.agotado ? 'Agotado' : 'Bajo stock' })),
                crear('td', { texto: item.stock_minimo }),
                crear('td', { texto: item.ubicacion || 'Sin asignar' })))));

        // ---- Vencimientos ----
        const cuerpoVenc = $('#tabla-vencimientos', contenedor);
        const filas = [
            ...data.vencidos.map((item) => filaVencimiento(item, true)),
            ...data.por_vencer.map((item) => filaVencimiento(item, false))
        ];
        estadoVenc.textContent = `${data.vencidos.length} producto(s) vencido(s) y ${data.por_vencer.length} por vencer en los próximos ${data.dias} días.`;
        cuerpoVenc.replaceChildren(...(filas.length ? filas : [filaVacia(5, 'No hay vencimientos en ese período.')]));
    } catch (error) {
        if (!contexto.vigente()) return;
        estadoBajo.textContent = error.message;
        estadoVenc.textContent = error.message;
    }
}

function filaVencimiento(item, vencido) {
    const estado = vencido
        ? `Vencido hace ${Math.abs(item.dias_restantes)} día(s)`
        : (item.dias_restantes === 0 ? 'Vence hoy' : `Vence en ${item.dias_restantes} día(s)`);
    return crear('tr', { className: vencido ? 'fila-critica' : '' },
        crear('td', { texto: `${item.nombre} (${item.codigo})` }),
        crear('td', { texto: item.lote || '-' }),
        crear('td', { texto: fecha(item.vencimiento) }),
        crear('td', {}, crear('span', { className: vencido ? 'badge badge-critico' : 'badge badge-alerta', texto: estado })),
        crear('td', { texto: item.stock_total }));
}
