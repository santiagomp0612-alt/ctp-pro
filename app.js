/* =====================================================================
   CTP Pro — app.js
   ---------------------------------------------------------------------
   Este archivo maneja la PANTALLA: dibuja las vistas, responde a los
   toques/clics y guarda los datos en el navegador (localStorage).
   - La configuración (porcentajes, periodos, nota mínima…) está en config.js
   - La matemática está en calculos.js

   Mapa del archivo:
     1. Utilidades
     2. Datos y guardado
     3. Navegación (rutas)
     4. Vista: Inicio
     5. Vista: Detalle de materia (por periodo y del año)
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
  return n === null ? '—' : formatoUnDecimal.format(truncar(n, 1));
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
   Todo se guarda en localStorage como texto JSON. Estructura (versión 2):
   {
     version: 2,
     materias: [ {
       id, nombre,
       periodos: [                                   ← uno por cada periodo de CONFIG.periodos
         { id, componentes: [ { id, clave, nombre, peso, notas: [ { id, valor, peso } ] } ] }
       ]
     } ],
     ajustes: {
       decimalesRedondeo: 0,
       vista: 0,                ← qué se está viendo: 0 = I Periodo, 1 = II Periodo, 'anual' = Año
       pesosPeriodos: [50, 50]  ← cuánto vale cada periodo en la nota anual
     }
   }
   La versión 1 no tenía periodos (las notas estaban directo en la materia).
   normalizarDatos() convierte automáticamente los datos viejos.
   ===================================================================== */

let almacenamientoDisponible = true;

const VISTA_ANUAL = 'anual';

function pesosPeriodosPorDefecto() {
  return CONFIG.periodos.map((p) => p.peso);
}

function datosIniciales() {
  return {
    version: 2,
    materias: [],
    ajustes: { decimalesRedondeo: CONFIG.decimalesRedondeo, vista: 0, pesosPeriodos: pesosPeriodosPorDefecto() },
  };
}

// Componentes nuevos con los porcentajes de ejemplo de CONFIG
function componentesPorDefecto() {
  return CONFIG.componentes.map((c) => ({ id: nuevoId(), clave: c.clave, nombre: c.nombre, peso: c.peso, notas: [] }));
}

function crearMateria(nombre) {
  return { id: nuevoId(), nombre, periodos: CONFIG.periodos.map(() => ({ id: nuevoId(), componentes: componentesPorDefecto() })) };
}

function nombrePeriodo(indice) {
  return CONFIG.periodos[indice].nombre;
}

const esNumero = (n) => typeof n === 'number' && Number.isFinite(n);

// Limpia la lista de componentes de un periodo (ver normalizarDatos)
function normalizarComponentes(comps) {
  return comps
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
    }));
}

/* Revisa y "limpia" datos que vienen de afuera (localStorage o un archivo
   importado). Si algo viene mal, lo corrige o lo descarta para que la app
   nunca se caiga. Si el formato es irreconocible, lanza un error. */
function normalizarDatos(obj) {
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.materias)) {
    throw new Error('El archivo no tiene el formato de CTP Pro.');
  }

  const materias = obj.materias
    .filter((m) => m && typeof m === 'object')
    .map((m) => {
      // Datos viejos (versión 1): las notas estaban en m.componentes → pasan al I Periodo
      let periodosOriginales = [];
      if (Array.isArray(m.periodos)) periodosOriginales = m.periodos;
      else if (Array.isArray(m.componentes)) periodosOriginales = [{ componentes: m.componentes }];

      let plantilla = null; // porcentajes del primer periodo, para copiarlos a periodos nuevos
      const periodos = CONFIG.periodos.map((_, i) => {
        const original = periodosOriginales[i];
        let comps;
        if (original && Array.isArray(original.componentes) && original.componentes.length) {
          comps = normalizarComponentes(original.componentes);
        } else if (plantilla) {
          // Periodo nuevo: mismos componentes y porcentajes del primero, pero sin notas
          comps = plantilla.map((c) => ({ ...c, id: nuevoId(), notas: [] }));
        } else {
          comps = componentesPorDefecto();
        }
        if (!plantilla) plantilla = comps;
        return { id: String((original && original.id) || nuevoId()), componentes: comps };
      });

      return {
        id: String(m.id || nuevoId()),
        nombre: String(m.nombre || 'Materia sin nombre').trim().slice(0, 60) || 'Materia sin nombre',
        periodos,
      };
    });

  const a = obj.ajustes || {};
  const dec = [0, 1].includes(a.decimalesRedondeo) ? a.decimalesRedondeo : CONFIG.decimalesRedondeo;
  const vistaValida = a.vista === VISTA_ANUAL || (Number.isInteger(a.vista) && a.vista >= 0 && a.vista < CONFIG.periodos.length);
  const pesosValidos = Array.isArray(a.pesosPeriodos) && a.pesosPeriodos.length === CONFIG.periodos.length &&
    a.pesosPeriodos.every((p) => esNumero(p) && p >= 0 && p <= 100);

  return {
    version: 2,
    materias,
    ajustes: {
      decimalesRedondeo: dec,
      vista: vistaValida ? a.vista : 0,
      pesosPeriodos: pesosValidos ? a.pesosPeriodos.slice() : pesosPeriodosPorDefecto(),
    },
  };
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

