<?php
declare(strict_types=1);

/**
 * Errores de negocio que lanzan los modelos.
 * El controlador (api/) los traduce al código HTTP que corresponde, así los
 * modelos no saben nada de HTTP y los endpoints no repiten reglas de negocio.
 */

/** El recurso pedido no existe (o fue dado de baja)  ->  404 Not Found */
class NoEncontradoException extends RuntimeException
{
}

/** Un dato no cumple una regla de negocio  ->  400 Bad Request */
class DatoInvalidoException extends RuntimeException
{
}

/**
 * La operación choca con el estado actual de los datos  ->  409 Conflict
 * Ej.: stock insuficiente, código repetido, o el producto fue modificado por
 * otro usuario mientras se editaba (CU06 "Validar concurrencia").
 */
class ConflictoException extends RuntimeException
{
    /** @var array<string, mixed> datos extra para el cliente (ej.: cantidad disponible) */
    private array $detalle;

    public function __construct(string $mensaje, array $detalle = [])
    {
        parent::__construct($mensaje);
        $this->detalle = $detalle;
    }

    public function getDetalle(): array
    {
        return $this->detalle;
    }
}
