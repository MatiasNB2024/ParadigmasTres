<?php
declare(strict_types=1);

/**
 * POST api/registro.php  —  Registro público de usuarios
 * Recibe JSON: { "nombre": "...", "email": "...", "password": "..." }
 *
 * Todo usuario que se registra desde la web queda como 'empleado'. El rol no lo
 * elige el cliente: solo lo cambia un administrador (CU "Gestionar usuarios").
 *
 * Respuestas:
 *   201 Created              usuario registrado
 *   400 Bad Request          faltan campos, datos inválidos o JSON inválido
 *   405 / 415                no es POST / no es JSON
 *   409 Conflict             el correo ya está registrado
 *   500 Internal Server Error
 */

require __DIR__ . '/../config/conexion.php';
require __DIR__ . '/../config/helpers.php';
require __DIR__ . '/../models/UsuarioModel.php';

exigir_metodo('POST');
$datos = leer_json_entrada();

$nombre   = trim(campo_texto($datos, 'nombre'));
$email    = strtolower(trim(campo_texto($datos, 'email')));
$password = campo_texto($datos, 'password');

// Validación en el servidor (la del navegador es solo comodidad).
$error = validar_datos_usuario($nombre, $email, $password);
if ($error !== '') {
    responder_error(400, $error);
}

try {
    // Se ignora cualquier "rol" que mande el cliente: siempre 'empleado'.
    (new UsuarioModel(obtener_conexion()))->crear($nombre, $email, $password, 'empleado');
    responder_exito(201, 'Usuario registrado correctamente.');
} catch (ConflictoException $e) {
    responder_error(409, $e->getMessage());
} catch (PDOException $e) {
    // El detalle técnico va al log del servidor, nunca al navegador.
    error_log('registro.php: ' . $e->getMessage());
    responder_error(500, 'Error interno al registrar el usuario.');
}
