# Diseño: el palo como dato

Fecha: 2026-09-16 · Estado: aprobado en conversación, pendiente de revisión escrita

## Objetivo

Poder cambiar de **palo** en un desplegable, empezando por dos: el compás de
doce que ya existe y tangos en 4/4. Hoy el compás de doce está clavado en
constantes de módulo; el trabajo es convertirlo en datos para que añadir un
palo sea añadir una fila, no tocar lógica.

No entra React ni ninguna dependencia: lo que crece es una dimensión de datos,
no la complejidad de la interfaz. La UI crece en un `<select>`.

## Estado actual: qué está clavado

En `assets/compas.js`:

- `SLOTS = 24` — la rejilla, como constante de módulo.
- `BEATS` — los doce tiempos con el 12 arriba.
- `SYLL` y `STRIP` — el conteo hablado y su orden.
- `ACCENTS` — las dos variantes del compás de doce. Pasa a llamarse
  `PATTERNS`: la lista **es** el patrón rítmico del palo, y cada posición
  suya es un acento dentro de él. El nombre viejo confundía la parte con
  el todo.
- `basePattern()` — el patrón de arranque, con posiciones literales.
- `beatLabel()` — el "y medio" de la contra.
- `clickRate()` — tiene un `2` literal (las subdivisiones por tiempo).
- `encode()`/`decode()` — hex de 6 dígitos fijos (24 bits) y 4 voces.

En `assets/dial.js`: importa `SLOTS`, `BEATS`, `SYLL`, `STRIP` y los usa
directamente; los bucles de los tiempos van a 12 fijo.

`assets/audio.js` no sabe nada del compás: no se toca.

## Modelo de datos

Una tabla `PALOS` en `compas.js`. Cada palo se describe entero:

```js
{
  id: "solea-bulerias",     // clave interna y de persistencia
  code: "sb",               // clave corta, para la URL
  name: "Soleá por bulerías",
  beats: 12,                // tiempos del ciclo
  sub: 2,                   // subdivisiones por tiempo → slots = beats * sub
  order: [12,1,2,3,4,5,6,7,8,9,10,11],  // qué número ocupa cada posición
  count: ["dos","un","dos","tres",...], // conteo hablado, por posición
  strip: [11,0,1,2,...],    // orden en que se recita
  offLabel: "y medio",      // cómo se llama la contra: "9 y medio"
  patterns: [               // patrones de compás del palo (PATTERNS)
    { id: "7", label: "12·3·7·8·10", pattern: [0,3,7,8,10] },
    { id: "6", label: "12·3·6·8·10", pattern: [0,3,6,8,10] }
  ],
  tempo: { min: 80, max: 260, default: 150 },
  base(patternId) {        // voces de arranque: slots por voz, no tiempos
    return {
      grave: beats([0, 3, 10]),                    // helper: tiempo → slot
      seco: beats([patternId === "6" ? 6 : 7, 8]),
      fantasma: offbeats(),                        // todas las contras
      metro: beats([0, 2, 4, 6, 8, 10])            // el clic, en los pares
    };
  }
}
```

`base()` devuelve **slots**, no tiempos, y se construye con dos ayudas
(`beats()` convierte posiciones de tiempo a slots multiplicando por `sub`;
`offbeats()` marca todo lo que no cae en tiempo). Así el clic por defecto vive
donde viven los demás patrones, en lugar de en un campo aparte, y no hay
cadenas mágicas describiendo un patrón.

Las dos entradas iniciales:

| | Soleá por bulerías | Tangos |
|---|---|---|
| `id` / `code` | `solea-bulerias` / `sb` | `tangos` / `tg` |
| Tiempos | 12, el 12 arriba | 4, el 1 arriba |
| `sub` → rejilla | 2 → 24 posiciones | 2 → 8 posiciones |
| Contra | "y medio" | "y" |
| Patrones de compás | `12·3·7·8·10`, `12·3·6·8·10` | `1·3` |
| Conteo | un DOS un dos TRES… | UN dos TRES cuatro |
| Clic | pares: 12,2,4,6,8,10 | 1 y 3 |
| Orden del conteo | arranca en el 11 (`un DOS`) | del 1 al 4, sin arranque |
| Tempo | 80–260, arranca en 150 | 60–200, arranca en 110 |
| Voces del cajón | las actuales | **vacías** |

**Nota para revisión:** el palo que ya existe se llama aquí *Soleá por
bulerías*, que es lo que la página describe. "Bulerías" a secas es la misma
rejilla de doce con tempo mucho más rápido, y cuando se quiera será **una fila
más**, no código nuevo.

El tempo (`ppm`) es siempre **un tiempo del palo**: uno de los doce en soleá
por bulerías, uno de los cuatro en tangos.

## Estado de la aplicación

```js
{ palo: "solea-bulerias", pattern: "7", bpm: 150,
  rings: { grave: {on:[…], offset, gain, muted}, seco: …, fantasma: …, metro: … } }
```

`on` tiene siempre la longitud de la rejilla del palo activo. `sanitize()`
valida contra el palo, no contra una constante.

