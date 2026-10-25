package cu.upr.informatica.prenomina.sync

import android.content.Context
import androidx.room.withTransaction
import cu.upr.informatica.prenomina.data.local.AppDatabase
import cu.upr.informatica.prenomina.data.local.entity.ContratoEntity
import cu.upr.informatica.prenomina.data.local.entity.PagoEntity
import cu.upr.informatica.prenomina.data.local.entity.PendienteSyncEntity
import cu.upr.informatica.prenomina.data.local.entity.PeriodoEntity
import cu.upr.informatica.prenomina.data.local.entity.ProfesorEntity
import cu.upr.informatica.prenomina.data.local.entity.TarifaEntity
import cu.upr.informatica.prenomina.data.model.ResultadoOperacion
import cu.upr.informatica.prenomina.data.model.ResultadoSync
import cu.upr.informatica.prenomina.data.remote.ApiClient
import cu.upr.informatica.prenomina.data.remote.ApiException
import cu.upr.informatica.prenomina.data.remote.aContratoRemoto
import cu.upr.informatica.prenomina.data.remote.aPagoRemoto
import cu.upr.informatica.prenomina.data.remote.aPeriodoRemoto
import cu.upr.informatica.prenomina.data.remote.aProfesorRemoto
import cu.upr.informatica.prenomina.data.remote.aTarifaRemota
import cu.upr.informatica.prenomina.data.remote.arregloDeRespuesta
import cu.upr.informatica.prenomina.data.prefs.SessionStore
import cu.upr.informatica.prenomina.domain.CalculadoraImporte
import cu.upr.informatica.prenomina.util.hayRed
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject

/**
 * Sincronización offline-first:
 * 1. envía en orden la cola `pendientes_sync`;
 * 2. refresca los catálogos del servidor hacia Room.
 *
 * Room sigue siendo la fuente de verdad para la interfaz.
 */
