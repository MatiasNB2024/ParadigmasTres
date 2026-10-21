<?php
declare(strict_types=1);

/**
 * POST api/login.php
 * Recibe JSON: { "email": "...", "password": "..." }
 *
 * Respuestas:
 *   200 OK                   credenciales correctas (se inicia la sesión)
 *   400 Bad Request          faltan campos o JSON inválido
 *   401 Unauthorized         credenciales incorrectas
 *   405 / 500                método no permitido / error del servidor
 */

require __DIR__ . '/../config/conexion.php';
require __DIR__ . '/../config/helpers.php';

// Hash BCRYPT de relleno (no corresponde a ninguna clave real). Se usa cuando el correo no
// existe, para que password_verify() tarde lo mismo y no se pueda averiguar por el tiempo
// de respuesta qué correos están registrados.
const HASH_RELLENO = '$2y$12$BCryptRequires22Chrcte/VlQH0piJtjXl.0t1XkA8pw9dMXTpOq';

exigir_metodo('POST');
$datos = leer_json_entrada();

$email    = strtolower(trim(campo_texto($datos, 'email')));
$password = campo_texto($datos, 'password');

if ($email === '' || $password === '') {
    responder_error(400, 'Ingrese correo y contraseña.');
}

try {
    $pdo = obtener_conexion();

    $consulta = $pdo->prepare(
        'SELECT id, nombre, email, password, rol FROM usuarios WHERE email = :email LIMIT 1'
    );
    $consulta->execute([':email' => $email]);
    $usuario = $consulta->fetch();
} catch (PDOException $e) {
    error_log('login.php: ' . $e->getMessage());
    responder_error(500, 'Error interno del servidor.');
}

// password_verify() compara la clave ingresada contra el hash BCRYPT guardado.
$hashGuardado  = $usuario ? $usuario['password'] : HASH_RELLENO;
$claveCorrecta = password_verify($password, $hashGuardado);

if (!$usuario || !$claveCorrecta) {
    // Mensaje genérico: no revela si falló el correo o la contraseña.
    responder_error(401, 'Credenciales incorrectas.');
}

// ---- Credenciales válidas: se abre la sesión ----
configurar_cookie_sesion();
session_start();
$_SESSION['usuario_id'] = (int) $usuario['id'];

// Genera un identificador de sesión nuevo y descarta el anterior (previene fijación de sesión).
session_regenerate_id(true);

responder_exito(200, 'Autenticación exitosa.', [
    'usuario' => [
        'id'     => (int) $usuario['id'],
        'nombre' => $usuario['nombre'],
        'email'  => $usuario['email'],
        'rol'    => $usuario['rol'],
    ],
]);
