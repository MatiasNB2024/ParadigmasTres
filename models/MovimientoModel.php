<?php
declare(strict_types=1);

require_once __DIR__ . '/Excepciones.php';

/**
 * Modelo de movimientos de stock (tablas movimientos y stock).
 * Casos de Uso:
 *   CU02 Registrar entrada de mercadería
 *   CU03 Registrar salida de mercadería
 *   Transferir stock · Consultar movimientos
 *   Actualizar stock (actor Sistema): cada movimiento ajusta la cantidad
 *   CU06 Validar concurrencia
 *
 * Cómo se garantiza la consistencia cuando las dos sucursales operan a la vez:
 *  1) Cada operación corre dentro de una TRANSACCIÓN: o se guardan el movimiento
 *     y el cambio de stock juntos, o no se guarda nada.
 *  2) Las salidas descuentan con un UPDATE atómico condicionado
 *        UPDATE stock SET cantidad = cantidad - :cantidad WHERE ... AND cantidad >= :minimo
 *     La base evalúa la condición y resta en el mismo paso, con la fila bloqueada.
 *     Si dos usuarios intentan llevarse las últimas unidades al mismo tiempo,
 *     solo el primero lo logra; al segundo le afecta 0 filas y recibe 409.
 *     Nunca se "lee, se resta en PHP y se guarda", que es lo que pisaría cambios.
 */
class MovimientoModel
{
    public const CANTIDAD_MAXIMA = 100000;

    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    /** CU02: suma la cantidad al stock de la sucursal. */
    public function registrarEntrada(int $productoId, int $sucursalId, int $cantidad, string $observacion, int $usuarioId): array
    {
        $this->validarComun($productoId, $cantidad, $observacion);
        $this->exigirSucursal($sucursalId);

        return $this->enTransaccion(function () use ($productoId, $sucursalId, $cantidad, $observacion, $usuarioId): int {
            $this->sumar($productoId, $sucursalId, $cantidad);
            return $this->insertar('entrada', $productoId, null, $sucursalId, $cantidad, $observacion, $usuarioId);
        });
    }

    /** CU03: verifica que alcance el stock y lo descuenta (venta o entrega). */
    public function registrarSalida(int $productoId, int $sucursalId, int $cantidad, string $observacion, int $usuarioId): array
    {
        $this->validarComun($productoId, $cantidad, $observacion);
        $this->exigirSucursal($sucursalId);

        return $this->enTransaccion(function () use ($productoId, $sucursalId, $cantidad, $observacion, $usuarioId): int {
            $this->restar($productoId, $sucursalId, $cantidad);
            return $this->insertar('salida', $productoId, $sucursalId, null, $cantidad, $observacion, $usuarioId);
        });
    }

    /** Transferir stock: resta en el origen y suma en el destino, en una sola transacción. */
    public function registrarTransferencia(int $productoId, int $origenId, int $destinoId, int $cantidad, string $observacion, int $usuarioId): array
    {
        $this->validarComun($productoId, $cantidad, $observacion);
        $this->exigirSucursal($origenId);
        $this->exigirSucursal($destinoId);
        if ($origenId === $destinoId) {
            throw new DatoInvalidoException('La sucursal de origen y la de destino deben ser distintas.');
        }

        return $this->enTransaccion(function () use ($productoId, $origenId, $destinoId, $cantidad, $observacion, $usuarioId): int {
            $this->restar($productoId, $origenId, $cantidad);
            $this->sumar($productoId, $destinoId, $cantidad);
            return $this->insertar('transferencia', $productoId, $origenId, $destinoId, $cantidad, $observacion, $usuarioId);
        });
    }

