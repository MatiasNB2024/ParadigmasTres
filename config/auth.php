<?php
declare(strict_types=1);

require_once __DIR__ . '/conexion.php';
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/../models/UsuarioModel.php';

/**
 * Control de acceso del servidor (OWASP A01 / A07).
 *
 * La sesión solo guarda el id del usuario ($_SESSION['usuario_id']). El rol y
 * el estado (activo) se leen SIEMPRE de la base en cada pedido: si un
 * administrador cambia el rol de alguien o lo deshabilita, rige desde el
 * próximo pedido, sin esperar a que esa persona cierre sesión.
 */

/** Usuario de la sesión actual, o null si no hay sesión válida. */
function usuario_actual(): ?array
{
    static $resuelto = false;
    static $usuario = null;
    if ($resuelto) {
        return $usuario;
    }
    $resuelto = true;

    configurar_cookie_sesion();
    session_start();

    if (!isset($_SESSION['usuario_id'])) {
        session_write_close();
        return null;
    }

    try {
        $usuario = (new UsuarioModel(obtener_conexion()))->buscarPorId((int) $_SESSION['usuario_id']);
    } catch (PDOException $e) {
        error_log('auth.php: ' . $e->getMessage());
        responder_error(500, 'Error interno del servidor.');
    }

    // La cuenta ya no existe o fue deshabilitada: la sesión se invalida.
    if ($usuario === null || !$usuario['activo']) {
        $_SESSION = [];
        session_destroy();
        $usuario = null;
        return null;
    }

    // Se libera el archivo de sesión: así varios pedidos del mismo usuario
    // (por ejemplo, fetch() en paralelo) no quedan esperando uno detrás de otro.
    session_write_close();
    return $usuario;
}

/**
 * GUARDIÁN DE SESIÓN: sin sesión iniciada, se interrumpe la ejecución con
 * 401 Unauthorized. Devuelve el usuario autenticado.
 */
function exigir_sesion(): array
{
    $usuario = usuario_actual();
    if ($usuario === null) {
        responder_error(401, 'Acceso no autorizado. Inicie sesión.');
    }
    return $usuario;
}

/**
 * Para las operaciones que los Casos de Uso asignan solo al Administrador.
 *  401 si no hay sesión · 403 Forbidden si hay sesión pero no es administrador.
 */
function exigir_administrador(): array
{
    $usuario = exigir_sesion();
    if ($usuario['rol'] !== 'administrador') {
        responder_error(403, 'Acción permitida solo para administradores.');
    }
    return $usuario;
}

/**
 * Traduce las excepciones de los modelos al código HTTP correspondiente.
 * Cualquier otra excepción (por ejemplo, PDOException) es un 500 sin detalles
 * para el cliente; el detalle técnico queda en el log del servidor.
 */
function responder_excepcion(Throwable $e, string $contexto): void
{
    if ($e instanceof DatoInvalidoException) {
        responder_error(400, $e->getMessage());
    }
    if ($e instanceof NoEncontradoException) {
        responder_error(404, $e->getMessage());
    }
    if ($e instanceof ConflictoException) {
        responder_error(409, $e->getMessage(), $e->getDetalle());
    }
    error_log($contexto . ': ' . $e->getMessage());
    responder_error(500, 'Error interno del servidor.');
}
