/* ============================================================
   api.js — Cliente de la API REST (capa de comunicación de la Vista)

   Toda la comunicación con el servidor pasa por pedir(): fetch() con
   async/await, intercambio de JSON y manejo de los códigos HTTP.
   La Vista nunca accede a la base de datos: solo habla con api/*.php.
   ============================================================ */

const BASE_API = '../api/';

/** Error de la API con el código HTTP y el cuerpo JSON de la respuesta. */
export class ErrorApi extends Error {
    constructor(estado, mensaje, cuerpo = {}) {
        super(mensaje);
        this.name = 'ErrorApi';
        this.estado = estado;   // 400, 401, 403, 404, 409, 500...
        this.cuerpo = cuerpo;
    }
}

/* Función a la que se avisa cuando el servidor responde 401 (sesión vencida).
   La registra app.js para volver a la pantalla de login. */
let alPerderSesion = () => {};
export function registrarPerdidaDeSesion(funcion) {
    alPerderSesion = funcion;
}

/**
 * Pedido HTTP asíncrono a la API.
 * @param {string} ruta    archivo y parámetros, ej.: 'productos.php?id=5'
 * @param {object} opciones { metodo, datos (objeto que viaja como JSON), archivo (FormData) }
 * @returns {Promise<object>} el JSON de la respuesta
 */
export async function pedir(ruta, { metodo = 'GET', datos, archivo, avisarSesion = true } = {}) {
    const configuracion = {
        method: metodo,
        credentials: 'same-origin',          // envía la cookie de sesión
        headers: { Accept: 'application/json' }
    };
    if (datos !== undefined) {
        configuracion.headers['Content-Type'] = 'application/json';
        configuracion.body = JSON.stringify(datos);
    } else if (archivo !== undefined) {
        configuracion.body = archivo;        // multipart/form-data (lo arma el navegador)
    }

    let respuesta;
    try {
        respuesta = await fetch(BASE_API + ruta, configuracion);
    } catch (error) {
        throw new ErrorApi(0, 'No se pudo conectar con el servidor. Verificá que Apache esté iniciado.');
    }

    let cuerpo = {};
    try {
        cuerpo = await respuesta.json();
    } catch (error) {
        cuerpo = {};
    }

    if (!respuesta.ok) {
        if (respuesta.status === 401 && avisarSesion) {
            alPerderSesion();
        }
        throw new ErrorApi(respuesta.status, cuerpo.mensaje || `Error ${respuesta.status} del servidor.`, cuerpo);
    }
    return cuerpo;
}

/* Atajos por recurso: cada uno corresponde a un endpoint del inventario REST. */
export const api = {
    perfil:        () => pedir('perfil.php', { avisarSesion: false }),
    login:         (email, password) => pedir('login.php', { metodo: 'POST', datos: { email, password }, avisarSesion: false }),
    registro:      (datos) => pedir('registro.php', { metodo: 'POST', datos }),
    logout:        () => pedir('logout.php', { metodo: 'POST', avisarSesion: false }),

    productos:     (filtros = {}) => pedir('productos.php' + consulta(filtros)),
    producto:      (id) => pedir(`productos.php?id=${encodeURIComponent(id)}`),
    crearProducto: (datos) => pedir('productos.php', { metodo: 'POST', datos }),
    editarProducto:(id, datos) => pedir(`productos.php?id=${encodeURIComponent(id)}`, { metodo: 'PUT', datos }),
    bajaProducto:  (id) => pedir(`productos.php?id=${encodeURIComponent(id)}`, { metodo: 'DELETE' }),
    subirImagen:   (formulario) => pedir('imagenes.php', { metodo: 'POST', archivo: formulario }),

    ubicacion:     (producto_id, sucursal_id, ubicacion) =>
        pedir('stock.php', { metodo: 'PUT', datos: { producto_id, sucursal_id, ubicacion } }),

    movimientos:   (filtros = {}) => pedir('movimientos.php' + consulta(filtros)),
    registrarMov:  (datos) => pedir('movimientos.php', { metodo: 'POST', datos }),

    alertas:       (dias) => pedir(`alertas.php?dias=${encodeURIComponent(dias)}`),
    sucursales:    () => pedir('sucursales.php'),
    categorias:    () => pedir('categorias.php'),

    usuarios:      () => pedir('usuarios.php'),
    crearUsuario:  (datos) => pedir('usuarios.php', { metodo: 'POST', datos }),
    editarUsuario: (id, datos) => pedir(`usuarios.php?id=${encodeURIComponent(id)}`, { metodo: 'PUT', datos })
};

/** Arma "?clave=valor&..." ignorando los filtros vacíos. */
function consulta(filtros) {
    const parametros = new URLSearchParams();
    Object.entries(filtros).forEach(([clave, valor]) => {
        if (valor !== undefined && valor !== null && valor !== '') {
            parametros.append(clave, valor);
        }
    });
    const texto = parametros.toString();
    return texto ? `?${texto}` : '';
}
