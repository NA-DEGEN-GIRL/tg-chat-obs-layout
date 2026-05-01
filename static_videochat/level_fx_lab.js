(() => {
  const canvas = document.getElementById("scene");
  const label = document.getElementById("label");
  const levelEl = document.getElementById("level");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 80);
  scene.add(camera);

  const state = {
    yaw: -0.32,
    pitch: 0.82,
    zoom: 6.2,
    pan: new THREE.Vector3(0, 0, 0),
    effects: [],
    level: 1,
    drag: null,
    clawMove: null,
    placeIndex: 0,
    characterScale: 1,
  };

  const warm = new THREE.Color(0xffd45c);
  const cool = new THREE.Color(0x7fb6ff);
  const white = new THREE.Color(0xffffff);
  const CHEER_DEFAULT_SEC = 5;
  const CHEER_MAX_SEC = 600;

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function easeInOut(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function clamp01(value) {
    return Math.max(0, Math.min(1, value));
  }

  function phase(value, start, end) {
    return clamp01((value - start) / Math.max(0.0001, end - start));
  }

  function lerpValue(a, b, t) {
    return a + (b - a) * t;
  }

  function currentCharacterScale() {
    const scale = Number(state.characterScale);
    return Math.max(0.28, Math.min(1.15, Number.isFinite(scale) ? scale : 1));
  }

  function characterClawMetrics(scale = currentCharacterScale()) {
    const s = Math.max(0.28, Math.min(1.15, scale));
    const sizeT = clamp01((s - 0.28) / 0.87);
    const headTopY = 1.31 * s;
    const grabClearance = 0.3 + s * 0.12;
    return {
      scale: s,
      grabHeadY: headTopY + grabClearance,
      maxBend: lerpValue(0.84, 0.52, sizeT),
      releaseHop: 0.075 * s,
      sway: 0.018 * Math.max(0.45, s),
    };
  }

  function orbitPopGapMs() {
    const input = document.getElementById("orbit-pop-gap");
    const seconds = Number(input?.value);
    const clamped = Math.max(0.15, Math.min(1.5, Number.isFinite(seconds) ? seconds : 0.5));
    if (input) input.value = String(clamped);
    return clamped * 1000;
  }

  function addWorld() {
    scene.add(new THREE.HemisphereLight(0x8ca8e8, 0x123b25, 1.1));
    const moon = new THREE.DirectionalLight(0xabc5ff, 0.85);
    moon.position.set(4, 8, 5);
    scene.add(moon);
    const fireLight = new THREE.PointLight(0xff8c30, 3.2, 8.5, 1.5);
    fireLight.position.set(0, 1.2, 0);
    scene.add(fireLight);

    const grass = new THREE.Mesh(
      new THREE.CircleGeometry(5.9, 96),
      new THREE.MeshStandardMaterial({ color: 0x24653a, roughness: 0.95 })
    );
    grass.rotation.x = -Math.PI / 2;
    scene.add(grass);

    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(1.35, 48),
      new THREE.MeshBasicMaterial({ color: 0xff9a35, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending })
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.012;
    scene.add(glow);

    const fire = new THREE.Group();
    const outer = new THREE.Mesh(
      new THREE.ConeGeometry(0.34, 0.95, 28),
      new THREE.MeshStandardMaterial({ color: 0xff8124, emissive: 0xff601a, emissiveIntensity: 1.4, transparent: true, opacity: 0.94 })
    );
    outer.position.y = 0.55;
    const inner = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 0.62, 24),
      new THREE.MeshStandardMaterial({ color: 0xffdf72, emissive: 0xffce52, emissiveIntensity: 1.6, transparent: true, opacity: 0.95 })
    );
    inner.position.y = 0.46;
    fire.add(outer, inner);
    scene.add(fire);

    const logMat = new THREE.MeshStandardMaterial({ color: 0x5c3726, roughness: 0.78 });
    for (let i = 0; i < 4; i += 1) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.25, 12), logMat);
      log.rotation.z = Math.PI / 2;
      log.rotation.y = i * Math.PI / 4;
      log.position.y = 0.12;
      scene.add(log);
    }

    const starGeo = new THREE.SphereGeometry(0.012, 8, 6);
    const starMat = new THREE.MeshBasicMaterial({ color: 0xdbeaff, transparent: true, opacity: 0.72 });
    for (let i = 0; i < 180; i += 1) {
      const star = new THREE.Mesh(starGeo, starMat);
      star.position.set((Math.random() - 0.5) * 22, 4 + Math.random() * 8, -5 - Math.random() * 13);
      scene.add(star);
    }
  }

  function makeCharacter() {
    const group = new THREE.Group();
    group.position.set(-1.35, 0, 1.3);
    group.rotation.y = Math.atan2(-group.position.x, -group.position.z);
    group.userData.baseY = 0;
    group.userData.parts = [];

    const skin = new THREE.Color(0xffc08f);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x55a7df, roughness: 0.72 });
    const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.68 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.46, 5, 12), bodyMat);
    body.position.y = 0.58;
    group.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 20, 16), skinMat);
    head.position.y = 1.08;
    group.add(head);

    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.245, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.48),
      new THREE.MeshStandardMaterial({ color: 0x543b2c, roughness: 0.82 })
    );
    hair.position.y = 1.16;
    hair.rotation.x = -0.18;
    group.add(hair);

    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111018 });
    const eyeGeo = new THREE.SphereGeometry(0.025, 8, 6);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.075, 1.1, 0.205);
    eyeR.position.set(0.075, 1.1, 0.205);
    group.add(eyeL, eyeR);

    const armGeo = new THREE.CapsuleGeometry(0.055, 0.32, 4, 8);
    const armL = new THREE.Mesh(armGeo, skinMat);
    const armR = new THREE.Mesh(armGeo, skinMat);
    armL.position.set(-0.33, 0.69, 0.06);
    armR.position.set(0.33, 0.69, 0.06);
    armL.rotation.set(0.14, 0, -0.56);
    armR.rotation.set(0.14, 0, 0.56);
    group.userData.arms = {
      left: armL,
      right: armR,
      leftBase: armL.rotation.clone(),
      rightBase: armR.rotation.clone(),
    };
    group.add(armL, armR);

    const legGeo = new THREE.CapsuleGeometry(0.065, 0.3, 4, 8);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x29334a, roughness: 0.78 });
    const legL = new THREE.Mesh(legGeo, legMat);
    const legR = new THREE.Mesh(legGeo, legMat);
    legL.position.set(-0.12, 0.22, 0);
    legR.position.set(0.12, 0.22, 0);
    group.add(legL, legR);

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.42, 24),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.015;
    group.add(shadow);

    group.traverse((obj) => {
      if (obj.material && obj.material.color) {
        obj.material.userData.baseColor = obj.material.color.clone();
        group.userData.parts.push(obj);
      }
    });
    attachCheerRig(group);
    scene.add(group);
    return group;
  }

  function makeAdditiveMaterial(color, opacity) {
    return new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }

  function createCheerStick(color) {
    const stick = new THREE.Group();
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.02, 0.18, 10),
      new THREE.MeshStandardMaterial({ color: 0x1b1f28, roughness: 0.46 })
    );
    handle.position.y = -0.07;
    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.026, 0.52, 16),
      makeAdditiveMaterial(color, 0.96)
    );
    core.position.y = 0.23;
    const glow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.54, 18, 1, true),
      makeAdditiveMaterial(color, 0.24)
    );
    glow.position.y = 0.23;
    const tip = new THREE.Mesh(
      new THREE.SphereGeometry(0.044, 14, 10),
      makeAdditiveMaterial(color.clone().lerp(white, 0.2), 0.72)
    );
    tip.position.y = 0.51;
    stick.add(handle, glow, core, tip);
    stick.traverse((obj) => {
      obj.userData.isCheerStick = true;
    });
    stick.visible = false;
    return { group: stick, glow, core, tip };
  }

  function attachCheerRig(group) {
    const left = createCheerStick(new THREE.Color(0x4dfff1));
    const right = createCheerStick(new THREE.Color(0xdfff55));
    group.add(left.group, right.group);
    group.userData.cheer = {
      left,
      right,
      until: 0,
      startedAt: 0,
    };
  }

  function createClawRig() {
    const root = new THREE.Group();
    root.visible = false;

    const steel = new THREE.MeshStandardMaterial({
      color: 0xb8c7d8,
      metalness: 0.72,
      roughness: 0.24,
      emissive: 0x15283a,
      emissiveIntensity: 0.08,
    });
    const darkSteel = new THREE.MeshStandardMaterial({
      color: 0x435061,
      metalness: 0.62,
      roughness: 0.32,
    });
    const cableMat = new THREE.MeshStandardMaterial({
      color: 0xd9e8f5,
      metalness: 0.8,
      roughness: 0.18,
    });
    const glowMat = makeAdditiveMaterial(new THREE.Color(0x8bdcff), 0.22);

    const carriage = new THREE.Group();
    const rail = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.08, 0.12), darkSteel);
    const block = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.26), steel);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 8), makeAdditiveMaterial(new THREE.Color(0x8bdcff), 0.78));
    block.position.y = -0.08;
    lamp.position.set(0, -0.22, 0.12);
    carriage.add(rail, block, lamp);
    root.add(carriage);

    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1, 10), cableMat);
    cable.position.y = -0.5;
    root.add(cable);

    const head = new THREE.Group();
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.14, 18, 12), steel);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.014, 8, 36), darkSteel);
    collar.rotation.x = Math.PI / 2;
    head.add(hub, collar);

    const prongs = [];
    const upperGeo = new THREE.CylinderGeometry(0.022, 0.026, 0.28, 10);
    const lowerGeo = new THREE.CylinderGeometry(0.02, 0.024, 0.28, 10);
    const jointGeo = new THREE.SphereGeometry(0.032, 10, 8);
    const tipGeo = new THREE.SphereGeometry(0.04, 12, 8);
    for (let i = 0; i < 4; i += 1) {
      const angle = i * Math.PI / 2 + Math.PI / 4;
      const pivot = new THREE.Group();
      pivot.userData.angle = angle;
      pivot.userData.openRadius = 0.34;
      pivot.userData.hingeY = -0.28;
      pivot.userData.fingerLength = 0.28;
      pivot.rotation.y = Math.PI / 2 - angle;
      const arm = new THREE.Mesh(upperGeo, steel);
      arm.position.set(0, -0.14, 0);
      const joint = new THREE.Mesh(jointGeo, darkSteel);
      joint.position.set(0, pivot.userData.hingeY, 0);
      const finger = new THREE.Mesh(lowerGeo, steel);
      const tip = new THREE.Mesh(tipGeo, steel);
      pivot.userData.finger = finger;
      pivot.userData.tip = tip;
      pivot.add(arm, joint, finger, tip);
      head.add(pivot);
      prongs.push(pivot);
    }
    root.add(head);

    const grabRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.44, 0.016, 8, 72),
      glowMat
    );
    grabRing.rotation.x = Math.PI / 2;
    grabRing.visible = false;
    root.add(grabRing);

    const target = new THREE.Group();
    target.visible = false;
    const targetRing = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.52, 72),
      makeAdditiveMaterial(new THREE.Color(0x7efcff), 0.46)
    );
    targetRing.rotation.x = -Math.PI / 2;
    targetRing.position.y = 0.026;
    const targetDot = new THREE.Mesh(
      new THREE.CircleGeometry(0.12, 32),
      makeAdditiveMaterial(new THREE.Color(0xffffff), 0.16)
    );
    targetDot.rotation.x = -Math.PI / 2;
    targetDot.position.y = 0.028;
    target.add(targetRing, targetDot);

    scene.add(root);
    scene.add(target);
    return { root, cable, head, prongs, grabRing, target, targetRing };
  }

  function clampCheerSeconds(value) {
    const seconds = Number(value);
    if (!Number.isFinite(seconds)) return CHEER_DEFAULT_SEC;
    return Math.max(1, Math.min(CHEER_MAX_SEC, seconds));
  }

  function cheerSecondsInput() {
    const input = document.getElementById("cheer-sec");
    const seconds = clampCheerSeconds(input?.value);
    if (input) input.value = String(Math.round(seconds));
    return seconds;
  }

  function startCheer(seconds = CHEER_DEFAULT_SEC) {
    const clamped = clampCheerSeconds(seconds);
    character.userData.cheer.until = performance.now() + clamped * 1000;
    character.userData.cheer.startedAt = performance.now();
  }

  function stopCheer() {
    character.userData.cheer.until = 0;
  }

  function runCheerCommand(text) {
    const parts = String(text || "").trim().split(/\s+/).filter(Boolean);
    const command = String(parts[0] || "").replace(/^\/+/, "").toLowerCase();
    if (command && command !== "cheer") return;
    const arg = String(parts[1] || "").toLowerCase();
    if (arg === "off" || arg === "stop") {
      stopCheer();
      return;
    }
    startCheer(arg ? clampCheerSeconds(arg) : CHEER_DEFAULT_SEC);
  }

  function updateCheerStick(stick, side, wave, lift, pulse) {
    const dir = side === "left" ? -1 : 1;
    stick.group.traverse((obj) => {
      obj.visible = true;
    });
    stick.group.position.set(dir * (0.49 + wave * 0.035), 0.66 + lift, 0.17);
    stick.group.rotation.set(0.48 + Math.abs(wave) * 0.14, 0.08 * dir, dir * 0.36 + wave * 0.62);
    stick.glow.material.opacity = 0.18 + pulse * 0.18;
    stick.core.material.opacity = 0.72 + pulse * 0.24;
    stick.tip.material.opacity = 0.42 + pulse * 0.38;
    stick.group.scale.setScalar(1 + pulse * 0.08);
  }

  function updateCheer(now) {
    const rig = character.userData.cheer;
    const arms = character.userData.arms;
    if (!rig || !arms) return false;
    arms.left.rotation.copy(arms.leftBase);
    arms.right.rotation.copy(arms.rightBase);
    if ((rig.until || 0) <= now) {
      rig.left.group.visible = false;
      rig.right.group.visible = false;
      return false;
    }
    const wave = Math.sin(now * 0.018);
    const bounce = Math.sin(now * 0.027);
    const pulse = 0.5 + Math.sin(now * 0.042) * 0.5;
    arms.left.rotation.set(0.34 + bounce * 0.08, 0.02, -1.08 + wave * 0.48);
    arms.right.rotation.set(0.34 - bounce * 0.08, -0.02, 1.08 + wave * 0.48);
    updateCheerStick(rig.left, "left", wave, 0.02 + Math.abs(wave) * 0.05, pulse);
    updateCheerStick(rig.right, "right", wave, 0.02 + Math.abs(wave) * 0.05, 1 - pulse * 0.7);
    return true;
  }

  function clearEffects() {
    for (const effect of state.effects) {
      scene.remove(effect.group);
      effect.group.traverse((obj) => {
        obj.geometry?.dispose?.();
        obj.material?.dispose?.();
      });
    }
    state.effects = [];
  }

  const character = makeCharacter();
  const clawRig = createClawRig();
  const clawTargets = [
    new THREE.Vector3(1.45, 0, 1.1),
    new THREE.Vector3(1.15, 0, -1.22),
    new THREE.Vector3(-1.55, 0, -1.05),
    new THREE.Vector3(-1.35, 0, 1.3),
  ];

  function setPlaceStatus(text) {
    const el = document.getElementById("place-state");
    if (el) el.textContent = text;
  }

  function updateClawRigPose(worldX, worldZ, headY, close, pulse = 0, metrics = characterClawMetrics()) {
    const topY = 3.38;
    const cableLength = Math.max(0.16, topY - headY);
    clawRig.root.visible = true;
    clawRig.root.position.set(worldX, topY, worldZ);
    clawRig.cable.position.y = -cableLength / 2;
    clawRig.cable.scale.set(1, cableLength, 1);
    clawRig.head.position.y = -cableLength;
    clawRig.grabRing.position.set(0, -cableLength - 0.4, 0);
    clawRig.grabRing.visible = close > 0.08;
    clawRig.grabRing.scale.setScalar(0.62 + close * 0.28 + Math.sin(pulse) * 0.02);
    clawRig.grabRing.material.opacity = (0.08 + close * 0.2) * (0.8 + Math.sin(pulse * 1.7) * 0.2);
    for (const prong of clawRig.prongs) {
      const angle = prong.userData.angle;
      const hingeY = prong.userData.hingeY;
      const length = prong.userData.fingerLength;
      const bend = lerpValue(0.03, metrics.maxBend, close);
      prong.position.set(Math.cos(angle) * prong.userData.openRadius, 0, Math.sin(angle) * prong.userData.openRadius);
      prong.rotation.set(0, Math.PI / 2 - angle, 0);
      prong.userData.finger.position.set(0, hingeY - Math.cos(bend) * length * 0.5, -Math.sin(bend) * length * 0.5);
      prong.userData.finger.rotation.set(bend, 0, 0);
      prong.userData.tip.position.set(0, hingeY - Math.cos(bend) * length, -Math.sin(bend) * length);
    }
  }

  function startClawPlace() {
    const from = character.position.clone();
    from.y = 0;
    const target = clawTargets[state.placeIndex % clawTargets.length].clone();
    state.placeIndex += 1;
    state.clawMove = {
      start: performance.now(),
      duration: 3700,
      from,
      to: target,
      sway: (Math.random() - 0.5) * 0.7,
      scale: currentCharacterScale(),
    };
    clawRig.target.visible = true;
    clawRig.target.position.set(target.x, 0, target.z);
    setPlaceStatus("target preview");
  }

  function stopClawPlace({ resetPosition = false } = {}) {
    state.clawMove = null;
    clawRig.root.visible = false;
    clawRig.target.visible = false;
    if (resetPosition) {
      character.position.set(-1.35, 0, 1.3);
      character.rotation.y = Math.atan2(-character.position.x, -character.position.z);
    }
    setPlaceStatus("idle");
  }

  function updateClawPlace(now) {
    const move = state.clawMove;
    if (!move) return;
    const t = clamp01((now - move.start) / move.duration);
    const from = move.from;
    const to = move.to;
    const metrics = characterClawMetrics(move.scale);
    const highHeadY = 2.82;
    const grabHeadY = metrics.grabHeadY;
    const carryY = highHeadY - grabHeadY;
    let headY = highHeadY;
    let close = 0;
    let x = from.x;
    let z = from.z;
    let y = 0;
    let status = "arm lowering";

    if (t < 0.2) {
      const p = easeInOut(phase(t, 0.02, 0.2));
      headY = lerpValue(highHeadY, grabHeadY, p);
    } else if (t < 0.32) {
      const p = easeOutCubic(phase(t, 0.2, 0.32));
      headY = grabHeadY + Math.sin(p * Math.PI) * 0.035;
      close = p;
      status = "grab";
    } else if (t < 0.5) {
      const p = easeInOut(phase(t, 0.32, 0.5));
      headY = lerpValue(grabHeadY, highHeadY, p);
      close = 1;
      y = lerpValue(0, carryY, p);
      status = "lift";
    } else if (t < 0.72) {
      const p = easeInOut(phase(t, 0.5, 0.72));
      x = lerpValue(from.x, to.x, p);
      z = lerpValue(from.z, to.z, p);
      const sway = Math.sin((now - move.start) * 0.012 + move.sway);
      y = carryY + Math.abs(sway) * metrics.sway;
      headY = highHeadY + Math.abs(Math.sin((now - move.start) * 0.009)) * 0.012;
      close = 1;
      status = "carry";
    } else if (t < 0.86) {
      const p = easeInOut(phase(t, 0.72, 0.86));
      x = to.x;
      z = to.z;
      y = lerpValue(carryY, 0, p);
      headY = lerpValue(highHeadY, grabHeadY, p);
      close = 1;
      status = "drop";
    } else if (t < 0.94) {
      const p = easeOutCubic(phase(t, 0.86, 0.94));
      x = to.x;
      z = to.z;
      y = Math.sin(p * Math.PI) * metrics.releaseHop;
      headY = grabHeadY;
      close = 1 - p;
      status = "release";
    } else {
      const p = easeOutCubic(phase(t, 0.94, 1));
      x = to.x;
      z = to.z;
      headY = lerpValue(grabHeadY, highHeadY, p);
      close = 0;
      status = "retract";
    }

    const clawX = t < 0.5 ? from.x : (t < 0.72 ? x : to.x);
    const clawZ = t < 0.5 ? from.z : (t < 0.72 ? z : to.z);
    const carryActive = t > 0.32 && t < 0.86;
    const subtleSway = carryActive ? Math.sin(now * 0.014 + move.sway) * 0.028 * Math.max(0.55, metrics.scale) : 0;
    updateClawRigPose(clawX + subtleSway, clawZ, headY, close, now * 0.02, metrics);
    character.position.set(x + subtleSway, y, z);
    character.rotation.y = Math.atan2(-x, -z);
    character.rotation.z = 0;
    const scalePulse = t > 0.2 && t < 0.34 ? 1 - Math.sin(phase(t, 0.2, 0.34) * Math.PI) * 0.045 : 1;
    character.scale.multiplyScalar(scalePulse);
    clawRig.target.position.set(to.x, 0, to.z);
    clawRig.target.scale.setScalar(1 + Math.sin(now * 0.008) * 0.055);
    clawRig.targetRing.material.opacity = 0.28 + Math.sin(now * 0.01) * 0.12;
    setPlaceStatus(status);

    if (t >= 1) {
      character.position.copy(to);
      character.rotation.y = Math.atan2(-to.x, -to.z);
      stopClawPlace();
    }
  }

  function createBeamEffect(kind) {
    const isDown = kind === "down";
    const color = isDown ? cool : warm;
    const group = new THREE.Group();
    group.position.copy(character.position);

    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.52, 0.52, 2.6, 48, 1, true),
      makeAdditiveMaterial(color.clone().lerp(white, 0.45), isDown ? 0.18 : 0.28)
    );
    beam.position.y = 1.25;
    group.add(beam);

    const ringGeo = new THREE.TorusGeometry(0.48, 0.018, 8, 80);
    const ring = new THREE.Mesh(ringGeo, makeAdditiveMaterial(color, 0.72));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.05;
    group.add(ring);

    const particles = [];
    const particleGeo = new THREE.SphereGeometry(0.025, 8, 6);
    for (let i = 0; i < 42; i += 1) {
      const spark = new THREE.Mesh(particleGeo, makeAdditiveMaterial(color.clone().lerp(white, Math.random() * 0.4), 0.95));
      const a = Math.random() * Math.PI * 2;
      const r = 0.16 + Math.random() * 0.44;
      spark.position.set(Math.cos(a) * r, 0.15 + Math.random() * 0.45, Math.sin(a) * r);
      spark.userData.vel = new THREE.Vector3(
        Math.cos(a) * (0.25 + Math.random() * 0.42),
        (isDown ? -0.15 : 0.62) + Math.random() * 0.62,
        Math.sin(a) * (0.25 + Math.random() * 0.42)
      );
      particles.push(spark);
      group.add(spark);
    }

    scene.add(group);
    state.effects.push({
      group,
      type: kind,
      mode: kind === "rings" ? "rings" : "beam",
      start: performance.now(),
      duration: isDown ? 1050 : 1350,
      beam,
      ring,
      particles,
    });
  }

  function trigger(kind) {
    clearEffects();
    const delta = kind === "down" ? -1 : 1;
    state.level = Math.max(0, state.level + delta);
    levelEl.textContent = `Lv. ${state.level}`;
    label.classList.remove("level-pop", "level-drop");
    void label.offsetWidth;
    label.classList.add(kind === "down" ? "level-drop" : "level-pop");
    createBeamEffect(kind);
    character.userData.effectStart = performance.now();
    character.userData.effectKind = kind;
  }

  function fireOrigin() {
    return character.position.clone().add(new THREE.Vector3(0, 0.98, 0));
  }

  function makeSpark(color, radius = 0.032, opacity = 0.96) {
    return new THREE.Mesh(
      new THREE.SphereGeometry(radius, 8, 6),
      makeAdditiveMaterial(color, opacity)
    );
  }

  function spawnBurst(effect, origin, color, count, power, delay = 0, ring = false) {
    for (let i = 0; i < count; i += 1) {
      const spark = makeSpark(color.clone().lerp(white, Math.random() * 0.36), 0.028 + Math.random() * 0.014);
      spark.position.copy(origin);
      const theta = Math.random() * Math.PI * 2;
      const y = ring ? (Math.random() - 0.5) * 0.16 : Math.random() * 1.8 - 0.38;
      const flat = ring ? 1 : Math.sqrt(Math.max(0.12, 1 - Math.min(0.9, y * y * 0.28)));
      spark.userData.birth = effect.start + delay;
      spark.userData.life = 720 + Math.random() * 520;
      spark.userData.origin = origin.clone();
      spark.userData.vel = new THREE.Vector3(
        Math.cos(theta) * flat * power * (0.7 + Math.random() * 0.62),
        y * power + (ring ? 0.14 : 0.32),
        Math.sin(theta) * flat * power * (0.7 + Math.random() * 0.62)
      );
      spark.userData.gravity = ring ? 0.52 : 0.86;
      spark.userData.twinkle = Math.random() * Math.PI * 2;
      spark.visible = delay <= 0;
      effect.group.add(spark);
      effect.particles.push(spark);
    }
  }

  function triggerFireRocket() {
    clearEffects();
    const group = new THREE.Group();
    const color = warm.clone().lerp(white, 0.12);
    const effect = {
      type: "firework",
      variant: "rocket",
      group,
      particles: [],
      start: performance.now(),
      duration: 2600,
      rockets: [],
    };
    const rocketGeo = new THREE.SphereGeometry(0.055, 10, 8);
    const trailGeo = new THREE.CylinderGeometry(0.032, 0.07, 0.58, 10, 1, true);
    for (let i = 0; i < 3; i += 1) {
      const a = -Math.PI / 2 + (i - 1) * 0.56;
      const rocket = new THREE.Group();
      const head = new THREE.Mesh(rocketGeo, makeAdditiveMaterial(color.clone().offsetHSL(i * 0.04, 0.08, 0.04), 0.95));
      const trail = new THREE.Mesh(trailGeo, makeAdditiveMaterial(new THREE.Color(0xffef9c), 0.42));
      trail.position.y = -0.34;
      rocket.add(head, trail);
      rocket.visible = false;
      group.add(rocket);
      effect.rockets.push({
        mesh: rocket,
        head,
        trail,
        delay: i * 190,
        rise: 720 + i * 80,
        start: fireOrigin().add(new THREE.Vector3(Math.cos(a) * 0.08, 0.18, Math.sin(a) * 0.08)),
        end: character.position.clone().add(new THREE.Vector3(Math.cos(a) * (0.62 + i * 0.08), 3.45 + Math.random() * 0.52, Math.sin(a) * (0.62 + i * 0.08))),
        color: color.clone().offsetHSL(i * 0.035, 0.08, 0.03),
        popped: false,
      });
    }
    scene.add(group);
    state.effects.push(effect);
  }

  function triggerFireFountain() {
    clearEffects();
    const group = new THREE.Group();
    group.position.copy(fireOrigin());
    const effect = {
      type: "firework",
      variant: "fountain",
      group,
      particles: [],
      start: performance.now(),
      duration: 2300,
      nextEmit: 0,
    };
    scene.add(group);
    state.effects.push(effect);
  }

  function triggerFireRing() {
    clearEffects();
    const group = new THREE.Group();
    const effect = {
      type: "firework",
      variant: "ring",
      group,
      particles: [],
      start: performance.now(),
      duration: 1500,
    };
    const origin = fireOrigin().add(new THREE.Vector3(0, 1.55, 0));
    spawnBurst(effect, origin, new THREE.Color(0xffd45c), 82, 1.18, 0, true);
    scene.add(group);
    state.effects.push(effect);
  }

  function triggerFireOrbit() {
    clearEffects();
    const popGapMs = orbitPopGapMs();
    const firstPop = 980;
    const popTimes = [firstPop, firstPop + popGapMs, firstPop + popGapMs * 2];
    const group = new THREE.Group();
    group.position.copy(fireOrigin());
    const effect = {
      type: "firework",
      variant: "orbit",
      group,
      particles: [],
      start: performance.now(),
      duration: popTimes[popTimes.length - 1] + 1450,
      orbs: [],
      rings: [],
      popStep: 0,
      popTimes,
    };
    const orbGeo = new THREE.SphereGeometry(0.062, 12, 8);
    for (let i = 0; i < 5; i += 1) {
      const orb = new THREE.Mesh(orbGeo, makeAdditiveMaterial(new THREE.Color(0xffd45c).offsetHSL(i * 0.062, 0.12, 0.05), 0.96));
      group.add(orb);
      effect.orbs.push({ mesh: orb, phase: i * Math.PI * 0.4, radius: 0.54 + i * 0.034 });
    }
    scene.add(group);
    state.effects.push(effect);
  }

  function triggerFireOrbitFinale() {
    clearEffects();
    const group = new THREE.Group();
    group.position.copy(fireOrigin());
    const effect = {
      type: "firework",
      variant: "orbit-finale",
      group,
      particles: [],
      start: performance.now(),
      duration: 3300,
      orbs: [],
      rings: [],
      popStep: 0,
    };
    const orbGeo = new THREE.SphereGeometry(0.062, 12, 8);
    for (let i = 0; i < 6; i += 1) {
      const color = new THREE.Color(0xffd45c).offsetHSL(i * 0.055, 0.12, 0.05);
      const orb = new THREE.Mesh(orbGeo, makeAdditiveMaterial(color, 0.96));
      group.add(orb);
      effect.orbs.push({
        mesh: orb,
        phase: i * Math.PI / 3,
        radius: 0.48 + i * 0.036,
        color,
      });
    }
    scene.add(group);
    state.effects.push(effect);
  }

  function addFlashRing(effect, origin, color, delay = 0) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.18, 0.018, 10, 96),
      makeAdditiveMaterial(color.clone().lerp(white, 0.25), 0.92)
    );
    ring.position.copy(origin);
    ring.rotation.x = Math.PI / 2;
    ring.userData.birth = effect.start + delay;
    ring.userData.life = 620;
    ring.visible = delay <= 0;
    effect.group.add(ring);
    effect.rings.push(ring);
  }

  function updateEffects(now) {
    for (let i = state.effects.length - 1; i >= 0; i -= 1) {
      const effect = state.effects[i];
      const t = Math.min(1, (now - effect.start) / effect.duration);
      const out = easeOutCubic(t);
      const pulse = Math.sin(t * Math.PI);
      if (effect.type === "firework") {
        updateFireEffect(effect, now);
        if (t >= 1) {
          scene.remove(effect.group);
          state.effects.splice(i, 1);
        }
        continue;
      }
      if (effect.mode === "rings") {
        effect.beam.visible = false;
        effect.ring.scale.setScalar(1 + out * 2.9);
        effect.ring.material.opacity = (1 - t) * 0.72;
      } else {
        effect.beam.scale.set(1 + pulse * 0.12, 1, 1 + pulse * 0.12);
        effect.beam.material.opacity = Math.sin(t * Math.PI) * (effect.type === "down" ? 0.22 : 0.36);
        effect.ring.scale.setScalar(1 + out * 2.15);
        effect.ring.material.opacity = (1 - t) * 0.68;
      }
      for (const spark of effect.particles) {
        spark.position.addScaledVector(spark.userData.vel, 0.018);
        spark.material.opacity = Math.max(0, 1 - t) * 0.9;
      }
      if (t >= 1) {
        scene.remove(effect.group);
        state.effects.splice(i, 1);
      }
    }
  }

  function updateFireEffect(effect, now) {
    const age = now - effect.start;
    if (effect.variant === "rocket") {
      for (const rocket of effect.rockets) {
        const local = age - rocket.delay;
        if (local < 0) {
          rocket.mesh.visible = false;
          continue;
        }
        if (local < rocket.rise) {
          const t = Math.min(1, local / rocket.rise);
          rocket.mesh.visible = true;
          rocket.mesh.position.lerpVectors(rocket.start, rocket.end, Math.pow(t, 1.55));
          rocket.trail.material.opacity = (0.4 + t * 0.32) * (1 - Math.max(0, t - 0.82) / 0.18);
          continue;
        }
        rocket.mesh.visible = false;
        if (!rocket.popped) {
          rocket.popped = true;
          spawnBurst(effect, rocket.end, rocket.color, 42, 1.36, age, false);
        }
      }
    }
    if (effect.variant === "fountain") {
      while (effect.nextEmit < age && effect.nextEmit < 1600) {
        for (let i = 0; i < 7; i += 1) {
          const spark = makeSpark(new THREE.Color(0xffb54a).lerp(white, Math.random() * 0.28), 0.026 + Math.random() * 0.012);
          spark.userData.birth = effect.start + effect.nextEmit;
          spark.userData.life = 640 + Math.random() * 420;
          spark.userData.origin = new THREE.Vector3(0, 0, 0);
          const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.25;
          spark.userData.vel = new THREE.Vector3(Math.cos(a) * (0.42 + Math.random() * 0.38), 1.8 + Math.random() * 0.78, Math.sin(a) * (0.42 + Math.random() * 0.38));
          spark.userData.gravity = 1.48;
          spark.userData.twinkle = Math.random() * Math.PI * 2;
          effect.group.add(spark);
          effect.particles.push(spark);
        }
        effect.nextEmit += 85;
      }
    }
    if (effect.variant === "orbit") {
      const t = Math.min(1, age / 940);
      const climb = easeInOut(t);
      for (const orb of effect.orbs) {
        const a = orb.phase + age * 0.0084;
        const r = orb.radius * (1 - climb * 0.42);
        orb.mesh.position.set(
          Math.cos(a) * r,
          0.24 + climb * 2.35 + Math.sin(age * 0.009 + orb.phase) * 0.075,
          Math.sin(a) * r
        );
        orb.mesh.scale.setScalar(1 + Math.sin(age * 0.02 + orb.phase) * 0.22);
        orb.mesh.material.opacity = 0.96 * (1 - Math.max(0, t - 0.86) / 0.14);
      }
      const popTimes = effect.popTimes || [980, 1480, 1980];
      while (effect.popStep < popTimes.length && age >= popTimes[effect.popStep]) {
        const step = effect.popStep;
        const theta = step * Math.PI * 0.72 + 0.35;
        const origin = new THREE.Vector3(
          Math.cos(theta) * (0.2 + step * 0.14),
          2.42 + step * 0.28,
          Math.sin(theta) * (0.2 + step * 0.14)
        );
        const color = new THREE.Color(0xffd45c).offsetHSL(step * 0.085, 0.16, 0.08);
        spawnBurst(effect, origin, color, 118 + step * 24, 1.95 + step * 0.24, age, step === 1);
        spawnBurst(effect, origin.clone().add(new THREE.Vector3(0, 0.08, 0)), color.clone().lerp(white, 0.28), 48, 1.05, age + 110, false);
        effect.popStep += 1;
      }
      if (age > popTimes[popTimes.length - 1] + 220) {
        for (const orb of effect.orbs) orb.mesh.visible = false;
      }
    }
    if (effect.variant === "orbit-finale") {
      const climb = Math.min(1, age / 1350);
      const eased = easeInOut(climb);
      for (const orb of effect.orbs) {
        const a = orb.phase + age * 0.0078;
        const spiral = orb.radius * (1 - eased * 0.36);
        orb.mesh.position.set(
          Math.cos(a) * spiral,
          0.24 + eased * 2.55 + Math.sin(age * 0.007 + orb.phase) * 0.07,
          Math.sin(a) * spiral
        );
        orb.mesh.scale.setScalar(1 + Math.sin(age * 0.017 + orb.phase) * 0.18);
        orb.mesh.material.opacity = 0.96 * (1 - Math.max(0, climb - 0.88) / 0.12);
      }
      const popTimes = [1180, 1450, 1760, 2100];
      while (effect.popStep < popTimes.length && age >= popTimes[effect.popStep]) {
        const step = effect.popStep;
        const theta = step * Math.PI * 0.64 + 0.45;
        const origin = new THREE.Vector3(
          Math.cos(theta) * (0.22 + step * 0.12),
          2.62 + step * 0.22,
          Math.sin(theta) * (0.22 + step * 0.12)
        );
        const color = new THREE.Color(0xffc85c).offsetHSL(step * 0.085, 0.14, 0.05);
        spawnBurst(effect, origin, color, 78 + step * 14, 1.58 + step * 0.18, age, step % 2 === 1);
        addFlashRing(effect, origin, color, age);
        spawnBurst(effect, origin.clone().add(new THREE.Vector3(0, 0.08, 0)), color.clone().lerp(white, 0.22), 28, 0.82, age + 90, false);
        if (step === popTimes.length - 1) {
          const finale = new THREE.Vector3(0, 3.52, 0);
          spawnBurst(effect, finale, new THREE.Color(0xfff0a8), 132, 1.78, age + 90, false);
          addFlashRing(effect, finale, new THREE.Color(0xfff0a8), age + 90);
        }
        effect.popStep += 1;
      }
      if (age > 1750) {
        for (const orb of effect.orbs) orb.mesh.visible = false;
      }
    }
    for (const ring of effect.rings || []) {
      const local = now - ring.userData.birth;
      if (local < 0) {
        ring.visible = false;
        continue;
      }
      ring.visible = true;
      const t = Math.min(1, local / ring.userData.life);
      ring.scale.setScalar(1 + easeOutCubic(t) * 4.6);
      ring.material.opacity = Math.max(0, (1 - t) * 0.92);
    }
    for (const spark of effect.particles) {
      const local = now - spark.userData.birth;
      if (local < 0) {
        spark.visible = false;
        continue;
      }
      spark.visible = true;
      const t = Math.min(1, local / spark.userData.life);
      const sec = local / 1000;
      const v = spark.userData.vel;
      spark.position.set(
        spark.userData.origin.x + v.x * sec,
        spark.userData.origin.y + v.y * sec - spark.userData.gravity * sec * sec,
        spark.userData.origin.z + v.z * sec
      );
      spark.scale.setScalar(1 + t * 0.75);
      spark.material.opacity = Math.max(0, Math.pow(1 - t, 1.35) * (0.78 + Math.sin(now * 0.035 + spark.userData.twinkle) * 0.22));
    }
  }

  function updateCharacter(now) {
    const start = character.userData.effectStart || 0;
    const kind = character.userData.effectKind;
    const age = now - start;
    const baseScale = currentCharacterScale();
    character.position.y = 0;
    character.rotation.z = 0;
    character.scale.setScalar(baseScale);
    for (const obj of character.userData.parts) {
      obj.material.color.copy(obj.material.userData.baseColor);
      if (obj.material.emissive) obj.material.emissive.setHex(0x000000);
    }
    updateCheer(now);
    if (!kind || age > 1050) return;
    const t = Math.min(1, age / 1050);
    if (kind === "down") {
      const shake = Math.sin(t * Math.PI * 16) * (1 - t) * 0.055;
      character.rotation.z = shake;
      character.scale.setScalar(baseScale * (1 - Math.sin(t * Math.PI) * 0.045));
      for (const obj of character.userData.parts) {
        obj.material.color.lerp(cool, Math.sin(t * Math.PI) * 0.32);
      }
    } else {
      const hop = Math.sin(t * Math.PI) * 0.28 * baseScale;
      character.position.y = hop;
      character.scale.setScalar(baseScale * (1 + Math.sin(t * Math.PI) * 0.07));
      for (const obj of character.userData.parts) {
        if (obj.material.emissive) {
          obj.material.emissive.copy(warm);
          obj.material.emissiveIntensity = Math.sin(t * Math.PI) * 0.16;
        }
      }
    }
  }

  function updateCamera() {
    const y = Math.sin(state.pitch) * state.zoom;
    const flat = Math.cos(state.pitch) * state.zoom;
    camera.position.set(
      Math.sin(state.yaw) * flat + state.pan.x,
      y + 0.9 + state.pan.y,
      Math.cos(state.yaw) * flat + state.pan.z
    );
    camera.lookAt(state.pan.x, 0.72 + state.pan.y, state.pan.z);
  }

  function updateLabel() {
    const point = character.position.clone().add(new THREE.Vector3(0, 1.75 * currentCharacterScale(), 0));
    point.project(camera);
    label.style.left = `${(point.x * 0.5 + 0.5) * window.innerWidth}px`;
    label.style.top = `${(-point.y * 0.5 + 0.5) * window.innerHeight}px`;
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function frame(now) {
    resize();
    updateCamera();
    updateCharacter(now);
    updateClawPlace(now);
    updateEffects(now);
    updateLabel();
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  addWorld();
  resize();
  requestAnimationFrame(frame);

  document.getElementById("up-beam").onclick = () => trigger("up");
  document.getElementById("up-rings").onclick = () => trigger("rings");
  document.getElementById("down-dust").onclick = () => trigger("down");
  document.getElementById("fire-rocket").onclick = triggerFireRocket;
  document.getElementById("fire-fountain").onclick = triggerFireFountain;
  document.getElementById("fire-ring").onclick = triggerFireRing;
  document.getElementById("fire-orbit").onclick = triggerFireOrbit;
  document.getElementById("fire-orbit-finale").onclick = triggerFireOrbitFinale;
  document.getElementById("cheer-default").onclick = () => startCheer(CHEER_DEFAULT_SEC);
  document.getElementById("cheer-custom").onclick = () => startCheer(cheerSecondsInput());
  document.getElementById("cheer-off").onclick = stopCheer;
  document.getElementById("cheer-command-run").onclick = () => runCheerCommand(document.getElementById("cheer-command")?.value);
  document.getElementById("cheer-command").addEventListener("keydown", (ev) => {
    if (ev.key !== "Enter") return;
    runCheerCommand(ev.currentTarget.value);
  });
  function setCharacterScale(scale) {
    state.characterScale = Math.max(0.28, Math.min(1.15, Number(scale) || 1));
    stopClawPlace();
    document.querySelectorAll(".scale-preset").forEach((button) => {
      button.classList.toggle("active", Math.abs(Number(button.dataset.scale) - state.characterScale) < 0.001);
    });
    setPlaceStatus(`scale ${state.characterScale.toFixed(2)}`);
  }
  document.querySelectorAll(".scale-preset").forEach((button) => {
    button.addEventListener("click", () => setCharacterScale(button.dataset.scale));
  });
  document.getElementById("place-claw").onclick = startClawPlace;
  document.getElementById("reset").onclick = () => {
    clearEffects();
    stopCheer();
    stopClawPlace({ resetPosition: true });
    setCharacterScale(1);
    state.level = 1;
    levelEl.textContent = "Lv. 1";
  };

  let loopTimer = 0;
  document.getElementById("loop").addEventListener("change", (ev) => {
    clearInterval(loopTimer);
    if (!ev.target.checked) return;
    let i = 0;
    loopTimer = setInterval(() => {
      trigger(["up", "rings", "down"][i % 3]);
      i += 1;
    }, 1800);
  });

  window.addEventListener("keydown", (ev) => {
    if (ev.key.toLowerCase() === "q") state.yaw -= 0.05;
    if (ev.key.toLowerCase() === "e") state.yaw += 0.05;
    if (ev.key.toLowerCase() === "w") state.pitch = Math.min(1.22, state.pitch + 0.04);
    if (ev.key.toLowerCase() === "s") state.pitch = Math.max(0.34, state.pitch - 0.04);
  });
  window.addEventListener("wheel", (ev) => {
    state.zoom = Math.max(3.6, Math.min(9.5, state.zoom + Math.sign(ev.deltaY) * 0.25));
  }, { passive: true });
  window.addEventListener("pointerdown", (ev) => {
    if (ev.button !== 1) return;
    state.drag = { x: ev.clientX, y: ev.clientY, pan: state.pan.clone() };
  });
  window.addEventListener("pointermove", (ev) => {
    if (!state.drag) return;
    const dx = (ev.clientX - state.drag.x) / 180;
    const dz = (ev.clientY - state.drag.y) / 180;
    const right = new THREE.Vector3(Math.cos(state.yaw), 0, -Math.sin(state.yaw));
    const forward = new THREE.Vector3(Math.sin(state.yaw), 0, Math.cos(state.yaw));
    state.pan.copy(state.drag.pan).addScaledVector(right, -dx).addScaledVector(forward, dz);
  });
  window.addEventListener("pointerup", () => {
    state.drag = null;
  });
})();
