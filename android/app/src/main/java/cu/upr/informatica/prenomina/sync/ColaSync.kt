package cu.upr.informatica.prenomina.sync

import cu.upr.informatica.prenomina.data.local.AppDatabase
import cu.upr.informatica.prenomina.data.local.entity.PendienteSyncEntity
import cu.upr.informatica.prenomina.data.prefs.SessionStore

/**
 * Encola en `pendientes_sync` las mutaciones hechas en modo servidor.
 *
 * En modo local (demostración) no se encola nada porque no existe servidor.
 * Si el registro aún no tiene `serverId`, se reutiliza la creación pendiente
 * para no duplicar altas hechas sin conexión.
 */
class ColaSync(
    private val db: AppDatabase,
    private val sessionStore: SessionStore,
) {

    suspend fun activa(): Boolean {
        val sesion = sessionStore.actual()
        return !sesion.modoLocal && sesion.accessToken.isNotBlank()
    }

    suspend fun alta(entidad: String, entidadLocalId: Long, ruta: String, body: String) {
        if (!activa()) return
        db.pendienteSyncDao().insertar(
            PendienteSyncEntity(
                operacion = "CREAR",
                entidad = entidad,
                entidadLocalId = entidadLocalId,
                ruta = ruta,
                metodo = "POST",
                body = body,
                creadoEn = System.currentTimeMillis(),
            ),
        )
    }

    suspend fun actualizar(
        entidad: String,
        entidadLocalId: Long,
        serverId: Long?,
        rutaBase: String,
        body: String,
    ) {
        if (!activa()) return
        val dao = db.pendienteSyncDao()
        if (serverId != null) {
            dao.insertar(
                PendienteSyncEntity(
                    operacion = "ACTUALIZAR",
                    entidad = entidad,
                    entidadLocalId = entidadLocalId,
                    ruta = "$rutaBase/$serverId",
                    metodo = "PATCH",
                    body = body,
                    creadoEn = System.currentTimeMillis(),
                ),
            )
            return
        }
        val creacion = dao.buscarCreacion(entidad, entidadLocalId)
        if (creacion != null) {
            dao.actualizarBody(creacion.id, body)
        } else {
            dao.insertar(
                PendienteSyncEntity(
                    operacion = "ACTUALIZAR",
                    entidad = entidad,
                    entidadLocalId = entidadLocalId,
                    ruta = rutaBase,
                    metodo = "POST",
                    body = body,
                    creadoEn = System.currentTimeMillis(),
                ),
            )
        }
    }

    suspend fun borrar(
        entidad: String,
        entidadLocalId: Long,
        serverId: Long?,
        rutaBase: String,
    ) {
        if (!activa()) return
        val dao = db.pendienteSyncDao()
        if (serverId == null) {
            // Nunca llegó al servidor: se descarta todo lo pendiente de esa fila.
            dao.eliminarPorEntidad(entidad, entidadLocalId)
            return
        }
        dao.insertar(
            PendienteSyncEntity(
                operacion = "ELIMINAR",
                entidad = entidad,
                entidadLocalId = entidadLocalId,
                ruta = "$rutaBase/$serverId",
                metodo = "DELETE",
                creadoEn = System.currentTimeMillis(),
            ),
        )
    }

    /** Acción de cambio de estado, p. ej. `/api/contratos/{id}/estado`. */
    suspend fun accionEstado(
        entidad: String,
        entidadLocalId: Long,
        serverId: Long?,
        rutaBase: String,
        body: String,
    ) {
        if (!activa()) return
        val ruta = if (serverId != null) "$rutaBase/$serverId/estado" else "$rutaBase/{id}/estado"
        db.pendienteSyncDao().insertar(
            PendienteSyncEntity(
                operacion = "ESTADO",
                entidad = entidad,
                entidadLocalId = entidadLocalId,
                ruta = ruta,
                metodo = "POST",
                body = body,
                creadoEn = System.currentTimeMillis(),
            ),
        )
    }
}
