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
  // Fresnel clasico: 1 en el borde del cuerpo, 0 de frente. Es lo que dibuja
  // el limbo brillante de la atmosfera sin necesidad de una segunda pasada.
  float fresnel(vec3 normal, vec3 vision, float potencia) {
    return pow(1.0 - clamp(dot(normal, vision), 0.0, 1.0), potencia);
  }

  // Difusion en un hemisferio, con un poco de vuelta.
  //
  // ANTES era \`dot * 0.5 + 0.5\`. Eso no da un lado oscuro: da 0.5 de luz en
  // el terminador y NUNCA baja de ahi, asi que media esfera queda igual de
  // iluminada y el lado noche conserva todo el color de la textura.
  //
  // El termino de vuelta es real y sirve: una atmosfera dispersa la luz algo
  // mas alla del terminador. Pero a 0.5 es tanta envoltura que el efecto se
  // come la mitad del planeta. Aqui es 0.18: sigue habiendo un borde
  // suavemente iluminado, que es lo que se ve de verdad.
  //
  // El exponente es lo que da la forma. Sin el, el gradiente es lineal y el
  // planeta se ve como una bola pintada; con el, la luz se concentra en el
  // centro del disco iluminado, que es donde la tiene un sol lejano.
  //
  // NOTA: este cambio se hizo creyendo que arreglaba un disco gris que
  // cruzaba el planeta en la portada, y NO lo arregla: ese disco resulto ser
  // otra cosa, que sigue sin identificar. Ver PENDIENTES.md seccion 9. Lo que
  // si arregla es que el lado noche de verdad este en sombra.
  float difusion(vec3 normal, vec3 luz) {
    float cosAngulo = dot(normal, normalize(luz));
    float envoltura = smoothstep(-0.18, 1.0, cosAngulo);
    return pow(envoltura, 1.6);
  }
`;
