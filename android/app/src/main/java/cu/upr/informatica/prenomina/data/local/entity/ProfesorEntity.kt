package cu.upr.informatica.prenomina.data.local.entity

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * Profesor del Departamento de Informática.
 *
 * `id` es la clave local (Room) y `serverId` la clave del servidor Node/SQLite.
 * Las filas creadas sin conexión tienen `serverId = null` hasta que se sincronizan.
 */
@Entity(
    tableName = "profesores",
    indices = [
        Index(value = ["serverId"], unique = true),
        Index(value = ["noTrabajador"], unique = true),
        Index(value = ["ci"], unique = true),
        Index(value = ["nombre"]),
        Index(value = ["activo"]),
        Index(value = ["categoriaDocente"]),
    ],
)
data class ProfesorEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val serverId: Long? = null,
    val noTrabajador: String,
    val nombre: String,
    val ci: String,
    val anio: String = "",
    val area: String = "Facultad de Ciencias Técnicas",
    val areaCiencia: String = "Ingeniería en Informática",
    val categoriaPoc: String = "Profesor",
    val categoriaDocente: String = "Instructor",
    val cargaHoraria: Double = 8.0,
    val correo: String = "",
    val telefono: String = "",
    val activo: Boolean = true,
    val creadoEn: Long = System.currentTimeMillis(),
    val actualizadoEn: Long = System.currentTimeMillis(),
)
