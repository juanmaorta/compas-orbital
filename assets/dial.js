/* El dial: los anillos, los puntos, la aguja y la tira del conteo. Recibe el
   estado y lo pinta; no lo modifica (avisa por onToggle y decide el que
   llama). */

import { BEATS, SYLL, STRIP, SLOTS, RINGS, isAccent, beatLabel } from "./compas.js";

const CX = 260, CY = 260;
const NS = "http://www.w3.org/2000/svg";

function el(tag, attrs) {
  const node = document.createElementNS(NS, tag);
  for (const k in attrs) node.setAttribute(k, attrs[k]);
  return node;
}
/* Ángulo de un paso dentro de una rejilla, con el 0 arriba. */
function angleOf(step, steps) { return -90 + step * (360 / steps); }
function point(radius, deg) {
  const a = deg * Math.PI / 180;
  return [CX + radius * Math.cos(a), CY + radius * Math.sin(a)];
}

export function createDial(svg, countEl, onToggle) {
  const gStatic = svg.querySelector("#static");
  const gDots = svg.querySelector("#dots");
  const needle = svg.querySelector("#needle");
  let sweep = null;
  let numEls = [];
  let sylEls = {};
  let dots = {};
  let lastBeat = -1;

  /* Anillos, radios de los doce tiempos, números y marcas de acento. */
  function drawStatic(variant) {
    gStatic.textContent = "";
    numEls = [];
    sweep = el("path", { class: "sweep", d: "" });
    gStatic.appendChild(sweep);

    for (const ring of RINGS) {
      gStatic.appendChild(el("circle", { class: "ring-line", cx: CX, cy: CY, r: ring.radius }));
    }
    for (let p = 0; p < 12; p++) {
      const a = angleOf(p, 12);
      const [x1, y1] = point(96, a);
      const [x2, y2] = point(232, a);
      gStatic.appendChild(el("line", {
        class: "spoke" + (isAccent(variant, p) ? " accent" : ""), x1, y1, x2, y2
      }));
    }
    for (let p = 0; p < 12; p++) {
      const a = angleOf(p, 12);
      const [x, y] = point(252, a);
      const text = el("text", { class: "beat-num" + (isAccent(variant, p) ? " accent" : ""), x, y });
      text.textContent = BEATS[p];
      gStatic.appendChild(text);
      numEls.push(text);
      if (isAccent(variant, p)) {
        const [tx, ty] = point(232, a);
        gStatic.appendChild(el("circle", { class: "accent-tick", cx: tx, cy: ty, r: 2 }));
      }
    }
    lastBeat = -1;
  }

  /* Un punto por posición y voz. Se crean una vez; luego solo se recolocan. */
  function drawDots() {
    gDots.textContent = "";
    dots = {};
    for (const ring of RINGS) {
      const arr = [];
      for (let i = 0; i < SLOTS; i++) {
        const dot = el("circle", {
          class: "dot", "data-voice": ring.id, "data-on": "0",
          tabindex: "0", role: "switch"
        });
        dot.addEventListener("click", () => onToggle(ring.id, i));
        dot.addEventListener("keydown", (ev) => {
          if (ev.key === " " || ev.key === "Enter") {
            ev.preventDefault();
            ev.stopPropagation();
            onToggle(ring.id, i);
          }
        });
        gDots.appendChild(dot);
        arr.push(dot);
      }
      dots[ring.id] = arr;
    }
  }

  /* El punto `idx` se dibuja en la posición (idx + rotación): rotar la órbita
     mueve los puntos de verdad. El tamaño lo decide la posición resultante,
     no la nota, porque "caer en un medio tiempo" es una propiedad del sitio
     del dial donde acaba sonando. */
  function place(state) {
    for (const ring of RINGS) {
      const st = state.rings[ring.id];
      dots[ring.id].forEach((dot, idx) => {
        const step = (idx + st.offset) % SLOTS;
        const half = step % 2 === 1;
        const [cx, cy] = point(ring.radius, angleOf(step, SLOTS));
        dot.setAttribute("cx", cx);
        dot.setAttribute("cy", cy);
        dot.setAttribute("r", half ? ring.dotRHalf : ring.dotR);
        dot.classList.toggle("half", half);
      });
    }
  }

  function paint(state) {
    for (const ring of RINGS) {
      const st = state.rings[ring.id];
      dots[ring.id].forEach((dot, idx) => {
        const on = !!st.on[idx];
        dot.setAttribute("data-on", on ? "1" : "0");
        dot.setAttribute("aria-checked", on ? "true" : "false");
        const step = (idx + st.offset) % SLOTS;
        dot.setAttribute("aria-label", `${ring.name}, tiempo ${beatLabel(step)}`);
      });
    }
  }

  function drawCount(variant) {
    countEl.textContent = "";
    sylEls = {};
    for (const p of STRIP) {
      const span = document.createElement("span");
      const accent = isAccent(variant, p);
      span.className = "syl" + (accent ? " accent" : "");
      span.textContent = accent ? SYLL[p].toUpperCase() : SYLL[p];
      countEl.appendChild(span);
      sylEls[p] = span;
    }
    lastBeat = -1;
  }

  /* Aguja y sector barrido. `pos` en pasos (0..24). */
  function setNeedle(pos) {
    const deg = angleOf(pos, SLOTS) + 90; // la aguja se dibuja apuntando arriba
    needle.setAttribute("transform", `rotate(${deg.toFixed(2)} ${CX} ${CY})`);
    if (!sweep) return;
    if (pos <= 0.0001) { sweep.setAttribute("d", ""); return; }
    const [sx, sy] = point(232, -90);
    const [ex, ey] = point(232, angleOf(pos, SLOTS));
    const big = pos / SLOTS > 0.5 ? 1 : 0;
    sweep.setAttribute("d",
      `M ${CX} ${CY} L ${sx.toFixed(2)} ${sy.toFixed(2)} ` +
      `A 232 232 0 ${big} 1 ${ex.toFixed(2)} ${ey.toFixed(2)} Z`);
  }

  /* Ilumina el tiempo en curso en el anillo y en la tira del conteo. */
  function highlight(beat) {
    if (beat === lastBeat) return;
    lastBeat = beat;
    for (let i = 0; i < 12; i++) {
      if (numEls[i]) numEls[i].classList.toggle("now", i === beat);
      if (sylEls[i]) sylEls[i].classList.toggle("now", i === beat);
    }
  }

  function flash(voice, idx) {
    const dot = dots[voice] && dots[voice][idx];
    if (!dot) return;
    dot.classList.add("hit");
    setTimeout(() => dot.classList.remove("hit"), 170);
  }

  return { drawStatic, drawDots, drawCount, place, paint, setNeedle, highlight, flash };
}
