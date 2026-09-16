/* Dónde viven los patrones sin servidor: el navegador de quien abre la página
   y la propia URL.

   Cada palo guarda su propio estado de trabajo, porque los patrones de
   rejillas distintas no son convertibles: cambiar de palo y volver no debe
   borrar nada.

   Todo acceso al almacén va envuelto, porque en modo privado o con las
   cookies bloqueadas lanza en lugar de devolver vacío. */

import { cloneState, sanitize, encode, decode, slug, palo, PALOS } from "./compas.js";

const KEY_CURRENT = "compas-orbital:actual";
const KEY_LIBRARY = "compas-orbital:biblioteca";

/* El almacén se inyecta para poder probarlo fuera del navegador. */
let backend = typeof globalThis.localStorage !== "undefined" ? globalThis.localStorage : null;
export function setStorage(s) { backend = s; }

function read(key) {
  try {
    const raw = backend && backend.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
function write(key, value) {
  try {
    backend.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) { return false; }
}

/* {palo: activo, estados: {paloId: State}}. Lo guardado antes de los palos era
   un estado suelto de soleá por bulerías: se envuelve al leer. */
export function loadAll() {
  const raw = read(KEY_CURRENT);
  if (!raw) return { palo: PALOS[0].id, estados: {} };
  if (raw.rings) {
    const migrado = sanitize(raw);
    return { palo: migrado.palo, estados: { [migrado.palo]: migrado } };
  }
  const estados = {};
  for (const id of Object.keys(raw.estados || {})) {
    estados[id] = sanitize(raw.estados[id]);
  }
  return { palo: palo(raw.palo).id, estados };
}

export function loadCurrent(paloId) {
  const all = loadAll();
  return all.estados[paloId || all.palo] || null;
}

export function saveCurrent(state) {
  const all = loadAll();
  all.estados[state.palo] = cloneState(state);
  all.palo = state.palo;
  return write(KEY_CURRENT, all);
}

/* Biblioteca: un objeto { id: {name, savedAt, data} }. */
export function list() {
  const all = read(KEY_LIBRARY) || {};
  return Object.keys(all).map((id) => {
    const data = sanitize(all[id].data);
    return { id, name: all[id].name || id, palo: data.palo,
             savedAt: all[id].savedAt || 0, data };
  }).sort((a, b) => b.savedAt - a.savedAt);
}

export function savePattern(name, state) {
  const all = read(KEY_LIBRARY) || {};
  const id = slug(name);
  all[id] = { name, savedAt: Date.now(), data: cloneState(state) };
  return write(KEY_LIBRARY, all) ? id : null;
}

export function removePattern(id) {
  const all = read(KEY_LIBRARY) || {};
  delete all[id];
  return write(KEY_LIBRARY, all);
}

/* Un compás entero cabe en la URL: #c=3.sb.7.150.820008-0.…
   (versión del formato, palo, patrón de compás, ppm y las cuatro voces). */
export function fromHash() {
  const match = /[#&]c=([^&]+)/.exec(location.hash || "");
  return match ? decode(decodeURIComponent(match[1])) : null;
}
export function shareUrl(state) {
  return `${location.origin}${location.pathname}#c=${encode(state)}`;
}
export function clearHash() {
  if (location.hash) history.replaceState(null, "", location.pathname + location.search);
}
