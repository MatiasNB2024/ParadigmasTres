<?php
declare(strict_types=1);

/**
 * GET api/perfil.php  —  ENDPOINT PRIVADO
 * Devuelve los datos del usuario que tiene la sesión iniciada.
 *
 * Respuestas:
 *   200 OK            { estado: "exito", data: { id, nombre, email, rol, activo, creado_en } }
 *   401 Unauthorized  no hay sesión iniciada (o el usuario fue deshabilitado)
 *
 * El frontend lo consulta al cargar para saber si hay sesión y con qué rol.
 */

require __DIR__ . '/../config/auth.php';

exigir_metodo('GET');

// GUARDIÁN DE SESIÓN: sin $_SESSION['usuario_id'] válido se corta con 401.
$usuario = exigir_sesion();

responder_exito(200, 'Sesión activa.', ['data' => $usuario]);
