<?php
// Configuración de la conexión a la base de datos
$conn = new mysqli('localhost', 'usuario', 'contraseña', 'nombre_base_datos');

// Verificar la conexión
if ($conn->connect_error) {
    die("Conexión fallida: " . $conn->connect_error);
}

// Función para obtener un producto por su ID
function getProductById($id) {
    global $conn;

    $sql = "SELECT * FROM products WHERE id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $id); // "i" indica que el parámetro es un entero
    $stmt->execute();
    $result = $stmt->get_result();

    // Verificar si se encontró el producto
    if ($result->num_rows > 0) {
        return $result->fetch_assoc(); // Devuelve el producto encontrado
    } else {
        return null; // Si no se encuentra, retorna null
    }
}

// Función para actualizar un producto
function updateProduct($id, $productName, $quantity, $receiptDate, $supplier, $purchasePrice, $image) {
    global $conn;

    // Si se subió una imagen, manejamos el archivo
    if ($image) {
        $imagePath = "uploads/" . basename($image['name']);
        move_uploaded_file($image['tmp_name'], $imagePath);
    } else {
        // Si no se sube una imagen, usamos la imagen existente (esto es opcional, dependiendo de tu implementación)
        $imagePath = ''; // Cambia esto si deseas mantener la imagen anterior si no se sube una nueva
    }

    // Consulta para actualizar los datos del producto
    $sql = "UPDATE products SET productName = ?, quantity = ?, receiptDate = ?, supplier = ?, purchasePrice = ?, image = ? WHERE id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("sissssi", $productName, $quantity, $receiptDate, $supplier, $purchasePrice, $imagePath, $id);
    $stmt->execute();
}
?>
