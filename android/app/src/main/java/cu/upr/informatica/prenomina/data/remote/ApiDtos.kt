package cu.upr.informatica.prenomina.data.remote

import org.json.JSONObject

/** Respuesta de autenticación (`login` y `refresh`). */
data class SesionRemota(
    val accessToken: String,
    val refreshToken: String,
    val usuarioJson: String,
)

data class SaludRemota(
    val ok: Boolean,
    val version: String,
    val hora: String,
)

data class ProfesorRemoto(
    val id: Long,
    val noTrabajador: String,
    val nombre: String,
    val ci: String,
    val anio: String,
    val area: String,
    val areaCiencia: String,
    val categoriaPoc: String,
    val categoriaDocente: String,
    val cargaHoraria: Double,
    val correo: String,
    val telefono: String,
    val activo: Boolean,
)

data class ContratoRemoto(
    val id: Long,
    val codigo: String,
    val profesorId: Long,
    val tipo: String,
    val objeto: String,
    val periodo: String,
    val fechaInicio: String,
    val fechaFin: String,
    val horas: Double,
    val tarifaHora: Double,
    val importe: Double,
    val clausulas: String,
    val estado: String,
    val observaciones: String,
    val motivoRechazo: String,
)

data class PagoRemoto(
    val id: Long,
    val contratoId: Long,
    val periodo: String,
    val horas: Double,
    val tarifa: Double,
    val importe: Double,
    val estado: String,
    val fechaLimite: String,
    val fechaPago: String?,
    val observaciones: String,
)

data class TarifaRemota(
    val id: Long,
    val categoriaDocente: String,
    val tipo: String,
    val importe: Double,
    val vigenteDesde: String,
)

data class PeriodoRemoto(
    val id: Long,
    val nombre: String,
    val inicio: String,
    val fin: String,
    val cortes: Int,
    val estado: String,
)

internal fun parsearSesion(cuerpo: String): SesionRemota {
    val objeto = JSONObject(cuerpo)
    val access = objeto.textoDe("accessToken").ifBlank { objeto.textoDe("token") }
    if (access.isBlank()) {
        throw ApiException(401, "El servidor no devolvió un token de acceso válido.")
    }
    val refresh = objeto.textoDe("refreshToken")
    val usuario = objeto.optJSONObject("usuario")?.toString()
        ?: objeto.optJSONObject("user")?.toString()
        ?: "{}"
    return SesionRemota(accessToken = access, refreshToken = refresh, usuarioJson = usuario)
}

internal fun parsearSalud(cuerpo: String): SaludRemota {
    val objeto = if (cuerpo.trim().startsWith("{")) JSONObject(cuerpo) else JSONObject()
    return SaludRemota(
        ok = objeto.booleanoDe("ok", defecto = true),
        version = objeto.textoDe("version"),
        hora = objeto.textoDe("hora"),
    )
}

internal fun JSONObject.aProfesorRemoto(): ProfesorRemoto = ProfesorRemoto(
    id = enteroDe("id"),
    noTrabajador = textoDe("noTrabajador").ifBlank { textoDe("no_trabajador") },
    nombre = textoDe("nombre"),
    ci = textoDe("ci"),
    anio = textoDe("anio").ifBlank { textoDe("año") },
    area = textoDe("area").ifBlank { "Facultad de Ciencias Técnicas" },
    areaCiencia = textoDe("areaCiencia").ifBlank { textoDe("area_ciencia") },
    categoriaPoc = textoDe("categoriaPoc").ifBlank { textoDe("categoria_poc") }.ifBlank { "Profesor" },
    categoriaDocente = textoDe("categoriaDocente").ifBlank { textoDe("categoria_docente") }.ifBlank { "Instructor" },
    cargaHoraria = decimalDe("cargaHoraria", decimalDe("carga_horaria", 8.0)),
    correo = textoDe("correo"),
    telefono = textoDe("telefono"),
    activo = booleanoDe("activo", defecto = true),
)

internal fun JSONObject.aContratoRemoto(): ContratoRemoto {
    val profesor = optJSONObject("profesor")
    val profesorId = enteroDe("profesorId").let { if (it > 0) it else profesor?.enteroDe("id") ?: 0L }
    return ContratoRemoto(
        id = enteroDe("id"),
        codigo = textoDe("codigo"),
        profesorId = profesorId,
        tipo = textoDe("tipo").ifBlank { "determinado" },
        objeto = textoDe("objeto"),
        periodo = textoDe("periodo"),
        fechaInicio = textoDe("fechaInicio").ifBlank { textoDe("fecha_inicio") },
        fechaFin = textoDe("fechaFin").ifBlank { textoDe("fecha_fin") },
        horas = decimalDe("horas"),
        tarifaHora = decimalDe("tarifaHora", decimalDe("tarifa_hora", decimalDe("tarifa", 0.0))),
        importe = decimalDe("importe"),
        clausulas = clausulasDe(this),
        estado = textoDe("estado").ifBlank { "borrador" },
        observaciones = textoDe("observaciones"),
        motivoRechazo = textoDe("motivoRechazo").ifBlank { textoDe("motivo_rechazo") },
    )
}

internal fun JSONObject.aPagoRemoto(): PagoRemoto {
    val contrato = optJSONObject("contrato")
    val contratoId = enteroDe("contratoId").let { if (it > 0) it else contrato?.enteroDe("id") ?: 0L }
    val fechaPago = textoDe("fechaPago").ifBlank { textoDe("fecha_pago") }
    return PagoRemoto(
        id = enteroDe("id"),
        contratoId = contratoId,
        periodo = textoDe("periodo"),
        horas = decimalDe("horas"),
        tarifa = decimalDe("tarifa", decimalDe("tarifaHora", 0.0)),
        importe = decimalDe("importe"),
        estado = textoDe("estado").ifBlank { "pendiente" },
        fechaLimite = textoDe("fechaLimite").ifBlank { textoDe("fecha_limite") },
        fechaPago = fechaPago.ifBlank { null },
        observaciones = textoDe("observaciones"),
    )
}

internal fun JSONObject.aTarifaRemota(): TarifaRemota = TarifaRemota(
    id = enteroDe("id"),
    categoriaDocente = textoDe("categoriaDocente").ifBlank { textoDe("categoria_docente") },
    tipo = textoDe("tipo"),
    importe = decimalDe("importe"),
    vigenteDesde = textoDe("vigenteDesde").ifBlank { textoDe("vigente_desde") },
)

internal fun JSONObject.aPeriodoRemoto(): PeriodoRemoto = PeriodoRemoto(
    id = enteroDe("id"),
    nombre = textoDe("nombre"),
    inicio = textoDe("inicio"),
    fin = textoDe("fin"),
    cortes = enteroDe("cortes", 14L).toInt().coerceIn(1, 26),
    estado = textoDe("estado").ifBlank { "abierto" },
)
