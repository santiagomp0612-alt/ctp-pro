/* =====================================================================
   CTP Pro — calculos.js
   ---------------------------------------------------------------------
   Aquí está TODA la matemática de la app, separada de la pantalla.
   Son "funciones puras": reciben datos y devuelven resultados, sin tocar
   la página ni el localStorage. Así se pueden probar fácilmente
   (ver pruebas/pruebas-calculos.js).

   Forma de los datos de una materia:
   {
     id: 'abc', nombre: 'Matemática',
     periodos: [                       ← I Periodo, II Periodo…
       { componentes: [
           { id, clave: 'pruebas', nombre: 'Pruebas', peso: 40,
             notas: [ { id, valor: 85, peso: 1 }, ... ] },
           ...
       ] },
       ...
     ]
   }
   La mayoría de funciones trabajan con UN periodo (cualquier objeto que
   tenga "componentes"). Las funciones "Anual" trabajan con la materia entera.
   ===================================================================== */

/* Evita errores de "decimales fantasma" de JavaScript
   (por ejemplo 0.1 + 0.2 = 0.30000000000000004). */
function limpiarDecimales(x) {
  return Number(x.toFixed(9));
}

/* Redondea HACIA ARRIBA con la cantidad de decimales indicada.
   redondearArriba(77.21, 0) → 78     redondearArriba(77.21, 1) → 77.3 */
function redondearArriba(x, decimales) {
  const factor = Math.pow(10, decimales);
  return Math.ceil(limpiarDecimales(x * factor)) / factor;
}

/* Corta (redondea HACIA ABAJO) los decimales. Se usa para MOSTRAR promedios:
   así un 69,96 se ve como 69,9 (rojo) y no como un engañoso 70,0. */
function truncar(x, decimales) {
  const factor = Math.pow(10, decimales);
  return Math.floor(limpiarDecimales(x * factor)) / factor;
}

/* Promedio de un componente.
   Hoy cada nota pesa 1 (promedio simple), pero el código ya usa "peso"
   por nota para que en el futuro una nota pueda valer más que otra.
   Devuelve null si el componente todavía no tiene notas. */
function promedioComponente(componente) {
  let suma = 0;
  let pesos = 0;
  for (const nota of componente.notas) {
    const peso = nota.peso > 0 ? nota.peso : 1;
    suma += nota.valor * peso;
    pesos += peso;
  }
  return pesos > 0 ? suma / pesos : null;
}

/* Suma de los porcentajes de todos los componentes de un periodo (debería dar 100). */
function sumaPorcentajes(periodo) {
  return limpiarDecimales(periodo.componentes.reduce((total, c) => total + c.peso, 0));
}

function porcentajesValidos(periodo) {
  return Math.abs(sumaPorcentajes(periodo) - 100) < 1e-9;
}

/* Suma de una lista de pesos, ej. los de los periodos [50, 50] → 100 */
function sumaLista(pesos) {
  return limpiarDecimales(pesos.reduce((total, p) => total + p, 0));
}

/* Promedio de UN PERIODO de una materia.
   Fórmula: suma de (promedio del componente × su porcentaje).
   Si algún componente todavía no tiene notas, se calcula solo con lo
   evaluado hasta ahora (promedio PARCIAL) y se "reescala" a 100.
   Ejemplo: si solo hay Pruebas (40%) con 80 y Cotidiano (35%) con 90:
   (80×40 + 90×35) / 75 = 84,67 */
function promedioPeriodo(periodo) {
  let puntos = 0;          // suma de promedio × peso
  let pesoEvaluado = 0;    // cuánto % ya tiene notas
  const sinNotas = [];     // componentes (con peso) que aún no tienen notas

  for (const comp of periodo.componentes) {
    const prom = promedioComponente(comp);
    if (prom === null) {
      if (comp.peso > 0) sinNotas.push(comp);
      continue;
    }
    puntos += prom * comp.peso;
    pesoEvaluado += comp.peso;
  }

  return {
    promedio: pesoEvaluado > 0 ? puntos / pesoEvaluado : null,
    parcial: sinNotas.length > 0,
    pesoEvaluado: limpiarDecimales(pesoEvaluado),
    componentesSinNotas: sinNotas,
  };
}

/* NOTA ANUAL de una materia: promedio de los periodos según su peso.
   pesos = [50, 50] (uno por periodo). Igual que con los componentes,
   si un periodo todavía no tiene notas, se calcula con lo que hay
   (nota anual PARCIAL). */
function promedioAnual(materia, pesos) {
  let puntos = 0;
  let pesoEvaluado = 0;
  const porPeriodo = [];
  const periodosSinNotas = []; // índices de periodos sin notas

  materia.periodos.forEach((periodo, i) => {
    const r = promedioPeriodo(periodo);
    porPeriodo.push(r);
    const peso = pesos[i] || 0;
    if (r.promedio === null) {
      if (peso > 0) periodosSinNotas.push(i);
      return;
    }
    puntos += r.promedio * peso;
    pesoEvaluado += peso;
  });

  return {
    promedio: pesoEvaluado > 0 ? puntos / pesoEvaluado : null,
    // Es parcial si falta algún periodo o si algún periodo es parcial
    parcial: periodosSinNotas.length > 0 || porPeriodo.some((r) => r.promedio !== null && r.parcial),
    porPeriodo,
    periodosSinNotas,
  };
}

