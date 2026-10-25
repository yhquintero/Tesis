package cu.upr.informatica.prenomina.data.repo

import android.database.sqlite.SQLiteConstraintException
import androidx.room.withTransaction
import cu.upr.informatica.prenomina.data.local.AppDatabase
import cu.upr.informatica.prenomina.data.local.entity.ContratoEntity
import cu.upr.informatica.prenomina.data.model.ContratoDetalle
import cu.upr.informatica.prenomina.data.model.ResultadoOperacion
import cu.upr.informatica.prenomina.domain.CalculadoraImporte
import cu.upr.informatica.prenomina.domain.EstadosContrato
import cu.upr.informatica.prenomina.domain.ValidadorContrato
import cu.upr.informatica.prenomina.sync.ColaSync
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.withContext
import java.time.LocalDate

class ContratoRepository(
    private val db: AppDatabase,
    private val cola: ColaSync,
) {

    private val dao = db.contratoDao()
    private val profesorDao = db.profesorDao()

    fun observarDetallados(): Flow<List<ContratoDetalle>> = combine(
        dao.observarTodos(),
        profesorDao.observarTodos(),
    ) { contratos, profesores ->
        val indice = profesores.associateBy { it.id }
        contratos.map { ContratoDetalle(it, indice[it.profesorId]) }
    }

    fun observarDetalle(id: Long): Flow<ContratoDetalle?> = combine(
        dao.observarPorId(id),
        profesorDao.observarTodos(),
    ) { contrato, profesores ->
        contrato?.let { item ->
            ContratoDetalle(item, profesores.firstOrNull { it.id == item.profesorId })
        }
    }

    suspend fun obtener(id: Long): ContratoEntity? = dao.porId(id)

    suspend fun generarCodigo(): String = withContext(Dispatchers.IO) {
        val anio = LocalDate.now().year
        var secuencia = dao.contar() + 1
        var codigo = "CD-$anio-" + secuencia.toString().padStart(3, '0')
        while (dao.porCodigo(codigo) != null) {
            secuencia++
            codigo = "CD-$anio-" + secuencia.toString().padStart(3, '0')
        }
        codigo
    }

    suspend fun guardar(contrato: ContratoEntity): ResultadoOperacion = withContext(Dispatchers.IO) {
        val profesor = profesorDao.porId(contrato.profesorId)
            ?: return@withContext ResultadoOperacion(false, "Debe seleccionar un profesor válido.")
        val tarifa = if (contrato.tarifaHora > 0.0) {
            contrato.tarifaHora
        } else {
            db.tarifaDao().todas()
                .filter { it.categoriaDocente == profesor.categoriaDocente && it.tipo == contrato.tipo }
                .maxByOrNull { it.vigenteDesde }
                ?.importe ?: 0.0
        }
        val validacion = ValidadorContrato.validar(
            profesorId = contrato.profesorId,
            objeto = contrato.objeto,
            fechaInicio = contrato.fechaInicio,
            fechaFin = contrato.fechaFin,
            horas = contrato.horas,
            tarifaHora = tarifa,
        )
        if (!validacion.valido) {
            val mensaje = if (tarifa <= 0.0) {
                "No hay tarifa configurada para ${profesor.categoriaDocente} (${contrato.tipo}). Configure las tarifas."
            } else {
                validacion.mensaje
            }
            return@withContext ResultadoOperacion(false, mensaje)
        }
        val ahora = System.currentTimeMillis()
        val preparado = contrato.copy(
            codigo = contrato.codigo.ifBlank { generarCodigo() },
            tarifaHora = tarifa,
            importe = CalculadoraImporte.calcular(contrato.horas, tarifa),
            actualizadoEn = ahora,
        )
        try {
            db.withTransaction {
                if (preparado.id == 0L) {
                    val nuevo = preparado.copy(creadoEn = ahora)
                    val id = dao.insertar(nuevo)
                    cola.alta("contrato", id, "/api/contratos", cuerpoContrato(nuevo, profesor))
                } else {
                    dao.actualizar(preparado)
                    cola.actualizar(
                        "contrato",
                        preparado.id,
                        preparado.serverId,
                        "/api/contratos",
                        cuerpoContrato(preparado, profesor),
                    )
                }
            }
            ResultadoOperacion(true, "Contrato guardado correctamente.")
        } catch (_: SQLiteConstraintException) {
            ResultadoOperacion(false, "Ya existe un contrato con ese código.")
        } catch (error: Exception) {
            ResultadoOperacion(false, error.message ?: "No se pudo guardar el contrato.")
        }
    }

    suspend fun cambiarEstado(
        contratoId: Long,
        nuevoEstado: String,
        motivo: String = "",
    ): ResultadoOperacion = withContext(Dispatchers.IO) {
        val contrato = dao.porId(contratoId)
            ?: return@withContext ResultadoOperacion(false, "El contrato no existe.")
        if (!EstadosContrato.siguientes(contrato.estado).contains(nuevoEstado)) {
            return@withContext ResultadoOperacion(
                false,
                "No se puede pasar de ${EstadosContrato.etiqueta(contrato.estado)} a ${EstadosContrato.etiqueta(nuevoEstado)}.",
            )
        }
        val actualizado = contrato.copy(
            estado = nuevoEstado,
            motivoRechazo = if (nuevoEstado == EstadosContrato.RECHAZADO) motivo else contrato.motivoRechazo,
            actualizadoEn = System.currentTimeMillis(),
        )
        try {
            db.withTransaction {
                dao.actualizar(actualizado)
                cola.accionEstado(
                    entidad = "contrato",
                    entidadLocalId = contrato.id,
                    serverId = contrato.serverId,
                    rutaBase = "/api/contratos",
                    body = cuerpoCambioEstado(nuevoEstado, motivo.ifBlank { null }),
                )
            }
            ResultadoOperacion(true, "El contrato pasó a ${EstadosContrato.etiqueta(nuevoEstado)}.")
        } catch (error: Exception) {
            ResultadoOperacion(false, error.message ?: "No se pudo cambiar el estado.")
        }
    }

    suspend fun eliminar(contrato: ContratoEntity): ResultadoOperacion = withContext(Dispatchers.IO) {
        if (contrato.estado != EstadosContrato.BORRADOR) {
            return@withContext ResultadoOperacion(false, "Solo se pueden eliminar contratos en estado borrador.")
        }
        try {
            db.withTransaction {
                dao.borrar(contrato)
                cola.borrar("contrato", contrato.id, contrato.serverId, "/api/contratos")
            }
            ResultadoOperacion(true, "Contrato eliminado.")
        } catch (error: Exception) {
            ResultadoOperacion(false, error.message ?: "No se pudo eliminar el contrato.")
        }
    }
}
