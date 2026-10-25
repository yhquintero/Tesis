import { api } from '../api.js';
import { aviso, campo, h, icono, modal, toast } from '../ui.js';

export function renderLogin(raiz, { onEntrar }) {
  const error = h('div');
  const boton = h(
    'button',
    { class: 'btn', type: 'submit', estilo: { width: '100%' } },
    'Iniciar sesión',
  );
  const correo = campo({
    etiqueta: 'Correo electrónico',
    nombre: 'email',
    tipo: 'email',
    requerido: true,
    placeholder: 'usuario@upr.edu.cu',
  });
  const clave = campo({
    etiqueta: 'Contraseña',
    nombre: 'password',
    tipo: 'password',
    requerido: true,
    placeholder: '••••••••',
  });
  correo.control.autocomplete = 'username';
  clave.control.autocomplete = 'current-password';
  const verClave = h(
    'button',
    {
      class: 'icono-btn',
      type: 'button',
      'aria-label': 'Mostrar contraseña',
      html: icono('ojo'),
      estilo: { position: 'absolute', right: '6px', top: '24px' },
    },
  );
  verClave.addEventListener('click', () => {
    const control = clave.control;
    const mostrar = control.type === 'password';
    control.type = mostrar ? 'text' : 'password';
    verClave.setAttribute('aria-label', mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña');
  });
  clave.style.position = 'relative';
  clave.append(verClave);

  const formulario = h(
    'form',
    {
      novalidate: true,
      on: {
        submit: async (evento) => {
          evento.preventDefault();
          error.replaceChildren();
          if (!correo.control.value.trim() || !clave.control.value) {
            error.append(aviso('Escriba su correo y contraseña.', 'error'));
            return;
          }
          boton.disabled = true;
          boton.textContent = 'Entrando…';
          try {
            await onEntrar(correo.control.value.trim(), clave.control.value);
          } catch (fallo) {
            error.replaceChildren(aviso(fallo.message || 'No se pudo iniciar sesión.', 'error'));
            boton.disabled = false;
            boton.textContent = 'Iniciar sesión';
          }
        },
      },
    },
    correo,
    clave,
    error,
    boton,
  );

  const abrirRegistro = () => {
    const nombre = campo({ etiqueta: 'Nombre y apellidos', nombre: 'nombre', requerido: true });
    const email = campo({ etiqueta: 'Correo electrónico', nombre: 'email', tipo: 'email', requerido: true });
    const rol = campo({
      etiqueta: 'Rol solicitado',
      nombre: 'rol',
      valor: 'determinado',
      opciones: [
        { valor: 'determinado', etiqueta: 'Determinado (contratos)' },
        { valor: 'sobrecarga', etiqueta: 'Sobrecarga (pagos)' },
      ],
    });
    const pass = campo({
      etiqueta: 'Contraseña',
      nombre: 'password',
      tipo: 'password',
      requerido: true,
      ayuda: 'Mínimo 8 caracteres, con letras, números y un símbolo.',
    });
    const repetir = campo({
      etiqueta: 'Repetir contraseña',
      nombre: 'repetir',
      tipo: 'password',
      requerido: true,
    });
    const mensaje = h('div');
    const dialogo = modal({
      titulo: 'Solicitar cuenta',
      contenido: h(
        'form',
        {
          id: 'form-registro',
          on: {
            submit: async (evento) => {
              evento.preventDefault();
              mensaje.replaceChildren();
              if (pass.control.value !== repetir.control.value) {
                mensaje.append(aviso('Las contraseñas no coinciden.', 'error'));
                return;
              }
              try {
                await api.registro({
                  nombre: nombre.control.value,
                  email: email.control.value,
                  password: pass.control.value,
                  rol: rol.control.value,
                });
                dialogo.cerrar();
                toast(
                  'Solicitud enviada. Un administrador debe aprobar la cuenta antes del primer acceso.',
                  'exito',
                  6000,
                );
              } catch (fallo) {
                mensaje.append(aviso(fallo.message, 'error'));
              }
            },
          },
        },
        nombre,
        email,
        rol,
        pass,
        repetir,
        mensaje,
      ),
      pie: [
        h('button', { class: 'btn secundario', type: 'button', on: { click: () => dialogo.cerrar() } }, 'Cancelar'),
        h('button', { class: 'btn', type: 'submit', form: 'form-registro' }, 'Enviar solicitud'),
      ],
    });
  };

  const abrirRecuperacion = () => {
    const email = campo({ etiqueta: 'Correo de la cuenta', nombre: 'email', tipo: 'email', requerido: true });
    const mensaje = h('div');
    const dialogo = modal({
      titulo: 'Recuperar contraseña',
      contenido: h(
        'div',
        {},
        h(
          'p',
          {},
          'El sistema es local y no envía correos. La solicitud queda registrada para que el administrador del departamento le entregue una clave temporal.',
        ),
        h(
          'form',
          {
            id: 'form-recuperar',
            on: {
              submit: async (evento) => {
                evento.preventDefault();
                try {
                  const respuesta = await api.recuperar(email.control.value);
                  mensaje.replaceChildren(aviso(respuesta.mensaje || 'Solicitud registrada.', 'info'));
                } catch (fallo) {
                  mensaje.replaceChildren(aviso(fallo.message, 'error'));
                }
              },
            },
          },
          email,
          mensaje,
        ),
      ),
      pie: [
        h('button', { class: 'btn secundario', type: 'button', on: { click: () => dialogo.cerrar() } }, 'Cerrar'),
        h('button', { class: 'btn', type: 'submit', form: 'form-recuperar' }, 'Solicitar'),
      ],
    });
  };

  raiz.replaceChildren(
    h(
      'div',
      { class: 'login' },
      h(
        'div',
        { class: 'login-tarjeta' },
        h(
          'div',
          { class: 'marca' },
          h('div', { class: 'marca-logo', html: icono('grupos') }),
          h('h1', {}, 'Prenómina UPR'),
          h('p', {}, 'Contratos determinados y pagos por sobrecarga docente · Departamento de Informática'),
        ),
        formulario,
        h(
          'div',
          { class: 'login-acciones' },
          h(
            'div',
            { class: 'login-pie' },
            h('span', {}, 'Sistema local · Universidad de Pinar del Río'),
            h(
              'div',
              { class: 'enlaces' },
              h('button', { type: 'button', on: { click: abrirRecuperacion } }, '¿Olvidó su contraseña?'),
              h('button', { type: 'button', on: { click: abrirRegistro } }, 'Solicitar cuenta'),
            ),
          ),
        ),
      ),
    ),
  );
  correo.control.focus();
}
