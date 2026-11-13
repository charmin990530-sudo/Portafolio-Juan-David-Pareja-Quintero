/** Cielo fotografico equirectangular: Via Lactea sin manchas de neon. */
import { BackSide, Mesh, MeshBasicMaterial, SphereGeometry, SRGBColorSpace, TextureLoader } from '../../../vendor/three/0.186.1/three.module.js';

export function crearCielo({ nivel, radio }) {
  let destruido = false;
  const material = new MeshBasicMaterial({ side: BackSide, transparent: true, opacity: 0,
    depthWrite: false, fog: false, toneMapped: false });
  const geometria = new SphereGeometry(radio, 48, 24);
  const malla = new Mesh(geometria, material);
  malla.renderOrder = -1000;
  malla.rotation.set(0.24, 0.8, -0.38);
  malla.frustumCulled = false;
  let lista = false;
  const tamano = nivel === 'alto' ? '2k' : '1k';
  const textura = new TextureLoader().load(`assets/img/texturas/stars_milky_way-${tamano}.jpg`, (t) => {
    if (destruido) { t.dispose(); return; }
    material.map = t;
    material.needsUpdate = true;
    lista = true;
  }, undefined, () => {
    if (!destruido) console.warn('[universo] cielo fotografico no disponible');
  });
  textura.colorSpace = SRGBColorSpace;
  return {
    malla,
    actualizar(camara, nacimiento) {
      malla.position.copy(camara.position);
      material.opacity = lista ? Math.max(0, Math.min(1, nacimiento)) * 0.6 : 0;
    },
    liberar() { destruido = true; textura.dispose(); material.dispose(); geometria.dispose(); },
  };
}
