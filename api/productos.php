<?php
declare(strict_types=1);

/**
 * api/productos.php  —  Controlador REST de productos
 *
 * GET    api/productos.php                     Consultar producto / CU04 Consultar stock
 *        ?buscar=texto&categoria_id=N           (busca por nombre, código o categoría)
 * GET    api/productos.php?id=N                 Consultar un producto
 * POST   api/productos.php                     CU01 Registrar producto       (solo administrador)
 * PUT    api/productos.php?id=N                Modificar producto            (solo administrador)
 * DELETE api/productos.php?id=N                Eliminar producto (baja lógica)(solo administrador)
 *
 * Cuerpo JSON de POST y PUT:
 *   { codigo, nombre, categoria_id, precio, presentacion?, caracteristica?, proveedor?,
 *     vencimiento? (AAAA-MM-DD), lote?, medidas?, almacenamiento?, imagen?, stock_minimo?,
 *     ubicaciones? { "1": "Depósito A - Estante 1", "2": "..." }   (solo en POST)
 *     version (solo en PUT: la que tenía el producto al empezar a editarlo) }
 *
 * Respuestas:
 *   200 OK · 201 Created
 *   400 datos inválidos · 401 sin sesión · 403 no es administrador · 404 no existe
 *   409 código repetido, o el producto fue modificado por otro usuario (CU06)
 *   415 el cuerpo no es application/json · 500 error del servidor
 */

require __DIR__ . '/../config/auth.php';
require __DIR__ . '/../models/ProductoModel.php';

exigir_metodos(['GET', 'POST', 'PUT', 'DELETE']);

try {
    $modelo = new ProductoModel(obtener_conexion());

    switch (metodo_http()) {
        case 'GET':
            exigir_sesion();
            if (isset($_GET['id'])) {
                responder_exito(200, 'Producto encontrado.', ['data' => $modelo->obtener(parametro_id())]);
            }
            $busqueda = trim(is_string($_GET['buscar'] ?? null) ? $_GET['buscar'] : '');
            if (!largo_valido($busqueda, 100)) {
                responder_error(400, 'La búsqueda admite hasta 100 caracteres.');
            }
            $categoriaId = isset($_GET['categoria_id']) ? parametro_id('categoria_id') : null;
            $productos = $modelo->listar($busqueda, $categoriaId);
            responder_exito(200, count($productos) . ' producto(s).', ['data' => $productos]);
            break;

        case 'POST':
            exigir_administrador();
            $producto = $modelo->crear(leer_json_entrada());
            responder_exito(201, 'Producto registrado.', ['data' => $producto]);
            break;

        case 'PUT':
            exigir_administrador();
            $id = parametro_id();
            $datos = leer_json_entrada();
            $version = campo_entero($datos, 'version');
            if ($version === null || $version < 1) {
                responder_error(400, 'Falta la versión del producto (campo "version").');
            }
            $producto = $modelo->actualizar($id, $datos, $version);
            responder_exito(200, 'Producto actualizado.', ['data' => $producto]);
            break;

        case 'DELETE':
            exigir_administrador();
            $modelo->darDeBaja(parametro_id());
            responder_exito(200, 'Producto dado de baja.');
            break;
    }
} catch (Throwable $e) {
    responder_excepcion($e, 'productos.php');
}
