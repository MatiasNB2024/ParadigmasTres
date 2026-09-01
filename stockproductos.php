<?php
include 'productos.php';

// Comprobamos si se envió el formulario
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $id = $_POST['id'];
    $productName = $_POST['productName'];
    $quantity = $_POST['quantity'];
    $receiptDate = $_POST['receiptDate'];
    $supplier = $_POST['supplier'];
    $purchasePrice = $_POST['purchasePrice'];
    $image = $_FILES['image'];  // Usamos $_FILES para obtener la imagen subida

    // Actualizar el producto
    updateProduct($id, $productName, $quantity, $receiptDate, $supplier, $purchasePrice, $image);
}

// Verificamos si el ID es válido
if (isset($_GET['id'])) {
    $product = getProductById($_GET['id']);
    if (!$product) {
        echo "Producto no encontrado.";
        exit; // Detenemos la ejecución si no encontramos el producto
    }
} else {
    echo "No se proporcionó un ID válido.";
    exit; // Detenemos la ejecución si no se pasa un ID válido
}
?>

<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Actualizar Producto</title>
</head>
<body>

<h1>Actualizar Producto</h1>

<form method="POST" enctype="multipart/form-data">
    <!-- Campo oculto para pasar el ID del producto -->
    <input type="hidden" name="id" value="<?= $product['id'] ?>">

    <!-- Nombre del producto -->
    <label for="productName">Nombre del Producto:</label>
    <input type="text" name="productName" value="<?= $product['productName'] ?>" required><br>

    <!-- Cantidad del producto -->
    <label for="quantity">Cantidad:</label>
    <input type="number" name="quantity" value="<?= $product['quantity'] ?>" required><br>

    <!-- Fecha de recibo -->
    <label for="receiptDate">Fecha de Recibo:</label>
    <input type="date" name="receiptDate" value="<?= $product['receiptDate'] ?>" required><br>

    <!-- Proveedor -->
    <label for="supplier">Proveedor:</label>
    <input type="text" name="supplier" value="<?= $product['supplier'] ?>" required><br>

    <!-- Precio de compra -->
    <label for="purchasePrice">Precio de Compra:</label>
    <input type="number" name="purchasePrice" value="<?= $product['purchasePrice'] ?>" required><br>

    <!-- Imagen del producto -->
    <label for="image">Imagen:</label>
    <input type="file" name="image" accept="image/*"><br>

    <!-- Botón para enviar el formulario -->
    <button type="submit">Actualizar</button>
</form>

</body>
</html>
