package cu.upr.informatica.prenomina

import android.content.Context
import cu.upr.informatica.prenomina.data.local.AppDatabase
import cu.upr.informatica.prenomina.data.prefs.SessionStore
import cu.upr.informatica.prenomina.data.remote.ApiClient
import cu.upr.informatica.prenomina.data.repo.AuthRepository
import cu.upr.informatica.prenomina.data.repo.CatalogoRepository
import cu.upr.informatica.prenomina.data.repo.ContratoRepository
import cu.upr.informatica.prenomina.data.repo.DashboardRepository
import cu.upr.informatica.prenomina.data.repo.PagoRepository
import cu.upr.informatica.prenomina.data.repo.ProfesorRepository
import cu.upr.informatica.prenomina.sync.ColaSync
import cu.upr.informatica.prenomina.sync.SyncManager

class PrenominaApp : android.app.Application() {

    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
    }
}

/** Localizador de dependencias sencillo (sin frameworks de inyección). */
class AppContainer(context: Context) {
    val appContext: Context = context.applicationContext

    val database: AppDatabase = AppDatabase.obtener(appContext)
    val sessionStore: SessionStore = SessionStore(appContext)
    val apiClient: ApiClient = ApiClient(sessionStore)
    val syncManager: SyncManager = SyncManager(appContext, database, apiClient, sessionStore)
    val colaSync: ColaSync = ColaSync(database, sessionStore)

    val authRepository: AuthRepository = AuthRepository(apiClient, sessionStore, database, syncManager)
    val profesorRepository: ProfesorRepository = ProfesorRepository(database, colaSync)
    val contratoRepository: ContratoRepository = ContratoRepository(database, colaSync)
    val pagoRepository: PagoRepository = PagoRepository(database, colaSync)
    val catalogoRepository: CatalogoRepository = CatalogoRepository(database)
    val dashboardRepository: DashboardRepository = DashboardRepository(database)
}