Los identificadores de patrón de compás pasan a ser **cadenas** (`"7"`, `"6"`,
`"13"`), porque en tangos "1·3" no es un número de tiempo. Lo guardado y los
enlaces viejos llevan el número 7 o 6: se mapean a `"7"` y `"6"` al leer.

Cada palo guarda **su propio ppm** en su estado de trabajo; el `default` del
palo solo se usa la primera vez, y el rango solo se aplica al entrar por
primera vez o al leer un valor fuera de límites.

## Comportamiento

- **Cambiar de palo** reconstruye el dial (puntos, números, conteo, acentos) y
  recupera el estado de trabajo de ese palo, con su propio tempo.
- **No se pierde el trabajo.** Los patrones de 24 y de 8 posiciones no son
  convertibles, así que cada palo guarda su propio estado de trabajo: ir a
  tangos y volver deja lo de antes donde estaba.
- **Patrón de compás**: un selector debajo del palo, etiquetado así en
  pantalla — "Patrón" a secas chocaría con los patrones de cajón de la
  biblioteca y del botón de arranque. Si el palo tiene un solo patrón de
  compás, la fila **no se muestra** (decidido en conversación).
- **Tangos arranca vacío** en las tres voces del cajón: compás, números,
  acentos y clic sí; lo que toca el cajón encima lo escribe Juanma o su
  profesor. Un texto en la tarjeta lo dice, para que el vacío se lea como
  intención y no como avería.
- **Metrónomo**: `clickRate()` generaliza el `2` a `sub`, de modo que el ppm
  del clic es `sub * bpm / huecoEnSlots`. En los dos palos el clic cae cada
  dos tiempos, así que sale la mitad del ppm de la página — que es lo que
  Juanma pone en su metrónomo.
- **La antefirma de la página** ("Cajón flamenco · soleá por bulerías") pasa a
  reflejar el palo activo.

## Persistencia

- **Estado de trabajo**: `compas-orbital:actual` pasa a ser un mapa por palo,
  más el palo activo. Lo guardado hoy (un estado suelto de 24 posiciones) se
  migra a `solea-bulerias`.
- **Biblioteca**: cada patrón guarda su `palo`; los existentes se migran a
  `solea-bulerias`. Cargar un patrón cambia al palo que le corresponde. La
  lista muestra el palo de cada patrón.
- **URL, formato 3**: `3.<code>.<patrón>.<ppm>.<voz>-<rot>…`, con el hex de
  longitud `ceil(slots/4)`. Los enlaces `1.` y `2.` se siguen leyendo como
  soleá por bulerías, con su patrón numérico.

## Refactor: un solo camino para mutar

Hoy cada mutación lleva pegado a mano su trío de *mutar, repintar, guardar*
(`toggleDot`, `rotate`, `setVariant`, `reset`, `clear`…). Con el palo dentro
eso se multiplica y es donde aparecería el fallo: un repintado olvidado deja
el dial desfasado y nadie se entera.

Se encauza en `app.js`:

```js
update(fn, nivel)   // nivel: "rebuild" | "refresh"
```

- `fn` muta el estado.
- **rebuild** — cambia el palo o el patrón de compás: `dial.drawStatic`, `drawDots`,
  `drawCount`, `place`, `paint`, panel y nota del metrónomo.
- **refresh** — cambia un patrón, una rotación, un volumen: solo atributos
  (`place`/`paint`) y la nota del metrónomo.
- Siempre: guardar el estado del palo activo.

No se usa un store con re-render completo: rehacer los 72 nodos SVG en cada
clic cortaría los destellos a media animación y perdería el foco del teclado.

## Qué NO entra en este cambio

- Patrones de cajón para tangos: los aporta Juanma.
- La biblioteca de patrones curados por palo: acordada para más adelante.
- Cambiar los identificadores internos de las voces (`seco`, `fantasma`).
- Sonar el patrón de compás. Ahora que se llama por su nombre se ve que es
  tocable: eso son las palmas, y serían una quinta órbita. No entra aquí.
- Resolución conmutable dentro de un palo.

## Pruebas

En `test/`, sin navegador:

- cada palo produce la rejilla que dice (24 y 8 posiciones);
- el patrón base de tangos tiene las tres voces vacías y el clic en 1 y 3;
- `clickRate` da la mitad del ppm en los dos palos, y usa `sub`;
- las etiquetas de contra son "9 y medio" en uno y "2 y" en el otro;
- ida y vuelta por la URL en los dos palos;
- los enlaces `1.` y `2.` siguen leyéndose como soleá por bulerías;
- un patrón guardado sin `palo` se migra a soleá por bulerías;
- `sanitize` rechaza un patrón cuya longitud no cuadra con el palo.

## Ficheros

| Fichero | Alcance |
|---|---|
| `assets/compas.js` | la tabla `PALOS` y todas las funciones parametrizadas |
| `assets/app.js` | los dos selectores y el embudo `update()` |
| `assets/dial.js` | recibe el palo en lugar de leer constantes |
| `assets/store.js` | estado por palo, `palo` en la biblioteca, URL v3 |
| `index.html` | selectores, antefirma y texto de tangos vacío |
| `test/compas.test.js` | lo de arriba |
| `assets/audio.js` | sin cambios |
