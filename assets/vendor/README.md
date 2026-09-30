# Dependencias vendorizadas

Este sitio **no tiene build step**. No hay `package.json`, ni bundler, ni
`node_modules`. Estas dos librerías están copiadas tal cual desde sus
paquetes npm oficiales y se importan por ruta relativa desde el navegador.

## Por qué vendorizar en vez de usar un CDN

1. El sitio se despliega en Vercel como estático. Un CDN externo añadiría una
   conexión de terceros, una resolución DNS más y una dependencia de
   disponibilidad ajena al despliegue.
2. La ruta incluye la versión, así que los archivos se pueden cachear de forma
   inmutable durante un año sin riesgo: al actualizar Three.js se crea la
   carpeta nueva y se cambia una línea en `assets/js/universo/index.js`.
3. Sin bundler no hay tree-shaking, así que el peso es el del archivo completo.
   Ver la sección 6.3 de `ESTUDIO.md` para el desglose medido.

## three

| | |
|---|---|
| Versión | 0.186.1 (`r186`) |
| Origen | `npm pack three@0.186.1`, carpeta `build/` |
| Licencia | MIT — Copyright © 2010-2026 three.js authors. Copia en `0.186.1/LICENSE` |
| Peso | 131 KB + 286 KB = **417 KB gzip** |
| Por qué | Motor de render WebGL, curvas `CatmullRomCurve3`, materiales con shader, `Points` e `InstancedMesh` |

Archivos necesarios: los dos. `three.module.js` importa `three.core.js` con una
ruta relativa, así que deben convivir en el mismo directorio.

**No se usa WebGPU.** `three.webgpu.js` y `three.tsl.js` no se vendorizan: son
superficiales para este proyecto y duplicarían el peso.

## lenis

| | |
|---|---|
| Versión | 1.3.26 |
| Origen | `npm pack lenis@1.3.26`, carpeta `dist/` |
| Licencia | MIT — Copyright © 2024 darkroom.engineering. Copia en `1.3.26/LICENSE` |
| Peso | **8 KB gzip** |
| Por qué | Suavizado de scroll que expone una **señal de velocidad** fiable, que es lo que alarga las estelas de estrellas, sube el FOV y altera el grano. Además envuelve el scroll nativo, de modo que `position: sticky`, los enlaces ancla y la accesibilidad siguen funcionando |

### CSS de Lenis

El paquete trae un `dist/lenis.css` de 513 bytes. **No se vendoriza como archivo
 aparte**: sus tres reglas útiles están copiadas dentro de
`assets/css/06-universo.css`, en el bloque `/* ---- Lenis ---- */`, para no
añadir una petición de red bloqueante por 513 bytes.

## Cómo actualizar

```bash
cd /tmp && npm pack three@<VERSION> && tar xzf three-<VERSION>.tgz
# copiar build/three.module.js y build/three.core.js + LICENSE
# a assets/vendor/three/<VERSION>/, borrar la versión anterior,
# y actualizar la ruta en assets/js/universo/index.js
```

Repite el proceso con `lenis` si hace falta.
