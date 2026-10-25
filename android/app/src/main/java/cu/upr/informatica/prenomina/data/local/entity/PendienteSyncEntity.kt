package cu.upr.informatica.prenomina.data.local.entity

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * Cola de operaciones pendientes de enviar al servidor.
 *
 * `ruta` puede contener el marcador `{id}`, que se sustituye al sincronizar por el
 * `serverId` del registro (necesario para altas creadas sin conexión).
 */
@Entity(
    tableName = "pendientes_sync",
    indices = [Index(value = ["creadoEn"]), Index(value = ["entidad", "entidadLocalId"])],
)
data class PendienteSyncEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val operacion: String,
    val entidad: String,
    val entidadLocalId: Long,
    val ruta: String,
    val metodo: String,
    val body: String? = null,
    val creadoEn: Long = System.currentTimeMillis(),
    val intentos: Int = 0,
    val ultimoError: String? = null,
)