class SyncManager(
    private val context: Context,
    private val db: AppDatabase,
    private val api: ApiClient,
    private val sessionStore: SessionStore,
) {

    private data class Envio(
        val enviados: Int,
        val rechazados: Int,
        val error: String?,
    )

    private class Diferido : Exception()

    suspend fun probarConexion(baseUrl: String): ResultadoOperacion = withContext(Dispatchers.IO) {
        try {
            val salud = api.salud(baseUrl)
            val detalle = if (salud.version.isNotBlank()) " Versión ${salud.version}." else ""
            ResultadoOperacion(true, "Conexión establecida con el servidor.$detalle")
        } catch (error: ApiException) {
            ResultadoOperacion(false, error.message)
        } catch (error: Exception) {
            ResultadoOperacion(false, error.message ?: "No se pudo conectar con el servidor.")
        }
    }

    suspend fun sincronizar(): ResultadoSync = withContext(Dispatchers.IO) {
        val sesion = sessionStore.actual()
        if (sesion.modoLocal) {
            return@withContext ResultadoSync(
                ok = false,
                enviados = 0,
                rechazados = 0,
                pendientes = db.pendienteSyncDao().contar(),
                mensaje = "Modo local (demostración): los datos viven solo en este dispositivo.",
            )
        }
        if (sesion.accessToken.isBlank()) {
            return@withContext ResultadoSync(
                ok = false,
                enviados = 0,
                rechazados = 0,
                pendientes = db.pendienteSyncDao().contar(),
                mensaje = "Inicie sesión en el servidor para sincronizar.",
            )
        }
        if (!hayRed(context)) {
            return@withContext ResultadoSync(
                ok = false,
                enviados = 0,
                rechazados = 0,
                pendientes = db.pendienteSyncDao().contar(),
                mensaje = "Sin conexión a la red. La app seguirá funcionando con los datos locales.",
            )
        }

        val envio = enviarPendientes()
        if (envio.error != null) {
            return@withContext ResultadoSync(
                ok = false,
                enviados = envio.enviados,
                rechazados = envio.rechazados,
                pendientes = db.pendienteSyncDao().contar(),
                mensaje = envio.error,
            )
        }

        val errores = mutableListOf<String>()
        intentar("profesores", errores) { refrescarProfesores() }
        intentar("contratos", errores) { refrescarContratos() }
        intentar("pagos", errores) { refrescarPagos() }
        intentar("tarifas", errores) { refrescarTarifas() }
        intentar("períodos", errores) { refrescarPeriodos() }

        val pendientes = db.pendienteSyncDao().contar()
        val mensaje = buildString {
            append("Sincronización completada.")
            if (envio.enviados > 0) append(" ${envio.enviados} operación(es) enviada(s).")
            if (envio.rechazados > 0) append(" ${envio.rechazados} rechazada(s) por el servidor.")
            append(" $pendientes pendiente(s).")
            if (errores.isNotEmpty()) {
                append(" No se pudieron refrescar: ${errores.joinToString("; ")}.")
            }
        }
        ResultadoSync(
            ok = errores.isEmpty(),
            enviados = envio.enviados,
            rechazados = envio.rechazados,
            pendientes = pendientes,
            mensaje = mensaje,
        )
    }

    private suspend fun intentar(
        nombre: String,
        errores: MutableList<String>,
        bloque: suspend () -> Unit,
    ) {
        try {
            bloque()
        } catch (error: Exception) {
            errores += "$nombre (${error.message ?: "error desconocido"})"
        }
    }

    private suspend fun enviarPendientes(): Envio {
        val pendientes = db.pendienteSyncDao().listar()
        var enviados = 0
        var rechazados = 0
        for (pendiente in pendientes) {
            try {
                val ruta = resolverRuta(pendiente)
                val cuerpo = resolverCuerpo(pendiente)
                val respuesta = when (pendiente.metodo.uppercase()) {
                    "POST" -> api.post(ruta, cuerpo ?: "{}")
                    "PATCH" -> api.patch(ruta, cuerpo ?: "{}")
                    "DELETE" -> api.delete(ruta)
                    else -> throw ApiException(0, "Método no soportado: ${pendiente.metodo}")
                }
                conciliar(pendiente, respuesta)
                db.pendienteSyncDao().eliminar(pendiente.id)
                enviados++
            } catch (_: Diferido) {
                return Envio(
                    enviados,
                    rechazados,
                    "Hay operaciones que esperan datos relacionados. Se reintentarán en la próxima sincronización.",
                )
            } catch (error: ApiException) {
                if (error.codigo == 401 || error.codigo == 0 || error.codigo == 429 || error.codigo >= 500) {
                    db.pendienteSyncDao().marcarError(pendiente.id, error.message)
                    return Envio(enviados, rechazados, error.message)
                }
                // Error de negocio: se descarta para no bloquear la cola.
                db.pendienteSyncDao().eliminar(pendiente.id)
                rechazados++
            } catch (error: Exception) {
                db.pendienteSyncDao().marcarError(pendiente.id, error.message ?: "Error")
                return Envio(enviados, rechazados, error.message ?: "No se pudo sincronizar.")
            }
        }
        return Envio(enviados, rechazados, null)
    }

    private suspend fun resolverRuta(pendiente: PendienteSyncEntity): String {
        if (!pendiente.ruta.contains("{id}")) return pendiente.ruta
        val serverId = when (pendiente.entidad) {
            "profesor" -> db.profesorDao().porId(pendiente.entidadLocalId)?.serverId
            "contrato" -> db.contratoDao().porId(pendiente.entidadLocalId)?.serverId
            "pago" -> db.pagoDao().porId(pendiente.entidadLocalId)?.serverId
            else -> null
        } ?: throw Diferido()
        return pendiente.ruta.replace("{id}", serverId.toString())
    }

    private suspend fun resolverCuerpo(pendiente: PendienteSyncEntity): String? {
        val texto = pendiente.body ?: return null
        return try {
            val objeto = JSONObject(texto)
            if (objeto.has("profesorId")) {
                val id = objeto.optLong("profesorId")
                if (id < 0) {
                    val server = db.profesorDao().porId(-id)?.serverId ?: throw Diferido()
                    objeto.put("profesorId", server)
                }
            }
            if (objeto.has("contratoId")) {
                val id = objeto.optLong("contratoId")
                if (id < 0) {
                    val server = db.contratoDao().porId(-id)?.serverId ?: throw Diferido()
                    objeto.put("contratoId", server)
                }
            }
            objeto.toString()
        } catch (diferido: Diferido) {
            throw diferido
        } catch (_: Exception) {
            texto
        }
    }

    private suspend fun conciliar(pendiente: PendienteSyncEntity, respuesta: String) {
        if (pendiente.operacion != "CREAR") return
        val nuevoId = idDeRespuesta(respuesta) ?: return
        when (pendiente.entidad) {
            "profesor" -> {
                if (db.profesorDao().porServerId(nuevoId) == null) {
                    db.profesorDao().fijarServerId(pendiente.entidadLocalId, nuevoId)
                }
            }
            "contrato" -> {
                if (db.contratoDao().porServerId(nuevoId) == null) {
                    db.contratoDao().fijarServerId(pendiente.entidadLocalId, nuevoId)
                }
            }
            "pago" -> {
                if (db.pagoDao().porServerId(nuevoId) == null) {
                    db.pagoDao().fijarServerId(pendiente.entidadLocalId, nuevoId)
                }
            }
        }
    }

    private fun idDeRespuesta(cuerpo: String): Long? {
        if (cuerpo.isBlank()) return null
        return try {
            val objeto = JSONObject(cuerpo)
            if (objeto.has("id")) return objeto.optLong("id").takeIf { it > 0 }
            listOf("profesor", "contrato", "pago", "item", "data")
                .firstNotNullOfOrNull { clave ->
                    objeto.optJSONObject(clave)?.optLong("id")?.takeIf { it > 0 }
                }
        } catch (_: Exception) {
            null
        }
    }

    // ------------------------------------------------------------------
    // Refresco de catálogos
    // ------------------------------------------------------------------

    private suspend fun refrescarProfesores() {
        val arreglo = arregloDeRespuesta(api.get("/api/profesores?limit=500"))
        val remotos = (0 until arreglo.length()).mapNotNull { indice ->
            arreglo.optJSONObject(indice)?.aProfesorRemoto()
        }.filter { it.id > 0 }
        db.withTransaction {
            remotos.forEach { remoto ->
                val existente = db.profesorDao().porServerId(remoto.id)
                    ?: db.profesorDao().porCi(remoto.ci)
                val entidad = ProfesorEntity(
                    id = existente?.id ?: 0,
                    serverId = remoto.id,
                    noTrabajador = remoto.noTrabajador.ifBlank { "P-${remoto.id}" },
                    nombre = remoto.nombre.ifBlank { "Profesor ${remoto.id}" },
                    ci = remoto.ci.ifBlank { "S/C-${remoto.id}" },
                    anio = remoto.anio,
                    area = remoto.area,
                    areaCiencia = remoto.areaCiencia,
                    categoriaPoc = remoto.categoriaPoc,
                    categoriaDocente = remoto.categoriaDocente,
                    cargaHoraria = remoto.cargaHoraria,
                    correo = remoto.correo,
                    telefono = remoto.telefono,
                    activo = remoto.activo,
                    creadoEn = existente?.creadoEn ?: System.currentTimeMillis(),
                    actualizadoEn = System.currentTimeMillis(),
                )
                if (existente == null) {
                    db.profesorDao().insertar(entidad)
                } else {
                    db.profesorDao().actualizar(entidad)
                }
            }
        }
    }

    private suspend fun refrescarContratos() {
        val arreglo = arregloDeRespuesta(api.get("/api/contratos?limit=500"))
        val remotos = (0 until arreglo.length()).mapNotNull { indice ->
            arreglo.optJSONObject(indice)?.aContratoRemoto()
        }.filter { it.id > 0 }
        db.withTransaction {
            remotos.forEach { remoto ->
                val profesor = db.profesorDao().porServerId(remoto.profesorId) ?: return@forEach
                val existente = db.contratoDao().porServerId(remoto.id)
                    ?: db.contratoDao().porCodigo(remoto.codigo)
                val entidad = ContratoEntity(
                    id = existente?.id ?: 0,
                    serverId = remoto.id,
                    codigo = remoto.codigo.ifBlank { "CD-${remoto.id}" },
                    profesorId = profesor.id,
                    tipo = remoto.tipo,
                    objeto = remoto.objeto,
                    periodo = remoto.periodo,
                    fechaInicio = remoto.fechaInicio,
                    fechaFin = remoto.fechaFin,
                    horas = remoto.horas,
                    tarifaHora = remoto.tarifaHora,
                    importe = remoto.importe,
                    clausulas = remoto.clausulas,
                    estado = remoto.estado,
                    observaciones = remoto.observaciones,
                    motivoRechazo = remoto.motivoRechazo,
                    creadoEn = existente?.creadoEn ?: System.currentTimeMillis(),
                    actualizadoEn = System.currentTimeMillis(),
                )
                if (existente == null) {
                    db.contratoDao().insertar(entidad)
                } else {
                    db.contratoDao().actualizar(entidad)
                }
            }
        }
    }

    private suspend fun refrescarPagos() {
        val arreglo = arregloDeRespuesta(api.get("/api/pagos?limit=500"))
        val remotos = (0 until arreglo.length()).mapNotNull { indice ->
            arreglo.optJSONObject(indice)?.aPagoRemoto()
        }.filter { it.id > 0 }
        db.withTransaction {
            remotos.forEach { remoto ->
                val contrato = db.contratoDao().porServerId(remoto.contratoId) ?: return@forEach
                val existente = db.pagoDao().porServerId(remoto.id)
                    ?: db.pagoDao().porContratoPeriodo(contrato.id, remoto.periodo)
                val tarifa = if (remoto.tarifa > 0.0) remoto.tarifa else contrato.tarifaHora
                val fechaLimite = remoto.fechaLimite.ifBlank {
                    CalculadoraImporte.fechaLimitePago(contrato.fechaFin) ?: ""
                }
                val entidad = PagoEntity(
                    id = existente?.id ?: 0,
                    serverId = remoto.id,
                    contratoId = contrato.id,
                    periodo = remoto.periodo,
                    horas = remoto.horas,
                    tarifa = tarifa,
                    importe = if (remoto.importe > 0.0) remoto.importe else CalculadoraImporte.calcular(remoto.horas, tarifa),
                    estado = remoto.estado,
                    fechaLimite = fechaLimite,
                    fechaPago = remoto.fechaPago,
                    observaciones = remoto.observaciones,
                    creadoEn = existente?.creadoEn ?: System.currentTimeMillis(),
                    actualizadoEn = System.currentTimeMillis(),
                )
                if (existente == null) {
                    db.pagoDao().insertar(entidad)
                } else {
                    db.pagoDao().actualizar(entidad)
                }
            }
        }
    }

    private suspend fun refrescarTarifas() {
        val arreglo = arregloDeRespuesta(api.get("/api/tarifas"))
        val remotos = (0 until arreglo.length()).mapNotNull { indice ->
            arreglo.optJSONObject(indice)?.aTarifaRemota()
        }.filter { it.id > 0 }
        if (remotos.isEmpty()) return
        db.withTransaction {
            db.tarifaDao().borrarTodas()
            db.tarifaDao().insertarTodas(
                remotos.map { remoto ->
                    TarifaEntity(
                        serverId = remoto.id,
                        categoriaDocente = remoto.categoriaDocente,
                        tipo = remoto.tipo,
                        importe = remoto.importe,
                        vigenteDesde = remoto.vigenteDesde,
                    )
                },
            )
        }
    }

    private suspend fun refrescarPeriodos() {
        val arreglo = arregloDeRespuesta(api.get("/api/periodos"))
        val remotos = (0 until arreglo.length()).mapNotNull { indice ->
            arreglo.optJSONObject(indice)?.aPeriodoRemoto()
        }.filter { it.id > 0 }
        if (remotos.isEmpty()) return
        db.withTransaction {
            db.periodoDao().borrarTodos()
            db.periodoDao().insertarTodos(
                remotos.map { remoto ->
                    PeriodoEntity(
                        serverId = remoto.id,
                        nombre = remoto.nombre,
                        inicio = remoto.inicio,
                        fin = remoto.fin,
                        cortes = remoto.cortes,
                        estado = remoto.estado,
                    )
                },
            )
        }
    }
}