// Busca un componente en cualquier periodo de la materia (los id son únicos)
function buscarComponente(materia, compId) {
  for (const periodo of materia.periodos) {
    const comp = periodo.componentes.find((c) => c.id === compId);
    if (comp) return comp;
  }
  return null;
}

function vistaEsAnual() {
  return datos.ajustes.vista === VISTA_ANUAL;
}

// Periodo que se está viendo (null si se está viendo el Año)
function periodoActivo(materia) {
  return vistaEsAnual() ? null : materia.periodos[datos.ajustes.vista];
}

function pesosPeriodosValidos() {
  return Math.abs(sumaLista(datos.ajustes.pesosPeriodos) - 100) < 1e-9;
}

// Opciones para el simulador (de CONFIG + lo que eligió el estudiante)
function opcionesCalculo(notaMinima = CONFIG.notaMinima) {
  return { notaMinima, notaMaxima: CONFIG.notaMaxima, decimales: datos.ajustes.decimalesRedondeo };
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
  // Al entrar al simulador, que arranque con el periodo que se estaba viendo
  if (rutaActual().vista === 'simulador') reiniciarSimulador();
  render();
  window.scrollTo(0, 0);
  // Mueve el foco al contenido para lectores de pantalla
  $('#app').focus({ preventScroll: true });
});

/* =====================================================================
   4. VISTA: INICIO (lista de materias)
   ===================================================================== */

// Botones para elegir qué ver: I Periodo | II Periodo | Año
function htmlSelectorVista() {
  const botones = CONFIG.periodos.map((p, i) =>
    `<button type="button" data-accion="vista" data-vista="${i}" aria-pressed="${datos.ajustes.vista === i}">${escapar(p.nombre)}</button>`);
  botones.push(`<button type="button" data-accion="vista" data-vista="${VISTA_ANUAL}" aria-pressed="${vistaEsAnual()}">Año</button>`);
  return `<div class="segmentado pestanas" role="group" aria-label="Qué querés ver" style="--columnas:${botones.length}">${botones.join('')}</div>`;
}

// Resultado (promedio) de lo que se está viendo: un periodo o el año
function resultadoVista(materia) {
  if (vistaEsAnual()) return promedioAnual(materia, datos.ajustes.pesosPeriodos);
  return promedioPeriodo(periodoActivo(materia));
}

// Convierte un promedio en estado: verde / rojo / gris
function estadoDe(promedio) {
  if (promedio === null) return { clase: 'sin-notas', texto: 'Sin notas todavía' };
  const aprobando = promedio >= CONFIG.notaMinima;
  return { clase: aprobando ? 'aprobando' : 'riesgo', texto: aprobando ? 'Va aprobando' : `Por debajo de ${CONFIG.notaMinima}` };
}

// ¿Hay porcentajes que no suman 100 en lo que se está viendo?
function hayPorcentajesMalos(materia) {
  if (vistaEsAnual()) return !pesosPeriodosValidos() || materia.periodos.some((p) => !porcentajesValidos(p));
  return !porcentajesValidos(periodoActivo(materia));
}

function htmlTarjetaMateria(materia) {
  const r = resultadoVista(materia);
  const { clase, texto } = estadoDe(r.promedio);
  const ancho = r.promedio === null ? 0 : Math.min(100, r.promedio);
  const etiquetas = [
    `<span class="pastilla">${texto}</span>`,
    r.promedio !== null && r.parcial ? '<span class="etiqueta">Parcial</span>' : '',
    hayPorcentajesMalos(materia) ? '<span class="etiqueta alerta">Revisar %</span>' : '',
  ].join('');
  // En la vista del año mostramos también cada periodo: "I Periodo 80,0 · II Periodo —"
  const desglose = vistaEsAnual()
    ? `<p class="tm-desglose">${r.porPeriodo.map((rp, i) => `${escapar(nombrePeriodo(i))}: ${mostrarPromedio(rp.promedio)}`).join(' · ')}</p>`
    : '';

  return `
    <li>
      <a class="tarjeta-materia estado-${clase}" href="#/materia/${encodeURIComponent(materia.id)}">
        <div class="tm-texto">
          <h2 class="tm-nombre">${escapar(materia.nombre)}</h2>
          <p class="tm-estado">${etiquetas}</p>
          ${desglose}
        </div>
        <div class="tm-numero"><span class="solo-lector">${vistaEsAnual() ? 'Nota anual' : 'Promedio'} </span>${mostrarPromedio(r.promedio)}</div>
        <div class="barra" aria-hidden="true"><span style="width:${ancho}%"></span><i style="left:${CONFIG.notaMinima}%"></i></div>
      </a>
    </li>`;
}

