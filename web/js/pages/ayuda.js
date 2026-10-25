import { api } from '../api.js';
import { aviso, h, icono } from '../ui.js';
import { sesion } from '../sesion.js';

export async function renderAyuda(raiz) {
  let salud = null;
  try {
    salud = await api.salud();
  } catch {
    salud = null;
  }
  const config = sesion.configuracion || {};

  raiz.replaceChildren(
    h(
      'div',
      { class: 'rejilla' },
      h(
        'div',
        { class: 'tarjeta' },
        h('h2', {}, 'Guía rápida'),
        h(
          'ol',
          { estilo: { paddingLeft: '20px', margin: 0, display: 'grid', gap: '6px' } },
          h('li', {}, 'Registre a los profesores con su categoría docente, carga base y datos de contacto.'),
          h('li', {}, 'Cree el contrato determinado o por sobrecarga; el importe se calcula con la tarifa vigente.'),
          h('li', {}, 'Envíe el contrato a aprobación. Solo un administrador puede aprobarlo o rechazarlo.'),
          h('li', {}, 'Al activar el contrato se genera el pago pendiente con límite de 30 días.'),
          h('li', {}, 'Apruebe y marque el pago como pagado; exporte la liquidación en Excel o PDF.'),
          h('li', {}, 'Use la prenómina para registrar horas por corte y generar los contratos del período.'),
        ),
      ),
      h(
        'div',
        { class: 'tarjeta' },
        h('h2', {}, 'Reglas que aplica el sistema'),
        h(
          'ul',
          { class: 'lista-limpia' },
          ...[
            'Solo los usuarios autenticados y aprobados acceden al sistema.',
            'Solo un administrador crea, aprueba o modifica cuentas de usuario.',
            'Los contratos deben aprobarse antes de activarse.',
            'Los pagos solo se generan para contratos activos o completados.',
            'El pago por sobrecarga se calcula con la carga base y las horas adicionales.',
            'Un contrato no puede exceder los 12 meses.',
            'El pago debe procesarse dentro de los 30 días posteriores al fin del contrato.',
            'Las cláusulas variables se guardan con cada contrato.',
          ].map((texto) => h('li', { class: 'fila-dato', estilo: { display: 'block' } }, texto)),
        ),
      ),
      h(
        'div',
        { class: 'tarjeta' },
        h('h2', {}, 'Soporte técnico'),
        h(
          'dl',
          { estilo: { margin: 0 } },
          ...[
            ['Institución', config.nombre_institucion || 'Universidad de Pinar del Río'],
            ['Departamento', config.departamento || 'Departamento de Informática'],
            ['Correo', config.correo_soporte || 'soporte@upr.edu.cu'],
            ['Teléfono', config.telefono_soporte || '+53 48 75 0000'],
          ].map(([etiqueta, valor]) =>
            h('div', { class: 'fila-dato' }, h('dt', {}, etiqueta), h('dd', {}, valor)),
          ),
        ),
      ),
      h(
        'div',
        { class: 'tarjeta' },
        h('h2', {}, 'Estado del sistema'),
        salud
          ? h(
              'div',
              {},
              h('p', { class: 'fila-dato' }, h('dt', {}, 'Servidor local'), h('dd', {}, `En línea · versión ${salud.version}`)),
              h('p', { class: 'fila-dato' }, h('dt', {}, 'Base de datos'), h('dd', {}, salud.baseDatos === 'ok' ? 'Operativa' : 'Con problemas')),
              h('p', { class: 'fila-dato' }, h('dt', {}, 'Hora del servidor'), h('dd', {}, new Date(salud.hora).toLocaleString('es-CU'))),
            )
          : aviso('No se pudo consultar el estado del servidor local.', 'error'),
        h(
          'div',
          { class: 'acciones-fila', estilo: { marginTop: '10px' } },
          h('a', { class: 'btn secundario', href: '#/panel' }, 'Volver al panel'),
          h(
            'a',
            { class: 'btn secundario', href: '/docs/manual-usuario.md', target: '_blank', rel: 'noopener' },
            'Manual de usuario',
          ),
        ),
      ),
      h(
        'div',
        { class: 'tarjeta' },
        h('h2', {}, 'Aplicación Android'),
        h(
          'p',
          {},
          'La app Android en Kotlin guarda los datos en Room y sincroniza con este servidor cuando hay red. ' +
            'Puede instalarse desde el APK generado en el proyecto (android/app/build/outputs/apk/debug/) o entrar en modo local de demostración sin servidor.',
        ),
      ),
    ),
  );
}
