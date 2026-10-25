package cu.upr.informatica.prenomina.domain

/** Constantes de negocio compartidas por la app. */
object EstadosContrato {
    const val BORRADOR = "borrador"
    const val PENDIENTE = "pendiente"
    const val APROBADO = "aprobado"
    const val ACTIVO = "activo"
    const val COMPLETADO = "completado"
    const val RECHAZADO = "rechazado"
    const val CANCELADO = "cancelado"

    val TODOS = listOf(BORRADOR, PENDIENTE, APROBADO, ACTIVO, COMPLETADO, RECHAZADO, CANCELADO)

    /** Transiciones permitidas por el flujo del contrato. */
    fun siguientes(actual: String): List<String> = when (actual) {
        BORRADOR -> listOf(PENDIENTE, CANCELADO)
        PENDIENTE -> listOf(APROBADO, RECHAZADO, CANCELADO)
        APROBADO -> listOf(ACTIVO, CANCELADO)
        ACTIVO -> listOf(COMPLETADO, CANCELADO)
        else -> emptyList()
    }

    fun etiqueta(estado: String): String = when (estado) {
        BORRADOR -> "Borrador"
        PENDIENTE -> "Pendiente"
        APROBADO -> "Aprobado"
        ACTIVO -> "Activo"
        COMPLETADO -> "Completado"
        RECHAZADO -> "Rechazado"
        CANCELADO -> "Cancelado"
        else -> estado.replaceFirstChar { it.uppercase() }
    }
}

object TiposContrato {
    const val DETERMINADO = "determinado"
    const val SOBRECARGA = "sobrecarga"

    val TODOS = listOf(DETERMINADO, SOBRECARGA)

    fun etiqueta(tipo: String): String = when (tipo) {
        DETERMINADO -> "Contrato determinado"
        SOBRECARGA -> "Pago por sobrecarga"
        else -> tipo.replaceFirstChar { it.uppercase() }
    }

    fun etiquetaCorta(tipo: String): String = when (tipo) {
        DETERMINADO -> "Determinado"
        SOBRECARGA -> "Sobrecarga"
        else -> tipo.replaceFirstChar { it.uppercase() }
    }
}

object EstadosPago {
    const val PENDIENTE = "pendiente"
    const val APROBADO = "aprobado"
    const val PAGADO = "pagado"
    const val ANULADO = "anulado"

    val TODOS = listOf(PENDIENTE, APROBADO, PAGADO, ANULADO)

    fun etiqueta(estado: String): String = when (estado) {
        PENDIENTE -> "Pendiente"
        APROBADO -> "Aprobado"
        PAGADO -> "Pagado"
        ANULADO -> "Anulado"
        else -> estado.replaceFirstChar { it.uppercase() }
    }

    fun siguientes(estado: String): List<String> = when (estado) {
        PENDIENTE -> listOf(APROBADO, ANULADO)
        APROBADO -> listOf(PAGADO, ANULADO)
        else -> emptyList()
    }
}

object CategoriasDocente {
    const val TITULAR = "Titular"
    const val AUXILIAR = "Auxiliar"
    const val ASISTENTE = "Asistente"
    const val INSTRUCTOR = "Instructor"
    const val ATD_SUPERIOR = "ATD Nivel superior"
    const val ATD_MEDIO = "ATD Nivel medio"
    const val RECIEN_GRADUADOS = "Recién graduados"

    val TODAS = listOf(TITULAR, AUXILIAR, ASISTENTE, INSTRUCTOR, ATD_SUPERIOR, ATD_MEDIO, RECIEN_GRADUADOS)
}

object CategoriasPoc {
    const val PROFESOR = "Profesor"
    const val CUADROS = "Cuadros"

    val TODAS = listOf(PROFESOR, CUADROS)
}

object ReglasNegocio {
    const val MAX_MESES_CONTRATO = 12L
    const val DIAS_LIMITE_PAGO = 30L
    const val CARGA_HORARIA_MAXIMA = 60.0
    const val HORAS_CONTRATO_MAXIMAS = 2000.0
}
