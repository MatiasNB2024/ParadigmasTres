<?php
// Establecer la conexión con la base de datos
$servername = "localhost:3307";  // Cambia a tu servidor
$username = "root";         // Cambia a tu usuario de base de datos
$password = "123456";             // Cambia a tu contraseña de base de datos
$dbname = "bd_stock";  // Cambia a tu nombre de base de datos

// Crear conexión
$conn = new mysqli($servername, $username, $password, $dbname);

// Verificar la conexión
if ($conn->connect_error) {
    die("Conexion fallida: " . $conn->connect_error);
}

// Recibir los datos del formulario
$name = $_POST['name'];
$address = $_POST['address'];
$phone = $_POST['phone'];
$email = $_POST['email'];
$payment = $_POST['payment'];
$additionalInfo = $_POST['additionalInfo'];

// Preparar la consulta SQL para insertar los datos
$sql = "INSERT INTO perfiles (nombre, direccion, telefono, email, medio_pago, info_adicional) 
        VALUES ('$name', '$address', '$phone', '$email', '$payment', '$additionalInfo')";

// Ejecutar la consulta y verificar si se insertaron los datos correctamente
if ($conn->query($sql) === TRUE) {
    echo "Perfil guardado exitosamente";
} else {
    echo "Error: " . $sql . "<br>" . $conn->error;
}

// Cerrar la conexión
$conn->close();
?>