/* "Apoyá el proyecto": SINPE Móvil y patrocinador (se configuran en config.js).
   Si no hay número de SINPE ni patrocinador, no se muestra nada. */
function soloDigitos(texto) {
  return String(texto || '').replace(/\D/g, '');
}

// "88887777" → "8888-7777"
function formatoTelefono(numero) {
  const d = soloDigitos(numero);
  return d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4)}` : d;
}

// Solo aceptamos enlaces seguros (https://…, como los de WhatsApp https://wa.me/…); lo demás se ignora
function enlaceSeguro(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' ? u.href : null;
  } catch (e) {
    return null;
  }
}

function htmlPatrocinador() {
  const p = CONFIG.apoyo && CONFIG.apoyo.patrocinador;
  if (!p || !p.nombre) return '';
  const enlace = enlaceSeguro(p.enlace);
  // El logo solo puede ser un archivo del propio proyecto (sin "//" ni "http")
  const logo = p.logo && !/^[a-z]+:|\/\//i.test(p.logo)
    ? `<img class="patro-logo" src="${escapar(p.logo)}" alt="" width="48" height="48" loading="lazy">` : '';
  const contenido = `
    ${logo}
    <span class="patro-texto">
      <span class="patro-etiqueta">Con el apoyo de</span>
      <strong>${escapar(p.nombre)}</strong>
      ${p.mensaje ? `<span class="patro-mensaje">${escapar(p.mensaje)}</span>` : ''}
    </span>`;
  // rel="sponsored noopener noreferrer": la otra página no sabe de dónde vino el estudiante
  return enlace
    ? `<a class="patrocinador" href="${escapar(enlace)}" target="_blank" rel="sponsored noopener noreferrer">${contenido}</a>`
    : `<div class="patrocinador">${contenido}</div>`;
}

function htmlApoyo() {
  const sinpe = CONFIG.apoyo && CONFIG.apoyo.sinpe;
  const numero = sinpe ? soloDigitos(sinpe.numero) : '';
  const patro = htmlPatrocinador();
  if (numero.length !== 8 && !patro) return '';

  const bloqueSinpe = numero.length === 8 ? `
    <p>CTP Pro es gratis y siempre lo va a ser. Si te ayudó a salvar una nota, podés apoyar con lo que querás por <strong>SINPE Móvil</strong>:</p>
    <div class="sinpe">
      <div>
        <p class="sinpe-numero">${formatoTelefono(numero)}</p>
        ${sinpe.titular ? `<p class="sinpe-titular">A nombre de ${escapar(sinpe.titular)}</p>` : ''}
      </div>
      <button class="btn chico" type="button" data-accion="copiar-sinpe" data-numero="${numero}">Copiar número</button>
    </div>
    <p class="apoyo-nota">Totalmente voluntario: la app funciona igual, apoyés o no. 💛</p>` : '';

  return `
    <section class="panel apoyo" aria-labelledby="titulo-apoyo">
      <h2 id="titulo-apoyo">Apoyá el proyecto</h2>
      ${bloqueSinpe}
      ${patro}
    </section>`;
}

// Copia un texto al portapapeles (con plan B para celulares viejos)
async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch (e) {
    const campo = document.createElement('textarea');
    campo.value = texto;
    campo.setAttribute('readonly', '');
    campo.style.position = 'fixed';
    campo.style.opacity = '0';
    document.body.appendChild(campo);
    campo.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
    campo.remove();
    return ok;
  }
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
        <p>Llevá tus notas de cada periodo, mirá tu nota del año y averiguá qué necesitás para llegar al ${CONFIG.notaMinima}.</p>
      </div>
      ${avisoGuardado}
      ${hayMaterias ? htmlSelectorVista() : ''}
      ${lista}
      <button class="btn primario ancho" type="button" data-accion="nueva-materia">+ Agregar materia</button>
      ${hayMaterias ? '<a class="btn acento ancho" href="#/simulador">🎯 ¿Qué nota necesito?</a>' : ''}

      ${htmlApoyo()}

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

// Tarjeta grande con el promedio del periodo que se está viendo
function htmlResumenPeriodo(materia) {
  const indice = datos.ajustes.vista;
  const r = promedioPeriodo(materia.periodos[indice]);
  const { clase, texto } = estadoDe(r.promedio);
  const titulo = `Promedio del ${escapar(nombrePeriodo(indice))}`;
  if (r.promedio === null) {
    return `
      <div class="panel resumen estado-sin-notas">
        <p class="resumen-etiqueta">${titulo}</p>
        <p class="resumen-numero">—</p>
        <p><span class="pastilla">${texto}</span></p>
        <p class="resumen-detalle">Agregá tu primera nota de este periodo en cualquiera de los componentes de abajo.</p>
      </div>`;
  }
  const faltan = r.componentesSinNotas.map((c) => escapar(c.nombre));
  const detalle = r.parcial
    ? `<strong>Promedio parcial:</strong> calculado solo con lo evaluado hasta ahora (${formatoPorcentaje.format(r.pesoEvaluado)}% de la nota). Todavía sin notas: ${listaBonita(faltan)}.`
    : 'Promedio con todos los componentes evaluados.';
  return `
    <div class="panel resumen estado-${clase}">
      <p class="resumen-etiqueta">${titulo}${r.parcial ? ' (parcial)' : ''}</p>
      <p class="resumen-numero">${mostrarPromedio(r.promedio)}</p>
      <p><span class="pastilla">${texto}</span></p>
      <p class="resumen-detalle">${detalle}</p>
    </div>`;
}

// Tarjeta grande con la nota del año
function htmlResumenAnual(materia) {
  const r = promedioAnual(materia, datos.ajustes.pesosPeriodos);
  const { clase, texto } = estadoDe(r.promedio);
  let detalle;
  if (r.promedio === null) {
    detalle = 'Todavía no hay notas en ningún periodo.';
  } else if (r.periodosSinNotas.length) {
    detalle = `<strong>Nota anual parcial:</strong> todavía sin notas: ${listaBonita(r.periodosSinNotas.map((i) => escapar(nombrePeriodo(i))))}. Por ahora se calcula con lo que ya tenés.`;
  } else if (r.parcial) {
    detalle = '<strong>Nota anual parcial:</strong> algún periodo todavía tiene componentes sin notas.';
  } else {
    detalle = 'Nota con todos los periodos evaluados.';
  }
  return `
    <div class="panel resumen estado-${clase}">
      <p class="resumen-etiqueta">Nota del año${r.promedio !== null && r.parcial ? ' (parcial)' : ''}</p>
      <p class="resumen-numero">${mostrarPromedio(r.promedio)}</p>
      <p><span class="pastilla">${texto}</span></p>
      <p class="resumen-detalle">${detalle}</p>
    </div>`;
}

// Mensaje cuando una lista de porcentajes no suma 100
function htmlSumaGenerica(suma, queSuma) {
  if (Math.abs(suma - 100) < 1e-9) {
    return `<div class="suma ok"><span>✓ ${queSuma} suman 100%</span></div>`;
  }
  const diferencia = formatoPorcentaje.format(Math.abs(100 - suma));
  const pista = suma > 100 ? `sobran ${diferencia}%` : `faltan ${diferencia}%`;
  return `<div class="aviso mal" role="alert">${queSuma} suman ${formatoPorcentaje.format(suma)}% (${pista}). Tienen que sumar exactamente 100% para que las notas y el simulador sean correctos.</div>`;
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

// Contenido cuando se está viendo UN periodo: sus componentes y notas
function htmlContenidoPeriodo(materia) {
  const periodo = periodoActivo(materia);
  return `
    <div id="resumen">${htmlResumenPeriodo(materia)}</div>
    <a class="btn acento ancho" href="#/simulador/${encodeURIComponent(materia.id)}">🎯 ¿Qué nota necesito?</a>

    <p class="aviso">Porcentajes de ejemplo: confirmalos con la tabla oficial de tu colegio. Podés cambiarlos en cada componente.</p>
    <div id="suma">${htmlSumaGenerica(sumaPorcentajes(periodo), 'Los porcentajes')}</div>

    ${periodo.componentes.map(htmlComponente).join('')}

    <button class="btn chico" type="button" data-accion="restablecer-pesos">Volver a los porcentajes de ejemplo</button>`;
}

// Contenido cuando se está viendo el AÑO: nota anual y cuánto vale cada periodo
function htmlContenidoAnual(materia) {
  const r = promedioAnual(materia, datos.ajustes.pesosPeriodos);
  const filas = CONFIG.periodos.map((p, i) => {
    const rp = r.porPeriodo[i];
    const { clase } = estadoDe(rp.promedio);
    return `
      <div class="fila-periodo">
        <button type="button" class="fila-periodo-ir estado-${clase}" data-accion="vista" data-vista="${i}">
          <span class="fila-periodo-nombre">${escapar(p.nombre)}${rp.promedio !== null && rp.parcial ? ' <span class="etiqueta">Parcial</span>' : ''}</span>
          <span class="fila-periodo-numero">${mostrarPromedio(rp.promedio)}</span>
        </button>
        <label class="peso">Vale
          <input type="text" inputmode="decimal" value="${formatoPorcentaje.format(datos.ajustes.pesosPeriodos[i])}"
                 data-peso-periodo="${i}" aria-label="Porcentaje del ${escapar(p.nombre)} en la nota anual" maxlength="5">%
        </label>
      </div>`;
  }).join('');

  return `
    <div id="resumen">${htmlResumenAnual(materia)}</div>
    <a class="btn acento ancho" href="#/simulador/${encodeURIComponent(materia.id)}">🎯 ¿Qué necesito para aprobar el año?</a>

    <section class="panel periodos-anual" aria-labelledby="titulo-periodos">
      <h2 id="titulo-periodos">Periodos</h2>
      <p class="sub">Tocá un periodo para ver y agregar sus notas.</p>
      ${filas}
    </section>
    <p class="aviso">Porcentajes de ejemplo: ${listaBonita(CONFIG.periodos.map((p) => `${escapar(p.nombre)} ${formatoPorcentaje.format(p.peso)}%`))} de la nota del año. Confirmá con tu colegio cómo se calcula. Si cambiás estos porcentajes, se aplican a todas tus materias.</p>
    <div id="suma">${htmlSumaGenerica(sumaLista(datos.ajustes.pesosPeriodos), 'Los porcentajes de los periodos')}</div>
    <button class="btn chico" type="button" data-accion="restablecer-pesos-periodos">Volver a los porcentajes de ejemplo</button>`;
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
      ${htmlSelectorVista()}
      ${vistaEsAnual() ? htmlContenidoAnual(materia) : htmlContenidoPeriodo(materia)}
    </section>`;
}

