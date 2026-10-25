package cu.upr.informatica.prenomina.data.repo

import cu.upr.informatica.prenomina.data.local.AppDatabase
import cu.upr.informatica.prenomina.data.local.entity.PeriodoEntity
import cu.upr.informatica.prenomina.data.local.entity.TarifaEntity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext

/** Catálogos de apoyo: tarifas y períodos. */
class CatalogoRepository(private val db: AppDatabase) {

    fun observarTarifas(): Flow<List<TarifaEntity>> = db.tarifaDao().observarTodas()

    fun observarPeriodos(): Flow<List<PeriodoEntity>> = db.periodoDao().observarTodos()

    suspend fun tarifas(): List<TarifaEntity> = withContext(Dispatchers.IO) {
        db.tarifaDao().todas()
    }

    suspend fun periodos(): List<PeriodoEntity> = withContext(Dispatchers.IO) {
        db.periodoDao().todos()
    }

    suspend fun tarifaPara(categoriaDocente: String, tipo: String): Double? =
        withContext(Dispatchers.IO) {
            db.tarifaDao().todas()
                .filter { it.categoriaDocente == categoriaDocente && it.tipo == tipo }
                .maxByOrNull { it.vigenteDesde }
                ?.importe
        }
}
