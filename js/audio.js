/* ===== Hemi's Graveyard — procedural audio engine (Web Audio, no files) ===== */
const SFX = (function () {
  let ctx = null, master, comp, sfxBus, musicBus, ambBus, revIn, noiseBuf, distCurve;
  let voiceOn = true, musicMode = 'off', musicTimer = null, nextBeat = 0, beatIdx = 0;
  let ambNodes = null, stepFlip = false, lastWhisper = 0, intensity = 0;
  const R = Math.random;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9;
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.25;
    master.connect(comp); comp.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.42; musicBus.connect(master);
    ambBus = ctx.createGain(); ambBus.gain.value = 0.5; ambBus.connect(master);
    // reverb impulse
    const len = ctx.sampleRate * 3.2, imp = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = imp.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (R() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    const conv = ctx.createConvolver(); conv.buffer = imp;
    revIn = ctx.createGain(); revIn.gain.value = 0.45;
    revIn.connect(conv); conv.connect(master);
    // noise buffer
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = R() * 2 - 1;
    // distortion curve
    distCurve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; distCurve[i] = Math.tanh(x * 4); }
    preloadClips();
  }

  /* ---------- pre-rendered voice clips (js/voices.js -> audio/voice/*.mp3) ---------- */
  const clipBuf = {}; let curSrc = null, curAud = null, voiceUntil = 0;
  function preloadClips() {
    if (!window.VOICE_CLIPS) return;
    Object.values(window.VOICE_CLIPS).forEach(c => {
      if (clipBuf[c.f]) return;
      try { fetch(c.f).then(r => r.arrayBuffer()).then(b => new Promise((ok, no) => ctx.decodeAudioData(b, ok, no))).then(buf => { clipBuf[c.f] = buf; }).catch(() => { }); } catch (e) { }
    });
  }
  function stopClip() { try { if (curSrc) curSrc.stop(); } catch (e) { } try { if (curAud) curAud.pause(); } catch (e) { } curSrc = null; curAud = null; voiceUntil = 0; }
  const VOICE_GAIN = { player: 1.0, rick: 1.2, boss: 1.35, divine: 1.25 };   // per-character loudness trim
  function playClip(file, dur, who) {
    stopClip();
    const buf = clipBuf[file], vg = VOICE_GAIN[who] || 1.1;
    if (buf) {
      const s = ctx.createBufferSource(); s.buffer = buf; const gn = ctx.createGain(); gn.gain.value = vg;
      s.connect(gn); gn.connect(master); s.start(); curSrc = s; voiceUntil = ctx.currentTime + buf.duration;
    } else { // e.g. page opened as a local file (fetch blocked): fall back to a normal audio element
      try { const a = new Audio(file); a.volume = Math.min(1, vg); a.play().catch(() => { }); curAud = a; voiceUntil = ctx.currentTime + (dur || 4); } catch (e) { }
    }
  }

  /* ---------- helpers ---------- */
  function g(vol, t0, a, d, dest, sustainEnd) {
    const n = ctx.createGain();
    n.gain.setValueAtTime(0.0001, t0);
    n.gain.exponentialRampToValueAtTime(Math.max(vol, 0.0002), t0 + a);
    n.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
    n.connect(dest);
    return n;
  }
  function send(node, amount) {
    const s = ctx.createGain(); s.gain.value = amount; node.connect(s); s.connect(revIn);
  }
  function noise(opt) {
    if (!ctx) return;
    const t = opt.t || ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = opt.type || 'bandpass'; f.Q.value = opt.q || 1;
    f.frequency.setValueAtTime(opt.f0, t);
    if (opt.f1) f.frequency.exponentialRampToValueAtTime(opt.f1, t + opt.dur);
    const o = g(opt.vol, t, opt.a || 0.005, opt.dur, opt.dest || sfxBus);
    src.connect(f); f.connect(o);
    if (opt.rev) send(o, opt.rev);
    src.start(t, R() * 1.5); src.stop(t + opt.dur + (opt.a || 0.005) + 0.05);
  }
  function tone(opt) {
    if (!ctx) return;
    const t = opt.t || ctx.currentTime;
    const osc = ctx.createOscillator(); osc.type = opt.type || 'sine';
    osc.frequency.setValueAtTime(opt.f0, t);
    if (opt.f1) osc.frequency.exponentialRampToValueAtTime(opt.f1, t + opt.dur);
    if (opt.detune) osc.detune.value = opt.detune;
    let node = osc;
    if (opt.vib) {
      const l = ctx.createOscillator(), lg = ctx.createGain();
      l.frequency.value = opt.vib[0]; lg.gain.value = opt.vib[1];
      l.connect(lg); lg.connect(osc.frequency); l.start(t); l.stop(t + opt.dur + 0.1);
    }
    if (opt.filter) {
      const f = ctx.createBiquadFilter(); f.type = opt.filter[0]; f.frequency.value = opt.filter[1]; f.Q.value = opt.filter[2] || 1;
      node.connect(f); node = f;
    }
    if (opt.dist) {
      const w = ctx.createWaveShaper(); w.curve = distCurve; node.connect(w); node = w;
    }
    const o = g(opt.vol, t, opt.a || 0.005, opt.dur, opt.dest || sfxBus);
    node.connect(o);
    if (opt.rev) send(o, opt.rev);
    osc.start(t); osc.stop(t + opt.dur + (opt.a || 0.005) + 0.05);
  }

  /* ---------- sound effects ---------- */
  const API = {
    init,
    get ready() { return !!ctx; },
    setVoice(v) { voiceOn = v; },

    shoot(level) { // assault-rifle style: sharp crack, punchy body, short tail (tight so full-auto stays clear)
      if (!ctx) return;
      const L = level || 1, t = ctx.currentTime, v = 0.9 + Math.random() * 0.2;
      noise({ t, type: 'highpass', f0: 2800, q: 0.6, dur: 0.045, vol: 0.5 * v });                                  // supersonic crack
      noise({ t, type: 'bandpass', f0: 1500, f1: 400, q: 0.8, dur: 0.11, vol: 0.55 * v, rev: 0.12 });             // muzzle blast
      tone({ t, type: 'sine', f0: 190 + L * 8, f1: 55, dur: 0.12, vol: 0.6 * v });                                // punch
      tone({ t, type: 'square', f0: 480, f1: 120, dur: 0.05, vol: 0.12, filter: ['lowpass', 1800, 1] });          // mechanical snap
      noise({ t: t + 0.06, type: 'lowpass', f0: 700, f1: 150, dur: 0.22, vol: 0.14, rev: 0.35 });                  // short echo tail
      noise({ t: t + 0.075, type: 'bandpass', f0: 3200, q: 6, dur: 0.02, vol: 0.07 });                             // bolt/brass tick
      if (L >= 3) tone({ t, type: 'sine', f0: 90, f1: 38, dur: 0.2, vol: 0.4 });                                   // heavier barrel
      if (L >= 5) { tone({ t, type: 'sawtooth', f0: 120, f1: 45, dur: 0.18, vol: 0.18, dist: true, filter: ['lowpass', 500, 1] }); noise({ t, type: 'lowpass', f0: 1200, f1: 100, dur: 0.2, vol: 0.25, rev: 0.25 }); }
    },
    /* ---- horror / jump-scare sounds ---- */
    jumpscare(kind) {
      if (!ctx) return;
      const t = ctx.currentTime;
      const k = kind == null ? Math.floor(R() * 3) : kind;
      // shared: sudden silence-breaking impact
      tone({ t, type: 'sine', f0: 70, f1: 22, dur: 1.2, vol: 1.0 });
      noise({ t, type: 'lowpass', f0: 1200, f1: 60, dur: 1.2, vol: 0.8, rev: 0.5 });
      if (k === 0) { // shrieking screech
        tone({ t, type: 'sawtooth', f0: 700, f1: 2600, dur: 0.9, vol: 0.38, vib: [26, 220], dist: true, filter: ['bandpass', 1800, 2], rev: 0.4 });
        tone({ t, type: 'square', f0: 1300, f1: 3100, dur: 0.9, vol: 0.2, vib: [31, 260], dist: true, rev: 0.4 });
        noise({ t, type: 'highpass', f0: 3000, dur: 0.9, vol: 0.35 });
      } else if (k === 1) { // low demon roar
        tone({ t, type: 'sawtooth', f0: 95, f1: 40, dur: 1.8, vol: 0.6, vib: [13, 10], dist: true, filter: ['lowpass', 600, 3], rev: 0.4 });
        tone({ t: t + 0.1, type: 'sawtooth', f0: 480, f1: 120, dur: 1.4, vol: 0.28, vib: [18, 90], dist: true, filter: ['bandpass', 900, 4], rev: 0.5 });
      } else { // chord of broken violins
        [880, 932, 1245, 1319].forEach((f, i) => tone({ t, type: 'sawtooth', f0: f, f1: f * 0.94, dur: 1.4, vol: 0.2, vib: [6 + i, 25], dist: true, filter: ['bandpass', 1500, 2], rev: 0.5 }));
        noise({ t, type: 'bandpass', f0: 5000, q: 2, dur: 0.5, vol: 0.3 });
      }
    },
    dollLaugh() { // creepy child giggle
      if (!ctx) return;
      const t = ctx.currentTime;
      for (let i = 0; i < 7; i++) {
        const tt = t + i * 0.17, f = 900 + R() * 300 - i * 25;
        tone({ t: tt, type: 'triangle', f0: f, f1: f * 1.35, dur: 0.11, vol: 0.16, vib: [40, 30], filter: ['bandpass', 1400, 3], rev: 0.7 });
      }
      tone({ t: t + 0.1, type: 'sine', f0: 62, f1: 55, dur: 1.3, vol: 0.2 });
    },
    musicBox() { // slow warped music box
      if (!ctx) return;
      const t = ctx.currentTime, notes = [659, 622, 659, 622, 659, 494, 587, 523, 440];
      notes.forEach((f, i) => tone({ t: t + i * 0.42, type: 'sine', f0: f, f1: f * (1 - i * 0.004), dur: 0.9, vol: 0.12, detune: -30 - i * 6, rev: 0.8 }));
    },
    creak() {
      if (!ctx) return;
      const t = ctx.currentTime, d = 1.2 + R() * 0.8;
      tone({ t, type: 'sawtooth', f0: 140 + R() * 60, f1: 330 + R() * 120, dur: d, vol: 0.09, vib: [22, 30], filter: ['bandpass', 700, 8], rev: 0.5 });
      noise({ t, type: 'bandpass', f0: 600, f1: 1400, q: 10, dur: d, vol: 0.05, rev: 0.4 });
    },
    chains() {
      if (!ctx) return;
      const t = ctx.currentTime;
      for (let i = 0; i < 9; i++) noise({ t: t + i * 0.09 + R() * 0.05, type: 'bandpass', f0: 3200 + R() * 2500, q: 14, dur: 0.07, vol: 0.12, rev: 0.5 });
    },
    scratch() {
      if (!ctx) return;
      const t = ctx.currentTime;
      for (let i = 0; i < 5; i++) noise({ t: t + i * 0.11, type: 'bandpass', f0: 2500, f1: 5200, q: 3, dur: 0.12, vol: 0.1, rev: 0.4 });
    },
    breathBehind() {
      if (!ctx) return;
      const t = ctx.currentTime;
      noise({ t, type: 'bandpass', f0: 900, f1: 500, q: 1.2, dur: 1.4, vol: 0.18, a: 0.5, rev: 0.6 });
      noise({ t: t + 1.7, type: 'bandpass', f0: 800, f1: 400, q: 1.2, dur: 1.6, vol: 0.2, a: 0.6, rev: 0.6 });
    },
    horrorAmbient() { // random unsettling sound
      const pick = ['creak', 'chains', 'scratch', 'breathBehind', 'dollLaugh', 'musicBox'];
      API[pick[Math.floor(R() * pick.length)]]();
    },

    ghostWail(pan) { // film-style ghost voice: eerie wail drifting through the sky
      if (!ctx) return;
      const t = ctx.currentTime, d = 2.6 + R() * 1.6, f = 260 + R() * 220;
      const pn = ctx.createStereoPanner ? ctx.createStereoPanner() : null; if (pn) { pn.pan.value = pan == null ? R() * 2 - 1 : pan; pn.connect(sfxBus); }
      const dest = pn || sfxBus;
      [0, 7, -9].forEach((dt, i) => tone({ t, type: 'sawtooth', f0: f, f1: f * (0.55 + R() * 0.2), dur: d, vol: 0.075, a: d * 0.35, detune: dt * 6, vib: [4 + i, 14 + i * 6], filter: ['bandpass', 650 + i * 250, 5], dest, rev: 0.9 }));
      tone({ t: t + 0.2, type: 'sine', f0: f * 2.02, f1: f * 1.1, dur: d * 0.8, vol: 0.04, a: d * 0.3, vib: [6, 20], dest, rev: 0.9 });
      noise({ t, type: 'bandpass', f0: 1200, f1: 500, q: 6, dur: d, vol: 0.06, a: d * 0.4, dest, rev: 0.8 });
    },
    ghostLaugh() { // low echoing "hahaha"
      if (!ctx) return;
      const t = ctx.currentTime;
      for (let i = 0; i < 5; i++) tone({ t: t + i * 0.32, type: 'sawtooth', f0: 210 - i * 14, f1: 120 - i * 8, dur: 0.28, vol: 0.12, vib: [18, 20], dist: true, filter: ['bandpass', 700, 3], rev: 0.8 });
    },
    zombieGroan() {
      if (!ctx) return;
      const t = ctx.currentTime;
      tone({ t, type: 'sawtooth', f0: 120, f1: 55, dur: 1.5, vol: 0.28, vib: [9, 12], dist: true, filter: ['bandpass', 420, 4], rev: 0.5 });
      noise({ t, type: 'lowpass', f0: 500, f1: 150, dur: 1.2, vol: 0.2, rev: 0.4 });
    },
    zombieRise() { // bones cracking + earth
      if (!ctx) return;
      const t = ctx.currentTime;
      for (let i = 0; i < 6; i++) noise({ t: t + i * 0.16 + R() * 0.06, type: 'bandpass', f0: 1800 + R() * 1600, q: 8, dur: 0.05, vol: 0.2 });
      noise({ t, type: 'lowpass', f0: 300, f1: 80, dur: 1.2, vol: 0.3 });
    },
    setIntensity(i) { intensity = i; },
    empty() { tone({ type: 'square', f0: 220, f1: 180, dur: 0.05, vol: 0.12 }); },
    reload() {
      if (!ctx) return;
      const t = ctx.currentTime;
      noise({ t, type: 'bandpass', f0: 1200, q: 4, dur: 0.06, vol: 0.2 });
      tone({ t: t + 0.55, type: 'square', f0: 300, f1: 200, dur: 0.07, vol: 0.12 });
      noise({ t: t + 0.55, type: 'bandpass', f0: 2200, q: 5, dur: 0.06, vol: 0.2 });
    },
    hit(head) { // laser-gun impact: bright "pew" zap + sizzle
      if (!ctx) return;
      const t = ctx.currentTime;
      tone({ t, type: 'sawtooth', f0: head ? 2600 : 1700, f1: head ? 500 : 320, dur: 0.12, vol: head ? 0.24 : 0.17, filter: ['bandpass', head ? 2200 : 1400, 4] });
      tone({ t, type: 'square', f0: head ? 3400 : 2200, f1: 700, dur: 0.07, vol: 0.09 });
      tone({ t: t + 0.03, type: 'sine', f0: head ? 1200 : 800, f1: 200, dur: 0.14, vol: 0.12, vib: [60, 90] });
      noise({ t, type: 'highpass', f0: 5000, dur: 0.06, vol: head ? 0.16 : 0.09 });
    },
    ghostDie(big) {
      if (!ctx) return;
      const s = big ? 0.6 : 1;
      tone({ type: 'sawtooth', f0: 900 * s, f1: 110 * s, dur: big ? 1.6 : 0.9, vol: 0.18, vib: [9, 30], filter: ['lowpass', 1800, 2], rev: 0.5 });
      noise({ type: 'bandpass', f0: 3000, f1: 300, q: 2, dur: 0.7, vol: 0.18, rev: 0.4 });
    },
    hurt() {
      if (!ctx) return;
      tone({ type: 'sine', f0: 130, f1: 45, dur: 0.3, vol: 0.55 });
      noise({ type: 'lowpass', f0: 900, f1: 120, dur: 0.3, vol: 0.4 });
    },
    step(sprint) {
      if (!ctx) return;
      stepFlip = !stepFlip;
      noise({ type: 'lowpass', f0: 380 + R() * 200 + (stepFlip ? 60 : 0), q: 0.7, dur: 0.1, vol: sprint ? 0.36 : 0.26 });
      noise({ type: 'bandpass', f0: 2400 + R() * 800, q: 2, dur: 0.05, vol: 0.05 });
    },
    graveOpen() {
      if (!ctx) return;
      const t = ctx.currentTime;
      noise({ t, type: 'lowpass', f0: 250, f1: 1100, q: 3, dur: 2.4, vol: 0.5, a: 0.2, rev: 0.3 });
      tone({ t, type: 'sine', f0: 62, f1: 38, dur: 2.2, vol: 0.55, a: 0.05 });
      tone({ t: t + 0.2, type: 'sawtooth', f0: 190, f1: 110, dur: 1.8, vol: 0.1, vib: [6, 8], filter: ['bandpass', 400, 6], rev: 0.4 });
      tone({ t: t + 2.0, type: 'sine', f0: 45, f1: 30, dur: 0.8, vol: 0.7 });
    },
    thunder() {
      if (!ctx) return;
      const t = ctx.currentTime;
      noise({ t, type: 'highpass', f0: 2500, q: 0.5, dur: 0.15, vol: 0.4 });
      noise({ t: t + 0.1, type: 'lowpass', f0: 500, f1: 60, q: 0.7, dur: 3.2, vol: 0.9, a: 0.25, rev: 0.4 });
    },
    rickScream(power) {
      if (!ctx) return;
      const p = power || 1, t = ctx.currentTime, d = 1.3 + p * 0.2;
      tone({ t, type: 'sawtooth', f0: 320, f1: 880, dur: d * 0.4, vol: 0.2, vib: [7, 35], filter: ['bandpass', 900, 3], dist: true, rev: 0.5 });
      tone({ t: t + d * 0.4, type: 'sawtooth', f0: 880, f1: 240, dur: d * 0.6, vol: 0.2, vib: [8, 45], filter: ['bandpass', 1100, 3], dist: true, rev: 0.5 });
      tone({ t, type: 'sawtooth', f0: 335, f1: 910, dur: d * 0.4, vol: 0.12, detune: 40, vib: [6, 30], dist: true, rev: 0.5 });
      noise({ t, type: 'bandpass', f0: 1800, f1: 700, q: 1.5, dur: d, vol: 0.18, rev: 0.4 });
    },
    koalaScream() {
      if (!ctx) return;
      const t = ctx.currentTime;
      tone({ t, type: 'square', f0: 900, f1: 2100, dur: 0.5, vol: 0.12, vib: [16, 120], filter: ['bandpass', 1800, 2], dist: true, rev: 0.45 });
      tone({ t: t + 0.5, type: 'square', f0: 2100, f1: 700, dur: 0.6, vol: 0.12, vib: [20, 160], filter: ['bandpass', 1500, 2], dist: true, rev: 0.45 });
      tone({ t, type: 'sawtooth', f0: 180, f1: 90, dur: 1.1, vol: 0.14, vib: [30, 20], dist: true });
      noise({ t, type: 'highpass', f0: 3500, q: 1, dur: 1.0, vol: 0.14, rev: 0.4 });
    },
    bossRoar() {
      if (!ctx) return;
      const t = ctx.currentTime;
      tone({ t, type: 'sawtooth', f0: 75, f1: 38, dur: 3.2, vol: 0.5, vib: [11, 6], dist: true, filter: ['lowpass', 500, 2], rev: 0.5 });
      tone({ t, type: 'sawtooth', f0: 150, f1: 80, dur: 3.0, vol: 0.28, vib: [14, 12], dist: true, rev: 0.5 });
      tone({ t: t + 0.3, type: 'sawtooth', f0: 500, f1: 1700, dur: 1.2, vol: 0.16, vib: [9, 80], filter: ['bandpass', 1200, 3], dist: true, rev: 0.6 });
      tone({ t: t + 1.5, type: 'square', f0: 1900, f1: 600, dur: 1.4, vol: 0.12, vib: [18, 140], filter: ['bandpass', 1600, 2], dist: true, rev: 0.6 });
      tone({ t, type: 'sine', f0: 48, f1: 24, dur: 2.5, vol: 0.9 });
      noise({ t, type: 'lowpass', f0: 800, f1: 90, q: 1, dur: 3.0, vol: 0.5, rev: 0.5 });
    },
    bossStomp() {
      if (!ctx) return;
      tone({ type: 'sine', f0: 70, f1: 28, dur: 0.5, vol: 0.9 });
      noise({ type: 'lowpass', f0: 600, f1: 80, dur: 0.5, vol: 0.55 });
    },
    spawn() {
      if (!ctx) return;
      noise({ type: 'bandpass', f0: 300, f1: 2400, q: 6, dur: 0.9, vol: 0.14, a: 0.3, rev: 0.6 });
      tone({ type: 'sine', f0: 200, f1: 520, dur: 0.8, vol: 0.08, vib: [6, 20], rev: 0.6 });
    },
    orb() {
      if (!ctx) return;
      tone({ type: 'sine', f0: 260, f1: 760, dur: 0.35, vol: 0.18, vib: [12, 30], rev: 0.3 });
      noise({ type: 'bandpass', f0: 900, f1: 300, q: 3, dur: 0.3, vol: 0.12 });
    },
    upgrade() {
      if (!ctx) return;
      const t = ctx.currentTime, notes = [392, 523, 659, 784, 1046];
      notes.forEach((f, i) => {
        tone({ t: t + i * 0.09, type: 'sine', f0: f, dur: 1.0, vol: 0.2, rev: 0.5 });
        tone({ t: t + i * 0.09, type: 'triangle', f0: f * 2, dur: 0.6, vol: 0.06, rev: 0.5 });
      });
      noise({ t, type: 'bandpass', f0: 800, f1: 5000, q: 2, dur: 0.6, vol: 0.12 });
    },
    roundClear() {
      if (!ctx) return;
      const t = ctx.currentTime;
      [220, 277, 330, 440].forEach((f, i) => tone({ t: t + i * 0.18, type: 'sine', f0: f, dur: 1.6, vol: 0.18, rev: 0.6 }));
    },
    pickup() {
      if (!ctx) return;
      const t = ctx.currentTime;
      for (let i = 0; i < 10; i++) tone({ t: t + i * 0.06, type: 'sine', f0: 880 * Math.pow(1.122, i), dur: 0.7, vol: 0.14, rev: 0.5 });
    },
    win() {
      if (!ctx) return;
      const t = ctx.currentTime, ch = [[523, 659, 784], [587, 740, 880], [659, 830, 988], [784, 988, 1175]];
      ch.forEach((c, i) => c.forEach(f => tone({ t: t + i * 0.4, type: 'triangle', f0: f, dur: 1.5, vol: 0.12, rev: 0.5 })));
      tone({ t, type: 'sine', f0: 130, dur: 3, vol: 0.25, a: 0.1 });
    },
    lose() {
      if (!ctx) return;
      const t = ctx.currentTime;
      tone({ t, type: 'sawtooth', f0: 220, f1: 55, dur: 3.5, vol: 0.3, filter: ['lowpass', 600, 2], vib: [5, 10], rev: 0.6 });
      tone({ t, type: 'sawtooth', f0: 233, f1: 58, dur: 3.5, vol: 0.2, filter: ['lowpass', 600, 2], rev: 0.6 });
      tone({ t: t + 0.2, type: 'sine', f0: 50, f1: 25, dur: 3, vol: 0.7 });
    },
    heartbeat() {
      if (!ctx) return;
      const t = ctx.currentTime;
      tone({ t, type: 'sine', f0: 70, f1: 40, dur: 0.18, vol: 0.5 });
      tone({ t: t + 0.22, type: 'sine', f0: 62, f1: 38, dur: 0.2, vol: 0.4 });
    },
    bird() {
      if (!ctx) return;
      const t = ctx.currentTime, b = 2200 + R() * 1500;
      for (let i = 0; i < 3 + (R() * 3 | 0); i++)
        tone({ t: t + i * 0.12, type: 'sine', f0: b, f1: b * (1.3 + R() * 0.4), dur: 0.09, vol: 0.05, dest: ambBus, rev: 0.1 });
    },
    owl() {
      if (!ctx) return;
      const t = ctx.currentTime;
      tone({ t, type: 'sine', f0: 330, f1: 290, dur: 0.5, vol: 0.12, dest: ambBus, rev: 0.5 });
      tone({ t: t + 0.7, type: 'sine', f0: 300, f1: 240, dur: 0.8, vol: 0.12, dest: ambBus, rev: 0.5 });
    },
    creak() {
      if (!ctx) return;
      const t = ctx.currentTime;
      tone({ t, type: 'sawtooth', f0: 160, f1: 260, dur: 1.4, vol: 0.08, vib: [14, 30], filter: ['bandpass', 700, 8], rev: 0.4 });
    },
    gateOpen() {
      if (!ctx) return;
      const t = ctx.currentTime;
      tone({ t, type: 'sawtooth', f0: 120, f1: 340, dur: 3.0, vol: 0.18, vib: [9, 40], filter: ['bandpass', 800, 10], rev: 0.5 });
      tone({ t: t + 0.4, type: 'sawtooth', f0: 150, f1: 300, dur: 2.6, vol: 0.12, vib: [11, 30], filter: ['bandpass', 1100, 10], rev: 0.5 });
      noise({ t, type: 'lowpass', f0: 300, f1: 700, dur: 3.0, vol: 0.2, a: 0.3 });
      tone({ t: 3.0 + t, type: 'sine', f0: 60, f1: 35, dur: 0.6, vol: 0.6 });
    },
    click() { tone({ type: 'sine', f0: 600, f1: 300, dur: 0.06, vol: 0.12 }); },

    /* ---- spoken / whispered ghost voice ---- */
    say(text, dur) {
      if (!ctx) return;
      const vc = window.VOICE_CLIPS && window.VOICE_CLIPS[text];   // Rickoala (boss): natural pre-rendered clip
      if (vc) { if (voiceOn) { try { speechSynthesis.cancel(); } catch (e) { } playClip(vc.f, vc.d, vc.who); } return; }
      const t0 = ctx.currentTime, syl = Math.max(4, Math.round(text.length / 2.6));
      const total = dur || Math.min(6, syl * 0.14);
      for (let i = 0; i < syl; i++) {
        const t = t0 + (i / syl) * total, f = 500 + R() * 1800;
        noise({ t, type: 'bandpass', f0: f, f1: f * (0.6 + R() * 0.8), q: 5 + R() * 6, dur: 0.13, vol: 0.13, rev: 0.7 });
      }
      tone({ t: t0, type: 'sawtooth', f0: 85, f1: 70, dur: total, vol: 0.05, filter: ['lowpass', 260, 1], vib: [5, 4], rev: 0.5 });
      if (voiceOn && 'speechSynthesis' in window) {
        try {
          const u = new SpeechSynthesisUtterance(text);
          u.pitch = 0.1; u.rate = 0.62; u.volume = 0.8;
          const vs = speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang));
          const pick = vs.find(v => /male|daniel|david|alex|google uk english male/i.test(v.name)) || vs[0];
          if (pick) u.voice = pick;
          speechSynthesis.cancel(); speechSynthesis.speak(u);
        } catch (e) { /* speech not available */ }
      }
    },

    /* ---- ambience & music ---- */
    ambience(mode) {
      if (!ctx) return;
      if (ambNodes) { try { ambNodes.src.stop(); ambNodes.lfo.stop(); } catch (e) { } ambNodes = null; }
      const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.9; f.frequency.value = mode === 'day' ? 700 : 380;
      const gn = ctx.createGain(); gn.gain.value = mode === 'day' ? 0.05 : 0.26;
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = 0.11; lg.gain.value = mode === 'day' ? 150 : 220;
      lfo.connect(lg); lg.connect(f.frequency);
      src.connect(f); f.connect(gn); gn.connect(ambBus);
      src.start(); lfo.start();
      ambNodes = { src, lfo };
    },
    music(mode) {
      if (!ctx) return;
      musicMode = mode;
      if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
      if (mode === 'off') return;
      nextBeat = ctx.currentTime + 0.1; beatIdx = 0;
      musicTimer = setInterval(scheduleMusic, 200);
    },
    setMusicVolume(v) { if (musicBus) musicBus.gain.value = v; },
    lowpassMusic(on) { /* reserved */ }
  };

  /* dark generative music: A phrygian, music-box over a droning pad */
  const DARK = [110, 116.54, 130.81, 146.83, 164.81, 174.61, 196];
  const MOTIF = [0, 2, 1, 0, 4, 2, 1, 0, 3, 2, 1, 2, 0, 5, 4, 1];
  const DAYSC = [261.63, 293.66, 329.63, 392, 440, 523.25];
  function box(f, t, vol, dest) {
    tone({ t, type: 'sine', f0: f, dur: 1.8, vol: vol, dest: dest || musicBus, rev: 0.7, detune: (R() - 0.5) * 14 });
    tone({ t, type: 'triangle', f0: f * 3.01, dur: 0.5, vol: vol * 0.25, dest: dest || musicBus, rev: 0.6 });
  }
  function pad(f, t, dur, vol) {
    [-9, 9].forEach(dt => tone({ t, type: 'sawtooth', f0: f, dur: dur, vol: vol, a: dur * 0.4, detune: dt, filter: ['lowpass', 320, 1], dest: musicBus, rev: 0.4 }));
  }
  function scheduleMusic() {
    if (!ctx) return;
    const beat = musicMode === 'day' ? 0.55 : Math.max(0.62, 0.95 - intensity * 0.07);
    while (nextBeat < ctx.currentTime + 1.2) {
      const t = nextBeat;
      if (musicMode === 'dark') { // horror: drones, tritones, heartbeat, groans, scrapes  (gets nastier with each grave)
        const lv = intensity;
        if (beatIdx % 12 === 0) { // detuned sub-drone + tritone
          const root = [41.2, 38.9, 36.7, 43.65, 34.65][lv % 5];
          [-14, 14].forEach(dt => tone({ t, type: 'sawtooth', f0: root, dur: beat * 13, vol: 0.2, a: beat * 4, detune: dt, filter: ['lowpass', 180 + lv * 40, 2], dest: musicBus }));
          tone({ t, type: 'sawtooth', f0: root * 1.4142, dur: beat * 12, vol: 0.07 + lv * 0.015, a: beat * 5, filter: ['lowpass', 420, 3], dest: musicBus, rev: 0.6, vib: [0.3, 2] });
          tone({ t, type: 'sine', f0: root / 2, dur: beat * 13, vol: 0.4, a: beat * 2, dest: musicBus });
        }
        if (beatIdx % 2 === 0) { // heartbeat (faster + louder with each grave)
          tone({ t, type: 'sine', f0: 62, f1: 36, dur: 0.22, vol: 0.5 + lv * 0.06, dest: musicBus });
          tone({ t: t + 0.24, type: 'sine', f0: 56, f1: 32, dur: 0.2, vol: 0.34 + lv * 0.05, dest: musicBus });
        }
        if (beatIdx % 9 === 4 && R() < 0.8) { // low choir groan sliding down
          const f = [98, 104, 87.3][(R() * 3) | 0];
          tone({ t, type: 'sawtooth', f0: f * 1.5, f1: f * 0.9, dur: beat * 4, vol: 0.13, a: beat * 1.5, vib: [4.5, 6], filter: ['bandpass', 380, 4], dest: musicBus, rev: 0.8 });
          tone({ t, type: 'sawtooth', f0: f * 1.5 * 1.06, f1: f * 0.9 * 1.06, dur: beat * 4, vol: 0.1, a: beat * 1.5, vib: [5, 7], filter: ['bandpass', 400, 4], dest: musicBus, rev: 0.8 });
        }
        if (beatIdx % 7 === 3 && R() < 0.7) { // metallic scrape / bowed metal
          noise({ t, type: 'bandpass', f0: 1800 + R() * 1500, f1: 700 + R() * 600, q: 18, dur: beat * 3, vol: 0.12, a: beat, dest: musicBus, rev: 0.7 });
          tone({ t, type: 'triangle', f0: 1244 + R() * 40, f1: 1180, dur: beat * 2.5, vol: 0.04, vib: [6, 20], dest: musicBus, rev: 0.8 });
        }
        if (beatIdx % 17 === 9) { // rising dread swell then hit
          noise({ t, type: 'bandpass', f0: 200, f1: 3000, q: 1.5, dur: beat * 3, vol: 0.2, a: beat * 2.6, dest: musicBus, rev: 0.5 });
          tone({ t: t + beat * 3, type: 'sine', f0: 55, f1: 20, dur: 1.4, vol: 0.7, dest: musicBus });
        }
        if (lv >= 2 && beatIdx % 4 === 0) tone({ t, type: 'sawtooth', f0: 55, f1: 45, dur: 0.3, vol: 0.2, dist: true, filter: ['lowpass', 260, 2], dest: musicBus }); // war-drum pulse
        if (lv >= 3 && R() < 0.35) tone({ t, type: 'square', f0: 1480 + R() * 700, f1: 1100, dur: 0.5, vol: 0.025, vib: [30, 100], dest: musicBus, rev: 0.8 }); // ghostly shrieks
        if (R() < 0.12) tone({ t, type: 'sine', f0: 330 + R() * 20, f1: 311, dur: beat * 3, vol: 0.05, a: beat, vib: [5, 4], dest: musicBus, rev: 0.9 }); // lonely high note
      } else {
        const n = DAYSC[(beatIdx * 3 + (beatIdx >> 2)) % DAYSC.length];
        if (R() < 0.8) box(n, t, 0.2);
        if (beatIdx % 8 === 0) { pad(130.81, t, beat * 8, 0.1); pad(196, t, beat * 8, 0.07); }
      }
      nextBeat += beat; beatIdx++;
    }
  }
  return API;
})();

