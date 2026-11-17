/* ============================================================
   Vista Mi perfil: datos de la cuenta (api/perfil.php)
   ============================================================ */

import { api } from '../api.js';
import { $, clonarPlantilla, crear, fechaHora } from '../ui.js';

export async function montar(contenedor, contexto) {
    contenedor.replaceChildren(clonarPlantilla('tpl-perfil'));
    const lista = $('#perfil-datos', contenedor);

    const { data: usuario } = await api.perfil();
    if (!contexto.vigente()) return;

    const datos = [
        ['Nombre', usuario.nombre],
        ['Correo electrónico', usuario.email],
        ['Rol', usuario.rol],
        ['Cuenta creada', fechaHora(usuario.creado_en)]
    ];
    lista.replaceChildren(...datos.map(([titulo, valor]) =>
        crear('div', { className: 'dato' }, crear('dt', { texto: titulo }), crear('dd', { texto: valor }))));
}
