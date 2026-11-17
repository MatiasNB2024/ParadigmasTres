<?php
declare(strict_types=1);

/**
 * Listas de referencia que usan los formularios: sucursales y categorías.
 * Casos de Uso: CU01 (categoría del producto), CU02/CU03/CU04 y "Transferir
 * stock" (elegir la sucursal).
 */
class CatalogoModel
{
    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    public function sucursales(): array
    {
        $consulta = $this->pdo->query('SELECT id, nombre FROM sucursales ORDER BY id');
        return array_map(
            static fn (array $f): array => ['id' => (int) $f['id'], 'nombre' => $f['nombre']],
            $consulta->fetchAll()
        );
    }

    public function categorias(): array
    {
        $consulta = $this->pdo->query('SELECT id, nombre FROM categorias ORDER BY nombre');
        return array_map(
            static fn (array $f): array => ['id' => (int) $f['id'], 'nombre' => $f['nombre']],
            $consulta->fetchAll()
        );
    }
}
