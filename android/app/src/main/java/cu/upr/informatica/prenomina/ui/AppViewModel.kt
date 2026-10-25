package cu.upr.informatica.prenomina.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import cu.upr.informatica.prenomina.AppContainer
import cu.upr.informatica.prenomina.data.local.entity.ContratoEntity
import cu.upr.informatica.prenomina.data.local.entity.ProfesorEntity
import cu.upr.informatica.prenomina.data.local.entity.TarifaEntity
import cu.upr.informatica.prenomina.data.model.ContratoDetalle
import cu.upr.informatica.prenomina.data.model.DashboardDatos
import cu.upr.informatica.prenomina.data.model.PagoDetalle
import cu.upr.informatica.prenomina.data.prefs.BASE_URL_PREDETERMINADA
import cu.upr.informatica.prenomina.data.prefs.SesionLocal
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class EstadoApp(
    val sesion: SesionLocal? = null,
    val cargando: Boolean = false,
    val mensaje: String? = null,
    val dashboard: DashboardDatos = DashboardDatos(),
    val profesores: List<ProfesorEntity> = emptyList(),
    val contratos: List<ContratoDetalle> = emptyList(),
    val pagos: List<PagoDetalle> = emptyList(),
    val tarifas: List<TarifaEntity> = emptyList(),
    val pendientes: Int = 0,
    val ultimaSync: String = "",
    val probandoConexion: Boolean = false,
    val urlServidor: String = BASE_URL_PREDETERMINADA,
) {
    val esAdmin: Boolean get() = sesion?.esAdmin == true
    val modoLocal: Boolean get() = sesion?.modoLocal == true
}

class AppViewModel(private val container: AppContainer) : ViewModel() {

    private val _estado = MutableStateFlow(EstadoApp())
    val estado: StateFlow<EstadoApp> = _estado.asStateFlow()

    private val authRepo = container.authRepository
    private val profesorRepo = container.profesorRepository
    private val contratoRepo = container.contratoRepository
    private val pagoRepo = container.pagoRepository
    private val catalogoRepo = container.catalogoRepository
    private val dashboardRepo = container.dashboardRepository
    private val syncManager = container.syncManager
    private val sessionStore = container.sessionStore
    private val db = container.database

    init {
        viewModelScope.launch {
            sessionStore.sesion.collect { sesion ->
                _estado.update { it.copy(sesion = sesion, urlServidor = sesion.baseUrl) }
            }
        }
        viewModelScope.launch {
            dashboardRepo.datos.collect { datos ->
                _estado.update { it.copy(dashboard = datos) }
            }
        }
        viewModelScope.launch {
            profesorRepo.observarTodos().collect { lista ->
                _estado.update { it.copy(profesores = lista) }
            }
        }
        viewModelScope.launch {
            contratoRepo.observarDetallados().collect { lista ->
                _estado.update { it.copy(contratos = lista) }
            }
        }
        viewModelScope.launch {
            pagoRepo.observarDetallados().collect { lista ->
                _estado.update { it.copy(pagos = lista) }
            }
        }
        viewModelScope.launch {
            catalogoRepo.observarTarifas().collect { lista ->
                _estado.update { it.copy(tarifas = lista) }
            }
        }
        viewModelScope.launch {
            db.pendienteSyncDao().observarConteo().collect { cantidad ->
                _estado.update { it.copy(pendientes = cantidad) }
            }
        }
    }

    fun limpiarMensaje() {
        _estado.update { it.copy(mensaje = null) }
    }

    private fun avisar(mensaje: String) {
        _estado.update { it.copy(mensaje = mensaje, cargando = false) }
    }

    fun cambiarUrl(url: String) {
        _estado.update { it.copy(urlServidor = url) }
    }

    fun iniciarSesion(email: String, password: String) {
        if (_estado.value.cargando) return
        _estado.update { it.copy(cargando = true, mensaje = null) }
        viewModelScope.launch {
            val url = _estado.value.urlServidor.ifBlank { BASE_URL_PREDETERMINADA }
            val resultado = authRepo.iniciarSesion(url, email, password)
            avisar(resultado.mensaje)
        }
    }

    fun entrarModoLocal() {
        if (_estado.value.cargando) return
        _estado.update { it.copy(cargando = true, mensaje = null) }
        viewModelScope.launch {
            val resultado = authRepo.entrarModoLocal()
            avisar(resultado.mensaje)
        }
    }

