package cu.upr.informatica.prenomina.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val EsquemaClaro = lightColorScheme(
    primary = VerdeInstitucional,
    onPrimary = Color.White,
    primaryContainer = VerdeContenedorClaro,
    onPrimaryContainer = Color(0xFF08280B),
    secondary = VerdeInstitucionalClaro,
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFDCEBDD),
    onSecondaryContainer = Color(0xFF08280B),
    tertiary = DoradoInstitucional,
    onTertiary = Color(0xFF241C00),
    tertiaryContainer = Color(0xFFF6E8B8),
    onTertiaryContainer = Color(0xFF241C00),
    background = VerdeSuperficieClaro,
    onBackground = Color(0xFF1A1C18),
    surface = Color.White,
    onSurface = Color(0xFF1A1C18),
    surfaceVariant = Color(0xFFE3E8DF),
    onSurfaceVariant = Color(0xFF43483F),
    outline = Color(0xFF74796E),
    error = RojoError,
    onError = Color.White,
)

private val EsquemaOscuro = darkColorScheme(
    primary = Color(0xFF2E7D32),
    onPrimary = Color.White,
    primaryContainer = Color(0xFF14521B),
    onPrimaryContainer = Color(0xFFB8F0B8),
    secondary = Color(0xFFA5D6A7),
    onSecondary = Color(0xFF113513),
    secondaryContainer = Color(0xFF2B4E2D),
    onSecondaryContainer = Color(0xFFC2EBC3),
    tertiary = DoradoNocturno,
    onTertiary = Color(0xFF3E2E00),
    tertiaryContainer = Color(0xFF5A4600),
    onTertiaryContainer = Color(0xFFFFDF92),
    background = Color(0xFF111410),
    onBackground = Color(0xFFE2E3DB),
    surface = Color(0xFF181B17),
    onSurface = Color(0xFFE2E3DB),
    surfaceVariant = Color(0xFF43483F),
    onSurfaceVariant = Color(0xFFC3C8BC),
    outline = Color(0xFF8D9287),
    error = Color(0xFFF2B8B5),
    onError = Color(0xFF601410),
)

@Composable
fun PrenominaTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val scheme = if (darkTheme) EsquemaOscuro else EsquemaClaro
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = VerdeInstitucional.toArgb()
            window.navigationBarColor = scheme.surface.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = false
        }
    }
    MaterialTheme(
        colorScheme = scheme,
        typography = TipografiaPrenomina,
        content = content,
    )
}
