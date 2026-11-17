<?php
declare(strict_types=1);

require_once __DIR__ . '/Excepciones.php';

/**
 * Modelo de productos (tablas productos, categorias y stock).
 * Casos de Uso:
 *   CU01 Registrar producto · Modificar producto · Eliminar producto
 *   Consultar producto · CU04 Consultar stock (y el de la otra sucursal)
 *   CU05 Controlar vencimientos · Controlar bajo stock
 *   CU06 Validar concurrencia (columna version)
 */
class ProductoModel
{
    /** Campos de texto opcionales y su largo máximo (coinciden con schema.sql). */
    private const TEXTOS_OPCIONALES = [
        'presentacion'   => 50,
        'caracteristica' => 100,
        'proveedor'      => 120,
        'lote'           => 40,
        'medidas'        => 60,
        'almacenamiento' => 120,
    ];

    private const PRECIO_MAXIMO = 9999999999.99;
    private const STOCK_MINIMO_MAXIMO = 1000000;

    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    // ------------------------------------------------------------------
    // Consultas
    // ------------------------------------------------------------------

    /**
     * CU04 / Consultar producto: busca por nombre, código o categoría.
     * Cada producto trae su stock en cada sucursal.
     */
    public function listar(string $busqueda = '', ?int $categoriaId = null): array
    {
        $sql = 'SELECT p.*, c.nombre AS categoria
                FROM productos AS p
                JOIN categorias AS c ON c.id = p.categoria_id
                WHERE p.activo = 1';
        $parametros = [];

        if ($busqueda !== '') {
            // Los comodines de LIKE (% y _) que escriba el usuario se toman como texto literal.
            $patron = '%' . addcslashes($busqueda, '%_\\') . '%';
            $sql .= ' AND (p.nombre LIKE :busqueda_nombre OR p.codigo LIKE :busqueda_codigo OR c.nombre LIKE :busqueda_categoria)';
            $parametros[':busqueda_nombre'] = $patron;
            $parametros[':busqueda_codigo'] = $patron;
            $parametros[':busqueda_categoria'] = $patron;
        }
        if ($categoriaId !== null) {
            $sql .= ' AND p.categoria_id = :categoria_id';
            $parametros[':categoria_id'] = $categoriaId;
        }
        $sql .= ' ORDER BY p.nombre, p.id';

        $consulta = $this->pdo->prepare($sql);
        $consulta->execute($parametros);
        $productos = $consulta->fetchAll();

        $stockPorProducto = $this->stockDeProductosActivos();
        return array_map(
            fn (array $p): array => $this->formatear($p, $stockPorProducto[(int) $p['id']] ?? []),
            $productos
        );
    }

    /** Un producto activo con su stock por sucursal. @throws NoEncontradoException */
    public function obtener(int $id): array
    {
        $consulta = $this->pdo->prepare(
            'SELECT p.*, c.nombre AS categoria
             FROM productos AS p
             JOIN categorias AS c ON c.id = p.categoria_id
             WHERE p.id = :id AND p.activo = 1
             LIMIT 1'
        );
        $consulta->execute([':id' => $id]);
        $producto = $consulta->fetch();
        if (!$producto) {
            throw new NoEncontradoException('El producto no existe o fue dado de baja.');
        }

        $stock = $this->pdo->prepare(
            'SELECT s.sucursal_id, su.nombre AS sucursal, s.cantidad, s.ubicacion
             FROM stock AS s
             JOIN sucursales AS su ON su.id = s.sucursal_id
             WHERE s.producto_id = :id
             ORDER BY su.id'
        );
        $stock->execute([':id' => $id]);

        return $this->formatear($producto, array_map([$this, 'formatearStock'], $stock->fetchAll()));
    }

    /** Controlar bajo stock: productos con menos unidades que su mínimo, en cada sucursal. */
    public function bajoStock(): array
    {
        $consulta = $this->pdo->query(
            'SELECT p.id, p.codigo, p.nombre, p.stock_minimo,
                    s.sucursal_id, su.nombre AS sucursal, s.cantidad, s.ubicacion
             FROM stock AS s
             JOIN productos  AS p  ON p.id  = s.producto_id
             JOIN sucursales AS su ON su.id = s.sucursal_id
             WHERE p.activo = 1 AND s.cantidad < p.stock_minimo
             ORDER BY s.cantidad, p.nombre'
        );

        return array_map(static fn (array $f): array => [
            'producto_id'  => (int) $f['id'],
            'codigo'       => $f['codigo'],
            'nombre'       => $f['nombre'],
            'sucursal_id'  => (int) $f['sucursal_id'],
            'sucursal'     => $f['sucursal'],
            'cantidad'     => (int) $f['cantidad'],
            'stock_minimo' => (int) $f['stock_minimo'],
            'ubicacion'    => $f['ubicacion'],
            'agotado'      => (int) $f['cantidad'] === 0,
        ], $consulta->fetchAll());
    }

