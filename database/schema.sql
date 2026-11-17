-- ============================================================================
-- Base de datos del Sistema de Gestión de Stock (Benítez Despensas) - AE4
--
-- Importar desde phpMyAdmin: pestaña "Importar" > elegir este archivo > Continuar.
--
-- Sirve tanto para una instalación nueva como para una base que ya existe:
--   * No borra nada: los usuarios ya registrados se conservan.
--   * Si la base viene de la AE2, ejecutar también database/actualizar_desde_ae2.sql
--   * Las tablas se crean solo si no existen (IF NOT EXISTS).
--   * Los datos iniciales se insertan con INSERT IGNORE: si se importa dos veces,
--     no se duplican.
--
-- Cada tabla indica qué Caso de Uso de la AE1 justifica su existencia.
-- ============================================================================

CREATE DATABASE IF NOT EXISTS benitez_stock
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE benitez_stock;

-- ----------------------------------------------------------------------------
-- usuarios  ->  CU "Iniciar sesión" y "Gestionar usuarios"
--  * password VARCHAR(255): hash BCRYPT de password_hash(). Nunca texto plano.
--  * rol: actores de los Casos de Uso. Quien se registra desde la web queda
--    como 'empleado'; el rol solo lo cambia un administrador.
--  * activo: "Gestionar usuarios" pide poder DESHABILITAR usuarios. Un usuario
--    con activo = 0 no puede iniciar sesión (no se borra, para no perder el
--    historial de movimientos que registró).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
    id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
    nombre     VARCHAR(100) NOT NULL,
    email      VARCHAR(150) NOT NULL,
    password   VARCHAR(255) NOT NULL,
    rol        ENUM('administrador', 'empleado') NOT NULL DEFAULT 'empleado',
    activo     TINYINT(1)   NOT NULL DEFAULT 1,
    creado_en  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_usuarios_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Si tu base viene de la AE2, la tabla usuarios ya existía SIN la columna "activo"
-- y CREATE TABLE IF NOT EXISTS no la modifica: ejecutá una sola vez
-- database/actualizar_desde_ae2.sql (antes o después de este archivo).

