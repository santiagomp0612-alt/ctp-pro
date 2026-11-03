/* =====================================================================
   CTP Pro — app.js
   ---------------------------------------------------------------------
   Este archivo maneja la PANTALLA: dibuja las vistas, responde a los
   toques/clics y guarda los datos en el navegador (localStorage).
   - La configuración (porcentajes, nota mínima…) está en config.js
   - La matemática está en calculos.js

   Mapa del archivo:
     1. Utilidades
     2. Datos y guardado
     3. Navegación (rutas)
     4. Vista: Inicio
     5. Vista: Detalle de materia
     6. Vista: Simulador
     7. Ventana emergente (diálogo)
     8. Eventos (clics, formularios, campos)
     9. Exportar / importar / borrar todo
    10. Arranque y modo sin internet
   ===================================================================== */
'use strict';

/* =====================================================================
   1. UTILIDADES
   ===================================================================== */

// Atajo para buscar un elemento: $('#app') es igual a document.querySelector('#app')
const $ = (selector, raiz = document) => raiz.querySelector(selector);

/* MUY IMPORTANTE: todo texto que escribe el estudiante (ej. nombre de la
   materia) pasa por escapar() antes de ponerlo en el HTML. Así nadie puede
   "inyectar" código raro escribiendo <script> como nombre. */
