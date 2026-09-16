/* Monta la página: estado, reloj, panel y biblioteca.

   Dos cosas delicadas aquí.

   El RELOJ: el audio del navegador se programa con antelación (no se puede
   confiar en un setInterval para colocar golpes), así que un temporizador va
   encolando los pasos que caen en los próximos 120 ms y guarda a qué hora
   suena cada uno. La aguja y los destellos se pintan contra *ese* reloj, no
   contra el del navegador, así que no derivan aunque la pestaña se atasque.

   El EMBUDO: toda mutación del estado pasa por update(), que repinta lo que
   toca y guarda. Antes cada cambio llevaba pegado a mano su repintado y su
   guardado, y con el palo dentro eso se multiplicaba: cambiar de palo
   invalida el dial entero. */

import { PALOS, RINGS, VOICES, palo, slotsOf, baseState, basePattern, onFrom,
         cloneState, fmtOffset, clickRate } from "./compas.js";
import { createAudio } from "./audio.js";
import { createDial } from "./dial.js";
import * as store from "./store.js";

/* ---------- estado ---------- */
/* Un enlace compartido manda sobre lo guardado; si no, el último palo activo. */
const fromLink = store.fromHash();
let state = fromLink || store.loadCurrent() || baseState();
let playing = false;
let activeId = null;

/* ---------- DOM ---------- */
const $ = (id) => document.getElementById(id);
const hub = $("hub"), hubGlyph = $("hubGlyph"), hubBpm = $("hubBpm");
const tempo = $("tempo"), tempoVal = $("tempoVal");
const paloSel = $("palo"), patternSel = $("pattern"), patternRow = $("patternRow");
const paloName = $("paloName"), paloHint = $("paloHint");
const voicesEl = $("voices");
const metroNote = $("metroNote");
const libName = $("libName"), libSave = $("libSave"), libList = $("libList"), libHint = $("libHint");
const LIB_HINT = libHint.innerHTML;

const audio = createAudio();
const dial = createDial($("dial"), $("count"), toggleDot);

/* ---------- el embudo ---------- */
function update(fn, nivel = "refresh") {
  fn();
  if (nivel === "rebuild") rebuild(); else refresh();
  store.saveCurrent(state);
}

/* Cambia la estructura del compás: hay que recrear puntos, números y conteo. */
function rebuild() {
  const p = palo(state.palo);
  dial.drawStatic(p, state.pattern);
  dial.drawDots(p);
  dial.drawCount(p, state.pattern);
  dial.place(p, state);
  dial.paint(p, state);
  buildPanel();
  syncControls();
  updateMetroNote();
  if (!playing) dial.setNeedle(p, 0);
}

/* Cambia el contenido: solo atributos de los puntos. */
function refresh() {
  const p = palo(state.palo);
  dial.place(p, state);
  dial.paint(p, state);
  updateMetroNote();
  syncControls();
}

/* Los controles reflejan el palo activo. */
function syncControls() {
  const p = palo(state.palo);
  paloName.textContent = p.name.toLowerCase();
  paloSel.value = p.id;
  if (patternSel.dataset.palo !== p.id) {
    patternSel.textContent = "";
    for (const pat of p.patterns) {
      const opt = document.createElement("option");
      opt.value = pat.id;
      opt.textContent = pat.label;
      patternSel.appendChild(opt);
    }
    patternSel.dataset.palo = p.id;
  }
  patternSel.value = state.pattern;
  patternRow.hidden = p.patterns.length < 2;
  tempo.min = p.tempo.min;
  tempo.max = p.tempo.max;
  tempo.value = state.bpm;
  tempoVal.textContent = state.bpm;
  hubBpm.textContent = state.bpm;
  /* Un palo sin nada escrito lo dice, para que el vacío se lea como intención
     y no como avería. */
  const vacio = ["grave", "seco", "fantasma"].every((v) => !state.rings[v].on.some(Boolean));
  paloHint.hidden = !vacio;
  paloHint.textContent = "Este palo está vacío: los patrones de cajón los " +
    "escribes tú. El compás, los acentos y el clic ya están puestos.";
}

/* ---------- reloj ---------- */
let nextSlot = 0, nextTime = 0, timer = null, slotDur = 0.2;
let queue = [];   // {slot, time} de los pasos ya programados
let flashes = []; // {time, voice, idx} de los puntos que deben destellar

/* el ppm es un tiempo del palo, y cada tiempo tiene `sub` pasos */
const slotDuration = () => (60 / state.bpm) / palo(state.palo).sub;

function scheduleSlot(slot, time) {
  const slots = slotsOf(palo(state.palo));
  for (const ring of RINGS) {
    const st = state.rings[ring.id];
    const idx = ((slot - st.offset) % slots + slots) % slots;
    if (!st.on[idx]) continue;
    if (!st.muted) audio.hit(ring.id, time, st.gain);
    flashes.push({ time, voice: ring.id, idx });
  }
  queue.push({ slot, time });
  if (queue.length > 40) queue.shift();
}

