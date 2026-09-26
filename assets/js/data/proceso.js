/**
 * data/proceso.js — Cómo trabajo, paso a paso.
 *
 * Alimenta el scrollytelling de la sección "Proceso". Cada etapa ilumina
 * un nodo del diagrama y trae su propio detalle, para que la sección
 * cuente algo en lugar de ser solo decoración.
 */

export const PROCESO = [
  {
    id: 'descubrimiento',
    color: 'var(--accent)',
    indice: '01',
    nodo: 'Problema',
    titulo: 'Descubrimiento',
    claim: 'Antes de escribir una línea, entiendo qué está roto.',
    descripcion:
      'Casi ningún proyecto falla por el código: falla por no haber definido bien el problema. Me siento con quien lo pide, pregunto lo incómodo y salgo con un alcance realista y un plazo que sí se cumple.',
    puntos: [
      'Requisitos, usuarios y restricciones reales',
      'Auditoría del sitio o sistema actual, si ya existe',
      'Definir qué se mide como éxito, en números',
    ],
  },
  {
    id: 'diseno',
    color: 'var(--accent-2)',
    indice: '02',
    nodo: 'Diseño',
    titulo: 'Diseño',
    claim: 'La arquitectura se decide antes de abrir el editor.',
    descripcion:
      'Decido el stack, la estructura de datos y el flujo de navegación antes de maquetar. También fijo el sistema visual: escala tipográfica, escala de espaciado y paleta. Todo eso vive en variables CSS para que cambiar de tema o de marca sea editar una línea.',
    puntos: [
      'Flujo de navegación y estructura de la interfaz',
      'Sistema de diseño con tokens: color, tipografía, espacio',
      'Elección de stack según el problema, no por costumbre',
    ],
  },
  {
    id: 'maquetacion',
    color: 'var(--accent-3)',
    indice: '03',
    nodo: 'Estructura',
    titulo: 'Maquetación',
    claim: 'HTML que se lee bien y CSS que no se rompe.',
    descripcion:
      'HTML semántico, accesible y con metadatos correctos. CSS propio con Grid, Flexbox y variables: sin dependencias, sin parches y con un presupuesto de peso que se pueda medir. Si no necesita una librería, no lleva una.',
    puntos: [
      'HTML semántico, foco visible y navegación por teclado',
      'CSS modular: Grid, Flexbox, variables y capas',
      'Responsive real, probado en móvil, tableta y escritorio',
    ],
  },
  {
    id: 'desarrollo',
    color: 'var(--accent)',
    indice: '04',
    nodo: 'Lógica',
    titulo: 'Desarrollo',
    claim: 'La lógica va en módulos, no en un archivo de 800 líneas.',
    descripcion:
      'JavaScript en módulos ES, sin variables globales ni acoplamiento. Angular para la interfaz cuando el proyecto lo pide; Node.js y Express para la API, con MongoDB y un modelo de datos pensado desde el principio. Cada capa hace una cosa.',
    puntos: [
      'JavaScript modular: funciones puras y un solo bucle de animación',
      'APIs REST con Express: validación, errores y autenticación',
      'MongoDB y Mongoose con índices y esquemas pensados',
    ],
  },
  {
    id: 'entrega',
    color: 'var(--lime)',
    indice: '05',
    nodo: 'Entrega',
    titulo: 'Entrega',
    claim: 'Un sitio rápido, accesible y que se pueda mantener sin mí.',
    descripcion:
      'Pruebo antes de dar por terminado: Lighthouse, teclado, lector de pantalla y dispositivos modestos. Entrego el código documentado y explicado: cómo se despliega y cómo se mantiene. Después, si hace falta, se sigue mejorando.',
    puntos: [
      'Rendimiento, accesibilidad y peso bajo control',
      'Código documentado y despliegue reproducible',
      'Soporte y mejora continua después de la entrega',
    ],
  },
];

export const TOTAL_ETAPAS = PROCESO.length;
