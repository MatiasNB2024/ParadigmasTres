<?php
declare(strict_types=1);

/**
 * GET api/categorias.php  —  Lista de categorías de producto.
 * Casos de Uso: CU01 Registrar producto (dato obligatorio) y CU04 (buscar por categoría).
 * 200 OK { data: [ { id, nombre } ] } · 401 sin sesión · 500 error del servidor
 */

require __DIR__ . '/../config/auth.php';
require __DIR__ . '/../models/CatalogoModel.php';

exigir_metodo('GET');

try {
    exigir_sesion();
    responder_exito(200, 'Categorías.', ['data' => (new CatalogoModel(obtener_conexion()))->categorias()]);
} catch (Throwable $e) {
    responder_excepcion($e, 'categorias.php');
}
