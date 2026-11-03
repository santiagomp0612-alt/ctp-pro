/* =====================================================================
   Pruebas de los cálculos de CTP Pro.
   Cómo correrlas (necesitás Node.js instalado), desde la carpeta ctp-pro:
       node pruebas/pruebas-calculos.js
   Cada prueba compara lo que calcula la app con lo que calculamos a mano.
   ===================================================================== */

const CONFIG = require('../config.js');
const C = require('../calculos.js');

const OPC = { notaMinima: 70, notaMaxima: 100, decimales: 0 };
const OPC1 = { ...OPC, decimales: 1 };

let pasaron = 0;
let fallaron = 0;

function revisar(nombre, obtenido, esperado) {
  const ok = typeof esperado === 'number'
    ? typeof obtenido === 'number' && Math.abs(obtenido - esperado) < 1e-6
    : obtenido === esperado;
  if (ok) pasaron++; else fallaron++;
  const mostrar = (v) => (typeof v === 'number' ? Number(v.toFixed(4)) : v);
  console.log(`${ok ? '✅' : '❌'} ${nombre}\n     obtenido: ${mostrar(obtenido)}   esperado: ${mostrar(esperado)}`);
}

/* Crea una materia de prueba. notas = { cotidiano: [..], tareas: [..], ... } */
function materia(notas, pesos = {}) {
  return {
    id: 'm', nombre: 'Prueba',
    componentes: CONFIG.componentes.map((c) => ({
      id: c.clave, clave: c.clave, nombre: c.nombre,
      peso: pesos[c.clave] ?? c.peso,
      notas: (notas[c.clave] || []).map((v) => (typeof v === 'number' ? { id: 'n', valor: v, peso: 1 } : { id: 'n', ...v })),
    })),
  };
}

console.log('\n── Promedios ──────────────────────────────────────');

revisar('Los porcentajes de ejemplo suman 100',
  C.sumaPorcentajes(materia({})), 100);

const completa = materia({ cotidiano: [80, 90], tareas: [100], pruebas: [70, 60], asistencia: [100] });
// 85×0,35 + 100×0,10 + 65×0,40 + 100×0,15 = 29,75 + 10 + 26 + 15 = 80,75
revisar('Promedio trimestral completo (85, 100, 65, 100)', C.promedioMateria(completa).promedio, 80.75);
revisar('…y no es parcial', C.promedioMateria(completa).parcial, false);

const parcial = materia({ cotidiano: [90], pruebas: [80] });
// (90×35 + 80×40) / 75 = 84,666…
revisar('Promedio PARCIAL (solo Cotidiano 90 y Pruebas 80)', C.promedioMateria(parcial).promedio, 6350 / 75);
revisar('…marca que es parcial', C.promedioMateria(parcial).parcial, true);
revisar('…con 75% evaluado', C.promedioMateria(parcial).pesoEvaluado, 75);

revisar('Materia sin ninguna nota → sin promedio (null)', C.promedioMateria(materia({})).promedio, null);

revisar('Pesos por nota (preparado para el futuro): 90×2 + 60×1 → 80',
  C.promedioComponente({ notas: [{ valor: 90, peso: 2 }, { valor: 60, peso: 1 }] }), 80);

console.log('\n── Redondeo ───────────────────────────────────────');
revisar('redondearArriba(78,25, entero) → 79', C.redondearArriba(78.25, 0), 79);
revisar('redondearArriba(78,25, 1 decimal) → 78,3', C.redondearArriba(78.25, 1), 78.3);
revisar('redondearArriba(70,00000000001) no sube a 71', C.redondearArriba(70.00000000001, 0), 70);
revisar('truncar(69,96) para mostrar → 69,9 (no 70,0)', C.truncar(69.96, 1), 69.9);

console.log('\n── Simulador "¿Qué nota necesito?" ────────────────');

// Otros componentes en 70; Pruebas tiene un 60 → con 1 prueba más:
// x = (7000 − 4200) × 2 / 40 − 60 = 80   (60 y 80 promedian 70 ✔)
let r = C.notaNecesaria(materia({ cotidiano: [70], tareas: [70], asistencia: [70], pruebas: [60] }), 'pruebas', 1, OPC);
revisar('Caso normal: necesita 80 en la próxima prueba', r.nota, 80);
revisar('…estado', r.estado, 'posible');

// Cotidiano 71 → x exacta = 78,25
const fraccion = materia({ cotidiano: [71], tareas: [70], asistencia: [70], pruebas: [60] });
r = C.notaNecesaria(fraccion, 'pruebas', 1, OPC);
revisar('Nota exacta con decimales (78,25)', r.exacta, 78.25);
revisar('…redondeada al entero hacia arriba → 79', r.nota, 79);
revisar('…redondeada a 1 decimal hacia arriba → 78,3', C.notaNecesaria(fraccion, 'pruebas', 1, OPC1).nota, 78.3);
revisar('…y con esa nota de verdad llega al 70 (≥ 70)', r.finalConNota >= 70, true);

