# CTP Pro

Calculadora gratuita de promedio trimestral para estudiantes de CTP en Costa Rica.
Simula qué nota necesitás en tu próxima evaluación para llegar al 70.

Hecho por Santiago Muñoz Pérez, estudiante de CTP · Tus datos se quedan en tu celular.

## Privacidad

- No hay servidor, base de datos, analytics ni librerías externas.
- Todo se guarda en el navegador del estudiante (`localStorage`).
- Funciona sin internet después de la primera visita (gracias a `sw.js`).

## Archivos

| Archivo | Para qué sirve |
|---|---|
| `index.html` | La estructura de la página |
| `style.css` | Colores, tamaños y diseño (modo claro y oscuro) |
| `config.js` | **Valores por defecto**: porcentajes, nota mínima, redondeo… |
| `calculos.js` | Toda la matemática (promedios y simulador) |
| `app.js` | Las pantallas, los botones y el guardado |
| `sw.js` | Hace que la app funcione sin internet |
| `manifest.webmanifest`, `icono*.{svg,png}` | Para "Agregar a pantalla de inicio" |
| `pruebas/pruebas-calculos.js` | Pruebas automáticas de los cálculos |

## Cambiar los porcentajes oficiales

Abrí `config.js` y cambiá los números de `componentes`. Tienen que sumar 100.

## Correr las pruebas

Con [Node.js](https://nodejs.org) instalado, desde esta carpeta:

```bash
node pruebas/pruebas-calculos.js
```

## Probarlo en tu computadora

```bash
python3 -m http.server 8000
```

Luego abrí http://localhost:8000 en el navegador. (En Windows puede ser `python` en vez de `python3`.)
Abrir `index.html` con doble clic también funciona, pero sin el modo sin internet.

## Después de publicar un cambio

Abrí `sw.js` y subí la versión (`ctp-pro-v1` → `ctp-pro-v2`). Los celulares que ya tenían la app
reciben la versión nueva la segunda vez que la abren.
