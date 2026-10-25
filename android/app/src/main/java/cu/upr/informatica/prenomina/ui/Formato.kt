package cu.upr.informatica.prenomina.ui

import androidx.compose.ui.graphics.Color
import java.text.NumberFormat
import java.time.LocalDate
import java.time.format.DateTimeParseException
import java.util.Locale

private val LOCALE_CU = Locale("es", "CU")

fun dinero(valor: Double): String {
    val formato = NumberFormat.getNumberInstance(LOCALE_CU)
    formato.minimumFractionDigits = 2
    formato.maximumFractionDigits = 2
    return "$" + formato.format(valor)
}

fun numero(valor: Double): String {
    val formato = NumberFormat.getNumberInstance(LOCALE_CU)
    formato.minimumFractionDigits = if (valor % 1.0 == 0.0) 0 else 1
    formato.maximumFractionDigits = 1
    return formato.format(valor)
}

fun fechaCorta(iso: String): String = try {
    val fecha = LocalDate.parse(iso)
    "%02d/%02d/%04d".format(fecha.dayOfMonth, fecha.monthValue, fecha.year)
} catch (_: DateTimeParseException) {
    iso
}

fun fechaLarga(iso: String): String = try {
    val fecha = LocalDate.parse(iso)
    val meses = listOf(
        "enero", "febrero", "marzo", "abril", "mayo", "junio",
        "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
    )
    "${fecha.dayOfMonth} de ${meses[fecha.monthValue - 1]} de ${fecha.year}"
} catch (_: DateTimeParseException) {
    iso
}

fun hoyIso(): String = LocalDate.now().toString()

fun rolEtiqueta(rol: String): String = when (rol) {
    "admin" -> "Administrador"
    "determinado" -> "Determinado"
    "sobrecarga" -> "Sobrecarga"
    else -> rol.replaceFirstChar { it.uppercase() }
}

fun colorEstado(estado: String): Color = when (estado) {
    "borrador" -> Color(0xFF6B6F6A)
    "pendiente" -> Color(0xFF9A6700)
    "aprobado" -> Color(0xFF1D4ED8)
    "activo" -> Color(0xFF1B5E20)
    "completado" -> Color(0xFF00695C)
    "rechazado" -> Color(0xFFB3261E)
    "cancelado" -> Color(0xFF6B6F6A)
    "pagado" -> Color(0xFF1B5E20)
    "anulado" -> Color(0xFF6B6F6A)
    else -> Color(0xFF43483F)
}

fun fondoEstado(estado: String): Color = when (estado) {
    "borrador" -> Color(0xFFEDEFEA)
    "pendiente" -> Color(0xFFFFF3D6)
    "aprobado" -> Color(0xFFE3EBFF)
    "activo" -> Color(0xFFDDEFDD)
    "completado" -> Color(0xFFD9F0EC)
    "rechazado" -> Color(0xFFFBE4E2)
    "cancelado" -> Color(0xFFE9EBE7)
    "pagado" -> Color(0xFFDDEFDD)
    "anulado" -> Color(0xFFE9EBE7)
    else -> Color(0xFFEDEFEA)
}
