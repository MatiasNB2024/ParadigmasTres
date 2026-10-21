<?php
declare(strict_types=1);

/**
 * POST api/logout.php
 * Cierra la sesión: vacía $_SESSION, borra la cookie y destruye la sesión en el servidor.
 */

require __DIR__ . '/../config/helpers.php';

exigir_metodo('POST');

configurar_cookie_sesion();
session_start();

$_SESSION = [];

if (ini_get('session.use_cookies')) {
    $cookie = session_get_cookie_params();
    setcookie(session_name(), '', [
        'expires'  => time() - 42000,
        'path'     => $cookie['path'],
        'domain'   => $cookie['domain'],
        'secure'   => $cookie['secure'],
        'httponly' => $cookie['httponly'],
        'samesite' => $cookie['samesite'] ?? 'Lax',
    ]);
}

session_destroy();

responder_exito(200, 'Sesión cerrada correctamente.');
