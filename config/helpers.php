<?php
declare(strict_types=1);

/**
 * Funciones compartidas por los endpoints de api/ (capa Controlador).
 * Importante: este archivo no debe tener espacios ni líneas antes de "<?php"
 * ni una etiqueta de cierre, porque cualquier salida previa rompe los header().
 *
 * Contrato de todas las respuestas (JSON):
 *   { "estado": "exito" | "error", "mensaje": "...", "data": ... (opcional) }
 */

/** Costo de BCRYPT, compartido por registro, login y la gestión de usuarios. */
const COSTO_BCRYPT = 12;

// Los errores de PHP nunca se muestran en la respuesta: van al log del servidor.
ini_set('display_errors', '0');
ini_set('log_errors', '1');

/**
 * Red de seguridad para "fallos no controlados": cualquier excepción que un
 * endpoint no haya capturado termina en un 500 con un mensaje genérico, sin
 * exponer rutas, consultas SQL ni datos del servidor.
 */
set_exception_handler(static function (Throwable $e): void {
    error_log('Excepción no controlada: ' . $e->getMessage() . ' en ' . $e->getFile() . ':' . $e->getLine());
    responder_error(500, 'Error interno del servidor.');
});

/** Envía una respuesta JSON con el código HTTP indicado y termina la ejecución. */
function responder_json(int $codigo, array $datos): void
{
    http_response_code($codigo);
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: no-store');
    echo json_encode($datos, JSON_UNESCAPED_UNICODE);
    exit;
}

/** Respuesta de error: { estado: "error", mensaje, ...$extra }. */
function responder_error(int $codigo, string $mensaje, array $extra = []): void
{
    responder_json($codigo, array_merge(['estado' => 'error', 'mensaje' => $mensaje], $extra));
}

/** Respuesta correcta: { estado: "exito", mensaje, ...$extra }. */
function responder_exito(int $codigo, string $mensaje, array $extra = []): void
{
    responder_json($codigo, array_merge(['estado' => 'exito', 'mensaje' => $mensaje], $extra));
}

/** Método HTTP del pedido actual (GET, POST, PUT, DELETE...). */
function metodo_http(): string
{
    return strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
}

/** Corta con 405 si el pedido no usa el método HTTP esperado. */
function exigir_metodo(string $metodo): void
{
    exigir_metodos([$metodo]);
}

/** Corta con 405 (e informa los métodos válidos en la cabecera Allow) si el método no está en la lista. */
function exigir_metodos(array $metodos): void
{
    if (!in_array(metodo_http(), $metodos, true)) {
        header('Allow: ' . implode(', ', $metodos));
        responder_error(405, 'Método no permitido.');
    }
}

/**
 * Lee el cuerpo del pedido como JSON.
 *  - 415 si no se envía como application/json. Además de ordenar la API, es una
 *    defensa CSRF: un formulario HTML de otro sitio no puede enviar ese tipo de
 *    contenido sin que el navegador lo bloquee.
 *  - 400 si el cuerpo no es un objeto JSON válido.
 */
function leer_json_entrada(): array
{
    $tipo = strtolower($_SERVER['CONTENT_TYPE'] ?? '');
    if (!str_starts_with($tipo, 'application/json')) {
        responder_error(415, 'El pedido debe enviarse como application/json.');
    }

    $crudo = file_get_contents('php://input');
    $datos = json_decode($crudo === false ? '' : $crudo, true);

    if (!is_array($datos)) {
        responder_error(400, 'El cuerpo del pedido debe ser un JSON válido.');
    }

    return $datos;
}

/** Devuelve $datos[$clave] solo si es texto; si falta o es de otro tipo, devuelve ''. */
function campo_texto(array $datos, string $clave): string
{
    return isset($datos[$clave]) && is_string($datos[$clave]) ? $datos[$clave] : '';
}

/**
 * Devuelve $datos[$clave] como entero, o null si falta o no es un entero válido.
 * Acepta 5 y "5", pero no 5.7, "5abc" ni true.
 */
