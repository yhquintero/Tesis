package cu.upr.informatica.prenomina.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import cu.upr.informatica.prenomina.data.local.entity.PeriodoEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface PeriodoDao {

    @Query("SELECT * FROM periodos ORDER BY nombre DESC")
    fun observarTodos(): Flow<List<PeriodoEntity>>

    @Query("SELECT * FROM periodos ORDER BY nombre DESC")
    suspend fun todos(): List<PeriodoEntity>

    @Query("SELECT * FROM periodos WHERE serverId = :serverId LIMIT 1")
    suspend fun porServerId(serverId: Long): PeriodoEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertarTodos(periodos: List<PeriodoEntity>)

    @Query("DELETE FROM periodos")
    suspend fun borrarTodos()
}
