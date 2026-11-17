<?php
declare(strict_types=1);

/**
 * api/alertas.php  —  CU05 Controlar vencimientos · Controlar bajo stock
 *
 * GET api/alertas.php?dias=30
 *   dias (1 a 365, 30 por defecto): cuántos días hacia adelante se consideran
 *   "próximos a vencer".
 *
 * Respuesta 200:
 *   { data: { dias, bajo_stock: [...], vencidos: [...], por_vencer: [...] } }
 *   bajo_stock: productos con menos unidades que su stock mínimo, por sucursal.
 *
 * Actores: Administrador y Empleado.  401 sin sesión · 400 dias inválido · 500 error.
 */

require __DIR__ . '/../config/auth.php';
require __DIR__ . '/../models/ProductoModel.php';

exigir_metodo('GET');

try {
    exigir_sesion();

    $dias = isset($_GET['dias']) ? campo_entero($_GET, 'dias') : 30;
    if ($dias === null || $dias < 1 || $dias > 365) {
        responder_error(400, 'El parámetro "dias" debe ser un número entre 1 y 365.');
    }

    $modelo = new ProductoModel(obtener_conexion());
    $vencimientos = $modelo->vencimientos($dias);

    responder_exito(200, 'Alertas del inventario.', [
        'data' => [
            'dias'       => $dias,
            'bajo_stock' => $modelo->bajoStock(),
            'vencidos'   => $vencimientos['vencidos'],
            'por_vencer' => $vencimientos['por_vencer'],
        ],
    ]);
} catch (Throwable $e) {
    responder_excepcion($e, 'alertas.php');
}
