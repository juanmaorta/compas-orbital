# Compás en órbita

El compás de doce de la **soleá por bulerías** dibujado en círculo, con una
órbita por cada voz del cajón flamenco. Una página estática, sin dependencias
ni build: HTML, CSS y cinco módulos ES.

## Los palos

Dos, de momento, y cada uno descrito entero en la tabla `PALOS` de
`assets/compas.js`:

| | Soleá por bulerías | Tangos |
|---|---|---|
| Tiempos | 12, el 12 arriba | 4, el 1 arriba |
| Rejilla | 24 (medios tiempos) | 8 (corcheas) |
| Patrones de compás | 12·3·7·8·10, 12·3·6·8·10 | 1·3 |
| Clic | pares: 12, 2, 4, 6, 8, 10 | 1 y 3 |
| Cajón | patrón de arranque | vacío, para escribirlo |

**Añadir un palo es añadir una fila**, no tocar lógica: "Bulerías" a secas,
por ejemplo, es la misma rejilla de doce con el tempo más rápido. Los patrones
de cajón de tangos van vacíos a propósito — el compás, los acentos y el clic
están puestos, y lo que se toca encima lo escribe quien estudia.

Cada palo guarda su propio estado de trabajo en el navegador, porque los
patrones de rejillas distintas no son convertibles: cambiar de palo y volver
no borra nada.

## El compás de doce

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

Las tres comparten la rejilla del palo — **24 posiciones** en soleá por
bulerías (los doce tiempos y sus medios), **8** en tangos (los cuatro y sus
corcheas). Los puntos grandes son tiempos; los pequeños, medios — el *9 y medio*,
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

En tangos cae en 1 y 3, que vuelve a ser uno cada dos tiempos: misma idea,
otro patrón en la misma órbita, y la mitad de ppm otra vez.

Los sonidos están **sintetizados** en el navegador con Web Audio: un tono
grave que cae de 145 a 78 Hz, ruido en banda con el zumbido de las cuerdas
para el agudo, un golpe muy corto y sordo para el relleno y un clic agudo
para el metrónomo. Aproximan lo
justo para estudiar; no sustituyen a un cajón.

## Cómo está hecho

```
index.html          la página: dial en SVG y panel de control
assets/styles.css   paleta tokenizada, tema claro y oscuro
assets/compas.js    dominio: la tabla PALOS y todo lo que depende del palo
assets/audio.js     las voces y el clic, sintetizados
assets/dial.js      el SVG: anillos, puntos, aguja, tira del conteo
assets/store.js     persistencia: un estado por palo, la biblioteca y la URL
assets/app.js       estado, reloj, selectores, panel y el embudo update()
test/compas.test.js  el dominio, sin navegador
test/store.test.js   las migraciones, con el almacén inyectado
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

**Un compás entero cabe en la URL.** Cada posición de una voz es un bit, así
que la rejilla son `ceil(slots/4)` dígitos hex: 6 en soleá por bulerías y 2 en
tangos.

```
#c=3.sb.7.150.820008-0.000280-0.555555-0.888888-0
#c=3.tg.13.110.00-0.00-0.00-0.88-0
   │  │  │   │
   │  │  │   └─ las cuatro voces: <hex>-<rotación>
   │  │  └───── ppm (un tiempo del palo)
   │  └──────── patrón de compás
   └─────────── palo
```

Los volúmenes no viajan: son mezcla, no compás. El primer número es la versión
del formato, y por eso los enlaces `1.` y `2.` —de antes del metrónomo y de
antes de los palos— se siguen leyendo como soleá por bulerías.

**Una sola puerta para mutar el estado.** `update(fn, nivel)` en `app.js`:
`fn` muta, y según el nivel se reconstruye el dial (cambió el palo o el patrón
de compás) o solo se refrescan los atributos de los puntos. Antes cada cambio
llevaba pegado a mano su repintado y su guardado —once llamadas sueltas—, y un
repintado olvidado dejaba el dial desfasado sin que nadie se enterara.

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

- **Patrones de tangos**, y una biblioteca de patrones curados por palo que
  venga con la página.
- **Samples reales.** Tres o cuatro tomas de cada golpe, alternadas al azar,
  es lo que quita el efecto metralleta y hace que suene a persona tocando.
- Más palos: bulerías a secas, rumba, tanguillo.
- Compartir la biblioteca entre dispositivos (hoy vive en el navegador).

## Licencia

MIT.
