<?php
declare(strict_types=1);

/**
 * POST api/login.php  —  CU "Iniciar sesión"
 * Recibe JSON: { "email": "...", "password": "..." }
 *
 * Respuestas:
 *   200 OK                   credenciales correctas (se inicia la sesión)
 *   400 Bad Request          faltan campos o JSON inválido
 *   401 Unauthorized         credenciales incorrectas
 *   403 Forbidden            el usuario fue deshabilitado por un administrador
 *   405 / 415 / 500          método no permitido / no es JSON / error del servidor
 */

require __DIR__ . '/../config/conexion.php';
require __DIR__ . '/../config/helpers.php';
require __DIR__ . '/../models/UsuarioModel.php';

exigir_metodo('POST');
$datos = leer_json_entrada();

$email    = strtolower(trim(campo_texto($datos, 'email')));
$password = campo_texto($datos, 'password');

if ($email === '' || $password === '') {
    responder_error(400, 'Ingrese correo y contraseña.');
}

try {
    // UsuarioModel usa un PDO Prepared Statement con el marcador :email.
    $usuario = (new UsuarioModel(obtener_conexion()))->buscarPorEmailConPassword($email);
} catch (PDOException $e) {
    error_log('login.php: ' . $e->getMessage());
    responder_error(500, 'Error interno del servidor.');
}

if ($usuario) {
    // password_verify() compara la clave ingresada contra el hash BCRYPT guardado.
    $claveCorrecta = password_verify($password, $usuario['password']);
} else {
    // El correo no existe. Para que la respuesta tarde lo mismo (y no se pueda averiguar
    // por el tiempo qué correos están registrados) se calcula un hash descartable en memoria,
    // con el mismo costo que un login real. No hay ningún hash escrito en el código fuente.
    password_hash($password, PASSWORD_BCRYPT, ['cost' => COSTO_BCRYPT]);
    $claveCorrecta = false;
}

if (!$usuario || !$claveCorrecta) {
    // Mensaje genérico: no revela si falló el correo o la contraseña.
    responder_error(401, 'Credenciales incorrectas.');
}

// CU "Gestionar usuarios": un usuario deshabilitado no puede entrar.
// (Se informa recién después de verificar la contraseña, para no revelar nada a quien no la sabe.)
if (!(bool) $usuario['activo']) {
    responder_error(403, 'Tu usuario está deshabilitado. Consultá con un administrador.');
}

// ---- Credenciales válidas: se abre la sesión ----
configurar_cookie_sesion();
session_start();

// Prevención de fijación de sesión: ANTES de guardar la identidad se genera un ID nuevo
// y se destruye el anterior. Un ID que un atacante haya plantado queda inutilizable.
session_regenerate_id(true);

$_SESSION['usuario_id'] = (int) $usuario['id'];

responder_exito(200, 'Autenticación exitosa.', [
    'usuario' => [
        'id'     => (int) $usuario['id'],
        'nombre' => $usuario['nombre'],
        'email'  => $usuario['email'],
        'rol'    => $usuario['rol'],
    ],
]);