    /**
     * Consultar movimientos: historial filtrable, del más reciente al más antiguo.
     * @param array{producto_id?: int, sucursal_id?: int, tipo?: string, desde?: string, hasta?: string} $filtros
     */
    public function listar(array $filtros, int $limite): array
    {
        $sql = 'SELECT m.id, m.tipo, m.cantidad, m.observacion, m.fecha,
                       m.producto_id, p.codigo, p.nombre AS producto,
                       m.sucursal_origen_id, so.nombre AS sucursal_origen,
                       m.sucursal_destino_id, sd.nombre AS sucursal_destino,
                       m.usuario_id, u.nombre AS usuario
                FROM movimientos AS m
                JOIN productos       AS p  ON p.id  = m.producto_id
                LEFT JOIN sucursales AS so ON so.id = m.sucursal_origen_id
                LEFT JOIN sucursales AS sd ON sd.id = m.sucursal_destino_id
                LEFT JOIN usuarios   AS u  ON u.id  = m.usuario_id
                WHERE 1 = 1';
        $parametros = [];

        if (isset($filtros['producto_id'])) {
            $sql .= ' AND m.producto_id = :producto_id';
            $parametros[':producto_id'] = $filtros['producto_id'];
        }
        if (isset($filtros['sucursal_id'])) {
            $sql .= ' AND (m.sucursal_origen_id = :sucursal_origen OR m.sucursal_destino_id = :sucursal_destino)';
            $parametros[':sucursal_origen'] = $filtros['sucursal_id'];
            $parametros[':sucursal_destino'] = $filtros['sucursal_id'];
        }
        if (isset($filtros['tipo'])) {
            $sql .= ' AND m.tipo = :tipo';
            $parametros[':tipo'] = $filtros['tipo'];
        }
        if (isset($filtros['desde'])) {
            $sql .= ' AND m.fecha >= :desde';
            $parametros[':desde'] = $filtros['desde'] . ' 00:00:00';
        }
        if (isset($filtros['hasta'])) {
            $sql .= ' AND m.fecha <= :hasta';
            $parametros[':hasta'] = $filtros['hasta'] . ' 23:59:59';
        }
        // $limite es un entero ya validado por el controlador (1 a 500).
        $sql .= ' ORDER BY m.fecha DESC, m.id DESC LIMIT ' . (int) $limite;

        $consulta = $this->pdo->prepare($sql);
        $consulta->execute($parametros);
        return array_map([$this, 'formatear'], $consulta->fetchAll());
    }

    public function obtener(int $id): array
    {
        $consulta = $this->pdo->prepare(
            'SELECT m.id, m.tipo, m.cantidad, m.observacion, m.fecha,
                    m.producto_id, p.codigo, p.nombre AS producto,
                    m.sucursal_origen_id, so.nombre AS sucursal_origen,
                    m.sucursal_destino_id, sd.nombre AS sucursal_destino,
                    m.usuario_id, u.nombre AS usuario
             FROM movimientos AS m
             JOIN productos       AS p  ON p.id  = m.producto_id
             LEFT JOIN sucursales AS so ON so.id = m.sucursal_origen_id
             LEFT JOIN sucursales AS sd ON sd.id = m.sucursal_destino_id
             LEFT JOIN usuarios   AS u  ON u.id  = m.usuario_id
             WHERE m.id = :id'
        );
        $consulta->execute([':id' => $id]);
        return $this->formatear($consulta->fetch());
    }

    // ------------------------------------------------------------------
    // Operaciones sobre la tabla stock (CU "Actualizar stock")
    // ------------------------------------------------------------------

    private function sumar(int $productoId, int $sucursalId, int $cantidad): void
    {
        // Si el producto todavía no tenía fila en esa sucursal, se crea.
        $consulta = $this->pdo->prepare(
            'INSERT INTO stock (producto_id, sucursal_id, cantidad)
             VALUES (:producto_id, :sucursal_id, :cantidad)
             ON DUPLICATE KEY UPDATE cantidad = cantidad + :suma'
        );
        $consulta->execute([
            ':producto_id' => $productoId,
            ':sucursal_id' => $sucursalId,
            ':cantidad'    => $cantidad,
            ':suma'        => $cantidad,
        ]);
    }