function tick() {
  if (!audio.ready) return;
  const slots = slotsOf(palo(state.palo));
  while (nextTime < audio.now() + 0.12) {
    scheduleSlot(nextSlot, nextTime);
    slotDur = slotDuration();
    nextTime += slotDur;
    nextSlot = (nextSlot + 1) % slots;
  }
}

function start() {
  if (!audio.ensure()) return;
  playing = true;
  queue = []; flashes = [];
  nextSlot = 0;
  nextTime = audio.now() + 0.08;
  slotDur = slotDuration();
  tick();
  timer = setInterval(tick, 25);
  hubGlyph.textContent = "❚❚";
  hub.setAttribute("aria-label", "Parar el compás");
}

function stop() {
  playing = false;
  clearInterval(timer);
  timer = null;
  queue = []; flashes = [];
  hubGlyph.textContent = "▶";
  hub.setAttribute("aria-label", "Reproducir el compás");
  dial.setNeedle(palo(state.palo), 0);
  dial.highlight(-1);
}

function frame() {
  requestAnimationFrame(frame);
  if (!audio.ready) return;
  const now = audio.now();
  while (flashes.length && flashes[0].time <= now) {
    const f = flashes.shift();
    dial.flash(f.voice, f.idx);
  }
  if (!playing) return;
  while (queue.length > 1 && queue[1].time <= now) queue.shift();
  if (queue.length && queue[0].time <= now) {
    const p = palo(state.palo);
    const slots = slotsOf(p);
    const pos = (queue[0].slot + Math.min(1, (now - queue[0].time) / slotDur)) % slots;
    dial.setNeedle(p, pos);
    dial.highlight(Math.floor(pos / p.sub));
  }
}

/* ---------- edición ---------- */
function toggleDot(voice, idx) {
  let encendido = false;
  update(() => {
    const st = state.rings[voice];
    st.on[idx] = !st.on[idx];
    encendido = st.on[idx];
  });
  if (encendido) audio.hit(voice, 0, state.rings[voice].gain); // que se oiga lo que pones
}

/* ---------- nota del metrónomo ---------- */
/* Cuántos tiempos hay entre clic y clic, en palabras. */
function gapLabel(beats) {
  if (beats === 0.5) return "cada medio tiempo";
  if (beats === 1) return "en cada tiempo";
  return `cada ${String(beats).replace(".", ",")} tiempos`;
}

/* Traduce el tempo de la página al que hay que ponerle al metrónomo de verdad,
   que es la división que se hacía a mano cada vez. */
function updateMetroNote() {
  const rate = clickRate(state);
  if (!rate) {
    metroNote.textContent = "Metrónomo sin clics: enciende alguno en la órbita interior.";
    return;
  }
  if (!rate.regular) {
    metroNote.textContent = "Clics irregulares: no hay un ppm único que ponerle al metrónomo.";
    return;
  }
  const bpm = Math.round(rate.bpm * 10) / 10;
  metroNote.innerHTML =
    `Clic ${gapLabel(rate.beats)} · <b>${String(bpm).replace(".", ",")} ppm</b> en tu metrónomo`;
}

/* ---------- panel de órbitas ---------- */
function buildPanel() {
  voicesEl.textContent = "";
  for (const ring of RINGS) {
    const st = state.rings[ring.id];
    const row = document.createElement("div");
    row.className = "voice";
    row.innerHTML = `
      <span class="chip ${ring.id}"></span>
      <span><span class="voice-name"></span><br><span class="voice-tech"></span></span>
      <button class="mute" aria-pressed="${st.muted}"></button>
      <div class="voice-ctl">
        <div class="rot">
          <button class="rl" aria-label="Rotar hacia atrás">&#8249;</button>
          <span class="val"></span>
          <button class="rr" aria-label="Rotar hacia adelante">&#8250;</button>
        </div>
        <input type="range" min="0" max="100" value="${Math.round(st.gain * 100)}">
      </div>`;
    row.querySelector(".voice-name").textContent = ring.name;
    row.querySelector(".voice-tech").textContent = ring.tech;
    row.querySelector("input").setAttribute("aria-label", `Volumen de ${ring.name}`);

    const mute = row.querySelector(".mute");
    mute.textContent = st.muted ? "muda" : "suena";
    mute.addEventListener("click", () => {
      update(() => { st.muted = !st.muted; });
      mute.setAttribute("aria-pressed", String(st.muted));
      mute.textContent = st.muted ? "muda" : "suena";
    });

    const val = row.querySelector(".val");
    val.textContent = fmtOffset(palo(state.palo), st.offset);
    const rotate = (delta) => {
      update(() => {
        const slots = slotsOf(palo(state.palo));
        st.offset = ((st.offset + delta) % slots + slots) % slots;
      });
      val.textContent = fmtOffset(palo(state.palo), st.offset);
    };
    row.querySelector(".rl").addEventListener("click", () => rotate(-1));
    row.querySelector(".rr").addEventListener("click", () => rotate(1));
    row.querySelector("input").addEventListener("input", (e) => {
      update(() => { st.gain = e.target.value / 100; });
    });

    voicesEl.appendChild(row);
  }
}

