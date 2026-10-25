package cu.upr.informatica.prenomina.ui.pantallas

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Payments
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import cu.upr.informatica.prenomina.data.model.ContratoDetalle
import cu.upr.informatica.prenomina.data.model.PagoDetalle
import cu.upr.informatica.prenomina.domain.CalculadoraImporte
import cu.upr.informatica.prenomina.domain.EstadosPago
import cu.upr.informatica.prenomina.ui.AppViewModel
import cu.upr.informatica.prenomina.ui.EstadoApp
import cu.upr.informatica.prenomina.ui.colorEstado
import cu.upr.informatica.prenomina.ui.componentes.ChipEstado
import cu.upr.informatica.prenomina.ui.componentes.FilaDato
import cu.upr.informatica.prenomina.ui.componentes.SelectorCampo
import cu.upr.informatica.prenomina.ui.componentes.Separador
import cu.upr.informatica.prenomina.ui.dinero
import cu.upr.informatica.prenomina.ui.fechaCorta
import cu.upr.informatica.prenomina.ui.fondoEstado
import cu.upr.informatica.prenomina.ui.numero

@Composable
fun PagosScreen(vm: AppViewModel, estado: EstadoApp) {
    var filtro by remember { mutableStateOf("todos") }
    var nuevo by remember { mutableStateOf(false) }
    var seleccionadoId by remember { mutableStateOf<Long?>(null) }

    val seleccionado = estado.pagos.firstOrNull { it.pago.id == seleccionadoId }
    val filtrados = estado.pagos.filter { filtro == "todos" || it.pago.estado == filtro }

    Box(Modifier.fillMaxSize()) {
        Column(Modifier.fillMaxSize()) {
            LazyRow(
                contentPadding = PaddingValues(horizontal = 14.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                val opciones = listOf("todos") + EstadosPago.TODOS
                items(opciones) { opcion ->
                    FilterChip(
                        selected = filtro == opcion,
                        onClick = { filtro = opcion },
                        label = {
                            Text(if (opcion == "todos") "Todos" else EstadosPago.etiqueta(opcion))
                        },
                    )
                }
            }
            Text(
                text = "${filtrados.size} pago(s) · total ${dinero(filtrados.sumOf { it.pago.importe })}",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = 18.dp),
            )
            LazyColumn(
                contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 6.dp, bottom = 90.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                if (filtrados.isEmpty()) {
                    item {
                        Text(
                            text = "No hay pagos con ese filtro.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(16.dp),
                        )
                    }
                }
                items(filtrados, key = { it.pago.id }) { item ->
                    val vencido = CalculadoraImporte.estaVencido(item.pago.fechaLimite) &&
                        item.pago.estado != EstadosPago.PAGADO &&
                        item.pago.estado != EstadosPago.ANULADO
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { seleccionadoId = item.pago.id },
                    ) {
                        Column(Modifier.padding(12.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    text = item.codigoContrato,
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = FontWeight.SemiBold,
                                    modifier = Modifier.weight(1f),
                                )
                                ChipEstado(
                                    texto = EstadosPago.etiqueta(item.pago.estado),
                                    color = colorEstado(item.pago.estado),
                                    fondo = fondoEstado(item.pago.estado),
                                )
                            }
                            Text(
                                text = item.nombreProfesor,
                                style = MaterialTheme.typography.bodyMedium,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                            Spacer(Modifier.height(4.dp))
                            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                                Text(
                                    text = "Período ${item.pago.periodo} · ${numero(item.pago.horas)} h",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                                Text(
                                    text = dinero(item.pago.importe),
                                    style = MaterialTheme.typography.labelLarge,
                                    fontWeight = FontWeight.SemiBold,
                                )
                            }
                            Text(
                                text = "Límite ${fechaCorta(item.pago.fechaLimite)}" +
                                    if (vencido) " · VENCIDO" else "",
                                style = MaterialTheme.typography.labelSmall,
                                color = if (vencido) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
            }
        }
        FloatingActionButton(
            onClick = { nuevo = true },
            modifier = Modifier.align(Alignment.BottomEnd).padding(18.dp),
            containerColor = MaterialTheme.colorScheme.primary,
            contentColor = MaterialTheme.colorScheme.onPrimary,
        ) {
            Icon(Icons.Filled.Add, contentDescription = "Registrar pago")
        }
    }

    if (nuevo) {
        DialogoRegistrarPago(
            contratoFijo = null,
            contratos = estado.contratos,
            onGuardar = { contratoId, periodo, horas, observaciones ->
                vm.crearPago(contratoId, periodo, horas, observaciones)
                nuevo = false
            },
            onCerrar = { nuevo = false },
        )
    }

    if (seleccionado != null) {
        DetallePago(
            vm = vm,
            estado = estado,
            detalle = seleccionado,
            onCerrar = { seleccionadoId = null },
        )
    }
}

@Composable
private fun DetallePago(
    vm: AppViewModel,
    estado: EstadoApp,
    detalle: PagoDetalle,
    onCerrar: () -> Unit,
) {
    val pago = detalle.pago
    val vencido = CalculadoraImporte.estaVencido(pago.fechaLimite) &&
        pago.estado != EstadosPago.PAGADO &&
        pago.estado != EstadosPago.ANULADO
    var confirmarForzar by remember { mutableStateOf(false) }
    val siguientes = EstadosPago.siguientes(pago.estado)

    AlertDialog(
        onDismissRequest = onCerrar,
        title = { Text("Pago ${pago.periodo}") },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState())) {
                FilaDato("Contrato", detalle.codigoContrato)
                FilaDato("Profesor", detalle.nombreProfesor)
                FilaDato("Horas", "${numero(pago.horas)} h")
                FilaDato("Tarifa", "${dinero(pago.tarifa)} / h")
                FilaDato("Importe", dinero(pago.importe))
                FilaDato("Estado", EstadosPago.etiqueta(pago.estado))
                FilaDato("Fecha límite", fechaCorta(pago.fechaLimite))
                if (pago.fechaPago != null) FilaDato("Fecha de pago", fechaCorta(pago.fechaPago))
                if (pago.observaciones.isNotBlank()) FilaDato("Observaciones", pago.observaciones)
                if (vencido) {
                    Spacer(Modifier.height(6.dp))
                    Text(
                        text = "Este pago superó los 30 días posteriores al fin del contrato.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error,
                    )
                }
                Separador()
                siguientes.forEach { siguiente ->
                    Button(
                        onClick = {
                            if (siguiente == EstadosPago.APROBADO && vencido) {
                                confirmarForzar = true
                            } else {
                                vm.cambiarEstadoPago(pago.id, siguiente)
                                onCerrar()
                            }
                        },
                        modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp),
                    ) {
                        Text(
                            when (siguiente) {
                                EstadosPago.APROBADO -> "Aprobar pago"
                                EstadosPago.PAGADO -> "Marcar como pagado"
                                else -> "Anular pago"
                            },
                        )
                    }
                }
                if (siguientes.isEmpty()) {
                    Text(
                        text = "El pago está cerrado y no admite más cambios.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        },
        confirmButton = { TextButton(onClick = onCerrar) { Text("Cerrar") } },
    )

    if (confirmarForzar) {
        AlertDialog(
            onDismissRequest = { confirmarForzar = false },
            title = { Text("Aprobación fuera de plazo") },
            text = {
                Text(
                    "El pago está vencido. Como administrador puede aprobarlo dejando constancia. " +
                        "¿Desea continuar?",
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        vm.cambiarEstadoPago(pago.id, EstadosPago.APROBADO, forzar = true)
                        confirmarForzar = false
                        onCerrar()
                    },
                ) { Text("Aprobar de todos modos") }
            },
            dismissButton = { TextButton(onClick = { confirmarForzar = false }) { Text("Cancelar") } },
        )
    }
}

@Composable
fun DialogoRegistrarPago(
    contratoFijo: ContratoDetalle?,
    contratos: List<ContratoDetalle>,
    onGuardar: (Long, String, Double, String) -> Unit,
    onCerrar: () -> Unit,
) {
    val disponibles = contratos.filter {
        it.contrato.estado == cu.upr.informatica.prenomina.domain.EstadosContrato.ACTIVO ||
            it.contrato.estado == cu.upr.informatica.prenomina.domain.EstadosContrato.COMPLETADO
    }
    val inicial = contratoFijo ?: disponibles.firstOrNull()
    var contratoId by remember { mutableStateOf(inicial?.contrato?.id ?: 0L) }
    var periodo by remember {
        mutableStateOf(inicial?.contrato?.periodo?.ifBlank { null } ?: java.time.LocalDate.now().toString().substring(0, 7))
    }
    var horas by remember { mutableStateOf(inicial?.contrato?.horas?.toString() ?: "") }
    var observaciones by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }

    val contrato = disponibles.firstOrNull { it.contrato.id == contratoId } ?: inicial

    AlertDialog(
        onDismissRequest = onCerrar,
        title = { Text("Registrar pago") },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState())) {
                if (disponibles.isEmpty()) {
                    Text(
                        "No hay contratos activos o completados que puedan generar pagos.",
                        color = MaterialTheme.colorScheme.error,
                    )
                } else {
                    SelectorCampo(
                        etiqueta = "Contrato",
                        valor = contrato?.let { "${it.contrato.codigo} · ${it.nombreProfesor}" } ?: "",
                        opciones = disponibles.map { "${it.contrato.codigo} · ${it.nombreProfesor}" },
                        onSeleccion = { texto ->
                            disponibles.firstOrNull {
                                "${it.contrato.codigo} · ${it.nombreProfesor}" == texto
                            }?.let {
                                contratoId = it.contrato.id
                                horas = it.contrato.horas.toString()
                                if (it.contrato.periodo.isNotBlank()) periodo = it.contrato.periodo
                            }
                        },
                    )
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(
                        value = periodo,
                        onValueChange = { periodo = it },
                        label = { Text("Período") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(
                        value = horas,
                        onValueChange = { horas = it },
                        label = { Text("Horas") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(
                        value = observaciones,
                        onValueChange = { observaciones = it },
                        label = { Text("Observaciones (opcional)") },
                        minLines = 2,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    val importe = CalculadoraImporte.calcular(
                        horas.toDoubleOrNull() ?: 0.0,
                        contrato?.contrato?.tarifaHora ?: 0.0,
                    )
                    Spacer(Modifier.height(10.dp))
                    Text(
                        text = "Importe: ${dinero(importe)}",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                    )
                    if (error != null) {
                        Text(error!!, color = MaterialTheme.colorScheme.error)
                    }
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    val horasValor = horas.toDoubleOrNull() ?: 0.0
                    if (contratoId == 0L) {
                        error = "Seleccione un contrato."
                        return@TextButton
                    }
                    if (periodo.isBlank()) {
                        error = "Indique el período."
                        return@TextButton
                    }
                    if (horasValor <= 0.0) {
                        error = "Las horas deben ser mayores que cero."
                        return@TextButton
                    }
                    onGuardar(contratoId, periodo, horasValor, observaciones)
                },
                enabled = disponibles.isNotEmpty(),
            ) { Text("Registrar") }
        },
        dismissButton = { TextButton(onClick = onCerrar) { Text("Cancelar") } },
    )
}
