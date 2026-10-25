package cu.upr.informatica.prenomina.data.remote

import cu.upr.informatica.prenomina.data.prefs.SessionStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.SocketTimeoutException
import java.net.URL
import java.net.UnknownHostException

/** Error de API con código HTTP y mensaje listo para mostrar al usuario. */
class ApiException(
    val codigo: Int,
    override val message: String,
    val campos: Map<String, String> = emptyMap(),
) : Exception(message)

/**
 * Cliente HTTP mínimo sobre [HttpURLConnection] + `org.json`.
 *
 * Renueva el token automáticamente cuando el servidor responde 401 y reintenta
 * una sola vez la petición original.
 */
class ApiClient(private val sessionStore: SessionStore) {

    private val mutexRefresco = Mutex()

    suspend fun salud(baseUrl: String): SaludRemota = withContext(Dispatchers.IO) {
        val limpia = SessionStore.normalizar(baseUrl)
        parsearSalud(ejecutar(limpia, "/api/salud", "GET", null, null))
    }

    suspend fun login(baseUrl: String, email: String, password: String): SesionRemota =
        withContext(Dispatchers.IO) {
            val limpia = SessionStore.normalizar(baseUrl)
            val cuerpo = JSONObject()
                .put("email", email.trim())
                .put("password", password)
                .put("cliente", "android")
                .toString()
            val respuesta = ejecutar(limpia, "/api/auth/login", "POST", cuerpo, null)
            parsearSesion(respuesta)
        }

    suspend fun logout() {
        withContext(Dispatchers.IO) {
            val sesion = sessionStore.actual()
            if (sesion.baseUrl.isBlank() || sesion.accessToken.isBlank()) return@withContext
            try {
                ejecutar(sesion.baseUrl, "/api/auth/logout", "POST", null, sesion.accessToken)
            } catch (_: Exception) {
                // El cierre local debe continuar aunque el servidor no responda.
            }
        }
    }

    suspend fun get(ruta: String): String = solicitar("GET", ruta, null)

    suspend fun post(ruta: String, cuerpo: String?): String = solicitar("POST", ruta, cuerpo)

    suspend fun patch(ruta: String, cuerpo: String?): String = solicitar("PATCH", ruta, cuerpo)

    suspend fun delete(ruta: String): String = solicitar("DELETE", ruta, null)

    private suspend fun solicitar(metodo: String, ruta: String, cuerpo: String?): String =
        withContext(Dispatchers.IO) {
            var renovado = false
            while (true) {
                val sesion = sessionStore.actual()
                if (sesion.baseUrl.isBlank()) {
                    throw ApiException(0, "Configure la dirección del servidor.")
                }
                if (sesion.accessToken.isBlank()) {
                    throw ApiException(401, "La sesión no está iniciada. Vuelva a entrar.")
                }
                try {
                    return@withContext ejecutar(
                        sesion.baseUrl,
                        ruta,
                        metodo,
                        cuerpo,
                        sesion.accessToken,
                    )
                } catch (error: ApiException) {
                    if (error.codigo == 401 && !renovado) {
                        renovado = true
                        if (renovarToken()) continue
                        sessionStore.limpiarTokens()
                        throw ApiException(401, "La sesión expiró. Vuelva a iniciar sesión.")
                    }
                    throw error
                }
            }
            @Suppress("UNREACHABLE_CODE")
            ""
        }

    private suspend fun renovarToken(): Boolean = mutexRefresco.withLock {
        val sesion = sessionStore.actual()
        if (sesion.refreshToken.isBlank()) return@withLock false
        try {
            val cuerpo = JSONObject().put("refreshToken", sesion.refreshToken).toString()
            val respuesta = withContext(Dispatchers.IO) {
                ejecutar(sesion.baseUrl, "/api/auth/refresh", "POST", cuerpo, null)
            }
            val nueva = parsearSesion(respuesta)
            val refresh = nueva.refreshToken.ifBlank { sesion.refreshToken }
            sessionStore.asignarSesion(
                accessToken = nueva.accessToken,
                refreshToken = refresh,
                usuarioJson = nueva.usuarioJson,
                modoLocal = false,
            )
            true
        } catch (_: Exception) {
            false
        }
    }

    private fun ejecutar(
        baseUrl: String,
        ruta: String,
        metodo: String,
        cuerpo: String?,
        token: String?,
    ): String {
        val rutaLimpia = if (ruta.startsWith("/")) ruta else "/$ruta"
        val conexion = (URL(baseUrl.trimEnd('/') + rutaLimpia).openConnection() as HttpURLConnection)
        try {
            conexion.requestMethod = metodo
            conexion.connectTimeout = 12_000
            conexion.readTimeout = 25_000
            conexion.instanceFollowRedirects = false
            conexion.setRequestProperty("Accept", "application/json")
            conexion.setRequestProperty("User-Agent", "PrenominaUPR-Android/1.0.0")
            if (!token.isNullOrBlank()) {
                conexion.setRequestProperty("Authorization", "Bearer $token")
            }
            if (cuerpo != null) {
                conexion.doOutput = true
                conexion.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                conexion.outputStream.use { salida ->
                    salida.write(cuerpo.toByteArray(Charsets.UTF_8))
                }
            }
            val codigo = conexion.responseCode
            val flujo = if (codigo in 200..299) conexion.inputStream else conexion.errorStream
            val texto = flujo?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            if (codigo !in 200..299) throw errorDesde(codigo, texto)
            return texto
        } catch (error: ApiException) {
            throw error
        } catch (_: SocketTimeoutException) {
            throw ApiException(0, "El servidor tardó demasiado en responder. Intente de nuevo.")
        } catch (_: UnknownHostException) {
            throw ApiException(0, "No se encontró el servidor. Revise la dirección configurada.")
        } catch (_: IOException) {
            throw ApiException(0, "No se pudo conectar con el servidor. Compruebe la red.")
        } finally {
            conexion.disconnect()
        }
    }

    private fun errorDesde(codigo: Int, cuerpo: String): ApiException {
        val defecto = when (codigo) {
            400 -> "Los datos enviados no son válidos."
            401 -> "Credenciales inválidas o sesión expirada."
            403 -> "No tiene permisos para realizar esta operación."
            404 -> "El recurso solicitado no existe en el servidor."
            409 -> "La operación entra en conflicto con datos existentes."
            422 -> "La operación no cumple una regla de negocio."
            423 -> "El usuario está bloqueado temporalmente."
            429 -> "Demasiados intentos. Espere unos minutos."
            else -> if (codigo == 0) "Error de conexión." else "Error del servidor ($codigo)."
        }
        return try {
            val objeto = JSONObject(cuerpo)
            val detalle = objeto.optJSONObject("error")
            if (detalle == null) {
                ApiException(codigo, defecto)
            } else {
                val mensaje = detalle.textoDe("mensaje").ifBlank { defecto }
                val campos = mutableMapOf<String, String>()
                detalle.optJSONObject("campos")?.let { mapa ->
                    val claves = mapa.keys()
                    while (claves.hasNext()) {
                        val clave = claves.next()
                        campos[clave] = mapa.textoDe(clave)
                    }
                }
                ApiException(codigo, mensaje, campos)
            }
        } catch (_: Exception) {
            ApiException(codigo, defecto)
        }
    }
}
