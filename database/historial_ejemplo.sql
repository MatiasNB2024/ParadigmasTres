-- ============================================================================
-- Historial de movimientos de ejemplo (para una base que YA está instalada)
--
-- Reemplaza los movimientos de los 9 productos de ejemplo (ids 1 a 9) por un
-- historial realista: stock inicial del 1/9, compras con remito, ventas y
-- entregas, y transferencias entre sucursales hasta el 14/11/2026.
-- Además deja el stock de esos 9 productos en las cantidades que resultan de
-- ese historial, para que la tabla stock y los movimientos coincidan.
--
-- ATENCIÓN: se borran los movimientos que hayas registrado sobre esos 9
-- productos. Los productos que hayas creado vos (y sus movimientos) no se tocan.
--
-- Importar desde phpMyAdmin: base benitez_stock > pestaña Importar.
-- ============================================================================

USE benitez_stock;

START TRANSACTION;

DELETE FROM movimientos WHERE producto_id BETWEEN 1 AND 9;

UPDATE stock SET cantidad = 45 WHERE producto_id = 1 AND sucursal_id = 1;
UPDATE stock SET cantidad = 20 WHERE producto_id = 1 AND sucursal_id = 2;
UPDATE stock SET cantidad = 6 WHERE producto_id = 2 AND sucursal_id = 1;
UPDATE stock SET cantidad = 12 WHERE producto_id = 2 AND sucursal_id = 2;
UPDATE stock SET cantidad = 0 WHERE producto_id = 3 AND sucursal_id = 1;
UPDATE stock SET cantidad = 4 WHERE producto_id = 3 AND sucursal_id = 2;
UPDATE stock SET cantidad = 38 WHERE producto_id = 4 AND sucursal_id = 1;
UPDATE stock SET cantidad = 15 WHERE producto_id = 4 AND sucursal_id = 2;
UPDATE stock SET cantidad = 8 WHERE producto_id = 5 AND sucursal_id = 1;
UPDATE stock SET cantidad = 25 WHERE producto_id = 5 AND sucursal_id = 2;
UPDATE stock SET cantidad = 60 WHERE producto_id = 6 AND sucursal_id = 1;
UPDATE stock SET cantidad = 30 WHERE producto_id = 6 AND sucursal_id = 2;
UPDATE stock SET cantidad = 3 WHERE producto_id = 7 AND sucursal_id = 1;
UPDATE stock SET cantidad = 10 WHERE producto_id = 7 AND sucursal_id = 2;
UPDATE stock SET cantidad = 25 WHERE producto_id = 8 AND sucursal_id = 1;
UPDATE stock SET cantidad = 9 WHERE producto_id = 8 AND sucursal_id = 2;
UPDATE stock SET cantidad = 0 WHERE producto_id = 9 AND sucursal_id = 1;
UPDATE stock SET cantidad = 7 WHERE producto_id = 9 AND sucursal_id = 2;

INSERT INTO movimientos
    (tipo, producto_id, sucursal_origen_id, sucursal_destino_id, cantidad, observacion, usuario_id, fecha)