    /**
     * CU05 Controlar vencimientos: productos vencidos y los que vencen dentro de $dias días.
     * @return array{vencidos: array, por_vencer: array}
     */
    public function vencimientos(int $dias): array
    {
        $hoy = new DateTimeImmutable('today');
        $consulta = $this->pdo->prepare(
            'SELECT p.id, p.codigo, p.nombre, p.vencimiento, p.lote,
                    (SELECT COALESCE(SUM(s.cantidad), 0) FROM stock AS s WHERE s.producto_id = p.id) AS stock_total
             FROM productos AS p
             WHERE p.activo = 1 AND p.vencimiento IS NOT NULL AND p.vencimiento <= :limite
             ORDER BY p.vencimiento, p.nombre'
        );
        $consulta->execute([':limite' => $hoy->modify("+{$dias} days")->format('Y-m-d')]);

        $resultado = ['vencidos' => [], 'por_vencer' => []];
        foreach ($consulta->fetchAll() as $f) {
            $diasRestantes = (int) $hoy->diff(new DateTimeImmutable($f['vencimiento']))->format('%r%a');
            $item = [
                'producto_id'    => (int) $f['id'],
                'codigo'         => $f['codigo'],
                'nombre'         => $f['nombre'],
                'lote'           => $f['lote'],
                'vencimiento'    => $f['vencimiento'],
                'dias_restantes' => $diasRestantes,
                'stock_total'    => (int) $f['stock_total'],
            ];
            $resultado[$diasRestantes < 0 ? 'vencidos' : 'por_vencer'][] = $item;
        }
        return $resultado;
    }

    // ------------------------------------------------------------------
    // Altas, modificaciones y bajas (solo administrador, lo controla api/)
    // ------------------------------------------------------------------

    /**
     * CU01 Registrar producto. Crea también su fila de stock (en 0) en cada
     * sucursal: las cantidades solo aumentan con una entrada de mercadería (CU02).
     * @throws DatoInvalidoException|ConflictoException
     */
    public function crear(array $entrada): array
    {
        $datos = $this->validar($entrada);
        $ubicaciones = $this->validarUbicaciones($entrada['ubicaciones'] ?? []);

        $this->pdo->beginTransaction();
        try {
            $consulta = $this->pdo->prepare(
                'INSERT INTO productos
                    (codigo, nombre, categoria_id, presentacion, caracteristica, precio, proveedor,
                     vencimiento, lote, medidas, almacenamiento, imagen, stock_minimo)
                 VALUES
                    (:codigo, :nombre, :categoria_id, :presentacion, :caracteristica, :precio, :proveedor,
                     :vencimiento, :lote, :medidas, :almacenamiento, :imagen, :stock_minimo)'
            );
            $consulta->execute($this->comoParametros($datos));
            $id = (int) $this->pdo->lastInsertId();

            $stock = $this->pdo->prepare(
                'INSERT INTO stock (producto_id, sucursal_id, cantidad, ubicacion)
                 SELECT :producto_id, su.id, 0, \'\' FROM sucursales AS su'
            );
            $stock->execute([':producto_id' => $id]);

            $ubicar = $this->pdo->prepare(
                'UPDATE stock SET ubicacion = :ubicacion WHERE producto_id = :producto_id AND sucursal_id = :sucursal_id'
            );
            foreach ($ubicaciones as $sucursalId => $ubicacion) {
                $ubicar->execute([':ubicacion' => $ubicacion, ':producto_id' => $id, ':sucursal_id' => $sucursalId]);
            }

            $this->pdo->commit();
        } catch (Throwable $e) {
            $this->pdo->rollBack();
            throw $this->traducirErrorIntegridad($e);
        }

        return $this->obtener($id);
    }

