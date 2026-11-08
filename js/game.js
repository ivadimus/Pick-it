(function () {
  const PRIZES = [
    { id: 0, src: "Assets/SKU.png" },
    { id: 1, src: "Assets/SKU-1.png" },
    { id: 2, src: "Assets/SKU-2.png" },
    { id: 3, src: "Assets/SKU-3.png" },
    { id: 4, src: "Assets/SKU-4.png" },
    { id: 5, src: "Assets/SKU-5.png" },
    { id: 6, src: "Assets/SKU-6.png" },
    { id: 7, src: "Assets/SKU-7.png" },
  ];

  /** Petard file number (1.png … 8.png) → image after prize vanishes */
  const PETARD_SPECIAL_REWARD = {
    1: "Assets/Sam.png",
    2: "Assets/Mia.png",
    3: "Assets/Oscar.png",
    4: "Assets/Sanny.png",
    5: "Assets/Peggy.png",
    6: "Assets/Hoppy.png",
    7: "Assets/Carrie.png",
    8: "Assets/Mole.png",
  };

  function petardNumberFromImg(cubeImg) {
    const file = (cubeImg.src.split("/").pop() || "").split("?")[0];
    const num = parseInt(file, 10);
    return Number.isFinite(num) ? num : null;
  }

  function specialRewardForPetard(cubeImg) {
    const num = petardNumberFromImg(cubeImg);
    return num ? PETARD_SPECIAL_REWARD[num] || null : null;
  }

  /** Unique color + burst shape per petard 1–8 */
  const FIREWORK_PROFILES = {
    1: {
      primary: "#5cff5c",
      secondary: "#ffe566",
      accent: "#ffffff",
      shape: "circle",
    },
    2: {
      primary: "#ff4db8",
      secondary: "#ffb3e6",
      accent: "#fff0fa",
      shape: "star",
    },
    3: {
      primary: "#ff8c2a",
      secondary: "#ff4500",
      accent: "#ffd4a8",
      shape: "cross",
    },
    4: {
      primary: "#3ee8d6",
      secondary: "#ff6eb4",
      accent: "#e0ffff",
      shape: "ring",
    },
    5: {
      primary: "#4da6ff",
      secondary: "#ffd633",
      accent: "#ffffff",
      shape: "spiral",
    },
    6: {
      primary: "#b8ff3d",
      secondary: "#ff4757",
      accent: "#f5ffe0",
      shape: "diamond",
    },
    7: {
      primary: "#ff3355",
      secondary: "#ffc14d",
      accent: "#ffe0e8",
      shape: "heart",
    },
    8: {
      primary: "#b57bff",
      secondary: "#e8d4ff",
      accent: "#ffffff",
      shape: "willow",
    },
  };

  /** Petards 1–8.png left → right (slot index = file number − 1) */
  const PETARDS = [
    "Assets/1.png",
    "Assets/2.png",
    "Assets/3.png",
    "Assets/4.png",
    "Assets/5.png",
    "Assets/6.png",
    "Assets/7.png",
    "Assets/8.png",
  ];

  /** 1→8 left to right, arc heights; x compressed toward center */
  const SLOT_LAYOUT = [
    { x: 16, y: 63, rotate: 12 },
    { x: 28, y: 33, rotate: 11 },
    { x: 32, y: 62, rotate: 10 },
    { x: 44, y: 40, rotate: 8 },
    { x: 51, y: 64, rotate: 5 },
    { x: 64, y: 38, rotate: 8 },
    { x: 74, y: 59, rotate: -11 },
    { x: 88, y: 42, rotate: -14 },
  ];

  /**
   * Bottom fan spawn positions (0 = left off-screen … 1 = right off-screen), petard 1→8.
   * Matches sketch: #1 diagonal from left, #2–#3 clustered, #4–#5 center V, edges fan outward.
   */
  const PETARD_FAN_SPAWN_T = [0.18, 0.26, 0.3, 0.46, 0.48, 0.55, 0.74, 0.86];

  const field = document.getElementById("field");
  const prizePanelItems = document.getElementById("prizePanelItems");
  const energyValue = document.getElementById("energyValue");
  const handPointer = document.getElementById("handPointer");
  const vfxLayer = document.getElementById("vfxLayer");
  const gameCompleteOverlay = document.getElementById("gameCompleteOverlay");
  const gameCompleteRestart = document.getElementById("gameCompleteRestart");

  let energy = 8;
  let slots = [];
  let canPick = false;
  let picking = false;
  let handTargetSlot = null;
  let handAnimTimer = null;
  let showHandOnFirstPick = true;
  let idleHintDelayTimer = null;
  let idleHintEndTimer = null;
  let gameCompleteOverlayTimer = null;
  let stageBorderFireworksInterval = null;
  let stageBorderFireworksEndTimer = null;

  const IDLE_WAIT_MS = 2000;
  const IDLE_ANIM_MS = 1000;
  const GAME_COMPLETE_OVERLAY_DELAY_MS = 2000;
  const STAGE_BORDER_FIREWORK_INTERVAL_MS = 165;
  const PETARD_FLY_IN_MS = 1000;

  function wait(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function waitForStageLayout() {
    return new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
  }

  function restartPetardFloat(cubeImg) {
    if (!cubeImg) return;
    cubeImg.style.animation = "none";
    void cubeImg.offsetWidth;
    cubeImg.style.animation = "";
  }

  function shuffleArray(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function buildPanel() {
    prizePanelItems.innerHTML = "";
    PRIZES.forEach((p) => {
      const el = document.createElement("div");
      el.className = "panel-prize";
      el.dataset.prizeId = String(p.id);
      el.dataset.prizeSrc = p.src;

      const img = document.createElement("img");
      img.className = "panel-prize-img";
      img.src = p.src;
      img.alt = "";

      const done = document.createElement("img");
      done.className = "panel-prize-done";
      done.src = "Assets/Done.png";
      done.alt = "";

      el.appendChild(img);
      el.appendChild(done);
      prizePanelItems.appendChild(el);
    });
  }

  function markPanelPrizeClaimed(prize) {
    if (!prize) return;
    const panelItem = prizePanelItems.querySelector(
      `.panel-prize[data-prize-src="${prize.src}"]`
    );
    if (panelItem && !panelItem.classList.contains("claimed")) {
      panelItem.classList.add("claimed");
    }
  }

  function buildField(prizeOrder) {
    field.innerHTML = "";
    slots = prizeOrder.map((prizeId, index) => {
      const pos = SLOT_LAYOUT[index];
      const prize = PRIZES.find((p) => p.id === prizeId);

      const slot = document.createElement("div");
      slot.className = "slot intro-hidden";
      slot.style.left = pos.x + "%";
      slot.style.top = pos.y + "%";
      slot.dataset.index = String(index);
      slot.dataset.prizeId = String(prizeId);

      const inner = document.createElement("div");
      inner.className = "slot-inner";
      inner.style.setProperty("--slot-tilt", `${pos.rotate}deg`);

      const prizeImg = document.createElement("img");
      prizeImg.className = "prize";
      prizeImg.src = prize.src;
      prizeImg.alt = "";

      const cubeImg = document.createElement("img");
      cubeImg.className = "cube petard";
      cubeImg.src = PETARDS[index];
      cubeImg.alt = "";
      cubeImg.style.opacity = "0";
      cubeImg.style.setProperty("--float-delay", (-Math.random() * 3.5).toFixed(2) + "s");
      cubeImg.style.setProperty(
        "--float-dur",
        (2.35 + Math.random() * 1.35).toFixed(2) + "s"
      );

      const doneImg = document.createElement("img");
      doneImg.className = "done";
      doneImg.src = "Assets/Done.png";
      doneImg.alt = "";
      doneImg.style.opacity = "0";

      inner.appendChild(prizeImg);
      inner.appendChild(cubeImg);
      inner.appendChild(doneImg);
      slot.appendChild(inner);
      field.appendChild(slot);

      cubeImg.addEventListener("click", () => onCubeClick(index));

      return {
        el: slot,
        inner,
        prizeImg,
        cubeImg,
        doneImg,
        prizeId,
        layoutX: pos.x,
        layoutY: pos.y,
        layoutRotate: pos.rotate,
        opened: false,
        index,
      };
    });
  }

  function applySlotLayout(slot) {
    slot.el.style.left = slot.layoutX + "%";
    slot.el.style.top = slot.layoutY + "%";
    slot.inner.style.setProperty("--slot-tilt", `${slot.layoutRotate}deg`);
    slot.inner.style.transform = `rotate(${slot.layoutRotate}deg)`;
  }

  function setEnergy(n) {
    energy = n;
    energyValue.textContent = String(n);
  }

  function showGameCompleteOverlay() {
    if (!gameCompleteOverlay) return;
    const stage = document.getElementById("stage");
    if (stage) stage.classList.add("stage--game-complete");
    gameCompleteOverlay.classList.add("is-visible");
    gameCompleteOverlay.setAttribute("aria-hidden", "false");
  }

  function clearGameCompleteOverlayTimer() {
    if (gameCompleteOverlayTimer !== null) {
      clearTimeout(gameCompleteOverlayTimer);
      gameCompleteOverlayTimer = null;
    }
  }

  function clearStageBorderFireworks() {
    if (stageBorderFireworksInterval !== null) {
      clearInterval(stageBorderFireworksInterval);
      stageBorderFireworksInterval = null;
    }
    if (stageBorderFireworksEndTimer !== null) {
      clearTimeout(stageBorderFireworksEndTimer);
      stageBorderFireworksEndTimer = null;
    }
  }

  function spawnRandomStageBorderBurst() {
    const stage = document.getElementById("stage");
    if (!stage) return;

    const w = stage.offsetWidth;
    const h = stage.offsetHeight;
    const padX = w * 0.055;
    const padY = h * 0.07;
    const r = Math.random();
    let x;
    let y;
    if (r < 0.25) {
      x = padX + Math.random() * Math.max(0, w - 2 * padX);
      y = padY;
    } else if (r < 0.5) {
      x = padX + Math.random() * Math.max(0, w - 2 * padX);
      y = h - padY;
    } else if (r < 0.75) {
      x = padX;
      y = padY + Math.random() * Math.max(0, h - 2 * padY);
    } else {
      x = w - padX;
      y = padY + Math.random() * Math.max(0, h - 2 * padY);
    }

    const fakeCube = document.createElement("img");
    fakeCube.src = PETARDS[Math.floor(Math.random() * PETARDS.length)];
    playPetardFirework(x, y, fakeCube);
  }

  function startStageBorderFireworks(durationMs) {
    clearStageBorderFireworks();
    spawnRandomStageBorderBurst();
    stageBorderFireworksInterval = setInterval(
      spawnRandomStageBorderBurst,
      STAGE_BORDER_FIREWORK_INTERVAL_MS
    );
    stageBorderFireworksEndTimer = setTimeout(() => {
      clearStageBorderFireworks();
    }, durationMs);
  }

  function scheduleGameCompleteOverlay() {
    clearGameCompleteOverlayTimer();
    startStageBorderFireworks(GAME_COMPLETE_OVERLAY_DELAY_MS);
    gameCompleteOverlayTimer = setTimeout(() => {
      gameCompleteOverlayTimer = null;
      showGameCompleteOverlay();
    }, GAME_COMPLETE_OVERLAY_DELAY_MS);
  }

  function hideGameCompleteOverlay() {
    if (!gameCompleteOverlay) return;
    clearGameCompleteOverlayTimer();
    clearStageBorderFireworks();
    const stage = document.getElementById("stage");
    if (stage) stage.classList.remove("stage--game-complete");
    gameCompleteOverlay.classList.remove("is-visible");
    gameCompleteOverlay.setAttribute("aria-hidden", "true");
  }

  async function restartGame() {
    hideGameCompleteOverlay();
    clearStageBorderFireworks();
    clearIdleHintTimers();
    hideHand();
    vfxLayer.innerHTML = "";
    setEnergy(8);
    canPick = false;
    picking = false;
    showHandOnFirstPick = true;
    await runIntro();
  }

  function showIntroStep(name) {
    document.querySelectorAll(`[data-intro="${name}"]`).forEach((el) => {
      el.classList.remove("intro-hidden");
      if (name === "panel") {
        el.classList.add("visible");
        void el.offsetWidth;
      }
      if (name === "info") {
        el.classList.remove("info-intro-swing-done", "dropped");
        el.style.top = "";
        const swing = el.querySelector(".info-swing");
        if (swing) {
          swing.classList.remove("info-user-swing");
          swing.style.animation = "";
        }
        void el.offsetWidth;
        el.classList.add("dropped");
      }
      if (name === "meter") el.classList.add("visible");
    });
  }

  function showPrizeAndInfoPanels() {
    showIntroStep("panel");
    showIntroStep("info");
  }

  /** Bottom fan spawn X (stage %); see PETARD_FAN_SPAWN_T — straight flight to each slot. */
  function getPetardSpawnPercents(count) {
    const stage = document.getElementById("stage");
    const panel = document.querySelector(".prize-panel-wrap");

    function fallbackFan(n) {
      return Array.from({ length: n }, (_, i) => {
        const t = PETARD_FAN_SPAWN_T[i] ?? (n <= 1 ? 0 : i / (n - 1));
        return { x: -22 + t * 144, y: 92 };
      });
    }

    if (!stage || count < 1) return fallbackFan(count || 8);

    const stageRect = stage.getBoundingClientRect();
    if (stageRect.width < 1 || stageRect.height < 1) return fallbackFan(count);

    let panelLeftPct = 12;
    let panelRightPct = 88;
    let spawnYPct = 92;

    if (panel && !panel.classList.contains("intro-hidden")) {
      const pr = panel.getBoundingClientRect();
      panelLeftPct = ((pr.left - stageRect.left) / stageRect.width) * 100;
      panelRightPct = ((pr.right - stageRect.left) / stageRect.width) * 100;
      spawnYPct = Math.min(
        98,
        ((pr.bottom - stageRect.top + pr.height * 0.06) / stageRect.height) * 100
      );
    }

    const panelSpan = Math.max(panelRightPct - panelLeftPct, 20);
    const offPct = Math.max(18, panelSpan * 0.34);
    const xStart = panelLeftPct - offPct;
    const xEnd = panelRightPct + offPct;

    return Array.from({ length: count }, (_, i) => {
      const t = PETARD_FAN_SPAWN_T[i] ?? (count <= 1 ? 0 : i / (count - 1));
      return {
        x: xStart + t * (xEnd - xStart),
        y: spawnYPct,
      };
    });
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function finalizePetardLanding() {
    slots.forEach((s) => {
      s.el.style.left = s.layoutX + "%";
      s.el.style.top = s.layoutY + "%";
      s.el.classList.remove("petard-fly-in", "intro-hidden", "disabled", "opening");
      s.el.classList.remove("pickable", "idle-hint", "waiting-first-pick");
      restartPetardFloat(s.cubeImg);
    });
  }

  function flyPetardsFromPanel() {
    const spawns = getPetardSpawnPercents(slots.length);

    slots.forEach((s, i) => {
      const spawn = spawns[i] || spawns[0];
      s.prizeImg.style.opacity = "0";
      s.prizeImg.style.visibility = "hidden";
      s.cubeImg.style.opacity = "1";
      s.cubeImg.style.visibility = "visible";
      s.inner.style.transform = `rotate(${s.layoutRotate}deg)`;
      s.el.style.left = spawn.x + "%";
      s.el.style.top = spawn.y + "%";
      s.el.classList.remove("intro-hidden");
      s.el.classList.add("petard-fly-in");
    });

    const tracks = slots.map((s, i) => {
      const spawn = spawns[i] || spawns[0];
      return {
        slot: s,
        S: { x: spawn.x, y: spawn.y },
        T: { x: s.layoutX, y: s.layoutY },
      };
    });

    return new Promise((resolve) => {
      const t0 = performance.now();
      let finished = false;
      let rafId = null;

      function completeLanding() {
        if (finished) return;
        finished = true;
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        finalizePetardLanding();
        resolve();
      }

      function frame(now) {
        if (finished) return;

        const elapsed = now - t0;
        const raw = Math.min(1, elapsed / PETARD_FLY_IN_MS);
        const u = easeOutCubic(raw);

        tracks.forEach(({ slot, S, T }) => {
          slot.el.style.left = S.x + (T.x - S.x) * u + "%";
          slot.el.style.top = S.y + (T.y - S.y) * u + "%";
        });

        if (raw < 1) {
          rafId = requestAnimationFrame(frame);
        } else {
          completeLanding();
        }
      }

      rafId = requestAnimationFrame(frame);
      setTimeout(completeLanding, PETARD_FLY_IN_MS + 200);
    });
  }

  function slotCenterOnStage(slotEl) {
    const stage = document.getElementById("stage");
    if (!stage) return { x: 0, y: 0 };

    const stageRect = stage.getBoundingClientRect();
    const slotRect = slotEl.getBoundingClientRect();
    const scaleX = stage.offsetWidth ? stageRect.width / stage.offsetWidth : 1;
    const scaleY = stage.offsetHeight ? stageRect.height / stage.offsetHeight : 1;

    return {
      x: (slotRect.left + slotRect.width / 2 - stageRect.left) / scaleX,
      y: (slotRect.top + slotRect.height / 2 - stageRect.top) / scaleY,
    };
  }

  function spawnFireworkParticle(x, y, tx, ty, color, shape, size, duration, motion) {
    const p = document.createElement("div");
    p.className = "vfx-fw-particle shape-" + shape;
    if (motion === "willow") p.classList.add("motion-willow");
    if (motion === "ember") p.classList.add("motion-ember");
    p.style.left = x + "px";
    p.style.top = y + "px";
    p.style.setProperty("--tx", tx + "px");
    p.style.setProperty("--ty", ty + "px");
    p.style.setProperty("--dur", duration + "ms");
    p.style.setProperty("--sz", size + "px");
    p.style.setProperty("--c", color);
    vfxLayer.appendChild(p);
    setTimeout(() => p.remove(), duration + 80);
  }

  function spawnFireworkCrackle(x, y, colors, count, spread) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = spread * (0.25 + Math.random() * 1.05);
      spawnFireworkParticle(
        x,
        y,
        Math.cos(angle) * dist,
        Math.sin(angle) * dist,
        colors[i % colors.length],
        Math.random() > 0.55 ? "streak" : "circle",
        3 + Math.random() * 7,
        520 + Math.random() * 680,
        "ember"
      );
    }
  }

  function spawnFireworkBurst(x, y, profile, opts) {
    const spreadScale = opts && opts.spreadScale != null ? opts.spreadScale : 1;
    const colors = [profile.primary, profile.secondary, profile.accent];
    const shape = profile.shape;
    const baseDur = shape === "willow" ? 1450 : 1150;
    const spread = (shape === "willow" ? 188 : 228) * spreadScale;

    if (shape === "circle") {
      for (let i = 0; i < 78; i++) {
        const angle = (Math.PI * 2 * i) / 36 + Math.random() * 0.2;
        const dist = spread * (0.55 + Math.random() * 0.85);
        spawnFireworkParticle(
          x,
          y,
          Math.cos(angle) * dist,
          Math.sin(angle) * dist,
          colors[i % 3],
          "circle",
          10 + Math.random() * 16,
          baseDur,
          "burst"
        );
      }
      return;
    }

    if (shape === "star") {
      for (let arm = 0; arm < 5; arm++) {
        const angle = -Math.PI / 2 + (Math.PI * 2 * arm) / 5;
        for (let step = 1; step <= 8; step++) {
          const dist = spread * (0.25 + step * 0.2);
          spawnFireworkParticle(
            x,
            y,
            Math.cos(angle) * dist,
            Math.sin(angle) * dist,
            colors[step % 3],
            "star",
            11 + step * 2.5,
            baseDur,
            "burst"
          );
        }
      }
      for (let i = 0; i < 36; i++) {
        const angle = (Math.PI * 2 * i) / 36;
        const dist = spread * (0.35 + Math.random() * 0.55);
        spawnFireworkParticle(
          x,
          y,
          Math.cos(angle) * dist,
          Math.sin(angle) * dist,
          colors[i % 3],
          "star",
          6 + Math.random() * 8,
          baseDur * 0.9,
          "ember"
        );
      }
      return;
    }

    if (shape === "cross") {
      for (let i = 0; i < 4; i++) {
        const angle = (Math.PI / 2) * i;
        for (let step = 1; step <= 10; step++) {
          const dist = spread * (0.2 + step * 0.18);
          spawnFireworkParticle(
            x,
            y,
            Math.cos(angle) * dist,
            Math.sin(angle) * dist,
            colors[i % 3],
            "streak",
            7 + Math.random() * 8,
            baseDur,
            "burst"
          );
        }
      }
      for (let i = 0; i < 4; i++) {
        const angle = Math.PI / 4 + (Math.PI / 2) * i;
        for (let step = 1; step <= 6; step++) {
          const dist = spread * (0.15 + step * 0.14);
          spawnFireworkParticle(
            x,
            y,
            Math.cos(angle) * dist,
            Math.sin(angle) * dist,
            colors[i % 3],
            "streak",
            5 + Math.random() * 5,
            baseDur,
            "ember"
          );
        }
      }
      return;
    }

    if (shape === "ring") {
      for (let i = 0; i < 58; i++) {
        const angle = (Math.PI * 2 * i) / 28;
        const dist = spread * 0.72;
        spawnFireworkParticle(
          x,
          y,
          Math.cos(angle) * dist,
          Math.sin(angle) * dist,
          colors[i % 3],
          "ring",
          10 + Math.random() * 10,
          baseDur,
          "burst"
        );
      }
      for (let ring = 0; ring < 2; ring++) {
        for (let i = 0; i < 24; i++) {
          const angle = (Math.PI * 2 * i) / 24;
          const dist = spread * (0.48 + ring * 0.28);
          spawnFireworkParticle(
            x,
            y,
            Math.cos(angle) * dist,
            Math.sin(angle) * dist,
            colors[(i + ring) % 3],
            "circle",
            6 + Math.random() * 6,
            baseDur * 0.85,
            "ember"
          );
        }
      }
      return;
    }

    if (shape === "spiral") {
      for (let i = 0; i < 72; i++) {
        const angle = i * 0.62;
        const dist = spread * (0.15 + (i / 32) * 0.85);
        spawnFireworkParticle(
          x,
          y,
          Math.cos(angle) * dist,
          Math.sin(angle) * dist,
          colors[i % 3],
          "diamond",
          8 + Math.random() * 12,
          baseDur,
          "burst"
        );
      }
      return;
    }

    if (shape === "diamond") {
      for (let i = 0; i < 4; i++) {
        const angle = Math.PI / 4 + (Math.PI / 2) * i;
        for (let step = 1; step <= 8; step++) {
          const dist = spread * (0.22 + step * 0.2);
          spawnFireworkParticle(
            x,
            y,
            Math.cos(angle) * dist,
            Math.sin(angle) * dist,
            colors[step % 3],
            "diamond",
            10 + Math.random() * 10,
            baseDur,
            "burst"
          );
        }
      }
      return;
    }

    if (shape === "heart") {
      for (let i = 0; i < 54; i++) {
        const t = (Math.PI * 2 * i) / 26;
        const hx = 16 * Math.pow(Math.sin(t), 3);
        const hy =
          -(13 * Math.cos(t) -
            5 * Math.cos(2 * t) -
            2 * Math.cos(3 * t) -
            Math.cos(4 * t));
        const scale = spread / 22;
        spawnFireworkParticle(
          x,
          y,
          hx * scale,
          hy * scale,
          colors[i % 3],
          "circle",
          9 + Math.random() * 9,
          baseDur,
          "burst"
        );
      }
      return;
    }

    if (shape === "willow") {
      for (let i = 0; i < 52; i++) {
        const angle = (Math.PI * 2 * i) / 24 + (Math.random() - 0.5) * 0.35;
        const dist = spread * (0.45 + Math.random() * 0.55);
        spawnFireworkParticle(
          x,
          y,
          Math.cos(angle) * dist,
          Math.sin(angle) * dist * 0.35,
          colors[i % 3],
          "streak",
          6 + Math.random() * 8,
          baseDur,
          "willow"
        );
      }
      spawnFireworkCrackle(x, y, colors, 45, spread * 0.85);
    }
  }

  function playPetardFirework(x, y, cubeImg) {
    const num = petardNumberFromImg(cubeImg) || 1;
    const profile = FIREWORK_PROFILES[num] || FIREWORK_PROFILES[1];
    const palette = [profile.primary, profile.secondary, profile.accent];

    const burst = document.createElement("div");
    burst.className = "vfx-burst vfx-fw-burst";
    burst.style.left = x + "px";
    burst.style.top = y + "px";

    const flash = document.createElement("div");
    flash.className = "vfx-fw-flash";
    flash.style.setProperty("--fw-primary", profile.primary);
    flash.style.setProperty("--fw-secondary", profile.secondary);

    const core = document.createElement("div");
    core.className = "vfx-fw-core";
    core.style.setProperty("--fw-primary", profile.primary);

    const smoke = document.createElement("div");
    smoke.className = "vfx-fw-smoke";

    const raysWrap = document.createElement("div");
    raysWrap.className = "vfx-rays-wrap";
    const rays = document.createElement("div");
    rays.className = "vfx-fw-rays";
    rays.style.setProperty("--fw-primary", profile.primary);
    rays.style.setProperty("--fw-secondary", profile.secondary);
    const rays2 = document.createElement("div");
    rays2.className = "vfx-fw-rays vfx-fw-rays-outer";
    rays2.style.setProperty("--fw-primary", profile.secondary);
    rays2.style.setProperty("--fw-secondary", profile.primary);
    raysWrap.appendChild(rays);
    raysWrap.appendChild(rays2);

    burst.appendChild(flash);
    burst.appendChild(core);
    burst.appendChild(smoke);
    burst.appendChild(raysWrap);
    vfxLayer.appendChild(burst);

    spawnFireworkBurst(x, y, profile);
    spawnFireworkCrackle(x, y, palette, 95, 240);

    setTimeout(() => {
      spawnFireworkBurst(x, y, profile, { spreadScale: 0.52 });
      spawnFireworkCrackle(x, y, palette, 55, 165);
    }, 110);

    setTimeout(() => {
      spawnFireworkCrackle(x, y, palette, 40, 200);
    }, 280);

    setTimeout(() => burst.remove(), 2100);
  }

  function playCharacterRevealSparkles(x, y) {
    const colors = ["#ffffff", "#ffe566", "#ffd700", "#fff8dc", "#ffb347", "#a8e6ff"];
    spawnSparkles(x, y, 52, 82, 920, colors);
    spawnSparkles(x, y, 40, 52, 760, colors);
    spawnSparkles(x, y, 36, 68, 840, colors);
    setTimeout(() => spawnSparkles(x, y, 32, 48, 700, colors), 120);
    setTimeout(() => spawnSparkles(x, y, 28, 62, 780, colors), 280);
    setTimeout(() => spawnSparkles(x, y, 24, 40, 650, colors), 480);
  }

  function attachCharacterAmbientSparkles(slot) {
    const inner = slot.inner;
    if (!inner) return;

    const existing = inner.querySelector(".character-sparkle-ring");
    if (existing) existing.remove();

    const ring = document.createElement("div");
    ring.className = "character-sparkle-ring";
    ring.setAttribute("aria-hidden", "true");

    const count = 22;
    for (let i = 0; i < count; i++) {
      const sp = document.createElement("span");
      sp.className = "char-ambient-spark";
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.55;
      const radiusX = 28 + Math.random() * 38;
      const radiusY = 18 + Math.random() * 32;
      sp.style.setProperty("--orbit-x", Math.cos(angle) * radiusX + "px");
      sp.style.setProperty("--orbit-y", Math.sin(angle) * radiusY + "px");
      sp.style.setProperty("--tw-dur", 2.2 + Math.random() * 2.8 + "s");
      sp.style.setProperty("--tw-delay", Math.random() * -6 + "s");
      sp.style.setProperty(
        "--tw-c",
        ["#fff", "#ffe566", "#ffd700", "#fff8dc"][i % 4]
      );
      ring.appendChild(sp);
    }

    inner.appendChild(ring);
  }

  function spawnSparkles(x, y, count, spread, duration, colors) {
    for (let i = 0; i < count; i++) {
      const sp = document.createElement("div");
      sp.className = "vfx-spark";
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const dist = spread * (0.6 + Math.random() * 0.8);
      sp.style.left = x + "px";
      sp.style.top = y + "px";
      sp.style.setProperty("--tx", Math.cos(angle) * dist + "px");
      sp.style.setProperty("--ty", Math.sin(angle) * dist + "px");
      sp.style.setProperty("--dur", duration + "ms");
      sp.style.setProperty("--sz", 10 + Math.random() * 16 + "px");
      sp.style.setProperty("--c", colors[i % colors.length]);
      vfxLayer.appendChild(sp);
      setTimeout(() => sp.remove(), duration + 50);
    }
  }

  function playOpenMagic(x, y) {
    const burst = document.createElement("div");
    burst.className = "vfx-burst";
    burst.style.left = x + "px";
    burst.style.top = y + "px";

    const flash = document.createElement("div");
    flash.className = "vfx-flash";

    const raysWrap = document.createElement("div");
    raysWrap.className = "vfx-rays-wrap";
    const raysPrimary = document.createElement("div");
    raysPrimary.className = "vfx-rays vfx-rays-primary";
    const raysSecondary = document.createElement("div");
    raysSecondary.className = "vfx-rays vfx-rays-secondary";
    const raysCore = document.createElement("div");
    raysCore.className = "vfx-rays-core";
    raysWrap.appendChild(raysPrimary);
    raysWrap.appendChild(raysSecondary);
    raysWrap.appendChild(raysCore);

    burst.appendChild(flash);
    burst.appendChild(raysWrap);
    vfxLayer.appendChild(burst);

    const colors = ["#fff", "#ffe566", "#ffb347", "#a8e6ff", "#ff9ef1"];
    spawnSparkles(x, y, 44, 115, 750, colors);
    spawnSparkles(x, y, 32, 70, 550, colors);
    spawnSparkles(x, y, 20, 40, 450, colors);

    setTimeout(() => burst.remove(), 1150);
  }

  function playVanishSparkles(x, y) {
    const colors = ["#fff", "#ffd700", "#ffec8b", "#ffffff"];
    spawnSparkles(x, y, 38, 95, 620, colors);
    spawnSparkles(x, y, 28, 55, 480, colors);
  }

  function positionHandOnSlot(slot) {
    const c = slotCenterOnStage(slot.el);
    handPointer.style.left = c.x + "px";
    handPointer.style.top = c.y + "px";
  }

  function hideHand() {
    handPointer.classList.remove("visible", "tapping");
    if (handAnimTimer) {
      clearInterval(handAnimTimer);
      handAnimTimer = null;
    }
    handTargetSlot = null;
  }

  function showHandOnSlot(slotIndex) {
    const slot = slots[slotIndex];
    if (!slot || slot.opened) return;
    handTargetSlot = slotIndex;
    handPointer.classList.remove("intro-hidden");
    positionHandOnSlot(slot);
    handPointer.classList.add("visible", "tapping");
    updatePickableSlots();

    handAnimTimer = setInterval(() => {
      if (handTargetSlot === null) return;
      const target = slots[handTargetSlot];
      if (target && !target.opened) positionHandOnSlot(target);
    }, 100);
  }

  function pickHintSlotIndex() {
    const open = slots.filter((s) => !s.opened);
    if (!open.length) return null;
    return open[Math.floor(Math.random() * open.length)].index;
  }

  function clearIdleHintAnimation() {
    slots.forEach((s) => s.el.classList.remove("idle-hint"));
  }

  function clearIdleHintTimers() {
    if (idleHintDelayTimer) {
      clearTimeout(idleHintDelayTimer);
      idleHintDelayTimer = null;
    }
    if (idleHintEndTimer) {
      clearTimeout(idleHintEndTimer);
      idleHintEndTimer = null;
    }
    clearIdleHintAnimation();
  }

  function canScheduleIdleHint() {
    return canPick && !picking && energy > 0 && slots.some((s) => !s.opened);
  }

  function isHandHintActive() {
    return (
      showHandOnFirstPick &&
      handTargetSlot !== null &&
      handPointer &&
      handPointer.classList.contains("visible")
    );
  }

  function updatePickableSlots() {
    slots.forEach((s) => {
      s.el.classList.remove("waiting-first-pick");

      if (s.opened) {
        s.el.classList.remove("pickable", "idle-hint");
        s.el.classList.add("disabled");
        return;
      }
      if (!canPick) {
        s.el.classList.remove("pickable", "idle-hint");
        s.el.classList.add("disabled");
        return;
      }
      if (picking) {
        s.el.classList.remove("pickable", "idle-hint");
        s.el.classList.remove("disabled");
        return;
      }
      if (isHandHintActive()) {
        if (s.index === handTargetSlot) {
          s.el.classList.add("pickable");
          s.el.classList.remove("disabled", "idle-hint");
        } else {
          s.el.classList.remove("pickable", "idle-hint", "disabled");
          s.el.classList.add("waiting-first-pick");
        }
        return;
      }
      s.el.classList.add("pickable");
      s.el.classList.remove("disabled");
    });
  }

  function scheduleIdleHint() {
    clearIdleHintTimers();
    if (showHandOnFirstPick) return;
    if (!canScheduleIdleHint()) return;

    idleHintDelayTimer = setTimeout(() => {
      idleHintDelayTimer = null;
      if (!canScheduleIdleHint()) return;

      slots.forEach((s) => {
        if (!s.opened) s.el.classList.add("idle-hint");
      });

      idleHintEndTimer = setTimeout(() => {
        idleHintEndTimer = null;
        clearIdleHintAnimation();
        scheduleIdleHint();
      }, IDLE_ANIM_MS);
    }, IDLE_WAIT_MS);
  }

  function resetIdleHintSchedule() {
    clearIdleHintTimers();
    scheduleIdleHint();
  }

  function enablePicking() {
    canPick = true;
    picking = false;
    finalizePetardLanding();
    if (showHandOnFirstPick) {
      const hint = pickHintSlotIndex();
      if (hint !== null) {
        requestAnimationFrame(() => showHandOnSlot(hint));
      } else {
        updatePickableSlots();
      }
    } else {
      updatePickableSlots();
    }
    scheduleIdleHint();
  }

  function disablePicking() {
    canPick = false;
    clearIdleHintTimers();
    slots.forEach((s) => {
      s.el.classList.remove("pickable", "idle-hint");
      if (!s.opened) s.el.classList.add("disabled");
    });
  }

  async function onCubeClick(index) {
    if (!canPick || picking || energy <= 0) return;
    if (isHandHintActive() && index !== handTargetSlot) return;

    const slot = slots[index];
    if (!slot || slot.opened) return;

    picking = true;
    showHandOnFirstPick = false;
    updatePickableSlots();
    hideHand();
    clearIdleHintTimers();

    const center = slotCenterOnStage(slot.el);
    const prize = PRIZES.find((p) => p.id === slot.prizeId);

    slot.el.classList.add("opening");
    slot.cubeImg.style.opacity = "0";
    slot.cubeImg.style.visibility = "hidden";
    playPetardFirework(center.x, center.y, slot.cubeImg);

    await wait(720);

    const fly = document.createElement("img");
    fly.className = "reveal-prize";
    fly.src = prize.src;
    fly.alt = "";
    fly.style.left = center.x + "px";
    fly.style.top = center.y + "px";
    vfxLayer.appendChild(fly);

    await wait(650);

    playVanishSparkles(center.x, center.y - 20);
    fly.classList.add("vanish");

    await wait(520);

    fly.remove();

    const specialReward = specialRewardForPetard(slot.cubeImg);
    if (specialReward) {
      slot.doneImg.src = specialReward;
      slot.doneImg.style.opacity = "1";
      slot.el.classList.add("show-special-reward");
      if (specialReward.includes("Sam.png")) {
        slot.el.classList.add("reward-sam");
      }
      if (specialReward.includes("Mia.png")) {
        slot.el.classList.add("reward-mia");
      }
      if (specialReward.includes("Hoppy.png")) {
        slot.el.classList.add("reward-hoppy");
      }
      if (specialReward.includes("Oscar.png")) {
        slot.el.classList.add("reward-oscar");
      }
      if (specialReward.includes("Peggy.png")) {
        slot.el.classList.add("reward-peggy");
      }
      if (specialReward.includes("Mole.png")) {
        slot.el.classList.add("reward-mole");
      }
      if (specialReward.includes("Sanny.png")) {
        slot.el.classList.add("reward-sanny");
      }
      const charCenter = slotCenterOnStage(slot.el);
      playCharacterRevealSparkles(charCenter.x, charCenter.y);
      attachCharacterAmbientSparkles(slot);
    }

    slot.opened = true;
    slot.el.classList.remove("pickable");
    slot.el.classList.add("disabled");

    markPanelPrizeClaimed(prize);

    setEnergy(energy - 1);

    picking = false;

    if (energy > 0 && slots.some((s) => !s.opened)) {
      updatePickableSlots();
      resetIdleHintSchedule();
    } else {
      disablePicking();
      hideHand();
      if (energy === 0) scheduleGameCompleteOverlay();
    }
  }

  async function finishIntroUi() {
    finalizePetardLanding();
    showPrizeAndInfoPanels();
    showIntroStep("header");
    await wait(400);
    enablePicking();
  }

  async function runIntro() {
    buildPanel();
    const prizeOrder = shuffleArray(PRIZES.map((p) => p.id));
    buildField(prizeOrder);

    await waitForStageLayout();

    try {
      await flyPetardsFromPanel();
    } catch (err) {
      console.error("runIntro flyPetards failed", err);
    }

    await finishIntroUi();
  }

  function reflowStageUi() {
    if (handTargetSlot !== null) {
      const target = slots[handTargetSlot];
      if (target && !target.opened) positionHandOnSlot(target);
    }
  }

  window.addEventListener("resize", reflowStageUi);

  function initInfoPanelSwing() {
    const wrap = document.querySelector('[data-intro="info"]');
    if (!wrap) return;
    const swingEl = wrap.querySelector(".info-swing");
    if (!swingEl) return;

    const INTRO_SWING_TOTAL_MS = 850 + 2200 * 2;
    let introSwingTimer = null;

    function scheduleIntroSwingEnd() {
      if (introSwingTimer !== null) clearTimeout(introSwingTimer);
      wrap.classList.remove("info-intro-swing-done");
      introSwingTimer = setTimeout(() => {
        introSwingTimer = null;
        if (!wrap.classList.contains("dropped")) return;
        wrap.classList.add("info-intro-swing-done");
        if (!swingEl.classList.contains("info-user-swing")) {
          swingEl.style.animation = "none";
        }
      }, INTRO_SWING_TOTAL_MS);
    }

    const dropObserver = new MutationObserver(() => {
      if (wrap.classList.contains("dropped")) scheduleIntroSwingEnd();
    });
    dropObserver.observe(wrap, {
      attributes: true,
      attributeFilter: ["class"],
    });
    if (wrap.classList.contains("dropped")) scheduleIntroSwingEnd();

    function playUserSwing() {
      if (!wrap.classList.contains("dropped")) return;
      swingEl.classList.remove("info-user-swing");
      swingEl.style.animation = "none";
      void swingEl.offsetWidth;
      swingEl.style.animation = "";
      swingEl.classList.add("info-user-swing");
    }

    swingEl.addEventListener("animationend", (e) => {
      if (e.target !== swingEl || e.animationName !== "infoSwing") return;
      if (swingEl.classList.contains("info-user-swing")) {
        swingEl.classList.remove("info-user-swing");
        swingEl.style.animation = "";
      }
    });

    wrap.addEventListener("click", playUserSwing);
    swingEl.addEventListener("click", (ev) => {
      ev.stopPropagation();
      playUserSwing();
    });
  }

  function initStars() {
    const layer = document.getElementById("starsLayer");
    if (!layer) return;

    const count = 64;
    for (let i = 0; i < count; i++) {
      const star = document.createElement("span");
      star.className = "star-twinkle" + (Math.random() > 0.65 ? " star-soft" : "");
      star.style.setProperty("--star-x", Math.random() * 100 + "%");
      star.style.setProperty("--star-y", Math.random() * 72 + "%");
      star.style.setProperty("--star-sz", 1 + Math.random() * 2.8 + "px");
      star.style.setProperty("--star-dur", 1.2 + Math.random() * 2.6 + "s");
      star.style.setProperty("--star-delay", Math.random() * -8 + "s");
      star.style.setProperty("--star-dim", 0.32 + Math.random() * 0.5);
      layer.appendChild(star);
    }
  }

  function initSnow() {
    const layer = document.getElementById("snowLayer");
    if (!layer) return;

    const count = 44;
    for (let i = 0; i < count; i++) {
      const flake = document.createElement("span");
      flake.className =
        "snowflake " + (Math.random() > 0.12 ? "shape-flake" : "shape-dot");
      flake.style.setProperty("--snow-x", Math.random() * 100 + "%");
      flake.style.setProperty(
        "--snow-sz",
        (1.85 + Math.random() * 3.35).toFixed(2) + "px"
      );
      flake.style.setProperty("--snow-dur", 14 + Math.random() * 14 + "s");
      flake.style.setProperty("--snow-delay", Math.random() * -12 + "s");
      flake.style.setProperty("--snow-drift", -18 + Math.random() * 36 + "px");
      flake.style.setProperty("--snow-opacity", 0.25 + Math.random() * 0.5);
      layer.appendChild(flake);
    }
  }

  function initGameCompleteOverlay() {
    if (!gameCompleteRestart) return;
    gameCompleteRestart.addEventListener("click", () => {
      restartGame();
    });
  }

  function initForcedLandscape() {
    const app = document.getElementById("app");
    if (!app) return;

    const touchUi = window.matchMedia("(hover: none) and (pointer: coarse)");

    function update() {
      const portrait = window.innerHeight > window.innerWidth;
      const force = touchUi.matches && portrait;
      document.body.classList.toggle("force-landscape", force);
      if (force) {
        app.style.width = `${window.innerHeight}px`;
        app.style.height = `${window.innerWidth}px`;
      } else {
        app.style.width = "";
        app.style.height = "";
      }
      requestAnimationFrame(() => {
        if (typeof reflowStageUi === "function") reflowStageUi();
      });
    }

    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", () => setTimeout(update, 150));
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", update);
    }
    update();
  }

  initForcedLandscape();
  initGameCompleteOverlay();
  initInfoPanelSwing();
  initStars();
  initSnow();
  waitForStageLayout()
    .then(() => runIntro())
    .catch((err) => {
      console.error("runIntro failed", err);
      if (typeof finishIntroUi === "function") {
        finishIntroUi();
      }
    });
})();