    /** @throws ConflictoException si no hay stock suficiente */
    private function restar(int $productoId, int $sucursalId, int $cantidad): void
    {
        $consulta = $this->pdo->prepare(
            'UPDATE stock
             SET cantidad = cantidad - :cantidad
             WHERE producto_id = :producto_id AND sucursal_id = :sucursal_id AND cantidad >= :minimo'
        );
        $consulta->execute([
            ':cantidad'    => $cantidad,
            ':producto_id' => $productoId,
            ':sucursal_id' => $sucursalId,
            ':minimo'      => $cantidad,
        ]);

        if ($consulta->rowCount() === 0) {
            $disponible = $this->pdo->prepare(
                'SELECT cantidad FROM stock WHERE producto_id = :producto_id AND sucursal_id = :sucursal_id'
            );
            $disponible->execute([':producto_id' => $productoId, ':sucursal_id' => $sucursalId]);
            $hay = (int) $disponible->fetchColumn();
            throw new ConflictoException(
                "Stock insuficiente: en esa sucursal hay $hay unidad(es) y se pidieron $cantidad.",
                ['disponible' => $hay]
            );
        }
    }

    private function insertar(string $tipo, int $productoId, ?int $origenId, ?int $destinoId, int $cantidad, string $observacion, int $usuarioId): int
    {
        $consulta = $this->pdo->prepare(
            'INSERT INTO movimientos
                (tipo, producto_id, sucursal_origen_id, sucursal_destino_id, cantidad, observacion, usuario_id)
             VALUES
                (:tipo, :producto_id, :origen, :destino, :cantidad, :observacion, :usuario_id)'
        );
        $consulta->execute([
            ':tipo'        => $tipo,
            ':producto_id' => $productoId,
            ':origen'      => $origenId,
            ':destino'     => $destinoId,
            ':cantidad'    => $cantidad,
            ':observacion' => $observacion,
            ':usuario_id'  => $usuarioId,
        ]);
        return (int) $this->pdo->lastInsertId();
    }

    // ------------------------------------------------------------------
    // Validaciones y auxiliares
    // ------------------------------------------------------------------

    /** @throws DatoInvalidoException|NoEncontradoException */
    private function validarComun(int $productoId, int $cantidad, string $observacion): void
    {
        if ($cantidad < 1 || $cantidad > self::CANTIDAD_MAXIMA) {
            throw new DatoInvalidoException('La cantidad debe ser un número entero entre 1 y ' . self::CANTIDAD_MAXIMA . '.');
        }
        if (!largo_valido($observacion, 200) || preg_match('/[<>\x00-\x1F\x7F]/u', $observacion) === 1) {
            throw new DatoInvalidoException('La observación admite hasta 200 caracteres, sin < ni >.');
        }
        $consulta = $this->pdo->prepare('SELECT 1 FROM productos WHERE id = :id AND activo = 1');
        $consulta->execute([':id' => $productoId]);
        if (!$consulta->fetchColumn()) {
            throw new NoEncontradoException('El producto no existe o fue dado de baja.');
        }
    }

    /** @throws DatoInvalidoException */
    private function exigirSucursal(int $sucursalId): void
    {
        $consulta = $this->pdo->prepare('SELECT 1 FROM sucursales WHERE id = :id');
        $consulta->execute([':id' => $sucursalId]);
        if (!$consulta->fetchColumn()) {
            throw new DatoInvalidoException('La sucursal no es válida.');
        }
    }

    /** Ejecuta la operación en una transacción y devuelve el movimiento creado. */
    private function enTransaccion(callable $operacion): array
    {
        $this->pdo->beginTransaction();
        try {
            $id = $operacion();
            $this->pdo->commit();
        } catch (Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }
        return $this->obtener($id);
    }

    private function formatear(array $f): array
    {
        return [
            'id'                  => (int) $f['id'],
            'tipo'                => $f['tipo'],
            'fecha'               => $f['fecha'],
            'producto_id'         => (int) $f['producto_id'],
            'codigo'              => $f['codigo'],
            'producto'            => $f['producto'],
            'cantidad'            => (int) $f['cantidad'],
            'sucursal_origen_id'  => $f['sucursal_origen_id'] !== null ? (int) $f['sucursal_origen_id'] : null,
            'sucursal_origen'     => $f['sucursal_origen'],
            'sucursal_destino_id' => $f['sucursal_destino_id'] !== null ? (int) $f['sucursal_destino_id'] : null,
            'sucursal_destino'    => $f['sucursal_destino'],
            'observacion'         => $f['observacion'],
            'usuario'             => $f['usuario'] ?? 'Sistema',
        ];
    }
}
