package cu.upr.informatica.prenomina.data.local.entity

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "contratos",
    foreignKeys = [
        ForeignKey(
            entity = ProfesorEntity::class,
            parentColumns = ["id"],
            childColumns = ["profesorId"],
            onDelete = ForeignKey.RESTRICT,
        ),
    ],
    indices = [
        Index(value = ["serverId"], unique = true),
        Index(value = ["codigo"], unique = true),
        Index(value = ["estado"]),
        Index(value = ["tipo"]),
        Index(value = ["profesorId"]),
        Index(value = ["fechaFin"]),
    ],
)
data class ContratoEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val serverId: Long? = null,
    val codigo: String,
    val profesorId: Long,
    val tipo: String = "determinado",
    val objeto: String,
    val periodo: String = "",
    val fechaInicio: String,
    val fechaFin: String,
    val horas: Double = 0.0,
    val tarifaHora: Double = 0.0,
    val importe: Double = 0.0,
    /** Arreglo JSON de textos, p. ej. `["Cláusula 1","Cláusula 2"]`. */
    val clausulas: String = "[]",
    val estado: String = "borrador",
    val observaciones: String = "",
    val motivoRechazo: String = "",
    val creadoEn: Long = System.currentTimeMillis(),
    val actualizadoEn: Long = System.currentTimeMillis(),
)
