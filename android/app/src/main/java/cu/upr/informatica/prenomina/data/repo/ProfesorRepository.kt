package cu.upr.informatica.prenomina.data.repo

import android.database.sqlite.SQLiteConstraintException
import android.util.Patterns
import androidx.room.withTransaction
import cu.upr.informatica.prenomina.data.local.AppDatabase
import cu.upr.informatica.prenomina.data.local.entity.ProfesorEntity
import cu.upr.informatica.prenomina.data.model.ResultadoOperacion
import cu.upr.informatica.prenomina.domain.ReglasNegocio
import cu.upr.informatica.prenomina.domain.Validacion
import cu.upr.informatica.prenomina.sync.ColaSync
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext

class ProfesorRepository(
    private val db: AppDatabase,
    private val cola: ColaSync,
) {

    private val dao = db.profesorDao()

    fun observarTodos(): Flow<List<ProfesorEntity>> = dao.observarTodos()

    fun observarPorId(id: Long): Flow<ProfesorEntity?> = dao.observarPorId(id)

    suspend fun obtener(id: Long): ProfesorEntity? = dao.porId(id)

    suspend fun contar(): Int = dao.contar()

    suspend fun guardar(profesor: ProfesorEntity): ResultadoOperacion = withContext(Dispatchers.IO) {
        val validacion = validar(profesor)
        if (!validacion.valido) return@withContext ResultadoOperacion(false, validacion.mensaje)
        val ahora = System.currentTimeMillis()
        try {
            db.withTransaction {
                if (profesor.id == 0L) {
                    val nuevo = profesor.copy(creadoEn = ahora, actualizadoEn = ahora)
                    val id = dao.insertar(nuevo)
                    cola.alta("profesor", id, "/api/profesores", cuerpoProfesor(nuevo))
                } else {
                    val actualizado = profesor.copy(actualizadoEn = ahora)
                    dao.actualizar(actualizado)
                    cola.actualizar(
                        "profesor",
                        actualizado.id,
                        actualizado.serverId,
                        "/api/profesores",
                        cuerpoProfesor(actualizado),
                    )
                }
            }
            ResultadoOperacion(true, "Profesor guardado correctamente.")
        } catch (_: SQLiteConstraintException) {
            ResultadoOperacion(false, "Ya existe un profesor con ese número de trabajador o CI.")
        } catch (error: Exception) {
            ResultadoOperacion(false, error.message ?: "No se pudo guardar el profesor.")
        }
    }

    suspend fun eliminar(profesor: ProfesorEntity): ResultadoOperacion = withContext(Dispatchers.IO) {
        try {
            if (db.contratoDao().contarPorProfesor(profesor.id) > 0) {
                return@withContext ResultadoOperacion(
                    false,
                    "No se puede eliminar a ${profesor.nombre}: tiene contratos asociados.",
                )
            }
            db.withTransaction {
                dao.borrar(profesor)
                cola.borrar("profesor", profesor.id, profesor.serverId, "/api/profesores")
            }
            ResultadoOperacion(true, "Profesor eliminado.")
        } catch (_: SQLiteConstraintException) {
            ResultadoOperacion(false, "No se puede eliminar: el profesor tiene datos asociados.")
        } catch (error: Exception) {
            ResultadoOperacion(false, error.message ?: "No se pudo eliminar el profesor.")
        }
    }

    private fun validar(profesor: ProfesorEntity): Validacion {
        val errores = mutableListOf<String>()
        if (profesor.nombre.isBlank()) errores += "El nombre es obligatorio."
        if (profesor.noTrabajador.isBlank()) errores += "El número de trabajador es obligatorio."
        if (profesor.ci.isBlank()) errores += "El carné de identidad es obligatorio."
        if (profesor.cargaHoraria < 0.0 || profesor.cargaHoraria > ReglasNegocio.CARGA_HORARIA_MAXIMA) {
            errores += "La carga horaria debe estar entre 0 y ${ReglasNegocio.CARGA_HORARIA_MAXIMA.toInt()} horas."
        }
        if (profesor.correo.isNotBlank() && !Patterns.EMAIL_ADDRESS.matcher(profesor.correo).matches()) {
            errores += "El correo no tiene un formato válido."
        }
        if (profesor.categoriaDocente.isBlank()) errores += "Debe seleccionar una categoría docente."
        return Validacion(errores.isEmpty(), errores)
    }
}