function escapar(texto) {
  const reemplazos = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(texto).replace(/[&<>"']/g, (c) => reemplazos[c]);
}

// Genera un identificador único corto, ej. "lq2k3x9ab1c"
function nuevoId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// Formatos de números a la tica: coma decimal (85,5)
const formatoNota = new Intl.NumberFormat('es-CR', { maximumFractionDigits: 2 });
const formatoUnDecimal = new Intl.NumberFormat('es-CR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const formatoPorcentaje = new Intl.NumberFormat('es-CR', { maximumFractionDigits: 2 });

// Muestra un promedio con 1 decimal, cortando (no redondeando) para no "regalar" décimas.
function mostrarPromedio(n) {
  return formatoUnDecimal.format(truncar(n, 1));
}

function mostrarConDecimales(n, decimales) {
  return new Intl.NumberFormat('es-CR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales }).format(n);
}

/* Lee un número escrito por el estudiante. Acepta coma o punto
   ("85,5" o "85.5"). Devuelve NaN si no es un número válido. */
function leerNumero(texto) {
  const limpio = String(texto).trim().replace(',', '.');
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(limpio)) return NaN;
  return Number(limpio);
}

// Revisa una nota. Devuelve un mensaje de error, o null si está bien.
function errorDeNota(valor) {
  if (Number.isNaN(valor)) return 'Escribí un número, por ejemplo 85 o 92,5.';
  if (valor < 0 || valor > CONFIG.notaMaxima) return `La nota tiene que estar entre 0 y ${CONFIG.notaMaxima}.`;
  return null;
}

// "Tareas", "Tareas y Pruebas", "Tareas, Pruebas y Asistencia"
function listaBonita(nombres) {
  if (nombres.length <= 1) return nombres.join('');
  return nombres.slice(0, -1).join(', ') + ' y ' + nombres[nombres.length - 1];
}

// Mensajito temporal en la parte de abajo
let temporizadorToast;
function avisar(texto) {
  const toast = $('#toast');
  toast.textContent = texto;
  toast.classList.add('visible');
  clearTimeout(temporizadorToast);
  temporizadorToast = setTimeout(() => toast.classList.remove('visible'), 2200);
}

/* =====================================================================
   2. DATOS Y GUARDADO
   ---------------------------------------------------------------------
   Todo se guarda en localStorage como texto JSON. Estructura:
   {
     version: 1,
     materias: [ { id, nombre, componentes: [ { id, clave, nombre, peso, notas: [ { id, valor, peso } ] } ] } ],
     ajustes: { decimalesRedondeo: 0 }
   }
   ===================================================================== */

let almacenamientoDisponible = true;

function datosIniciales() {
  return { version: 1, materias: [], ajustes: { decimalesRedondeo: CONFIG.decimalesRedondeo } };
}

// Componentes nuevos con los porcentajes de ejemplo de CONFIG
function componentesPorDefecto() {
  return CONFIG.componentes.map((c) => ({ id: nuevoId(), clave: c.clave, nombre: c.nombre, peso: c.peso, notas: [] }));
}

function crearMateria(nombre) {
  return { id: nuevoId(), nombre, componentes: componentesPorDefecto() };
}

/* Revisa y "limpia" datos que vienen de afuera (localStorage o un archivo
   importado). Si algo viene mal, lo corrige o lo descarta para que la app
   nunca se caiga. Si el formato es irreconocible, lanza un error. */
function normalizarDatos(obj) {
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.materias)) {
    throw new Error('El archivo no tiene el formato de CTP Pro.');
  }
  const esNumero = (n) => typeof n === 'number' && Number.isFinite(n);

  const materias = obj.materias
    .filter((m) => m && typeof m === 'object')
    .map((m) => {
      const comps = Array.isArray(m.componentes) && m.componentes.length ? m.componentes : componentesPorDefecto();
      return {
        id: String(m.id || nuevoId()),
        nombre: String(m.nombre || 'Materia sin nombre').trim().slice(0, 60) || 'Materia sin nombre',
        componentes: comps
          .filter((c) => c && typeof c === 'object')
          .map((c) => ({
            id: String(c.id || nuevoId()),
            clave: String(c.clave || ''),
            nombre: String(c.nombre || 'Componente').slice(0, 40),
            peso: esNumero(c.peso) ? Math.min(100, Math.max(0, c.peso)) : 0,
            notas: (Array.isArray(c.notas) ? c.notas : [])
              .filter((n) => n && esNumero(n.valor) && n.valor >= 0 && n.valor <= CONFIG.notaMaxima)
              .map((n) => ({
                id: String(n.id || nuevoId()),
                valor: n.valor,
                peso: esNumero(n.peso) && n.peso > 0 ? n.peso : 1, // listo para pesos por nota
              })),
          })),
      };
    });

  const dec = obj.ajustes && [0, 1].includes(obj.ajustes.decimalesRedondeo)
    ? obj.ajustes.decimalesRedondeo
    : CONFIG.decimalesRedondeo;

  return { version: 1, materias, ajustes: { decimalesRedondeo: dec } };
}

function cargarDatos() {
  let texto;
  try {
    texto = localStorage.getItem(CONFIG.claveAlmacenamiento);
  } catch (e) {
    // Algunos navegadores en modo incógnito no dejan usar localStorage
    almacenamientoDisponible = false;
    return datosIniciales();
  }
  if (!texto) return datosIniciales();
  try {
    return normalizarDatos(JSON.parse(texto));
  } catch (e) {
    // Si los datos se dañaron, guardamos una copia aparte para no perderlos del todo
    try { localStorage.setItem(CONFIG.claveAlmacenamiento + '-danado', texto); } catch (_) { /* nada */ }
    return datosIniciales();
  }
}

// Guardado automático: se llama después de cada cambio.
function guardar() {
  try {
    localStorage.setItem(CONFIG.claveAlmacenamiento, JSON.stringify(datos));
    almacenamientoDisponible = true;
  } catch (e) {
    almacenamientoDisponible = false;
    avisar('⚠️ No se pudo guardar en este navegador');
  }
}

// Los datos de la app viven en esta variable mientras la página está abierta.
let datos = cargarDatos();

function buscarMateria(id) {
  return datos.materias.find((m) => m.id === id);
}
function buscarComponente(materia, compId) {
  return materia.componentes.find((c) => c.id === compId);
}

// Opciones para el simulador (de CONFIG + lo que eligió el estudiante)
function opcionesCalculo() {
  return { notaMinima: CONFIG.notaMinima, notaMaxima: CONFIG.notaMaxima, decimales: datos.ajustes.decimalesRedondeo };
}

/* =====================================================================
   3. NAVEGACIÓN (RUTAS)
   ---------------------------------------------------------------------
   Usamos la parte "#" de la dirección para saber qué pantalla mostrar:
     #/                     → Inicio
     #/materia/ID           → Detalle de una materia
     #/simulador/ID         → Simulador para esa materia
   Así el botón "atrás" del celular funciona normal.
   ===================================================================== */

function rutaActual() {
  const partes = location.hash.replace(/^#\/?/, '').split('/');
  return { vista: partes[0] || 'inicio', id: partes[1] ? decodeURIComponent(partes[1]) : null };
}

function irA(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

function render() {
  const { vista, id } = rutaActual();
  const app = $('#app');

  if (vista === 'materia') {
    const materia = buscarMateria(id);
    if (!materia) { location.replace('#/'); return; }
    app.innerHTML = vistaMateria(materia);
    document.title = `${materia.nombre} · CTP Pro`;
  } else if (vista === 'simulador') {
    app.innerHTML = vistaSimulador(id);
    pintarResultado();
    document.title = '¿Qué nota necesito? · CTP Pro';
  } else {
    app.innerHTML = vistaInicio();
    document.title = 'CTP Pro · Calculá tu promedio';
  }
}

window.addEventListener('hashchange', () => {
  render();
  window.scrollTo(0, 0);
  // Mueve el foco al contenido para lectores de pantalla
  $('#app').focus({ preventScroll: true });
});

/* =====================================================================
   4. VISTA: INICIO (lista de materias)
   ===================================================================== */

// Calcula el estado de una materia para pintarla de verde/rojo/gris
function estadoMateria(materia) {
  const r = promedioMateria(materia);
  if (r.promedio === null) return { clase: 'sin-notas', texto: 'Sin notas todavía', r };
  const aprobando = r.promedio >= CONFIG.notaMinima;
  return { clase: aprobando ? 'aprobando' : 'riesgo', texto: aprobando ? 'Va aprobando' : `Por debajo de ${CONFIG.notaMinima}`, r };
}

function htmlTarjetaMateria(materia) {
  const { clase, texto, r } = estadoMateria(materia);
  const numero = r.promedio === null ? '—' : mostrarPromedio(r.promedio);
  const ancho = r.promedio === null ? 0 : Math.min(100, r.promedio);
  const etiquetas = [
    `<span class="pastilla">${texto}</span>`,
    r.promedio !== null && r.parcial ? '<span class="etiqueta">Parcial</span>' : '',
    !porcentajesValidos(materia) ? '<span class="etiqueta alerta">Revisar %</span>' : '',
  ].join('');

  return `
    <li>
      <a class="tarjeta-materia estado-${clase}" href="#/materia/${encodeURIComponent(materia.id)}">
        <div class="tm-texto">
          <h2 class="tm-nombre">${escapar(materia.nombre)}</h2>
          <p class="tm-estado">${etiquetas}</p>
        </div>
        <div class="tm-numero"><span class="solo-lector">Promedio </span>${numero}</div>
        <div class="barra" aria-hidden="true"><span style="width:${ancho}%"></span><i style="left:${CONFIG.notaMinima}%"></i></div>
      </a>
    </li>`;
}

function vistaInicio() {
  const hayMaterias = datos.materias.length > 0;
  const avisoGuardado = almacenamientoDisponible ? '' : `
    <p class="aviso mal">Este navegador no está dejando guardar datos (¿modo incógnito?). Podés usar la app, pero se va a borrar todo al cerrarla. Usá "Exportar" para no perder tus notas.</p>`;

  const lista = hayMaterias
    ? `<ul class="lista-materias">${datos.materias.map(htmlTarjetaMateria).join('')}</ul>`
    : `<div class="panel vacio">
         <div class="vacio-icono" aria-hidden="true">📚</div>
         <h2>Todavía no tenés materias</h2>
         <p class="sub">Agregá tu primera materia para empezar a calcular tu promedio.</p>
       </div>`;

  return `
    <section class="vista">
      <div class="intro">
        <h1>Tus materias</h1>
        <p>Calculá tu promedio del trimestre y averiguá qué nota necesitás para llegar al ${CONFIG.notaMinima}.</p>
      </div>
      ${avisoGuardado}
      ${lista}
      <button class="btn primario ancho" type="button" data-accion="nueva-materia">+ Agregar materia</button>
      ${hayMaterias ? '<a class="btn acento ancho" href="#/simulador">🎯 ¿Qué nota necesito?</a>' : ''}

      <section class="panel panel-datos" aria-labelledby="titulo-datos">
        <h2 id="titulo-datos">Tus datos</h2>
        <p>Se guardan solo en este navegador, nada se envía a internet. Si limpiás el navegador o cambiás de celular, se pierden: hacé un respaldo de vez en cuando.</p>
        <div class="botones-datos">
          <button class="btn chico" type="button" data-accion="exportar" ${hayMaterias ? '' : 'disabled'}>⬇ Exportar respaldo</button>
          <button class="btn chico" type="button" data-accion="importar">⬆ Importar respaldo</button>
          <button class="btn chico peligro" type="button" data-accion="borrar-todo" ${hayMaterias ? '' : 'disabled'}>Borrar todos los datos</button>
        </div>
        <input type="file" id="archivo-importar" accept=".json,application/json" hidden>
      </section>
    </section>`;
}

/* =====================================================================
   5. VISTA: DETALLE DE MATERIA
   ===================================================================== */

// Tarjeta grande con el promedio trimestral
function htmlResumen(materia) {
  const { clase, texto, r } = estadoMateria(materia);
  if (r.promedio === null) {
    return `
      <div class="panel resumen estado-sin-notas">
        <p class="resumen-etiqueta">Promedio trimestral</p>
        <p class="resumen-numero">—</p>
        <p><span class="pastilla">${texto}</span></p>
        <p class="resumen-detalle">Agregá tu primera nota en cualquiera de los componentes de abajo.</p>
      </div>`;
  }
  const faltan = r.componentesSinNotas.map((c) => escapar(c.nombre));
  const detalle = r.parcial
    ? `<strong>Promedio parcial:</strong> calculado solo con lo evaluado hasta ahora (${formatoPorcentaje.format(r.pesoEvaluado)}% de la nota). Todavía sin notas: ${listaBonita(faltan)}.`
    : 'Promedio con todos los componentes evaluados.';
  return `
    <div class="panel resumen estado-${clase}">
      <p class="resumen-etiqueta">Promedio trimestral${r.parcial ? ' (parcial)' : ''}</p>
      <p class="resumen-numero">${mostrarPromedio(r.promedio)}</p>
      <p><span class="pastilla">${texto}</span></p>
      <p class="resumen-detalle">${detalle}</p>
    </div>`;
}

// Línea que dice cuánto suman los porcentajes
function htmlSuma(materia) {
  const suma = sumaPorcentajes(materia);
  if (porcentajesValidos(materia)) {
    return `<div class="suma ok"><span>✓ Los porcentajes suman 100%</span></div>`;
  }
  const diferencia = formatoPorcentaje.format(Math.abs(100 - suma));
  const pista = suma > 100 ? `sobran ${diferencia}%` : `faltan ${diferencia}%`;
  return `<div class="aviso mal" role="alert">Los porcentajes suman ${formatoPorcentaje.format(suma)}% (${pista}). Tienen que sumar exactamente 100% para que el promedio y el simulador sean correctos.</div>`;
}

function htmlPromedioComponente(comp) {
  const prom = promedioComponente(comp);
  if (prom === null) return 'Sin notas todavía';
  const n = comp.notas.length;
  return `Promedio: <strong>${mostrarPromedio(prom)}</strong> · ${n} ${n === 1 ? 'nota' : 'notas'}`;
}

function htmlComponente(comp) {
  const chips = comp.notas.map((nota, i) => `
    <li><button type="button" class="chip ${nota.valor < CONFIG.notaMinima ? 'baja' : ''}"
        data-accion="editar-nota" data-comp="${comp.id}" data-nota="${nota.id}"
        aria-label="Nota ${i + 1}: ${formatoNota.format(nota.valor)}. Tocá para editar o borrar">${formatoNota.format(nota.valor)}</button></li>`).join('');

  return `
    <article class="panel componente" data-comp="${comp.id}">
      <div class="comp-cabecera">
        <h2 id="titulo-${comp.id}">${escapar(comp.nombre).replace(/\//g, '/<wbr>')}</h2>
        <label class="peso">Vale
          <input type="text" inputmode="decimal" value="${formatoPorcentaje.format(comp.peso)}"
                 data-peso="${comp.id}" aria-label="Porcentaje de ${escapar(comp.nombre)}" maxlength="5">%
        </label>
      </div>
      <p class="comp-promedio" id="prom-${comp.id}">${htmlPromedioComponente(comp)}</p>
      ${chips ? `<ul class="notas" aria-label="Notas de ${escapar(comp.nombre)}">${chips}</ul>` : ''}
      <form class="agregar-nota" data-comp="${comp.id}" novalidate>
        <label class="solo-lector" for="nota-${comp.id}">Nueva nota de ${escapar(comp.nombre)}</label>
        <input id="nota-${comp.id}" type="text" inputmode="decimal" autocomplete="off" placeholder="Nueva nota (0–100)" maxlength="6">
        <button class="btn primario" type="submit">Agregar</button>
      </form>
    </article>`;
}

function vistaMateria(materia) {
  return `
    <section class="vista">
      <div><a href="#/" class="btn-volver">← Mis materias</a></div>
      <header class="materia-cabecera">
        <h1>${escapar(materia.nombre)}</h1>
        <div class="acciones">
          <button class="btn chico" type="button" data-accion="renombrar-materia">Renombrar</button>
          <button class="btn chico peligro" type="button" data-accion="borrar-materia">Borrar</button>
        </div>
      </header>

      <div id="resumen">${htmlResumen(materia)}</div>
      <a class="btn acento ancho" href="#/simulador/${encodeURIComponent(materia.id)}">🎯 ¿Qué nota necesito?</a>

      <p class="aviso">Porcentajes de ejemplo: confirmalos con la tabla oficial de tu colegio. Podés cambiarlos en cada componente.</p>
      <div id="suma">${htmlSuma(materia)}</div>

      ${materia.componentes.map(htmlComponente).join('')}

      <button class="btn chico" type="button" data-accion="restablecer-pesos">Volver a los porcentajes de ejemplo</button>
    </section>`;
}

// Actualiza solo los números (sin redibujar todo) mientras se escribe un porcentaje
function refrescarCalculosMateria(materia) {
  $('#resumen').innerHTML = htmlResumen(materia);
  $('#suma').innerHTML = htmlSuma(materia);
}

/* =====================================================================
   6. VISTA: SIMULADOR "¿QUÉ NOTA NECESITO?"
   ===================================================================== */

// Lo que el estudiante eligió en el simulador (se recuerda mientras la app está abierta)
const sim = { materiaId: null, compId: null, cantidad: 1 };

function prepararSimulador(idDeRuta) {
  if (idDeRuta && buscarMateria(idDeRuta)) sim.materiaId = idDeRuta;
  const materia = buscarMateria(sim.materiaId) || datos.materias[0];
  if (!materia) return null;
  sim.materiaId = materia.id;
  if (!buscarComponente(materia, sim.compId)) {
    const porDefecto = materia.componentes.find((c) => c.clave === CONFIG.componenteSimuladorPorDefecto);
    sim.compId = (porDefecto || materia.componentes[0]).id;
  }
  return materia;
}

function vistaSimulador(idDeRuta) {
  const materia = prepararSimulador(idDeRuta);
  if (!materia) {
    return `
      <section class="vista">
        <div><a href="#/" class="btn-volver">← Mis materias</a></div>
        <h1>¿Qué nota necesito?</h1>
        <div class="panel vacio"><p>Primero agregá una materia con sus notas.</p>
          <a class="btn primario" href="#/">Ir a mis materias</a></div>
      </section>`;
  }

  const opcionesMaterias = datos.materias.map((m) =>
    `<option value="${m.id}" ${m.id === materia.id ? 'selected' : ''}>${escapar(m.nombre)}</option>`).join('');
  const opcionesComps = materia.componentes.map((c) =>
    `<option value="${c.id}" ${c.id === sim.compId ? 'selected' : ''}>${escapar(c.nombre)} (${formatoPorcentaje.format(c.peso)}%)</option>`).join('');

  return `
    <section class="vista">
      <div><a href="#/materia/${encodeURIComponent(materia.id)}" class="btn-volver">← ${escapar(materia.nombre)}</a></div>
      <div class="intro">
        <h1>¿Qué nota necesito?</h1>
        <p>Elegí tu próxima evaluación y te decimos la nota mínima para terminar el trimestre con ${CONFIG.notaMinima}.</p>
      </div>

      <div class="panel form-sim">
        <label class="campo"><span>Materia</span>
          <select id="sim-materia">${opcionesMaterias}</select>
        </label>
        <label class="campo"><span>¿De qué componente es la evaluación?</span>
          <select id="sim-comp">${opcionesComps}</select>
        </label>
        <div class="campo">
          <span id="etq-cantidad">¿Cuántas evaluaciones faltan en ese componente?</span>
          <div class="stepper" role="group" aria-labelledby="etq-cantidad">
            <button class="btn" type="button" data-accion="sim-menos" aria-label="Una evaluación menos">−</button>
            <output id="sim-cantidad" aria-live="polite">${sim.cantidad}</output>
            <button class="btn" type="button" data-accion="sim-mas" aria-label="Una evaluación más">+</button>
          </div>
        </div>
        <div class="campo">
          <span id="etq-redondeo">Mostrar el resultado</span>
          <div class="segmentado" role="group" aria-labelledby="etq-redondeo">
            <button type="button" data-accion="sim-redondeo" data-dec="0">Entero (78)</button>
            <button type="button" data-accion="sim-redondeo" data-dec="1">Un decimal (77,3)</button>
          </div>
        </div>
      </div>

      <div id="resultado" class="resultado" aria-live="polite"></div>

      <details class="explicacion">
        <summary>¿Cómo se calcula?</summary>
        <div>
          <p>Tu promedio trimestral es la suma de (promedio de cada componente × su porcentaje).</p>
          <p>El simulador agrega la o las evaluaciones que faltan con la misma nota y busca la nota más baja con la que llegás a ${CONFIG.notaMinima}.</p>
          <p>Si un componente todavía no tiene notas, no se toma en cuenta (igual que en el promedio parcial). Cuando le pongás notas, el resultado puede cambiar.</p>
          <p>El resultado siempre se redondea <strong>hacia arriba</strong>: si necesitás 77,2 y sacás 77, no te alcanza.</p>
        </div>
      </details>
    </section>`;
}

// Calcula y dibuja el resultado del simulador (se llama cada vez que algo cambia)
function pintarResultado() {
  const caja = $('#resultado');
  if (!caja) return;
  const materia = buscarMateria(sim.materiaId);
  if (!materia) return;

  // Actualizar controles
  $('#sim-cantidad').textContent = sim.cantidad;
  document.querySelectorAll('[data-accion="sim-redondeo"]').forEach((b) => {
    b.setAttribute('aria-pressed', String(Number(b.dataset.dec) === datos.ajustes.decimalesRedondeo));
  });

  const enlaceMateria = `#/materia/${encodeURIComponent(materia.id)}`;

  if (!porcentajesValidos(materia)) {
    caja.className = 'resultado imposible';
    caja.innerHTML = `
      <p class="res-titulo">Primero arreglá los porcentajes</p>
      <p class="res-texto">En ${escapar(materia.nombre)} suman ${formatoPorcentaje.format(sumaPorcentajes(materia))}% y tienen que sumar 100%.</p>
      <a class="btn primario" href="${enlaceMateria}">Ir a ${escapar(materia.nombre)}</a>`;
    return;
  }

  const op = opcionesCalculo();
  const r = notaNecesaria(materia, sim.compId, sim.cantidad, op);
  const dec = op.decimales;

  if (r.estado === 'sin-peso') {
    caja.className = 'resultado';
    caja.innerHTML = '<p class="res-titulo">Ese componente vale 0%</p><p class="res-texto">Una evaluación ahí no cambia tu promedio. Elegí otro componente.</p>';
    return;
  }

  const nombreComp = escapar(r.componente.nombre);
  const enCuales = r.cantidad === 1
    ? `en tu próxima evaluación de <strong>${nombreComp}</strong>`
    : `en <strong>cada una</strong> de las ${r.cantidad} evaluaciones de <strong>${nombreComp}</strong>`;

  // Nota sobre componentes que no entran al cálculo
  const notaIgnorados = r.ignorados.length
    ? `<p class="res-nota">Ojo: ${listaBonita(r.ignorados.map((c) => escapar(c.nombre)))} ${r.ignorados.length === 1 ? 'todavía no tiene' : 'todavía no tienen'} notas, así que no ${r.ignorados.length === 1 ? 'entra' : 'entran'} en este cálculo. Cuando ${r.ignorados.length === 1 ? 'tenga' : 'tengan'} notas, el resultado puede cambiar.</p>`
    : '';

  if (r.estado === 'asegurado') {
    caja.className = 'resultado asegurado';
    caja.innerHTML = `
      <p class="res-numero" aria-hidden="true">✓</p>
      <p class="res-grande">Ya tenés el ${CONFIG.notaMinima} asegurado</p>
      <p class="res-texto">Aunque sacaras 0 ${enCuales}, terminarías con ${mostrarPromedio(r.finalConCero)}. ¡Buen trabajo! Igual, ¡dale con todo!</p>
      ${notaIgnorados}`;
    return;
  }

  if (r.estado === 'imposible') {
    caja.className = 'resultado imposible';
    caja.innerHTML = `
      <p class="res-grande">Con esta evaluación ya no alcanzás los ${CONFIG.notaMinima}</p>
      <p class="res-texto">Aunque sacaras ${CONFIG.notaMaxima} ${enCuales}, llegarías a ${mostrarPromedio(r.maximoAlcanzable)}. Necesitarías ${mostrarConDecimales(redondearArriba(r.exacta, dec), dec)}, que es más de ${CONFIG.notaMaxima}.</p>
      ${htmlSugerencias(materia, r)}
      ${notaIgnorados}`;
    return;
  }

  // Estado "posible"
  caja.className = 'resultado posible';
  const exactaTexto = formatoNota.format(r.exacta);
  caja.innerHTML = `
    <p class="res-titulo">Necesitás sacar al menos</p>
    <p class="res-numero">${mostrarConDecimales(r.nota, dec)}</p>
    <p class="res-texto">${enCuales} para terminar con ${CONFIG.notaMinima}.</p>
    <p class="res-texto">Con esa nota quedarías en ${mostrarPromedio(r.finalConNota)}${exactaTexto !== mostrarConDecimales(r.nota, dec) ? ` · nota exacta: ${exactaTexto}` : ''}.</p>
    ${notaIgnorados}`;
}

/* Cuando ya no se alcanza el 70, buscamos qué podría ayudar:
   1) que quedaran más evaluaciones en el mismo componente
   2) sacando 100 en lo elegido, cuánto haría falta en UNA evaluación de otro componente */
function htmlSugerencias(materia, r) {
  const op = opcionesCalculo();
  const dec = op.decimales;
  const ideas = [];

  for (let k = sim.cantidad + 1; k <= CONFIG.maxEvaluacionesSimulador; k++) {
    const otra = notaNecesaria(materia, sim.compId, k, op);
    if (otra.estado === 'posible') {
      ideas.push(`Si quedaran <strong>${k}</strong> evaluaciones de ${escapar(r.componente.nombre)}, necesitarías ${mostrarConDecimales(otra.nota, dec)} en cada una.`);
      break;
    }
  }

  const conCien = conNotasHipoteticas(materia, [{ compId: sim.compId, valor: CONFIG.notaMaxima, cantidad: sim.cantidad }]);
  for (const comp of materia.componentes) {
    if (comp.id === sim.compId || !(comp.peso > 0)) continue;
    const otra = notaNecesaria(conCien, comp.id, 1, op);
    if (otra.estado === 'posible') {
      ideas.push(`Sacando ${CONFIG.notaMaxima} en ${escapar(r.componente.nombre)} y con una evaluación más de <strong>${escapar(comp.nombre)}</strong> (${formatoPorcentaje.format(comp.peso)}%), ahí necesitarías ${mostrarConDecimales(otra.nota, dec)}.`);
    }
  }

  const lista = ideas.length
    ? `<ul>${ideas.map((t) => `<li>${t}</li>`).join('')}</ul>`
    : '<p class="res-texto">Con una sola evaluación extra no alcanza en ningún componente.</p>';

  return `
    <div class="sugerencias">
      <h3>¿Qué podría ayudarte?</h3>
      ${lista}
      <p class="res-texto">Hablá con tu profe para saber qué evaluaciones quedan en el trimestre. ¡No te rindás!</p>
    </div>`;
}

/* =====================================================================
   7. VENTANA EMERGENTE (DIÁLOGO)
   ---------------------------------------------------------------------
   abrirDialogo() muestra una ventanita y devuelve una "promesa" con lo
   que eligió el estudiante: { boton: 'aceptar' | 'cancelar' | ..., valor }
   Uso: const r = await abrirDialogo({ titulo: 'Hola', ... });
   ===================================================================== */

function abrirDialogo(op) {
  const dialogo = $('#dialogo');

  // Navegadores muy viejos sin <dialog>: usamos prompt/confirm de siempre
  if (typeof dialogo.showModal !== 'function') {
    if (op.campo) {
      const valor = window.prompt(op.titulo, op.campo.valor || '');
      return Promise.resolve(valor === null ? { boton: 'cancelar' } : { boton: 'aceptar', valor });
    }
    return Promise.resolve({ boton: window.confirm(`${op.titulo}\n\n${op.mensaje || ''}`) ? 'aceptar' : 'cancelar' });
  }

  return new Promise((resolve) => {
    const campo = op.campo ? `
      <label class="campo"><span>${escapar(op.campo.etiqueta)}</span>
        <input name="campo" type="text" autocomplete="off" value="${escapar(op.campo.valor || '')}"
               placeholder="${escapar(op.campo.placeholder || '')}" inputmode="${op.campo.inputmode || 'text'}"
               maxlength="${op.campo.maxlength || 60}">
      </label>` : '';

    // Botones extra (ej. "Eliminar"). Son type="button" para no enviar el formulario.
    const extras = (op.botonesExtra || []).map((b) =>
      `<button class="btn ${b.estilo || ''}" type="button" data-valor="${b.valor}">${escapar(b.texto)}</button>`).join('');

    dialogo.innerHTML = `
      <form class="dialogo-form" novalidate>
        <h2 id="dialogo-titulo">${escapar(op.titulo)}</h2>
        ${op.mensaje ? `<p>${escapar(op.mensaje)}</p>` : ''}
        ${campo}
        ${op.extraHtml || ''}
        <p class="dialogo-error" hidden></p>
        <div class="dialogo-botones">
          <button class="btn" type="button" data-valor="cancelar">Cancelar</button>
          ${extras}
          <button class="btn ${op.estiloAceptar || 'primario'}" type="submit">${escapar(op.textoAceptar || 'Aceptar')}</button>
        </div>
      </form>`;

    const form = $('form', dialogo);
    const input = $('input[name="campo"]', dialogo);
    const error = $('.dialogo-error', dialogo);
    let terminado = false;

    function terminar(resultado) {
      if (terminado) return;
      terminado = true;
      dialogo.close();
      resolve(resultado);
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const valor = input ? input.value : undefined;
      const mensajeError = op.validar ? op.validar(valor) : null;
      if (mensajeError) {
        error.textContent = mensajeError;
        error.hidden = false;
        if (input) { input.setAttribute('aria-invalid', 'true'); input.focus(); }
        return;
      }
      terminar({ boton: 'aceptar', valor });
    });

    dialogo.onclick = (e) => {
      const boton = e.target.closest('[data-valor]');
      if (boton) { terminar({ boton: boton.dataset.valor }); return; }
      const sugerencia = e.target.closest('[data-sugerencia]');
      if (sugerencia && input) { input.value = sugerencia.dataset.sugerencia; input.focus(); }
    };
    // Tecla Escape o botón "atrás" en algunos celulares
    dialogo.onclose = () => terminar({ boton: 'cancelar' });

    dialogo.showModal();
    if (input) { input.focus(); input.select(); }
  });
}

function validarNombreMateria(valor) {
  const nombre = (valor || '').trim();
  if (!nombre) return 'Escribí un nombre para la materia.';
  if (nombre.length > 60) return 'El nombre es muy largo (máximo 60 letras).';
  return null;
}

/* =====================================================================
   8. EVENTOS
   ---------------------------------------------------------------------
   En vez de poner un "escuchador" en cada botón, ponemos uno solo en
   toda la página y revisamos el atributo data-accion del botón tocado.
   Esto se llama "delegación de eventos".
   ===================================================================== */

document.addEventListener('click', async (e) => {
  const boton = e.target.closest('[data-accion]');
  if (!boton || boton.closest('dialog')) return;
  const accion = boton.dataset.accion;
  const { id } = rutaActual();
  const materia = buscarMateria(id);

  switch (accion) {
    case 'nueva-materia': {
      const sugeridas = CONFIG.materiasSugeridas
        .filter((n) => !datos.materias.some((m) => m.nombre.toLowerCase() === n.toLowerCase()))
        .map((n) => `<button type="button" data-sugerencia="${escapar(n)}">${escapar(n)}</button>`).join('');
      const r = await abrirDialogo({
        titulo: 'Nueva materia',
        campo: { etiqueta: 'Nombre', placeholder: 'Ej. Matemática' },
        extraHtml: sugeridas ? `<div class="sugeridas" aria-label="Sugerencias">${sugeridas}</div>` : '',
        textoAceptar: 'Crear materia',
        validar: validarNombreMateria,
      });
      if (r.boton !== 'aceptar') return;
      const nueva = crearMateria(r.valor.trim());
      datos.materias.push(nueva);
      guardar();
      irA(`#/materia/${encodeURIComponent(nueva.id)}`);
      avisar('Materia creada');
      break;
    }

    case 'renombrar-materia': {
      if (!materia) return;
      const r = await abrirDialogo({
        titulo: 'Renombrar materia',
        campo: { etiqueta: 'Nuevo nombre', valor: materia.nombre },
        textoAceptar: 'Guardar',
        validar: validarNombreMateria,
      });
      if (r.boton !== 'aceptar') return;
      materia.nombre = r.valor.trim();
      guardar();
      render();
      avisar('Nombre actualizado');
      break;
    }

    case 'borrar-materia': {
      if (!materia) return;
      const r = await abrirDialogo({
        titulo: `¿Borrar ${materia.nombre}?`,
        mensaje: 'Se van a borrar también todas sus notas. Esto no se puede deshacer.',
        textoAceptar: 'Sí, borrar',
        estiloAceptar: 'peligro',
      });
      if (r.boton !== 'aceptar') return;
      datos.materias = datos.materias.filter((m) => m.id !== materia.id);
      guardar();
      location.replace('#/');
      avisar('Materia borrada');
      break;
    }

    case 'editar-nota': {
      if (!materia) return;
      const comp = buscarComponente(materia, boton.dataset.comp);
      const nota = comp && comp.notas.find((n) => n.id === boton.dataset.nota);
      if (!nota) return;
      const r = await abrirDialogo({
        titulo: `Nota de ${comp.nombre}`,
        campo: { etiqueta: 'Nota (0–100)', valor: formatoNota.format(nota.valor), inputmode: 'decimal', maxlength: 6 },
        textoAceptar: 'Guardar',
        botonesExtra: [{ texto: 'Eliminar', valor: 'eliminar', estilo: 'peligro' }],
        validar: (v) => errorDeNota(leerNumero(v)),
      });
      if (r.boton === 'eliminar') {
        comp.notas = comp.notas.filter((n) => n.id !== nota.id);
        avisar('Nota eliminada');
      } else if (r.boton === 'aceptar') {
        nota.valor = leerNumero(r.valor);
        avisar('Nota actualizada');
      } else {
        return;
      }
      guardar();
      render();
      break;
    }

    case 'restablecer-pesos': {
      if (!materia) return;
      for (const comp of materia.componentes) {
        const ejemplo = CONFIG.componentes.find((c) => c.clave === comp.clave);
        if (ejemplo) comp.peso = ejemplo.peso;
      }
      guardar();
      render();
      avisar('Porcentajes de ejemplo restablecidos');
      break;
    }

    case 'sim-menos':
      sim.cantidad = Math.max(1, sim.cantidad - 1);
      pintarResultado();
      break;

    case 'sim-mas':
      sim.cantidad = Math.min(CONFIG.maxEvaluacionesSimulador, sim.cantidad + 1);
      pintarResultado();
      break;

    case 'sim-redondeo':
      datos.ajustes.decimalesRedondeo = Number(boton.dataset.dec) === 1 ? 1 : 0;
      guardar();
      pintarResultado();
      break;

    case 'exportar': exportarDatos(); break;
    case 'importar': $('#archivo-importar').click(); break;
    case 'borrar-todo': borrarTodo(); break;
  }
});

// Formularios: agregar una nota (funciona con el botón o con "Enter" del teclado)
document.addEventListener('submit', (e) => {
  const form = e.target.closest('form.agregar-nota');
  if (!form) return;
  e.preventDefault();
  const materia = buscarMateria(rutaActual().id);
  const comp = materia && buscarComponente(materia, form.dataset.comp);
  if (!comp) return;

  const input = $('input', form);
  const valor = leerNumero(input.value);
  const error = errorDeNota(valor);
  if (error) {
    input.setAttribute('aria-invalid', 'true');
    avisar(error);
    input.focus();
    return;
  }
  comp.notas.push({ id: nuevoId(), valor, peso: 1 });
  guardar();
  render();
  // Dejamos el cursor en el mismo campo para agregar varias notas seguidas
  const mismoCampo = $(`#nota-${comp.id}`);
  if (mismoCampo) mismoCampo.focus();
  avisar(`Nota ${formatoNota.format(valor)} agregada`);
});

// Campos que cambian mientras se escribe: los porcentajes
document.addEventListener('input', (e) => {
  const campo = e.target;
  if (campo.matches('.agregar-nota input')) campo.removeAttribute('aria-invalid');

  if (campo.dataset.peso) {
    const materia = buscarMateria(rutaActual().id);
    const comp = materia && buscarComponente(materia, campo.dataset.peso);
    if (!comp) return;
    const texto = campo.value.trim();
    const valor = texto === '' ? 0 : leerNumero(texto);
    if (Number.isNaN(valor) || valor < 0 || valor > 100) {
      campo.setAttribute('aria-invalid', 'true');
      return;
    }
    campo.removeAttribute('aria-invalid');
    comp.peso = valor;
    guardar();
    refrescarCalculosMateria(materia);
  }
});

// Selects del simulador y archivo a importar
document.addEventListener('change', (e) => {
  const campo = e.target;
  if (campo.id === 'sim-materia') {
    sim.materiaId = campo.value;
    sim.compId = null; // que elija el componente por defecto de la nueva materia
    history.replaceState(null, '', `#/simulador/${encodeURIComponent(campo.value)}`);
    render();
  } else if (campo.id === 'sim-comp') {
    sim.compId = campo.value;
    pintarResultado();
  } else if (campo.id === 'archivo-importar' && campo.files[0]) {
    importarDatos(campo.files[0]);
    campo.value = ''; // permite volver a elegir el mismo archivo
  }
});

/* =====================================================================
   9. EXPORTAR / IMPORTAR / BORRAR TODO
   ===================================================================== */

function exportarDatos() {
  const texto = JSON.stringify({ app: 'CTP Pro', exportado: new Date().toISOString(), ...datos }, null, 2);
  const archivo = new Blob([texto], { type: 'application/json' });
  const enlace = document.createElement('a');
  const hoy = new Date().toISOString().slice(0, 10);
  enlace.href = URL.createObjectURL(archivo);
  enlace.download = `ctp-pro-respaldo-${hoy}.json`;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
  avisar('Respaldo descargado');
}

function importarDatos(archivo) {
  if (archivo.size > 2 * 1024 * 1024) { avisar('Ese archivo es demasiado grande'); return; }
  const lector = new FileReader();
  lector.onload = async () => {
    let nuevos;
    try {
      nuevos = normalizarDatos(JSON.parse(lector.result));
    } catch (e) {
      await abrirDialogo({ titulo: 'No se pudo importar', mensaje: 'El archivo no es un respaldo válido de CTP Pro.', textoAceptar: 'Entendido' });
      return;
    }
    const n = nuevos.materias.length;
    const r = await abrirDialogo({
      titulo: '¿Importar respaldo?',
      mensaje: `El archivo tiene ${n} ${n === 1 ? 'materia' : 'materias'}. Va a REEMPLAZAR los datos que tenés ahora en este celular.`,
      textoAceptar: 'Sí, importar',
    });
    if (r.boton !== 'aceptar') return;
    datos = nuevos;
    guardar();
    irA('#/');
    avisar('Datos importados');
  };
  lector.onerror = () => avisar('No se pudo leer el archivo');
  lector.readAsText(archivo);
}

async function borrarTodo() {
  const r = await abrirDialogo({
    titulo: '¿Borrar todos los datos?',
    mensaje: 'Se van a borrar todas tus materias y notas de este celular. Te recomendamos exportar un respaldo antes. Para confirmar, escribí BORRAR.',
    campo: { etiqueta: 'Escribí BORRAR', placeholder: 'BORRAR', maxlength: 10 },
    textoAceptar: 'Borrar todo',
    estiloAceptar: 'peligro',
    validar: (v) => ((v || '').trim().toUpperCase() === 'BORRAR' ? null : 'Escribí la palabra BORRAR para confirmar.'),
  });
  if (r.boton !== 'aceptar') return;
  datos = datosIniciales();
  guardar();
  irA('#/');
  avisar('Se borraron todos los datos');
}

/* =====================================================================
   10. ARRANQUE Y MODO SIN INTERNET
   ===================================================================== */

render();

/* El "service worker" guarda una copia de la app en el celular para que
   funcione sin internet después de la primera visita. Solo funciona si la
   página se abre desde un servidor (http/https), no con doble clic. */
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* sin internet offline, no pasa nada */ });
  });
}
