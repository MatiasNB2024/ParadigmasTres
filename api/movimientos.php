<?php
declare(strict_types=1);

/**
 * api/movimientos.php  —  Controlador REST de movimientos de stock
 *
 * POST api/movimientos.php      CU02 Registrar entrada · CU03 Registrar salida · Transferir stock
 *   Entrada:        { "tipo": "entrada", "producto_id", "sucursal_id", "cantidad", "observacion"? }
 *   Salida:         { "tipo": "salida",  "producto_id", "sucursal_id", "cantidad", "observacion"? }
 *   Transferencia:  { "tipo": "transferencia", "producto_id", "sucursal_origen_id",
 *                     "sucursal_destino_id", "cantidad", "observacion"? }
 *   El stock se actualiza automáticamente (CU "Actualizar stock").
 *
 * GET  api/movimientos.php      Consultar movimientos (historial)
 *   Filtros opcionales: ?producto_id=N&sucursal_id=N&tipo=entrada|salida|transferencia
 *                       &desde=AAAA-MM-DD&hasta=AAAA-MM-DD&limite=1..500 (100 por defecto)
 *
 * Actores: Administrador y Empleado (requiere sesión).
 *
 * Respuestas:
 *   200 OK · 201 Created
 *   400 datos inválidos · 401 sin sesión · 404 el producto no existe
 *   409 stock insuficiente (incluye "disponible")
 *   415 el cuerpo no es application/json · 500 error del servidor
 */

require __DIR__ . '/../config/auth.php';
require __DIR__ . '/../models/MovimientoModel.php';

const TIPOS_MOVIMIENTO = ['entrada', 'salida', 'transferencia'];

exigir_metodos(['GET', 'POST']);

try {
    $usuario = exigir_sesion();
    $modelo = new MovimientoModel(obtener_conexion());

    if (metodo_http() === 'GET') {
        $filtros = [];
        foreach (['producto_id', 'sucursal_id'] as $clave) {
            if (isset($_GET[$clave])) {
                $filtros[$clave] = parametro_id($clave);
            }
        }
        if (isset($_GET['tipo'])) {
            if (!in_array($_GET['tipo'], TIPOS_MOVIMIENTO, true)) {
                responder_error(400, 'El tipo debe ser entrada, salida o transferencia.');
            }
            $filtros['tipo'] = $_GET['tipo'];
        }
        foreach (['desde', 'hasta'] as $clave) {
            if (isset($_GET[$clave])) {
                if (!is_string($_GET[$clave]) || !fecha_valida($_GET[$clave])) {
                    responder_error(400, "La fecha \"$clave\" debe tener el formato AAAA-MM-DD.");
                }
                $filtros[$clave] = $_GET[$clave];
            }
        }
        $limite = isset($_GET['limite']) ? campo_entero($_GET, 'limite') : 100;
        if ($limite === null || $limite < 1 || $limite > 500) {
            responder_error(400, 'El límite debe ser un número entre 1 y 500.');
        }

        $movimientos = $modelo->listar($filtros, $limite);
        responder_exito(200, count($movimientos) . ' movimiento(s).', ['data' => $movimientos]);
    }

    // ---- POST: registrar un movimiento ----
    $datos = leer_json_entrada();
    $tipo = campo_texto($datos, 'tipo');
    $productoId = campo_entero($datos, 'producto_id');
    $cantidad = campo_entero($datos, 'cantidad');
    $observacion = trim(campo_texto($datos, 'observacion'));

    if (!in_array($tipo, TIPOS_MOVIMIENTO, true)) {
        responder_error(400, 'El tipo debe ser entrada, salida o transferencia.');
    }
    if ($productoId === null || $productoId < 1) {
        responder_error(400, 'Seleccioná un producto.');
    }
    if ($cantidad === null) {
        responder_error(400, 'La cantidad debe ser un número entero.');
    }

    if ($tipo === 'transferencia') {
        $origen = campo_entero($datos, 'sucursal_origen_id');
        $destino = campo_entero($datos, 'sucursal_destino_id');
        if ($origen === null || $destino === null) {
            responder_error(400, 'Indicá la sucursal de origen y la de destino.');
        }
        $movimiento = $modelo->registrarTransferencia($productoId, $origen, $destino, $cantidad, $observacion, $usuario['id']);
        responder_exito(201, 'Transferencia registrada.', ['data' => $movimiento]);
    }

    $sucursal = campo_entero($datos, 'sucursal_id');
    if ($sucursal === null) {
        responder_error(400, 'Seleccioná la sucursal.');
    }
    $movimiento = $tipo === 'entrada'
        ? $modelo->registrarEntrada($productoId, $sucursal, $cantidad, $observacion, $usuario['id'])
        : $modelo->registrarSalida($productoId, $sucursal, $cantidad, $observacion, $usuario['id']);

    responder_exito(201, $tipo === 'entrada' ? 'Entrada registrada.' : 'Salida registrada.', ['data' => $movimiento]);
} catch (Throwable $e) {
    responder_excepcion($e, 'movimientos.php');
}
