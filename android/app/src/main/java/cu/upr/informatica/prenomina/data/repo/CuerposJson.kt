package cu.upr.informatica.prenomina.data.repo

import cu.upr.informatica.prenomina.data.local.entity.ContratoEntity
import cu.upr.informatica.prenomina.data.local.entity.PagoEntity
import cu.upr.informatica.prenomina.data.local.entity.ProfesorEntity
import org.json.JSONArray
import org.json.JSONObject

internal fun cuerpoProfesor(profesor: ProfesorEntity): String = JSONObject()
    .put("noTrabajador", profesor.noTrabajador)
    .put("nombre", profesor.nombre)
    .put("ci", profesor.ci)
    .put("anio", profesor.anio)
    .put("area", profesor.area)
    .put("areaCiencia", profesor.areaCiencia)
    .put("categoriaPoc", profesor.categoriaPoc)
    .put("categoriaDocente", profesor.categoriaDocente)
    .put("cargaHoraria", profesor.cargaHoraria)
    .put("correo", profesor.correo)
    .put("telefono", profesor.telefono)
    .put("activo", profesor.activo)
    .toString()

internal fun cuerpoContrato(contrato: ContratoEntity, profesor: ProfesorEntity): String {
    val clausulas = try {
        JSONArray(contrato.clausulas)
    } catch (_: Exception) {
        JSONArray()
    }
    return JSONObject()
        .put("profesorId", profesor.serverId ?: -profesor.id)
        .put("tipo", contrato.tipo)
        .put("objeto", contrato.objeto)
        .put("periodo", contrato.periodo)
        .put("fechaInicio", contrato.fechaInicio)
        .put("fechaFin", contrato.fechaFin)
        .put("horas", contrato.horas)
        .put("clausulas", clausulas)
        .put("observaciones", contrato.observaciones)
        .toString()
}

internal fun cuerpoPago(pago: PagoEntity, contrato: ContratoEntity): String = JSONObject()
    .put("contratoId", contrato.serverId ?: -contrato.id)
    .put("periodo", pago.periodo)
    .put("horas", pago.horas)
    .put("observaciones", pago.observaciones)
    .toString()

internal fun cuerpoCambioEstado(estado: String, motivo: String? = null): String {
    val objeto = JSONObject().put("estado", estado)
    if (!motivo.isNullOrBlank()) objeto.put("motivo", motivo)
    return objeto.toString()
}

internal fun cuerpoCambioEstadoPago(
    estado: String,
    fechaPago: String?,
    forzar: Boolean,
): String {
    val objeto = JSONObject().put("estado", estado)
    if (!fechaPago.isNullOrBlank()) objeto.put("fechaPago", fechaPago)
    if (forzar) objeto.put("forzar", true)
    return objeto.toString()
}
