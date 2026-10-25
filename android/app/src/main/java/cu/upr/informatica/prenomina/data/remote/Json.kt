package cu.upr.informatica.prenomina.data.remote

import org.json.JSONArray
import org.json.JSONObject

/** Utilidades de lectura tolerante de JSON del servidor. */
internal fun JSONObject.textoDe(clave: String, defecto: String = ""): String {
    val valor = opt(clave)
    return when (valor) {
        null, JSONObject.NULL -> defecto
        is String -> valor
        else -> valor.toString()
    }
}

internal fun JSONObject.enteroDe(clave: String, defecto: Long = 0L): Long {
    val valor = opt(clave)
    return when (valor) {
        is Number -> valor.toLong()
        is String -> valor.toLongOrNull() ?: defecto
        else -> defecto
    }
}

internal fun JSONObject.decimalDe(clave: String, defecto: Double = 0.0): Double {
    val valor = opt(clave)
    return when (valor) {
        is Number -> valor.toDouble()
        is String -> valor.toDoubleOrNull() ?: defecto
        else -> defecto
    }
}

internal fun JSONObject.booleanoDe(clave: String, defecto: Boolean = true): Boolean {
    val valor = opt(clave)
    return when (valor) {
        is Boolean -> valor
        is Number -> valor.toInt() != 0
        is String -> valor == "1" || valor.equals("true", ignoreCase = true)
        else -> defecto
    }
}

/** Devuelve el arreglo `items` de una respuesta paginada o el arreglo raíz. */
internal fun arregloDeRespuesta(cuerpo: String): JSONArray {
    val limpio = cuerpo.trim()
    if (limpio.isEmpty()) return JSONArray()
    if (limpio.startsWith("[")) return JSONArray(limpio)
    if (!limpio.startsWith("{")) return JSONArray()
    val objeto = JSONObject(limpio)
    return objeto.optJSONArray("items")
        ?: objeto.optJSONArray("data")
        ?: objeto.optJSONArray("resultados")
        ?: objeto.optJSONArray("profesores")
        ?: objeto.optJSONArray("contratos")
        ?: objeto.optJSONArray("pagos")
        ?: objeto.optJSONArray("tarifas")
        ?: objeto.optJSONArray("periodos")
        ?: JSONArray()
}

/** Convierte `clausulas` (arreglo o texto JSON) en un arreglo JSON serializado. */
internal fun clausulasDe(objeto: JSONObject): String {
    val valor = objeto.opt("clausulas")
    return when (valor) {
        is JSONArray -> valor.toString()
        is String -> if (valor.trim().startsWith("[")) valor.trim() else {
            val arr = JSONArray()
            if (valor.isNotBlank()) arr.put(valor)
            arr.toString()
        }
        else -> "[]"
    }
}
