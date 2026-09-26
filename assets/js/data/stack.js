/**
 * data/stack.js — Habilidades agrupadas por área.
 *
 * `nivel` es la autologous honestidad de manejo (0-100).
 * `icono` es un SVG en línea para no depender de librerías externas.
 */

export const STACK = [
  {
    id: 'estructura',
    nombre: 'Estructura y estilo',
    color: 'var(--accent)',
    icono: '<path d="M4 5h16v5H4zM4 14h7v5H4zM15 14h5v5h-5z"/>',
    habilidades: [
      { nombre: 'HTML5', nivel: 100, nota: 'Semántica, accesibilidad y SEO técnico' },
      { nombre: 'CSS3', nivel: 100, nota: 'Grid, Flexbox, custom properties, animaciones' },
      { nombre: 'Sass / arquitectura', nivel: 92, nota: 'Tokens de diseño y sistemas escalables' },
      { nombre: 'Diseño responsive', nivel: 96, nota: 'Mobile first, container queries, RTL' },
      { nombre: 'Accesibilidad (WCAG)', nivel: 88, nota: 'Foco visible, roles, teclado completo' },
      { nombre: 'SVG / Canvas', nivel: 85, nota: 'Ilustración y gráficos en vivo' },
    ],
  },
  {
    id: 'lenguajes',
    nombre: 'Lenguajes',
    color: 'var(--accent-2)',
    icono: '<path d="M8 6 3 12l5 6M16 6l5 6-5 6M13.5 4l-3 16"/>',
    habilidades: [
      { nombre: 'JavaScript (ES2023)', nivel: 85, nota: 'Módulos, async/await, DOM, rendimiento' },
      { nombre: 'TypeScript', nivel: 78, nota: 'Tipado estricto, genéricos, utilidades' },
      { nombre: 'Python', nivel: 70, nota: 'Automatización y scripts de apoyo' },
      { nombre: 'SQL', nivel: 75, nota: 'Consultas, índices, agregaciones' },
    ],
  },
  {
    id: 'backend',
    nombre: 'Backend',
    color: 'var(--accent-3)',
    icono: '<path d="M4 7c0-2 3.6-3.5 8-3.5S20 5 20 7s-3.6 3.5-8 3.5S4 9 4 7zm0 0v10c0 2 3.6 3.5 8 3.5s8-1.5 8-3.5V7M4 12c0 2 3.6 3.5 8 3.5s8-1.5 8-3.5"/>',
    habilidades: [
      { nombre: 'Node.js', nivel: 84, nota: 'APIs REST, middlewares, streaming' },
      { nombre: 'Express', nivel: 86, nota: 'Routers, middleware, validación y errores' },
      { nombre: 'Angular', nivel: 76, nota: 'Componentes, señales, RxJS, rutas' },
      { nombre: 'MongoDB + Mongoose', nivel: 80, nota: 'Modelado, índices, agregaciones' },
      { nombre: 'APIs REST', nivel: 88, nota: 'Versionado, códigos de estado, idempotencia' },
      { nombre: 'Autenticación JWT', nivel: 78, nota: 'Sesiones, bcrypt, refresh tokens' },
    ],
  },
  {
    id: 'herramientas',
    nombre: 'Herramientas',
    color: 'var(--lime)',
    icono: '<path d="M14.7 6.3a4 4 0 0 1-5.4 5.4L4 17v3h3l5.3-5.3a4 4 0 0 1 5.4-5.4l-2.6 2.6 1.4 1.4z"/>',
    habilidades: [
      { nombre: 'Git & GitHub', nivel: 90, nota: 'Flujo por ramas, PRs, resolución de conflictos' },
      { nombre: 'npm / pnpm', nivel: 88, nota: 'Árbol de dependencias y scripts' },
      { nombre: 'Postman / Insomnia', nivel: 85, nota: 'Colecciones, variables, pruebas' },
      { nombre: 'Docker (básico)', nivel: 65, nota: 'Contenedores y Docker Compose' },
      { nombre: 'Figma', nivel: 72, nota: 'Sistemas de diseño y prototipado' },
    ],
  },
];

export const TOTAL_HABILIDADES = STACK.reduce((total, grupo) => total + grupo.habilidades.length, 0);
