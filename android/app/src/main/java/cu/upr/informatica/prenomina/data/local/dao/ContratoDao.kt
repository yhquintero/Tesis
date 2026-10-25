package cu.upr.informatica.prenomina.data.local.dao

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Update
import cu.upr.informatica.prenomina.data.local.entity.ContratoEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface ContratoDao {

    @Query("SELECT * FROM contratos ORDER BY creadoEn DESC")
    fun observarTodos(): Flow<List<ContratoEntity>>

    @Query("SELECT * FROM contratos WHERE id = :id")
    fun observarPorId(id: Long): Flow<ContratoEntity?>

    @Query("SELECT * FROM contratos WHERE id = :id")
    suspend fun porId(id: Long): ContratoEntity?

    @Query("SELECT * FROM contratos WHERE profesorId = :profesorId ORDER BY creadoEn DESC")
    fun observarPorProfesor(profesorId: Long): Flow<List<ContratoEntity>>

    @Query("SELECT * FROM contratos WHERE serverId = :serverId LIMIT 1")
    suspend fun porServerId(serverId: Long): ContratoEntity?

    @Query("SELECT * FROM contratos WHERE codigo = :codigo LIMIT 1")
    suspend fun porCodigo(codigo: String): ContratoEntity?

    @Query("SELECT COUNT(*) FROM contratos WHERE profesorId = :profesorId")
    suspend fun contarPorProfesor(profesorId: Long): Int

    @Query("SELECT COUNT(*) FROM contratos")
    suspend fun contar(): Int

    @Insert
    suspend fun insertar(contrato: ContratoEntity): Long

    @Update
    suspend fun actualizar(contrato: ContratoEntity)

    @Delete
    suspend fun borrar(contrato: ContratoEntity)

    @Query("DELETE FROM contratos")
    suspend fun borrarTodos()

    @Query("UPDATE contratos SET serverId = :serverId WHERE id = :id")
    suspend fun fijarServerId(id: Long, serverId: Long)
}
