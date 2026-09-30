/**
 * universo/shaders/comunes.js — Trozos de GLSL compartidos.
 *
 * Se exportan como cadenas para inyectarlas en los shaders de cada cuerpo.
 * Así el ruido, la mezcla de espacio de color o el estruendo de la atenuación
 * están escritos una sola vez y todos los cuerpos coinciden exactamente, que
 * es lo que hace que el conjunto se vea de la misma familia y no como un
 * collage de efectos.
 *
 * Notación: hash de enteros de Dave Hoskins, dominio público
 * (https://www.shadertoy.com/view/4djSRW). Sin atribución obligatoria, pero
 * se deja la referencia porque es el punto de partida de casi todo el ruido
 * de valor en shaders de fragmento.
 */

/** Hash y ruido de valor 3D. Base de todo lo demás. */
export const RUIDO = /* glsl */ `
  vec3 hash33(vec3 p) {
    p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
             dot(p, vec3(269.5, 183.3, 246.1)),
             dot(p, vec3(113.5, 271.9, 124.6)));
    return fract(sin(p) * 43758.5453123) * 2.0 - 1.0;
  }

  float hash13(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float ruido(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash13(i + vec3(0.0, 0.0, 0.0)), hash13(i + vec3(1.0, 0.0, 0.0)), f.x),
                   mix(hash13(i + vec3(0.0, 1.0, 0.0)), hash13(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
               mix(mix(hash13(i + vec3(0.0, 0.0, 1.0)), hash13(i + vec3(1.0, 0.0, 1.0)), f.x),
                   mix(hash13(i + vec3(0.0, 1.0, 1.0)), hash13(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
  }

  // Suma de octavas. Cuatro es el máximo útil: a partir de ahí la octava
  // más alta aporta menos que el ruido de la propia GPU y solo cuesta.
  float fbm(vec3 p, int octavas) {
    float suma = 0.0;
    float amplitud = 0.5;
    for (int i = 0; i < 6; i++) {
      if (i >= octavas) break;
      suma += amplitud * ruido(p);
      p *= 2.02;
      amplitud *= 0.5;
    }
    return suma;
  }

  // Ruido "turbulento": sale el valor absoluto, así que pliega sobre cero y
  // produce vetas filamentosas. Es lo que da aspecto de gas a un gigante.
  float turbulencia(vec3 p, int octavas) {
    float suma = 0.0;
    float amplitud = 0.5;
    for (int i = 0; i < 6; i++) {
      if (i >= octavas) break;
      suma += amplitud * abs(ruido(p));
      p *= 2.03;
      amplitud *= 0.5;
    }
    return suma;
  }
`;

/**
 * Atenuación y gestión del color de la luz.
 *
 * Se separa de `RUIDO` porque las estrellas no necesitan ruido: incluirlo
 * ahí borraría el compilador pero no el código fuente enviado.
 */
export const LUZ = /* glsl */ `
  // Fresnel clásico: 1 en el borde del cuerpo, 0 de frente. Es lo que dibuja
  // el limbo brillante de la atmósfera sin necesidad de una segunda pasada.
  float fresnel(vec3 normal, vec3 vision, float potencia) {
    return pow(1.0 - clamp(dot(normal, vision), 0.0, 1.0), potencia);
  }

  // Difusión simple en un hemisferio. No es un modelo físico de Rayleigh:
  // es el coste justo para que el lado iluminado y el oscuro se separen
  // con un color distinto sin necesidad de un mapa de environment.
  float difusion(vec3 normal, vec3 luz) {
    return clamp(dot(normal, normalize(luz)) * 0.5 + 0.5, 0.0, 1.0);
  }
`;