// Actualiza solo los números (sin redibujar todo) mientras se escribe un porcentaje
function refrescarCalculosMateria(materia) {
  if (vistaEsAnual()) {
    $('#resumen').innerHTML = htmlResumenAnual(materia);
    $('#suma').innerHTML = htmlSumaGenerica(sumaLista(datos.ajustes.pesosPeriodos), 'Los porcentajes de los periodos');
  } else {
    $('#resumen').innerHTML = htmlResumenPeriodo(materia);
    $('#suma').innerHTML = htmlSumaGenerica(sumaPorcentajes(periodoActivo(materia)), 'Los porcentajes');
  }
}

/* =====================================================================
   6. VISTA: SIMULADOR "¿QUÉ NOTA NECESITO?"
   ---------------------------------------------------------------------
   Dos metas posibles:
   - 'periodo': terminar el periodo elegido con 70
   - 'anual':   que la nota del AÑO llegue a 70. Primero calculamos qué
                promedio hace falta en el periodo (metaDelPeriodoParaAnual)
                y luego la nota de la evaluación para llegar a ese promedio.
   ===================================================================== */

// Lo que el estudiante eligió en el simulador (se recuerda mientras la app está abierta)
const sim = { materiaId: null, periodo: null, compId: null, clave: null, cantidad: 1, meta: 'periodo' };

