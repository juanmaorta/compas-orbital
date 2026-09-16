/* Pruebas de la persistencia: el almacén se inyecta, así que se pueden
   ejecutar sin navegador. Lo que usa `location` (fromHash, shareUrl) no se
   prueba aquí: lo cubre encode/decode en compas.test.js. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { setStorage, loadAll, loadCurrent, saveCurrent, list, savePattern, removePattern }
  from "../assets/store.js";
import { baseState } from "../assets/compas.js";

/* localStorage de mentira: un Map con la misma superficie */
function fakeStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    _map: map
  };
}

test("cada palo guarda su propio estado de trabajo", () => {
  setStorage(fakeStorage());
  const sb = baseState("solea-bulerias");
  const tg = baseState("tangos");
  tg.rings.grave.on[0] = true;
  saveCurrent(sb);
  saveCurrent(tg);
  assert.equal(loadAll().palo, "tangos");                     // el último activo
  assert.equal(loadCurrent("solea-bulerias").rings.grave.on.length, 24);
  assert.equal(loadCurrent("tangos").rings.grave.on[0], true);
  assert.equal(loadCurrent().rings.grave.on.length, 8);       // sin argumento, el activo
});

test("un estado guardado antes de los palos se migra a soleá por bulerías", () => {
  const viejo = JSON.stringify({ bpm: 150, variant: 7,
    rings: { grave: { on: new Array(24).fill(false), offset: 0, gain: 0.9, muted: false } } });
  setStorage(fakeStorage({ "compas-orbital:actual": viejo }));
  const all = loadAll();
  assert.equal(all.palo, "solea-bulerias");
  assert.equal(all.estados["solea-bulerias"].rings.grave.on.length, 24);
  assert.equal(all.estados["solea-bulerias"].pattern, "7");
});

test("los patrones de la biblioteca llevan su palo", () => {
  setStorage(fakeStorage());
  savePattern("tangos base", baseState("tangos"));
  const [p] = list();
  assert.equal(p.palo, "tangos");
  assert.equal(p.data.rings.grave.on.length, 8);
  assert.equal(removePattern(p.id), true);
  assert.deepEqual(list(), []);
});

test("un patrón guardado sin palo se lee como soleá por bulerías", () => {
  const biblio = JSON.stringify({ viejo: { name: "viejo", savedAt: 1,
    data: { bpm: 150, variant: 6, rings: {} } } });
  setStorage(fakeStorage({ "compas-orbital:biblioteca": biblio }));
  const [p] = list();
  assert.equal(p.palo, "solea-bulerias");
  assert.equal(p.data.pattern, "6");
});

test("si el almacén está bloqueado, no se rompe nada", () => {
  setStorage({ getItem: () => { throw new Error("no"); },
               setItem: () => { throw new Error("no"); } });
  assert.equal(loadCurrent("tangos"), null);
  assert.deepEqual(list(), []);
  assert.equal(savePattern("x", baseState("tangos")), null);
  assert.equal(saveCurrent(baseState("tangos")), false);
});
