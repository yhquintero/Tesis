package cu.upr.informatica.prenomina.ui.pantallas

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.activity.compose.BackHandler
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import cu.upr.informatica.prenomina.data.local.entity.ProfesorEntity
import cu.upr.informatica.prenomina.domain.CategoriasDocente
import cu.upr.informatica.prenomina.domain.CategoriasPoc
import cu.upr.informatica.prenomina.ui.AppViewModel
import cu.upr.informatica.prenomina.ui.EstadoApp
import cu.upr.informatica.prenomina.ui.componentes.CampoTexto
import cu.upr.informatica.prenomina.ui.componentes.DialogoConfirmar
import cu.upr.informatica.prenomina.ui.componentes.SelectorCampo
import cu.upr.informatica.prenomina.ui.numero

@Composable
fun ProfesoresScreen(vm: AppViewModel, estado: EstadoApp) {
    var edicion by remember { mutableStateOf<ProfesorEntity?>(null) }
    var creando by remember { mutableStateOf(false) }
    var busqueda by remember { mutableStateOf("") }
    var eliminar by remember { mutableStateOf<ProfesorEntity?>(null) }

    BackHandler(enabled = creando || edicion != null) {
        creando = false
        edicion = null
    }

    if (creando || edicion != null) {
        FormularioProfesor(
            profesor = edicion,
            onGuardar = { profesor ->
                vm.guardarProfesor(profesor)
                creando = false
                edicion = null
            },
            onEliminar = { profesor -> eliminar = profesor },
            onCancelar = {
                creando = false
                edicion = null
            },
        )
    } else {
        val filtrados = estado.profesores.filter { profesor ->
            busqueda.isBlank() ||
                profesor.nombre.contains(busqueda, ignoreCase = true) ||
                profesor.ci.contains(busqueda) ||
                profesor.noTrabajador.contains(busqueda, ignoreCase = true)
        }
        Box(Modifier.fillMaxSize()) {
            Column(Modifier.fillMaxSize()) {
                OutlinedTextField(
                    value = busqueda,
                    onValueChange = { busqueda = it },
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
                    placeholder = { Text("Buscar por nombre, CI o número de trabajador") },
                    leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
                    singleLine = true,
                )
                Text(
                    text = "${filtrados.size} profesor(es)",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(horizontal = 18.dp, vertical = 2.dp),
                )
                LazyColumn(
                    contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 6.dp, bottom = 90.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    if (filtrados.isEmpty()) {
                        item {
                            Text(
                                text = "No se encontraron profesores con esos criterios.",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(16.dp),
                            )
                        }
                    }
                    items(filtrados, key = { it.id }) { profesor ->
                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { edicion = profesor },
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(42.dp)
                                        .clip(CircleShape)
                                        .background(MaterialTheme.colorScheme.primaryContainer),
                                    contentAlignment = Alignment.Center,
                                ) {
                                    Icon(
                                        imageVector = Icons.Filled.Person,
                                        contentDescription = null,
                                        tint = MaterialTheme.colorScheme.onPrimaryContainer,
                                    )
                                }
                                Column(Modifier.weight(1f).padding(horizontal = 10.dp)) {
                                    Text(
                                        text = profesor.nombre,
                                        style = MaterialTheme.typography.titleSmall,
                                        fontWeight = FontWeight.SemiBold,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                    )
                                    Text(
                                        text = "${profesor.categoriaDocente} · ${profesor.categoriaPoc}",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                    Text(
                                        text = "No. ${profesor.noTrabajador} · CI ${profesor.ci} · " +
                                            "${numero(profesor.cargaHoraria)} h",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                                if (!profesor.activo) {
                                    Text(
                                        text = "Inactivo",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.error,
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
                Icon(Icons.Filled.Add, contentDescription = "Nuevo profesor")
            }
        }
    }

    eliminar?.let { profesor ->
        DialogoConfirmar(
            titulo = "Eliminar profesor",
            mensaje = "¿Eliminar a ${profesor.nombre}? Esta acción no se puede deshacer.",
            textoConfirmar = "Eliminar",
            destructivo = true,
            onConfirmar = {
                vm.eliminarProfesor(profesor)
                eliminar = null
                edicion = null
            },
            onCancelar = { eliminar = null },
        )
    }
}

@Composable
private fun FormularioProfesor(
    profesor: ProfesorEntity?,
    onGuardar: (ProfesorEntity) -> Unit,
    onEliminar: (ProfesorEntity) -> Unit,
    onCancelar: () -> Unit,
) {
    var borrador by remember(profesor) {
        mutableStateOf(
            profesor ?: ProfesorEntity(
                noTrabajador = "",
                nombre = "",
                ci = "",
                categoriaDocente = CategoriasDocente.INSTRUCTOR,
            ),
        )
    }
    var errores by remember { mutableStateOf<Map<String, String>>(emptyMap()) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onCancelar) {
                Icon(Icons.Filled.ArrowBack, contentDescription = "Volver")
            }
            Text(
                text = if (profesor == null) "Nuevo profesor" else "Editar profesor",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.SemiBold,
            )
        }
        Spacer(Modifier.height(10.dp))

        CampoTexto(
            etiqueta = "Nombre y apellidos",
            valor = borrador.nombre,
            onCambio = { borrador = borrador.copy(nombre = it) },
            error = errores["nombre"],
        )
        Spacer(Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            CampoTexto(
                etiqueta = "No. trabajador",
                valor = borrador.noTrabajador,
                onCambio = { borrador = borrador.copy(noTrabajador = it) },
                error = errores["noTrabajador"],
                modifier = Modifier.weight(1f),
            )
            CampoTexto(
                etiqueta = "Carné de identidad",
                valor = borrador.ci,
                onCambio = { borrador = borrador.copy(ci = it.filter(Char::isDigit)) },
                error = errores["ci"],
                tipoTeclado = KeyboardType.Number,
                modifier = Modifier.weight(1f),
            )
        }
        Spacer(Modifier.height(8.dp))
        CampoTexto(
            etiqueta = "Año académico",
            valor = borrador.anio,
            onCambio = { borrador = borrador.copy(anio = it) },
            placeholder = "2do Año",
        )
        Spacer(Modifier.height(8.dp))
        SelectorCampo(
            etiqueta = "Categoría docente",
            valor = borrador.categoriaDocente,
            opciones = CategoriasDocente.TODAS,
            onSeleccion = { borrador = borrador.copy(categoriaDocente = it) },
        )
        Spacer(Modifier.height(8.dp))
        SelectorCampo(
            etiqueta = "Categoría PoC",
            valor = borrador.categoriaPoc,
            opciones = CategoriasPoc.TODAS,
            onSeleccion = { borrador = borrador.copy(categoriaPoc = it) },
        )
        Spacer(Modifier.height(8.dp))
        CampoTexto(
            etiqueta = "Carga horaria por corte",
            valor = borrador.cargaHoraria.toString(),
            onCambio = { texto ->
                borrador = borrador.copy(cargaHoraria = texto.toDoubleOrNull() ?: 0.0)
            },
            tipoTeclado = KeyboardType.Decimal,
        )
        Spacer(Modifier.height(8.dp))
        CampoTexto(
            etiqueta = "Correo electrónico",
            valor = borrador.correo,
            onCambio = { borrador = borrador.copy(correo = it) },
            tipoTeclado = KeyboardType.Email,
        )
        Spacer(Modifier.height(8.dp))
        CampoTexto(
            etiqueta = "Teléfono",
            valor = borrador.telefono,
            onCambio = { borrador = borrador.copy(telefono = it) },
            tipoTeclado = KeyboardType.Phone,
        )
        Spacer(Modifier.height(8.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Profesor activo", modifier = Modifier.weight(1f))
            Switch(
                checked = borrador.activo,
                onCheckedChange = { borrador = borrador.copy(activo = it) },
            )
        }

        Spacer(Modifier.height(18.dp))
        Button(
            onClick = {
                val nuevos = mutableMapOf<String, String>()
                if (borrador.nombre.isBlank()) nuevos["nombre"] = "Escriba el nombre completo."
                if (borrador.noTrabajador.isBlank()) nuevos["noTrabajador"] = "Obligatorio."
                if (borrador.ci.length < 6) nuevos["ci"] = "Use al menos 6 dígitos."
                errores = nuevos
                if (nuevos.isEmpty()) onGuardar(borrador)
            },
            modifier = Modifier.fillMaxWidth().height(48.dp),
        ) {
            Text("Guardar profesor")
        }
        if (profesor != null) {
            Spacer(Modifier.height(8.dp))
            OutlinedButton(
                onClick = { onEliminar(profesor) },
                modifier = Modifier.fillMaxWidth().height(46.dp),
            ) {
                Icon(Icons.Filled.Delete, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.size(8.dp))
                Text("Eliminar profesor", color = MaterialTheme.colorScheme.error)
            }
        }
        Spacer(Modifier.height(10.dp))
        TextButton(onClick = onCancelar, modifier = Modifier.fillMaxWidth()) {
            Text("Cancelar")
        }
        Spacer(Modifier.height(20.dp))
    }
}
