<?php
declare(strict_types=1);

/**
 * GET api/sucursales.php  —  Lista de sucursales para los formularios.
 * Casos de Uso: CU02, CU03, CU04, Consultar stock de otra sucursal, Transferir stock.
 * 200 OK { data: [ { id, nombre } ] } · 401 sin sesión · 500 error del servidor
 */

require __DIR__ . '/../config/auth.php';
require __DIR__ . '/../models/CatalogoModel.php';

exigir_metodo('GET');

try {
    exigir_sesion();
    responder_exito(200, 'Sucursales.', ['data' => (new CatalogoModel(obtener_conexion()))->sucursales()]);
} catch (Throwable $e) {
    responder_excepcion($e, 'sucursales.php');
}
