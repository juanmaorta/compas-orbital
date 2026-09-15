/* Pruebas del dominio: no necesitan navegador, porque compas.js no toca el
   DOM ni el audio. Se ejecutan con `npm test` (o `node --test test/`). */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  baseState, basePattern, encode, decode, sanitize,
  beatLabel, fmtOffset, slug, SLOTS
} from "../assets/compas.js";

const positions = (bits) => bits.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);

test("el patrón base marca los cinco acentos entre grave y agudo", () => {
  const s = baseState(7);
  // en la rejilla de 24, el tiempo N ocupa la posición N*2: 12→0, 3→6, 10→20
  assert.deepEqual(positions(s.rings.grave.on), [0, 6, 20]);
  assert.deepEqual(positions(s.rings.seco.on), [14, 16]); // 7 y 8
  assert.equal(s.rings.fantasma.on.filter(Boolean).length, 12); // todas las contras
});

test("con el acento en el 6, el agudo se muda del 7 al 6", () => {
  assert.deepEqual(positions(basePattern(6).seco), [12, 16]); // 6 y 8
});

test("las posiciones impares son medios tiempos", () => {
  assert.equal(beatLabel(19), "9 y medio");
  assert.equal(beatLabel(6), "3");
  assert.equal(beatLabel(0), "12");
});

test("la rotación se cuenta en medios y se muestra en tiempos", () => {
  assert.equal(fmtOffset(0), "0");
  assert.equal(fmtOffset(1), "+0,5");
  assert.equal(fmtOffset(2), "+1");
});

test("un compás sobrevive a la ida y vuelta por la URL", () => {
  const s = baseState(6);
  s.bpm = 186;
  s.rings.grave.on[19] = true;   // un grave en el 9 y medio
  s.rings.seco.offset = 3;
  const back = decode(encode(s));
  for (const id of ["grave", "seco", "fantasma"]) {
    assert.deepEqual(back.rings[id].on, s.rings[id].on);
    assert.equal(back.rings[id].offset, s.rings[id].offset);
  }
  assert.equal(back.bpm, 186);
  assert.equal(back.variant, 6);
});

test("decode rechaza lo que no entiende", () => {
  assert.equal(decode("basura"), null);
  assert.equal(decode(""), null);
  assert.equal(decode("2.7.150.a-0.b-0.c-0"), null); // versión desconocida
});

test("sanitize expande patrones de doce posiciones a la rejilla de 24", () => {
  const viejo = { variant: 7, bpm: 150, rings: { grave: { on: [true, false, false, true,
    false, false, false, false, false, false, false, false] } } };
  const s = sanitize(viejo);
  assert.equal(s.rings.grave.on.length, SLOTS);
  assert.deepEqual(positions(s.rings.grave.on), [0, 6]);
});

test("sanitize no se rompe con basura", () => {
  assert.equal(sanitize(null).bpm, 150);
  assert.equal(sanitize({ bpm: 9999, variant: 3 }).bpm, 150);
  assert.equal(sanitize({ bpm: 9999, variant: 3 }).variant, 7);
});

test("los nombres se vuelven identificadores usables", () => {
  assert.equal(slug("Bulería remate 1"), "buleria-remate-1");
  assert.equal(slug("  soleá  por  bulerías "), "solea-por-bulerias");
});
