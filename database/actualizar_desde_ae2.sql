-- ============================================================================
-- Actualización de una base creada en la AE2 (ejecutar UNA sola vez).
--
-- En la AE2 la tabla usuarios no tenía la columna "activo", que la AE4 necesita
-- para el Caso de Uso "Gestionar usuarios" (deshabilitar usuarios).
-- Los usuarios existentes quedan activos (DEFAULT 1).
--
-- Si phpMyAdmin responde "#1060 - Nombre de columna duplicado 'activo'",
-- la base ya estaba actualizada: no hay que hacer nada más.
-- ============================================================================

USE benitez_stock;

ALTER TABLE usuarios
    ADD COLUMN activo TINYINT(1) NOT NULL DEFAULT 1 AFTER rol;