function campo_entero(array $datos, string $clave): ?int
{
    if (!array_key_exists($clave, $datos)) {
        return null;
    }
    $valor = $datos[$clave];
    if (is_int($valor)) {
        return $valor;
    }
    if (is_string($valor) && preg_match('/^-?\d{1,10}$/', $valor) === 1) {
        return (int) $valor;
    }
    return null;
}

/** Lee un id positivo de la URL (?id=5). Responde 400 si falta o no es válido. */
function parametro_id(string $nombre = 'id'): int
{
    $id = campo_entero($_GET, $nombre);
    if ($id === null || $id < 1) {
        responder_error(400, "El parámetro \"$nombre\" debe ser un número entero positivo.");
    }
    return $id;
}

/**
 * true si la excepción es una violación de clave única (por ejemplo, un correo
 * o un código de producto repetido). Se mira el número de error de MySQL/MariaDB
 * (1062) además del SQLSTATE 23000, porque no todos los motores informan el mismo.
 */
function es_clave_duplicada(Throwable $e): bool
{
    return $e instanceof PDOException
        && (((string) $e->getCode() === '23000' && ($e->errorInfo[1] ?? 1062) === 1062)
            || ($e->errorInfo[1] ?? null) === 1062);
}

/** true si la cadena tiene a lo sumo $maximo caracteres (cuenta letras, no bytes). */
function largo_valido(string $texto, int $maximo): bool
{
    $largo = largo_texto($texto);
    return $largo !== null && $largo <= $maximo;
}

/**
 * Cantidad de caracteres (no de bytes) de un texto UTF-8, o null si el texto no es
 * UTF-8 válido. Usa solo PCRE, que viene siempre incluido en PHP: así no depende de
 * la extensión mbstring, que en algunas instalaciones de XAMPP está desactivada.
 */
function largo_texto(string $texto): ?int
{
    $cantidad = preg_match_all('/./su', $texto);
    return $cantidad === false ? null : $cantidad;
}

/** true si $fecha es una fecha real con formato AAAA-MM-DD (rechaza 2026-02-30). */
function fecha_valida(string $fecha): bool
{
    $d = DateTimeImmutable::createFromFormat('!Y-m-d', $fecha);
    return $d !== false && $d->format('Y-m-d') === $fecha;
}

/**
 * Valida nombre, correo y contraseña de un usuario nuevo.
 * Devuelve el mensaje de error, o '' si todo es válido.
 */
function validar_datos_usuario(string $nombre, string $email, string $password): string
{
    if ($nombre === '' || $email === '' || $password === '') {
        return 'Todos los campos son obligatorios.';
    }
    // Lista de caracteres PERMITIDOS: nunca se guardan "<", ">" ni comillas dobles
    // (defensa XSS en el servidor). El escape al mostrar lo hace .textContent.
    if (preg_match('/^[\p{L}\p{M}\p{N} .\'_-]{2,100}$/u', $nombre) !== 1) {
        return 'El nombre debe tener entre 2 y 100 caracteres y solo puede incluir letras, números, espacios y . \' _ -';
    }
    if (strlen($email) > 150 || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
        return 'El correo electrónico no es válido.';
    }
    if (strlen($password) < 8) {
        return 'La contraseña debe tener al menos 8 caracteres.';
    }
    // BCRYPT solo procesa los primeros 72 bytes: se rechaza para no truncar en silencio.
    if (strlen($password) > 72) {
        return 'La contraseña no puede superar los 72 caracteres.';
    }
    return '';
}

/**
 * Cookie de sesión endurecida. Se llama ANTES de session_start().
 *  - httponly: JavaScript no puede leer la cookie (mitiga robo de sesión por XSS)
 *  - samesite=Lax: el navegador no la envía en pedidos cruzados iniciados por otro sitio
 *  - secure: solo cuando el sitio se sirve por HTTPS
 *  - use_strict_mode: no se aceptan IDs de sesión inventados por el cliente
 */
function configurar_cookie_sesion(): void
{
    $https = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';

    // Modo estricto: PHP rechaza IDs de sesión que él no generó (otra defensa contra fijación).
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');

    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'secure'   => $https,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}