// Al entrar al simulador: usar el periodo que se estaba viendo
function reiniciarSimulador() {
  sim.periodo = null;
  sim.meta = vistaEsAnual() ? 'anual' : 'periodo';
}

// Periodo "más reciente" con notas (si se viene de la vista del Año)
function periodoPorDefecto(materia) {
  if (!vistaEsAnual()) return datos.ajustes.vista;
  for (let i = materia.periodos.length - 1; i >= 0; i--) {
    if (promedioPeriodo(materia.periodos[i]).promedio !== null) return i;
  }
  return 0;
}

function prepararSimulador(idDeRuta) {
  if (idDeRuta && buscarMateria(idDeRuta)) sim.materiaId = idDeRuta;
  const materia = buscarMateria(sim.materiaId) || datos.materias[0];
  if (!materia) return null;
  sim.materiaId = materia.id;
  if (!Number.isInteger(sim.periodo) || !materia.periodos[sim.periodo]) sim.periodo = periodoPorDefecto(materia);

  // Mantener el mismo componente (por su "clave") aunque se cambie de periodo o de materia
  const comps = materia.periodos[sim.periodo].componentes;
  const comp = comps.find((c) => c.id === sim.compId)
    || (sim.clave && comps.find((c) => c.clave === sim.clave))
    || comps.find((c) => c.clave === CONFIG.componenteSimuladorPorDefecto)
    || comps[0];
  sim.compId = comp.id;
  sim.clave = comp.clave;
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

  const periodo = materia.periodos[sim.periodo];
  const opcionesMaterias = datos.materias.map((m) =>
    `<option value="${m.id}" ${m.id === materia.id ? 'selected' : ''}>${escapar(m.nombre)}</option>`).join('');
  const opcionesPeriodos = CONFIG.periodos.map((p, i) =>
    `<option value="${i}" ${i === sim.periodo ? 'selected' : ''}>${escapar(p.nombre)}</option>`).join('');
  const opcionesComps = periodo.componentes.map((c) =>
    `<option value="${c.id}" ${c.id === sim.compId ? 'selected' : ''}>${escapar(c.nombre)} (${formatoPorcentaje.format(c.peso)}%)</option>`).join('');

  return `
    <section class="vista">
      <div><a href="#/materia/${encodeURIComponent(materia.id)}" class="btn-volver">← ${escapar(materia.nombre)}</a></div>
      <div class="intro">
        <h1>¿Qué nota necesito?</h1>
        <p>Elegí tu próxima evaluación y te decimos la nota mínima para llegar al ${CONFIG.notaMinima} en el periodo o en el año.</p>
      </div>

      <div class="panel form-sim">
        <div class="campo">
          <span id="etq-meta">¿Qué querés lograr?</span>
          <div class="segmentado" role="group" aria-labelledby="etq-meta">
            <button type="button" data-accion="sim-meta" data-meta="periodo">Aprobar el periodo</button>
            <button type="button" data-accion="sim-meta" data-meta="anual">Aprobar el año</button>
          </div>
        </div>
        <label class="campo"><span>Materia</span>
          <select id="sim-materia">${opcionesMaterias}</select>
        </label>
        <label class="campo"><span>¿En qué periodo es la evaluación?</span>
          <select id="sim-periodo">${opcionesPeriodos}</select>
        </label>
        <label class="campo"><span>¿De qué componente es?</span>
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
          <p>El promedio de cada periodo es la suma de (promedio de cada componente × su porcentaje).</p>
          <p>La nota del año es la suma de (promedio de cada periodo × su porcentaje). Esos porcentajes se cambian en la pestaña "Año" de cualquier materia.</p>
          <p>El simulador agrega la o las evaluaciones que faltan con la misma nota y busca la nota más baja con la que llegás a ${CONFIG.notaMinima}.</p>
          <p>Si un componente o un periodo todavía no tiene notas, no se toma en cuenta (igual que en el promedio parcial). Cuando le pongás notas, el resultado puede cambiar.</p>
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
  const periodo = materia.periodos[sim.periodo];
  const nombreP = escapar(nombrePeriodo(sim.periodo));
  const esAnual = sim.meta === 'anual';
  const pesos = datos.ajustes.pesosPeriodos;

  // Actualizar controles
  $('#sim-cantidad').textContent = sim.cantidad;
  document.querySelectorAll('[data-accion="sim-redondeo"]').forEach((b) => {
    b.setAttribute('aria-pressed', String(Number(b.dataset.dec) === datos.ajustes.decimalesRedondeo));
  });
  document.querySelectorAll('[data-accion="sim-meta"]').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.meta === sim.meta));
  });

  const enlaceMateria = `#/materia/${encodeURIComponent(materia.id)}`;
  const error = (titulo, texto) => {
    caja.className = 'resultado imposible';
    caja.innerHTML = `<p class="res-titulo">${titulo}</p><p class="res-texto">${texto}</p>
      <a class="btn primario" href="${enlaceMateria}">Ir a ${escapar(materia.nombre)}</a>`;
  };

  if (!porcentajesValidos(periodo)) {
    error('Primero arreglá los porcentajes',
      `En ${escapar(materia.nombre)} (${nombreP}) suman ${formatoPorcentaje.format(sumaPorcentajes(periodo))}% y tienen que sumar 100%.`);
    return;
  }

  // Meta del periodo: 70, o lo que haga falta en este periodo para que el año llegue a 70
  let metaPeriodo = CONFIG.notaMinima;
  if (esAnual) {
    if (!pesosPeriodosValidos()) {
      error('Primero arreglá los porcentajes del año',
        `Los periodos suman ${formatoPorcentaje.format(sumaLista(pesos))}% y tienen que sumar 100%. Se cambian en la pestaña "Año".`);
      return;
    }
    metaPeriodo = metaDelPeriodoParaAnual(materia, sim.periodo, pesos, CONFIG.notaMinima);
    if (metaPeriodo === null) {
      caja.className = 'resultado';
      caja.innerHTML = `<p class="res-titulo">El ${nombreP} vale 0% en la nota del año</p><p class="res-texto">Elegí otro periodo.</p>`;
      return;
    }
  }

  const op = opcionesCalculo(metaPeriodo);
  const r = notaNecesaria(periodo, sim.compId, sim.cantidad, op);
  const dec = op.decimales;

  if (r.estado === 'sin-peso') {
    caja.className = 'resultado';
    caja.innerHTML = '<p class="res-titulo">Ese componente vale 0%</p><p class="res-texto">Una evaluación ahí no cambia tu promedio. Elegí otro componente.</p>';
    return;
  }

  // Textos que cambian según la meta
  const metaTexto = esAnual ? `aprobar el año con ${CONFIG.notaMinima}` : `terminar el ${nombreP} con ${CONFIG.notaMinima}`;
  // Convierte el promedio final del periodo en el texto "el periodo queda en X (y el año en Y)"
  const comoQueda = (promPeriodo) => esAnual
    ? `el año quedaría en ${mostrarPromedio(anualConPromedioDePeriodo(materia, sim.periodo, pesos, promPeriodo))} (el ${nombreP} en ${mostrarPromedio(promPeriodo)})`
    : `el ${nombreP} quedaría en ${mostrarPromedio(promPeriodo)}`;

  const nombreComp = escapar(r.componente.nombre);
  const enCuales = r.cantidad === 1
    ? `en tu próxima evaluación de <strong>${nombreComp}</strong> (${nombreP})`
    : `en <strong>cada una</strong> de las ${r.cantidad} evaluaciones de <strong>${nombreComp}</strong> (${nombreP})`;

  // Explicación de la meta anual: "para aprobar el año necesitás 60 de promedio en el II Periodo"
  const otrosConNotas = CONFIG.periodos
    .map((p, i) => ({ i, prom: promedioPeriodo(materia.periodos[i]).promedio }))
    .filter((x) => x.i !== sim.periodo && x.prom !== null);
  const notaMetaAnual = esAnual && otrosConNotas.length
    ? `<p class="res-nota">Como ${listaBonita(otrosConNotas.map((x) => `el ${escapar(nombrePeriodo(x.i))} va en ${mostrarPromedio(x.prom)}`))}, para aprobar el año necesitás un promedio de <strong>${mostrarConDecimales(Math.max(0, redondearArriba(metaPeriodo, 1)), 1)}</strong> en el ${nombreP}.</p>`
    : '';

  // Nota sobre componentes que no entran al cálculo
  const n = r.ignorados.length;
  const notaIgnorados = n
    ? `<p class="res-nota">Ojo: ${listaBonita(r.ignorados.map((c) => escapar(c.nombre)))} del ${nombreP} ${n === 1 ? 'todavía no tiene' : 'todavía no tienen'} notas, así que no ${n === 1 ? 'entra' : 'entran'} en este cálculo. Cuando ${n === 1 ? 'tenga' : 'tengan'} notas, el resultado puede cambiar.</p>`
    : '';

  if (r.estado === 'asegurado') {
    caja.className = 'resultado asegurado';
    caja.innerHTML = `
      <p class="res-numero" aria-hidden="true">✓</p>
      <p class="res-grande">${esAnual ? 'Ya tenés el año asegurado' : `Ya tenés el ${CONFIG.notaMinima} asegurado`}</p>
      <p class="res-texto">Aunque sacaras 0 ${enCuales}, ${comoQueda(r.finalConCero)}. ¡Buen trabajo! Igual, ¡dale con todo!</p>
      ${notaMetaAnual}
      ${notaIgnorados}`;
    return;
  }

  if (r.estado === 'imposible') {
    caja.className = 'resultado imposible';
    caja.innerHTML = `
      <p class="res-grande">Con esta evaluación ya no alcanzás los ${CONFIG.notaMinima}${esAnual ? ' del año' : ''}</p>
      <p class="res-texto">Aunque sacaras ${CONFIG.notaMaxima} ${enCuales}, ${comoQueda(r.maximoAlcanzable)}. Necesitarías ${mostrarConDecimales(redondearArriba(r.exacta, dec), dec)}, que es más de ${CONFIG.notaMaxima}.</p>
      ${notaMetaAnual}
      ${htmlSugerencias(periodo, r, op)}
      ${notaIgnorados}`;
    return;
  }

  // Estado "posible"
  caja.className = 'resultado posible';
  const exactaTexto = formatoNota.format(r.exacta);
  caja.innerHTML = `
    <p class="res-titulo">Necesitás sacar al menos</p>
    <p class="res-numero">${mostrarConDecimales(r.nota, dec)}</p>
    <p class="res-texto">${enCuales} para ${metaTexto}.</p>
    <p class="res-texto">Con esa nota ${comoQueda(r.finalConNota)}${exactaTexto !== mostrarConDecimales(r.nota, dec) ? ` · nota exacta: ${exactaTexto}` : ''}.</p>
    ${notaMetaAnual}
    ${notaIgnorados}`;
}

