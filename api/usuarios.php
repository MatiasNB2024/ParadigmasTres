<?php
declare(strict_types=1);

/**
 * api/usuarios.php  —  CU "Gestionar usuarios" (solo administrador)
 *
 * GET  api/usuarios.php           Lista de usuarios (sin contraseñas)
 * POST api/usuarios.php           Crear usuario:  { nombre, email, password, rol }
 * PUT  api/usuarios.php?id=N      Modificar rol y/o deshabilitar:  { rol?, activo? }
 *
 * Reglas:
 *  - Un administrador no puede quitarse su propio rol ni deshabilitarse
 *    (evita quedar afuera del sistema por error).
 *  - Siempre debe quedar al menos un administrador activo.
 *
 * Respuestas:
 *   200 OK · 201 Created · 400 datos inválidos · 401 sin sesión
 *   403 no es administrador · 404 el usuario no existe · 409 correo repetido
 *   415 no es JSON · 500 error del servidor
 */

require __DIR__ . '/../config/auth.php';

const ROLES = ['administrador', 'empleado'];

exigir_metodos(['GET', 'POST', 'PUT']);

try {
    $admin = exigir_administrador();
    $modelo = new UsuarioModel(obtener_conexion());

    switch (metodo_http()) {
        case 'GET':
            responder_exito(200, 'Usuarios.', ['data' => $modelo->listar()]);
            break;

        case 'POST':
            $datos = leer_json_entrada();
            $nombre = trim(campo_texto($datos, 'nombre'));
            $email = strtolower(trim(campo_texto($datos, 'email')));
            $password = campo_texto($datos, 'password');
            $rol = campo_texto($datos, 'rol') ?: 'empleado';

            $error = validar_datos_usuario($nombre, $email, $password);
            if ($error !== '') {
                responder_error(400, $error);
            }
            if (!in_array($rol, ROLES, true)) {
                responder_error(400, 'El rol debe ser administrador o empleado.');
            }
            $id = $modelo->crear($nombre, $email, $password, $rol);
            responder_exito(201, 'Usuario creado.', ['data' => $modelo->buscarPorId($id)]);
            break;

        case 'PUT':
            $id = parametro_id();
            $datos = leer_json_entrada();

            $rol = null;
            if (array_key_exists('rol', $datos)) {
                if (!in_array($datos['rol'], ROLES, true)) {
                    responder_error(400, 'El rol debe ser administrador o empleado.');
                }
                $rol = $datos['rol'];
            }
            $activo = null;
            if (array_key_exists('activo', $datos)) {
                if (!is_bool($datos['activo'])) {
                    responder_error(400, '"activo" debe ser true o false.');
                }
                $activo = $datos['activo'];
            }
            if ($rol === null && $activo === null) {
                responder_error(400, 'No hay cambios: enviá "rol" y/o "activo".');
            }

            if ($id === $admin['id'] && ($rol === 'empleado' || $activo === false)) {
                responder_error(400, 'No podés quitarte el rol de administrador ni deshabilitar tu propio usuario.');
            }

            $objetivo = $modelo->buscarPorId($id);
            if ($objetivo === null) {
                responder_error(404, 'El usuario no existe.');
            }
            $dejaDeSerAdminActivo = $objetivo['rol'] === 'administrador' && $objetivo['activo']
                && ($rol === 'empleado' || $activo === false);
            if ($dejaDeSerAdminActivo && $modelo->contarAdministradoresActivos() <= 1) {
                responder_error(409, 'Debe quedar al menos un administrador activo.');
            }

            responder_exito(200, 'Usuario actualizado.', ['data' => $modelo->actualizarRolYEstado($id, $rol, $activo)]);
            break;
    }
} catch (Throwable $e) {
    responder_excepcion($e, 'usuarios.php');
}
