/**
 * modules/contacto.js — Formulario de contacto.
 *
 * Validación en el cliente con mensajes en español, envío real a un
 * endpoint de Formspree y, si ese envío falla, apertura del cliente de
 * correo con el mensaje ya redactado. Estados de interfaz claros:
 * reposo → enviando → enviado, y los dos finales posibles.
 *
 * ── POR QUÉ HAY UN RESPALDO ──────────────────────────────────────────
 *
 * Hasta la primera versión de este módulo, `enviar()` era un
 * `setTimeout` que imprimía por consola y devolvía éxito. El formulario
 * decía "Mensaje entregado ✓" y no entregaba nada: se perdían todos los
 * contactos, y el visitante se iba pensando que había escrito.
 *
 * Un endpoint externo puede caerse, estar saturado o estar bloqueado por
 * un bloqueador de anuncios. Por eso hay dos caminos y el segundo
 * COMPLEMENTA al primero en lugar de reemplazarlo: si el envío falla, el
 * mensaje se abre en el cliente de correo del visitante con todo escrito.
 * Puede que no se envíe solo, pero desde luego no se pierde ni se finge.
 *
 * ── CONFIGURAR EL ENDPOINT ───────────────────────────────────────────
 *
 * El endpoint va en `assets/js/data/universo.js`, en `CONTACTO.endpoint`.
 * Está vacío a propósito: mientras siga vacío, el formulario funciona
 * siempre por el camino del correo y no depende de ningún tercero.
 */

import { $, $$ } from '../core/dom.js';
import { mostrarAviso } from './contenido.js';
import { clamp } from '../core/util.js';
import { CONTACTO } from '../data/universo.js';

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

/* Tope de tiempo. Un fetch sin `AbortSignal` puede quedarse colgado
   indefinidamente si la red se cae a medias, y el visitante se queda con
   el botón en "Transmitiendo…" para siempre. 12 s es holgado para un
   envío de texto plano y evita el bloqueo infinito. */
const TIEMPO_ENVIO = 12000;

/**
 * Envía el mensaje al endpoint configurado.
 *
 * @returns {Promise<{ok: boolean, motivo: string}>}
 */
async function enviar(datos) {
  const endpoint = CONTACTO.endpoint?.trim();

  // Sin endpoint: no hay a quién enviar. No es un error todavía; quien
  // decide el destino final es el respaldo de correo.
  if (!endpoint) return { ok: false, motivo: 'sin-endpoint' };

  const control = new AbortController();
  const tictac = setTimeout(() => control.abort(), TIEMPO_ENVIO);

  const cuerpo = new FormData();
  for (const [clave, valor] of Object.entries(datos)) cuerpo.append(clave, valor);
  if (CONTACTO.destinatario) cuerpo.append('_replyto', datos.email);

  try {
    const respuesta = await fetch(endpoint, {
      method: 'POST',
      body: cuerpo,
      signal: control.signal,
      headers: { Accept: 'application/json' },
    });

    if (!respuesta.ok) {
      return { ok: false, motivo: `http-${respuesta.status}` };
    }
    return { ok: true, motivo: 'endpoint' };
  } catch (error) {
    return { ok: false, motivo: error.name === 'AbortError' ? 'timeout' : 'red' };
  } finally {
    clearTimeout(tictac);
  }
}

/** Un texto que le diga al visitante qué ha pasado de verdad. */
function explicar(motivo) {
  if (motivo === 'sin-endpoint') {
    return 'Se abrirá tu programa de correo con el mensaje ya escrito.';
  }
  if (motivo === 'timeout') {
    return 'El envío tardó demasiado. Se abrirá tu correo con el mensaje.';
  }
  if (motivo === 'red') {
    return 'No se pudo conectar. Se abrirá tu correo con el mensaje.';
  }
  if (motivo.startsWith('http-')) {
    // 429 es "demasiados envíos" y 403 "bloqueado", y son cosas distintas
    // que merece la pena distinguir: uno se arregla esperando y el otro
    // desactivando el bloqueador.
    if (motivo === 'http-429') {
      return 'El servicio de envío está saturado. Se abrirá tu correo con el mensaje.';
    }
    if (motivo === 'http-403') {
      return 'Un bloqueador impidió el envío. Se abrirá tu correo con el mensaje.';
    }
    return 'El servicio de envío no respondió. Se abrirá tu correo con el mensaje.';
  }
  return 'No se pudo enviar directamente. Se abrirá tu correo con el mensaje.';
}

/**
 * Abre el cliente de correo con el mensaje ya redactado.
 *
 * Un `mailto:` largo se trunca en algunos clientes y en algunos móviles,
 * así que el cuerpo va en el `body` del enlace y no en una plantilla
 * `subject=`. Se intenta primero con el texto plano y, si el navegador no
 * lo reconoce, se devuelve un objeto que permite al sitio avisar al
 * visitante de que va a tener que escribir a mano.
 */
function abrirCorreo(datos) {
  const asunto = CONTACTO.asunto ?? 'Mensaje desde el portafolio';
  const cuerpo = [
    `${CONTACTO.plantilla?.cabecera ?? ''}`,
    '',
    `Nombre: ${datos.nombre}`,
    `Correo: ${datos.email}`,
    '',
    datos.mensaje,
  ]
    .filter((linea, i) => !(i === 0 && linea === ''))
    .join('\n');

  const enlace = `mailto:${CONTACTO.destinatario}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
  window.location.href = enlace;
  return enlace;
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
      return;
    }

    /* --- El envío directo no funcionó. ---
       Se abre el cliente de correo. El texto se lo dice al visitante con
       claridad, en vez de un "no se pudo enviar" que le deja sin saber
       qué ha pasado ni si su mensaje se ha perdido. */
    const texto = {
      'sin-endpoint': 'Abrriendo tu correo…',
      timeout: 'Se abrirá tu correo',
      red: 'Se abrirá tu correo',
    };
    if (estadoTexto) estadoTexto.textContent = texto[resultado.motivo] ?? 'Se abrirá tu correo';

    abrirCorreo(datos);

    /* El formulario NO se vacía: el mensaje sigue en la caja por si el
       `mailto:` no llega a abrirse. Perderlo sería el peor resultado
       posible de un fallo de red. */
    for (const campo of campos) marcarCampo(campo, '', '');

    mostrarAviso(explicar(resultado.motivo), 7000);
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
