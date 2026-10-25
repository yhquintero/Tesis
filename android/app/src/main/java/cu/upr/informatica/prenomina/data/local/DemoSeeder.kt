package cu.upr.informatica.prenomina.data.local

import androidx.room.withTransaction
import cu.upr.informatica.prenomina.data.local.entity.ContratoEntity
import cu.upr.informatica.prenomina.data.local.entity.PagoEntity
import cu.upr.informatica.prenomina.data.local.entity.PeriodoEntity
import cu.upr.informatica.prenomina.data.local.entity.ProfesorEntity
import cu.upr.informatica.prenomina.data.local.entity.TarifaEntity
import cu.upr.informatica.prenomina.domain.CategoriasDocente
import cu.upr.informatica.prenomina.domain.EstadosContrato
import cu.upr.informatica.prenomina.domain.EstadosPago
import cu.upr.informatica.prenomina.domain.TiposContrato
import java.time.LocalDate

/**
 * Datos de demostración para usar la app sin servidor.
 *
 * Los nombres son los del caso de estudio de la tesis; las CIs, correos y teléfonos
 * son sintéticos. Las tarifas son ilustrativas y parametrizables.
 */
object DemoSeeder {

    const val CORREO_ADMIN = "admin@upr.edu.cu"
    const val CLAVE_ADMIN = "Admin1234!"

    val USUARIO_JSON: String = """
        {"id":0,"email":"admin@upr.edu.cu","nombre":"Administrador (Demo)","rol":"admin",
         "estado":"aprobado","permisos":{"crear":true,"leer":true,"actualizar":true,"eliminar":true},
         "debeCambiarClave":false,"ultimoAcceso":null,"creadoEn":"2026-01-01T00:00:00.000Z"}
    """.trimIndent()

    suspend fun sembrar(db: AppDatabase): Boolean {
        if (db.profesorDao().contar() > 0) return false
        db.withTransaction {
            sembrarTarifas(db)
            sembrarPeriodos(db)
            val profesores = sembrarProfesores(db)
            sembrarContratos(db, profesores)
        }
        return true
    }

    private suspend fun sembrarTarifas(db: AppDatabase) {
        val vigencia = "2025-01-01"
        val base = listOf(
            CategoriasDocente.TITULAR to 35.00,
            CategoriasDocente.AUXILIAR to 30.00,
            CategoriasDocente.ASISTENTE to 26.00,
            CategoriasDocente.INSTRUCTOR to 22.00,
            CategoriasDocente.ATD_SUPERIOR to 24.00,
            CategoriasDocente.ATD_MEDIO to 20.00,
            CategoriasDocente.RECIEN_GRADUADOS to 18.00,
        )
        val tarifas = base.flatMap { (categoria, importe) ->
            listOf(
                TarifaEntity(
                    categoriaDocente = categoria,
                    tipo = TiposContrato.DETERMINADO,
                    importe = importe,
                    vigenteDesde = vigencia,
                ),
                TarifaEntity(
                    categoriaDocente = categoria,
                    tipo = TiposContrato.SOBRECARGA,
                    importe = importe * 1.5,
                    vigenteDesde = vigencia,
                ),
            )
        }
        db.tarifaDao().insertarTodas(tarifas)
    }

    private suspend fun sembrarPeriodos(db: AppDatabase) {
        db.periodoDao().insertarTodos(
            listOf(
                PeriodoEntity(nombre = "2026-1", inicio = "2026-01-05", fin = "2026-07-20", cortes = 14, estado = "abierto"),
                PeriodoEntity(nombre = "2026-2", inicio = "2026-08-24", fin = "2026-12-19", cortes = 14, estado = "abierto"),
                PeriodoEntity(nombre = "2025-2", inicio = "2025-08-25", fin = "2025-12-20", cortes = 14, estado = "cerrado"),
            ),
        )
    }

