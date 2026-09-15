/* Monta la página: estado, reloj, panel y biblioteca.
   El reloj es lo único delicado. El audio del navegador se programa con
   antelación (no se puede confiar en un setInterval para colocar golpes), así
   que un temporizador va encolando los pasos que caen en los próximos 120 ms
   y guarda a qué hora suena cada uno; la aguja y los destellos se pintan
   luego contra ese reloj, no contra el del navegador. */

import { SLOTS, RINGS, VOICES, baseState, basePattern, cloneState, fmtOffset } from "./compas.js";
import { createAudio } from "./audio.js";
import { createDial } from "./dial.js";
import * as store from "./store.js";

/* ---------- estado ---------- */
const fromLink = store.fromHash();
let state = fromLink || store.loadCurrent() || baseState();
let playing = false;
let activeId = null;

/* ---------- DOM ---------- */
const $ = (id) => document.getElementById(id);
const hub = $("hub"), hubGlyph = $("hubGlyph"), hubBpm = $("hubBpm");
const tempo = $("tempo"), tempoVal = $("tempoVal");
const v7 = $("v7"), v6 = $("v6");
const voicesEl = $("voices");
const libName = $("libName"), libSave = $("libSave"), libList = $("libList"), libHint = $("libHint");
const LIB_HINT = libHint.innerHTML;

const audio = createAudio();
const dial = createDial($("dial"), $("count"), toggleDot);

/* ---------- reloj ---------- */
let nextSlot = 0, nextTime = 0, timer = null, slotDur = 0.2;
let queue = [];   // {slot, time} de los pasos ya programados
let flashes = []; // {time, voice, idx} de los puntos que deben destellar

const slotDuration = () => (60 / state.bpm) / 2; // el ppm es uno de los doce

function scheduleSlot(slot, time) {
  for (const ring of RINGS) {
    const st = state.rings[ring.id];
    const idx = ((slot - st.offset) % SLOTS + SLOTS) % SLOTS;
    if (!st.on[idx]) continue;
    if (!st.muted) audio.hit(ring.id, time, st.gain);
    flashes.push({ time, voice: ring.id, idx });
  }
  queue.push({ slot, time });
  if (queue.length > 40) queue.shift();
}

function tick() {
  if (!audio.ready) return;
  while (nextTime < audio.now() + 0.12) {
    scheduleSlot(nextSlot, nextTime);
    slotDur = slotDuration();
    nextTime += slotDur;
    nextSlot = (nextSlot + 1) % SLOTS;
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
  dial.setNeedle(0);
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
    const pos = (queue[0].slot + Math.min(1, (now - queue[0].time) / slotDur)) % SLOTS;
    dial.setNeedle(pos);
    dial.highlight(Math.floor(pos / 2));
  }
}

/* ---------- edición ---------- */
function toggleDot(voice, idx) {
  const st = state.rings[voice];
  st.on[idx] = !st.on[idx];
  dial.paint(state);
  if (st.on[idx]) audio.hit(voice, 0, st.gain); // que se oiga lo que pones
  store.saveCurrent(state);
}

function setVariant(variant) {
  state.variant = variant;
  v7.setAttribute("aria-pressed", variant === 7 ? "true" : "false");
  v6.setAttribute("aria-pressed", variant === 6 ? "true" : "false");
  dial.drawStatic(variant);
  dial.drawCount(variant);
  if (!playing) dial.setNeedle(0);
  store.saveCurrent(state);
}

function setBpm(bpm) {
  state.bpm = bpm;
  tempo.value = bpm;
  tempoVal.textContent = bpm;
  hubBpm.textContent = bpm;
}

/* Redibuja todo a partir del estado (al cargar y al traer un patrón). */
function renderAll() {
  setBpm(state.bpm);
  setVariant(state.variant);
  buildPanel();
  dial.place(state);
  dial.paint(state);
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
          <button class="rl" aria-label="Rotar medio tiempo hacia atrás">&#8249;</button>
          <span class="val"></span>
          <button class="rr" aria-label="Rotar medio tiempo hacia adelante">&#8250;</button>
        </div>
        <input type="range" min="0" max="100" value="${Math.round(st.gain * 100)}">
      </div>`;
    row.querySelector(".voice-name").textContent = ring.name;
    row.querySelector(".voice-tech").textContent = ring.tech;
    row.querySelector("input").setAttribute("aria-label", `Volumen de ${ring.name}`);

    const mute = row.querySelector(".mute");
    mute.textContent = st.muted ? "muda" : "suena";
    mute.addEventListener("click", () => {
      st.muted = !st.muted;
      mute.setAttribute("aria-pressed", String(st.muted));
      mute.textContent = st.muted ? "muda" : "suena";
      store.saveCurrent(state);
    });

    const val = row.querySelector(".val");
    val.textContent = fmtOffset(st.offset);
    const rotate = (delta) => {
      st.offset = ((st.offset + delta) % SLOTS + SLOTS) % SLOTS;
      val.textContent = fmtOffset(st.offset);
      dial.place(state);
      dial.paint(state);
      store.saveCurrent(state);
    };
    row.querySelector(".rl").addEventListener("click", () => rotate(-1));
    row.querySelector(".rr").addEventListener("click", () => rotate(1));
    row.querySelector("input").addEventListener("input", (e) => {
      st.gain = e.target.value / 100;
      store.saveCurrent(state);
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
      `${p.data.bpm} ppm · acento ${p.data.variant}`;
    load.addEventListener("click", () => {
      state = cloneState(p.data);
      activeId = p.id;
      libName.value = p.name;
      renderAll();
      renderLib();
      store.saveCurrent(state);
      libMsg(`Cargado: ${p.name}`);
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
  setBpm(Number(e.target.value));
  store.saveCurrent(state);
});
v7.addEventListener("click", () => setVariant(7));
v6.addEventListener("click", () => setVariant(6));

$("reset").addEventListener("click", () => {
  const base = basePattern(state.variant);
  for (const id of VOICES) {
    state.rings[id].on = base[id];
    state.rings[id].offset = 0;
  }
  renderAll();
  store.saveCurrent(state);
  libMsg("Patrón base del acento " + state.variant + ".");
});
$("clear").addEventListener("click", () => {
  for (const id of VOICES) state.rings[id].on = new Array(SLOTS).fill(false);
  dial.paint(state);
  store.saveCurrent(state);
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
dial.drawDots();
renderAll();
renderLib();
dial.setNeedle(0);
requestAnimationFrame(frame);

if (fromLink) {
  store.saveCurrent(state);
  store.clearHash();
  libMsg("Compás cargado desde el enlace. Ponle un nombre para guardarlo aquí.");
}