    /**
     * Modificar producto, con control de concurrencia optimista (CU06):
     * el UPDATE solo se aplica si la versión que tenía el cliente sigue siendo
     * la actual. Si otro usuario guardó antes, no se pisa nada y se informa 409.
     * @throws DatoInvalidoException|NoEncontradoException|ConflictoException
     */
    public function actualizar(int $id, array $entrada, int $versionCliente): array
    {
        $datos = $this->validar($entrada);
        $parametros = $this->comoParametros($datos) + [':id' => $id, ':version' => $versionCliente];

        try {
            $consulta = $this->pdo->prepare(
                'UPDATE productos SET
                    codigo = :codigo, nombre = :nombre, categoria_id = :categoria_id,
                    presentacion = :presentacion, caracteristica = :caracteristica, precio = :precio,
                    proveedor = :proveedor, vencimiento = :vencimiento, lote = :lote, medidas = :medidas,
                    almacenamiento = :almacenamiento, imagen = :imagen, stock_minimo = :stock_minimo,
                    version = version + 1
                 WHERE id = :id AND activo = 1 AND version = :version'
            );
            $consulta->execute($parametros);
        } catch (PDOException $e) {
            throw $this->traducirErrorIntegridad($e);
        }

        if ($consulta->rowCount() === 0) {
            // No se actualizó: o el producto no existe, o alguien lo modificó antes.
            $actual = $this->obtener($id);   // lanza NoEncontradoException si no existe
            throw new ConflictoException(
                'Otro usuario modificó este producto mientras lo editabas. Revisá los datos actuales y volvé a guardar.',
                ['data' => $actual]
            );
        }

        return $this->obtener($id);
    }

    /**
     * Eliminar producto: baja lógica (activo = 0). Se conserva el historial de
     * movimientos, que referencia al producto.
     * @throws NoEncontradoException
     */
    public function darDeBaja(int $id): void
    {
        $consulta = $this->pdo->prepare(
            'UPDATE productos SET activo = 0, version = version + 1 WHERE id = :id AND activo = 1'
        );
        $consulta->execute([':id' => $id]);
        if ($consulta->rowCount() === 0) {
            throw new NoEncontradoException('El producto no existe o ya fue dado de baja.');
        }
    }

    // ------------------------------------------------------------------
    // Validación (reglas de negocio del producto)
    // ------------------------------------------------------------------

    /** @throws DatoInvalidoException */
    private function validar(array $e): array
    {
        $codigo = strtoupper(trim(is_string($e['codigo'] ?? null) ? $e['codigo'] : ''));
        if (preg_match('/^[A-Z0-9][A-Z0-9-]{2,29}$/', $codigo) !== 1) {
            throw new DatoInvalidoException('El código debe tener entre 3 y 30 caracteres: letras, números y guiones (ej.: HAR-000-001).');
        }

        $nombre = trim(is_string($e['nombre'] ?? null) ? $e['nombre'] : '');
        if ((largo_texto($nombre) ?? 0) < 2 || !largo_valido($nombre, 120) || !$this->textoSeguro($nombre)) {
            throw new DatoInvalidoException('El nombre es obligatorio (2 a 120 caracteres, sin < ni >).');
        }

        $categoriaId = campo_entero($e, 'categoria_id');
        if ($categoriaId === null || $categoriaId < 1 || !$this->existeCategoria($categoriaId)) {
            throw new DatoInvalidoException('La categoría no es válida.');
        }

        $precio = $e['precio'] ?? null;
        if (is_string($precio) && is_numeric($precio)) {
            $precio = (float) $precio;
        }
        if ((!is_int($precio) && !is_float($precio)) || $precio < 0 || $precio > self::PRECIO_MAXIMO) {
            throw new DatoInvalidoException('El precio debe ser un número mayor o igual a 0.');
        }

        $vencimiento = $e['vencimiento'] ?? null;
        if ($vencimiento === '') {
            $vencimiento = null;
        }
        if ($vencimiento !== null && (!is_string($vencimiento) || !fecha_valida($vencimiento))) {
            throw new DatoInvalidoException('La fecha de vencimiento debe tener el formato AAAA-MM-DD.');
        }

        $imagen = $e['imagen'] ?? null;
        if ($imagen === '') {
            $imagen = null;
        }
        // Solo rutas dentro de las carpetas de imágenes del sistema (nada de "../" ni URLs externas).
        if ($imagen !== null && (!is_string($imagen)
            || preg_match('#^(imgstock|uploads)/[A-Za-z0-9._-]{1,200}\.(png|jpe?g|webp)$#', $imagen) !== 1)) {
            throw new DatoInvalidoException('La imagen no es válida.');
        }

        $stockMinimo = array_key_exists('stock_minimo', $e) ? campo_entero($e, 'stock_minimo') : 10;
        if ($stockMinimo === null || $stockMinimo < 0 || $stockMinimo > self::STOCK_MINIMO_MAXIMO) {
            throw new DatoInvalidoException('El stock mínimo debe ser un número entero mayor o igual a 0.');
        }

        $datos = [
            'codigo'       => $codigo,
            'nombre'       => $nombre,
            'categoria_id' => $categoriaId,
            'precio'       => round((float) $precio, 2),
            'vencimiento'  => $vencimiento,
            'imagen'       => $imagen,
            'stock_minimo' => $stockMinimo,
        ];

        foreach (self::TEXTOS_OPCIONALES as $campo => $maximo) {
            $valor = $e[$campo] ?? '';
            if (!is_string($valor)) {
                throw new DatoInvalidoException("El campo \"$campo\" debe ser texto.");
            }
            $valor = trim($valor);
            if (!largo_valido($valor, $maximo) || !$this->textoSeguro($valor)) {
                throw new DatoInvalidoException("El campo \"$campo\" admite hasta $maximo caracteres, sin < ni >.");
            }
            $datos[$campo] = $valor;
        }

        return $datos;
    }

