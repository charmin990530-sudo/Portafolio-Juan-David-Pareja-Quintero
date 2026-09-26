/**
 * modules/contacto.js — Formulario de contacto.
 *
 * Validación en el cliente con mensajes en español, envío simulado
 * (no hay backend: el sitio es estático) y estados de interfaz claros:
 * reposo → enviando → enviado. Si algún día se conecta a una API real,
 * solo hay que reemplazar `enviar()`.
 */

import { $, $$ } from '../core/dom.js';
import { mostrarAviso } from './contenido.js';
import { clamp } from '../core/util.js';

const REGLAS = {
  nombre: {
    etiqueta: 'Escribe tu nombre',
    validar: (valor) => valor.trim().length >= 2,
  },
  email: {
    etiqueta: 'Escribe un correo válido',
    validar: (valor) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(valor.trim()),
  },
  mensaje: {
    etiqueta: 'Cuéntame un poco más (mínimo 10 caracteres)',
    validar: (valor) => valor.trim().length >= 10,
  },
};

/** Marcador de posición para un futuro endpoint real. */
function enviar(datos) {
  return new Promise((resolver) => {
    window.setTimeout(() => {
      console.info('[contacto] envío simulado', datos);
      resolver({ ok: true });
    }, 1100);
  });
}

function marcarCampo(campo, estado, mensaje) {
  const contenedor = campo.closest('.campo');
  if (!contenedor) return;

  const error = $('.campo__error', contenedor);
  contenedor.dataset.estado = estado;

  if (error) error.textContent = estado === 'error' ? mensaje : '';
}

export function montarContacto() {
  const formulario = $('#form-contacto');
  if (!formulario) return () => {};

  const boton = $('#form-enviar');
  const estadoTexto = $('#form-estado');
  const campos = $$('[data-campo]', formulario);

  /* ---------- Validación en vivo ---------- */
  for (const campo of campos) {
    campo.addEventListener('blur', () => {
      const regla = REGLAS[campo.dataset.campo];
      if (!regla) return;
      const valor = campo.value;
      if (!valor.trim()) return;
      marcarCampo(campo, regla.validar(valor) ? 'ok' : 'error', regla.etiqueta);
    });

    campo.addEventListener('input', () => {
      const contenedor = campo.closest('.campo');
      if (contenedor?.dataset.estado === 'error') marcarCampo(campo, 'ok', '');
    });
  }

  /* ---------- Envío ---------- */
  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();

    const datos = {};
    let primerError = null;

    for (const campo of campos) {
      const regla = REGLAS[campo.dataset.campo];
      if (!regla) continue;

      const valor = campo.value;
      datos[campo.dataset.campo] = valor.trim();

      if (!regla.validar(valor)) {
        marcarCampo(campo, 'error', regla.etiqueta);
        if (!primerError) primerError = campo;
      } else {
        marcarCampo(campo, 'ok', '');
      }
    }

    if (primerError) {
      primerError.focus();
      mostrarAviso('Revisa los campos marcados antes de enviar.');
      return;
    }

    // Honeypot: si un bot llena el campo oculto, se descarta en silencio.
    if (formulario.elements.trampa?.value) return;

    boton.disabled = true;
    boton.dataset.enviando = '1';
    if (estadoTexto) estadoTexto.textContent = 'Transmitiendo…';

    const resultado = await enviar(datos);

    boton.disabled = false;
    delete boton.dataset.enviando;

    if (resultado.ok) {
      formulario.reset();
      for (const campo of campos) marcarCampo(campo, '', '');
      if (estadoTexto) estadoTexto.textContent = 'Mensaje entregado ✓';
      mostrarAviso(`Gracias, ${datos.nombre.split(' ')[0]}. Responderé en menos de 24 horas.`, 5200);
    } else {
      if (estadoTexto) estadoTexto.textContent = 'No se pudo enviar';
      mostrarAviso('Hubo un problema al enviar. Inténtalo de nuevo.');
    }
  });

  /* ---------- Contador de caracteres ---------- */
  const mensaje = formulario.elements.mensaje;
  const contador = $('#form-contador');

  if (mensaje && contador) {
    const actualizar = () => {
      const largo = clamp(mensaje.value.length, 0, 600);
      contador.textContent = `${largo}/600`;
      contador.dataset.estado = largo >= 600 ? 'limite' : 'ok';
    };
    mensaje.addEventListener('input', actualizar);
    actualizar();
  }

  return () => {};
}
