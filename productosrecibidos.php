<?php
include 'conexion.php';

$sql = "SELECT * FROM productos_recibidos";
$stmt = $conn->prepare($sql);
$stmt->execute();
$productos = $stmt->fetchAll(PDO::FETCH_ASSOC);
?>

<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Productos Recibidos</title>
</head>
<body>
    <h1>Lista de Productos Recibidos</h1>

    <table border="1">
        <thead>
            <tr>
                <th>Imagen</th>
                <th>Nombre</th>
                <th>Cantidad</th>
                <th>Fecha de Recepción</th>
                <th>Proveedor</th>
                <th>Precio</th>
                <th>Acciones</th>
            </tr>
        </thead>
        <tbody>
            <?php foreach ($productos as $producto): ?>
                <tr>
                    <td><img src="<?= $producto['imagen'] ?>" alt="Imagen" width="50"></td>
                    <td><?= $producto['nombre_producto'] ?></td>
                    <td><?= $producto['cantidad'] ?></td>
                    <td><?= $producto['fecha_recepcion'] ?></td>
                    <td><?= $producto['proveedor'] ?></td>
                    <td><?= '$' . number_format($producto['precio_compra'], 2) ?></td>
                    <td>
                        <a href="editar_producto.php?id=<?= $producto['id'] ?>">Editar</a> |
                        <a href="eliminar_producto.php?id=<?= $producto['id'] ?>">Eliminar</a>
                    </td>
                </tr>
            <?php endforeach; ?>
        </tbody>
    </table>
</body>
</html>
