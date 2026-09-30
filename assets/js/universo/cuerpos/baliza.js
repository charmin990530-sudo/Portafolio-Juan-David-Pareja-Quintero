/**
 * universo/cuerpos/baliza.js — La baliza de la sección de Contacto.
 *
 * Es el cierre del guion: un mástil con una lámpara que se enciende cuando
 * la cámara llega. Se ilumina en el color `--lime`, que en el sitio ya
 * significa "DISPONIBLE", y el HUD muestra `DISPONIBLE / 24 h` en el mismo
 * instante. El color y el texto dicen lo mismo porque son lo mismo.
 *
 * Coste: un cono, una esfera y dos sprites. Nada de esto justifica un
 * `PointLight` real —una luz dinâmica obliga a recalcular la iluminación de
 * todo lo que la rodea, y aquí no hay nada que ilumine de verdad.
 */

import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  Sprite,
  SpriteMaterial,
  SphereGeometry,
} from '../../../vendor/three/0.186.1/three.module.js';

let cacheLamp = null;

/** Degradado radial para el halo de la lámpara. */
function texturaHalo() {
  if (cacheLamp) return cacheLamp;
  const lado = 64;
  const lienzo = document.createElement('canvas');
  lienzo.width = lado;
  lienzo.height = lado;
  const ctx = lienzo.getContext('2d');
  const g = ctx.createRadialGradient(lado / 2, lado / 2, 0, lado / 2, lado / 2, lado / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.2, 'rgba(255,255,255,0.5)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.12)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, lado, lado);
  cacheLamp = new CanvasTexture(lienzo);
  return cacheLamp;
}

export function liberarTexturasBaliza() {
  cacheLamp?.dispose();
  cacheLamp = null;
}

/**
 * @param {object} o
 * @param {string} o.color      Color de la lámpara (el `--lime` de la marca).
 * @param {number} o.x
 * @param {number} o.y
 * @param {number} o.z
 * @param {number} o.escala
 */
export function crearBaliza({ color = '#7ef2a8', x = 0, y = 0, z = 0, escala = 1 }) {
  const grupo = new Group();
  grupo.position.set(x, y, z);
  grupo.scale.setScalar(escala);

  const tono = new Color(color);

  /* Mástil. `MeshBasicMaterial` sin luz: la baliza es un objeto emisivo y
    darle una luz real solo costaría trabajo para iluminar el vacío. */
  const geoMastil = new CylinderGeometry(0.05, 0.09, 5.2, 6);
  const matMastil = new MeshBasicMaterial({ color: new Color('#1b2438'), toneMapped: false });
  const mastil = new Mesh(geoMastil, matMastil);
  mastil.position.y = 2.6;
  grupo.add(mastil);

  /* Plataforma: da base al mástil y evita que flote en el vacío. */
  const geoBase = new CylinderGeometry(1.1, 1.35, 0.3, 8);
  const matBase = new MeshBasicMaterial({ color: new Color('#141c30'), toneMapped: false });
  const base = new Mesh(geoBase, matBase);
  base.position.y = 0.15;
  grupo.add(base);

  /* Lámpara. */
  const geoLamp = new SphereGeometry(0.34, 12, 10);
  const matLamp = new MeshBasicMaterial({ color: tono.clone(), toneMapped: false, transparent: true, opacity: 0 });
  const lamp = new Mesh(geoLamp, matLamp);
  lamp.position.y = 5.35;
  grupo.add(lamp);

  /* Haz: un cono aditivo que sube desde la lámpara.
     No es un volumen de luz real, es un truco de dos triángulos, pero con
     la opacidad en degradado lee como un haz y cuesta lo que un triángulo. */
  const geoHaz = new ConeGeometry(0.9, 9, 12, 1, true);
  const matHaz = new MeshBasicMaterial({
    color: tono.clone(),
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    side: DoubleSide,
    depthWrite: false,
    toneMapped: false,
  });
  const haz = new Mesh(geoHaz, matHaz);
  haz.position.y = 9.8;
  grupo.add(haz);

  /* Halo alrededor de la lámpara. */
  const halo = new Sprite(
    new SpriteMaterial({
      map: texturaHalo(),
      color: tono.clone(),
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
    }),
  );
  halo.scale.setScalar(4.2);
  halo.position.y = 5.35;
  grupo.add(halo);

  return {
    grupo,

    /**
     * @param {number} entrada  0 = lejos, 1 = llegada.
     * @param {number} encendido  0..1, cuánto está encendida la lámpara.
     * @param {number} segundos
     * @param {object} camara
     */
    actualizar(entrada, encendido, segundos, camara) {
      const e = entrada;
      matLamp.opacity = e * (0.25 + 0.75 * encendido);
      matHaz.opacity = e * encendido * 0.16;
      halo.material.opacity = e * encendido * 0.85;
      halo.quaternion.copy(camara.quaternion);

      // Pulso lento: una baliza real late. El ritmo es deliberadamente
      // lento para que se note sin distraer de la lectura del formulario.
      const pulso = 0.86 + 0.14 * Math.sin(segundos * 1.15);
      halo.scale.setScalar(4.2 * pulso);
      matLamp.color.copy(tono).multiplyScalar(0.4 + 1.4 * encendido * pulso);
    },

    liberar() {
      geoMastil.dispose();
      geoBase.dispose();
      geoLamp.dispose();
      geoHaz.dispose();
      matMastil.dispose();
      matBase.dispose();
      matLamp.dispose();
      matHaz.dispose();
      halo.material.dispose();
    },
  };
}
