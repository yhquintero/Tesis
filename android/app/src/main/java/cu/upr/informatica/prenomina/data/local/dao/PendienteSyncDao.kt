package cu.upr.informatica.prenomina.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import cu.upr.informatica.prenomina.data.local.entity.PendienteSyncEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface PendienteSyncDao {

    @Query("SELECT * FROM pendientes_sync ORDER BY creadoEn ASC, id ASC")
    fun observarTodos(): Flow<List<PendienteSyncEntity>>

    @Query("SELECT * FROM pendientes_sync ORDER BY creadoEn ASC, id ASC")
    suspend fun listar(): List<PendienteSyncEntity>

    @Query("SELECT COUNT(*) FROM pendientes_sync")
    fun observarConteo(): Flow<Int>

    @Query("SELECT COUNT(*) FROM pendientes_sync")
    suspend fun contar(): Int

    @Insert
    suspend fun insertar(pendiente: PendienteSyncEntity): Long

    @Query("SELECT * FROM pendientes_sync WHERE entidad = :entidad AND entidadLocalId = :entidadLocalId AND operacion = 'CREAR' ORDER BY id ASC LIMIT 1")
    suspend fun buscarCreacion(entidad: String, entidadLocalId: Long): PendienteSyncEntity?

    @Query("UPDATE pendientes_sync SET body = :body WHERE id = :id")
    suspend fun actualizarBody(id: Long, body: String)

    @Query("DELETE FROM pendientes_sync WHERE id = :id")
    suspend fun eliminar(id: Long)

    @Query("DELETE FROM pendientes_sync WHERE entidad = :entidad AND entidadLocalId = :entidadLocalId")
    suspend fun eliminarPorEntidad(entidad: String, entidadLocalId: Long)

    @Query("UPDATE pendientes_sync SET intentos = intentos + 1, ultimoError = :error WHERE id = :id")
    suspend fun marcarError(id: Long, error: String)

    @Query("DELETE FROM pendientes_sync")
    suspend fun borrarTodos()
}
