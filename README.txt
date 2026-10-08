SISTEMA DE GESTION DE STOCK - AE2
=================================

COMO EJECUTARLO
---------------
El proyecto usa fetch() para leer data/stock.json y data/detalles.json, por lo
que NO funciona abriendo los .html con doble clic (file://). Hay que servirlo
desde localhost, con cualquiera de estas opciones:

  1) VS Code + extension "Live Server": clic derecho en index.html > Open with Live Server.
  2) Python (desde esta carpeta):   python -m http.server 8000
     y abrir http://localhost:8000/
  3) XAMPP: copiar la carpeta a C:\xampp\htdocs\ e iniciar Apache.
     Abrir http://localhost/AE1Paradigmas/

Los datos que se cargan o editan se guardan en localStorage del navegador
(propio de cada origen: localhost:8000 y localhost:5500 no comparten datos).

ESTRUCTURA
----------
  index.html, iniciosesion.html      pantallas de bienvenida/login (CSS propio)
  menuinicio / stockproductos /
  productosrecibidos /
  entregarproductos / perfilusuario  secciones internas (css/estilos.css compartido)
  javascript/                        un .js por pantalla; el HTML no contiene JS
  data/stock.json                    inventario inicial y umbral critico
  data/detalles.json                 datos tecnicos por producto (Opcion 8)
  actividad-complementaria/          Parte A (sumatoria y signo)
