# Sistema de Gestión de Stock — Benitez Despensas

Aplicación web para gestionar el inventario de **Benitez Despensas**, un comercio con **dos sucursales**. Permite consultar el stock de cada sucursal y dónde está guardado cada producto, registrar entradas, salidas y transferencias de mercadería, controlar vencimientos y productos con bajo stock, y administrar los usuarios del sistema.

Trabajo Integrador Final (**AE4 / TIFAS**) de **Paradigmas y Lenguajes de Programación III** — Ingeniería en Sistemas de Información, Universidad de la Cuenca del Plata.

**Integrantes:** Matías Nicolás Benitez · Bruno Daniel Lopez

---

## Contenido

1. [Funcionalidades](#funcionalidades)
2. [Arquitectura](#arquitectura)
3. [Estructura de carpetas](#estructura-de-carpetas)
4. [Tecnologías](#tecnologías)
5. [Instalación en XAMPP](#instalación-en-xampp)
6. [Uso](#uso)
7. [API REST](#api-rest)
8. [Seguridad (OWASP Top 10)](#seguridad-owasp-top-10)
9. [Accesibilidad (WCAG 2.1)](#accesibilidad-wcag-21)
10. [Trazabilidad con los Casos de Uso de la AE1](#trazabilidad-con-los-casos-de-uso-de-la-ae1)
11. [Solución de problemas](#solución-de-problemas)

---

## Funcionalidades

Para usar el sistema hay que iniciar sesión. Los actores son los de los Casos de Uso de la AE1.

| Funcionalidad | Empleado | Administrador |
|---|:---:|:---:|
| Consultar stock y ubicación de cada producto en cada sucursal | ✅ | ✅ |
| Buscar productos por nombre, código o categoría | ✅ | ✅ |
| Ver la ficha técnica del producto (lote, vencimiento, medidas…) | ✅ | ✅ |
| Registrar entradas de mercadería (suman stock) | ✅ | ✅ |
| Registrar salidas por venta o entrega (restan stock) | ✅ | ✅ |
| Transferir stock entre sucursales | ✅ | ✅ |
| Consultar el historial de movimientos | ✅ | ✅ |
| Ver alertas de bajo stock y de vencimientos | ✅ | ✅ |
| Registrar, modificar y dar de baja productos | ❌ | ✅ |
| Editar ubicaciones y el stock mínimo de cada producto | ❌ | ✅ |
| Gestionar usuarios (crear, cambiar el rol, deshabilitar) | ❌ | ✅ |

Las cantidades nunca se editan a mano: **el stock solo cambia a través de un movimiento**, y cada movimiento queda registrado con su fecha, su usuario y su observación (remito, cliente o motivo).

---

## Arquitectura

El sistema sigue el patrón **Modelo-Vista-Controlador desacoplado**. El cliente y el servidor se comunican **solo con peticiones HTTP asíncronas que intercambian JSON**.

```mermaid
flowchart LR
    subgraph Cliente["Navegador · VISTA (public/)"]
        SPA["index.html + plantillas<br/>js/app.js · router<br/>js/vistas/*.js"]
        API_JS["js/api.js<br/>fetch() + async/await"]
        SPA --> API_JS
    end

    subgraph Servidor["Apache + PHP"]
        CTRL["CONTROLADOR (api/*.php)<br/>sesión · rol · validación<br/>códigos HTTP · JSON"]
        MOD["MODELO (models/*.php)<br/>PDO Prepared Statements"]
        CONF["config/<br/>conexion.php (PDO Singleton)<br/>auth.php · helpers.php"]
        CTRL --> MOD
        CTRL --> CONF
        MOD --> CONF
    end

    DB[("MySQL / MariaDB<br/>benitez_stock")]

    API_JS -- "HTTP + JSON" --> CTRL
    CTRL -- "JSON + código HTTP" --> API_JS
    MOD --> DB
```

- **Vista (`public/`)**: una *Single Page Application* en JavaScript Vanilla, evolución de la maqueta HTML5/CSS3 de la AE1. Cambiar de sección no recarga la página: el router (`js/app.js`) clona la plantilla correspondiente de `index.html` y pide los datos a la API.
- **Controlador (`api/`)**: cada endpoint valida la sesión y el rol en el servidor, valida los datos de entrada, llama al modelo y responde JSON con el código HTTP correspondiente.
- **Modelo (`models/`)**: solo acceso a datos y reglas de negocio, siempre con consultas preparadas con marcadores nombrados (`:campo`).

---

## Estructura de carpetas

```
AE1Paradigmas/
├── index.html                 Redirige a public/ (la aplicación)
├── README.md                  Este archivo
│
├── config/                    Configuración del servidor (no accesible desde el navegador)
│   ├── conexion.php           Conexión PDO Singleton a MySQL, con manejo de excepciones
│   ├── auth.php               Control de acceso: exigir_sesion() → 401, exigir_administrador() → 403
│   ├── helpers.php            Respuestas JSON, lectura y validación de datos, cookie de sesión segura
│   └── .htaccess              Bloquea el acceso directo
│
├── models/                    MODELO: acceso a datos con PDO Prepared Statements
│   ├── UsuarioModel.php       Usuarios, BCRYPT, roles y estado (activo/deshabilitado)
│   ├── ProductoModel.php      Productos, stock por sucursal, bajo stock, vencimientos, concurrencia
│   ├── MovimientoModel.php    Entradas, salidas y transferencias (transacciones atómicas)
│   ├── StockModel.php         Ubicación de cada producto en cada sucursal
│   ├── CatalogoModel.php      Sucursales y categorías
│   ├── Excepciones.php        Errores de negocio → 400 / 404 / 409
│   └── .htaccess              Bloquea el acceso directo
│
├── api/                       CONTROLADOR: endpoints REST que devuelven JSON
│   ├── login.php              Iniciar sesión (BCRYPT, session_regenerate_id)
│   ├── logout.php             Cerrar sesión
│   ├── registro.php           Registro público (siempre como empleado)
│   ├── perfil.php             Datos del usuario de la sesión (401 si no hay sesión)
│   ├── productos.php          CRUD de productos
│   ├── movimientos.php        Registrar y consultar movimientos
│   ├── stock.php              Ubicación del producto por sucursal
│   ├── alertas.php            Bajo stock y vencimientos
│   ├── sucursales.php         Lista de sucursales
│   ├── categorias.php         Lista de categorías
│   ├── usuarios.php           Gestión de usuarios
│   └── imagenes.php           Subida de la imagen de un producto
│
├── database/                  Scripts SQL (no accesibles desde el navegador)
│   ├── schema.sql             Crea la base, las tablas y los datos de ejemplo
│   ├── actualizar_desde_ae2.sql  Solo para bases creadas en la AE2
│   ├── historial_ejemplo.sql  Recarga el historial de movimientos de ejemplo
│   └── .htaccess
│
└── public/                    VISTA: Single Page Application (evolución de la maqueta de la AE1)
    ├── index.html             Única página: estructura semántica y plantillas <template> de cada vista
    ├── css/
    │   └── estilos.css        Layout responsive (Flexbox/Grid), contraste AA y :focus-visible
    ├── js/
    │   ├── app.js             Punto de entrada: router, sesión y protección de rutas
    │   ├── api.js             Cliente de la API: fetch() + async/await
    │   ├── sesion.js          Estado de la sesión (consultado al servidor)
    │   ├── ui.js              Utilidades del DOM con .textContent (sin innerHTML)
    │   └── vistas/            Un módulo por grupo de Casos de Uso
    │       ├── login.js       Iniciar sesión y registro
    │       ├── inicio.js      Resumen y alertas
    │       ├── stock.js       Consultar, registrar, modificar y dar de baja productos
    │       ├── movimientos.js Entradas, salidas, transferencias e historial
    │       ├── usuarios.js    Gestión de usuarios
    │       └── perfil.js      Datos de la cuenta
    ├── imgstock/              Imágenes de los productos de ejemplo
    └── uploads/               Imágenes subidas (con .htaccess que impide ejecutar código)
```

### Base de datos

| Tabla | Contenido |
|---|---|
| `usuarios` | Nombre, correo, contraseña (hash BCRYPT en `VARCHAR(255)`), rol y estado |
| `sucursales` | Sucursal 1 y Sucursal 2 |
| `categorias` | Harinas, Almacén, Aceites, Infusiones |
| `productos` | Código, nombre, categoría, presentación, precio, proveedor, vencimiento, lote, stock mínimo, `version` |
| `stock` | Cantidad y ubicación de cada producto en cada sucursal |
| `movimientos` | Historial de entradas, salidas y transferencias: quién, cuándo, cuánto y entre qué sucursales |

---

## Tecnologías

| Capa | Tecnología |
|---|---|
| Vista | HTML5 semántico, CSS3 (Flexbox y Grid), JavaScript Vanilla (módulos ES, `fetch`, `async/await`) |
| Controlador y modelo | PHP 8.0 o superior, PDO |
| Base de datos | MySQL / MariaDB 10.4 o superior |
| Servidor local | XAMPP (Apache + MariaDB + PHP) |

No se usan librerías ni frameworks externos.

---

## Instalación en XAMPP

### Requisitos

- **XAMPP** con PHP 8.0 o superior.
- Un navegador actualizado (Chrome, Edge o Firefox).

### Paso a paso

1. **Iniciar los servicios.** En el Panel de Control de XAMPP, presionar **Start** en **Apache** y en **MySQL**. Los dos tienen que quedar en verde.

2. **Copiar el proyecto.** Clonar el repositorio (o descomprimir el zip) dentro de `C:\xampp\htdocs\`, de modo que quede así:

   ```
   C:\xampp\htdocs\AE1Paradigmas\public\index.html
   ```

   Con Git:

   ```bash
   cd C:\xampp\htdocs
   git clone <URL-del-repositorio> AE1Paradigmas
   ```

3. **Crear la base de datos.**
   1. Abrir `http://localhost/phpmyadmin`.
   2. Sin elegir ninguna base, entrar a la pestaña **Importar**.
   3. **Seleccionar archivo** → `C:\xampp\htdocs\AE1Paradigmas\database\schema.sql` → **Importar**.
   4. A la izquierda debe aparecer la base **`benitez_stock`** con 6 tablas: `categorias`, `movimientos`, `productos`, `stock`, `sucursales` y `usuarios`.

   El script crea la base, las tablas y los datos de ejemplo: 9 productos, su stock en las dos sucursales y un historial de 131 movimientos coherente con ese stock. Se puede importar más de una vez sin duplicar datos.

4. **Revisar la conexión.** Abrir `config/conexion.php`. Por defecto usa el usuario `root` **sin contraseña**, que es la configuración de fábrica de XAMPP. Si tu MySQL tiene contraseña, escribila en `DB_PASS`.

5. **Abrir el sistema** en `http://localhost/AE1Paradigmas/`.

   > No abras los archivos `.html` con doble clic: `fetch()` y las sesiones de PHP solo funcionan a través de `http://localhost`.

6. **Crear el primer usuario.** En la pantalla de inicio: **Registrar nuevo usuario** → nombre, correo y una contraseña de al menos 8 caracteres. Las cuentas nuevas se crean con rol **empleado**.

7. **Crear el administrador.** En phpMyAdmin, pestaña **SQL**, ejecutar con el correo del usuario:

   ```sql
   USE benitez_stock;
   UPDATE usuarios SET rol = 'administrador' WHERE email = 'tu@correo.com';
   ```

   Recargá la página: el rol se lee de la base en cada pedido, así que el cambio rige de inmediato. A partir de ahí, ese administrador puede cambiar el rol de los demás desde la sección **Usuarios**.

### Si ya tenías la base de la AE2

La base de la AE2 solo tenía la tabla `usuarios`, sin la columna `activo`. En phpMyAdmin, entrar a `benitez_stock` → **Importar**, y ejecutar en este orden:

1. `database/actualizar_desde_ae2.sql` (una sola vez).
2. `database/schema.sql`.

Los usuarios que ya estaban registrados se conservan.

### Recargar el historial de ejemplo (opcional)

`database/historial_ejemplo.sql` vuelve a dejar los 9 productos de ejemplo con su historial y su stock originales. **Borra los movimientos que se hayan registrado sobre esos 9 productos**; los productos creados por el usuario no se tocan.

---

## Uso

| Sección | Qué permite |
|---|---|
| **Inicio** | Resumen de unidades por sucursal, productos con bajo stock y control de vencimientos (30 a 365 días) |
| **Stock de productos** | Buscar, ver la cantidad y la ubicación en cada sucursal y la ficha técnica. Botón **Movimientos** para ir al historial del producto. El administrador registra, edita y da de baja productos |
| **Movimientos** | Registrar entradas, salidas y transferencias, con el stock actual del producto a la vista. Historial filtrable por tipo, sucursal, producto y fechas |
| **Usuarios** | Solo administrador: crear usuarios, cambiar el rol, deshabilitar y volver a habilitar |
| **Mi perfil** | Datos de la cuenta |

Todo el sistema se puede operar **solo con el teclado** (Tab y Enter). El primer Tab muestra el enlace **«Saltar al contenido principal»**.

---

## API REST

Todas las respuestas son JSON (`Content-Type: application/json; charset=utf-8`) con el mismo formato:

```json
{ "estado": "exito", "mensaje": "Producto registrado.", "data": { } }
{ "estado": "error", "mensaje": "Stock insuficiente: en esa sucursal hay 3 unidad(es) y se pidieron 5.", "disponible": 3 }
```

Los pedidos con cuerpo (POST y PUT) deben enviarse como `application/json`, salvo la subida de imágenes (`multipart/form-data`).

| Método | URL | Quién | Caso de Uso | Códigos |
|---|---|---|---|---|
| POST | `api/login.php` | Público | Iniciar sesión | 200 · 400 · 401 · 403 · 500 |
| POST | `api/logout.php` | Cualquiera | Cerrar sesión | 200 |
| POST | `api/registro.php` | Público | Registro (como empleado) | 201 · 400 · 409 · 500 |
| GET | `api/perfil.php` | Con sesión | Datos del usuario | 200 · 401 |
| GET | `api/productos.php` `?buscar=&categoria_id=` | Empleado / Admin | CU04 Consultar stock · Consultar producto | 200 · 400 · 401 · 500 |
| GET | `api/productos.php?id=N` | Empleado / Admin | Consultar producto | 200 · 400 · 401 · 404 · 500 |
| POST | `api/productos.php` | Admin | CU01 Registrar producto | 201 · 400 · 401 · 403 · 409 · 500 |
| PUT | `api/productos.php?id=N` | Admin | Modificar producto · CU06 | 200 · 400 · 401 · 403 · 404 · 409 · 500 |
| DELETE | `api/productos.php?id=N` | Admin | Eliminar producto (baja lógica) | 200 · 401 · 403 · 404 · 500 |
| POST | `api/imagenes.php` | Admin | Imagen del producto (CU01) | 201 · 400 · 401 · 403 · 500 |
| PUT | `api/stock.php` | Admin | Ubicación del producto por sucursal | 200 · 400 · 401 · 403 · 404 · 500 |
| POST | `api/movimientos.php` | Empleado / Admin | CU02 Entrada · CU03 Salida · Transferir stock | 201 · 400 · 401 · 404 · 409 · 500 |
| GET | `api/movimientos.php` `?producto_id=&sucursal_id=&tipo=&desde=&hasta=&limite=` | Empleado / Admin | Consultar movimientos | 200 · 400 · 401 · 500 |
| GET | `api/alertas.php?dias=30` | Empleado / Admin | CU05 Vencimientos · Bajo stock | 200 · 400 · 401 · 500 |
| GET | `api/sucursales.php` | Empleado / Admin | Listas de los formularios | 200 · 401 · 500 |
| GET | `api/categorias.php` | Empleado / Admin | Listas de los formularios | 200 · 401 · 500 |
| GET · POST · PUT | `api/usuarios.php` | Admin | Gestionar usuarios | 200 · 201 · 400 · 401 · 403 · 404 · 409 · 500 |

**Significado de los códigos:**

| Código | Cuándo |
|---|---|
| 200 / 201 | Operación exitosa / recurso creado |
| 400 | Datos inválidos o faltantes |
| 401 | Sin sesión iniciada (o el usuario fue deshabilitado) |
| 403 | Con sesión, pero la acción es solo para administradores |
| 404 | El producto o el usuario no existe |
| 405 | Método HTTP no permitido (se informa en la cabecera `Allow`) |
| 409 | Stock insuficiente, código repetido, o el producto fue modificado por otro usuario |
| 415 | El cuerpo no se envió como `application/json` |
| 500 | Error interno: mensaje genérico, sin detalles del servidor (el detalle va al log de Apache) |

El encabezado de cada archivo de `api/` documenta los parámetros de entrada y salida de su endpoint.

---

## Seguridad (OWASP Top 10)

| Riesgo | Cómo se mitiga | Dónde |
|---|---|---|
| **A01 Control de acceso** | La sesión y el rol se validan **en el servidor** en cada pedido: 401 sin sesión, 403 sin permiso. El rol se lee de la base, nunca del cliente | `config/auth.php` |
| **A02 Criptografía** | Contraseñas con `password_hash(…, PASSWORD_BCRYPT)` y `password_verify()`, en `VARCHAR(255)` | `models/UsuarioModel.php`, `api/login.php` |
| **A03 Inyección SQL** | Todas las consultas usan **PDO Prepared Statements con marcadores nombrados**. No hay concatenación de datos del usuario. Emulación de prepares desactivada | `models/*.php`, `config/conexion.php` |
| **A03 XSS** | El DOM se completa solo con `.textContent` (no hay `innerHTML`). El servidor además rechaza `<` y `>` en los textos | `public/js/ui.js`, `models/ProductoModel.php` |
| **A04 Diseño inseguro** | Las salidas descuentan con un `UPDATE` atómico condicionado dentro de una transacción: dos ventas simultáneas nunca dejan el stock negativo. Las ediciones usan control de versión optimista (409 ante un conflicto) | `models/MovimientoModel.php`, `models/ProductoModel.php` |
| **A05 Configuración** | `display_errors` desactivado, errores genéricos al cliente y detalle solo en el log. `config/`, `models/` y `database/` bloqueados con `.htaccess`. En `uploads/` no se ejecuta código | `config/helpers.php`, `.htaccess` |
| **A07 Autenticación y sesiones** | `session_regenerate_id(true)` tras el login, modo estricto de sesión, cookie `HttpOnly` y `SameSite=Lax`. Mensaje de error genérico y tiempo de respuesta constante en el login | `api/login.php`, `config/helpers.php` |
| **Subida de archivos** | Se verifica el tipo real de la imagen (no la extensión), un máximo de 2 MB, y se guarda con un nombre aleatorio generado por el servidor | `api/imagenes.php` |

---

## Accesibilidad (WCAG 2.1)

- **HTML semántico**: `header`, `nav`, `main`, `footer`, formularios con `<label>`, tablas con `<caption>` y `<th scope>`. No se usan tablas para maquetar.
- **Navegación completa por teclado** con Tab y Enter. Todos los controles son `<button>` o `<a>` nativos. El tipo de movimiento se elige con botones `aria-pressed` y no con botones de radio, que exigirían las flechas.
- **Foco visible** con `:focus-visible` en todos los elementos interactivos, y un enlace para saltar al contenido.
- **Gestión del foco**: al cambiar de vista, el foco va al título `<h1>` y el título del documento se actualiza. Al abrir un formulario o confirmar una baja, el foco va al lugar correspondiente.
- **Regiones `aria-live="polite"`** en todos los contenedores que reciben respuestas de `fetch()`: mensajes, resultados de búsqueda, alertas e historial.
- **Contraste AA** (4,5:1 como mínimo) en todos los colores de texto. La información nunca depende solo del color: «Agotado» y «Bajo stock» son etiquetas con texto.
- **Responsive**: se puede usar desde un celular (375 px) sin scroll horizontal de la página.

Para auditar: Chrome → F12 → **Lighthouse** → *Accessibility* → **Analyze page load**, con la sesión iniciada en cada sección.

---

## Trazabilidad con los Casos de Uso de la AE1

| Caso de Uso | Tablas | Endpoint | Vista |
|---|---|---|---|
| Iniciar sesión | `usuarios` | `login.php`, `logout.php`, `perfil.php` | Login |
| CU01 Registrar producto | `productos`, `categorias`, `stock` | `POST productos.php`, `imagenes.php` | Stock |
| Modificar producto | `productos`, `stock` | `PUT productos.php`, `PUT stock.php` | Stock |
| Eliminar producto | `productos` | `DELETE productos.php` | Stock |
| Consultar producto | `productos`, `categorias` | `GET productos.php` | Stock |
| CU02 Registrar entrada | `movimientos`, `stock` | `POST movimientos.php` (`entrada`) | Movimientos |
| CU03 Registrar salida | `movimientos`, `stock` | `POST movimientos.php` (`salida`) | Movimientos |
| CU04 Consultar stock (y el de otra sucursal) | `stock`, `sucursales` | `GET productos.php` | Stock |
| Transferir stock | `movimientos`, `stock` | `POST movimientos.php` (`transferencia`) | Movimientos |
| Consultar movimientos | `movimientos` | `GET movimientos.php` | Movimientos |
| Actualizar stock (actor Sistema) | `stock` | Automático en cada movimiento | — |
| CU05 Controlar vencimientos | `productos` | `GET alertas.php` | Inicio |
| Controlar bajo stock | `stock`, `productos` | `GET alertas.php` | Inicio, Stock |
| CU06 Validar concurrencia | `productos.version`, `stock` | `PUT productos.php`, `POST movimientos.php` (409) | Stock, Movimientos |
| Gestionar usuarios | `usuarios` | `usuarios.php` | Usuarios |

---
