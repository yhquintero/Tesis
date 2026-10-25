package cu.upr.informatica.prenomina.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import cu.upr.informatica.prenomina.data.local.dao.ContratoDao
import cu.upr.informatica.prenomina.data.local.dao.PagoDao
import cu.upr.informatica.prenomina.data.local.dao.PendienteSyncDao
import cu.upr.informatica.prenomina.data.local.dao.PeriodoDao
import cu.upr.informatica.prenomina.data.local.dao.ProfesorDao
import cu.upr.informatica.prenomina.data.local.dao.TarifaDao
import cu.upr.informatica.prenomina.data.local.entity.ContratoEntity
import cu.upr.informatica.prenomina.data.local.entity.PagoEntity
import cu.upr.informatica.prenomina.data.local.entity.PendienteSyncEntity
import cu.upr.informatica.prenomina.data.local.entity.PeriodoEntity
import cu.upr.informatica.prenomina.data.local.entity.ProfesorEntity
import cu.upr.informatica.prenomina.data.local.entity.TarifaEntity

@Database(
    entities = [
        ProfesorEntity::class,
        ContratoEntity::class,
        PagoEntity::class,
        TarifaEntity::class,
        PeriodoEntity::class,
        PendienteSyncEntity::class,
    ],
    version = 1,
    exportSchema = false,
)
abstract class AppDatabase : RoomDatabase() {

    abstract fun profesorDao(): ProfesorDao
    abstract fun contratoDao(): ContratoDao
    abstract fun pagoDao(): PagoDao
    abstract fun tarifaDao(): TarifaDao
    abstract fun periodoDao(): PeriodoDao
    abstract fun pendienteSyncDao(): PendienteSyncDao

    companion object {
        private const val NOMBRE = "prenomina_upr.db"

        @Volatile
        private var instancia: AppDatabase? = null

        fun obtener(context: Context): AppDatabase =
            instancia ?: synchronized(this) {
                instancia ?: Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    NOMBRE,
                ).build().also { instancia = it }
            }
    }
}
