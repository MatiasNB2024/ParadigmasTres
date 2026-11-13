<?php
declare(strict_types=1);

/**
 * Conexión a MySQL mediante PDO.
 *
 * Valores por defecto de XAMPP: usuario "root" sin contraseña.
 * Si tu MySQL usa otras credenciales, cambiá solo estas constantes.
 */
const DB_HOST    = 'localhost';
const DB_NAME    = 'benitez_stock';
const DB_USER    = 'root';
const DB_PASS    = '';
const DB_CHARSET = 'utf8mb4';

/**
 * Devuelve siempre la misma conexión PDO durante el pedido.
 * Lanza PDOException si no puede conectarse (cada endpoint la captura).
 */
function obtener_conexion(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;

    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,  // errores como excepciones
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,                   // prepared statements reales del servidor
    ]);

    return $pdo;
}
