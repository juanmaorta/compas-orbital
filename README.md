# Compás en órbita

El compás de doce de la **soleá por bulerías** dibujado en círculo, con una
órbita por cada voz del cajón flamenco. Una página estática, sin dependencias
ni build: HTML, CSS y cinco módulos ES.

## El compás

Los doce tiempos van en círculo con el **12 arriba**, como en un reloj: el 3
cae a las tres en punto, el 6 abajo, el 9 a la izquierda. Los cinco acentos
dibujan entonces una constelación asimétrica que se reconoce de un vistazo.

Se cuenta arrancando en los tiempos 11 y 12:

```
un DOS  un dos TRES cuatro cinco seis SIETE OCHO nueve DIEZ
   12    1   2    3     4     5    6      7    8     9   10
```

Las mayúsculas son los acentos: **12 · 3 · 7 · 8 · 10**. Ese es el conteo que
se usa en muchas escuelas; la versión más regular que suele citarse acentúa el
6 en lugar del 7, y la página conmuta entre las dos. No hay una correcta: es
una decisión de escuela y de gusto, y las dos suenan a soleá por bulerías.

## Las voces

Tres voces del cajón y el reloj, en órbitas concéntricas de fuera a dentro:

| Órbita | Voz | Técnica |
|---|---|---|
| exterior | Relleno | dedos, apagado |
| — | Agudo | esquina del parche |
| — | Grave | centro del parche |
| interior | Metrónomo | clic de referencia |

Las tres comparten una rejilla de **24 posiciones**: los doce tiempos y sus
medios. Los puntos grandes son tiempos; los pequeños, medios — el *9 y medio*,
por ejemplo. El patrón de arranque reparte los cinco acentos entre el grave
(12, 3, 10) y el agudo (7, 8), y deja el relleno cubriendo las contras.

Cada órbita se puede **rotar** de medio en medio tiempo. Eso desplaza la voz
dentro del ciclo sin reescribirla, que es la manera de oír el mismo patrón
entrando por otro sitio del compás.

## El metrónomo

La órbita interior no es una voz del cajón: es el reloj contra el que se toca,
y por eso lleva el color de la aguja.

El clic **no va en cada pulso**. En el compás de doce cae en los pares — 12, 2,
4, 6, 8, 10 —, o sea uno cada dos tiempos, y de ahí que el metrónomo de verdad
haya que ponerlo a la mitad de ppm que la página. Esa división, que se hacía a
mano cada vez, la dice ahora la página bajo el slider de tempo: *clic cada 2
tiempos · 75 ppm en tu metrónomo*. Si editas el clic hasta dejarlo irregular,
lo dice en lugar de inventarse un número.

En tangos, cuando se añada el 4/4, el clic va en los pulsos 1 y 3: misma idea,
otro patrón en la misma órbita.

Los sonidos están **sintetizados** en el navegador con Web Audio: un tono
grave que cae de 145 a 78 Hz, ruido en banda con el zumbido de las cuerdas
para el agudo, y un golpe muy corto y sordo para la fantasma. Aproximan lo
justo para estudiar; no sustituyen a un cajón.

## Cómo está hecho

```
index.html          la página: dial en SVG y panel de control
assets/styles.css   paleta tokenizada, tema claro y oscuro
assets/compas.js    dominio: tiempos, acentos, voces, (de)serialización
assets/audio.js     las tres voces sintetizadas
assets/dial.js      el SVG: anillos, puntos, aguja, tira del conteo
assets/store.js     persistencia: localStorage y la propia URL
assets/app.js       estado, reloj, panel, biblioteca
test/               pruebas del dominio (sin navegador)
```

Tres decisiones que explican el resto del código:

**El reloj no es un `setInterval`.** El audio del navegador se programa con
antelación: un temporizador cada 25 ms encola los pasos que caen en los
próximos 120 ms y guarda a qué hora suena cada uno. La aguja y los destellos
se pintan contra *ese* reloj, no contra el del navegador, así que no derivan
aunque la pestaña se atasque.

**El tamaño del punto lo decide su posición en el dial, no la nota.** Si rotas
una voz medio tiempo, sus puntos se vuelven pequeños — porque eso es
exactamente lo que ha pasado musicalmente: ahora cae en medios.

**Un compás entero cabe en la URL.** Las 24 posiciones de una voz son 24 bits
= 6 dígitos hex, así que `#c=2.7.150.820008-0.000280-0.555555-0.888888-0` lleva el acento, el tempo, las cuatro
voces y sus rotaciones. Los volúmenes no viajan: son mezcla, no compás. El
primer número es la versión del formato: los enlaces `1.`, de antes del
metrónomo, se siguen leyendo.

## Desarrollo

Los módulos ES necesitan servidor (con `file://` el navegador los bloquea):

```sh
npm run dev      # python3 -m http.server 8000 → http://localhost:8000
npm test         # pruebas del dominio
```

## Publicar en Cloudflare

No hay build: se sirven los ficheros de la raíz tal cual, como un Worker de
solo assets (`wrangler.jsonc`).

**Desde la terminal:**

```sh
npx wrangler login
npx wrangler deploy
```

**Desde el panel** (despliega en cada push): Workers & Pages → Create app →
Import a repository → este repo. Detecta `wrangler.jsonc`; build command
vacío y deploy command `npx wrangler deploy`.

## Pendiente

- **Samples reales.** Tres o cuatro tomas de cada golpe, alternadas al azar,
  es lo que quita el efecto metralleta y hace que suene a persona tocando.
- Más palos sobre la misma rejilla: tangos, rumba, tanguillo.
- Compartir la biblioteca entre dispositivos (hoy vive en el navegador).

## Licencia

MIT.
