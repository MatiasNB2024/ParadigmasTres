<?php
declare(strict_types=1);

/**
 * Funciones compartidas por los endpoints de api/.
 * Importante: este archivo no debe tener espacios ni líneas antes de "<?php"
 * ni una etiqueta de cierre, porque cualquier salida previa rompe los header().
 *
 * Contrato de todas las respuestas (JSON):
 *   { "estado": "exito" | "error", "mensaje": "...", ...datos opcionales }
 */

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

/** Respuesta de error: { estado: "error", mensaje }. */
function responder_error(int $codigo, string $mensaje): void
{
    responder_json($codigo, ['estado' => 'error', 'mensaje' => $mensaje]);
}

/** Respuesta correcta: { estado: "exito", mensaje, ...$extra }. */
function responder_exito(int $codigo, string $mensaje, array $extra = []): void
{
    responder_json($codigo, array_merge(['estado' => 'exito', 'mensaje' => $mensaje], $extra));
}

/** Corta con 405 si el pedido no usa el método HTTP esperado. */
function exigir_metodo(string $metodo): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== $metodo) {
        header('Allow: ' . $metodo);
        responder_error(405, 'Método no permitido.');
    }
}

/** Lee el cuerpo del pedido como JSON; responde 400 si no es un JSON válido. */
function leer_json_entrada(): array
{
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
 * Cookie de sesión endurecida. Se llama ANTES de session_start().
 *  - httponly: JavaScript no puede leer la cookie (mitiga robo de sesión por XSS)
 *  - samesite=Lax: el navegador no la envía en pedidos cruzados iniciados por otro sitio
 *  - secure: solo cuando el sitio se sirve por HTTPS
 */
function configurar_cookie_sesion(): void
{
    $https = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';

    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'secure'   => $https,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}