    private suspend fun sembrarProfesores(db: AppDatabase): Map<String, Long> {
        val datos = listOf(
            ProfesorEntity(
                noTrabajador = "P-0101", nombre = "Eliomar Rodríguez Izquierdo", ci = "78051234567",
                anio = "2008", area = "Facultad de Ciencias Técnicas", areaCiencia = "Ingeniería en Informática",
                categoriaPoc = "Profesor", categoriaDocente = CategoriasDocente.AUXILIAR, cargaHoraria = 8.0,
                correo = "eliomar.rodriguez@upr.edu.cu", telefono = "4875-0001", activo = true,
            ),
            ProfesorEntity(
                noTrabajador = "P-0102", nombre = "Ricardo Inouye Rodríguez", ci = "71023456789",
                anio = "1998", area = "Facultad de Ciencias Técnicas", areaCiencia = "Ingeniería en Informática",
                categoriaPoc = "Profesor", categoriaDocente = CategoriasDocente.TITULAR, cargaHoraria = 8.0,
                correo = "ricardo.inouye@upr.edu.cu", telefono = "4875-0002", activo = true,
            ),
            ProfesorEntity(
                noTrabajador = "P-0103", nombre = "Yanet Pérez González", ci = "82098765432",
                anio = "2010", area = "Facultad de Ciencias Técnicas", areaCiencia = "Ciencias de la Computación",
                categoriaPoc = "Profesor", categoriaDocente = CategoriasDocente.TITULAR, cargaHoraria = 12.0,
                correo = "yanet.perez@upr.edu.cu", telefono = "4875-0003", activo = true,
            ),
            ProfesorEntity(
                noTrabajador = "P-0104", nombre = "Luis Alberto Díaz Ramos", ci = "90012345678",
                anio = "2015", area = "Facultad de Ciencias Técnicas", areaCiencia = "Ingeniería en Informática",
                categoriaPoc = "Profesor", categoriaDocente = CategoriasDocente.ASISTENTE, cargaHoraria = 16.0,
                correo = "luis.diaz@upr.edu.cu", telefono = "4875-0004", activo = true,
            ),
            ProfesorEntity(
                noTrabajador = "P-0105", nombre = "Marta Elena Suárez León", ci = "85045678901",
                anio = "2007", area = "Facultad de Ciencias Técnicas", areaCiencia = "Ingeniería en Informática",
                categoriaPoc = "Cuadros", categoriaDocente = CategoriasDocente.AUXILIAR, cargaHoraria = 8.0,
                correo = "marta.suarez@upr.edu.cu", telefono = "4875-0005", activo = true,
            ),
            ProfesorEntity(
                noTrabajador = "P-0106", nombre = "Jorge Luis Hernández Cruz", ci = "88111222333",
                anio = "2012", area = "Facultad de Ciencias Técnicas", areaCiencia = "Ingeniería en Informática",
                categoriaPoc = "Profesor", categoriaDocente = CategoriasDocente.INSTRUCTOR, cargaHoraria = 16.0,
                correo = "jorge.hernandez@upr.edu.cu", telefono = "4875-0006", activo = true,
            ),
            ProfesorEntity(
                noTrabajador = "P-0107", nombre = "Dayana Rodríguez Valdés", ci = "99033445566",
                anio = "2024", area = "Facultad de Ciencias Técnicas", areaCiencia = "Ingeniería en Informática",
                categoriaPoc = "Profesor", categoriaDocente = CategoriasDocente.RECIEN_GRADUADOS, cargaHoraria = 16.0,
                correo = "dayana.rodriguez@upr.edu.cu", telefono = "4875-0007", activo = true,
            ),
            ProfesorEntity(
                noTrabajador = "P-0108", nombre = "Carlos Manuel García Peña", ci = "76077889900",
                anio = "2001", area = "Facultad de Ciencias Técnicas", areaCiencia = "Ciencias de la Computación",
                categoriaPoc = "Profesor", categoriaDocente = CategoriasDocente.ATD_MEDIO, cargaHoraria = 8.0,
                correo = "carlos.garcia@upr.edu.cu", telefono = "4875-0008", activo = false,
            ),
        )
        return datos.associate { profesor ->
            profesor.noTrabajador to db.profesorDao().insertar(profesor)
        }
    }

