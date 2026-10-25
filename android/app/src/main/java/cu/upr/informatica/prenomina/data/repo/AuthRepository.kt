package cu.upr.informatica.prenomina.data.repo

import cu.upr.informatica.prenomina.data.local.AppDatabase
import cu.upr.informatica.prenomina.data.local.DemoSeeder
import cu.upr.informatica.prenomina.data.model.ResultadoOperacion
import cu.upr.informatica.prenomina.data.prefs.SessionStore
import cu.upr.informatica.prenomina.data.remote.ApiClient
import cu.upr.informatica.prenomina.data.remote.ApiException
import cu.upr.informatica.prenomina.sync.SyncManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class AuthRepository(
    private val api: ApiClient,
    private val sessionStore: SessionStore,
    private val db: AppDatabase,
    private val syncManager: SyncManager,
) {

    suspend fun iniciarSesion(
        baseUrl: String,
        email: String,
        password: String,
    ): ResultadoOperacion = withContext(Dispatchers.IO) {
        val url = SessionStore.normalizar(baseUrl)
        if (email.isBlank() || password.isBlank()) {
            return@withContext ResultadoOperacion(false, "Escriba su correo y contraseña.")
        }
        try {
            sessionStore.guardarBaseUrl(url)
            val sesion = api.login(url, email, password)
            sessionStore.asignarSesion(
                accessToken = sesion.accessToken,
                refreshToken = sesion.refreshToken,
                usuarioJson = sesion.usuarioJson,
                modoLocal = false,
            )
            val sincronizacion = syncManager.sincronizar()
            ResultadoOperacion(true, "Sesión iniciada. ${sincronizacion.mensaje}")
        } catch (error: ApiException) {
            ResultadoOperacion(false, error.message)
        } catch (error: Exception) {
            ResultadoOperacion(
                false,
                error.message ?: "No se pudo iniciar sesión. Compruebe el servidor y la red.",
            )
        }
    }

    suspend fun entrarModoLocal(): ResultadoOperacion = withContext(Dispatchers.IO) {
        try {
            val sembrado = DemoSeeder.sembrar(db)
            sessionStore.asignarSesion(
                accessToken = "",
                refreshToken = "",
                usuarioJson = DemoSeeder.USUARIO_JSON,
                modoLocal = true,
            )
            val detalle = if (sembrado) {
                "Se cargaron 8 profesores y 4 contratos de demostración."
            } else {
                "Se encontraron datos locales existentes; se reutilizan."
            }
            ResultadoOperacion(true, "Modo local activado. $detalle")
        } catch (error: Exception) {
            ResultadoOperacion(false, error.message ?: "No se pudieron crear los datos de demostración.")
        }
    }

    suspend fun cerrarSesion() = withContext(Dispatchers.IO) {
        try {
            api.logout()
        } finally {
            sessionStore.limpiarSesion()
        }
    }

    suspend fun borrarDatosLocales(): ResultadoOperacion = withContext(Dispatchers.IO) {
        try {
            db.clearAllTables()
            ResultadoOperacion(
                true,
                "Se borraron todos los datos locales. Puede volver a sincronizar o restaurar la demostración.",
            )
        } catch (error: Exception) {
            ResultadoOperacion(false, error.message ?: "No se pudieron borrar los datos locales.")
        }
    }

    suspend fun restaurarDemo(): ResultadoOperacion = withContext(Dispatchers.IO) {
        try {
            val sembrado = DemoSeeder.sembrar(db)
            if (sembrado) {
                ResultadoOperacion(true, "Datos de demostración restaurados.")
            } else {
                ResultadoOperacion(false, "Ya existen datos locales; borre los datos antes de restaurar.")
            }
        } catch (error: Exception) {
            ResultadoOperacion(false, error.message ?: "No se pudieron restaurar los datos de demostración.")
        }
    }
}
