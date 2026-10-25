package cu.upr.informatica.prenomina.data.prefs

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.emptyPreferences
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import org.json.JSONObject
import java.io.IOException

const val BASE_URL_PREDETERMINADA = "http://10.0.2.2:3000"

private val Context.dataStore by preferencesDataStore(name = "prenomina_sesion")

/** Estado de sesión persistido en DataStore. */
data class SesionLocal(
    val baseUrl: String = BASE_URL_PREDETERMINADA,
    val accessToken: String = "",
    val refreshToken: String = "",
    val usuarioJson: String = "",
    val modoLocal: Boolean = false,
) {
    val autenticado: Boolean get() = modoLocal || accessToken.isNotBlank()

    val nombreUsuario: String
        get() = runCatching { JSONObject(usuarioJson).optString("nombre", "") }.getOrDefault("")

    val correoUsuario: String
        get() = runCatching { JSONObject(usuarioJson).optString("email", "") }.getOrDefault("")

    val rol: String
        get() = runCatching { JSONObject(usuarioJson).optString("rol", "") }.getOrDefault("")

    val esAdmin: Boolean get() = rol.equals("admin", ignoreCase = true)
}

class SessionStore(private val context: Context) {

    private object Claves {
        val BASE_URL = stringPreferencesKey("baseUrl")
        val ACCESS_TOKEN = stringPreferencesKey("accessToken")
        val REFRESH_TOKEN = stringPreferencesKey("refreshToken")
        val USUARIO_JSON = stringPreferencesKey("usuarioJson")
        val MODO_LOCAL = booleanPreferencesKey("modoLocal")
    }

    val sesion: Flow<SesionLocal> = context.dataStore.data
        .catch { error ->
            if (error is IOException) emit(emptyPreferences()) else throw error
        }
        .map { prefs ->
            SesionLocal(
                baseUrl = prefs[Claves.BASE_URL].orEmpty().ifBlank { BASE_URL_PREDETERMINADA },
                accessToken = prefs[Claves.ACCESS_TOKEN].orEmpty(),
                refreshToken = prefs[Claves.REFRESH_TOKEN].orEmpty(),
                usuarioJson = prefs[Claves.USUARIO_JSON].orEmpty(),
                modoLocal = prefs[Claves.MODO_LOCAL] ?: false,
            )
        }

    suspend fun actual(): SesionLocal = sesion.first()

    suspend fun guardarBaseUrl(baseUrl: String) {
        context.dataStore.edit { prefs ->
            prefs[Claves.BASE_URL] = normalizar(baseUrl)
        }
    }

    suspend fun asignarSesion(
        accessToken: String,
        refreshToken: String,
        usuarioJson: String,
        modoLocal: Boolean,
    ) {
        context.dataStore.edit { prefs ->
            prefs[Claves.ACCESS_TOKEN] = accessToken
            prefs[Claves.REFRESH_TOKEN] = refreshToken
            prefs[Claves.USUARIO_JSON] = usuarioJson
            prefs[Claves.MODO_LOCAL] = modoLocal
        }
    }

    suspend fun actualizarTokens(accessToken: String, refreshToken: String) {
        context.dataStore.edit { prefs ->
            prefs[Claves.ACCESS_TOKEN] = accessToken
            prefs[Claves.REFRESH_TOKEN] = refreshToken
        }
    }

    suspend fun limpiarSesion() {
        context.dataStore.edit { prefs ->
            prefs[Claves.ACCESS_TOKEN] = ""
            prefs[Claves.REFRESH_TOKEN] = ""
            prefs[Claves.USUARIO_JSON] = ""
            prefs[Claves.MODO_LOCAL] = false
        }
    }

    suspend fun limpiarTokens() {
        context.dataStore.edit { prefs ->
            prefs[Claves.ACCESS_TOKEN] = ""
            prefs[Claves.REFRESH_TOKEN] = ""
        }
    }

    /** Elimina todos los valores, incluida la dirección del servidor. */
    suspend fun borrarTodo() {
        context.dataStore.edit { it.clear() }
    }

    companion object {
        fun normalizar(url: String): String {
            val limpia = url.trim().trimEnd('/')
            return if (limpia.isBlank()) BASE_URL_PREDETERMINADA else limpia
        }
    }
}
