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
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Payments
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import cu.upr.informatica.prenomina.data.local.entity.ContratoEntity
import cu.upr.informatica.prenomina.data.model.ContratoDetalle
import cu.upr.informatica.prenomina.domain.CalculadoraImporte
import cu.upr.informatica.prenomina.domain.EstadosContrato
import cu.upr.informatica.prenomina.domain.TiposContrato
import cu.upr.informatica.prenomina.ui.AppViewModel
import cu.upr.informatica.prenomina.ui.EstadoApp
import cu.upr.informatica.prenomina.ui.colorEstado
import cu.upr.informatica.prenomina.ui.componentes.CampoTexto
import cu.upr.informatica.prenomina.ui.componentes.ChipEstado
import cu.upr.informatica.prenomina.ui.componentes.DialogoConfirmar
import cu.upr.informatica.prenomina.ui.componentes.FilaDato
import cu.upr.informatica.prenomina.ui.componentes.SelectorCampo
import cu.upr.informatica.prenomina.ui.componentes.Separador
import cu.upr.informatica.prenomina.ui.dinero
import cu.upr.informatica.prenomina.ui.fechaCorta
import cu.upr.informatica.prenomina.ui.fondoEstado
import cu.upr.informatica.prenomina.ui.hoyIso
import cu.upr.informatica.prenomina.ui.numero
import androidx.activity.compose.BackHandler

@Composable
fun ContratosScreen(vm: AppViewModel, estado: EstadoApp) {
    var seleccionadoId by remember { mutableStateOf<Long?>(null) }
    var creando by remember { mutableStateOf(false) }
    var filtro by remember { mutableStateOf("todos") }

    BackHandler(enabled = creando || seleccionadoId != null) {
        creando = false
        seleccionadoId = null
    }

    val seleccionado = estado.contratos.firstOrNull { it.contrato.id == seleccionadoId }

    when {
        creando -> FormularioContrato(
            vm = vm,
            estado = estado,
            contrato = null,
            onCerrar = { creando = false },
        )

        seleccionado != null -> DetalleContrato(
            vm = vm,
            estado = estado,
            detalle = seleccionado,
            onVolver = { seleccionadoId = null },
            onEliminado = { seleccionadoId = null },
        )

        else -> {
            val filtrados = estado.contratos.filter { item ->
                filtro == "todos" || item.contrato.estado == filtro
            }
            Box(Modifier.fillMaxSize()) {
                Column(Modifier.fillMaxSize()) {
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 8.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        val opciones = listOf("todos") + EstadosContrato.TODOS
                        items(opciones) { opcion ->
                            FilterChip(
                                selected = filtro == opcion,
                                onClick = { filtro = opcion },
                                label = {
                                    Text(
                                        if (opcion == "todos") "Todos"
                                        else EstadosContrato.etiqueta(opcion),
                                    )
                                },
                            )
                        }
                    }
                    Text(
                        text = "${filtrados.size} contrato(s)",
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
                                    text = "No hay contratos con ese filtro.",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.padding(16.dp),
                                )
                            }
                        }
                        items(filtrados, key = { it.contrato.id }) { item ->
                            Card(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { seleccionadoId = item.contrato.id },
                            ) {
                                Column(Modifier.padding(12.dp)) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text(
                                            text = item.contrato.codigo,
                                            style = MaterialTheme.typography.titleSmall,
                                            fontWeight = FontWeight.SemiBold,
                                            modifier = Modifier.weight(1f),
                                        )
                                        ChipEstado(
                                            texto = EstadosContrato.etiqueta(item.contrato.estado),
                                            color = colorEstado(item.contrato.estado),
                                            fondo = fondoEstado(item.contrato.estado),
                                        )
                                    }
                                    Text(
                                        text = item.nombreProfesor,
                                        style = MaterialTheme.typography.bodyMedium,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                    )
                                    Text(
                                        text = item.contrato.objeto,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        maxLines = 2,
                                        overflow = TextOverflow.Ellipsis,
                                    )
                                    Spacer(Modifier.height(4.dp))
                                    Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                                        Text(
                                            text = "${TiposContrato.etiquetaCorta(item.contrato.tipo)} · " +
                                                "${item.contrato.horas.toInt()} h",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        )
                                        Text(
                                            text = dinero(item.contrato.importe),
                                            style = MaterialTheme.typography.labelLarge,
                                            fontWeight = FontWeight.SemiBold,
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
                FloatingActionButton(
                    onClick = { creando = true },
                    modifier = Modifier.align(Alignment.BottomEnd).padding(18.dp),
                    containerColor = MaterialTheme.colorScheme.primary,
                    contentColor = MaterialTheme.colorScheme.onPrimary,
                ) {
                    Icon(Icons.Filled.Add, contentDescription = "Nuevo contrato")
                }
            }
        }
    }
}

