package cu.upr.informatica.prenomina.data.local.entity

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/** Tarifa por categoría docente (Resolución 210/2023, parametrizable). */
@Entity(
    tableName = "tarifas",
    indices = [
        Index(value = ["serverId"], unique = true),
        Index(value = ["categoriaDocente", "tipo", "vigenteDesde"], unique = true),
        Index(value = ["categoriaDocente", "tipo"]),
    ],
)
data class TarifaEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val serverId: Long? = null,
    val categoriaDocente: String,
    val tipo: String,
    val importe: Double,
    val vigenteDesde: String,
)
