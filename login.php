<?php
session_start(); // Iniciar sesión para guardar la información del usuario

// Incluir el archivo de conexión
include 'conexion.php';

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $correo = $_POST['correo']; // Obtener el correo del formulario
    $password = $_POST['password']; // Obtener la contraseña del formulario

    // Comprobar si el usuario existe en la base de datos
    $sql = "SELECT * FROM usuarios WHERE correo = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("s", $correo); // 's' para string
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows > 0) {
        $usuario = $result->fetch_assoc(); // Obtener los datos del usuario

        // Verificar la contraseña
        if (password_verify($password, $usuario['password'])) {
            // Contraseña correcta, iniciar sesión
            $_SESSION['usuario_id'] = $usuario['id'];
            $_SESSION['nombre'] = $usuario['nombre'];
            $_SESSION['correo'] = $usuario['correo'];
            $_SESSION['rol'] = $usuario['rol'];

            // Redirigir al usuario a la página principal
            header("Location: inicio.php");
            exit();
        } else {
            // Contraseña incorrecta
            $error = "Contraseña incorrecta.";
        }
    } else {
        // Usuario no encontrado
        $error = "Usuario no encontrado.";
    }
}
?>

<!-- Formulario de inicio de sesión -->
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Iniciar Sesión</title>
</head>
<body>

<h2>Iniciar Sesión</h2>

<?php
if (isset($error)) {
    echo "<p style='color: red;'>$error</p>";
}
?>

<form action="login.php" method="POST">
    <label for="correo">Correo Electrónico:</label>
    <input type="email" id="correo" name="correo" required><br><br>

    <label for="password">Contraseña:</label>
    <input type="password" id="password" name="password" required><br><br>

    <button type="submit">Iniciar Sesión</button>
</form>

</body>
</html>
