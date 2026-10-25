package cu.upr.informatica.prenomina

import cu.upr.informatica.prenomina.domain.CalculadoraImporte
import cu.upr.informatica.prenomina.domain.EstadosContrato
import cu.upr.informatica.prenomina.domain.EstadosPago
import cu.upr.informatica.prenomina.domain.ValidadorContrato
import cu.upr.informatica.prenomina.domain.ValidadorPago
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

class CalculoTest {

    @Test
    fun `el importe se calcula y redondea a centesimas`() {
        assertEquals(2304.0, CalculadoraImporte.calcular(64.0, 36.0), 0.001)
        assertEquals(33.33, CalculadoraImporte.calcular(1.0, 33.333), 0.001)
    }

    @Test
    fun `la fecha limite es el fin del contrato mas treinta dias`() {
        assertEquals("2027-03-02", CalculadoraImporte.fechaLimitePago("2027-01-31"))
        assertEquals("2026-01-31", CalculadoraImporte.fechaLimitePago("2026-01-01"))
    }

    @Test
    fun `un pago vencido se detecta por la fecha limite`() {
        val hoy = LocalDate.of(2026, 3, 3)
        assertTrue(CalculadoraImporte.estaVencido("2026-03-02", hoy))
        assertFalse(CalculadoraImporte.estaVencido("2026-03-04", hoy))
    }

    @Test
    fun `un contrato de mas de doce meses no es valido`() {
        val validacion = ValidadorContrato.validar(
            profesorId = 1,
            objeto = "Docencia",
            fechaInicio = "2026-01-01",
            fechaFin = "2027-02-01",
            horas = 100.0,
            tarifaHora = 36.0,
        )
        assertFalse(validacion.valido)
        assertTrue(validacion.mensaje.contains("12 meses"))
    }

    @Test
    fun `un contrato correcto pasa la validacion`() {
        val validacion = ValidadorContrato.validar(
            profesorId = 1,
            objeto = "Docencia",
            fechaInicio = "2026-09-07",
            fechaFin = "2027-02-28",
            horas = 64.0,
            tarifaHora = 36.0,
        )
        assertTrue(validacion.mensaje, validacion.valido)
    }

    @Test
    fun `solo los contratos activos generan pagos`() {
        assertFalse(ValidadorPago.validar(false, "2026-2", 10.0, 30.0).valido)
        assertTrue(ValidadorPago.validar(true, "2026-2", 10.0, 30.0).valido)
    }

    @Test
    fun `las transiciones de contrato respetan el flujo`() {
        assertTrue(EstadosContrato.siguientes("borrador").contains("pendiente"))
        assertTrue(EstadosContrato.siguientes("pendiente").contains("aprobado"))
        assertTrue(EstadosContrato.siguientes("aprobado").contains("activo"))
        assertTrue(EstadosContrato.siguientes("activo").contains("completado"))
        assertTrue(EstadosContrato.siguientes("completado").isEmpty())
    }

    @Test
    fun `las transiciones de pago respetan el flujo`() {
        assertTrue(EstadosPago.siguientes("pendiente").contains("aprobado"))
        assertTrue(EstadosPago.siguientes("aprobado").contains("pagado"))
        assertTrue(EstadosPago.siguientes("pagado").isEmpty())
    }
}
