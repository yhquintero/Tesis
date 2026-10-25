package cu.upr.informatica.prenomina.data.local.entity

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "periodos",
    indices = [
        Index(value = ["serverId"], unique = true),
        Index(value = ["nombre"], unique = true),
    ],
)
data class PeriodoEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val serverId: Long? = null,
    val nombre: String,
    val inicio: String,
    val fin: String,
    val cortes: Int = 14,
    val estado: String = "abierto",
)