    /** @return array<int, string> ubicación por id de sucursal. @throws DatoInvalidoException */
    private function validarUbicaciones($ubicaciones): array
    {
        if (!is_array($ubicaciones)) {
            throw new DatoInvalidoException('"ubicaciones" debe ser un objeto { id_sucursal: "ubicación" }.');
        }
        $resultado = [];
        foreach ($ubicaciones as $sucursalId => $ubicacion) {
            $id = filter_var($sucursalId, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
            if ($id === false || !is_string($ubicacion)) {
                throw new DatoInvalidoException('"ubicaciones" debe ser un objeto { id_sucursal: "ubicación" }.');
            }
            $ubicacion = trim($ubicacion);
            if (!largo_valido($ubicacion, 100) || !$this->textoSeguro($ubicacion)) {
                throw new DatoInvalidoException('La ubicación admite hasta 100 caracteres, sin < ni >.');
            }
            $resultado[$id] = $ubicacion;
        }
        return $resultado;
    }

    /** Sin caracteres de control ni < > (defensa XSS en el servidor, además de .textContent). */
    private function textoSeguro(string $texto): bool
    {
        return preg_match('/[<>\x00-\x1F\x7F]/u', $texto) !== 1;
    }

    private function existeCategoria(int $id): bool
    {
        $consulta = $this->pdo->prepare('SELECT 1 FROM categorias WHERE id = :id');
        $consulta->execute([':id' => $id]);
        return (bool) $consulta->fetchColumn();
    }

    // ------------------------------------------------------------------
    // Auxiliares
    // ------------------------------------------------------------------

    private function comoParametros(array $datos): array
    {
        $parametros = [];
        foreach ($datos as $campo => $valor) {
            $parametros[':' . $campo] = $valor;
        }
        return $parametros;
    }

    /** El código de producto es UNIQUE: si se repite, la base lo rechaza -> 409. */
    private function traducirErrorIntegridad(Throwable $e): Throwable
    {
        if (es_clave_duplicada($e)) {
            return new ConflictoException('Ya existe un producto con ese código.');
        }
        return $e;
    }

    /** @return array<int, array> filas de stock agrupadas por id de producto */
    private function stockDeProductosActivos(): array
    {
        $consulta = $this->pdo->query(
            'SELECT s.producto_id, s.sucursal_id, su.nombre AS sucursal, s.cantidad, s.ubicacion
             FROM stock AS s
             JOIN productos  AS p  ON p.id  = s.producto_id AND p.activo = 1
             JOIN sucursales AS su ON su.id = s.sucursal_id
             ORDER BY s.producto_id, su.id'
        );
        $agrupado = [];
        foreach ($consulta->fetchAll() as $fila) {
            $agrupado[(int) $fila['producto_id']][] = $this->formatearStock($fila);
        }
        return $agrupado;
    }

    private function formatearStock(array $fila): array
    {
        return [
            'sucursal_id' => (int) $fila['sucursal_id'],
            'sucursal'    => $fila['sucursal'],
            'cantidad'    => (int) $fila['cantidad'],
            'ubicacion'   => $fila['ubicacion'],
        ];
    }

    private function formatear(array $p, array $stock): array
    {
        return [
            'id'             => (int) $p['id'],
            'codigo'         => $p['codigo'],
            'nombre'         => $p['nombre'],
            'categoria_id'   => (int) $p['categoria_id'],
            'categoria'      => $p['categoria'],
            'presentacion'   => $p['presentacion'],
            'caracteristica' => $p['caracteristica'],
            'precio'         => (float) $p['precio'],
            'proveedor'      => $p['proveedor'],
            'vencimiento'    => $p['vencimiento'],
            'lote'           => $p['lote'],
            'medidas'        => $p['medidas'],
            'almacenamiento' => $p['almacenamiento'],
            'imagen'         => $p['imagen'],
            'stock_minimo'   => (int) $p['stock_minimo'],
            'version'        => (int) $p['version'],
            'stock'          => $stock,
            'stock_total'    => array_sum(array_column($stock, 'cantidad')),
        ];
    }
}