// Faltan 3 pruebas: x = (2800 × 4 / 40 − 60) / 3 = 73,33…
r = C.notaNecesaria(materia({ cotidiano: [70], tareas: [70], asistencia: [70], pruebas: [60] }), 'pruebas', 3, OPC);
revisar('Faltan 3 pruebas: exacta 73,33', r.exacta, 220 / 3);
revisar('…necesita 74 en cada una', r.nota, 74);

// EXTREMO: necesita más de 100
r = C.notaNecesaria(materia({ cotidiano: [60], tareas: [60], asistencia: [60], pruebas: [20, 30] }), 'pruebas', 1, OPC);
revisar('Extremo: necesitaría 205 → "imposible"', r.estado, 'imposible');
revisar('…lo máximo que alcanza sacando 100 es 56', r.maximoAlcanzable, 56);

// EXTREMO: justo 100
r = C.notaNecesaria(materia({ cotidiano: [60], tareas: [60], asistencia: [60], pruebas: [70] }), 'pruebas', 1, OPC);
revisar('Borde: necesita EXACTAMENTE 100 → todavía es posible', r.estado, 'posible');
revisar('…nota 100', r.nota, 100);

// EXTREMO: ya asegurado
r = C.notaNecesaria(materia({ cotidiano: [100], tareas: [100], asistencia: [100], pruebas: [100] }), 'pruebas', 1, OPC);
revisar('Extremo: todo en 100 → "Ya tenés el 70 asegurado"', r.estado, 'asegurado');
revisar('…aunque saque 0 termina con 80', r.finalConCero, 80);

// EXTREMO: necesita exactamente 0
r = C.notaNecesaria(materia({ cotidiano: [100], tareas: [100], asistencia: [100], pruebas: [50] }), 'pruebas', 1, OPC);
revisar('Borde: necesita exactamente 0 → asegurado', r.estado, 'asegurado');
revisar('…sacando 0 queda justo en 70', r.finalConCero, 70);

// Componente sin notas todavía
r = C.notaNecesaria(materia({ cotidiano: [70], tareas: [70], asistencia: [70] }), 'pruebas', 1, OPC);
revisar('Pruebas sin notas y lo demás en 70 → necesita 70', r.nota, 70);

r = C.notaNecesaria(materia({}), 'pruebas', 1, OPC);
revisar('Materia vacía → necesita 70', r.nota, 70);
revisar('…y avisa que 3 componentes no entran al cálculo', r.ignorados.length, 3);

r = C.notaNecesaria(materia({ pruebas: [50] }, { pruebas: 0, cotidiano: 75 }), 'pruebas', 1, OPC);
revisar('Componente con 0% → "sin-peso"', r.estado, 'sin-peso');

// Hipótesis: si saco 100 en Pruebas, ¿cuánto necesito en Tareas?
const dificil = materia({ cotidiano: [60], tareas: [60], asistencia: [60], pruebas: [20, 30] });
const conCien = C.conNotasHipoteticas(dificil, [{ compId: 'pruebas', valor: 100, cantidad: 1 }]);
revisar('Notas hipotéticas NO modifican la materia real', dificil.componentes[2].notas.length, 2);
revisar('…pero sí la copia', conCien.componentes[2].notas.length, 3);

console.log('\n── Prueba masiva: 20 000 materias al azar ─────────');
// Para cada caso "posible" revisamos dos cosas:
// 1) con la nota recomendada SÍ se llega al 70
// 2) con un punto menos (o 0,1 menos) NO se llega → la nota es la MÍNIMA
let errores = 0;
for (let i = 0; i < 20000; i++) {
  const notas = {};
  for (const c of CONFIG.componentes) {
    const n = Math.floor(Math.random() * 4);
    notas[c.clave] = Array.from({ length: n }, () => Math.round(Math.random() * 1000) / 10);
  }
  const m = materia(notas);
  const comp = CONFIG.componentes[Math.floor(Math.random() * 4)].clave;
  const k = 1 + Math.floor(Math.random() * 4);
  const dec = Math.random() < 0.5 ? 0 : 1;
  const res = C.notaNecesaria(m, comp, k, { ...OPC, decimales: dec });
  const finalCon = (x) => C.promedioMateria(C.conNotasHipoteticas(m, [{ compId: comp, valor: x, cantidad: k }])).promedio;
  if (res.estado === 'posible') {
    const paso = dec === 0 ? 1 : 0.1;
    if (finalCon(res.nota) < 70 - 1e-9) errores++;
    if (res.nota - paso >= 0 && finalCon(res.nota - paso) >= 70 - 1e-9) errores++;
  } else if (res.estado === 'asegurado') {
    if (finalCon(0) < 70 - 1e-9) errores++;
  } else if (res.estado === 'imposible') {
    if (finalCon(100) >= 70) errores++;
  }
}
revisar('Casos al azar con resultado incorrecto', errores, 0);

console.log(`\nResultado: ${pasaron} pasaron, ${fallaron} fallaron.\n`);
process.exit(fallaron ? 1 : 0);
