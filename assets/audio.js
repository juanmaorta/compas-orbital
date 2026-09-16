/* Las tres voces del cajón más el clic del metrónomo, sintetizados. No son samples: un tono grave que
   cae, ruido filtrado para el agudo (con el zumbido de las cuerdas de dentro)
   y un golpe muy corto y sordo para la fantasma. Aproximan lo justo para
   estudiar el compás. */

export function createAudio() {
  let ctx = null;
  let noiseBuffer = null;

  /* El contexto solo se puede crear tras un gesto del usuario. */
  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function noiseSource() {
    if (!noiseBuffer) {
      const len = Math.floor(ctx.sampleRate * 0.5);
      noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    return src;
  }

  /* Ráfaga de ruido filtrado con envolvente percusiva. */
  function burst(at, type, freq, q, dur, level) {
    const src = noiseSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    filter.type = type;
    filter.frequency.value = freq;
    if (q) filter.Q.value = q;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(level, at + 0.0015);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
    src.start(at);
    src.stop(at + dur + 0.02);
  }

  function tone(at, type, from, to, dur, level) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, at);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, at + 0.07);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(level, at + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }

  /* Un golpe. `when` en el reloj del contexto; sin él, ya. */
  function hit(voice, when, volume) {
    if (!ensure()) return;
    const at = when || ctx.currentTime + 0.01;
    const v = Math.min(1, Math.max(0, volume));
    if (voice === "grave") {
      tone(at, "sine", 145, 78, 0.34, v * 0.95);   // parche central, afinado
      burst(at, "lowpass", 420, 0.7, 0.045, v * 0.3); // el golpe de la mano
    } else if (voice === "seco") {
      burst(at, "bandpass", 2100, 1.1, 0.085, v * 0.5); // chasquido
      burst(at, "highpass", 4200, 0.7, 0.13, v * 0.3);  // cuerdas de dentro
      tone(at, "triangle", 340, 340, 0.05, v * 0.28);   // cuerpo
    } else if (voice === "metro") {
      /* Un clic, no un golpe: corto, agudo y sin cuerpo, para que no se
         confunda con el cajón. */
      tone(at, "square", 1750, 1750, 0.028, v * 0.16);
      burst(at, "highpass", 5000, 0.7, 0.012, v * 0.12);
    } else {
      burst(at, "bandpass", 820, 0.9, 0.032, v * 0.42); // dedo apagado
      burst(at, "lowpass", 260, 0.7, 0.028, v * 0.2);
    }
  }

  return {
    ensure,
    hit,
    now: () => (ctx ? ctx.currentTime : 0),
    get ready() { return !!ctx; }
  };
}