    fun cerrarSesion() {
        viewModelScope.launch {
            authRepo.cerrarSesion()
            _estado.update { it.copy(mensaje = "Sesión cerrada.") }
        }
    }

    fun guardarProfesor(profesor: ProfesorEntity) {
        if (_estado.value.cargando) return
        _estado.update { it.copy(cargando = true, mensaje = null) }
        viewModelScope.launch {
            val resultado = profesorRepo.guardar(profesor)
            avisar(resultado.mensaje)
        }
    }

    fun eliminarProfesor(profesor: ProfesorEntity) {
        _estado.update { it.copy(cargando = true, mensaje = null) }
        viewModelScope.launch {
            val resultado = profesorRepo.eliminar(profesor)
            avisar(resultado.mensaje)
        }
    }

    fun guardarContrato(contrato: ContratoEntity) {
        if (_estado.value.cargando) return
        _estado.update { it.copy(cargando = true, mensaje = null) }
        viewModelScope.launch {
            val resultado = contratoRepo.guardar(contrato)
            avisar(resultado.mensaje)
        }
    }

    fun eliminarContrato(contrato: ContratoEntity) {
        _estado.update { it.copy(cargando = true, mensaje = null) }
        viewModelScope.launch {
            val resultado = contratoRepo.eliminar(contrato)
            avisar(resultado.mensaje)
        }
    }

    fun cambiarEstadoContrato(contratoId: Long, estado: String, motivo: String = "") {
        _estado.update { it.copy(cargando = true, mensaje = null) }
        viewModelScope.launch {
            val resultado = contratoRepo.cambiarEstado(contratoId, estado, motivo)
            avisar(resultado.mensaje)
        }
    }

    fun crearPago(contratoId: Long, periodo: String, horas: Double, observaciones: String) {
        _estado.update { it.copy(cargando = true, mensaje = null) }
        viewModelScope.launch {
            val resultado = pagoRepo.crear(contratoId, periodo, horas, observaciones)
            avisar(resultado.mensaje)
        }
    }

    fun cambiarEstadoPago(pagoId: Long, estado: String, forzar: Boolean = false) {
        _estado.update { it.copy(cargando = true, mensaje = null) }
        viewModelScope.launch {
            val resultado = pagoRepo.cambiarEstado(pagoId, estado, _estado.value.esAdmin, forzar)
            avisar(resultado.mensaje)
        }
    }

    fun sincronizar() {
        if (_estado.value.cargando) return
        _estado.update { it.copy(cargando = true, mensaje = null) }
        viewModelScope.launch {
            val resultado = syncManager.sincronizar()
            _estado.update {
                it.copy(
                    cargando = false,
                    mensaje = resultado.mensaje,
                    ultimaSync = if (resultado.ok) "Última sincronización correcta" else "Sin sincronizar",
                )
            }
        }
    }

    fun probarConexion() {
        if (_estado.value.probandoConexion) return
        _estado.update { it.copy(probandoConexion = true, mensaje = null) }
        viewModelScope.launch {
            val resultado = syncManager.probarConexion(_estado.value.urlServidor)
            _estado.update { it.copy(probandoConexion = false, mensaje = resultado.mensaje) }
        }
    }

    fun guardarServidor(url: String) {
        _estado.update { it.copy(cargando = true, mensaje = null) }
        viewModelScope.launch {
            sessionStore.guardarBaseUrl(url)
            _estado.update {
                it.copy(cargando = false, mensaje = "Dirección del servidor guardada.")
            }
        }
    }

    fun borrarDatosLocales() {
        _estado.update { it.copy(cargando = true, mensaje = null) }
        viewModelScope.launch {
            val resultado = authRepo.borrarDatosLocales()
            avisar(resultado.mensaje)
        }
    }

    fun restaurarDemo() {
        _estado.update { it.copy(cargando = true, mensaje = null) }
        viewModelScope.launch {
            val resultado = authRepo.restaurarDemo()
            avisar(resultado.mensaje)
        }
    }

    fun tarifaPara(categoriaDocente: String, tipo: String): Double? {
        return _estado.value.tarifas
            .filter { it.categoriaDocente == categoriaDocente && it.tipo == tipo }
            .maxByOrNull { it.vigenteDesde }
            ?.importe
    }

    class Factory(private val container: AppContainer) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            return AppViewModel(container) as T
        }
    }
}