    private suspend fun sembrarContratos(db: AppDatabase, profesores: Map<String, Long>) {
        val clausulas = """["El profesor cumplirá el horario acordado con el jefe de departamento.","El pago se realizará dentro de los 30 días posteriores al cierre del contrato."]"""
        val hoy = LocalDate.now()
        val periodo = if (hoy.monthValue >= 7) "${hoy.year}-2" else "${hoy.year}-1"
        val contrato1 = ContratoEntity(
            codigo = "CD-${hoy.year}-001",
            profesorId = profesores.getValue("P-0101"),
            tipo = TiposContrato.DETERMINADO,
            objeto = "Impartir la asignatura Programación I en el curso actual",
            periodo = periodo,
            fechaInicio = hoy.minusMonths(2).toString(),
            fechaFin = hoy.plusMonths(2).toString(),
            horas = 240.0,
            tarifaHora = 30.0,
            importe = 7200.0,
            clausulas = clausulas,
            estado = EstadosContrato.ACTIVO,
            observaciones = "Contrato docente vigente.",
        )
        val contrato2 = ContratoEntity(
            codigo = "CS-${hoy.year}-001",
            profesorId = profesores.getValue("P-0103"),
            tipo = TiposContrato.SOBRECARGA,
            objeto = "Sobrecarga docente en Metodología de la Investigación",
            periodo = periodo,
            fechaInicio = hoy.minusMonths(1).toString(),
            fechaFin = hoy.plusMonths(3).toString(),
            horas = 80.0,
            tarifaHora = 52.5,
            importe = 4200.0,
            clausulas = clausulas,
            estado = EstadosContrato.PENDIENTE,
        )
        val contrato3 = ContratoEntity(
            codigo = "CD-${hoy.year}-002",
            profesorId = profesores.getValue("P-0104"),
            tipo = TiposContrato.DETERMINADO,
            objeto = "Tutoría de tesis de pregrado y revisión de informes",
            periodo = periodo,
            fechaInicio = hoy.minusMonths(8).toString(),
            fechaFin = hoy.minusMonths(2).toString(),
            horas = 120.0,
            tarifaHora = 26.0,
            importe = 3120.0,
            clausulas = clausulas,
            estado = EstadosContrato.COMPLETADO,
        )
        val contrato4 = ContratoEntity(
            codigo = "CS-${hoy.year}-002",
            profesorId = profesores.getValue("P-0107"),
            tipo = TiposContrato.SOBRECARGA,
            objeto = "Apoyo a los laboratorios de Redes y Seguridad Informática",
            periodo = periodo,
            fechaInicio = hoy.plusMonths(1).toString(),
            fechaFin = hoy.plusMonths(5).toString(),
            horas = 60.0,
            tarifaHora = 27.0,
            importe = 1620.0,
            clausulas = clausulas,
            estado = EstadosContrato.BORRADOR,
        )
        val id1 = db.contratoDao().insertar(contrato1)
        db.contratoDao().insertar(contrato2)
        val id3 = db.contratoDao().insertar(contrato3)
        db.contratoDao().insertar(contrato4)

        val limite1 = CalculadoraFechas.masDias(contrato1.fechaFin, 30)
        val limite3 = CalculadoraFechas.masDias(contrato3.fechaFin, 30)
        db.pagoDao().insertar(
            PagoEntity(
                contratoId = id1,
                periodo = periodo,
                horas = 120.0,
                tarifa = 30.0,
                importe = 3600.0,
                estado = EstadosPago.PENDIENTE,
                fechaLimite = limite1,
                observaciones = "Primer corte de pago del contrato ${contrato1.codigo}.",
            ),
        )
        db.pagoDao().insertar(
            PagoEntity(
                contratoId = id3,
                periodo = periodo,
                horas = 120.0,
                tarifa = 26.0,
                importe = 3120.0,
                estado = EstadosPago.PAGADO,
                fechaLimite = limite3,
                fechaPago = CalculadoraFechas.masDias(limite3, -5),
                observaciones = "Pago liquidado al completar la tutoría.",
            ),
        )
    }

    private object CalculadoraFechas {
        fun masDias(fecha: String, dias: Long): String =
            LocalDate.parse(fecha).plusDays(dias).toString()
    }
}
