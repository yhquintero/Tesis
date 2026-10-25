package cu.upr.informatica.prenomina.domain

import java.time.LocalDate
import java.time.Period
import java.time.format.DateTimeParseException
import kotlin.math.round

/** Cálculos de importes, fechas límite y vencimientos. */
object CalculadoraImporte {

    fun redondear2(valor: Double): Double = round(valor * 100.0) / 100.0

    /** Importe de un pago o contrato: horas × tarifa, redondeado a centésimas. */
    fun calcular(horas: Double, tarifaHora: Double): Double = redondear2(horas * tarifaHora)

    /** Fecha límite de pago: fecha de fin del contrato + 30 días. */
    fun fechaLimitePago(fechaFin: String): String? = try {
        LocalDate.parse(fechaFin).plusDays(ReglasNegocio.DIAS_LIMITE_PAGO).toString()
    } catch (_: DateTimeParseException) {
        null
    }

    /** Un pago está vencido cuando la fecha actual supera la fecha límite. */
    fun estaVencido(fechaLimite: String, hoy: LocalDate = LocalDate.now()): Boolean = try {
        hoy.isAfter(LocalDate.parse(fechaLimite))
    } catch (_: DateTimeParseException) {
        false
    }

    /** Duración en meses completos entre dos fechas ISO (0 si son inválidas). */
    fun mesesEntre(inicio: String, fin: String): Long = try {
        val p = Period.between(LocalDate.parse(inicio), LocalDate.parse(fin))
        p.toTotalMonths()
    } catch (_: DateTimeParseException) {
        0L
    }

    fun fechaValida(fecha: String): Boolean = try {
        LocalDate.parse(fecha)
        true
    } catch (_: DateTimeParseException) {
        false
    }
}

/** Resultado de una validación con mensajes legibles en español. */
data class Validacion(val valido: Boolean, val errores: List<String>) {
    val mensaje: String get() = errores.joinToString(separator = "\n")
}

/** Reglas locales de validación de contratos (se replican en el servidor). */
object ValidadorContrato {

    fun validar(
        profesorId: Long,
        objeto: String,
        fechaInicio: String,
        fechaFin: String,
        horas: Double,
        tarifaHora: Double,
    ): Validacion {
        val errores = mutableListOf<String>()
        if (profesorId <= 0) errores += "Debe seleccionar un profesor."
        if (objeto.isBlank()) errores += "El objeto del contrato es obligatorio."
        if (!CalculadoraImporte.fechaValida(fechaInicio)) {
            errores += "La fecha de inicio no es válida (use AAAA-MM-DD)."
        }
        if (!CalculadoraImporte.fechaValida(fechaFin)) {
            errores += "La fecha de fin no es válida (use AAAA-MM-DD)."
        }
        if (CalculadoraImporte.fechaValida(fechaInicio) && CalculadoraImporte.fechaValida(fechaFin)) {
            val inicio = LocalDate.parse(fechaInicio)
            val fin = LocalDate.parse(fechaFin)
            if (fin.isBefore(inicio)) {
                errores += "La fecha de fin no puede ser anterior a la fecha de inicio."
            } else if (fin.isAfter(inicio.plusMonths(ReglasNegocio.MAX_MESES_CONTRATO))) {
                errores += "La duración del contrato no puede exceder los 12 meses."
            }
        }
        if (horas <= 0.0) {
            errores += "Las horas del contrato deben ser mayores que cero."
        } else if (horas > ReglasNegocio.HORAS_CONTRATO_MAXIMAS) {
            errores += "Las horas del contrato no pueden exceder ${ReglasNegocio.HORAS_CONTRATO_MAXIMAS.toInt()}."
        }
        if (tarifaHora <= 0.0) errores += "La tarifa por hora debe ser mayor que cero."
        return Validacion(errores.isEmpty(), errores)
    }

    fun transicionPermitida(actual: String, nuevo: String): Boolean =
        EstadosContrato.siguientes(actual).contains(nuevo)

    /** Estados a los que puede pasar un contrato; el rechazo solo aplica desde pendiente. */
    fun estadosDisponibles(actual: String): List<String> = EstadosContrato.siguientes(actual)
}

/** Reglas locales de validación de pagos. */
object ValidadorPago {

    fun validar(
        contratoActivo: Boolean,
        periodo: String,
        horas: Double,
        tarifa: Double,
    ): Validacion {
        val errores = mutableListOf<String>()
        if (!contratoActivo) errores += "Solo los contratos activos o completados generan pagos."
        if (periodo.isBlank()) errores += "El período del pago es obligatorio."
        if (horas <= 0.0) errores += "Las horas del pago deben ser mayores que cero."
        if (tarifa <= 0.0) errores += "La tarifa del contrato no es válida."
        return Validacion(errores.isEmpty(), errores)
    }
}
