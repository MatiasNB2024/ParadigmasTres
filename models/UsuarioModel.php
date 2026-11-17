<?php
declare(strict_types=1);

require_once __DIR__ . '/Excepciones.php';

/**
 * Modelo de usuarios (tabla usuarios).
 * Casos de Uso: "Iniciar sesión" y "Gestionar usuarios".
 *
 * Solo acceso a datos con PDO Prepared Statements y marcadores nombrados:
 * ninguna consulta se arma concatenando datos del usuario.
 */
class UsuarioModel
{
    private const COLUMNAS_PUBLICAS = 'id, nombre, email, rol, activo, creado_en';

    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    /** Usuario con su hash de contraseña (solo para el login). */
    public function buscarPorEmailConPassword(string $email): ?array
    {
        $consulta = $this->pdo->prepare(
            'SELECT id, nombre, email, password, rol, activo FROM usuarios WHERE email = :email LIMIT 1'
        );
        $consulta->execute([':email' => $email]);
        $fila = $consulta->fetch();
        return $fila ? $fila : null;
    }

    /** Datos públicos de un usuario (nunca incluye el hash). */
    public function buscarPorId(int $id): ?array
    {
        $consulta = $this->pdo->prepare(
            'SELECT ' . self::COLUMNAS_PUBLICAS . ' FROM usuarios WHERE id = :id LIMIT 1'
        );
        $consulta->execute([':id' => $id]);
        $fila = $consulta->fetch();
        return $fila ? $this->formatear($fila) : null;
    }

    /** @return array<int, array> todos los usuarios, para "Gestionar usuarios" */
    public function listar(): array
    {
        $consulta = $this->pdo->query('SELECT ' . self::COLUMNAS_PUBLICAS . ' FROM usuarios ORDER BY nombre');
        return array_map([$this, 'formatear'], $consulta->fetchAll());
    }

    /**
     * Crea un usuario y devuelve su id. La contraseña llega en texto plano y se
     * guarda SOLO su hash BCRYPT.
     * @throws ConflictoException si el correo ya está registrado
     */
    public function crear(string $nombre, string $email, string $password, string $rol = 'empleado'): int
    {
        $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => COSTO_BCRYPT]);

        try {
            $consulta = $this->pdo->prepare(
                'INSERT INTO usuarios (nombre, email, password, rol) VALUES (:nombre, :email, :password, :rol)'
            );
            $consulta->execute([
                ':nombre'   => $nombre,
                ':email'    => $email,
                ':password' => $hash,
                ':rol'      => $rol,
            ]);
        } catch (PDOException $e) {
            // Violación del UNIQUE de email: el correo ya existe.
            if (es_clave_duplicada($e)) {
                throw new ConflictoException('El correo electrónico ya está registrado.');
            }
            throw $e;
        }

        return (int) $this->pdo->lastInsertId();
    }

    /**
     * Cambia el rol y/o el estado (activo/deshabilitado) de un usuario.
     * @throws NoEncontradoException
     */
    public function actualizarRolYEstado(int $id, ?string $rol, ?bool $activo): array
    {
        $actual = $this->buscarPorId($id);
        if ($actual === null) {
            throw new NoEncontradoException('El usuario no existe.');
        }

        $consulta = $this->pdo->prepare(
            'UPDATE usuarios SET rol = :rol, activo = :activo WHERE id = :id'
        );
        $consulta->execute([
            ':rol'    => $rol ?? $actual['rol'],
            ':activo' => (int) ($activo ?? $actual['activo']),
            ':id'     => $id,
        ]);

        return $this->buscarPorId($id);
    }

    /** Cantidad de administradores activos (para no dejar el sistema sin ninguno). */
    public function contarAdministradoresActivos(): int
    {
        $consulta = $this->pdo->query(
            "SELECT COUNT(*) FROM usuarios WHERE rol = 'administrador' AND activo = 1"
        );
        return (int) $consulta->fetchColumn();
    }

    private function formatear(array $fila): array
    {
        return [
            'id'        => (int) $fila['id'],
            'nombre'    => $fila['nombre'],
            'email'     => $fila['email'],
            'rol'       => $fila['rol'],
            'activo'    => (bool) $fila['activo'],
            'creado_en' => $fila['creado_en'],
        ];
    }
}
