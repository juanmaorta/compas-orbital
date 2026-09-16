/* Pruebas del dominio: no necesitan navegador, porque compas.js no toca el
   DOM ni el audio. Se ejecutan con `npm test` (o `node --test test/`). */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  baseState, basePattern, encode, decode, sanitize, clickRate,
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
  for (const id of ["grave", "seco", "fantasma", "metro"]) {
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

/* ---- metrónomo ---- */

test("el clic del metrónomo cae en los tiempos pares", () => {
  // 12, 2, 4, 6, 8 y 10 → posiciones 0, 4, 8, 12, 16 y 20 de la rejilla
  assert.deepEqual(positions(baseState(7).rings.metro.on), [0, 4, 8, 12, 16, 20]);
});

test("con el clic en los pares, el metrónomo va a la mitad de ppm", () => {
  const s = baseState(7);
  s.bpm = 150;
  const rate = clickRate(s);
  assert.equal(rate.regular, true);
  assert.equal(rate.beats, 2);      // un clic cada dos tiempos
  assert.equal(rate.bpm, 75);       // la mitad: lo que se pone en el metrónomo
});

test("con el clic en cada pulso, el ppm coincide con el de la página", () => {
  const s = baseState(7);
  s.bpm = 186;
  for (let i = 0; i < SLOTS; i += 2) s.rings.metro.on[i] = true;
  assert.deepEqual(clickRate(s), { regular: true, gap: 2, beats: 1, bpm: 186 });
});

test("la rotación del clic no cambia su velocidad", () => {
  const s = baseState(7);
  s.rings.metro.offset = 1;         // el clic, a contratiempo
  assert.equal(clickRate(s).bpm, 75);
});

test("un clic irregular no tiene un ppm único", () => {
  const s = baseState(7);
  s.rings.metro.on[1] = true;
  assert.equal(clickRate(s).regular, false);
});

test("sin clics no hay metrónomo", () => {
  const s = baseState(7);
  s.rings.metro.on = new Array(SLOTS).fill(false);
  assert.equal(clickRate(s), null);
});

test("los enlaces del formato 1, sin metrónomo, se siguen leyendo", () => {
  const viejo = "1.7.150.820008-0.000280-0.555555-0";
  const s = decode(viejo);
  assert.ok(s, "debería entender el formato viejo");
  assert.equal(s.bpm, 150);
  assert.deepEqual(positions(s.rings.grave.on), [0, 6, 20]);
  // el metrónomo no venía en el enlace: entra con su patrón base
  assert.deepEqual(positions(s.rings.metro.on), [0, 4, 8, 12, 16, 20]);
});

test("el formato nuevo lleva las cuatro voces", () => {
  const code = encode(baseState(7));
  assert.equal(code.split(".")[0], "2");
  assert.equal(code.split(".").length, 7); // versión, acento, ppm y 4 voces
});