-- ----------------------------------------------------------------------------
-- sucursales  ->  CU02, CU03, CU04, "Consultar stock de otra sucursal",
--                 "Transferir stock"
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sucursales (
    id      TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
    nombre  VARCHAR(60)      NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_sucursales_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- categorias  ->  CU01 (dato del producto) y CU04 (buscar por categoría)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categorias (
    id      SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    nombre  VARCHAR(60)       NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_categorias_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- productos  ->  CU01 "Registrar producto", "Modificar producto",
--                "Eliminar producto", "Consultar producto",
--                CU05 "Controlar vencimientos", "Controlar bajo stock",
--                CU06 "Validar concurrencia"
--  * Campos de CU01: código, nombre, categoría, peso o cantidad (presentacion),
--    color o característica del paquete (caracteristica), vencimiento, precio
--    y proveedor. El resto es la ficha técnica que ya tenía el sistema.
--  * stock_minimo: el "nivel establecido" de "Controlar bajo stock". Se compara
--    contra la cantidad de cada sucursal.
--  * activo: "Eliminar producto" es una baja lógica (activo = 0). Así no se
--    pierde el historial de movimientos del producto.
--  * version: control de concurrencia optimista (CU06). Cada modificación la
--    incrementa; si dos administradores editan a la vez, el segundo recibe
--    409 Conflict en lugar de pisar los cambios del primero.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS productos (
    id              INT UNSIGNED      NOT NULL AUTO_INCREMENT,
    codigo          VARCHAR(30)       NOT NULL,
    nombre          VARCHAR(120)      NOT NULL,
    categoria_id    SMALLINT UNSIGNED NOT NULL,
    presentacion    VARCHAR(50)       NOT NULL DEFAULT '',
    caracteristica  VARCHAR(100)      NOT NULL DEFAULT '',
    precio          DECIMAL(12,2)     NOT NULL DEFAULT 0.00,
    proveedor       VARCHAR(120)      NOT NULL DEFAULT '',
    vencimiento     DATE              NULL,
    lote            VARCHAR(40)       NOT NULL DEFAULT '',
    medidas         VARCHAR(60)       NOT NULL DEFAULT '',
    almacenamiento  VARCHAR(120)      NOT NULL DEFAULT '',
    imagen          VARCHAR(255)      NULL,
    stock_minimo    INT UNSIGNED      NOT NULL DEFAULT 10,
    activo          TINYINT(1)        NOT NULL DEFAULT 1,
    version         INT UNSIGNED      NOT NULL DEFAULT 1,
    creado_en       TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en  TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_productos_codigo (codigo),
    KEY idx_productos_nombre (nombre),
    KEY idx_productos_vencimiento (vencimiento),
    CONSTRAINT fk_productos_categoria FOREIGN KEY (categoria_id) REFERENCES categorias (id),
    CONSTRAINT chk_productos_precio CHECK (precio >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- stock  ->  CU04 "Consultar stock", "Consultar stock de otra sucursal",
--            "Actualizar stock" (actor Sistema)
--  * Una fila por producto y sucursal: cuánto hay y DÓNDE está guardado.
--  * La cantidad nunca se escribe a mano desde la API: solo cambia a través de
--    un movimiento (entrada, salida o transferencia). Es el CU "Actualizar stock".
--  * UNSIGNED + CHECK: la cantidad no puede quedar negativa.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stock (
    producto_id  INT UNSIGNED     NOT NULL,
    sucursal_id  TINYINT UNSIGNED NOT NULL,
    cantidad     INT UNSIGNED     NOT NULL DEFAULT 0,
    ubicacion    VARCHAR(100)     NOT NULL DEFAULT '',
    PRIMARY KEY (producto_id, sucursal_id),
    CONSTRAINT fk_stock_producto FOREIGN KEY (producto_id) REFERENCES productos (id),
    CONSTRAINT fk_stock_sucursal FOREIGN KEY (sucursal_id) REFERENCES sucursales (id),
    CONSTRAINT chk_stock_cantidad CHECK (cantidad >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- movimientos  ->  CU02 "Registrar entrada", CU03 "Registrar salida",
--                  "Transferir stock", "Consultar movimientos"
--  * entrada:        solo sucursal_destino_id
--  * salida:         solo sucursal_origen_id (venta o entrega)
--  * transferencia:  origen y destino distintos
--  * usuario_id: quién registró la operación (NULL en el stock inicial).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS movimientos (
    id                   INT UNSIGNED     NOT NULL AUTO_INCREMENT,
    tipo                 ENUM('entrada', 'salida', 'transferencia') NOT NULL,
    producto_id          INT UNSIGNED     NOT NULL,
    sucursal_origen_id   TINYINT UNSIGNED NULL,
    sucursal_destino_id  TINYINT UNSIGNED NULL,
    cantidad             INT UNSIGNED     NOT NULL,
    observacion          VARCHAR(200)     NOT NULL DEFAULT '',
    usuario_id           INT UNSIGNED     NULL,
    fecha                TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_movimientos_producto (producto_id),
    KEY idx_movimientos_fecha (fecha),
    CONSTRAINT fk_mov_producto FOREIGN KEY (producto_id) REFERENCES productos (id),
    CONSTRAINT fk_mov_origen   FOREIGN KEY (sucursal_origen_id)  REFERENCES sucursales (id),
    CONSTRAINT fk_mov_destino  FOREIGN KEY (sucursal_destino_id) REFERENCES sucursales (id),
    CONSTRAINT fk_mov_usuario  FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
    CONSTRAINT chk_mov_cantidad CHECK (cantidad > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- DATOS INICIALES
-- Los 9 productos de la AE2 (antes en data/stock.json y data/detalles.json).
-- Las cantidades de la Sucursal 1 son las que tenía stock.json; las de la
-- Sucursal 2 son datos de ejemplo para la demostración.
-- ============================================================================

INSERT IGNORE INTO sucursales (id, nombre) VALUES
    (1, 'Sucursal 1'),
    (2, 'Sucursal 2');

INSERT IGNORE INTO categorias (id, nombre) VALUES
    (1, 'Harinas'),
    (2, 'Almacén'),
    (3, 'Aceites'),
    (4, 'Infusiones');

INSERT IGNORE INTO productos
    (id, codigo, nombre, categoria_id, presentacion, caracteristica, precio, proveedor,
     vencimiento, lote, medidas, almacenamiento, imagen, stock_minimo)
VALUES
    (1, 'HAR-000-001',  'Harina Morixe 000',           1, '1 kg',   'Paquete de papel rojo',      1250.50, 'Distribuidora Molinos SA', '2027-03-15', 'L2609-A', '10 x 6 x 19 cm', 'Lugar seco y fresco',                       'imgstock/harinamorixe.png',             10),
    (2, 'HAR-0000-002', 'Harina Morixe 0000',          1, '1 kg',   'Paquete de papel azul',      1380.00, 'Distribuidora Molinos SA', '2027-03-20', 'L2609-B', '10 x 6 x 19 cm', 'Lugar seco y fresco',                       'imgstock/harinamorixecuatroceros.png',  10),
    (3, 'HAR-000-003',  'Harina Morixe 000 (lote 2)',  1, '1 kg',   'Paquete de papel rojo',      1240.00, 'Mayorista Del Norte',      '2027-01-10', 'L2608-C', '10 x 6 x 19 cm', 'Lugar seco, lejos de la humedad',           'imgstock/harinamorixetresceros.png',    10),
    (4, 'AZU-REF-004',  'Azúcar Blanca Refinada',      2, '1 kg',   'Paquete blanco y azul',       980.00, 'Distribuidora Molinos SA', '2028-05-01', 'L2611-A', '9 x 6 x 18 cm',  'Lugar seco, lejos de olores fuertes',       'imgstock/azucar.png',                   10),
    (5, 'ARR-LFN-005',  'Arroz Largo Fino',            2, '1 kg',   'Paquete amarillo',           1450.00, 'Mayorista Del Norte',      '2027-10-15', 'L2610-B', '10 x 6 x 19 cm', 'Lugar seco y fresco',                       'imgstock/arroz.png',                    10),
    (6, 'FID-TIR-006',  'Fideos Tirabuzón',            2, '500 g',  'Paquete rojo y amarillo',     890.75, 'Distribuidora Molinos SA', '2028-02-20', 'L2611-C', '14 x 5 x 23 cm', 'Lugar seco y ventilado',                    'imgstock/fideos.png',                   15),
    (7, 'ACE-GIR-007',  'Aceite de Girasol',           3, '900 ml', 'Botella plástica amarilla',  2300.00, 'Mayorista Del Norte',      '2027-08-30', 'L2610-D', '8 x 8 x 26 cm',  'Lejos de la luz solar y del calor',         'imgstock/aceite.png',                    8),
    (8, 'YER-MAT-008',  'Yerba Mate con Palo',         4, '1 kg',   'Paquete verde',              4100.00, 'Distribuidora Molinos SA', '2027-11-10', 'L2611-E', '12 x 7 x 25 cm', 'Lugar seco, bien cerrado después de abrir', 'imgstock/yerba.png',                    10),
    (9, 'SAL-FIN-009',  'Sal Fina de Mesa',            2, '500 g',  'Paquete azul',                650.00, 'Mayorista Del Norte',      '2029-10-20', 'L2610-F', '8 x 5 x 14 cm',  'Lugar seco, lejos de la humedad',           'imgstock/sal.png',                       5);

INSERT IGNORE INTO stock (producto_id, sucursal_id, cantidad, ubicacion) VALUES
    (1, 1, 45, 'Depósito A - Estante 1'),  (1, 2, 20, 'Depósito - Estante 1'),
    (2, 1,  6, 'Depósito A - Estante 1'),  (2, 2, 12, 'Depósito - Estante 1'),
    (3, 1,  0, 'Depósito B - Estante 2'),  (3, 2,  4, 'Depósito - Estante 2'),
    (4, 1, 38, 'Depósito A - Estante 2'),  (4, 2, 15, 'Depósito - Estante 3'),
    (5, 1,  8, 'Depósito A - Estante 3'),  (5, 2, 25, 'Depósito - Estante 3'),
    (6, 1, 60, 'Depósito B - Estante 1'),  (6, 2, 30, 'Depósito - Estante 4'),
    (7, 1,  3, 'Depósito B - Estante 3'),  (7, 2, 10, 'Depósito - Estante 5'),
    (8, 1, 25, 'Depósito A - Estante 4'),  (8, 2,  9, 'Depósito - Estante 6'),
    (9, 1,  0, 'Depósito B - Estante 2'),  (9, 2,  7, 'Depósito - Estante 2');

-- Historial de movimientos de ejemplo (CU "Consultar movimientos"):
-- stock inicial del 1/9, compras a proveedores con su remito, ventas y entregas,
-- y transferencias de reposición entre sucursales, hasta el 14/11/2026.
-- Sumando los movimientos de cada producto en cada sucursal se obtiene exactamente
-- la cantidad cargada arriba en la tabla stock.
-- Los usuarios se buscan por correo: si no existen, el movimiento queda como "Sistema".
INSERT IGNORE INTO movimientos
    (id, tipo, producto_id, sucursal_origen_id, sucursal_destino_id, cantidad, observacion, usuario_id, fecha)
VALUES
    (1, 'entrada', 1, NULL, 1, 41, 'Stock Inicial', NULL, '2026-09-01 08:00:00'),
    (2, 'entrada', 1, NULL, 2, 31, 'Stock Inicial', NULL, '2026-09-01 08:00:00'),
    (3, 'entrada', 2, NULL, 1, 14, 'Stock Inicial', NULL, '2026-09-01 08:00:00'),
    (4, 'entrada', 2, NULL, 2, 16, 'Stock Inicial', NULL, '2026-09-01 08:00:00'),
    (5, 'entrada', 3, NULL, 2, 5, 'Stock Inicial', NULL, '2026-09-01 08:00:00'),
    (6, 'entrada', 4, NULL, 1, 59, 'Stock Inicial', NULL, '2026-09-01 08:00:00'),
    (7, 'entrada', 4, NULL, 2, 7, 'Stock Inicial', NULL, '2026-09-01 08:00:00'),
    (8, 'entrada', 5, NULL, 2, 43, 'Stock Inicial', NULL, '2026-09-01 08:00:00'),
    (9, 'entrada', 6, NULL, 1, 36, 'Stock Inicial', NULL, '2026-09-01 08:00:00'),
    (10, 'entrada', 6, NULL, 2, 10, 'Stock Inicial', NULL, '2026-09-01 08:00:00'),
    (11, 'entrada', 7, NULL, 2, 10, 'Stock Inicial', NULL, '2026-09-01 08:00:00'),
    (12, 'entrada', 8, NULL, 1, 38, 'Stock Inicial', NULL, '2026-09-01 08:00:00'),
    (13, 'salida', 5, 2, NULL, 2, 'Entrega a Almacén Don José', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-09-03 18:15:30'),
    (14, 'entrada', 3, NULL, 1, 40, 'Remito 0001-00001097 - Mayorista Del Norte', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-09-04 09:30:39'),
    (15, 'salida', 4, 1, NULL, 7, 'Entrega pedido de Panadería La Espiga', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-09-04 12:05:06'),
    (16, 'salida', 6, 1, NULL, 2, 'Entrega pedido de Panadería La Espiga', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-09-05 09:40:42'),
    (17, 'entrada', 2, NULL, 1, 40, 'Remito 0001-00001085 - Distribuidora Molinos SA', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-09-10 11:35:32'),
    (18, 'salida', 6, 1, NULL, 4, 'Entrega a Almacén Don José', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-09-10 13:20:13'),
    (19, 'transferencia', 2, 1, 2, 10, 'Reposición de la Sucursal 2', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-09-11 11:25:29'),
    (20, 'salida', 2, 2, NULL, 4, 'Entrega a Kiosco El Sol', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-09-12 14:50:10'),
    (21, 'salida', 1, 1, NULL, 6, 'Venta mayorista', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-09-13 16:40:18'),
    (22, 'salida', 2, 1, NULL, 8, 'Venta mostrador', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-09-14 11:55:54'),
    (23, 'entrada', 1, NULL, 1, 50, 'Remito 0001-00001066 - Distribuidora Molinos SA', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-09-15 08:15:57'),
    (24, 'salida', 4, 2, NULL, 6, 'Entrega a Comedor San Martín', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-09-17 18:25:55'),
    (25, 'salida', 6, 1, NULL, 3, 'Venta mostrador', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-09-18 09:25:31'),
    (26, 'salida', 1, 1, NULL, 6, 'Venta mostrador', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-09-20 18:55:45'),
    (27, 'transferencia', 1, 1, 2, 10, 'Reposición de la Sucursal 2', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-09-21 11:05:28'),
    (28, 'entrada', 9, NULL, 1, 100, 'Remito 0001-00001279 - Mayorista Del Norte', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-09-22 09:30:41'),
    (29, 'salida', 9, 1, NULL, 6, 'Entrega pedido de Panadería La Espiga', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-09-22 10:34:41'),
    (30, 'transferencia', 9, 1, 2, 40, 'Reposición de la Sucursal 2', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-09-22 14:36:41'),
    (31, 'salida', 9, 1, NULL, 3, 'Entrega a Comedor San Martín', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-09-22 14:58:41'),
    (32, 'transferencia', 9, 1, 2, 40, 'Reposición de la Sucursal 2', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-09-22 14:59:41'),
    (33, 'salida', 9, 2, NULL, 4, 'Venta mostrador', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-09-22 20:06:41'),
    (34, 'transferencia', 6, 1, 2, 20, 'Reposición de la Sucursal 2', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-09-24 12:15:47'),
    (35, 'salida', 3, 1, NULL, 8, 'Venta mostrador', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-09-25 14:20:27'),
    (36, 'salida', 5, 2, NULL, 4, 'Venta mayorista', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-09-26 10:50:26'),
    (37, 'salida', 3, 1, NULL, 2, 'Venta mostrador', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-09-26 15:55:43'),
    (38, 'salida', 2, 1, NULL, 2, 'Entrega a Kiosco El Sol', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-09-27 11:05:39'),
    (39, 'transferencia', 4, 1, 2, 10, 'Reposición de la Sucursal 2', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-09-27 11:20:04'),
    (40, 'salida', 4, 2, NULL, 3, 'Venta mostrador', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-09-27 16:00:46'),
    (41, 'salida', 9, 2, NULL, 8, 'Entrega a Comedor San Martín', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-09-29 13:10:34'),
    (42, 'salida', 8, 1, NULL, 8, 'Venta mostrador', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-09-29 17:00:52'),
    (43, 'salida', 7, 2, NULL, 6, 'Entrega pedido de Panadería La Espiga', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-09-30 18:05:42'),
    (44, 'salida', 5, 2, NULL, 5, 'Entrega pedido de Panadería La Espiga', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-10-01 16:20:21'),
    (45, 'transferencia', 3, 1, 2, 10, 'Reposición de la Sucursal 2', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-10-02 10:00:41'),
    (46, 'salida', 3, 2, NULL, 9, 'Entrega pedido de Panadería La Espiga', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-10-02 15:13:41'),
    (47, 'salida', 4, 1, NULL, 3, 'Entrega a Almacén Don José', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-10-04 14:00:03'),
    (48, 'salida', 9, 1, NULL, 10, 'Venta mayorista', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-10-04 18:30:12'),
    (49, 'transferencia', 3, 1, 2, 10, 'Reposición de la Sucursal 2', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-10-06 09:40:25'),
    (50, 'salida', 7, 2, NULL, 4, 'Entrega pedido de Panadería La Espiga', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-10-06 16:55:16'),
    (51, 'salida', 4, 2, NULL, 3, 'Entrega a Kiosco El Sol', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-10-08 19:25:18'),
    (52, 'salida', 9, 2, NULL, 12, 'Venta mayorista', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-10-09 08:05:37'),
    (53, 'transferencia', 8, 1, 2, 20, 'Reposición de la Sucursal 2', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-10-09 12:25:53'),
    (54, 'salida', 8, 2, NULL, 7, 'Venta mayorista', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-10-09 16:33:53'),
    (55, 'salida', 8, 2, NULL, 5, 'Entrega a Comedor San Martín', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-10-09 18:08:53'),
    (56, 'transferencia', 4, 1, 2, 20, 'Reposición de la Sucursal 2', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-10-12 09:20:59'),
    (57, 'salida', 4, 2, NULL, 8, 'Venta mostrador', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-10-12 14:27:59'),
    (58, 'salida', 4, 1, NULL, 9, 'Entrega a Comedor San Martín', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-10-12 17:15:38'),
    (59, 'salida', 8, 2, NULL, 4, 'Venta mostrador', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-10-12 18:25:23'),
    (60, 'salida', 6, 2, NULL, 7, 'Entrega pedido de Panadería La Espiga', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-10-13 14:40:35'),
    (61, 'salida', 3, 1, NULL, 2, 'Venta mayorista', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-10-13 16:50:36'),
    (62, 'salida', 1, 1, NULL, 3, 'Entrega pedido de Panadería La Espiga', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-10-16 13:30:47'),
    (63, 'salida', 2, 2, NULL, 9, 'Venta mostrador', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-10-17 10:00:20'),
    (64, 'salida', 5, 2, NULL, 9, 'Entrega a Kiosco El Sol', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-10-17 15:50:29'),
    (65, 'salida', 1, 1, NULL, 3, 'Entrega a Comedor San Martín', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-10-19 13:35:27'),
    (66, 'salida', 2, 2, NULL, 3, 'Venta mostrador', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-10-20 08:05:24'),
    (67, 'entrada', 9, NULL, 1, 60, 'Remito 0001-00001265 - Mayorista Del Norte', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-10-20 09:10:44'),
    (68, 'salida', 9, 1, NULL, 2, 'Venta mayorista', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-10-20 11:11:44'),
    (69, 'salida', 9, 1, NULL, 12, 'Venta mayorista', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-10-20 11:30:44'),
    (70, 'salida', 6, 1, NULL, 3, 'Entrega pedido de Panadería La Espiga', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-10-20 12:45:19'),
    (71, 'salida', 9, 1, NULL, 14, 'Venta mayorista', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-10-20 14:11:44'),
    (72, 'salida', 9, 1, NULL, 4, 'Venta mayorista', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-10-20 14:45:40'),
    (73, 'salida', 3, 1, NULL, 4, 'Entrega a Kiosco El Sol', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-10-21 12:10:22'),
    (74, 'salida', 9, 1, NULL, 8, 'Venta mayorista', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-10-21 16:35:56'),
    (75, 'salida', 8, 2, NULL, 1, 'Venta mayorista', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-10-23 11:20:49'),
    (76, 'salida', 3, 2, NULL, 2, 'Entrega pedido de Panadería La Espiga', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-10-24 16:50:11'),
    (77, 'salida', 4, 2, NULL, 2, 'Entrega pedido de Panadería La Espiga', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-10-25 13:45:57'),
    (78, 'salida', 9, 2, NULL, 13, 'Venta mayorista', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-10-25 16:40:06'),
    (79, 'salida', 1, 2, NULL, 5, 'Venta mostrador', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-10-26 15:10:30'),
    (80, 'salida', 9, 2, NULL, 5, 'Venta mayorista', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-10-27 11:10:15'),
    (81, 'entrada', 7, NULL, 1, 48, 'Remito 0001-00001195 - Mayorista Del Norte', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-10-28 09:30:17'),
    (82, 'transferencia', 7, 1, 2, 12, 'Reposición de la Sucursal 2', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-10-28 10:36:17'),
    (83, 'salida', 7, 1, NULL, 8, 'Venta mostrador', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-10-28 11:51:17'),
    (84, 'salida', 7, 1, NULL, 8, 'Entrega a Comedor San Martín', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-10-28 12:04:17'),
    (85, 'salida', 7, 1, NULL, 5, 'Entrega a Comedor San Martín', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-10-28 12:35:17'),
    (86, 'salida', 7, 2, NULL, 2, 'Venta mostrador', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-10-28 13:05:17'),
    (87, 'salida', 7, 1, NULL, 8, 'Entrega pedido de Panadería La Espiga', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-10-28 13:09:17'),
    (88, 'salida', 7, 1, NULL, 3, 'Entrega a Kiosco El Sol', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-10-28 15:14:17'),
    (89, 'salida', 2, 1, NULL, 9, 'Venta mostrador', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-10-29 08:05:00'),
    (90, 'salida', 9, 2, NULL, 6, 'Venta mayorista', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-10-30 13:55:13'),
    (91, 'salida', 6, 2, NULL, 3, 'Venta mostrador', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-10-30 17:25:05'),
    (92, 'salida', 4, 1, NULL, 2, 'Entrega a Comedor San Martín', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-10-30 17:50:41'),
    (93, 'salida', 1, 2, NULL, 6, 'Entrega a Comedor San Martín', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-10-30 18:35:45'),
    (94, 'salida', 8, 1, NULL, 8, 'Entrega a Kiosco El Sol', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-10-31 11:25:17'),
    (95, 'salida', 2, 1, NULL, 9, 'Entrega pedido de Panadería La Espiga', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-11-02 09:50:17'),
    (96, 'transferencia', 2, 1, 2, 10, 'Reposición de la Sucursal 2', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-11-02 11:35:59'),
    (97, 'entrada', 5, NULL, 1, 50, 'Remito 0001-00001151 - Mayorista Del Norte', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-11-03 09:10:11'),
    (98, 'salida', 9, 2, NULL, 12, 'Venta mayorista', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-11-03 09:35:29'),
    (99, 'salida', 5, 1, NULL, 8, 'Venta mayorista', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-11-03 10:11:11'),
    (100, 'salida', 5, 1, NULL, 6, 'Entrega pedido de Panadería La Espiga', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-11-03 12:18:11'),
    (101, 'salida', 5, 1, NULL, 4, 'Venta mostrador', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-11-03 12:44:11'),
    (102, 'transferencia', 5, 1, 2, 10, 'Reposición de la Sucursal 2', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-11-03 14:23:11'),
    (103, 'salida', 5, 1, NULL, 7, 'Venta mayorista', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-11-03 14:29:11'),
    (104, 'salida', 1, 1, NULL, 8, 'Entrega a Kiosco El Sol', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-11-03 18:25:13'),
    (105, 'salida', 6, 2, NULL, 5, 'Entrega pedido de Panadería La Espiga', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-11-04 09:40:33'),
    (106, 'salida', 6, 2, NULL, 5, 'Venta mostrador', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-11-04 12:20:48'),
    (107, 'salida', 3, 2, NULL, 4, 'Entrega pedido de Panadería La Espiga', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-11-04 14:20:29'),
    (108, 'salida', 9, 2, NULL, 8, 'Venta mayorista', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-11-04 18:40:20'),
    (109, 'entrada', 4, NULL, 1, 30, 'Remito 0001-00001122 - Distribuidora Molinos SA', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-11-05 09:50:40'),
    (110, 'salida', 2, 2, NULL, 4, 'Entrega a Almacén Don José', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-11-05 14:30:51'),
    (111, 'salida', 5, 2, NULL, 8, 'Entrega pedido de Panadería La Espiga', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-11-06 10:55:57'),
    (112, 'salida', 5, 1, NULL, 7, 'Venta mostrador', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-11-06 12:25:40'),
    (113, 'salida', 6, 1, NULL, 4, 'Venta mostrador', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-11-07 08:10:20'),
    (114, 'entrada', 6, NULL, 1, 80, 'Remito 0001-00001164 - Distribuidora Molinos SA', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-11-07 10:20:34'),
    (115, 'transferencia', 6, 1, 2, 20, 'Reposición de la Sucursal 2', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-11-07 12:25:51'),
    (116, 'salida', 3, 2, NULL, 6, 'Venta mostrador', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-11-07 15:35:07'),
    (117, 'salida', 3, 1, NULL, 4, 'Venta mostrador', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-11-08 11:40:57'),
    (118, 'transferencia', 1, 1, 2, 10, 'Reposición de la Sucursal 2', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-11-08 12:15:00'),
    (119, 'salida', 1, 2, NULL, 9, 'Venta mostrador', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-11-08 12:30:36'),
    (120, 'salida', 7, 1, NULL, 1, 'Venta mayorista', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-11-09 11:35:32'),
    (121, 'entrada', 8, NULL, 1, 50, 'Remito 0001-00001233 - Distribuidora Molinos SA', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-11-10 09:35:42'),
    (122, 'salida', 9, 1, NULL, 9, 'Venta mayorista', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-11-10 10:40:14'),
    (123, 'salida', 2, 2, NULL, 4, 'Entrega a Kiosco El Sol', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-11-10 11:35:37'),
    (124, 'transferencia', 8, 1, 2, 20, 'Reposición de la Sucursal 2', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-11-10 12:58:42'),
    (125, 'salida', 8, 1, NULL, 7, 'Entrega a Kiosco El Sol', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-11-10 14:09:42'),
    (126, 'salida', 8, 2, NULL, 6, 'Venta mayorista', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-11-10 18:44:42'),
    (127, 'salida', 1, 2, NULL, 9, 'Entrega a Comedor San Martín', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-11-11 15:05:27'),
    (128, 'salida', 8, 2, NULL, 8, 'Venta mostrador', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-11-12 10:20:55'),
    (129, 'salida', 9, 2, NULL, 5, 'Entrega a Almacén Don José', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-11-12 17:35:05'),
    (130, 'salida', 9, 1, NULL, 12, 'Venta mayorista', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-11-13 13:35:08'),
    (131, 'salida', 1, 2, NULL, 2, 'Venta mostrador', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-11-14 11:10:52');

-- ----------------------------------------------------------------------------
-- Cómo crear un administrador:
--   1) Registrá el usuario desde la web (queda como 'empleado').
--   2) Ejecutá en phpMyAdmin (pestaña SQL), con tu correo:
--
--      UPDATE usuarios SET rol = 'administrador' WHERE email = 'tu@correo.com';
--
--   Desde ese momento, ese administrador puede cambiar el rol de los demás
--   desde el sistema (api/usuarios.php).
-- ----------------------------------------------------------------------------