/* Cuando ya no se alcanza la meta, buscamos qué podría ayudar:
   1) que quedaran más evaluaciones en el mismo componente
   2) sacando 100 en lo elegido, cuánto haría falta en UNA evaluación de otro componente */
function htmlSugerencias(periodo, r, op) {
  const dec = op.decimales;
  const ideas = [];

  for (let k = sim.cantidad + 1; k <= CONFIG.maxEvaluacionesSimulador; k++) {
    const otra = notaNecesaria(periodo, sim.compId, k, op);
    if (otra.estado === 'posible') {
      ideas.push(`Si quedaran <strong>${k}</strong> evaluaciones de ${escapar(r.componente.nombre)}, necesitarías ${mostrarConDecimales(otra.nota, dec)} en cada una.`);
      break;
    }
  }

  const conCien = conNotasHipoteticas(periodo, [{ compId: sim.compId, valor: CONFIG.notaMaxima, cantidad: sim.cantidad }]);
  for (const comp of periodo.componentes) {
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
      <p class="res-texto">Hablá con tu profe para saber qué evaluaciones quedan en el periodo. ¡No te rindás!</p>
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
    case 'vista': {
      // Cambiar entre I Periodo / II Periodo / Año (se recuerda para todas las materias)
      const valor = boton.dataset.vista;
      datos.ajustes.vista = valor === VISTA_ANUAL ? VISTA_ANUAL : Number(valor);
      guardar();
      render();
      break;
    }

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
      // Si se estaba viendo el Año, abrimos la materia nueva en el primer periodo para poner notas
      if (vistaEsAnual()) datos.ajustes.vista = 0;
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
        mensaje: 'Se van a borrar también todas sus notas de todos los periodos. Esto no se puede deshacer.',
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
      const periodo = materia && periodoActivo(materia);
      if (!periodo) return;
      for (const comp of periodo.componentes) {
        const ejemplo = CONFIG.componentes.find((c) => c.clave === comp.clave);
        if (ejemplo) comp.peso = ejemplo.peso;
      }
      guardar();
      render();
      avisar('Porcentajes de ejemplo restablecidos');
      break;
    }

    case 'restablecer-pesos-periodos':
      datos.ajustes.pesosPeriodos = pesosPeriodosPorDefecto();
      guardar();
      render();
      avisar('Porcentajes de ejemplo restablecidos');
      break;

    case 'sim-meta':
      sim.meta = boton.dataset.meta === 'anual' ? 'anual' : 'periodo';
      pintarResultado();
      break;

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

    case 'copiar-sinpe': {
      const ok = await copiarTexto(boton.dataset.numero);
      avisar(ok ? 'Número copiado. ¡Gracias por apoyar! 💛' : `Anotá el número: ${formatoTelefono(boton.dataset.numero)}`);
      break;
    }

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

// Lee un porcentaje escrito en un campo. Devuelve null (y marca el campo en rojo) si no es válido.
function leerPorcentaje(campo) {
  const texto = campo.value.trim();
  const valor = texto === '' ? 0 : leerNumero(texto);
  if (Number.isNaN(valor) || valor < 0 || valor > 100) {
    campo.setAttribute('aria-invalid', 'true');
    return null;
  }
  campo.removeAttribute('aria-invalid');
  return valor;
}

// Campos que cambian mientras se escribe: los porcentajes
document.addEventListener('input', (e) => {
  const campo = e.target;
  if (campo.matches('.agregar-nota input')) campo.removeAttribute('aria-invalid');

  const materia = buscarMateria(rutaActual().id);
  if (!materia) return;

  if (campo.dataset.peso) {
    // Porcentaje de un componente
    const comp = buscarComponente(materia, campo.dataset.peso);
    const valor = leerPorcentaje(campo);
    if (!comp || valor === null) return;
    comp.peso = valor;
    guardar();
    refrescarCalculosMateria(materia);
  } else if (campo.dataset.pesoPeriodo !== undefined) {
    // Porcentaje de un periodo en la nota del año
    const valor = leerPorcentaje(campo);
    if (valor === null) return;
    datos.ajustes.pesosPeriodos[Number(campo.dataset.pesoPeriodo)] = valor;
    guardar();
    refrescarCalculosMateria(materia);
  }
});

// Selects del simulador y archivo a importar
document.addEventListener('change', (e) => {
  const campo = e.target;
  if (campo.id === 'sim-materia') {
    sim.materiaId = campo.value;
    sim.compId = null; // se busca el mismo componente (por clave) en la nueva materia
    history.replaceState(null, '', `#/simulador/${encodeURIComponent(campo.value)}`);
    render();
  } else if (campo.id === 'sim-periodo') {
    sim.periodo = Number(campo.value);
    sim.compId = null;
    render();
  } else if (campo.id === 'sim-comp') {
    sim.compId = campo.value;
    const materia = buscarMateria(sim.materiaId);
    const comp = materia && buscarComponente(materia, campo.value);
    if (comp) sim.clave = comp.clave;
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
      // normalizarDatos también convierte respaldos viejos (sin periodos)
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

// Si había datos viejos (versión 1), guardarlos ya convertidos a periodos
if (almacenamientoDisponible && datos.materias.length) guardar();

if (rutaActual().vista === 'simulador') reiniciarSimulador();
render();

/* El "service worker" guarda una copia de la app en el celular para que
   funcione sin internet después de la primera visita. Solo funciona si la
   página se abre desde un servidor (http/https), no con doble clic. */
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* sin internet offline, no pasa nada */ });
  });
}
