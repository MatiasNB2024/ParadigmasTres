-- ============================================================================
-- Base de datos del Sistema de Gestión de Stock (Benítez Despensas)
-- Importar desde phpMyAdmin: pestaña "Importar" > elegir este archivo > Continuar.
-- (o pegarlo completo en la pestaña "SQL")
-- ============================================================================

CREATE DATABASE IF NOT EXISTS benitez_stock
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE benitez_stock;

-- Tabla de usuarios del sistema.
--  * password es VARCHAR(255): guarda el hash BCRYPT que genera password_hash()
--    (hoy ocupa 60 caracteres; 255 deja margen para algoritmos futuros).
--    Nunca se guarda la contraseña en texto plano.
--  * rol: los actores del informe (Administrador / Empleado). Todo usuario que se
--    registra desde la web queda como 'empleado'; el rol NUNCA lo elige el cliente.
CREATE TABLE IF NOT EXISTS usuarios (
    id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
    nombre     VARCHAR(100) NOT NULL,
    email      VARCHAR(150) NOT NULL,
    password   VARCHAR(255) NOT NULL,
    rol        ENUM('administrador', 'empleado') NOT NULL DEFAULT 'empleado',
    creado_en  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_usuarios_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Cómo crear un administrador:
--   1) Registrá el usuario desde la web (queda como 'empleado').
--   2) Ejecutá en phpMyAdmin (pestaña SQL), con tu correo:
--
--      UPDATE usuarios SET rol = 'administrador' WHERE email = 'tu@correo.com';
-- ----------------------------------------------------------------------------