/* ---------- biblioteca ---------- */
function libMsg(text) {
  if (text) libHint.textContent = text;
  else libHint.innerHTML = LIB_HINT;
}

function renderLib() {
  const patterns = store.list();
  libList.textContent = "";
  if (!patterns.length) {
    const empty = document.createElement("li");
    empty.className = "lib-empty";
    empty.textContent = "Todavía no hay patrones guardados.";
    libList.appendChild(empty);
    return;
  }
  for (const p of patterns) {
    const li = document.createElement("li");
    li.className = "lib-row" + (p.id === activeId ? " active" : "");

    const load = document.createElement("button");
    load.className = "lib-load";
    load.innerHTML = '<span class="lib-name"></span><span class="lib-meta"></span>';
    load.querySelector(".lib-name").textContent = p.name;
    load.querySelector(".lib-meta").textContent =
      `${palo(p.data.palo).name} · ${p.data.bpm} ppm`;
    load.addEventListener("click", () => {
      update(() => { state = cloneState(p.data); }, "rebuild");
      activeId = p.id;
      libName.value = p.name;
      renderLib();
      libMsg(`Cargado: ${p.name}`);
      if (playing) { stop(); start(); }
    });

    const del = document.createElement("button");
    del.className = "lib-del";
    del.textContent = "×";
    del.setAttribute("aria-label", `Borrar ${p.name}`);
    let armed = false, armTimer = null;
    del.addEventListener("click", () => {
      if (!armed) {
        armed = true;
        del.textContent = "¿seguro?";
        del.classList.add("armed");
        armTimer = setTimeout(() => {
          armed = false;
          del.textContent = "×";
          del.classList.remove("armed");
        }, 3000);
        return;
      }
      clearTimeout(armTimer);
      store.removePattern(p.id);
      if (activeId === p.id) activeId = null;
      renderLib();
      libMsg(`Borrado: ${p.name}`);
    });

    li.appendChild(load);
    li.appendChild(del);
    libList.appendChild(li);
  }
}

function saveToLib() {
  const name = libName.value.trim();
  if (!name) { libMsg("Ponle un nombre al patrón."); libName.focus(); return; }
  const id = store.savePattern(name, state);
  if (!id) { libMsg("Este navegador no deja guardar (¿modo privado?)."); return; }
  activeId = id;
  renderLib();
  libMsg(`Guardado: ${name}`);
}

/* ---------- eventos ---------- */
hub.addEventListener("click", () => (playing ? stop() : start()));

tempo.addEventListener("input", (e) => {
  update(() => { state.bpm = Number(e.target.value); });
});

paloSel.addEventListener("change", (e) => {
  const id = e.target.value;
  update(() => {
    store.saveCurrent(state);                        // deja el palo que se abandona
    state = store.loadCurrent(id) || baseState(id);  // y recupera el nuevo
  }, "rebuild");
  if (playing) { stop(); start(); }                  // el ciclo cambia de longitud
  libMsg(`Palo: ${palo(state.palo).name}.`);
});

patternSel.addEventListener("change", (e) => {
  update(() => { state.pattern = e.target.value; }, "rebuild");
});

$("reset").addEventListener("click", () => {
  update(() => {
    const p = palo(state.palo);
    const base = basePattern(p, state.pattern);
    for (const id of VOICES) {
      state.rings[id].on = onFrom(p, base[id]);
      state.rings[id].offset = 0;
    }
  }, "rebuild");
  libMsg(`Patrón base de ${palo(state.palo).name.toLowerCase()}.`);
});

$("clear").addEventListener("click", () => {
  update(() => {
    const slots = slotsOf(palo(state.palo));
    for (const id of VOICES) state.rings[id].on = new Array(slots).fill(false);
  }, "rebuild");   // rebuild: el aviso de palo vacío puede tener que aparecer
});

$("share").addEventListener("click", async () => {
  const url = store.shareUrl(state);
  try {
    await navigator.clipboard.writeText(url);
    libMsg("Enlace copiado: lleva este compás dentro.");
  } catch (e) {
    libMsg(url); // sin permiso de portapapeles: al menos que se pueda copiar a mano
  }
});

libSave.addEventListener("click", saveToLib);
libName.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); saveToLib(); }
});

document.addEventListener("keydown", (e) => {
  if (e.code === "Space" && !/^(INPUT|BUTTON|TEXTAREA|SELECT)$/.test(e.target.tagName)) {
    e.preventDefault();
    playing ? stop() : start();
  }
});

/* ---------- arranque ---------- */
/* Los palos van al desplegable una sola vez. */
for (const p of PALOS) {
  const opt = document.createElement("option");
  opt.value = p.id;
  opt.textContent = p.name;
  paloSel.appendChild(opt);
}

rebuild();
renderLib();
requestAnimationFrame(frame);

if (fromLink) {
  store.saveCurrent(state);
  store.clearHash();
  libMsg("Compás cargado desde el enlace. Ponle un nombre para guardarlo aquí.");
}
