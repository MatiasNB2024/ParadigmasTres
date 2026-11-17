<?php
declare(strict_types=1);

/**
 * api/stock.php  —  Ubicación de un producto en una sucursal
 *
 * PUT api/stock.php     (solo administrador)
 *   { "producto_id": N, "sucursal_id": N, "ubicacion": "Depósito A - Estante 1" }
 *
 * Justificación: CU04 "Consultar stock" muestra dónde está el producto en cada
 * sucursal; el administrador mantiene ese dato. La CANTIDAD no se edita acá:
 * solo cambia con un movimiento (api/movimientos.php).
 *
 * Respuestas:
 *   200 OK · 400 datos inválidos · 401 sin sesión · 403 no es administrador
 *   404 el producto no existe en esa sucursal · 415 no es JSON · 500 error del servidor
 */

require __DIR__ . '/../config/auth.php';
require __DIR__ . '/../models/StockModel.php';

exigir_metodo('PUT');

try {
    exigir_administrador();
    $datos = leer_json_entrada();

    $productoId = campo_entero($datos, 'producto_id');
    $sucursalId = campo_entero($datos, 'sucursal_id');
    if ($productoId === null || $productoId < 1 || $sucursalId === null || $sucursalId < 1) {
        responder_error(400, 'Indicá el producto y la sucursal.');
    }
    if (!array_key_exists('ubicacion', $datos) || !is_string($datos['ubicacion'])) {
        responder_error(400, 'La ubicación debe ser texto.');
    }

    $resultado = (new StockModel(obtener_conexion()))->actualizarUbicacion($productoId, $sucursalId, $datos['ubicacion']);
    responder_exito(200, 'Ubicación actualizada.', ['data' => $resultado]);
} catch (Throwable $e) {
    responder_excepcion($e, 'stock.php');
}
