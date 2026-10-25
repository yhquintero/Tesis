package cu.upr.informatica.prenomina.ui.pantallas

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.NotificationsActive
import androidx.compose.material.icons.filled.Payments
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import cu.upr.informatica.prenomina.domain.EstadosContrato
import cu.upr.informatica.prenomina.domain.EstadosPago
import cu.upr.informatica.prenomina.domain.TiposContrato
import cu.upr.informatica.prenomina.ui.EstadoApp
import cu.upr.informatica.prenomina.ui.colorEstado
import cu.upr.informatica.prenomina.ui.componentes.BarraProgreso
import cu.upr.informatica.prenomina.ui.componentes.ChipEstado
import cu.upr.informatica.prenomina.ui.componentes.TarjetaMetrica
import cu.upr.informatica.prenomina.ui.dinero
import cu.upr.informatica.prenomina.ui.fechaCorta
import cu.upr.informatica.prenomina.ui.fondoEstado
import cu.upr.informatica.prenomina.ui.rolEtiqueta

@Composable
fun PanelScreen(estado: EstadoApp) {
    val datos = estado.dashboard
    val sesion = estado.sesion

    LazyColumn(
        modifier = Modifier.fillMaxWidth(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primary),
            ) {
                Column(Modifier.padding(16.dp)) {
                    Text(
                        text = "Hola, ${sesion?.nombreUsuario?.ifBlank { "usuario" } ?: "usuario"}",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onPrimary,
                    )
                    Text(
                        text = "${rolEtiqueta(sesion?.rol.orEmpty())} · " +
                            if (estado.modoLocal) "Modo local (sin servidor)" else "Servidor conectado",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.85f),
                    )
                    if (estado.pendientes > 0) {
                        Spacer(Modifier.height(6.dp))
                        Text(
                            text = "${estado.pendientes} cambio(s) pendiente(s) de sincronizar",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.tertiaryContainer,
                        )
                    }
                }
            }
        }

        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                TarjetaMetrica(
                    icono = Icons.Filled.Groups,
                    titulo = "Profesores activos",
                    valor = "${datos.profesoresActivos}",
                    detalle = "de ${datos.profesoresTotales} registrados",
                    modifier = Modifier.weight(1f),
                )
                TarjetaMetrica(
                    icono = Icons.Filled.Description,
                    titulo = "Contratos activos",
                    valor = "${datos.contratosActivos}",
                    detalle = "${datos.contratosTotales} en total",
                    modifier = Modifier.weight(1f),
                )
            }
        }

        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                TarjetaMetrica(
                    icono = Icons.Filled.Payments,
                    titulo = "Pagos pendientes",
                    valor = "${datos.pagosPendientes}",
                    detalle = dinero(datos.importePendiente),
                    modifier = Modifier.weight(1f),
                )
                TarjetaMetrica(
                    icono = Icons.Filled.NotificationsActive,
                    titulo = "Pagos vencidos",
                    valor = "${datos.pagosVencidos}",
                    detalle = "requieren atención",
                    modifier = Modifier.weight(1f),
                )
            }
        }

        if (datos.contratosPorEstado.any { it.value > 0 }) {
            item {
                Card {
                    Column(Modifier.padding(14.dp)) {
                        Text(
                            text = "Contratos por estado",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Spacer(Modifier.height(8.dp))
                        val maximo = (datos.contratosPorEstado.values.maxOrNull() ?: 1).toDouble()
                        EstadosContrato.TODOS.forEach { clave ->
                            val cantidad = datos.contratosPorEstado[clave] ?: 0
                            if (cantidad > 0) {
                                BarraProgreso(
                                    etiqueta = EstadosContrato.etiqueta(clave),
                                    valor = cantidad.toDouble(),
                                    maximo = maximo,
                                    detalle = "$cantidad",
                                    color = colorEstado(clave),
                                )
                            }
                        }
                    }
                }
            }
        }

        if (datos.horasPorCategoria.isNotEmpty()) {
            item {
                Card {
                    Column(Modifier.padding(14.dp)) {
                        Text(
                            text = "Horas por categoría docente",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Spacer(Modifier.height(8.dp))
                        val maximo = (datos.horasPorCategoria.maxOfOrNull { it.horas } ?: 1.0)
                        datos.horasPorCategoria.forEach { fila ->
                            BarraProgreso(
                                etiqueta = fila.categoria,
                                valor = fila.horas,
                                maximo = maximo,
                                detalle = "${fila.horas.toInt()} h · ${fila.contratos} contratos",
                            )
                        }
                    }
                }
            }
        }

        item {
            Text(
                text = "Contratos recientes",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(top = 4.dp),
            )
        }

        if (datos.contratosRecientes.isEmpty()) {
            item {
                Text(
                    text = "Todavía no hay contratos registrados.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        } else {
            items(datos.contratosRecientes) { detalle ->
                Card {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text(
                                text = detalle.contrato.codigo,
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.SemiBold,
                            )
                            Text(
                                text = "${detalle.nombreProfesor} · ${TiposContrato.etiquetaCorta(detalle.contrato.tipo)}",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                        ChipEstado(
                            texto = EstadosContrato.etiqueta(detalle.contrato.estado),
                            color = colorEstado(detalle.contrato.estado),
                            fondo = fondoEstado(detalle.contrato.estado),
                        )
                    }
                }
            }
        }

        if (datos.pagosPendientesLista.isNotEmpty()) {
            item {
                Text(
                    text = "Pagos por atender",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
            items(datos.pagosPendientesLista) { detalle ->
                Card {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(
                            imageVector = Icons.Filled.Payments,
                            contentDescription = null,
                            tint = colorEstado(detalle.pago.estado),
                            modifier = Modifier.size(22.dp),
                        )
                        Column(Modifier.weight(1f).padding(start = 10.dp)) {
                            Text(
                                text = "${detalle.codigoContrato} · ${detalle.nombreProfesor}",
                                style = MaterialTheme.typography.bodyMedium,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                            Text(
                                text = "Límite ${fechaCorta(detalle.pago.fechaLimite)} · " +
                                    EstadosPago.etiqueta(detalle.pago.estado),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        Text(
                            text = dinero(detalle.pago.importe),
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                }
            }
        }

        item { Spacer(Modifier.height(8.dp)) }
    }
}
