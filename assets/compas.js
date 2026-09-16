/* Dominio del compás: los palos, sus tiempos y sus patrones, las voces del
   cajón y la (de)serialización. Aquí no hay DOM ni audio: solo música
   convertida en datos.

   Dos palabras que se usan por todas partes:
   - POSICIÓN: índice de un tiempo en el ciclo. La 0 es el tiempo que se pinta
     arriba del dial — el 12 en soleá por bulerías, el 1 en tangos.
   - SLOT: índice de una subdivisión. Hay `sub` slots por tiempo, así que la
     rejilla mide `beats * sub`: 24 en soleá por bulerías, 8 en tangos. */

export const PALOS = [
  {
    id: "solea-bulerias", code: "sb", name: "Soleá por bulerías",
    beats: 12, sub: 2,
    /* El 12 arriba, como en un reloj: el 3 cae a las tres en punto y el 6
       abajo. Para los tiempos 1 a 11 la posición coincide con el número. */
    order: [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    /* Cómo se cuenta en voz alta: los tiempos 11 y 12 hacen de arranque
       ("un DOS") y de ahí sale el "un dos TRES" del compás. */
    count: ["dos", "un", "dos", "tres", "cuatro", "cinco",
            "seis", "siete", "ocho", "nueve", "diez", "un"],
    strip: [11, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    offLabel: "y medio",
    /* El patrón de compás es el esqueleto rítmico del palo, y cada posición
       suya es un acento dentro de él. El del 7 es como se cuenta en muchas
       escuelas; el del 6 es la versión más regular que suele citarse. */
    patterns: [
      { id: "7", label: "12·3·7·8·10", pattern: [0, 3, 7, 8, 10] },
      { id: "6", label: "12·3·6·8·10", pattern: [0, 3, 6, 8, 10] }
    ],
    tempo: { min: 80, max: 260, default: 150 },
    gains: { grave: 0.9, seco: 0.8, fantasma: 0.45, metro: 0.5 },
    /* Punto de partida: el grave sostiene 12, 3 y 10; el agudo remata en 7 y 8
       (o en 6 y 8), de modo que entre las dos voces suenan los cinco acentos;
       el relleno cubre las contras. El clic no va en cada pulso: cae en los
       pares, uno cada dos tiempos, y de ahí que el metrónomo de verdad se
       ponga a la mitad de ppm. */
    base: (p, patternId) => ({
      grave: slotsAt(p, [0, 3, 10]),
      seco: slotsAt(p, [patternId === "6" ? 6 : 7, 8]),
      fantasma: offbeats(p),
      metro: slotsAt(p, [0, 2, 4, 6, 8, 10])
    })
  },
  {
    id: "tangos", code: "tg", name: "Tangos",
    beats: 4, sub: 2,
    order: [1, 2, 3, 4],
    count: ["un", "dos", "tres", "cuatro"],
    strip: [0, 1, 2, 3],
    offLabel: "y",
    patterns: [{ id: "13", label: "1·3", pattern: [0, 2] }],
    tempo: { min: 60, max: 200, default: 110 },
    gains: { grave: 0.9, seco: 0.8, fantasma: 0.45, metro: 0.5 },
    /* Las voces del cajón van vacías a propósito: los patrones de tangos los
       escribe quien estudia, no la página. Solo el clic viene puesto, en 1 y 3
       — que vuelve a ser uno cada dos tiempos. */
    base: (p) => ({ grave: [], seco: [], fantasma: [], metro: slotsAt(p, [0, 2]) })
  }
];

export function palo(id) {
  return PALOS.find((p) => p.id === id) || PALOS[0];
}
export function paloByCode(code) {
  return PALOS.find((p) => p.code === code) || PALOS[0];
}
export function slotsOf(p) { return p.beats * p.sub; }
export function patternOf(p, id) {
  return p.patterns.find((x) => x.id === String(id)) || p.patterns[0];
}

/* posiciones del ciclo → slots */
export function slotsAt(p, positions) { return positions.map((n) => n * p.sub); }
/* todo lo que no cae en tiempo */
export function offbeats(p) {
  const out = [];
  for (let s = 0; s < slotsOf(p); s++) if (s % p.sub) out.push(s);
  return out;
}
/* slots encendidos → array de la rejilla */
export function onFrom(p, slots) {
  const on = new Array(slotsOf(p)).fill(false);
  for (const s of slots) on[s] = true;
  return on;
}

export function isAccent(p, patternId, position) {
  return patternOf(p, patternId).pattern.indexOf(position) !== -1;
}

/* Slot → "3", "9 y medio", "2 y". */
export function beatLabel(p, step) {
  const beat = p.order[Math.floor(step / p.sub)];
  return step % p.sub ? `${beat} ${p.offLabel}` : String(beat);
}

/* La rotación se cuenta en subdivisiones pero se muestra en tiempos. */
export function fmtOffset(p, offset) {
  if (!offset) return "0";
  return "+" + String(offset / p.sub).replace(".", ",");
}

export function basePattern(p, patternId) {
  return p.base(p, patternId);
}

export function baseState(paloId, patternId) {
  const p = palo(paloId);
  const pat = patternOf(p, patternId);
  const base = basePattern(p, pat.id);
  const rings = {};
  for (const id of VOICES) {
    rings[id] = { on: onFrom(p, base[id]), offset: 0, gain: p.gains[id], muted: false };
  }
  return { palo: p.id, pattern: pat.id, bpm: p.tempo.default, rings };
}

/* Orden estable de las voces para serializar (independiente del dibujo). */
export const VOICES = ["grave", "seco", "fantasma", "metro"];

/* El formato 1 de la URL no llevaba metrónomo. Se sigue leyendo. */
const LEGACY_VOICES = ["grave", "seco", "fantasma"];

/* Las órbitas, de fuera a dentro. dotR es el radio del punto cuando cae en un
   tiempo del compás; dotRHalf, cuando cae en una subdivisión. */
export const RINGS = [
  { id: "fantasma", name: "Relleno", tech: "dedos, apagado",
    radius: 212, dotR: 5.5, dotRHalf: 4 },
  { id: "seco", name: "Agudo", tech: "esquina del parche",
    radius: 174, dotR: 8, dotRHalf: 5 },
  { id: "grave", name: "Grave", tech: "centro del parche",
    radius: 134, dotR: 9.5, dotRHalf: 5.5 },
  /* El metrónomo no es una voz del cajón: es el reloj contra el que se toca,
     y por eso va el más pegado al eje y con el color de la aguja. */
  { id: "metro", name: "Metrónomo", tech: "clic, referencia",
    radius: 98, dotR: 4.5, dotRHalf: 3.5 }
];

/* Acepta lo que venga (localStorage, URL, un estado de antes de los palos) y
   devuelve un estado válido. Nunca lanza: si algo no cuadra, usa la base. */
export function sanitize(raw) {
  if (!raw || typeof raw !== "object") return baseState();
  const p = palo(typeof raw.palo === "string" ? raw.palo : undefined);
  /* el formato viejo guardaba el patrón de compás como número */
  const pat = patternOf(p, raw.pattern != null ? raw.pattern : raw.variant);
  const state = baseState(p.id, pat.id);
  const slots = slotsOf(p);
  if (typeof raw.bpm === "number" && raw.bpm >= p.tempo.min && raw.bpm <= p.tempo.max) {
    state.bpm = Math.round(raw.bpm);
  }
  for (const id of VOICES) {
    const src = raw.rings && raw.rings[id];
    const dst = state.rings[id];
    if (!src) continue;
    if (Array.isArray(src.on)) {
      if (src.on.length === slots) {
        dst.on = src.on.map(Boolean);
      } else if (src.on.length * p.sub === slots) {
        /* patrón guardado antes de las subdivisiones: se expande a la rejilla */
        const up = new Array(slots).fill(false);
        src.on.forEach((v, i) => { if (v) up[i * p.sub] = true; });
        dst.on = up;
      }
    }
    if (typeof src.offset === "number") {
      dst.offset = ((Math.round(src.offset) % slots) + slots) % slots;
    }
    if (typeof src.gain === "number") dst.gain = Math.min(1, Math.max(0, src.gain));
    dst.muted = !!src.muted;
  }
  return state;
}

export function cloneState(state) {
  const rings = {};
  for (const id of VOICES) {
    const r = state.rings[id];
    rings[id] = { on: r.on.map(Boolean), offset: r.offset, gain: r.gain, muted: !!r.muted };
  }
  return { palo: state.palo, pattern: state.pattern, bpm: state.bpm, rings };
}

/* A qué velocidad late el clic. Como el metrónomo no suena en cada pulso, su
   ppm no es el de la página: con un clic cada dos tiempos, es la mitad.
   La rotación no cambia nada — girar el anillo conserva los huecos. */
export function clickRate(state) {
  const p = palo(state.palo);
  const slots = slotsOf(p);
  const on = state.rings.metro.on;
  const hits = [];
  for (let i = 0; i < slots; i++) if (on[i]) hits.push(i);
  if (!hits.length) return null;
  const gaps = hits.map((slot, i) => {
    const next = i + 1 < hits.length ? hits[i + 1] : hits[0] + slots;
    return next - slot;
  });
  const gap = gaps[0];
  if (!gaps.every((g) => g === gap)) return { regular: false, gap: null, bpm: null };
  return { regular: true, gap, beats: gap / p.sub, bpm: (p.sub * state.bpm) / gap };
}

/* ---- código compacto para meter un compás en la URL ----
   Formato: 3.<palo>.<patrón>.<ppm>.<hex>-<rot> ×4 voces
   Las posiciones de cada voz caben en un bit cada una, así que la rejilla son
   ceil(slots/4) dígitos hex: 6 en soleá por bulerías, 2 en tangos. Los
   volúmenes no viajan: son mezcla, no compás. */
function bitsToHex(bits, slots) {
  let out = "";
  for (let i = 0; i < slots; i += 4) {
    let nibble = 0;
    for (let b = 0; b < 4; b++) if (bits[i + b]) nibble |= 1 << (3 - b);
    out += nibble.toString(16);
  }
  return out;
}
function hexToBits(hex, slots) {
  const bits = new Array(slots).fill(false);
  for (let i = 0; i < Math.ceil(slots / 4); i++) {
    const nibble = parseInt(hex[i], 16);
    if (isNaN(nibble)) continue;
    for (let b = 0; b < 4; b++) {
      const at = i * 4 + b;
      if (at < slots) bits[at] = !!(nibble & (1 << (3 - b)));
    }
  }
  return bits;
}

export function encode(state) {
  const p = palo(state.palo);
  const slots = slotsOf(p);
  const parts = ["3", p.code, String(state.pattern), String(state.bpm)];
  for (const id of VOICES) {
    const r = state.rings[id];
    parts.push(`${bitsToHex(r.on, slots)}-${r.offset}`);
  }
  return parts.join(".");
}

export function decode(text) {
  if (!text) return null;
  const parts = String(text).split(".");
  const version = parts[0];
  if (version !== "1" && version !== "2" && version !== "3") return null;
  const p = version === "3" ? paloByCode(parts[1]) : PALOS[0];
  const voices = version === "1" ? LEGACY_VOICES : VOICES;
  /* el formato 3 añade el código del palo: un campo más antes del patrón */
  const head = version === "3" ? 2 : 1;
  if (parts.length < head + 2 + voices.length) return null;
  const slots = slotsOf(p);
  const raw = {
    palo: p.id,
    pattern: parts[head],
    bpm: Number(parts[head + 1]),
    rings: {}
  };
  voices.forEach((id, i) => {
    const [hex, offset] = String(parts[head + 2 + i] || "").split("-");
    if (!hex) return;
    raw.rings[id] = { on: hexToBits(hex, slots), offset: Number(offset) || 0 };
  });
  return sanitize(raw);
}

/* Identificador legible para un nombre de patrón. */
export function slug(text) {
  const bare = String(text).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return bare.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60)
    || `p${Date.now()}`;
}
