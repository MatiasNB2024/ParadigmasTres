SISTEMA DE GESTION DE STOCK - AE2 (con autenticacion PHP + MySQL)
==================================================================

REQUISITOS
----------
XAMPP con Apache y MySQL (PHP 7.4 o superior, con la extension mbstring, que XAMPP trae activa).

PUESTA EN MARCHA (paso a paso)
------------------------------
1. Copiar la carpeta "AE1Paradigmas" dentro de  C:\xampp\htdocs\
2. Abrir el Panel de XAMPP e iniciar  Apache  y  MySQL.
3. Crear la base de datos (una sola vez):
     - Abrir http://localhost/phpmyadmin
     - Pestania "Importar" > "Seleccionar archivo" > database/schema.sql > "Importar".
     Esto crea la base  benitez_stock  y la tabla  usuarios  (password VARCHAR(255) para el hash BCRYPT).
4. Si tu MySQL tiene otra contrasenia (en el ejemplo de clase el usuario root usa "root123"),
   editar DB_PASS (y DB_USER / DB_NAME si hace falta) en config/conexion.php.
5. Abrir  http://localhost/AE1Paradigmas/  y usar "Iniciar Sesion" > "Registrar nuevo usuario".
6. Para crear un ADMINISTRADOR: registrar el usuario y ejecutar en phpMyAdmin (pestania SQL):
       UPDATE usuarios SET rol = 'administrador' WHERE email = 'tu@correo.com';
   Todo registro desde la web queda como 'empleado' (el cliente no puede elegir el rol).

NO abrir los .html con doble clic: fetch() y las sesiones PHP solo funcionan desde http://localhost.

API (carpeta api/)  -  todas responden JSON: { "estado": "exito" | "error", "mensaje": "..." }
------------------------------------------------------------------------------------------
POST api/registro.php  {nombre,email,password}   201 creado | 400 datos invalidos | 409 correo repetido
POST api/login.php     {email,password}          200 + usuario{id,nombre,email,rol} | 400 | 401 credenciales incorrectas
POST api/logout.php                              200 sesion cerrada
GET  api/perfil.php    (PRIVADO)                 200 + data{id,nombre,email,rol,creado_en} | 401 sin sesion

SEGURIDAD IMPLEMENTADA
----------------------
- Contrasenias con password_hash(..., PASSWORD_BCRYPT) y password_verify(); nunca en texto plano.
- Consultas con PDO Prepared Statements (prevencion de inyeccion SQL).
- session_start() + session_regenerate_id(true) ANTES de guardar $_SESSION['usuario_id'] al iniciar
  sesion, y session.use_strict_mode activo (prevencion de fijacion de sesion).
- Sin hashes ni claves escritos en el codigo: si el correo no existe, login.php calcula un hash
  descartable en memoria para que la respuesta tarde lo mismo (evita ataques de temporizacion).
- Todas las llamadas fetch() tienen manejo de errores (try/catch o .catch()) con aviso en pantalla.
- Cookie de sesion HttpOnly y SameSite=Lax.
- api/perfil.php responde 401 si no hay $_SESSION['usuario_id'].
- XSS: el nombre solo admite letras, numeros, espacios y . ' _ - (no se guarda HTML) y el frontend
  escribe nombres y datos del usuario con .textContent (nunca innerHTML).
- Mensaje de login generico (no revela si fallo el correo o la clave).
- El rol lo asigna la base de datos; la web nunca lo recibe del cliente.

VISTAS SEGUN LA SESION Y EL ROL (VSDM)
--------------------------------------
Al cargar cada pagina, javascript/sesion.js (comprobarSesion) hace fetch() a api/perfil.php.
- Visitante (sin sesion):  stockproductos.html en solo lectura (tabla, ubicacion y alertas).
- Empleado:                ademas alta y edicion de productos y "Detalle tecnico" (Opcion 8).
- Administrador:           ademas umbral critico, "Verificar stock" y edicion de los datos tecnicos
                           (ubicacion, lote, vencimiento, peso, medidas, almacenamiento, contacto;
                           el SKU solo se carga si el producto todavia no tiene uno).
  Los datos tecnicos salen de data/detalles.json; lo que edita el administrador se guarda en
  localStorage (clave stockDetalles) y se superpone a ese archivo.
- menuinicio, productosrecibidos, entregarproductos, perfilusuario: sin sesion redirigen a iniciosesion.html.

ESTRUCTURA
----------
  api/            endpoints PHP (registro, login, logout, perfil)
  config/         conexion.php (PDO) y helpers.php (respuestas JSON, cookie de sesion)
  database/       schema.sql
  javascript/     un .js por pantalla; sesion.js es compartido; el HTML no contiene JS
  data/           stock.json y detalles.json (los lee fetch())
  css/            estilos.css (secciones internas) + css propios de index y login
