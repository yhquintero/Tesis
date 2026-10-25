package cu.upr.informatica.prenomina.util

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities

/** Comprueba si hay una red disponible antes de intentar sincronizar. */
fun hayRed(context: Context): Boolean {
    val gestor = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
        ?: return true
    val red = gestor.activeNetwork ?: return false
    val capacidades = gestor.getNetworkCapabilities(red) ?: return false
    return capacidades.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) ||
        capacidades.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ||
        capacidades.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) ||
        capacidades.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)
}
