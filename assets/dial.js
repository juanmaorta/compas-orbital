/* El dial: los anillos, los puntos, la aguja y la tira del conteo. Recibe el
   palo y el estado, y los pinta; no los modifica (avisa por onToggle y decide
   quien llama).

   Todas las funciones reciben el palo como primer argumento `p`: de él salen
   los tiempos, la rejilla, los números y el conteo. */

import { RINGS, slotsOf, isAccent, beatLabel } from "./compas.js";

const CX = 260, CY = 260;
/* radios de la escena: los radios de los tiempos, el borde barrido y los números */
const R_SPOKE_IN = 84, R_SPOKE_OUT = 230, R_NUM = 252;
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

  /* Anillos, radios de los tiempos, números y marcas de acento. */
  function drawStatic(p, patternId) {
    gStatic.textContent = "";
    numEls = [];
    sweep = el("path", { class: "sweep", d: "" });
    gStatic.appendChild(sweep);

    for (const ring of RINGS) {
      gStatic.appendChild(el("circle", { class: "ring-line", cx: CX, cy: CY, r: ring.radius }));
    }
    for (let i = 0; i < p.beats; i++) {
      const a = angleOf(i, p.beats);
      const [x1, y1] = point(R_SPOKE_IN, a);
      const [x2, y2] = point(R_SPOKE_OUT, a);
      gStatic.appendChild(el("line", {
        class: "spoke" + (isAccent(p, patternId, i) ? " accent" : ""), x1, y1, x2, y2
      }));
    }
    for (let i = 0; i < p.beats; i++) {
      const a = angleOf(i, p.beats);
      const [x, y] = point(R_NUM, a);
      const text = el("text", {
        class: "beat-num" + (isAccent(p, patternId, i) ? " accent" : ""), x, y
      });
      text.textContent = p.order[i];
      gStatic.appendChild(text);
      numEls.push(text);
      if (isAccent(p, patternId, i)) {
        const [tx, ty] = point(R_SPOKE_OUT, a);
        gStatic.appendChild(el("circle", { class: "accent-tick", cx: tx, cy: ty, r: 2 }));
      }
    }
    lastBeat = -1;
  }

  /* Un punto por posición de la rejilla y voz. Se crean al cambiar de palo;
     luego solo se recolocan. */
  function drawDots(p) {
    gDots.textContent = "";
    dots = {};
    for (const ring of RINGS) {
      const arr = [];
      for (let i = 0; i < slotsOf(p); i++) {
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
     mueve los puntos de verdad. El tamaño lo decide la posición resultante, no
     la nota, porque "caer en una subdivisión" es una propiedad del sitio del
     dial donde acaba sonando. */
  function place(p, state) {
    const slots = slotsOf(p);
    for (const ring of RINGS) {
      const st = state.rings[ring.id];
      dots[ring.id].forEach((dot, idx) => {
        const step = (idx + st.offset) % slots;
        const half = step % p.sub !== 0;
        const [cx, cy] = point(ring.radius, angleOf(step, slots));
        dot.setAttribute("cx", cx);
        dot.setAttribute("cy", cy);
        dot.setAttribute("r", half ? ring.dotRHalf : ring.dotR);
        dot.classList.toggle("half", half);
      });
    }
  }

  function paint(p, state) {
    const slots = slotsOf(p);
    for (const ring of RINGS) {
      const st = state.rings[ring.id];
      dots[ring.id].forEach((dot, idx) => {
        const on = !!st.on[idx];
        dot.setAttribute("data-on", on ? "1" : "0");
        dot.setAttribute("aria-checked", on ? "true" : "false");
        const step = (idx + st.offset) % slots;
        dot.setAttribute("aria-label", `${ring.name}, tiempo ${beatLabel(p, step)}`);
      });
    }
  }

  function drawCount(p, patternId) {
    countEl.textContent = "";
    sylEls = {};
    for (const i of p.strip) {
      const span = document.createElement("span");
      const accent = isAccent(p, patternId, i);
      span.className = "syl" + (accent ? " accent" : "");
      span.textContent = accent ? p.count[i].toUpperCase() : p.count[i];
      countEl.appendChild(span);
      sylEls[i] = span;
    }
    lastBeat = -1;
  }

  /* Aguja y sector barrido. `pos` en pasos de la rejilla del palo. */
  function setNeedle(p, pos) {
    const slots = slotsOf(p);
    const deg = angleOf(pos, slots) + 90; // la aguja se dibuja apuntando arriba
    needle.setAttribute("transform", `rotate(${deg.toFixed(2)} ${CX} ${CY})`);
    if (!sweep) return;
    if (pos <= 0.0001) { sweep.setAttribute("d", ""); return; }
    const [sx, sy] = point(R_SPOKE_OUT, -90);
    const [ex, ey] = point(R_SPOKE_OUT, angleOf(pos, slots));
    const big = pos / slots > 0.5 ? 1 : 0;
    sweep.setAttribute("d",
      `M ${CX} ${CY} L ${sx.toFixed(2)} ${sy.toFixed(2)} ` +
      `A ${R_SPOKE_OUT} ${R_SPOKE_OUT} 0 ${big} 1 ${ex.toFixed(2)} ${ey.toFixed(2)} Z`);
  }

  /* Ilumina el tiempo en curso en el anillo y en la tira del conteo. */
  function highlight(beat) {
    if (beat === lastBeat) return;
    lastBeat = beat;
    for (let i = 0; i < numEls.length; i++) {
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
