package cu.upr.informatica.prenomina.data.local.dao

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Update
import cu.upr.informatica.prenomina.data.local.entity.PagoEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface PagoDao {

    @Query("SELECT * FROM pagos ORDER BY creadoEn DESC")
    fun observarTodos(): Flow<List<PagoEntity>>

    @Query("SELECT * FROM pagos WHERE contratoId = :contratoId ORDER BY creadoEn DESC")
    fun observarPorContrato(contratoId: Long): Flow<List<PagoEntity>>

    @Query("SELECT * FROM pagos WHERE id = :id")
    suspend fun porId(id: Long): PagoEntity?

    @Query("SELECT * FROM pagos WHERE serverId = :serverId LIMIT 1")
    suspend fun porServerId(serverId: Long): PagoEntity?

    @Query("SELECT * FROM pagos WHERE contratoId = :contratoId AND periodo = :periodo LIMIT 1")
    suspend fun porContratoPeriodo(contratoId: Long, periodo: String): PagoEntity?

    @Query("SELECT COUNT(*) FROM pagos WHERE contratoId = :contratoId")
    suspend fun contarPorContrato(contratoId: Long): Int

    @Insert
    suspend fun insertar(pago: PagoEntity): Long

    @Update
    suspend fun actualizar(pago: PagoEntity)

    @Delete
    suspend fun borrar(pago: PagoEntity)

    @Query("DELETE FROM pagos")
    suspend fun borrarTodos()

    @Query("UPDATE pagos SET serverId = :serverId WHERE id = :id")
    suspend fun fijarServerId(id: Long, serverId: Long)
}
