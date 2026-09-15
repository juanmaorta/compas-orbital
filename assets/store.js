/* Dónde viven los patrones sin servidor: el navegador de quien abre la página
   y la propia URL. Todo acceso a localStorage va envuelto, porque en modo
   privado o con las cookies bloqueadas lanza en lugar de devolver vacío. */

import { cloneState, sanitize, encode, decode, slug } from "./compas.js";

const KEY_CURRENT = "compas-orbita:actual";
const KEY_LIBRARY = "compas-orbita:biblioteca";

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) { return false; }
}

/* Lo que había en el dial la última vez. */
export function loadCurrent() {
  const raw = read(KEY_CURRENT);
  return raw ? sanitize(raw) : null;
}
export function saveCurrent(state) {
  return write(KEY_CURRENT, cloneState(state));
}

/* Biblioteca: un objeto { id: {name, savedAt, data} }. */
export function list() {
  const all = read(KEY_LIBRARY) || {};
  return Object.keys(all)
    .map((id) => ({ id, name: all[id].name || id, savedAt: all[id].savedAt || 0,
                    data: sanitize(all[id].data) }))
    .sort((a, b) => b.savedAt - a.savedAt);
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

/* Un compás entero cabe en la URL: #c=1.7.150.802-0.0140-0.aaaa-0 */
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
