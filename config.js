/* =====================================================================
   CTP Pro — config.js
   ---------------------------------------------------------------------
   AQUÍ están todos los valores por defecto de la app, en un solo lugar.
   Si el colegio confirma la tabla oficial de porcentajes, solo hay que
   cambiar los números de "componentes" (y de "periodos") y listo.
   ===================================================================== */

const CONFIG = {
  // Nota mínima para aprobar (escala de 0 a 100).
  notaMinima: 70,
  notaMaxima: 100,

  // Redondeo del simulador: 0 = al entero (ej. 78), 1 = a un decimal (ej. 77,5).
  // Siempre se redondea HACIA ARRIBA, porque si necesitás 77,2 y sacás 77,
  // no te alcanza. El estudiante también lo puede cambiar dentro de la app.
  decimalesRedondeo: 0,

  // Máximo de evaluaciones que se pueden simular en un componente.
  maxEvaluacionesSimulador: 10,

  // Componentes del MEP con sus porcentajes DE EJEMPLO.
  // ⚠️ Confirmar con la tabla oficial del colegio. Deben sumar 100.
  // "clave" es un nombre interno que no cambia aunque se edite el nombre visible.
  componentes: [
    { clave: 'cotidiano', nombre: 'Trabajo Cotidiano', peso: 35 },
    { clave: 'tareas', nombre: 'Tareas', peso: 10 },
    { clave: 'pruebas', nombre: 'Pruebas', peso: 40 },
    { clave: 'asistencia', nombre: 'Asistencia/Concepto', peso: 15 },
  ],

  // Periodos del año lectivo y cuánto vale cada uno en la NOTA ANUAL.
  // ⚠️ 50/50 es un EJEMPLO: confirmar con el colegio cómo se calcula la nota del año.
  // El estudiante puede cambiar estos porcentajes dentro de la app (pestaña "Año").
  // Si un colegio usa trimestres, basta con poner 3 periodos aquí.
  periodos: [
    { nombre: 'I Periodo', peso: 50 },
    { nombre: 'II Periodo', peso: 50 },
  ],

  // Componente que el simulador elige de primero (suele ser la próxima prueba).
  componenteSimuladorPorDefecto: 'pruebas',

  // Sugerencias rápidas al crear una materia.
  materiasSugeridas: [
    'Matemática', 'Español', 'Inglés', 'Ciencias', 'Estudios Sociales',
    'Programación', 'Contabilidad', 'Educación Cívica',
  ],

  // Nombre de la "gaveta" de localStorage donde se guardan los datos.
  // Si algún día cambia la estructura de los datos, se puede subir a -v2.
  claveAlmacenamiento: 'ctp-pro-datos-v1',
};

// Esto permite usar el archivo también en las pruebas con Node.js.
// En el navegador no hace nada.
if (typeof module !== 'undefined') module.exports = CONFIG;
