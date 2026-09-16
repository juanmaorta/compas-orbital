/* Pruebas del dominio: no necesitan navegador, porque compas.js no toca el
   DOM ni el audio. Se ejecutan con `npm test`. */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PALOS, palo, paloByCode, slotsOf, patternOf, slotsAt, offbeats, onFrom,
  basePattern, baseState, sanitize, cloneState, clickRate,
  beatLabel, fmtOffset, encode, decode, slug
} from "../assets/compas.js";

const positions = (bits) => bits.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
const SB = () => palo("solea-bulerias");
const TG = () => palo("tangos");

/* ---- la rejilla de cada palo ---- */

test("cada palo declara su rejilla", () => {
  assert.equal(slotsOf(SB()), 24);
  assert.equal(slotsOf(TG()), 8);
  assert.equal(PALOS.length, 2);
});

test("un palo desconocido cae en el primero", () => {
  assert.equal(palo("loquesea").id, "solea-bulerias");
  assert.equal(paloByCode("xx").id, "solea-bulerias");
  assert.equal(paloByCode("tg").id, "tangos");
});

test("las posiciones se convierten a slots con la subdivisión del palo", () => {
  assert.deepEqual(slotsAt(SB(), [0, 3, 10]), [0, 6, 20]);
  assert.deepEqual(slotsAt(TG(), [0, 2]), [0, 4]);
  assert.deepEqual(offbeats(TG()), [1, 3, 5, 7]);
  assert.equal(offbeats(SB()).length, 12);
});

test("onFrom enciende los slots que se le dan", () => {
  assert.deepEqual(positions(onFrom(TG(), [0, 4])), [0, 4]);
  assert.equal(onFrom(TG(), []).length, 8);
});

/* ---- patrones de arranque ---- */

test("el patrón base reparte los cinco acentos entre grave y agudo", () => {
  const base = basePattern(SB(), "7");
  assert.deepEqual(base.grave, [0, 6, 20]);        // tiempos 12, 3 y 10
  assert.deepEqual(base.seco, [14, 16]);           // tiempos 7 y 8
  assert.equal(base.fantasma.length, 12);          // todas las contras
  assert.deepEqual(base.metro, [0, 4, 8, 12, 16, 20]); // los pares
});

test("con el patrón del 6, el agudo se muda del 7 al 6", () => {
  assert.deepEqual(basePattern(SB(), "6").seco, [12, 16]);
});

test("tangos nace con el cajón vacío y el clic en 1 y 3", () => {
  const base = basePattern(TG(), "13");
  assert.deepEqual(base.grave, []);
  assert.deepEqual(base.seco, []);
  assert.deepEqual(base.fantasma, []);
  assert.deepEqual(base.metro, [0, 4]);
});

test("el patrón de compás de tangos es 1·3 y es el único", () => {
  assert.equal(TG().patterns.length, 1);
  assert.deepEqual(patternOf(TG(), "13").pattern, [0, 2]);
  assert.deepEqual(patternOf(TG(), "loquesea").pattern, [0, 2]);
});

test("baseState arranca en soleá por bulerías, y tangos vacío", () => {
  const s = baseState();
  assert.equal(s.palo, "solea-bulerias");
  assert.equal(s.pattern, "7");
  assert.equal(s.bpm, 150);
  assert.equal(s.rings.grave.on.length, 24);
  const tg = baseState("tangos");
  assert.equal(tg.bpm, 110);
  assert.equal(tg.rings.grave.on.length, 8);
  assert.equal(tg.rings.grave.on.some(Boolean), false);
  assert.deepEqual(positions(tg.rings.metro.on), [0, 4]);
});

/* ---- etiquetas ---- */

test("la contra se llama distinto en cada palo", () => {
  assert.equal(beatLabel(SB(), 19), "9 y medio");
  assert.equal(beatLabel(SB(), 6), "3");
  assert.equal(beatLabel(SB(), 0), "12");
  assert.equal(beatLabel(TG(), 3), "2 y");
  assert.equal(beatLabel(TG(), 4), "3");
});

test("la rotación se cuenta en subdivisiones y se muestra en tiempos", () => {
  assert.equal(fmtOffset(SB(), 0), "0");
  assert.equal(fmtOffset(SB(), 1), "+0,5");
  assert.equal(fmtOffset(SB(), 2), "+1");
  assert.equal(fmtOffset(TG(), 1), "+0,5");
});

/* ---- validación ---- */

test("sanitize valida la longitud contra el palo", () => {
  const s = sanitize({ palo: "tangos", pattern: "13", bpm: 120,
    rings: { grave: { on: new Array(8).fill(true) } } });
  assert.equal(s.rings.grave.on.length, 8);
  assert.equal(s.rings.grave.on.every(Boolean), true);
  const malo = sanitize({ palo: "tangos",
    rings: { grave: { on: new Array(7).fill(true) } } });
  assert.equal(malo.rings.grave.on.some(Boolean), false);
});

