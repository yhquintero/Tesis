package cu.upr.informatica.prenomina.data.local.dao

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Update
import cu.upr.informatica.prenomina.data.local.entity.ProfesorEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface ProfesorDao {

    @Query("SELECT * FROM profesores ORDER BY activo DESC, nombre COLLATE NOCASE ASC")
    fun observarTodos(): Flow<List<ProfesorEntity>>

    @Query("SELECT * FROM profesores WHERE id = :id")
    fun observarPorId(id: Long): Flow<ProfesorEntity?>

    @Query("SELECT * FROM profesores WHERE id = :id")
    suspend fun porId(id: Long): ProfesorEntity?

    @Query("SELECT * FROM profesores WHERE serverId = :serverId LIMIT 1")
    suspend fun porServerId(serverId: Long): ProfesorEntity?

    @Query("SELECT * FROM profesores WHERE ci = :ci LIMIT 1")
    suspend fun porCi(ci: String): ProfesorEntity?

    @Query("SELECT * FROM profesores WHERE id IN (:ids)")
    suspend fun porIds(ids: List<Long>): List<ProfesorEntity>

    @Insert
    suspend fun insertar(profesor: ProfesorEntity): Long

    @Update
    suspend fun actualizar(profesor: ProfesorEntity)

    @Delete
    suspend fun borrar(profesor: ProfesorEntity)

    @Query("DELETE FROM profesores")
    suspend fun borrarTodos()

    @Query("SELECT COUNT(*) FROM profesores")
    suspend fun contar(): Int

    @Query("UPDATE profesores SET serverId = :serverId WHERE id = :id")
    suspend fun fijarServerId(id: Long, serverId: Long)
}
