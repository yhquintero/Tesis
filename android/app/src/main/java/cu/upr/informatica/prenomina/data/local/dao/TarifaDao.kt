package cu.upr.informatica.prenomina.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import cu.upr.informatica.prenomina.data.local.entity.TarifaEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface TarifaDao {

    @Query("SELECT * FROM tarifas ORDER BY categoriaDocente ASC, tipo ASC")
    fun observarTodas(): Flow<List<TarifaEntity>>

    @Query("SELECT * FROM tarifas ORDER BY categoriaDocente ASC, tipo ASC")
    suspend fun todas(): List<TarifaEntity>

    @Query("SELECT * FROM tarifas WHERE serverId = :serverId LIMIT 1")
    suspend fun porServerId(serverId: Long): TarifaEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertarTodas(tarifas: List<TarifaEntity>)

    @Query("DELETE FROM tarifas")
    suspend fun borrarTodas()
}
