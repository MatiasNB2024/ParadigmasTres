<?php
include 'conexion.php';

if (isset($_GET['id'])) {
    $id = $_GET['id'];
    $sql = "DELETE FROM productos_recibidos WHERE id = :id";
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':id', $id);

    if ($stmt->execute()) {
        echo "Producto eliminado exitosamente.";
    } else {
        echo "Hubo un error al eliminar el producto.";
    }
}
?>