/* ¿Qué promedio necesito en el periodo "indice" para que la NOTA ANUAL
   llegue a "notaMinima"? Despeje:
     (puntosOtros + w × m) / (pesoOtros + w) = 70  →  m = (70 × (pesoOtros + w) − puntosOtros) / w
   Devuelve null si ese periodo vale 0%. */
function metaDelPeriodoParaAnual(materia, indice, pesos, notaMinima) {
  const datosOtros = otrosPeriodos(materia, indice, pesos);
  const w = pesos[indice] || 0;
  if (!(w > 0)) return null;
  return limpiarDecimales((notaMinima * (datosOtros.peso + w) - datosOtros.puntos) / w);
}

/* Nota anual que quedaría si el periodo "indice" termina con "promedio". */
function anualConPromedioDePeriodo(materia, indice, pesos, promedio) {
  const datosOtros = otrosPeriodos(materia, indice, pesos);
  const w = pesos[indice] || 0;
  return (datosOtros.puntos + promedio * w) / (datosOtros.peso + w);
}

// Ayudante: suma lo que aportan los periodos distintos de "indice" (solo los que tienen notas)
function otrosPeriodos(materia, indice, pesos) {
  let puntos = 0;
  let peso = 0;
  materia.periodos.forEach((periodo, i) => {
    if (i === indice) return;
    const r = promedioPeriodo(periodo);
    if (r.promedio === null) return;
    puntos += r.promedio * (pesos[i] || 0);
    peso += pesos[i] || 0;
  });
  return { puntos, peso };
}

/* Crea una COPIA del periodo con notas imaginarias agregadas.
   Sirve para preguntar "¿y si saco X en tal componente?" sin tocar
   los datos reales. hipoteticas = [{ compId, valor, cantidad }] */
function conNotasHipoteticas(periodo, hipoteticas) {
  return {
    ...periodo,
    componentes: periodo.componentes.map((comp) => {
      const extra = [];
      for (const h of hipoteticas) {
        if (h.compId !== comp.id) continue;
        for (let i = 0; i < h.cantidad; i++) extra.push({ id: 'hipotetica', valor: h.valor, peso: 1 });
      }
      return { ...comp, notas: comp.notas.concat(extra) };
    }),
  };
}

/* ¿Qué nota necesito?
   Calcula la nota mínima que hay que sacar en CADA una de las
   "cantidad" evaluaciones que faltan del componente "compId"
   para que el PERIODO termine con opciones.notaMinima (normalmente 70;
   si la meta es aprobar el año, la app pasa aquí el promedio que hace falta).

   Despeje de la fórmula (W = pesos evaluados, contando el componente elegido):
     final = (puntosOtros + pesoComp × (S + k·x) / (P + k)) / W ≥ 70
   donde S = suma de notas del componente, P = cuántas notas tiene, k = cantidad.
     x = ((70·W − puntosOtros) × (P + k) / pesoComp − S) / k

   Devuelve un objeto con "estado":
     'posible'    → hay que sacar "nota" (ya redondeada hacia arriba)
     'asegurado'  → aunque saque 0, ya llega al 70
     'imposible'  → ni con 100 llega; "maximoAlcanzable" dice hasta dónde llega
     'sin-peso'   → el componente vale 0% y no cambia nada
*/
function notaNecesaria(periodo, compId, cantidad, opciones) {
  const minima = opciones.notaMinima;
  const maxima = opciones.notaMaxima;
  const decimales = opciones.decimales;

  const objetivo = periodo.componentes.find((c) => c.id === compId);
  if (!objetivo || !(objetivo.peso > 0)) return { estado: 'sin-peso' };

  let puntosOtros = 0;
  let pesoOtros = 0;
  const ignorados = []; // otros componentes sin notas (no entran al cálculo)
  for (const comp of periodo.componentes) {
    if (comp.id === compId) continue;
    const prom = promedioComponente(comp);
    if (prom === null) {
      if (comp.peso > 0) ignorados.push(comp);
      continue;
    }
    puntosOtros += prom * comp.peso;
    pesoOtros += comp.peso;
  }

  // S y P del componente elegido (con soporte para pesos por nota).
  let S = 0;
  let P = 0;
  for (const nota of objetivo.notas) {
    const peso = nota.peso > 0 ? nota.peso : 1;
    S += nota.valor * peso;
    P += peso;
  }

  const k = cantidad;
  const W = pesoOtros + objetivo.peso;
  const exacta = limpiarDecimales(((minima * W - puntosOtros) * (P + k) / objetivo.peso - S) / k);

  // Función de ayuda: ¿con qué promedio termino si saco "x" en cada una?
  const finalCon = (x) => (puntosOtros + objetivo.peso * (S + k * x) / (P + k)) / W;

  const base = { exacta, componente: objetivo, cantidad: k, ignorados };

  if (exacta <= 0) {
    return { ...base, estado: 'asegurado', finalConCero: finalCon(0) };
  }
  if (exacta > maxima) {
    return { ...base, estado: 'imposible', maximoAlcanzable: finalCon(maxima) };
  }
  const nota = Math.min(maxima, redondearArriba(exacta, decimales));
  return { ...base, estado: 'posible', nota, finalConNota: finalCon(nota) };
}

// Para poder usar estas funciones en las pruebas con Node.js.
if (typeof module !== 'undefined') {
  module.exports = {
    limpiarDecimales, redondearArriba, truncar, promedioComponente,
    sumaPorcentajes, porcentajesValidos, sumaLista, promedioPeriodo,
    promedioAnual, metaDelPeriodoParaAnual, anualConPromedioDePeriodo,
    conNotasHipoteticas, notaNecesaria,
  };
}
