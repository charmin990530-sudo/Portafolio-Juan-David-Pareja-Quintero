# Portafolio de Juan David · Laptop Dive

## Punto de guardado

El rediseño personaliza el brief Haldoren con la identidad de Juan David Pareja Quintero. El perfil de GitHub es charmin990530-sudo. La portada incorpora el rostro de assets/img/perfil.jpg, la gorra, la chaqueta negra, la camisa blanca, la corbata vinotinto, el teléfono y la laptop.

El borrador del nuevo index, el estudio fotográfico, el personaje transparente, las tres tipografías WOFF2, la respuesta pública de GitHub y las tres parejas de póster y video están guardados en .laptop-work. El archivo media/manifest.json documenta el origen de las capturas.

Los repositorios verificados son Jers (By Jers), Construmax y portafolio-maquillaje-paula. La URL de la demo de Paula devuelve 404. Se capturó su frontend local y se conserva el enlace a GitHub.

## Versión local verificada · 18 de noviembre de 2026

La entrada del portafolio es `index.html`. Incluye el retrato, la credencial, las fuentes, la transición y las tres parejas de póster y video. El clip de la laptop comienza en el segundo 2,75 del original y la vista de proyectos usa su último fotograma como fondo. El borrador de esa versión se conserva en `.laptop-work/index.template.html`.

Se comprobó en Chromium la ida y vuelta entre el estudio y los tres proyectos, la navegación con teclado, rueda y gesto táctil, y el diálogo de contacto. Con movimiento reducido se muestran los pósteres. Se verificó la disposición a 320 × 568, 390 × 844, 844 × 390 y 1440 × 900, y el catálogo integrado con la consulta a GitHub bloqueada.

## Edición del portafolio modular

La fuente activa está en `src/laptop`. La estructura de la página se edita en `index.template.html`, los estilos en `styles/` y el catálogo en `js/projects.js`. El módulo `js/main.js` inicia el recorrido. Los controles, las transiciones y la consulta a GitHub tienen sus propios módulos. Los recursos binarios originales siguen en `.laptop-work/` y la foto de la credencial en `assets/img/perfil.jpg`.

Desde la raíz, ejecuta `npm --prefix src/laptop ci` para instalar la herramienta de compilación y `npm --prefix src/laptop run build` para regenerar `index.html`. El HTML generado incluye las fuentes y todos los medios y se puede abrir directamente en un navegador.
