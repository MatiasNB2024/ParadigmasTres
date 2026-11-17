<?php
declare(strict_types=1);

require_once __DIR__ . '/Excepciones.php';

/**
 * Modelo de la ubicación del stock (tabla stock).
 * La CANTIDAD no se toca acá: solo cambia con un movimiento (MovimientoModel).
 * Este modelo permite al administrador indicar DÓNDE se guarda cada producto
 * en cada sucursal (dato que se muestra al consultar stock, CU04).
 */
class StockModel
{
    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    /** @throws DatoInvalidoException|NoEncontradoException */
    public function actualizarUbicacion(int $productoId, int $sucursalId, string $ubicacion): array
    {
        $ubicacion = trim($ubicacion);
        if (!largo_valido($ubicacion, 100) || preg_match('/[<>\x00-\x1F\x7F]/u', $ubicacion) === 1) {
            throw new DatoInvalidoException('La ubicación admite hasta 100 caracteres, sin < ni >.');
        }

        $existe = $this->pdo->prepare(
            'SELECT 1
             FROM stock AS s
             JOIN productos AS p ON p.id = s.producto_id AND p.activo = 1
             WHERE s.producto_id = :producto_id AND s.sucursal_id = :sucursal_id'
        );
        $existe->execute([':producto_id' => $productoId, ':sucursal_id' => $sucursalId]);
        if (!$existe->fetchColumn()) {
            throw new NoEncontradoException('No existe ese producto en esa sucursal.');
        }

        $consulta = $this->pdo->prepare(
            'UPDATE stock SET ubicacion = :ubicacion WHERE producto_id = :producto_id AND sucursal_id = :sucursal_id'
        );
        $consulta->execute([
            ':ubicacion'   => $ubicacion,
            ':producto_id' => $productoId,
            ':sucursal_id' => $sucursalId,
        ]);

        return ['producto_id' => $productoId, 'sucursal_id' => $sucursalId, 'ubicacion' => $ubicacion];
    }
}
