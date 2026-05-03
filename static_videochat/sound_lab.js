(() => {
  const $ = (id) => document.getElementById(id);
  const ui = {
    audioPower: $("audio-power"),
    stopAll: $("stop-all"),
    audioState: $("audio-state"),
    activeState: $("active-state"),
    meter: $("meter"),
    fireworkStage: $("firework-stage"),
    fireworkTimeline: $("firework-timeline"),
    log: $("log"),
    masterVolume: $("master-volume"),
    masterVolumeValue: $("master-volume-value"),
    distance: $("distance"),
    distanceValue: $("distance-value"),
    pan: $("pan"),
    panValue: $("pan-value"),
    fireToggle: $("fire-toggle"),
    fireSoft: $("fire-soft"),
    fireBright: $("fire-bright"),
    fireBed: $("fire-bed"),
    fireBedValue: $("fire-bed-value"),
    fireCrackle: $("fire-crackle"),
    fireCrackleValue: $("fire-crackle-value"),
    fireRate: $("fire-rate"),
    fireRateValue: $("fire-rate-value"),
    fireStrongCrackle: $("fire-strong-crackle"),
    fireStrongCrackleValue: $("fire-strong-crackle-value"),
    fireStrongCracklePower: $("fire-strong-crackle-power"),
    fireStrongCracklePowerValue: $("fire-strong-crackle-power-value"),
    fireStrongCrackleTest: $("fire-strong-crackle-test"),
    ambientVolume: $("ambient-volume"),
    ambientVolumeValue: $("ambient-volume-value"),
    presetReadout: $("preset-readout"),
    fileInput: $("file-input"),
    filePlay: $("file-play"),
    fileStop: $("file-stop"),
    fileLoop: $("file-loop"),
    entrySoundStyle: $("entry-sound-style"),
    entrySoundPlay: $("entry-sound-play"),
    exitSoundStyle: $("exit-sound-style"),
    exitSoundPlay: $("exit-sound-play"),
    characterFxStage: $("character-fx-stage"),
    characterFxSize: $("character-fx-size"),
    characterFxSizeValue: $("character-fx-size-value"),
    babbleText: $("babble-text"),
    babbleSpeed: $("babble-speed"),
    babbleSpeedValue: $("babble-speed-value"),
    babbleVoice: $("babble-voice"),
    babbleSeed: $("babble-seed"),
    babblePlay: $("babble-play"),
    babbleRandom: $("babble-random"),
    babbleDisplay: $("babble-display"),
  };

  const state = {
    ctx: null,
    master: null,
    distanceGain: null,
    panner: null,
    analyser: null,
    fire: null,
    loops: new Map(),
    crackleTimer: 0,
    strongCrackleTimer: 0,
    fireFlutterTimer: 0,
    fileBuffer: null,
    fileSource: null,
    meterRaf: 0,
    fireworkRaf: 0,
    characterFxRaf: 0,
    babbleTimers: [],
    logLines: [],
  };
  const BABBLE_OUTPUT_GAIN = 10;

  function log(message) {
    const time = new Date().toLocaleTimeString("ko-KR", { hour12: false });
    state.logLines.push(`[${time}] ${message}`);
    state.logLines = state.logLines.slice(-80);
    ui.log.textContent = state.logLines.join("\n");
    ui.log.scrollTop = ui.log.scrollHeight;
  }

  function pct(value) {
    return `${Math.round(Number(value || 0) * 100)}%`;
  }

  function updateReadouts() {
    ui.masterVolumeValue.textContent = pct(ui.masterVolume.value);
    ui.distanceValue.textContent = pct(ui.distance.value);
    ui.panValue.textContent = Number(ui.pan.value).toFixed(2);
    ui.fireBedValue.textContent = pct(ui.fireBed.value);
    ui.fireCrackleValue.textContent = pct(ui.fireCrackle.value);
    ui.fireRateValue.textContent = pct(ui.fireRate.value);
    ui.fireStrongCrackleValue.textContent = `<=${Math.round(Number(ui.fireStrongCrackle.value || 0))}s`;
    if (ui.fireStrongCracklePowerValue) ui.fireStrongCracklePowerValue.textContent = pct(ui.fireStrongCracklePower?.value || 0);
    ui.ambientVolumeValue.textContent = pct(ui.ambientVolume.value);
    if (ui.babbleSpeedValue) ui.babbleSpeedValue.textContent = `${Number(ui.babbleSpeed?.value || 1).toFixed(2)}x`;
    if (ui.characterFxSizeValue) ui.characterFxSizeValue.textContent = `${Number(ui.characterFxSize?.value || 1).toFixed(2)}x`;
  }

  function makeNoiseBuffer(ctx, seconds = 1, color = "white") {
    const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      if (color === "brown") {
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.5;
      } else if (color === "pink") {
        last = 0.97 * last + 0.03 * white;
        data[i] = last * 1.8;
      } else {
        data[i] = white;
      }
    }
    return buffer;
  }

  function random(min, max) {
    return min + Math.random() * (max - min);
  }

  function hashString(value) {
    let h = 2166136261;
    const text = String(value || "");
    for (let i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function seededRand(seed) {
    let x = (seed >>> 0) || 0x9e3779b9;
    return () => {
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      return ((x >>> 0) / 4294967296);
    };
  }

  function nowPlus(startAt = 0) {
    return state.ctx.currentTime + startAt;
  }

  function safeExpRamp(param, value, time) {
    param.exponentialRampToValueAtTime(Math.max(0.0001, value), time);
  }

  function makePanNode(ctx, pan = 0, target = destination()) {
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (!panner) return { input: target, output: target };
    panner.pan.value = pan;
    panner.connect(target);
    return { input: panner, output: panner };
  }

  function noiseBurst({
    duration = 0.08,
    color = "white",
    filterType = "bandpass",
    frequency = 1800,
    q = 1,
    gainValue = 0.08,
    attack = 0.004,
    startAt = 0,
    pan = 0,
    target = destination(),
  } = {}) {
    if (!state.ctx) return;
    const ctx = state.ctx;
    const src = sourceFromNoise(ctx, Math.max(0.04, duration + 0.04), color);
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    const panNode = makePanNode(ctx, pan, target);
    const t = nowPlus(startAt);
    filter.type = filterType;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    gain.gain.setValueAtTime(0.0001, t);
    safeExpRamp(gain.gain, gainValue, t + attack);
    safeExpRamp(gain.gain, 0.0001, t + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(panNode.input);
    src.start(t);
    src.stop(t + duration + 0.08);
  }

  function noiseSweep({
    duration = 0.7,
    color = "white",
    filterType = "bandpass",
    from = 600,
    to = 3200,
    q = 4,
    gainValue = 0.035,
    attack = 0.035,
    startAt = 0,
    pan = 0,
    target = destination(),
  } = {}) {
    if (!state.ctx) return;
    const ctx = state.ctx;
    const src = sourceFromNoise(ctx, Math.max(0.08, duration + 0.08), color);
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    const panNode = makePanNode(ctx, pan, target);
    const t = nowPlus(startAt);
    filter.type = filterType;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(Math.max(20, from), t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + duration);
    gain.gain.setValueAtTime(0.0001, t);
    safeExpRamp(gain.gain, gainValue, t + attack);
    gain.gain.setTargetAtTime(0.0001, t + duration * 0.72, duration * 0.18);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(panNode.input);
    src.start(t);
    src.stop(t + duration + 0.12);
  }

  async function ensureAudio() {
    if (!state.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      state.ctx = new AudioContext();
      state.master = state.ctx.createGain();
      state.distanceGain = state.ctx.createGain();
      state.panner = state.ctx.createStereoPanner();
      state.analyser = state.ctx.createAnalyser();
      state.analyser.fftSize = 1024;
      state.master.connect(state.distanceGain);
      state.distanceGain.connect(state.panner);
      state.panner.connect(state.analyser);
      state.analyser.connect(state.ctx.destination);
      applyGlobalControls();
      drawMeter();
      log("audio graph ready");
    }
    if (state.ctx.state !== "running") {
      await state.ctx.resume();
    }
    ui.audioState.textContent = state.ctx.state;
    ui.audioPower.classList.toggle("active", state.ctx.state === "running");
    return state.ctx;
  }

  function applyGlobalControls() {
    if (!state.ctx) return;
    const now = state.ctx.currentTime;
    const master = Number(ui.masterVolume.value);
    const distance = Number(ui.distance.value);
    const pan = Number(ui.pan.value);
    state.master.gain.setTargetAtTime(master, now, 0.02);
    state.distanceGain.gain.setTargetAtTime(1 - distance * 0.82, now, 0.04);
    state.panner.pan.setTargetAtTime(pan, now, 0.04);
  }

  function destination() {
    return state.master;
  }

  function sourceFromNoise(ctx, seconds, color) {
    const src = ctx.createBufferSource();
    src.buffer = makeNoiseBuffer(ctx, seconds, color);
    return src;
  }

  function startFire() {
    if (!state.ctx || state.fire) return;
    const ctx = state.ctx;
    const out = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -28;
    comp.knee.value = 18;
    comp.ratio.value = 3;
    comp.attack.value = 0.006;
    comp.release.value = 0.22;
    out.connect(comp);
    comp.connect(destination());

    const layers = [];
    const addLayer = ({ name, color, seconds, filters, base, pan = 0 }) => {
      const src = sourceFromNoise(ctx, seconds, color);
      src.loop = true;
      const gain = ctx.createGain();
      const panNode = makePanNode(ctx, pan, out);
      let node = src;
      const builtFilters = [];
      for (const spec of filters) {
        const filter = ctx.createBiquadFilter();
        filter.type = spec.type;
        filter.frequency.value = spec.frequency;
        filter.Q.value = spec.q ?? 0.7;
        node.connect(filter);
        node = filter;
        builtFilters.push(filter);
      }
      node.connect(gain);
      gain.connect(panNode.input);
      src.start();
      layers.push({ name, src, gain, filters: builtFilters, base, panNode });
    };

    addLayer({
      name: "ember",
      color: "brown",
      seconds: 5.6,
      filters: [{ type: "lowpass", frequency: 260, q: 0.45 }],
      base: 0.18,
      pan: -0.08,
    });
    addLayer({
      name: "body",
      color: "pink",
      seconds: 4.8,
      filters: [
        { type: "highpass", frequency: 90, q: 0.35 },
        { type: "lowpass", frequency: 780, q: 0.42 },
      ],
      base: 0.16,
      pan: 0.05,
    });
    addLayer({
      name: "flame",
      color: "pink",
      seconds: 3.7,
      filters: [{ type: "bandpass", frequency: 1150, q: 0.65 }],
      base: 0.085,
      pan: 0.12,
    });
    addLayer({
      name: "hiss",
      color: "white",
      seconds: 2.9,
      filters: [
        { type: "highpass", frequency: 1650, q: 0.35 },
        { type: "lowpass", frequency: 7200, q: 0.4 },
      ],
      base: 0.035,
      pan: -0.16,
    });

    state.fire = { out, comp, layers };
    applyFireTargets(true);
    startFireFlutter();
    ui.fireToggle.classList.add("active");
    ui.activeState.textContent = "campfire";
    scheduleCrackle();
    scheduleStrongCrackle();
    log("campfire loop on");
  }

  function stopFire() {
    if (!state.fire) return;
    for (const layer of state.fire.layers || []) {
      try {
        layer.src.stop();
      } catch (_) {}
    }
    state.fire = null;
    window.clearTimeout(state.crackleTimer);
    window.clearTimeout(state.strongCrackleTimer);
    window.clearInterval(state.fireFlutterTimer);
    state.crackleTimer = 0;
    state.strongCrackleTimer = 0;
    state.fireFlutterTimer = 0;
    ui.fireToggle.classList.remove("active");
    ui.activeState.textContent = state.loops.size ? "ambient" : "idle";
    log("campfire loop off");
  }

  function applyFireTargets(immediate = false) {
    if (!state.ctx || !state.fire) return;
    const bed = Number(ui.fireBed.value);
    const crackle = Number(ui.fireCrackle.value);
    const now = state.ctx.currentTime;
    const ramp = immediate ? 0.005 : 0.08;
    for (const layer of state.fire.layers || []) {
      let value = bed * layer.base;
      if (layer.name === "hiss") value *= 0.45 + crackle * 0.95;
      if (layer.name === "flame") value *= 0.75 + crackle * 0.45;
      layer.gain.gain.setTargetAtTime(value, now, ramp);
      if (layer.name === "flame") {
        layer.filters[0].frequency.setTargetAtTime(840 + crackle * 760, now, 0.12);
        layer.filters[0].Q.setTargetAtTime(0.45 + crackle * 0.35, now, 0.12);
      }
      if (layer.name === "hiss") {
        layer.filters[0].frequency.setTargetAtTime(1800 + crackle * 1200, now, 0.16);
      }
    }
  }

  function startFireFlutter() {
    window.clearInterval(state.fireFlutterTimer);
    state.fireFlutterTimer = window.setInterval(() => {
      if (!state.ctx || !state.fire) return;
      const bed = Number(ui.fireBed.value);
      const crackle = Number(ui.fireCrackle.value);
      const t = state.ctx.currentTime;
      for (const layer of state.fire.layers || []) {
        const flutter = layer.name === "ember" ? random(0.72, 1.15) : random(0.62, 1.34);
        let value = bed * layer.base * flutter;
        if (layer.name === "hiss") value *= 0.45 + crackle * 0.95;
        if (layer.name === "flame") value *= 0.75 + crackle * 0.45;
        layer.gain.gain.setTargetAtTime(value, t, random(0.08, 0.24));
      }
      const flame = state.fire.layers.find((layer) => layer.name === "flame");
      if (flame) {
        flame.filters[0].frequency.setTargetAtTime(random(780, 1260) + crackle * 620, t, 0.18);
      }
    }, 160);
  }

  function updateFire() {
    if (!state.ctx || !state.fire) return;
    applyFireTargets();
  }

  function playCrackle(strength = Number(ui.fireCrackle.value)) {
    if (!state.ctx) return;
    const ctx = state.ctx;
    const bigPop = Math.random() < 0.04 + strength * 0.09;
    const pan = random(-0.48, 0.48);
    if (bigPop) {
      noiseBurst({
        duration: random(0.045, 0.085),
        color: "white",
        filterType: "bandpass",
        frequency: random(1150, 2600),
        q: random(0.9, 2.2),
        gainValue: 0.055 + strength * random(0.045, 0.105),
        attack: 0.0015,
        pan,
      });
      noiseBurst({
        duration: random(0.08, 0.14),
        color: "brown",
        filterType: "lowpass",
        frequency: random(280, 560),
        q: 0.45,
        gainValue: 0.02 + strength * 0.042,
        attack: 0.004,
        pan: pan * 0.7,
      });
      tone(random(98, 148), random(0.06, 0.12), "triangle", 0.012 + strength * 0.018, 0, destination());
      return;
    }

    const count = Math.random() < 0.36 + strength * 0.2 ? 2 : 1;
    for (let i = 0; i < count; i += 1) {
      noiseBurst({
        duration: random(0.014, 0.048),
        color: "white",
        filterType: "highpass",
        frequency: random(2600, 6800),
        q: random(0.7, 1.6),
        gainValue: random(0.026, 0.052) + strength * random(0.035, 0.09),
        attack: random(0.001, 0.003),
        startAt: i * random(0.012, 0.028),
        pan: pan + random(-0.16, 0.16),
      });
    }
  }

  function scheduleCrackle() {
    window.clearTimeout(state.crackleTimer);
    if (!state.fire) return;
    const rate = Number(ui.fireRate.value);
    const base = 980 - rate * 760;
    const delay = random(120, Math.max(150, base)) * random(0.55, 1.55);
    state.crackleTimer = window.setTimeout(() => {
      const strength = Number(ui.fireCrackle.value);
      const count = Math.random() < strength * 0.45 ? 2 + Math.floor(Math.random() * 2) : 1;
      for (let i = 0; i < count; i += 1) {
        window.setTimeout(() => playCrackle(strength), i * random(28, 85));
      }
      scheduleCrackle();
    }, Math.max(45, delay));
  }

  function playStrongCrackle({ manual = false } = {}) {
    if (!state.ctx || (!state.fire && !manual)) return;
    const strength = Number(ui.fireCrackle.value);
    const power = Math.max(0, Math.min(1, Number(ui.fireStrongCracklePower?.value || 0.72)));
    const amount = Math.max(0.08, strength * 0.62 + power * 0.9);
    const pan = random(-0.55, 0.55);
    const cluster = 2 + Math.floor(power * 6) + Math.floor(Math.random() * 2);
    noiseBurst({
      duration: random(0.06, 0.12),
      color: "white",
      filterType: "bandpass",
      frequency: random(1600, 3400),
      q: random(1.2, 2.7),
      gainValue: 0.075 + amount * random(0.16, 0.32),
      attack: 0.001,
      pan,
    });
    noiseBurst({
      duration: random(0.18, 0.32),
      color: "brown",
      filterType: "lowpass",
      frequency: random(220, 480),
      q: 0.42,
      gainValue: 0.035 + amount * 0.14,
      attack: 0.004,
      pan: pan * 0.6,
    });
    tone(random(72, 118), random(0.11, 0.2), "triangle", 0.012 + amount * 0.052, 0, destination());
    for (let i = 0; i < cluster; i += 1) {
      noiseBurst({
        duration: random(0.018, 0.062),
        color: "white",
        filterType: "highpass",
        frequency: random(3600, 9200),
        q: random(0.8, 1.8),
        gainValue: random(0.018, 0.06) + amount * random(0.04, 0.13),
        attack: 0.001,
        startAt: 0.035 + i * random(0.032, 0.07),
        pan: pan + random(-0.24, 0.24),
      });
    }
    log(`strong crackle ${Math.round(power * 100)}%${manual ? " test" : ""}`);
  }

  function scheduleStrongCrackle() {
    window.clearTimeout(state.strongCrackleTimer);
    if (!state.fire) return;
    const maxSec = Math.max(2, Number(ui.fireStrongCrackle.value) || 9);
    const delay = random(Math.max(1.2, maxSec * 0.35), maxSec) * 1000;
    state.strongCrackleTimer = window.setTimeout(() => {
      playStrongCrackle();
      scheduleStrongCrackle();
    }, delay);
  }

  function startLoop(name) {
    if (!state.ctx || state.loops.has(name)) return;
    const ctx = state.ctx;
    const src = sourceFromNoise(ctx, 4, name === "wind" ? "pink" : "brown");
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    if (name === "night") {
      filter.type = "bandpass";
      filter.frequency.value = 2400;
      filter.Q.value = 0.35;
      gain.gain.value = Number(ui.ambientVolume.value) * 0.05;
    } else if (name === "wind") {
      filter.type = "bandpass";
      filter.frequency.value = 420;
      filter.Q.value = 0.45;
      gain.gain.value = Number(ui.ambientVolume.value) * 0.18;
      lfo.frequency.value = 0.09;
      lfoGain.gain.value = 180;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start();
    } else if (name === "crowd") {
      filter.type = "lowpass";
      filter.frequency.value = 720;
      filter.Q.value = 0.2;
      gain.gain.value = Number(ui.ambientVolume.value) * 0.12;
    } else {
      filter.type = "highpass";
      filter.frequency.value = 1800;
      filter.Q.value = 0.2;
      gain.gain.value = Number(ui.ambientVolume.value) * 0.14;
    }
    src.connect(filter);
    filter.connect(gain);
    gain.connect(destination());
    src.start();
    state.loops.set(name, { src, filter, gain, lfo });
    document.querySelector(`[data-loop="${CSS.escape(name)}"]`)?.classList.add("active");
    ui.activeState.textContent = state.fire ? "campfire + ambient" : "ambient";
    log(`${name} loop on`);
  }

  function stopLoop(name) {
    const loop = state.loops.get(name);
    if (!loop) return;
    try {
      loop.src.stop();
      loop.lfo?.stop();
    } catch (_) {}
    state.loops.delete(name);
    document.querySelector(`[data-loop="${CSS.escape(name)}"]`)?.classList.remove("active");
    ui.activeState.textContent = state.fire ? "campfire" : (state.loops.size ? "ambient" : "idle");
    log(`${name} loop off`);
  }

  function updateAmbientVolume() {
    if (!state.ctx) return;
    const value = Number(ui.ambientVolume.value);
    const now = state.ctx.currentTime;
    for (const [name, loop] of state.loops) {
      const mul = name === "night" ? 0.05 : name === "wind" ? 0.18 : name === "crowd" ? 0.12 : 0.14;
      loop.gain.gain.setTargetAtTime(value * mul, now, 0.05);
    }
  }

  function tone(freq, duration, type = "sine", gainValue = 0.12, startAt = 0, target = destination()) {
    const ctx = state.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const t = ctx.currentTime + startAt;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainValue), t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain);
    gain.connect(target);
    osc.start(t);
    osc.stop(t + duration + 0.04);
  }

  function toneSweep({
    from = 220,
    to = 440,
    duration = 0.25,
    type = "sine",
    gainValue = 0.08,
    startAt = 0,
    target = destination(),
  } = {}) {
    const ctx = state.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = ctx.currentTime + startAt;
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + duration);
    gain.gain.setValueAtTime(0.0001, t);
    safeExpRamp(gain.gain, gainValue, t + 0.012);
    safeExpRamp(gain.gain, 0.0001, t + duration);
    osc.connect(gain);
    gain.connect(target);
    osc.start(t);
    osc.stop(t + duration + 0.04);
  }

  function tempEchoBus({ delayTime = 0.085, feedback = 0.18, wet = 0.32, liveFor = 1.4 } = {}) {
    const ctx = state.ctx;
    const input = ctx.createGain();
    const dry = ctx.createGain();
    const delay = ctx.createDelay(0.8);
    const loop = ctx.createGain();
    const wetGain = ctx.createGain();
    dry.gain.value = 0.95;
    delay.delayTime.value = delayTime;
    loop.gain.value = feedback;
    wetGain.gain.value = wet;
    input.connect(dry);
    dry.connect(destination());
    input.connect(delay);
    delay.connect(loop);
    loop.connect(delay);
    delay.connect(wetGain);
    wetGain.connect(destination());
    window.setTimeout(() => {
      for (const node of [input, dry, delay, loop, wetGain]) {
        try {
          node.disconnect();
        } catch (_) {}
      }
    }, liveFor * 1000);
    return input;
  }

  function triggerFireworkVisual() {
    const canvas = ui.fireworkStage;
    if (!canvas) return;
    const ctx2d = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    const start = performance.now();
    const launchX = w * (0.46 + (Math.random() - 0.5) * 0.14);
    const launchY = h - 32;
    const burstX = w * (0.48 + (Math.random() - 0.5) * 0.22);
    const burstY = h * (0.22 + Math.random() * 0.15);
    const particles = Array.from({ length: 82 }, (_, i) => {
      const angle = (i / 82) * Math.PI * 2 + random(-0.08, 0.08);
      const speed = random(58, 178);
      return {
        angle,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: random(1.6, 4.4),
        life: random(0.75, 1.25),
        hue: random(28, 58) + (Math.random() < 0.26 ? 178 : 0),
        delay: random(0, 0.18),
      };
    });
    cancelAnimationFrame(state.fireworkRaf);
    const draw = (now) => {
      const t = (now - start) / 1000;
      ctx2d.clearRect(0, 0, w, h);
      const bg = ctx2d.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "#071328");
      bg.addColorStop(1, "#02050a");
      ctx2d.fillStyle = bg;
      ctx2d.fillRect(0, 0, w, h);
      ctx2d.fillStyle = "rgba(255, 130, 56, 0.16)";
      ctx2d.beginPath();
      ctx2d.ellipse(w / 2, h - 15, 98, 18, 0, 0, Math.PI * 2);
      ctx2d.fill();
      for (let i = 0; i < 34; i += 1) {
        const starX = (i * 127) % w;
        const starY = 16 + ((i * 53) % Math.floor(h * 0.52));
        ctx2d.fillStyle = `rgba(230, 242, 255, ${0.18 + ((i % 5) * 0.05)})`;
        ctx2d.fillRect(starX, starY, 2, 2);
      }

      if (t < 0.98) {
        const p = t / 0.98;
        const ease = 1 - Math.pow(1 - p, 2.4);
        const x = launchX + Math.sin(p * Math.PI * 5) * 11;
        const y = launchY + (burstY - launchY) * ease;
        const trail = 90 * (1 - p * 0.45);
        const grad = ctx2d.createLinearGradient(x, y + trail, x, y);
        grad.addColorStop(0, "rgba(255,120,42,0)");
        grad.addColorStop(0.35, "rgba(255,166,64,0.42)");
        grad.addColorStop(1, "rgba(255,245,180,0.96)");
        ctx2d.strokeStyle = grad;
        ctx2d.lineWidth = 5;
        ctx2d.beginPath();
        ctx2d.moveTo(x, y + trail);
        ctx2d.lineTo(x, y);
        ctx2d.stroke();
        ctx2d.fillStyle = "#fff4b8";
        ctx2d.beginPath();
        ctx2d.arc(x, y, 7, 0, Math.PI * 2);
        ctx2d.fill();
        if (ui.fireworkTimeline) ui.fireworkTimeline.textContent = "피융~~~";
      } else {
        const bt = t - 0.98;
        const flash = Math.max(0, 1 - bt / 0.22);
        ctx2d.fillStyle = `rgba(255, 236, 166, ${flash * 0.26})`;
        ctx2d.fillRect(0, 0, w, h);
        ctx2d.fillStyle = `rgba(255, 238, 170, ${flash})`;
        ctx2d.beginPath();
        ctx2d.arc(burstX, burstY, 42 + flash * 72, 0, Math.PI * 2);
        ctx2d.fill();
        for (const ringAt of [0.50, 1.00]) {
          const rp = 1 - Math.abs(bt - ringAt) / 0.22;
          if (rp <= 0) continue;
          ctx2d.strokeStyle = `rgba(255, 204, 120, ${rp * 0.72})`;
          ctx2d.lineWidth = 3 + rp * 4;
          ctx2d.beginPath();
          ctx2d.arc(burstX + (ringAt - 0.75) * 110, burstY + ringAt * 28, 24 + (1 - rp) * 68, 0, Math.PI * 2);
          ctx2d.stroke();
        }
        for (const part of particles) {
          const pt = Math.max(0, bt - part.delay);
          if (pt <= 0) continue;
          const life = Math.max(0, 1 - pt / part.life);
          const x = burstX + part.vx * pt;
          const y = burstY + part.vy * pt + 92 * pt * pt;
          ctx2d.fillStyle = `hsla(${part.hue}, 95%, ${55 + life * 24}%, ${life})`;
          ctx2d.beginPath();
          ctx2d.arc(x, y, part.size * (0.45 + life), 0, Math.PI * 2);
          ctx2d.fill();
        }
        if (ui.fireworkTimeline) {
          ui.fireworkTimeline.textContent = bt < 0.28 ? "펑!" : bt < 1.14 ? "펑펑펑" : "잔불";
        }
      }

      if (t < 2.75) {
        state.fireworkRaf = requestAnimationFrame(draw);
      } else {
        if (ui.fireworkTimeline) ui.fireworkTimeline.textContent = "idle";
      }
    };
    draw(start);
  }

  function playFireworkSound() {
    const boomBus = tempEchoBus({ delayTime: 0.115, feedback: 0.2, wet: 0.24, liveFor: 2.4 });
    toneSweep({ from: 210, to: 1420, duration: 0.74, type: "sawtooth", gainValue: 0.034, target: boomBus });
    toneSweep({ from: 520, to: 2240, duration: 0.67, type: "triangle", gainValue: 0.024, startAt: 0.04, target: boomBus });
    noiseBurst({
      duration: 0.68,
      color: "pink",
      filterType: "bandpass",
      frequency: 1180,
      q: 0.7,
      gainValue: 0.032,
      attack: 0.09,
      target: boomBus,
    });
    noiseBurst({
      duration: 0.46,
      color: "brown",
      filterType: "lowpass",
      frequency: 390,
      q: 0.52,
      gainValue: 0.18,
      attack: 0.003,
      startAt: 0.98,
      target: boomBus,
    });
    noiseBurst({
      duration: 0.32,
      color: "pink",
      filterType: "lowpass",
      frequency: 620,
      q: 0.38,
      gainValue: 0.12,
      attack: 0.006,
      startAt: 0.99,
      target: boomBus,
    });
    [
      [1.00, 0.11, 520, 0.105],
      [1.48, 0.10, 460, 0.082],
      [1.98, 0.09, 560, 0.07],
    ].forEach(([startAt, duration, frequency, gainValue]) => {
      noiseBurst({
        duration,
        color: "pink",
        filterType: "bandpass",
        frequency,
        q: 0.85,
        gainValue,
        attack: 0.002,
        startAt,
        pan: random(-0.42, 0.42),
        target: boomBus,
      });
    });
    for (let i = 0; i < 30; i += 1) {
      const startAt = 1.04 + i * random(0.018, 0.044);
      noiseBurst({
        duration: random(0.025, 0.09),
        color: "white",
        filterType: "highpass",
        frequency: random(2600, 8400),
        q: random(0.5, 1.35),
        gainValue: random(0.008, 0.024),
        attack: random(0.001, 0.004),
        startAt,
        pan: random(-0.85, 0.85),
        target: boomBus,
      });
    }
  }

  function drawTestCharacter(ctx2d, x, y, scale, alpha = 1, squash = 1) {
    ctx2d.save();
    ctx2d.globalAlpha = alpha;
    ctx2d.translate(x, y);
    ctx2d.scale(scale, scale * squash);
    ctx2d.fillStyle = "rgba(0,0,0,0.28)";
    ctx2d.beginPath();
    ctx2d.ellipse(0, 46, 26, 7, 0, 0, Math.PI * 2);
    ctx2d.fill();
    ctx2d.fillStyle = "#56a4d8";
    ctx2d.strokeStyle = "#132838";
    ctx2d.lineWidth = 3;
    ctx2d.beginPath();
    ctx2d.roundRect(-24, -16, 48, 62, 22);
    ctx2d.fill();
    ctx2d.stroke();
    ctx2d.fillStyle = "#b02d6f";
    ctx2d.beginPath();
    ctx2d.ellipse(0, -24, 26, 22, 0, 0, Math.PI * 2);
    ctx2d.fill();
    ctx2d.stroke();
    ctx2d.fillStyle = "#111827";
    ctx2d.beginPath();
    ctx2d.arc(-9, -26, 3, 0, Math.PI * 2);
    ctx2d.arc(9, -26, 3, 0, Math.PI * 2);
    ctx2d.fill();
    ctx2d.strokeStyle = "#f7c948";
    ctx2d.lineWidth = 5;
    ctx2d.beginPath();
    ctx2d.moveTo(-20, -48);
    ctx2d.lineTo(-8, -70);
    ctx2d.lineTo(0, -48);
    ctx2d.lineTo(12, -70);
    ctx2d.lineTo(20, -48);
    ctx2d.stroke();
    ctx2d.restore();
  }

  function drawPoof(ctx2d, x, y, scale, progress) {
    const count = 18;
    for (let i = 0; i < count; i += 1) {
      const a = (i / count) * Math.PI * 2;
      const r = (12 + progress * 58) * scale * (0.74 + (i % 5) * 0.08);
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r * 0.62;
      ctx2d.fillStyle = `rgba(255, 221, 142, ${Math.max(0, 1 - progress) * 0.75})`;
      ctx2d.beginPath();
      ctx2d.arc(px, py, (3 + (i % 4)) * scale * (1 - progress * 0.3), 0, Math.PI * 2);
      ctx2d.fill();
    }
  }

  function triggerCharacterFx(kind, style) {
    const canvas = ui.characterFxStage;
    if (!canvas) return;
    const ctx2d = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    const scale = Number(ui.characterFxSize?.value || 1);
    const start = performance.now();
    const duration = kind === "entry" ? (style === "drop" ? 2100 : style === "portal" ? 900 : 700) : (style === "ascend" ? 2600 : 900);
    cancelAnimationFrame(state.characterFxRaf);
    const draw = (now) => {
      const t = now - start;
      const p = Math.min(1, t / duration);
      ctx2d.clearRect(0, 0, w, h);
      const bg = ctx2d.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "#071426");
      bg.addColorStop(1, "#06100c");
      ctx2d.fillStyle = bg;
      ctx2d.fillRect(0, 0, w, h);
      ctx2d.fillStyle = "rgba(255, 143, 56, 0.18)";
      ctx2d.beginPath();
      ctx2d.ellipse(w / 2, h - 28, 74, 16, 0, 0, Math.PI * 2);
      ctx2d.fill();
      let x = w / 2;
      let y = h - 64;
      let alpha = 1;
      let squash = 1;
      if (kind === "entry") {
        if (style === "drop") {
          const ease = p * p;
          y = -88 * scale + (h - 64 + 88 * scale) * ease;
          const impact = Math.max(0, 1 - Math.abs(p - 0.88) / 0.12);
          squash = 1 - impact * 0.18;
          if (p > 0.78) drawPoof(ctx2d, x, h - 32, scale, Math.max(0, (p - 0.78) / 0.22));
        } else if (style === "portal") {
          alpha = Math.min(1, p * 1.8);
          const ring = 1 - Math.abs(p - 0.55) / 0.45;
          if (ring > 0) drawPoof(ctx2d, x, y - 20, scale, 1 - ring);
        } else {
          alpha = Math.min(1, p * 2.2);
          drawPoof(ctx2d, x, y - 28, scale, Math.max(0, 1 - p));
        }
      } else if (style === "ascend") {
        const eased = 1 - Math.pow(1 - p, 2.5);
        y = h - 64 - eased * 82;
        alpha = Math.max(0, 1 - p * 0.9);
        const vanish = Math.max(0, (p - 0.82) / 0.18);
        if (vanish > 0) drawPoof(ctx2d, x, y, scale, vanish);
      } else if (style === "poof") {
        alpha = Math.max(0, 1 - p * 1.7);
        drawPoof(ctx2d, x, y - 10, scale, p);
      } else {
        y = h - 64 + p * 34;
        alpha = Math.max(0, 1 - p * 1.1);
        if (p > 0.6) drawPoof(ctx2d, x, y, scale, (p - 0.6) / 0.4);
      }
      if (alpha > 0.02) drawTestCharacter(ctx2d, x, y, scale, alpha, squash);
      if (p < 1) state.characterFxRaf = requestAnimationFrame(draw);
    };
    draw(start);
  }

  function playEntrySound(style) {
    if (style === "sparkle") {
      const bus = tempEchoBus({ delayTime: 0.075, feedback: 0.28, wet: 0.42, liveFor: 1.8 });
      noiseSweep({ duration: 0.18, color: "pink", filterType: "highpass", from: 1700, to: 6200, q: 0.7, gainValue: 0.055, attack: 0.02, target: bus });
      [523, 659, 880, 1175, 1568, 2093].forEach((freq, i) => {
        tone(freq, 0.28, "sine", 0.058 - i * 0.004, i * 0.048, bus);
        tone(freq * 2.01, 0.12, "triangle", 0.018, i * 0.048 + 0.015, bus);
        noiseBurst({
          duration: 0.045,
          filterType: "highpass",
          frequency: 3600 + i * 720,
          gainValue: 0.03,
          startAt: i * 0.048,
          pan: random(-0.55, 0.55),
          target: bus,
        });
      });
      noiseBurst({ duration: 0.12, color: "white", filterType: "bandpass", frequency: 2400, q: 2.5, gainValue: 0.06, startAt: 0.32, target: bus });
    } else if (style === "portal") {
      const bus = tempEchoBus({ delayTime: 0.12, feedback: 0.24, wet: 0.34, liveFor: 2.0 });
      noiseSweep({ duration: 0.58, color: "pink", filterType: "bandpass", from: 180, to: 1780, q: 1.5, gainValue: 0.085, attack: 0.08, target: bus });
      toneSweep({ from: 110, to: 420, duration: 0.52, type: "triangle", gainValue: 0.07, target: bus });
      toneSweep({ from: 920, to: 1380, duration: 0.42, type: "sine", gainValue: 0.032, startAt: 0.1, target: bus });
      noiseBurst({ duration: 0.18, color: "white", filterType: "bandpass", frequency: 2100, q: 2.4, gainValue: 0.08, startAt: 0.5, target: bus });
      tone(784, 0.3, "sine", 0.05, 0.52, bus);
    } else {
      const bus = tempEchoBus({ delayTime: 0.12, feedback: 0.13, wet: 0.2, liveFor: 2.7 });
      noiseSweep({
        duration: 1.78,
        color: "pink",
        filterType: "bandpass",
        from: 1850,
        to: 360,
        q: 1.0,
        gainValue: 0.05,
        attack: 0.05,
        target: bus,
      });
      toneSweep({ from: 760, to: 140, duration: 1.72, type: "triangle", gainValue: 0.035, target: bus });
      noiseBurst({
        duration: 0.14,
        color: "white",
        filterType: "bandpass",
        frequency: 1320,
        q: 1.5,
        gainValue: 0.075,
        startAt: 1.78,
        target: bus,
      });
      noiseBurst({
        duration: 0.28,
        color: "brown",
        filterType: "lowpass",
        frequency: 290,
        q: 0.5,
        gainValue: 0.12,
        startAt: 1.82,
        target: bus,
      });
      tone(82, 0.28, "sine", 0.05, 1.82, bus);
      tone(523, 0.24, "sine", 0.035, 2.02, bus);
    }
    log(`entry ${style}`);
  }

  function playExitSound(style) {
    if (style === "poof") {
      const bus = tempEchoBus({ delayTime: 0.105, feedback: 0.16, wet: 0.24, liveFor: 1.4 });
      noiseBurst({ duration: 0.24, color: "pink", filterType: "bandpass", frequency: 720, q: 0.72, gainValue: 0.12, target: bus });
      noiseBurst({ duration: 0.34, color: "brown", filterType: "lowpass", frequency: 330, q: 0.5, gainValue: 0.07, startAt: 0.07, target: bus });
      tone(132, 0.18, "triangle", 0.035, 0.03, bus);
      for (let i = 0; i < 13; i += 1) {
        noiseBurst({ duration: random(0.025, 0.08), filterType: "highpass", frequency: random(2600, 7600), gainValue: random(0.014, 0.038), startAt: 0.05 + i * 0.026, pan: random(-0.75, 0.75), target: bus });
      }
    } else if (style === "drop") {
      const bus = tempEchoBus({ delayTime: 0.14, feedback: 0.12, wet: 0.18, liveFor: 1.5 });
      toneSweep({ from: 620, to: 70, duration: 0.48, type: "sawtooth", gainValue: 0.06, target: bus });
      noiseSweep({ duration: 0.42, color: "pink", filterType: "lowpass", from: 900, to: 180, q: 0.8, gainValue: 0.05, target: bus });
      noiseBurst({ duration: 0.18, color: "brown", filterType: "lowpass", frequency: 220, gainValue: 0.11, startAt: 0.42, target: bus });
      tone(58, 0.3, "sine", 0.062, 0.43, bus);
    } else {
      const bus = tempEchoBus({ delayTime: 0.08, feedback: 0.26, wet: 0.36, liveFor: 3.1 });
      toneSweep({ from: 220, to: 1280, duration: 1.64, type: "triangle", gainValue: 0.035, target: bus });
      noiseSweep({
        duration: 1.82,
        color: "pink",
        filterType: "highpass",
        from: 900,
        to: 5400,
        q: 0.7,
        gainValue: 0.045,
        attack: 0.05,
        target: bus,
      });
      [1046, 1320, 1760].forEach((freq, i) => {
        tone(freq, 0.16, "sine", 0.02, 0.42 + i * 0.12, bus);
        noiseBurst({ duration: 0.035, filterType: "highpass", frequency: freq * 2.2, gainValue: 0.012, startAt: 0.42 + i * 0.12, pan: random(-0.6, 0.6), target: bus });
      });
      noiseSweep({
        duration: 0.34,
        color: "white",
        filterType: "highpass",
        from: 2100,
        to: 9200,
        q: 0.9,
        gainValue: 0.095,
        attack: 0.01,
        startAt: 2.18,
        pan: 0.12,
        target: bus,
      });
      toneSweep({ from: 980, to: 4200, duration: 0.27, type: "sine", gainValue: 0.024, startAt: 2.23, target: bus });
      noiseBurst({ duration: 0.08, color: "white", filterType: "highpass", frequency: 7600, q: 1.4, gainValue: 0.045, startAt: 2.48, pan: 0.24, target: bus });
    }
    log(`exit ${style}`);
  }

  function clearBabbleTimers() {
    for (const timer of state.babbleTimers) window.clearTimeout(timer);
    state.babbleTimers = [];
  }

  function babbleCharDuration(ch, speed = 1) {
    const scale = 1 / Math.max(0.1, speed);
    if (/\s/.test(ch)) return 0.055 * scale;
    if (/[,.!?;:，。！？]/.test(ch)) return 0.16 * scale;
    return 0.052 * scale;
  }

  function makeBabbleVoice() {
    const selected = ui.babbleVoice?.value || "random";
    const seedText = ui.babbleSeed?.value || "NA";
    const rnd = seededRand(hashString(`${selected}:${seedText}`));
    const presets = {
      soft: { base: 380, spread: 180, formant: 1.38, waveA: "triangle", waveB: "sine", gain: 0.022, noise: 0.004 },
      bright: { base: 520, spread: 260, formant: 1.72, waveA: "square", waveB: "sine", gain: 0.023, noise: 0.007 },
      low: { base: 250, spread: 140, formant: 1.28, waveA: "sawtooth", waveB: "triangle", gain: 0.019, noise: 0.006 },
      tiny: { base: 720, spread: 300, formant: 1.9, waveA: "square", waveB: "sine", gain: 0.018, noise: 0.004 },
      robot: { base: 330, spread: 110, formant: 2.01, waveA: "square", waveB: "square", gain: 0.016, noise: 0.003, quantize: 55 },
    };
    const style = selected === "random"
      ? ["soft", "bright", "low", "tiny", "robot"][Math.floor(rnd() * 5)]
      : selected;
    const voice = Object.assign({}, presets[style] || presets.soft);
    voice.style = style;
    voice.base += (rnd() - 0.5) * 90;
    voice.spread *= 0.78 + rnd() * 0.5;
    voice.formant *= 0.9 + rnd() * 0.22;
    voice.gain *= 0.86 + rnd() * 0.36;
    voice.noise *= 0.7 + rnd() * 0.8;
    voice.seed = seedText;
    return voice;
  }

  function playBabbleText(text) {
    clearBabbleTimers();
    const value = String(text || "").trim();
    if (!value) return;
    if (ui.babbleDisplay) ui.babbleDisplay.textContent = "";
    const speed = Number(ui.babbleSpeed?.value || 1);
    const voice = makeBabbleVoice();
    const bus = tempEchoBus({ delayTime: 0.035, feedback: 0.06, wet: 0.07, liveFor: Math.min(10, value.length * 0.08 / Math.max(0.1, speed) + 1) });
    const chars = Array.from(value);
    let cursor = 0;
    chars.forEach((ch, index) => {
      const at = cursor;
      const duration = babbleCharDuration(ch, speed);
      const timer = window.setTimeout(() => {
        if (ui.babbleDisplay) ui.babbleDisplay.textContent = chars.slice(0, index + 1).join("");
      }, at * 1000);
      state.babbleTimers.push(timer);
      if (!/\s/.test(ch) && !/[,.!?;:，。！？]/.test(ch)) {
        const code = ch.codePointAt(0) || 0;
        const vowelish = code % 7;
        let freq = voice.base + (code % 11) * (voice.spread / 11) + vowelish * 10;
        if (voice.quantize) freq = Math.round(freq / voice.quantize) * voice.quantize;
        const pan = ((index % 5) - 2) * 0.06;
        const blipDur = Math.min(0.052, duration * 0.82);
        tone(freq, blipDur, index % 2 ? voice.waveA : voice.waveB, voice.gain * BABBLE_OUTPUT_GAIN, at, bus);
        tone(freq * voice.formant, Math.max(0.018, blipDur * 0.72), voice.waveB, voice.gain * 0.32 * BABBLE_OUTPUT_GAIN, at + 0.006 / Math.max(0.1, speed), bus);
        noiseBurst({ duration: 0.016, filterType: "bandpass", frequency: freq * 2.25, q: 2.2, gainValue: voice.noise * BABBLE_OUTPUT_GAIN, startAt: at, pan, target: bus });
      }
      cursor += duration;
    });
    log(`babble ${chars.length} chars, ${speed.toFixed(2)}x, ${voice.style}:${voice.seed}`);
  }

  function hit(kind) {
    if (!state.ctx) return;
    const ctx = state.ctx;
    if (kind === "ui") {
      noiseBurst({ duration: 0.026, frequency: 1900, q: 1.4, gainValue: 0.045, attack: 0.001 });
      tone(740, 0.07, "triangle", 0.035, 0.006);
      tone(1030, 0.06, "sine", 0.026, 0.036);
    } else if (kind === "level-up") {
      const shine = tempEchoBus({ delayTime: 0.075, feedback: 0.24, wet: 0.34, liveFor: 1.8 });
      toneSweep({ from: 240, to: 930, duration: 0.34, type: "triangle", gainValue: 0.034 });
      noiseBurst({
        duration: 0.18,
        color: "pink",
        filterType: "bandpass",
        frequency: 1450,
        q: 0.72,
        gainValue: 0.035,
        attack: 0.018,
      });
      [
        [523.25, 0.00, 0.045],
        [659.25, 0.075, 0.05],
        [783.99, 0.15, 0.052],
        [1046.5, 0.225, 0.06],
        [1318.51, 0.31, 0.044],
      ].forEach(([freq, start, gain]) => {
        tone(freq, 0.34, "sine", gain, start, shine);
        tone(freq * 1.005, 0.28, "triangle", gain * 0.35, start + 0.006, shine);
      });
      [1760, 2093, 2637, 3136].forEach((freq, i) => {
        tone(freq, 0.16, "sine", 0.016, 0.28 + i * 0.038, shine);
      });
      for (let i = 0; i < 9; i += 1) {
        noiseBurst({
          duration: random(0.025, 0.07),
          color: "white",
          filterType: "highpass",
          frequency: random(3800, 8200),
          q: random(0.6, 1.4),
          gainValue: random(0.01, 0.026),
          startAt: 0.22 + i * random(0.028, 0.052),
          pan: random(-0.7, 0.7),
          target: shine,
        });
      }
    } else if (kind === "level-down") {
      const dull = tempEchoBus({ delayTime: 0.13, feedback: 0.12, wet: 0.18, liveFor: 1.3 });
      noiseBurst({
        duration: 0.13,
        color: "pink",
        filterType: "bandpass",
        frequency: 760,
        q: 1.1,
        gainValue: 0.042,
        attack: 0.002,
        target: dull,
      });
      toneSweep({ from: 720, to: 142, duration: 0.46, type: "sawtooth", gainValue: 0.034, target: dull });
      [
        [493.88, 0.00, 0.044],
        [392.0, 0.09, 0.047],
        [311.13, 0.18, 0.048],
        [196.0, 0.31, 0.052],
      ].forEach(([freq, start, gain]) => {
        tone(freq, 0.38, "triangle", gain, start, dull);
        tone(freq * 0.497, 0.34, "sine", gain * 0.22, start + 0.018, dull);
      });
      noiseBurst({
        duration: 0.26,
        color: "brown",
        filterType: "lowpass",
        frequency: 320,
        q: 0.46,
        gainValue: 0.066,
        attack: 0.006,
        startAt: 0.34,
        target: dull,
      });
      tone(72, 0.28, "sine", 0.032, 0.38, dull);
    } else if (kind === "firework") {
      triggerFireworkVisual();
      playFireworkSound();
    } else if (kind === "cheer") {
      for (let i = 0; i < 12; i += 1) {
        const t = i * 0.06;
        tone(i % 2 ? 1180 : 920, 0.05, "triangle", 0.018, t);
        noiseBurst({
          duration: 0.075,
          color: "pink",
          filterType: "bandpass",
          frequency: i % 2 ? 1800 : 2450,
          q: 1.2,
          gainValue: 0.035,
          startAt: t,
          pan: i % 2 ? -0.45 : 0.45,
        });
      }
    } else if (kind === "claw") {
      toneSweep({ from: 220, to: 130, duration: 0.28, type: "sawtooth", gainValue: 0.045 });
      noiseBurst({ duration: 0.10, color: "pink", filterType: "bandpass", frequency: 720, q: 1.6, gainValue: 0.05, startAt: 0.17 });
      tone(112, 0.16, "triangle", 0.052, 0.34);
    } else if (kind === "cage") {
      noiseBurst({ duration: 0.08, color: "white", filterType: "bandpass", frequency: 1100, q: 3.5, gainValue: 0.065 });
      [174, 232, 319, 470].forEach((f, i) => tone(f, 0.48 - i * 0.04, "triangle", 0.028, i * 0.012));
      tone(91, 0.2, "sine", 0.04, 0.035);
    } else if (kind === "coin") {
      tone(988, 0.09, "triangle", 0.052);
      tone(1568, 0.18, "sine", 0.052, 0.075);
      tone(2217, 0.12, "sine", 0.024, 0.15);
    }
    log(`hit ${kind}`);
  }

  async function playFile() {
    const ctx = await ensureAudio();
    if (!state.fileBuffer) {
      const file = ui.fileInput.files?.[0];
      if (!file) {
        log("select an audio file first");
        return;
      }
      const data = await file.arrayBuffer();
      state.fileBuffer = await ctx.decodeAudioData(data.slice(0));
      log(`file loaded: ${file.name}`);
    }
    stopFile();
    const src = ctx.createBufferSource();
    src.buffer = state.fileBuffer;
    src.loop = ui.fileLoop.checked;
    src.connect(destination());
    src.start();
    state.fileSource = src;
    src.onended = () => {
      if (state.fileSource === src) state.fileSource = null;
    };
    log("file play");
  }

  function stopFile() {
    if (!state.fileSource) return;
    try {
      state.fileSource.stop();
    } catch (_) {}
    state.fileSource = null;
    log("file stop");
  }

  function stopAll() {
    stopFire();
    for (const name of Array.from(state.loops.keys())) stopLoop(name);
    stopFile();
    ui.presetReadout.textContent = "clear";
    ui.activeState.textContent = "idle";
  }

  async function preset(name) {
    await ensureAudio();
    stopAll();
    if (name === "campfire-only") {
      ui.fireBed.value = "0.42";
      ui.fireCrackle.value = "0.62";
      ui.fireRate.value = "0.48";
      startFire();
    } else if (name === "quiet-night") {
      ui.fireBed.value = "0.26";
      ui.fireCrackle.value = "0.22";
      ui.fireRate.value = "0.18";
      ui.ambientVolume.value = "0.18";
      startFire();
      startLoop("night");
      startLoop("wind");
    } else if (name === "festival") {
      ui.fireBed.value = "0.52";
      ui.fireCrackle.value = "0.64";
      ui.fireRate.value = "0.58";
      ui.ambientVolume.value = "0.32";
      startFire();
      startLoop("crowd");
      hit("firework");
    }
    updateReadouts();
    updateFire();
    updateAmbientVolume();
    ui.presetReadout.textContent = name;
    log(`preset ${name}`);
  }

  function drawMeter() {
    const canvas = ui.meter;
    const ctx2d = canvas.getContext("2d");
    const data = new Uint8Array(512);
    const draw = () => {
      state.meterRaf = requestAnimationFrame(draw);
      const w = canvas.width;
      const h = canvas.height;
      ctx2d.clearRect(0, 0, w, h);
      const grad = ctx2d.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, "#13253a");
      grad.addColorStop(1, "#070a10");
      ctx2d.fillStyle = grad;
      ctx2d.fillRect(0, 0, w, h);
      if (!state.analyser) return;
      state.analyser.getByteFrequencyData(data);
      const bars = 80;
      const gap = 2;
      const bw = w / bars;
      for (let i = 0; i < bars; i += 1) {
        const v = data[Math.floor((i / bars) * data.length)] / 255;
        const bh = Math.max(2, v * (h - 24));
        const hue = 28 + i * 0.5;
        ctx2d.fillStyle = `hsl(${hue} 92% ${52 + v * 24}%)`;
        ctx2d.fillRect(i * bw + gap, h - bh, Math.max(1, bw - gap * 2), bh);
      }
    };
    draw();
  }

  function bind() {
    updateReadouts();
    ui.audioPower.addEventListener("click", async () => {
      await ensureAudio();
      log("audio on");
    });
    ui.stopAll.addEventListener("click", stopAll);
    for (const el of [ui.masterVolume, ui.distance, ui.pan]) {
      el.addEventListener("input", () => {
        updateReadouts();
        applyGlobalControls();
      });
    }
    for (const el of [ui.fireBed, ui.fireCrackle, ui.fireRate]) {
      el.addEventListener("input", () => {
        updateReadouts();
        updateFire();
        if (el === ui.fireRate) scheduleCrackle();
      });
    }
    ui.fireStrongCrackle?.addEventListener("input", () => {
      updateReadouts();
      scheduleStrongCrackle();
    });
    ui.fireStrongCracklePower?.addEventListener("input", updateReadouts);
    ui.fireStrongCrackleTest?.addEventListener("click", async () => {
      await ensureAudio();
      playStrongCrackle({ manual: true });
    });
    ui.ambientVolume.addEventListener("input", () => {
      updateReadouts();
      updateAmbientVolume();
    });
    ui.fireToggle.addEventListener("click", async () => {
      await ensureAudio();
      if (state.fire) stopFire();
      else startFire();
    });
    ui.fireSoft.addEventListener("click", async () => {
      await ensureAudio();
      ui.fireBed.value = "0.22";
      ui.fireCrackle.value = "0.34";
      ui.fireRate.value = "0.28";
      updateReadouts();
      updateFire();
      if (!state.fire) startFire();
    });
    ui.fireBright.addEventListener("click", async () => {
      await ensureAudio();
      ui.fireBed.value = "0.56";
      ui.fireCrackle.value = "0.82";
      ui.fireRate.value = "0.78";
      updateReadouts();
      updateFire();
      if (!state.fire) startFire();
    });
    document.querySelectorAll("[data-loop]").forEach((button) => {
      button.addEventListener("click", async () => {
        await ensureAudio();
        const name = button.dataset.loop;
        if (state.loops.has(name)) stopLoop(name);
        else startLoop(name);
      });
    });
    document.querySelectorAll("[data-hit]").forEach((button) => {
      button.addEventListener("click", async () => {
        await ensureAudio();
        hit(button.dataset.hit);
      });
    });
    ui.entrySoundPlay?.addEventListener("click", async () => {
      await ensureAudio();
      const style = ui.entrySoundStyle?.value || "drop";
      triggerCharacterFx("entry", style);
      playEntrySound(style);
    });
    ui.exitSoundPlay?.addEventListener("click", async () => {
      await ensureAudio();
      const style = ui.exitSoundStyle?.value || "ascend";
      triggerCharacterFx("exit", style);
      playExitSound(style);
    });
    ui.characterFxSize?.addEventListener("input", updateReadouts);
    ui.babbleSpeed?.addEventListener("input", updateReadouts);
    ui.babbleRandom?.addEventListener("click", () => {
      if (ui.babbleVoice) ui.babbleVoice.value = "random";
      if (ui.babbleSeed) ui.babbleSeed.value = `char-${Math.random().toString(36).slice(2, 7)}`;
      updateReadouts();
    });
    ui.babblePlay?.addEventListener("click", async () => {
      await ensureAudio();
      playBabbleText(ui.babbleText?.value || "");
    });
    ui.babbleText?.addEventListener("keydown", (ev) => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key === "Enter") {
        ev.preventDefault();
        ui.babblePlay?.click();
      }
    });
    document.querySelectorAll("[data-preset]").forEach((button) => {
      button.addEventListener("click", () => preset(button.dataset.preset));
    });
    ui.fileInput.addEventListener("change", () => {
      state.fileBuffer = null;
      log(ui.fileInput.files?.[0] ? `file selected: ${ui.fileInput.files[0].name}` : "file cleared");
    });
    ui.filePlay.addEventListener("click", playFile);
    ui.fileStop.addEventListener("click", stopFile);
    window.setInterval(() => {
      if (state.ctx) ui.audioState.textContent = state.ctx.state;
    }, 500);
  }

  bind();
})();
