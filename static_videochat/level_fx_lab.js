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
  };

  const warm = new THREE.Color(0xffd45c);
  const cool = new THREE.Color(0x7fb6ff);
  const white = new THREE.Color(0xffffff);

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function easeInOut(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
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
    character.position.y = 0;
    character.rotation.z = 0;
    character.scale.setScalar(1);
    for (const obj of character.userData.parts) {
      obj.material.color.copy(obj.material.userData.baseColor);
      if (obj.material.emissive) obj.material.emissive.setHex(0x000000);
    }
    if (!kind || age > 1050) return;
    const t = Math.min(1, age / 1050);
    if (kind === "down") {
      const shake = Math.sin(t * Math.PI * 16) * (1 - t) * 0.055;
      character.rotation.z = shake;
      character.scale.setScalar(1 - Math.sin(t * Math.PI) * 0.045);
      for (const obj of character.userData.parts) {
        obj.material.color.lerp(cool, Math.sin(t * Math.PI) * 0.32);
      }
    } else {
      const hop = Math.sin(t * Math.PI) * 0.28;
      character.position.y = hop;
      character.scale.setScalar(1 + Math.sin(t * Math.PI) * 0.07);
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
    const point = character.position.clone().add(new THREE.Vector3(0, 1.75, 0));
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
  document.getElementById("reset").onclick = () => {
    clearEffects();
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
