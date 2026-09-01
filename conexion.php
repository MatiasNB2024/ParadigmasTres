<?php
$servername = "localhost:3307"; // Cambia si usas un servidor diferente
$username = "root";  // Usuario de la base de datos
$password = "123456";  // Contraseña de la base de datos
$dbname = "bd_stock";  // Nombre de tu base de datos

// Crear conexión
$conn = new mysqli($servername, $username, $password, $dbname);

// Verificar conexion
if ($conn->connect_error) {
    die("Conexion fallida: " . $conn->connect_error);
}
?>
