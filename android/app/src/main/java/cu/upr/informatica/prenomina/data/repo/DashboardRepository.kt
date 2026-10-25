package cu.upr.informatica.prenomina.data.repo

import cu.upr.informatica.prenomina.data.local.AppDatabase
import cu.upr.informatica.prenomina.data.local.entity.ContratoEntity
import cu.upr.informatica.prenomina.data.local.entity.PagoEntity
import cu.upr.informatica.prenomina.data.model.ContratoDetalle
import cu.upr.informatica.prenomina.data.model.DashboardDatos
import cu.upr.informatica.prenomina.data.model.PagoDetalle
import cu.upr.informatica.prenomina.data.model.ResumenCategoria
import cu.upr.informatica.prenomina.domain.CalculadoraImporte
import cu.upr.informatica.prenomina.domain.EstadosContrato
import cu.upr.informatica.prenomina.domain.EstadosPago
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine

/**
 * El dashboard se calcula localmente a partir de Room, por lo que funciona
 * sin conexión y se actualiza de inmediato tras cualquier cambio.
 */
class DashboardRepository(private val db: AppDatabase) {

    val datos: Flow<DashboardDatos> = combine(
        db.profesorDao().observarTodos(),
        db.contratoDao().observarTodos(),
        db.pagoDao().observarTodos(),
    ) { profesores, contratos, pagos ->
        val indiceProfesores = profesores.associateBy { it.id }
        val detallesContratos = contratos.map { contrato ->
            ContratoDetalle(contrato, indiceProfesores[contrato.profesorId])
        }
        val detallesPagos = pagos.map { pago ->
            val contrato = contratos.firstOrNull { it.id == pago.contratoId }
            PagoDetalle(pago, contrato, contrato?.let { indiceProfesores[it.profesorId] })
        }
        val conteoEstados = contratos.groupingBy { it.estado }.eachCount()
        val estados = EstadosContrato.TODOS.associateWith { conteoEstados[it] ?: 0 }
        val pendientes = detallesPagos.filter {
            it.pago.estado == EstadosPago.PENDIENTE || it.pago.estado == EstadosPago.APROBADO
        }
        val vencidos = pendientes.count { CalculadoraImporte.estaVencido(it.pago.fechaLimite) }
        val horasPorCategoria = contratos
            .filter { it.estado != EstadosContrato.CANCELADO && it.estado != EstadosContrato.RECHAZADO }
            .groupBy { indiceProfesores[it.profesorId]?.categoriaDocente ?: "Sin categoría" }
            .map { (categoria, lista) ->
                ResumenCategoria(
                    categoria = categoria,
                    horas = lista.sumOf(ContratoEntity::horas),
                    contratos = lista.size,
                )
            }
            .sortedByDescending { it.horas }

        DashboardDatos(
            cargando = false,
            profesoresTotales = profesores.size,
            profesoresActivos = profesores.count { it.activo },
            contratosTotales = contratos.size,
            contratosPorEstado = estados,
            importeContratos = CalculadoraImporte.redondear2(
                contratos.filter { it.estado != EstadosContrato.CANCELADO }
                    .sumOf { it.importe },
            ),
            pagosPendientes = pendientes.size,
            importePendiente = CalculadoraImporte.redondear2(
                pendientes.sumOf { it.pago.importe },
            ),
            pagosVencidos = vencidos,
            horasPorCategoria = horasPorCategoria,
            contratosRecientes = detallesContratos
                .sortedByDescending { it.contrato.creadoEn }
                .take(4),
            pagosPendientesLista = pendientes
                .sortedBy { it.pago.fechaLimite }
                .take(4),
        )
    }
}
