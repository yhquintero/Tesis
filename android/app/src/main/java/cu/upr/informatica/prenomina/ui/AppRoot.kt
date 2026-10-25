package cu.upr.informatica.prenomina.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.activity.compose.BackHandler
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Payments
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import cu.upr.informatica.prenomina.AppContainer
import cu.upr.informatica.prenomina.ui.pantallas.AjustesScreen
import cu.upr.informatica.prenomina.ui.pantallas.ContratosScreen
import cu.upr.informatica.prenomina.ui.pantallas.LoginScreen
import cu.upr.informatica.prenomina.ui.pantallas.PagosScreen
import cu.upr.informatica.prenomina.ui.pantallas.PanelScreen
import cu.upr.informatica.prenomina.ui.pantallas.ProfesoresScreen

private enum class Seccion(val titulo: String, val icono: ImageVector) {
    PANEL("Panel", Icons.Filled.Dashboard),
    PROFESORES("Profesores", Icons.Filled.Groups),
    CONTRATOS("Contratos", Icons.Filled.Description),
    PAGOS("Pagos", Icons.Filled.Payments),
    AJUSTES("Ajustes", Icons.Filled.Settings),
}

@Composable
fun AppRoot(container: AppContainer) {
    val vm: AppViewModel = viewModel(factory = AppViewModel.Factory(container))
    val estado by vm.estado.collectAsState()
    val sesion = estado.sesion

    when {
        sesion == null -> {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        }

        !sesion.autenticado -> LoginScreen(vm = vm, estado = estado)

        else -> MainScaffold(vm = vm, estado = estado)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MainScaffold(vm: AppViewModel, estado: EstadoApp) {
    var seccion by rememberSaveable { mutableStateOf(Seccion.PANEL.name) }
    val actual = runCatching { Seccion.valueOf(seccion) }.getOrDefault(Seccion.PANEL)
    val snackbar = remember { SnackbarHostState() }

    BackHandler(enabled = actual != Seccion.PANEL) {
        seccion = Seccion.PANEL.name
    }

    LaunchedEffect(estado.mensaje) {
        val mensaje = estado.mensaje
        if (!mensaje.isNullOrBlank()) {
            snackbar.showSnackbar(mensaje)
            vm.limpiarMensaje()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = when (actual) {
                            Seccion.PANEL -> "Panel de control"
                            Seccion.PROFESORES -> "Profesores"
                            Seccion.CONTRATOS -> "Contratos"
                            Seccion.PAGOS -> "Pagos por sobrecarga"
                            Seccion.AJUSTES -> "Ajustes"
                        },
                    )
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary,
                    actionIconContentColor = MaterialTheme.colorScheme.onPrimary,
                ),
                actions = {
                    if (!estado.modoLocal) {
                        IconButton(onClick = vm::sincronizar) {
                            Icon(Icons.Filled.Sync, contentDescription = "Sincronizar")
                        }
                    }
                },
            )
        },
        bottomBar = {
            NavigationBar {
                Seccion.entries.forEach { item ->
                    NavigationBarItem(
                        selected = actual == item,
                        onClick = { seccion = item.name },
                        icon = { Icon(item.icono, contentDescription = item.titulo) },
                        label = { Text(item.titulo) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = MaterialTheme.colorScheme.onPrimaryContainer,
                            selectedTextColor = MaterialTheme.colorScheme.onPrimaryContainer,
                            indicatorColor = MaterialTheme.colorScheme.primaryContainer,
                        ),
                    )
                }
            }
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { relleno ->
        Box(Modifier.fillMaxSize().padding(relleno)) {
            when (actual) {
                Seccion.PANEL -> PanelScreen(estado)
                Seccion.PROFESORES -> ProfesoresScreen(vm, estado)
                Seccion.CONTRATOS -> ContratosScreen(vm, estado)
                Seccion.PAGOS -> PagosScreen(vm, estado)
                Seccion.AJUSTES -> AjustesScreen(vm, estado)
            }
            if (estado.cargando) {
                LinearProgressIndicator(
                    modifier = Modifier.align(Alignment.TopCenter).fillMaxWidth(),
                )
            }
        }
    }
}
