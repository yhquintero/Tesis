package cu.upr.informatica.prenomina.ui.pantallas

import androidx.compose.foundation.layout.Arrangement
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CloudDone
import androidx.compose.material.icons.filled.DeleteSweep
import androidx.compose.material.icons.filled.HelpOutline
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Restore
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.ui.unit.dp
import cu.upr.informatica.prenomina.ui.AppViewModel
import cu.upr.informatica.prenomina.ui.EstadoApp
import cu.upr.informatica.prenomina.ui.componentes.DialogoConfirmar
import cu.upr.informatica.prenomina.ui.componentes.FilaDato
import cu.upr.informatica.prenomina.ui.componentes.Separador
import cu.upr.informatica.prenomina.ui.rolEtiqueta

@Composable
fun AjustesScreen(vm: AppViewModel, estado: EstadoApp) {
    var ayuda by remember { mutableStateOf(false) }
    var borrar by remember { mutableStateOf(false) }
    var restaurar by remember { mutableStateOf(false) }
    var url by remember(estado.urlServidor) { mutableStateOf(estado.urlServidor) }

    BackHandler(enabled = ayuda) { ayuda = false }

    if (ayuda) {
        AyudaScreen(onCerrar = { ayuda = false })
        return
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Card {
            Column(Modifier.padding(14.dp)) {
                Text("Servidor", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Text(
                    text = if (estado.modoLocal) "Modo local: sin servidor" else "Conexión con Node.js + SQLite",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = url,
                    onValueChange = { url = it },
                    label = { Text("URL del servidor") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(
                        onClick = {
                            vm.cambiarUrl(url)
                            vm.probarConexion()
                        },
                        modifier = Modifier.weight(1f),
                        enabled = !estado.probandoConexion,
                    ) {
                        if (estado.probandoConexion) {
                            CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
                        } else {
                            Icon(Icons.Filled.CloudDone, contentDescription = null, modifier = Modifier.size(18.dp))
                        }
                        Spacer(Modifier.width(6.dp))
                        Text("Probar")
                    }
                    Button(
                        onClick = { vm.guardarServidor(url) },
                        modifier = Modifier.weight(1f),
                    ) { Text("Guardar") }
                }
            }
        }

        Card {
            Column(Modifier.padding(14.dp)) {
                Text("Sesión", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(6.dp))
                FilaDato("Usuario", estado.sesion?.nombreUsuario.orEmpty())
                FilaDato("Correo", estado.sesion?.correoUsuario.orEmpty())
                FilaDato("Rol", rolEtiqueta(estado.sesion?.rol.orEmpty()))
                FilaDato("Modo", if (estado.modoLocal) "Local (demostración)" else "Servidor")
                Separador()
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(
                        onClick = vm::sincronizar,
                        modifier = Modifier.weight(1f),
                        enabled = !estado.modoLocal && !estado.cargando,
                    ) {
                        Icon(Icons.Filled.Sync, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("Sincronizar")
                    }
                    OutlinedButton(
                        onClick = vm::cerrarSesion,
                        modifier = Modifier.weight(1f),
                    ) {
                        Icon(Icons.Filled.Logout, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("Salir")
                    }
                }
                if (estado.pendientes > 0) {
                    Text(
                        text = "${estado.pendientes} operación(es) pendiente(s) de enviar.",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.tertiary,
                        modifier = Modifier.padding(top = 6.dp),
                    )
                }
                if (estado.ultimaSync.isNotBlank()) {
                    Text(
                        text = estado.ultimaSync,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }

        Card {
            Column(Modifier.padding(14.dp)) {
                Text("Datos locales", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Text(
                    text = "La app guarda todo en Room y sincroniza cuando hay red. " +
                        "También puede trabajar sin servidor en modo demostración.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(8.dp))
                OutlinedButton(onClick = { restaurar = true }, modifier = Modifier.fillMaxWidth()) {
                    Icon(Icons.Filled.Restore, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Restaurar datos de demostración")
                }
                Spacer(Modifier.height(6.dp))
                OutlinedButton(onClick = { borrar = true }, modifier = Modifier.fillMaxWidth()) {
                    Icon(Icons.Filled.DeleteSweep, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Borrar todos los datos locales", color = MaterialTheme.colorScheme.error)
                }
            }
        }

        Card {
            Column(Modifier.padding(14.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.Refresh, contentDescription = null, modifier = Modifier.size(20.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Acerca de", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                }
                Spacer(Modifier.height(4.dp))
                Text(
                    text = "Prenómina UPR · versión 1.0.0",
                    style = MaterialTheme.typography.bodySmall,
                )
                Text(
                    text = "Sistema de Gestión de Contratos Determinados y Pagos por Sobrecarga Docente. " +
                        "Departamento de Informática, Universidad de Pinar del Río.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(6.dp))
                TextButton(onClick = { ayuda = true }, modifier = Modifier.fillMaxWidth()) {
                    Icon(Icons.Filled.HelpOutline, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Ayuda y soporte")
                }
            }
        }
        Spacer(Modifier.height(10.dp))
    }

    if (borrar) {
        DialogoConfirmar(
            titulo = "Borrar datos locales",
            mensaje = "Se eliminarán profesores, contratos y pagos guardados en este dispositivo. " +
                "Los datos del servidor no se modifican. ¿Desea continuar?",
            textoConfirmar = "Borrar",
            destructivo = true,
            onConfirmar = {
                vm.borrarDatosLocales()
                borrar = false
            },
            onCancelar = { borrar = false },
        )
    }

    if (restaurar) {
        DialogoConfirmar(
            titulo = "Restaurar demostración",
            mensaje = "Se cargarán 8 profesores y 4 contratos de ejemplo si la base local está vacía.",
            textoConfirmar = "Restaurar",
            onConfirmar = {
                vm.restaurarDemo()
                restaurar = false
            },
            onCancelar = { restaurar = false },
        )
    }
}

@Composable
fun AyudaScreen(onCerrar: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Filled.HelpOutline, contentDescription = null)
            Spacer(Modifier.width(8.dp))
            Text("Ayuda y soporte", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        }
        Spacer(Modifier.height(14.dp))
        Text(
            "Flujo de trabajo",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
        )
        Spacer(Modifier.height(4.dp))
        Text(
            "1. Registre a los profesores con su categoría docente y carga horaria.\n" +
                "2. Cree el contrato determinado o por sobrecarga; el importe se calcula con la tarifa vigente.\n" +
                "3. Envíe el contrato a aprobación y, una vez aprobado, actívelo.\n" +
                "4. Al activarse se genera el pago pendiente; apruébelo y márquelo como pagado.\n" +
                "5. Exporte o consulte el historial desde la web para los reportes oficiales.",
            style = MaterialTheme.typography.bodyMedium,
        )
        Separador()
        Text(
            "Reglas de negocio",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
        )
        Spacer(Modifier.height(4.dp))
        Text(
            "• Los pagos solo se registran para contratos activos o completados.\n" +
                "• La duración máxima de un contrato es de 12 meses.\n" +
                "• El pago debe procesarse dentro de los 30 días posteriores al fin del contrato.\n" +
                "• La aprobación de contratos y pagos fuera de plazo corresponde al administrador.",
            style = MaterialTheme.typography.bodyMedium,
        )
        Separador()
        Text(
            "Soporte técnico",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
        )
        Spacer(Modifier.height(4.dp))
        Text(
            "Departamento de Informática\n" +
                "Universidad de Pinar del Río «Hermanos Saíz Montes de Oca»\n" +
                "Correo: soporte@upr.edu.cu\n" +
                "Teléfono: +53 48 75 0000",
            style = MaterialTheme.typography.bodyMedium,
        )
        Separador()
        Text(
            "Sobre la sincronización",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
        )
        Spacer(Modifier.height(4.dp))
        Text(
            "Los cambios se guardan primero en el teléfono. Si no hay conexión, quedan en cola y " +
                "se envían al servidor en la próxima sincronización.",
            style = MaterialTheme.typography.bodyMedium,
        )
        Spacer(Modifier.height(20.dp))
        Button(onClick = onCerrar, modifier = Modifier.fillMaxWidth()) { Text("Volver") }
    }
}