test("un estado sin palo se lee como soleá por bulerías", () => {
  const s = sanitize({ bpm: 150, variant: 6, rings: {} });
  assert.equal(s.palo, "solea-bulerias");
  assert.equal(s.pattern, "6");   // el número viejo se mapea a texto
});

test("sanitize expande patrones de antes de las subdivisiones", () => {
  const viejo = { palo: "solea-bulerias", rings: { grave: { on:
    [true, false, false, true, false, false, false, false, false, false, false, false] } } };
  const s = sanitize(viejo);
  assert.equal(s.rings.grave.on.length, 24);
  assert.deepEqual(positions(s.rings.grave.on), [0, 6]);
});

test("sanitize no se rompe con basura", () => {
  assert.equal(sanitize(null).bpm, 150);
  assert.equal(sanitize({ bpm: 9999, variant: 3 }).bpm, 150);
  assert.equal(sanitize({ bpm: 9999, variant: 3 }).pattern, "7");
  assert.equal(sanitize({ palo: 42 }).palo, "solea-bulerias");
});

test("cloneState lleva el palo y el patrón", () => {
  const s = baseState("tangos");
  const c = cloneState(s);
  assert.equal(c.palo, "tangos");
  assert.equal(c.pattern, "13");
  c.rings.grave.on[0] = true;
  assert.equal(s.rings.grave.on[0], false);   // copia de verdad
});

/* ---- metrónomo ---- */

test("con el clic en los pares, el metrónomo va a la mitad de ppm", () => {
  const s = baseState();
  s.bpm = 150;
  const rate = clickRate(s);
  assert.equal(rate.regular, true);
  assert.equal(rate.beats, 2);
  assert.equal(rate.bpm, 75);
});

test("en tangos el clic de 1 y 3 también va a la mitad", () => {
  const s = baseState("tangos");
  s.bpm = 120;
  assert.deepEqual(clickRate(s), { regular: true, gap: 4, beats: 2, bpm: 60 });
});

test("con el clic en cada pulso, el ppm coincide con el de la página", () => {
  const s = baseState();
  s.bpm = 186;
  for (let i = 0; i < 24; i += 2) s.rings.metro.on[i] = true;
  assert.deepEqual(clickRate(s), { regular: true, gap: 2, beats: 1, bpm: 186 });
});

test("la rotación del clic no cambia su velocidad", () => {
  const s = baseState();
  s.rings.metro.offset = 1;
  assert.equal(clickRate(s).bpm, 75);
});

test("un clic irregular no tiene un ppm único", () => {
  const s = baseState();
  s.rings.metro.on[1] = true;
  assert.equal(clickRate(s).regular, false);
});

test("sin clics no hay metrónomo", () => {
  const s = baseState("tangos");
  s.rings.metro.on = new Array(8).fill(false);
  assert.equal(clickRate(s), null);
});

/* ---- la URL ---- */

test("el formato 3 lleva el palo dentro y hex de su rejilla", () => {
  const parts = encode(baseState("tangos")).split(".");
  assert.equal(parts[0], "3");
  assert.equal(parts[1], "tg");
  assert.equal(parts[2], "13");
  assert.equal(parts[3], "110");
  assert.equal(parts[4].split("-")[0].length, 2);   // 8 bits → 2 dígitos hex
  assert.equal(parts.length, 8);                    // cabecera + 4 voces
});

test("ida y vuelta por la URL en los dos palos", () => {
  for (const id of ["solea-bulerias", "tangos"]) {
    const s = baseState(id);
    s.rings.grave.on[1] = true;
    s.rings.seco.offset = 1;
    const back = decode(encode(s));
    assert.equal(back.palo, id);
    assert.equal(back.bpm, s.bpm);
    for (const v of ["grave", "seco", "fantasma", "metro"]) {
      assert.deepEqual(back.rings[v].on, s.rings[v].on);
      assert.equal(back.rings[v].offset, s.rings[v].offset);
    }
  }
});

test("los enlaces 1. y 2. se leen como soleá por bulerías", () => {
  const dos = decode("2.7.150.820008-0.000280-0.555555-0.888888-0");
  assert.equal(dos.palo, "solea-bulerias");
  assert.equal(dos.pattern, "7");
  assert.deepEqual(positions(dos.rings.grave.on), [0, 6, 20]);
  assert.deepEqual(positions(dos.rings.metro.on), [0, 4, 8, 12, 16, 20]);
  const uno = decode("1.6.150.820008-0.000280-0.555555-0");
  assert.equal(uno.pattern, "6");
  // el metrónomo no venía en el formato 1: entra con su base
  assert.deepEqual(positions(uno.rings.metro.on), [0, 4, 8, 12, 16, 20]);
});

test("decode rechaza lo que no entiende", () => {
  assert.equal(decode("basura"), null);
  assert.equal(decode(""), null);
  assert.equal(decode("9.sb.7.150.a-0.b-0.c-0.d-0"), null);
});

/* ---- nombres ---- */

test("los nombres se vuelven identificadores usables", () => {
  assert.equal(slug("Bulería remate 1"), "buleria-remate-1");
  assert.equal(slug("  soleá  por  bulerías "), "solea-por-bulerias");
});
