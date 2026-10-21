<?php
declare(strict_types=1);

/**
 * POST api/registro.php
 * Recibe JSON: { "nombre": "...", "email": "...", "password": "..." }
 *
 * Respuestas:
 *   201 Created              usuario registrado
 *   400 Bad Request          faltan campos, datos inválidos o JSON inválido
 *   405 Method Not Allowed   no es POST
 *   409 Conflict             el correo ya está registrado
 *   500 Internal Server Error
 */

require __DIR__ . '/../config/conexion.php';
require __DIR__ . '/../config/helpers.php';

exigir_metodo('POST');
$datos = leer_json_entrada();

$nombre   = trim(campo_texto($datos, 'nombre'));
$email    = strtolower(trim(campo_texto($datos, 'email')));
$password = campo_texto($datos, 'password');

// ---- Validación en el servidor (la del navegador es solo comodidad) ----
if ($nombre === '' || $email === '' || $password === '') {
    responder_error(400, 'Todos los campos son obligatorios.');
}

// Nombre: lista de caracteres PERMITIDOS (letras, números, espacio y . \' _ -).
// Así nunca se guardan "<", ">" ni comillas dobles: no entra HTML en la base (defensa XSS en el servidor).
// No se usa htmlspecialchars() al guardar porque dejaría "O&#039;Brien" almacenado; el
// escape correcto se hace al mostrar, con .textContent en el navegador.
if (preg_match('/^[\p{L}\p{M}\p{N} .\'_-]{2,100}$/u', $nombre) !== 1) {
    responder_error(400, 'El nombre debe tener entre 2 y 100 caracteres y solo puede incluir letras, números, espacios y . \' _ -');
}

if (strlen($email) > 150 || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
    responder_error(400, 'El correo electrónico no es válido.');
}

if (strlen($password) < 8) {
    responder_error(400, 'La contraseña debe tener al menos 8 caracteres.');
}

// BCRYPT solo procesa los primeros 72 bytes: se rechaza para no truncar en silencio.
if (strlen($password) > 72) {
    responder_error(400, 'La contraseña no puede superar los 72 caracteres.');
}

try {
    $pdo = obtener_conexion();

    // Hash BCRYPT: genera su propia sal y queda listo para password_verify().
    $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);

    // PDO Prepared Statement: los datos viajan separados de la consulta (previene inyección SQL).
    // No se inserta "rol": el cliente no puede elegirlo, la base asigna 'empleado' por defecto.
    $consulta = $pdo->prepare(
        'INSERT INTO usuarios (nombre, email, password) VALUES (:nombre, :email, :password)'
    );
    $consulta->execute([
        ':nombre'   => $nombre,
        ':email'    => $email,
        ':password' => $hash,
    ]);

    responder_exito(201, 'Usuario registrado correctamente.');
} catch (PDOException $e) {
    // 23000 = violación de integridad: el UNIQUE de email ya existe.
    if ((string) $e->getCode() === '23000') {
        responder_error(409, 'El correo electrónico ya está registrado.');
    }

    // El detalle técnico va al log del servidor, nunca al navegador.
    error_log('registro.php: ' . $e->getMessage());
    responder_error(500, 'Error interno al registrar el usuario.');
}
