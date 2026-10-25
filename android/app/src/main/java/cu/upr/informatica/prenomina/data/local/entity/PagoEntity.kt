package cu.upr.informatica.prenomina.data.local.entity

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "pagos",
    foreignKeys = [
        ForeignKey(
            entity = ContratoEntity::class,
            parentColumns = ["id"],
            childColumns = ["contratoId"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [
        Index(value = ["serverId"], unique = true),
        Index(value = ["contratoId", "periodo"], unique = true),
        Index(value = ["estado"]),
        Index(value = ["fechaLimite"]),
    ],
)
data class PagoEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val serverId: Long? = null,
    val contratoId: Long,
    val periodo: String,
    val horas: Double,
    val tarifa: Double,
    val importe: Double,
    val estado: String = "pendiente",
    val fechaLimite: String,
    val fechaPago: String? = null,
    val observaciones: String = "",
    val creadoEn: Long = System.currentTimeMillis(),
    val actualizadoEn: Long = System.currentTimeMillis(),
)
