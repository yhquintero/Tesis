package cu.upr.informatica.prenomina.data.repo

import android.database.sqlite.SQLiteConstraintException
import androidx.room.withTransaction
import cu.upr.informatica.prenomina.data.local.AppDatabase
import cu.upr.informatica.prenomina.data.local.entity.PagoEntity
import cu.upr.informatica.prenomina.data.model.PagoDetalle
import cu.upr.informatica.prenomina.data.model.ResultadoOperacion
import cu.upr.informatica.prenomina.domain.CalculadoraImporte
import cu.upr.informatica.prenomina.domain.EstadosContrato
import cu.upr.informatica.prenomina.domain.EstadosPago
import cu.upr.informatica.prenomina.domain.ValidadorPago
import cu.upr.informatica.prenomina.sync.ColaSync
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.withContext
import java.time.LocalDate

class PagoRepository(
    private val db: AppDatabase,
    private val cola: ColaSync,
) {

    private val dao = db.pagoDao()
    private val contratoDao = db.contratoDao()
    private val profesorDao = db.profesorDao()

    fun observarDetallados(): Flow<List<PagoDetalle>> = combine(
        dao.observarTodos(),
        contratoDao.observarTodos(),
        profesorDao.observarTodos(),
    ) { pagos, contratos, profesores ->
        val contratosPorId = contratos.associateBy { it.id }
        val profesoresPorId = profesores.associateBy { it.id }
        pagos.map { pago ->
            val contrato = contratosPorId[pago.contratoId]
            PagoDetalle(pago, contrato, contrato?.let { profesoresPorId[it.profesorId] })
        }
    }

    fun observarPorContrato(contratoId: Long): Flow<List<PagoEntity>> =
        dao.observarPorContrato(contratoId)

    suspend fun obtener(id: Long): PagoEntity? = dao.porId(id)

    suspend fun crear(
        contratoId: Long,
        periodo: String,
        horas: Double,
        observaciones: String,
    ): ResultadoOperacion = withContext(Dispatchers.IO) {
        val contrato = contratoDao.porId(contratoId)
            ?: return@withContext ResultadoOperacion(false, "El contrato no existe.")
        val estadoValido = contrato.estado == EstadosContrato.ACTIVO ||
            contrato.estado == EstadosContrato.COMPLETADO
        val validacion = ValidadorPago.validar(estadoValido, periodo, horas, contrato.tarifaHora)
        if (!validacion.valido) return@withContext ResultadoOperacion(false, validacion.mensaje)
        if (dao.porContratoPeriodo(contrato.id, periodo.trim()) != null) {
            return@withContext ResultadoOperacion(
                false,
                "Ya existe un pago para el contrato ${contrato.codigo} en el período ${periodo.trim()}.",
            )
        }
        val limite = CalculadoraImporte.fechaLimitePago(contrato.fechaFin)
            ?: return@withContext ResultadoOperacion(false, "La fecha de fin del contrato no es válida.")
        val pago = PagoEntity(
            contratoId = contrato.id,
            periodo = periodo.trim(),
            horas = horas,
            tarifa = contrato.tarifaHora,
            importe = CalculadoraImporte.calcular(horas, contrato.tarifaHora),
            estado = EstadosPago.PENDIENTE,
            fechaLimite = limite,
            observaciones = observaciones.trim(),
            creadoEn = System.currentTimeMillis(),
            actualizadoEn = System.currentTimeMillis(),
        )
        try {
            db.withTransaction {
                val id = dao.insertar(pago)
                cola.alta("pago", id, "/api/pagos", cuerpoPago(pago, contrato))
            }
            ResultadoOperacion(true, "Pago registrado por ${"%.2f".format(pago.importe)} CUP.")
        } catch (_: SQLiteConstraintException) {
            ResultadoOperacion(false, "Ya existe un pago para ese contrato y período.")
        } catch (error: Exception) {
            ResultadoOperacion(false, error.message ?: "No se pudo registrar el pago.")
        }
    }

    suspend fun cambiarEstado(
        pagoId: Long,
        nuevoEstado: String,
        esAdmin: Boolean,
        forzar: Boolean = false,
    ): ResultadoOperacion = withContext(Dispatchers.IO) {
        val pago = dao.porId(pagoId)
            ?: return@withContext ResultadoOperacion(false, "El pago no existe.")
        if (pago.estado == EstadosPago.PAGADO || pago.estado == EstadosPago.ANULADO) {
            return@withContext ResultadoOperacion(
                false,
                "El pago está ${EstadosPago.etiqueta(pago.estado).lowercase()} y ya no se puede modificar.",
            )
        }
        if (!EstadosPago.siguientes(pago.estado).contains(nuevoEstado)) {
            return@withContext ResultadoOperacion(
                false,
                "No se puede pasar de ${EstadosPago.etiqueta(pago.estado)} a ${EstadosPago.etiqueta(nuevoEstado)}.",
            )
        }
        val vencido = CalculadoraImporte.estaVencido(pago.fechaLimite)
        if (nuevoEstado == EstadosPago.APROBADO && vencido && !(esAdmin && forzar)) {
            return@withContext ResultadoOperacion(
                false,
                "El pago está vencido (fecha límite ${pago.fechaLimite}). " +
                    if (esAdmin) {
                        "Confirme la aprobación forzada como administrador."
                    } else {
                        "Solo un administrador puede aprobarlo."
                    },
            )
        }
        val fechaPago = if (nuevoEstado == EstadosPago.PAGADO) {
            LocalDate.now().toString()
        } else {
            pago.fechaPago
        }
        val actualizado = pago.copy(
            estado = nuevoEstado,
            fechaPago = fechaPago,
            actualizadoEn = System.currentTimeMillis(),
        )
        try {
            db.withTransaction {
                dao.actualizar(actualizado)
                cola.accionEstado(
                    entidad = "pago",
                    entidadLocalId = pago.id,
                    serverId = pago.serverId,
                    rutaBase = "/api/pagos",
                    body = cuerpoCambioEstadoPago(nuevoEstado, fechaPago, esAdmin && forzar),
                )
            }
            ResultadoOperacion(true, "El pago pasó a ${EstadosPago.etiqueta(nuevoEstado)}.")
        } catch (error: Exception) {
            ResultadoOperacion(false, error.message ?: "No se pudo cambiar el estado del pago.")
        }
    }
}
