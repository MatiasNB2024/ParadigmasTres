<?php
declare(strict_types=1);

/**
 * POST api/imagenes.php  —  Subir la imagen de un producto (solo administrador)
 * Apoya a CU01 "Registrar producto" y "Modificar producto".
 *
 * Recibe multipart/form-data con el campo "imagen" (no JSON: es un archivo).
 * Devuelve 201 { data: { ruta: "uploads/<nombre>.png" } }, ruta que después
 * se envía en el campo "imagen" de api/productos.php.
 *
 * Seguridad:
 *  - Se verifica el tipo REAL del archivo (getimagesize, y finfo si está), no la extensión
 *    ni el tipo que declara el navegador.
 *  - Solo PNG, JPEG o WEBP, hasta 2 MB.
 *  - Se guarda con un nombre aleatorio generado por el servidor: el nombre que
 *    manda el cliente nunca se usa (evita ../ y sobrescribir archivos).
 *  - public/uploads/.htaccess impide ejecutar PHP en esa carpeta.
 *
 * Respuestas: 201 · 400 archivo inválido · 401 sin sesión · 403 no es administrador · 500
 */

require __DIR__ . '/../config/auth.php';

const TAMANIO_MAXIMO = 2 * 1024 * 1024;
const TIPOS_PERMITIDOS = ['image/png' => 'png', 'image/jpeg' => 'jpg', 'image/webp' => 'webp'];
const CARPETA_DESTINO = __DIR__ . '/../public/uploads/';

exigir_metodo('POST');
exigir_administrador();

$archivo = $_FILES['imagen'] ?? null;
if (!is_array($archivo) || !isset($archivo['error']) || is_array($archivo['error'])) {
    responder_error(400, 'Enviá un archivo en el campo "imagen".');
}
if ($archivo['error'] === UPLOAD_ERR_INI_SIZE || $archivo['error'] === UPLOAD_ERR_FORM_SIZE) {
    responder_error(400, 'La imagen no puede superar los 2 MB.');
}
if ($archivo['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($archivo['tmp_name'])) {
    responder_error(400, 'No se recibió la imagen correctamente.');
}
if ($archivo['size'] > TAMANIO_MAXIMO) {
    responder_error(400, 'La imagen no puede superar los 2 MB.');
}

// getimagesize() lee la cabecera real del archivo (no la extensión ni lo que dice el navegador).
// Es parte del núcleo de PHP; si además está la extensión fileinfo, se usa como segundo control.
$info = @getimagesize($archivo['tmp_name']);
$tipo = is_array($info) ? ($info['mime'] ?? '') : '';
if ($tipo !== '' && class_exists('finfo')) {
    $tipoFinfo = (new finfo(FILEINFO_MIME_TYPE))->file($archivo['tmp_name']);
    if ($tipoFinfo !== $tipo) {
        $tipo = '';
    }
}
if (!isset(TIPOS_PERMITIDOS[$tipo])) {
    responder_error(400, 'El archivo debe ser una imagen PNG, JPG o WEBP.');
}

try {
    $nombre = bin2hex(random_bytes(16)) . '.' . TIPOS_PERMITIDOS[$tipo];
    if (!is_dir(CARPETA_DESTINO) && !mkdir(CARPETA_DESTINO, 0755, true)) {
        throw new RuntimeException('No se pudo crear la carpeta de imágenes.');
    }
    if (!move_uploaded_file($archivo['tmp_name'], CARPETA_DESTINO . $nombre)) {
        throw new RuntimeException('No se pudo guardar la imagen.');
    }
} catch (Throwable $e) {
    error_log('imagenes.php: ' . $e->getMessage());
    responder_error(500, 'Error interno al guardar la imagen.');
}

responder_exito(201, 'Imagen subida.', ['data' => ['ruta' => 'uploads/' . $nombre]]);
