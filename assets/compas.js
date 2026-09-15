/* Dominio del compás: los doce tiempos, los acentos, las voces del cajón y
   la (de)serialización de un patrón. Aquí no hay DOM ni audio: solo música
   convertida en datos. */

/* El 12 va arriba, como en un reloj, así que la posición 0 del círculo es el
   tiempo 12, la 3 cae a las tres en punto y la 6 abajo. Para los tiempos 1 a
   11 la posición coincide con el número; el 12 es la excepción. */
export const BEATS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

/* Cómo se cuenta en voz alta: los tiempos 11 y 12 hacen de arranque ("un
   DOS") y de ahí sale el "un dos TRES" del compás. Indexado por posición. */
export const SYLL = ["dos", "un", "dos", "tres", "cuatro", "cinco",
                     "seis", "siete", "ocho", "nueve", "diez", "un"];

/* Orden en que se recita, empezando por el arranque del 11. */
export const STRIP = [11, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/* Los cinco acentos, en posiciones. El 7 es como se cuenta en muchas
   escuelas; el 6 es la versión más regular que suele citarse. */
export const ACCENTS = { 7: [0, 3, 7, 8, 10], 6: [0, 3, 6, 8, 10] };

/* Rejilla común: doce tiempos y sus medios. */
export const SLOTS = 24;

/* Orden estable de las voces para serializar (independiente del dibujo). */
export const VOICES = ["grave", "seco", "fantasma"];

/* Las órbitas, de fuera a dentro. dotR es el radio del punto cuando cae en un
   tiempo del compás; dotRHalf, cuando cae en un medio. */
export const RINGS = [
  { id: "fantasma", name: "Notas fantasma", tech: "dedos, apagado",
    radius: 208, dotR: 5.5, dotRHalf: 4 },
  { id: "seco", name: "Golpe seco", tech: "esquina, agudo",
    radius: 164, dotR: 8, dotRHalf: 5 },
  { id: "grave", name: "Golpe grave", tech: "centro del parche",
    radius: 120, dotR: 9.5, dotRHalf: 5.5 }
];

export function isAccent(variant, position) {
  return (ACCENTS[variant] || ACCENTS[7]).indexOf(position) !== -1;
}

/* Paso 0..23 → "3" o "9 y medio". */
export function beatLabel(step) {
  const beat = BEATS[Math.floor(step / 2)];
  return step % 2 ? `${beat} y medio` : String(beat);
}

/* La rotación se cuenta en medios tiempos pero se muestra en tiempos. */
export function fmtOffset(offset) {
  if (!offset) return "0";
  return "+" + String(offset / 2).replace(".", ",");
}

/* Punto de partida: el grave sostiene 12, 3 y 10; el agudo remata en 7 y 8
   (o en 6 y 8), de modo que entre las dos voces suenan los cinco acentos; las
   fantasmas rellenan todas las contras. */
export function basePattern(variant) {
  const grave = new Array(SLOTS).fill(false);
  const seco = new Array(SLOTS).fill(false);
  const fantasma = new Array(SLOTS).fill(false);
  for (const p of [0, 3, 10]) grave[p * 2] = true;
  for (const p of [variant === 6 ? 6 : 7, 8]) seco[p * 2] = true;
  for (let q = 1; q < SLOTS; q += 2) fantasma[q] = true;
  return { grave, seco, fantasma };
}

export function baseState(variant = 7) {
  const on = basePattern(variant);
  const gains = { grave: 0.9, seco: 0.8, fantasma: 0.45 };
  const rings = {};
  for (const id of VOICES) {
    rings[id] = { on: on[id], offset: 0, gain: gains[id], muted: false };
  }
  return { bpm: 150, variant, rings };
}

/* Acepta lo que venga (localStorage, URL, un patrón viejo de 12 posiciones) y
   devuelve un estado válido. Nunca lanza: si algo no cuadra, usa el base. */
export function sanitize(raw, fallback = baseState()) {
  if (!raw || typeof raw !== "object") return fallback;
  const state = baseState(raw.variant === 6 ? 6 : 7);
  if (typeof raw.bpm === "number" && raw.bpm >= 80 && raw.bpm <= 260) {
    state.bpm = Math.round(raw.bpm);
  }
  for (const id of VOICES) {
    const src = raw.rings && raw.rings[id];
    const dst = state.rings[id];
    if (!src) continue;
    if (Array.isArray(src.on)) {
      if (src.on.length === SLOTS) {
        dst.on = src.on.map(Boolean);
      } else if (src.on.length * 2 === SLOTS) {
        /* patrón de antes de los medios tiempos: se expande a la rejilla */
        const up = new Array(SLOTS).fill(false);
        src.on.forEach((v, i) => { if (v) up[i * 2] = true; });
        dst.on = up;
      }
    }
    if (typeof src.offset === "number") {
      dst.offset = ((Math.round(src.offset) % SLOTS) + SLOTS) % SLOTS;
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
  return { bpm: state.bpm, variant: state.variant, rings };
}

/* ---- código compacto para meter un compás en la URL ----
   Formato: 1.<acento>.<ppm>.<hex6>-<rot>.<hex6>-<rot>.<hex6>-<rot>
   Las 24 posiciones de cada voz caben en 24 bits = 6 dígitos hex, en el orden
   grave, seco, fantasma. Los volúmenes no viajan: son mezcla, no compás. */
function bitsToHex(bits) {
  let out = "";
  for (let i = 0; i < SLOTS; i += 4) {
    let nibble = 0;
    for (let b = 0; b < 4; b++) if (bits[i + b]) nibble |= 1 << (3 - b);
    out += nibble.toString(16);
  }
  return out;
}
function hexToBits(hex) {
  const bits = new Array(SLOTS).fill(false);
  for (let i = 0; i < SLOTS / 4; i++) {
    const nibble = parseInt(hex[i], 16);
    if (isNaN(nibble)) continue;
    for (let b = 0; b < 4; b++) bits[i * 4 + b] = !!(nibble & (1 << (3 - b)));
  }
  return bits;
}

export function encode(state) {
  const parts = ["1", String(state.variant), String(state.bpm)];
  for (const id of VOICES) {
    const r = state.rings[id];
    parts.push(`${bitsToHex(r.on)}-${r.offset}`);
  }
  return parts.join(".");
}

export function decode(text) {
  if (!text) return null;
  const parts = String(text).split(".");
  if (parts[0] !== "1" || parts.length < 6) return null;
  const raw = { variant: Number(parts[1]) === 6 ? 6 : 7, bpm: Number(parts[2]), rings: {} };
  VOICES.forEach((id, i) => {
    const [hex, offset] = String(parts[3 + i] || "").split("-");
    if (!hex) return;
    raw.rings[id] = { on: hexToBits(hex), offset: Number(offset) || 0 };
  });
  return sanitize(raw);
}

/* Identificador legible para un nombre de patrón. */
export function slug(text) {
  const bare = String(text).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return bare.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60)
    || `p${Date.now()}`;
}