VALUES
    ('entrada', 1, NULL, 1, 41, 'Stock Inicial', NULL, '2026-09-01 08:00:00'),
    ('entrada', 1, NULL, 2, 31, 'Stock Inicial', NULL, '2026-09-01 08:00:00'),
    ('entrada', 2, NULL, 1, 14, 'Stock Inicial', NULL, '2026-09-01 08:00:00'),
    ('entrada', 2, NULL, 2, 16, 'Stock Inicial', NULL, '2026-09-01 08:00:00'),
    ('entrada', 3, NULL, 2, 5, 'Stock Inicial', NULL, '2026-09-01 08:00:00'),
    ('entrada', 4, NULL, 1, 59, 'Stock Inicial', NULL, '2026-09-01 08:00:00'),
    ('entrada', 4, NULL, 2, 7, 'Stock Inicial', NULL, '2026-09-01 08:00:00'),
    ('entrada', 5, NULL, 2, 43, 'Stock Inicial', NULL, '2026-09-01 08:00:00'),
    ('entrada', 6, NULL, 1, 36, 'Stock Inicial', NULL, '2026-09-01 08:00:00'),
    ('entrada', 6, NULL, 2, 10, 'Stock Inicial', NULL, '2026-09-01 08:00:00'),
    ('entrada', 7, NULL, 2, 10, 'Stock Inicial', NULL, '2026-09-01 08:00:00'),
    ('entrada', 8, NULL, 1, 38, 'Stock Inicial', NULL, '2026-09-01 08:00:00'),
    ('salida', 5, 2, NULL, 2, 'Entrega a Almacén Don José', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-09-03 18:15:30'),
    ('entrada', 3, NULL, 1, 40, 'Remito 0001-00001097 - Mayorista Del Norte', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-09-04 09:30:39'),
    ('salida', 4, 1, NULL, 7, 'Entrega pedido de Panadería La Espiga', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-09-04 12:05:06'),
    ('salida', 6, 1, NULL, 2, 'Entrega pedido de Panadería La Espiga', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-09-05 09:40:42'),
    ('entrada', 2, NULL, 1, 40, 'Remito 0001-00001085 - Distribuidora Molinos SA', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-09-10 11:35:32'),
    ('salida', 6, 1, NULL, 4, 'Entrega a Almacén Don José', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-09-10 13:20:13'),
    ('transferencia', 2, 1, 2, 10, 'Reposición de la Sucursal 2', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-09-11 11:25:29'),
    ('salida', 2, 2, NULL, 4, 'Entrega a Kiosco El Sol', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-09-12 14:50:10'),
    ('salida', 1, 1, NULL, 6, 'Venta mayorista', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-09-13 16:40:18'),
    ('salida', 2, 1, NULL, 8, 'Venta mostrador', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-09-14 11:55:54'),
    ('entrada', 1, NULL, 1, 50, 'Remito 0001-00001066 - Distribuidora Molinos SA', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-09-15 08:15:57'),
    ('salida', 4, 2, NULL, 6, 'Entrega a Comedor San Martín', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-09-17 18:25:55'),
    ('salida', 6, 1, NULL, 3, 'Venta mostrador', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-09-18 09:25:31'),
    ('salida', 1, 1, NULL, 6, 'Venta mostrador', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-09-20 18:55:45'),
    ('transferencia', 1, 1, 2, 10, 'Reposición de la Sucursal 2', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-09-21 11:05:28'),
    ('entrada', 9, NULL, 1, 100, 'Remito 0001-00001279 - Mayorista Del Norte', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-09-22 09:30:41'),
    ('salida', 9, 1, NULL, 6, 'Entrega pedido de Panadería La Espiga', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-09-22 10:34:41'),
    ('transferencia', 9, 1, 2, 40, 'Reposición de la Sucursal 2', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-09-22 14:36:41'),
    ('salida', 9, 1, NULL, 3, 'Entrega a Comedor San Martín', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-09-22 14:58:41'),
    ('transferencia', 9, 1, 2, 40, 'Reposición de la Sucursal 2', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-09-22 14:59:41'),
    ('salida', 9, 2, NULL, 4, 'Venta mostrador', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-09-22 20:06:41'),
    ('transferencia', 6, 1, 2, 20, 'Reposición de la Sucursal 2', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-09-24 12:15:47'),
    ('salida', 3, 1, NULL, 8, 'Venta mostrador', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-09-25 14:20:27'),
    ('salida', 5, 2, NULL, 4, 'Venta mayorista', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-09-26 10:50:26'),
    ('salida', 3, 1, NULL, 2, 'Venta mostrador', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-09-26 15:55:43'),
    ('salida', 2, 1, NULL, 2, 'Entrega a Kiosco El Sol', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-09-27 11:05:39'),
    ('transferencia', 4, 1, 2, 10, 'Reposición de la Sucursal 2', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-09-27 11:20:04'),
    ('salida', 4, 2, NULL, 3, 'Venta mostrador', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-09-27 16:00:46'),
    ('salida', 9, 2, NULL, 8, 'Entrega a Comedor San Martín', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-09-29 13:10:34'),
    ('salida', 8, 1, NULL, 8, 'Venta mostrador', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-09-29 17:00:52'),
    ('salida', 7, 2, NULL, 6, 'Entrega pedido de Panadería La Espiga', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-09-30 18:05:42'),
    ('salida', 5, 2, NULL, 5, 'Entrega pedido de Panadería La Espiga', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-10-01 16:20:21'),
    ('transferencia', 3, 1, 2, 10, 'Reposición de la Sucursal 2', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-10-02 10:00:41'),
    ('salida', 3, 2, NULL, 9, 'Entrega pedido de Panadería La Espiga', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-10-02 15:13:41'),
    ('salida', 4, 1, NULL, 3, 'Entrega a Almacén Don José', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-10-04 14:00:03'),
    ('salida', 9, 1, NULL, 10, 'Venta mayorista', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-10-04 18:30:12'),
    ('transferencia', 3, 1, 2, 10, 'Reposición de la Sucursal 2', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-10-06 09:40:25'),
    ('salida', 7, 2, NULL, 4, 'Entrega pedido de Panadería La Espiga', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-10-06 16:55:16'),
    ('salida', 4, 2, NULL, 3, 'Entrega a Kiosco El Sol', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-10-08 19:25:18'),
    ('salida', 9, 2, NULL, 12, 'Venta mayorista', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-10-09 08:05:37'),
    ('transferencia', 8, 1, 2, 20, 'Reposición de la Sucursal 2', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-10-09 12:25:53'),
    ('salida', 8, 2, NULL, 7, 'Venta mayorista', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-10-09 16:33:53'),
    ('salida', 8, 2, NULL, 5, 'Entrega a Comedor San Martín', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-10-09 18:08:53'),
    ('transferencia', 4, 1, 2, 20, 'Reposición de la Sucursal 2', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-10-12 09:20:59'),
    ('salida', 4, 2, NULL, 8, 'Venta mostrador', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-10-12 14:27:59'),
    ('salida', 4, 1, NULL, 9, 'Entrega a Comedor San Martín', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-10-12 17:15:38'),
    ('salida', 8, 2, NULL, 4, 'Venta mostrador', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-10-12 18:25:23'),
    ('salida', 6, 2, NULL, 7, 'Entrega pedido de Panadería La Espiga', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-10-13 14:40:35'),
    ('salida', 3, 1, NULL, 2, 'Venta mayorista', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-10-13 16:50:36'),
    ('salida', 1, 1, NULL, 3, 'Entrega pedido de Panadería La Espiga', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-10-16 13:30:47'),
    ('salida', 2, 2, NULL, 9, 'Venta mostrador', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-10-17 10:00:20'),
    ('salida', 5, 2, NULL, 9, 'Entrega a Kiosco El Sol', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-10-17 15:50:29'),
    ('salida', 1, 1, NULL, 3, 'Entrega a Comedor San Martín', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-10-19 13:35:27'),
    ('salida', 2, 2, NULL, 3, 'Venta mostrador', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-10-20 08:05:24'),
    ('entrada', 9, NULL, 1, 60, 'Remito 0001-00001265 - Mayorista Del Norte', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-10-20 09:10:44'),
    ('salida', 9, 1, NULL, 2, 'Venta mayorista', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-10-20 11:11:44'),
    ('salida', 9, 1, NULL, 12, 'Venta mayorista', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-10-20 11:30:44'),
    ('salida', 6, 1, NULL, 3, 'Entrega pedido de Panadería La Espiga', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-10-20 12:45:19'),
    ('salida', 9, 1, NULL, 14, 'Venta mayorista', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-10-20 14:11:44'),
    ('salida', 9, 1, NULL, 4, 'Venta mayorista', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-10-20 14:45:40'),
    ('salida', 3, 1, NULL, 4, 'Entrega a Kiosco El Sol', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-10-21 12:10:22'),
    ('salida', 9, 1, NULL, 8, 'Venta mayorista', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-10-21 16:35:56'),
    ('salida', 8, 2, NULL, 1, 'Venta mayorista', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-10-23 11:20:49'),
    ('salida', 3, 2, NULL, 2, 'Entrega pedido de Panadería La Espiga', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-10-24 16:50:11'),
    ('salida', 4, 2, NULL, 2, 'Entrega pedido de Panadería La Espiga', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-10-25 13:45:57'),
    ('salida', 9, 2, NULL, 13, 'Venta mayorista', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-10-25 16:40:06'),
    ('salida', 1, 2, NULL, 5, 'Venta mostrador', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-10-26 15:10:30'),
    ('salida', 9, 2, NULL, 5, 'Venta mayorista', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-10-27 11:10:15'),
    ('entrada', 7, NULL, 1, 48, 'Remito 0001-00001195 - Mayorista Del Norte', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-10-28 09:30:17'),
    ('transferencia', 7, 1, 2, 12, 'Reposición de la Sucursal 2', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-10-28 10:36:17'),
    ('salida', 7, 1, NULL, 8, 'Venta mostrador', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-10-28 11:51:17'),
    ('salida', 7, 1, NULL, 8, 'Entrega a Comedor San Martín', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-10-28 12:04:17'),
    ('salida', 7, 1, NULL, 5, 'Entrega a Comedor San Martín', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-10-28 12:35:17'),
    ('salida', 7, 2, NULL, 2, 'Venta mostrador', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-10-28 13:05:17'),
    ('salida', 7, 1, NULL, 8, 'Entrega pedido de Panadería La Espiga', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-10-28 13:09:17'),
    ('salida', 7, 1, NULL, 3, 'Entrega a Kiosco El Sol', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-10-28 15:14:17'),
    ('salida', 2, 1, NULL, 9, 'Venta mostrador', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-10-29 08:05:00'),
    ('salida', 9, 2, NULL, 6, 'Venta mayorista', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-10-30 13:55:13'),
    ('salida', 6, 2, NULL, 3, 'Venta mostrador', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-10-30 17:25:05'),
    ('salida', 4, 1, NULL, 2, 'Entrega a Comedor San Martín', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-10-30 17:50:41'),
    ('salida', 1, 2, NULL, 6, 'Entrega a Comedor San Martín', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-10-30 18:35:45'),
    ('salida', 8, 1, NULL, 8, 'Entrega a Kiosco El Sol', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-10-31 11:25:17'),
    ('salida', 2, 1, NULL, 9, 'Entrega pedido de Panadería La Espiga', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-11-02 09:50:17'),
    ('transferencia', 2, 1, 2, 10, 'Reposición de la Sucursal 2', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-11-02 11:35:59'),
    ('entrada', 5, NULL, 1, 50, 'Remito 0001-00001151 - Mayorista Del Norte', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-11-03 09:10:11'),
    ('salida', 9, 2, NULL, 12, 'Venta mayorista', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-11-03 09:35:29'),
    ('salida', 5, 1, NULL, 8, 'Venta mayorista', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-11-03 10:11:11'),
    ('salida', 5, 1, NULL, 6, 'Entrega pedido de Panadería La Espiga', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-11-03 12:18:11'),
    ('salida', 5, 1, NULL, 4, 'Venta mostrador', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-11-03 12:44:11'),
    ('transferencia', 5, 1, 2, 10, 'Reposición de la Sucursal 2', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-11-03 14:23:11'),
    ('salida', 5, 1, NULL, 7, 'Venta mayorista', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-11-03 14:29:11'),
    ('salida', 1, 1, NULL, 8, 'Entrega a Kiosco El Sol', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-11-03 18:25:13'),
    ('salida', 6, 2, NULL, 5, 'Entrega pedido de Panadería La Espiga', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-11-04 09:40:33'),
    ('salida', 6, 2, NULL, 5, 'Venta mostrador', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-11-04 12:20:48'),
    ('salida', 3, 2, NULL, 4, 'Entrega pedido de Panadería La Espiga', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-11-04 14:20:29'),
    ('salida', 9, 2, NULL, 8, 'Venta mayorista', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-11-04 18:40:20'),
    ('entrada', 4, NULL, 1, 30, 'Remito 0001-00001122 - Distribuidora Molinos SA', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-11-05 09:50:40'),
    ('salida', 2, 2, NULL, 4, 'Entrega a Almacén Don José', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-11-05 14:30:51'),
    ('salida', 5, 2, NULL, 8, 'Entrega pedido de Panadería La Espiga', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-11-06 10:55:57'),
    ('salida', 5, 1, NULL, 7, 'Venta mostrador', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-11-06 12:25:40'),
    ('salida', 6, 1, NULL, 4, 'Venta mostrador', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-11-07 08:10:20'),
    ('entrada', 6, NULL, 1, 80, 'Remito 0001-00001164 - Distribuidora Molinos SA', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-11-07 10:20:34'),
    ('transferencia', 6, 1, 2, 20, 'Reposición de la Sucursal 2', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-11-07 12:25:51'),
    ('salida', 3, 2, NULL, 6, 'Venta mostrador', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-11-07 15:35:07'),
    ('salida', 3, 1, NULL, 4, 'Venta mostrador', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-11-08 11:40:57'),
    ('transferencia', 1, 1, 2, 10, 'Reposición de la Sucursal 2', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-11-08 12:15:00'),
    ('salida', 1, 2, NULL, 9, 'Venta mostrador', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-11-08 12:30:36'),
    ('salida', 7, 1, NULL, 1, 'Venta mayorista', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-11-09 11:35:32'),
    ('entrada', 8, NULL, 1, 50, 'Remito 0001-00001233 - Distribuidora Molinos SA', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-11-10 09:35:42'),
    ('salida', 9, 1, NULL, 9, 'Venta mayorista', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-11-10 10:40:14'),
    ('salida', 2, 2, NULL, 4, 'Entrega a Kiosco El Sol', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-11-10 11:35:37'),
    ('transferencia', 8, 1, 2, 20, 'Reposición de la Sucursal 2', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-11-10 12:58:42'),
    ('salida', 8, 1, NULL, 7, 'Entrega a Kiosco El Sol', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-11-10 14:09:42'),
    ('salida', 8, 2, NULL, 6, 'Venta mayorista', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-11-10 18:44:42'),
    ('salida', 1, 2, NULL, 9, 'Entrega a Comedor San Martín', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-11-11 15:05:27'),
    ('salida', 8, 2, NULL, 8, 'Venta mostrador', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-11-12 10:20:55'),
    ('salida', 9, 2, NULL, 5, 'Entrega a Almacén Don José', (SELECT id FROM usuarios WHERE email = 'mnbenitez2020@gmail.com'), '2026-11-12 17:35:05'),
    ('salida', 9, 1, NULL, 12, 'Venta mayorista', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-11-13 13:35:08'),
    ('salida', 1, 2, NULL, 2, 'Venta mostrador', (SELECT id FROM usuarios WHERE email = 'brunodaniellopez24@gmail.com'), '2026-11-14 11:10:52');

COMMIT;
