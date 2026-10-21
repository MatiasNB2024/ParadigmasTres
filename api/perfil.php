<?php
declare(strict_types=1);

/**
 * GET api/perfil.php  —  ENDPOINT PRIVADO
 * Devuelve los datos del usuario que tiene la sesión iniciada.
 *
 * Respuestas:
 *   200 OK            { estado: "exito", data: { id, nombre, email, rol, creado_en } }
 *   401 Unauthorized  no hay sesión iniciada
 *
 * El frontend lo consulta al cargar cada página para saber si hay sesión.
 */

require __DIR__ . '/../config/conexion.php';
require __DIR__ . '/../config/helpers.php';

exigir_metodo('GET');

configurar_cookie_sesion();
session_start();

// ---- GUARDIÁN DE SESIÓN ----
// Sin $_SESSION['usuario_id'] no se ejecuta nada más: se responde 401 de inmediato.
if (!isset($_SESSION['usuario_id'])) {
    http_response_code(401);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode(
        ['estado' => 'error', 'mensaje' => 'Acceso no autorizado. Inicie sesión.'],
        JSON_UNESCAPED_UNICODE
    );
    exit;
}

try {
    $pdo = obtener_conexion();

    $consulta = $pdo->prepare(
        'SELECT id, nombre, email, rol, creado_en FROM usuarios WHERE id = :id LIMIT 1'
    );
    $consulta->execute([':id' => (int) $_SESSION['usuario_id']]);
    $usuario = $consulta->fetch();
} catch (PDOException $e) {
    error_log('perfil.php: ' . $e->getMessage());
    responder_error(500, 'Error interno del servidor.');
}

// La sesión apuntaba a un usuario que ya no existe: se invalida.
if (!$usuario) {
    $_SESSION = [];
    session_destroy();
    responder_error(401, 'Acceso no autorizado. La cuenta ya no existe.');
}

responder_exito(200, 'Sesión activa.', [
    'data' => [
        'id'        => (int) $usuario['id'],
        'nombre'    => $usuario['nombre'],
        'email'     => $usuario['email'],
        'rol'       => $usuario['rol'],
        'creado_en' => $usuario['creado_en'],
    ],
]);
