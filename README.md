# Portafolio de Juan David — Laptop Dive

Experiencia web personal de Juan David Pareja Quintero, desarrollador web full stack en Bogotá. El portafolio es una **laptop** interactiva construida con HTML, CSS y JavaScript puro: una laptop que presenta el estudio y recorre los proyectos publicados en GitHub.

## Stack

- HTML, CSS y JavaScript moderno (ES modules).
- Sin frameworks ni bundlers de aplicación; el empaquetado se hace con esbuild.
- El catálogo de proyectos se consulta en tiempo real contra la API pública de GitHub (`GET /users/<usuario>/repos`).
- Fuentes, imágenes y videos se incrustan como data-URLs durante el build.

## Desarrollo local

```bash
npm --prefix src/laptop ci
npm --prefix src/laptop run build
```

El comando de build regenera el `index.html` de la raíz a partir de:

- `src/laptop/index.template.html`
- `src/laptop/js/*.js`
- `src/laptop/styles/*.css`
- `.laptop-work/**` (fuentes, fotos, videos y plantillas)

## Estructura

- `index.html`: build final generado (se commitea).
- `src/laptop/`: fuente del portafolio.
- `.laptop-work/`: recursos originales del estudio fotográfico y catálogo.

## Despliegue

- Configuración de despliegue: `vercel.json`, proyecto enlazado en `.vercel/`.
- El sitio se publica como sitio estático.