@Composable
private fun DetalleContrato(
    vm: AppViewModel,
    estado: EstadoApp,
    detalle: ContratoDetalle,
    onVolver: () -> Unit,
    onEliminado: () -> Unit,
) {
    val contrato = detalle.contrato
    var rechazar by remember { mutableStateOf(false) }
    var eliminar by remember { mutableStateOf(false) }
    var motivo by remember { mutableStateOf("") }
    var pago by remember { mutableStateOf(false) }
    val pagos = estado.pagos.filter { it.pago.contratoId == contrato.id }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onVolver) {
                Icon(Icons.Filled.ArrowBack, contentDescription = "Volver")
            }
            Column(Modifier.weight(1f)) {
                Text(contrato.codigo, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Text(
                    text = TiposContrato.etiqueta(contrato.tipo),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            ChipEstado(
                texto = EstadosContrato.etiqueta(contrato.estado),
                color = colorEstado(contrato.estado),
                fondo = fondoEstado(contrato.estado),
            )
        }
        Spacer(Modifier.height(10.dp))

        Card {
            Column(Modifier.padding(14.dp)) {
                FilaDato("Profesor", detalle.nombreProfesor)
                FilaDato("Objeto", contrato.objeto)
                FilaDato("Período", contrato.periodo)
                FilaDato("Vigencia", "${fechaCorta(contrato.fechaInicio)} — ${fechaCorta(contrato.fechaFin)}")
                FilaDato("Horas", "${numero(contrato.horas)} h")
                FilaDato("Tarifa", "${dinero(contrato.tarifaHora)} / hora")
                FilaDato("Importe", dinero(contrato.importe))
                if (contrato.observaciones.isNotBlank()) FilaDato("Observaciones", contrato.observaciones)
                if (contrato.motivoRechazo.isNotBlank()) FilaDato("Motivo del rechazo", contrato.motivoRechazo)
            }
        }

        if (contrato.clausulas != "[]" && contrato.clausulas.isNotBlank()) {
            Spacer(Modifier.height(12.dp))
            Text("Cláusulas", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(6.dp))
            val clausulas = runCatching {
                org.json.JSONArray(contrato.clausulas).let { arreglo ->
                    (0 until arreglo.length()).map { arreglo.getString(it) }
                }
            }.getOrDefault(emptyList())
            clausulas.forEachIndexed { indice, texto ->
                Text(
                    text = "${indice + 1}. $texto",
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(vertical = 3.dp),
                )
            }
        }

        Spacer(Modifier.height(14.dp))
        Text("Pagos del contrato", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        if (pagos.isEmpty()) {
            Text(
                text = "Sin pagos registrados.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(vertical = 6.dp),
            )
        } else {
            pagos.forEach { item ->
                Card(Modifier.fillMaxWidth().padding(vertical = 3.dp)) {
                    Row(Modifier.padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(item.pago.periodo, style = MaterialTheme.typography.bodyMedium)
                            Text(
                                text = "${numero(item.pago.horas)} h · límite ${fechaCorta(item.pago.fechaLimite)}",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        Text(dinero(item.pago.importe), fontWeight = FontWeight.SemiBold)
                        Spacer(Modifier.width(8.dp))
                        ChipEstado(
                            texto = item.pago.estado.replaceFirstChar { it.uppercase() },
                            color = colorEstado(item.pago.estado),
                            fondo = fondoEstado(item.pago.estado),
                        )
                    }
                }
            }
        }

        if (contrato.estado == EstadosContrato.ACTIVO || contrato.estado == EstadosContrato.COMPLETADO) {
            Spacer(Modifier.height(8.dp))
            OutlinedButton(onClick = { pago = true }, modifier = Modifier.fillMaxWidth()) {
                Icon(Icons.Filled.Payments, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text("Registrar pago")
            }
        }

        Spacer(Modifier.height(14.dp))
        val siguientes = EstadosContrato.siguientes(contrato.estado)
        if (siguientes.isNotEmpty()) {
            Text("Acciones", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(6.dp))
            siguientes.forEach { siguiente ->
                if (siguiente == EstadosContrato.RECHAZADO) {
                    OutlinedButton(
                        onClick = { rechazar = true },
                        modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp),
                    ) { Text("Rechazar contrato") }
                } else {
                    Button(
                        onClick = { vm.cambiarEstadoContrato(contrato.id, siguiente) },
                        modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp),
                    ) {
                        Text("Pasar a ${EstadosContrato.etiqueta(siguiente)}")
                    }
                }
            }
        }

        if (contrato.estado == EstadosContrato.BORRADOR || contrato.estado == EstadosContrato.RECHAZADO) {
            OutlinedButton(
                onClick = {
                    if (contrato.estado == EstadosContrato.BORRADOR) eliminar = true
                    else {
                        // El servidor solo permite editar borradores/rechazados.
                        onVolver()
                    }
                },
                modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
            ) {
                Icon(Icons.Filled.Edit, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text(if (contrato.estado == EstadosContrato.BORRADOR) "Eliminar contrato" else "Cerrar")
            }
        }
        Spacer(Modifier.height(24.dp))
    }

    if (rechazar) {
        AlertDialog(
            onDismissRequest = { rechazar = false },
            title = { Text("Rechazar contrato") },
            text = {
                Column {
                    Text("Indique el motivo del rechazo para dejarlo registrado.")
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(
                        value = motivo,
                        onValueChange = { motivo = it },
                        label = { Text("Motivo") },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 2,
                    )
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        vm.cambiarEstadoContrato(contrato.id, EstadosContrato.RECHAZADO, motivo)
                        motivo = ""
                        rechazar = false
                    },
                ) { Text("Rechazar") }
            },
            dismissButton = { TextButton(onClick = { rechazar = false }) { Text("Cancelar") } },
        )
    }

    if (eliminar) {
        DialogoConfirmar(
            titulo = "Eliminar contrato",
            mensaje = "¿Eliminar el contrato ${contrato.codigo}? Solo se permite en estado borrador.",
            textoConfirmar = "Eliminar",
            destructivo = true,
            onConfirmar = {
                vm.eliminarContrato(contrato)
                eliminar = false
                onEliminado()
            },
            onCancelar = { eliminar = false },
        )
    }

    if (pago) {
        DialogoRegistrarPago(
            contratoFijo = detalle,
            contratos = estado.contratos,
            onGuardar = { contratoId, periodo, horas, observaciones ->
                vm.crearPago(contratoId, periodo, horas, observaciones)
                pago = false
            },
            onCerrar = { pago = false },
        )
    }
}

@Composable
private fun FormularioContrato(
    vm: AppViewModel,
    estado: EstadoApp,
    contrato: ContratoEntity?,
    onCerrar: () -> Unit,
) {
    val profesores = estado.profesores.filter { it.activo || it.id == contrato?.profesorId }
    var profesorId by remember { mutableStateOf(contrato?.profesorId ?: profesores.firstOrNull()?.id ?: 0L) }
    var tipo by remember { mutableStateOf(contrato?.tipo ?: TiposContrato.DETERMINADO) }
    var objeto by remember { mutableStateOf(contrato?.objeto ?: "") }
    var periodo by remember { mutableStateOf(contrato?.periodo ?: "") }
    var inicio by remember { mutableStateOf(contrato?.fechaInicio ?: hoyIso()) }
    var fin by remember { mutableStateOf(contrato?.fechaFin ?: hoyIso()) }
    var horas by remember { mutableStateOf(contrato?.horas?.toString() ?: "") }
    var tarifa by remember { mutableStateOf(contrato?.tarifaHora?.toString() ?: "") }
    var observaciones by remember { mutableStateOf(contrato?.observaciones ?: "") }
    var error by remember { mutableStateOf<String?>(null) }

    val profesor = profesores.firstOrNull { it.id == profesorId }
    val tarifaCatalogo = profesor?.let { vm.tarifaPara(it.categoriaDocente, tipo) }
    LaunchedEffect(profesorId, tipo) {
        if (tarifa.isBlank() || (tarifaCatalogo != null && tarifa.toDoubleOrNull() == 0.0)) {
            tarifa = tarifaCatalogo?.toString() ?: ""
        }
    }

    val importe = CalculadoraImporte.calcular(horas.toDoubleOrNull() ?: 0.0, tarifa.toDoubleOrNull() ?: 0.0)

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onCerrar) {
                Icon(Icons.Filled.ArrowBack, contentDescription = "Volver")
            }
            Text(
                text = if (contrato == null) "Nuevo contrato" else "Editar contrato",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.SemiBold,
            )
        }
        Spacer(Modifier.height(8.dp))

        SelectorCampo(
            etiqueta = "Profesor",
            valor = profesor?.nombre ?: "Seleccione…",
            opciones = profesores.map { it.nombre },
            onSeleccion = { nombre ->
                profesores.firstOrNull { it.nombre == nombre }?.let {
                    profesorId = it.id
                    tarifa = vm.tarifaPara(it.categoriaDocente, tipo)?.toString() ?: ""
                }
            },
        )
        Spacer(Modifier.height(8.dp))
        SelectorCampo(
            etiqueta = "Tipo de contrato",
            valor = TiposContrato.etiqueta(tipo),
            opciones = TiposContrato.TODOS.map(TiposContrato::etiqueta),
            onSeleccion = { etiqueta ->
                val nuevo = TiposContrato.TODOS.first { TiposContrato.etiqueta(it) == etiqueta }
                tipo = nuevo
                profesor?.let { tarifa = vm.tarifaPara(it.categoriaDocente, nuevo)?.toString() ?: "" }
            },
        )
        Spacer(Modifier.height(8.dp))
        CampoTexto(
            etiqueta = "Objeto del contrato",
            valor = objeto,
            onCambio = { objeto = it },
            placeholder = "Docencia de la asignatura…",
            lineas = 2,
        )
        Spacer(Modifier.height(8.dp))
        CampoTexto(
            etiqueta = "Período (opcional)",
            valor = periodo,
            onCambio = { periodo = it },
            placeholder = "2026-2",
        )
        Spacer(Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            CampoTexto(
                etiqueta = "Inicio (AAAA-MM-DD)",
                valor = inicio,
                onCambio = { inicio = it },
                modifier = Modifier.weight(1f),
            )
            CampoTexto(
                etiqueta = "Fin (AAAA-MM-DD)",
                valor = fin,
                onCambio = { fin = it },
                modifier = Modifier.weight(1f),
            )
        }
        Spacer(Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            CampoTexto(
                etiqueta = "Horas",
                valor = horas,
                onCambio = { horas = it },
                tipoTeclado = KeyboardType.Decimal,
                modifier = Modifier.weight(1f),
            )
            CampoTexto(
                etiqueta = "Tarifa por hora",
                valor = tarifa,
                onCambio = { tarifa = it },
                tipoTeclado = KeyboardType.Decimal,
                modifier = Modifier.weight(1f),
            )
        }
        if (tarifaCatalogo != null) {
            Text(
                text = "Tarifa del catálogo para ${profesor?.categoriaDocente}: ${dinero(tarifaCatalogo)}",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
        Spacer(Modifier.height(8.dp))
        Card {
            Row(Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("Importe calculado", modifier = Modifier.weight(1f))
                Text(
                    text = dinero(importe),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                )
            }
        }
        Spacer(Modifier.height(8.dp))
        CampoTexto(
            etiqueta = "Observaciones",
            valor = observaciones,
            onCambio = { observaciones = it },
            lineas = 2,
        )

        if (error != null) {
            Spacer(Modifier.height(8.dp))
            Text(error!!, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        }

        Spacer(Modifier.height(16.dp))
        Button(
            onClick = {
                val validacion = cu.upr.informatica.prenomina.domain.ValidadorContrato.validar(
                    profesorId = profesorId,
                    objeto = objeto,
                    fechaInicio = inicio,
                    fechaFin = fin,
                    horas = horas.toDoubleOrNull() ?: 0.0,
                    tarifaHora = tarifa.toDoubleOrNull() ?: 0.0,
                )
                if (!validacion.valido) {
                    error = validacion.mensaje
                    return@Button
                }
                error = null
                val base = contrato ?: ContratoEntity(
                    codigo = "",
                    profesorId = profesorId,
                    objeto = objeto,
                    fechaInicio = inicio,
                    fechaFin = fin,
                )
                vm.guardarContrato(
                    base.copy(
                        profesorId = profesorId,
                        tipo = tipo,
                        objeto = objeto,
                        periodo = periodo,
                        fechaInicio = inicio,
                        fechaFin = fin,
                        horas = horas.toDoubleOrNull() ?: 0.0,
                        tarifaHora = tarifa.toDoubleOrNull() ?: 0.0,
                        observaciones = observaciones,
                    ),
                )
                onCerrar()
            },
            modifier = Modifier.fillMaxWidth().height(48.dp),
        ) {
            Text(if (contrato == null) "Crear contrato" else "Guardar cambios")
        }
        Spacer(Modifier.height(6.dp))
        TextButton(onClick = onCerrar, modifier = Modifier.fillMaxWidth()) { Text("Cancelar") }
        Spacer(Modifier.height(20.dp))
    }
}
