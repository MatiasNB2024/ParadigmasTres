<?php
include 'conexion.php';

if (isset($_GET['id'])) {
    $id = $_GET['id'];
    $sql = "SELECT * FROM productos_recibidos WHERE id = :id";
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':id', $id);
    $stmt->execute();
    $producto = $stmt->fetch(PDO::FETCH_ASSOC);

    // Verificar si el producto existe
    if (!$producto) {
        echo "Producto no encontrado.";
        exit;
    }
}

if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    $nombre_producto = $_POST['nombre_producto'];
    $cantidad = $_POST['cantidad'];
    $fecha_recepcion = $_POST['fecha_recepcion'];
    $proveedor = $_POST['proveedor'];
    $precio_compra = $_POST['precio_compra'];
    
    // Subir la imagen si es que hay una nueva
    $target_file = $producto['imagen']; // Usar la imagen actual si no hay nueva
    if ($_FILES["imagen"]["name"]) {
        $target_dir = "uploads/"; // Directorio donde se guardarán las imágenes
        $target_file = $target_dir . uniqid() . "_" . basename($_FILES["imagen"]["name"]); // Renombrar la imagen para evitar sobreescritura
        move_uploaded_file($_FILES["imagen"]["tmp_name"], $target_file);
    }

    // Actualizar en la base de datos
    $sql = "UPDATE productos_recibidos SET nombre_producto = :nombre_producto, cantidad = :cantidad, fecha_recepcion = :fecha_recepcion, proveedor = :proveedor, precio_compra = :precio_compra, imagen = :imagen WHERE id = :id";
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':nombre_producto', $nombre_producto);
    $stmt->bindParam(':cantidad', $cantidad);
    $stmt->bindParam(':fecha_recepcion', $fecha_recepcion);
    $stmt->bindParam(':proveedor', $proveedor);
    $stmt->bindParam(':precio_compra', $precio_compra);
    $stmt->bindParam(':imagen', $target_file);
    $stmt->bindParam(':id', $id);

    if ($stmt->execute()) {
        echo "Producto actualizado exitosamente.";
        exit; // Detener el script después de actualizar
    } else {
        echo "Hubo un error al actualizar el producto.";
        exit; // Detener el script en caso de error
    }
}
?>

<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Editar Producto</title>
</head>
<body>
    <h1>Editar Producto</h1>
    <form action="editar_producto.php?id=<?= $producto['id'] ?>" method="POST" enctype="multipart/form-data">
        <label for="nombre_producto">Nombre del Producto:</label>
        <input type="text" name="nombre_producto" value="<?= $producto['nombre_producto'] ?>" required>
        <br>
        <label for="cantidad">Cantidad:</label>
        <input type="number" name="cantidad" value="<?= $producto['cantidad'] ?>" required>
        <br>
        <label for="fecha_recepcion">Fecha de Recepción:</label>
        <input type="date" name="fecha_recepcion" value="<?= $producto['fecha_recepcion'] ?>" required>
        <br>
        <label for="proveedor">Proveedor:</label>
        <input type="text" name="proveedor" value="<?= $producto['proveedor'] ?>" required>
        <br>
        <label for="precio_compra">Precio de Compra:</label>
        <input type="number" name="precio_compra" step="0.01" value="<?= $producto['precio_compra'] ?>" required>
        <br>
        <label for="imagen">Imagen (opcional):</label>
        <input type="file" name="imagen" accept="image/*">
        <br><br>
        <button type="submit">Actualizar Producto</button>
    </form>
</body>
</html>
