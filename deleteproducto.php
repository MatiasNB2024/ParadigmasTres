<?php
include 'productos.php';

// Verificamos si el ID fue proporcionado por GET
if (isset($_GET['id'])) {
    $id = $_GET['id'];

    // Eliminar el producto de la base de datos
    deleteProduct($id);
    echo "Producto eliminado exitosamente.";
} else {
    echo "No se proporcionó un ID válido para eliminar.";
}

// Función para eliminar un producto
function deleteProduct($id) {
    global $conn;

    // Consulta para eliminar el producto por ID
    $sql = "DELETE FROM products WHERE id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $id); // "i" es para un entero (ID)
    $stmt->execute();
}
?>

<!-- Redirigir a la lista de productos después de eliminar -->
<meta http-equiv="refresh" content="2;url=productos.php">
