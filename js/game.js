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
    1: "Assets/web-characters/Sam.png",
    2: "Assets/web-characters/Mia.png",
    3: "Assets/web-characters/Sanny.png",
    4: "Assets/web-characters/Oscar.png",
    5: "Assets/web-characters/Peggy.png",
    6: "Assets/web-characters/Hoppy.png",
    7: "Assets/web-characters/Carrie.png",
    8: "Assets/web-characters/Mole.png",
  };

  function petardNumberFromImg(cubeImg) {
    const file = (cubeImg.src.split("/").pop() || "").split("?")[0];
    const num = parseInt(file, 10);
    return Number.isFinite(num) ? num : null;
  }

  /** Bump when character PNGs change (GitHub Pages / browser cache). */
  const REWARD_ASSET_V = "web-chars5";

  function assetWithCacheBust(path) {
    if (!path) return path;
    const sep = path.includes("?") ? "&" : "?";
    return `${path}${sep}v=${REWARD_ASSET_V}`;
  }

  function specialRewardForPetard(cubeImg) {
    const num = petardNumberFromImg(cubeImg);
    return num ? PETARD_SPECIAL_REWARD[num] || null : null;
  }

  /** Unique palette + burst style per petard 1–8 (matches 1.png … 8.png) */
  const FIREWORK_PROFILES = {
    1: {
      primary: "#4dff7a",
      secondary: "#c6ff3d",
      accent: "#e8fff0",
      style: "peony",
      label: "lime",
    },
    2: {
      primary: "#ff28a8",
      secondary: "#ff70d8",
      accent: "#ffe0f4",
      style: "peony",
      label: "magenta",
    },
    3: {
      primary: "#ff9a18",
      secondary: "#ff5c28",
      accent: "#ffe8cc",
      style: "peony",
      label: "orange",
    },
    4: {
      primary: "#2ee8ff",
      secondary: "#4ca8ff",
      accent: "#d4f8ff",
      style: "peony",
      label: "cyan",
    },
    5: {
      primary: "#ffe838",
      secondary: "#fff06a",
      accent: "#fffde8",
      style: "sparkle",
      label: "yellow",
    },
    6: {
      primary: "#3888ff",
      secondary: "#5ce8ff",
      accent: "#dceeff",
      style: "peony",
      label: "blue",
    },
    7: {
      primary: "#ff3d58",
      secondary: "#ff8a48",
      accent: "#ffe0d8",
      style: "peony",
      label: "coral",
    },
    8: {
      primary: "#9048ff",
      secondary: "#d098ff",
      accent: "#f0e4ff",
      style: "willow",
      label: "violet",
    },
  };

  /** Prize panel slot index 0–7 → same scale as field character (petard 1–8). */
  const PANEL_REWARD_CLASS = [
    "reward-sam",
    "reward-mia",
    "reward-sanny",
    "reward-oscar",
    "reward-peggy",
    "reward-hoppy",
    "reward-carrie",
    "reward-mole",
  ];

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
    { x: 25, y: 74, rotate: 12 },
    { x: 33, y: 27, rotate: 11 },
    { x: 40, y: 73, rotate: 10 },
    { x: 49, y: 24, rotate: 8 },
    { x: 53, y: 71, rotate: 5 },
    { x: 62, y: 23, rotate: 8 },
    { x: 69, y: 70, rotate: -11 },
    { x: 77, y: 22, rotate: -14 },
  ];

  /**
   * Bottom fan spawn positions (0 = left off-screen … 1 = right off-screen), petard 1→8.
   * Matches sketch: #1 diagonal from left, #2–#3 clustered, #4–#5 center V, edges fan outward.
   */
  const PETARD_FAN_SPAWN_T = [0.22, 0.33, 0.41, 0.47, 0.5, 0.55, 0.61, 0.68];
  /** Petard file index (1-based) → fixed spawn X (% of stage); 5 = screen center */
  const PETARD_SPAWN_X_PCT = { 5: 50 };

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

  function anySlotOpening() {
    return slots.some((s) => s.opening);
  }
  let handTargetSlot = null;
  let handAnimTimer = null;
  let showHandOnFirstPick = true;
  let idleHintDelayTimer = null;
  let idleHintEndTimer = null;
  let gameCompleteOverlayTimer = null;
  let stageBorderFireworksInterval = null;
  let stageBorderFireworksEndTimer = null;
  let scheduleInfoIntroSwingEnd = null;

  const IDLE_WAIT_MS = 2000;
  const IDLE_ANIM_MS = 1000;
  const GAME_COMPLETE_OVERLAY_DELAY_MS = 2000;
  const FW_SPEED_MUL = 1.55;
  const STAGE_BORDER_FIREWORK_INTERVAL_MS = Math.round(520 / FW_SPEED_MUL);
  const STAGE_BORDER_FIREWORK_SPREAD = 0.72;
  const FW_MAX_PARTICLES = 220;
  const FW_SPREAD_MUL = 0.72;
  const FW_PARTICLE_SIZE_MUL = 1.38;
  const FW_PETARD_BURST_SCALE = 1.52;
  const PETARD_FLY_IN_MS = 1000;

  let fwCanvas = null;
  let fwCtx = null;
  let fwParticles = [];
  let fwHazes = [];
  let fwRafId = null;

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
      const rewardClass = PANEL_REWARD_CLASS[p.id];
      el.className = rewardClass ? `panel-prize ${rewardClass}` : "panel-prize";
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

      inner.appendChild(prizeImg);
      inner.appendChild(cubeImg);
      slot.appendChild(inner);
      field.appendChild(slot);

      cubeImg.addEventListener("click", () => onCubeClick(index));

      return {
        el: slot,
        inner,
        prizeImg,
        cubeImg,
        doneImg: null,
        prizeId,
        layoutX: pos.x,
        layoutY: pos.y,
        layoutRotate: pos.rotate,
        opened: false,
        opening: false,
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
    const leftSide = Math.random() < 0.5;
    const x = leftSide ? padX : w - padX;
    const y = padY + Math.random() * Math.max(0, h - 2 * padY);

    const fakeCube = document.createElement("img");
    fakeCube.src = PETARDS[Math.floor(Math.random() * PETARDS.length)];
    playStageFinaleFirework(x, y, fakeCube);
  }

  /** Softer bursts along the stage border (game complete). */
  function playStageFinaleFirework(x, y, cubeImg) {
    const num = petardNumberFromImg(cubeImg) || 1;
    const { palette, style } = fireworkPaletteForPetard(num);
    playRealisticFirework(x, y, palette, {
      scale: 0.76 * STAGE_BORDER_FIREWORK_SPREAD,
      style,
    });
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
    resetFireworkCanvas();
    if (vfxLayer) vfxLayer.innerHTML = "";
    setEnergy(8);
    canPick = false;
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
        if (typeof scheduleInfoIntroSwingEnd === "function") {
          scheduleInfoIntroSwingEnd();
        }
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
        const petardNum = i + 1;
        const fixedX = PETARD_SPAWN_X_PCT[petardNum];
        if (fixedX != null) return { x: fixedX, y: 92 };
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

    if (panel) {
      const pr = panel.getBoundingClientRect();
      if (pr.width > 1 && pr.height > 1) {
        panelLeftPct = ((pr.left - stageRect.left) / stageRect.width) * 100;
        panelRightPct = ((pr.right - stageRect.left) / stageRect.width) * 100;
      }
    }

    const panelSpan = Math.max(panelRightPct - panelLeftPct, 20);
    const offPct = Math.max(18, panelSpan * 0.34);
    const xStart = panelLeftPct - offPct;
    const xEnd = panelRightPct + offPct;

    return Array.from({ length: count }, (_, i) => {
      const petardNum = i + 1;
      const fixedX = PETARD_SPAWN_X_PCT[petardNum];
      if (fixedX != null) {
        return { x: fixedX, y: spawnYPct };
      }
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

  function snapPetardsToLayout(options = {}) {
    const { settling = false, clearSettling = false } = options;
    slots.forEach((s) => {
      s.el.style.left = s.layoutX + "%";
      s.el.style.top = s.layoutY + "%";
      s.el.classList.remove("petard-fly-in", "intro-hidden", "disabled", "opening");
      s.el.classList.remove("pickable", "idle-hint", "waiting-first-pick");
      if (settling) s.el.classList.add("petard-settling");
      if (clearSettling) s.el.classList.remove("petard-settling");
    });
  }

  function beginPetardIdleMotion() {
    slots.forEach((s) => {
      if (s.opened || s.el.classList.contains("disabled")) return;
      restartPetardFloat(s.cubeImg);
    });
  }

  function finalizePetardLanding() {
    snapPetardsToLayout({ clearSettling: true });
    beginPetardIdleMotion();
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
        snapPetardsToLayout({ settling: true });
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

  /** Bottom-center of SKU area in stage px (aligned with img.prize baseline). */
  function slotSkuRevealPoint(slotEl) {
    const stage = document.getElementById("stage");
    if (!stage) return { x: 0, y: 0 };

    const inner = slotEl.querySelector(".slot-inner");
    const ref = inner || slotEl;
    const stageRect = stage.getBoundingClientRect();
    const refRect = ref.getBoundingClientRect();
    const scaleX = stage.offsetWidth ? stageRect.width / stage.offsetWidth : 1;
    const scaleY = stage.offsetHeight ? stageRect.height / stage.offsetHeight : 1;
    const skuBottom =
      parseFloat(getComputedStyle(slotEl).getPropertyValue("--slot-sku-bottom")) || 0;

    return {
      x: (refRect.left + refRect.width / 2 - stageRect.left) / scaleX,
      y: (refRect.bottom - stageRect.top) / scaleY - skuBottom / scaleY,
    };
  }

  function resetFireworkCanvas() {
    fwParticles = [];
    fwHazes = [];
    if (fwRafId !== null) {
      cancelAnimationFrame(fwRafId);
      fwRafId = null;
    }
    fwCanvas = null;
    fwCtx = null;
  }

  function fwHexRgb(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "#ffffff");
    if (!m) return { r: 255, g: 255, b: 255 };
    return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
  }

  function fwMixRgb(a, b, t) {
    return {
      r: Math.round(a.r + (b.r - a.r) * t),
      g: Math.round(a.g + (b.g - a.g) * t),
      b: Math.round(a.b + (b.b - a.b) * t),
    };
  }

  function ensureFireworkCanvas() {
    if (!vfxLayer) return null;
    if (!fwCanvas) {
      fwCanvas = document.createElement("canvas");
      fwCanvas.className = "vfx-fw-canvas";
      fwCanvas.setAttribute("aria-hidden", "true");
      vfxLayer.appendChild(fwCanvas);
    }
    syncFireworkCanvasSize();
    if (!fwCtx) fwCtx = fwCanvas.getContext("2d");
    return fwCtx;
  }

  function syncFireworkCanvasSize() {
    const stage = document.getElementById("stage");
    if (!stage || !fwCanvas) return;
    const w = stage.offsetWidth || 1;
    const h = stage.offsetHeight || 1;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    fwCanvas.width = Math.max(1, Math.floor(w * dpr));
    fwCanvas.height = Math.max(1, Math.floor(h * dpr));
    fwCanvas.style.width = w + "px";
    fwCanvas.style.height = h + "px";
    if (fwCtx) fwCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function fwPushParticle(p) {
    if (fwParticles.length >= FW_MAX_PARTICLES) fwParticles.shift();
    fwParticles.push(p);
    startFireworkLoop();
  }

  function fwPushHaze(h) {
    fwHazes.push(h);
    startFireworkLoop();
  }

  function startFireworkLoop() {
    if (fwRafId !== null) return;
    fwRafId = requestAnimationFrame(stepFireworkCanvas);
  }

  function stepFireworkCanvas() {
    const ctx = ensureFireworkCanvas();
    if (!ctx) {
      fwRafId = null;
      return;
    }
    syncFireworkCanvasSize();
    const stage = document.getElementById("stage");
    const w = stage ? stage.offsetWidth : 0;
    const h = stage ? stage.offsetHeight : 0;
    ctx.clearRect(0, 0, w, h);

    fwHazes = fwHazes.filter((hz) => {
      hz.life -= FW_SPEED_MUL;
      if (hz.life <= 0) return false;
      const t = hz.life / hz.maxLife;
      const alpha = hz.alpha * t;
      const g = ctx.createRadialGradient(hz.x, hz.y, 0, hz.x, hz.y, hz.radius);
      g.addColorStop(0, `rgba(255,255,255,${Math.min(1, alpha * 1.25)})`);
      g.addColorStop(0.1, `rgba(${hz.r},${hz.g},${hz.b},${alpha * 1.05})`);
      g.addColorStop(0.38, `rgba(${hz.r},${hz.g},${hz.b},${alpha * 0.58})`);
      g.addColorStop(1, `rgba(${hz.r},${hz.g},${hz.b},0)`);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(hz.x, hz.y, hz.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return true;
    });

    fwParticles = fwParticles.filter((p) => {
      p.px = p.x;
      p.py = p.y;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.vy += p.gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.life -= FW_SPEED_MUL;
      if (p.life <= 0) return false;

      const lifeT = 1 - p.life / p.maxLife;
      const white = { r: 255, g: 255, b: 255 };
      const tint = fwMixRgb(white, { r: p.r, g: p.g, b: p.b }, Math.min(1, 0.25 + lifeT * 0.95));
      const alpha = Math.min(1, (p.life / p.maxLife) * p.peak);

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const glow =
        (p.glow || 1) * (p.kind === "streak" ? 28 : 22) * FW_PARTICLE_SIZE_MUL;
      ctx.shadowBlur = glow;
      ctx.shadowColor = `rgba(${tint.r},${tint.g},${tint.b},${Math.min(1, alpha * 1.15)})`;

      if (p.kind === "streak") {
        ctx.strokeStyle = `rgba(${tint.r},${tint.g},${tint.b},${alpha})`;
        ctx.lineWidth = Math.max(
          1.05,
          p.size * (0.55 + alpha * 0.95) * FW_PARTICLE_SIZE_MUL
        );
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(p.px, p.py);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      } else {
        ctx.fillStyle = `rgba(${tint.r},${tint.g},${tint.b},${alpha})`;
        ctx.beginPath();
        ctx.arc(
          p.x,
          p.y,
          Math.max(0.65, p.size * (0.62 + alpha * 0.55) * FW_PARTICLE_SIZE_MUL),
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
      ctx.restore();
      return true;
    });

    if (fwParticles.length || fwHazes.length) {
      fwRafId = requestAnimationFrame(stepFireworkCanvas);
    } else {
      fwRafId = null;
    }
  }

  function fwAddLaunchTrail(x, y, palette, scale) {
    const c0 = fwHexRgb(palette[0]);
    const c1 = fwHexRgb(palette[1]);
    for (let s = 0; s < 3; s++) {
      const startX = x + (Math.random() - 0.5) * 48 * scale;
      const startY = y + (48 + Math.random() * 36) * scale;
      for (let i = 0; i < 7; i++) {
        const t = i / 7;
        const curve = Math.sin(t * Math.PI) * 18 * scale;
        const px = startX + (x - startX) * t + curve;
        const py = startY + (y - startY) * t;
        const col = i % 2 === 0 ? c0 : c1;
        fwPushParticle({
          x: px,
          y: py,
          px,
          py,
          vx: (Math.random() - 0.5) * 0.35,
          vy: -0.6 - Math.random() * 0.8,
          life: 22 + i * 2,
          maxLife: 24 + i * 2,
          r: col.r,
          g: col.g,
          b: col.b,
          size: (1.1 + Math.random() * 0.8) * FW_PARTICLE_SIZE_MUL,
          drag: 0.98,
          gravity: 0.02,
          peak: 0.95,
          kind: "dot",
        });
      }
    }
  }

  function fwEmitBurst(x, y, palette, opts) {
    if (!vfxLayer) return;
    const ctx = ensureFireworkCanvas();
    if (!ctx) return;

    const scale = opts && opts.scale != null ? opts.scale : 1;
    const spreadMul =
      opts && opts.spreadMul != null ? opts.spreadMul : FW_SPREAD_MUL;
    const style = (opts && opts.style) || "peony";
    const c0 = fwHexRgb(palette[0]);
    const c1 = fwHexRgb(palette[1]);
    const c2 = fwHexRgb(palette[2] || palette[1]);

    fwPushHaze({
      x,
      y,
      life: 38,
      maxLife: 38,
      r: c0.r,
      g: c0.g,
      b: c0.b,
      radius: 118 * scale * spreadMul,
      alpha: 0.98,
    });
    fwPushHaze({
      x,
      y,
      life: 54,
      maxLife: 54,
      r: c1.r,
      g: c1.g,
      b: c1.b,
      radius: 188 * scale * spreadMul,
      alpha: 0.58,
    });
    fwPushHaze({
      x,
      y,
      life: 62,
      maxLife: 62,
      r: c2.r,
      g: c2.g,
      b: c2.b,
      radius: 248 * scale * spreadMul,
      alpha: 0.34,
    });

    fwAddLaunchTrail(x, y, palette, scale);

    let streaks = Math.round(40 * scale);
    let dots = Math.round(30 * scale);
    if (style === "sparkle") {
      streaks = Math.round(26 * scale);
      dots = Math.round(42 * scale);
    }
    if (style === "willow") {
      streaks = Math.round(34 * scale);
      dots = Math.round(26 * scale);
    }

    for (let i = 0; i < streaks; i++) {
      const angle = (Math.PI * 2 * i) / streaks + (Math.random() - 0.5) * 0.11;
      const speed =
        (4.2 + Math.random() * 6.2) * scale * FW_SPEED_MUL * spreadMul;
      let vx = Math.cos(angle) * speed;
      let vy = Math.sin(angle) * speed - 0.65 * scale * FW_SPEED_MUL * spreadMul;
      if (style === "willow" && vy < 0) vy *= 0.35;
      const col = i % 3 === 0 ? c0 : i % 3 === 1 ? c1 : c2;
      fwPushParticle({
        x,
        y,
        px: x,
        py: y,
        vx,
        vy,
        life: 52 + Math.floor(Math.random() * 20),
        maxLife: 64,
        r: col.r,
        g: col.g,
        b: col.b,
        size:
          (1.55 + Math.random() * 1.25) *
          Math.min(1.35, 0.85 + scale * 0.22) *
          FW_PARTICLE_SIZE_MUL,
        glow: 1.22,
        drag: style === "willow" ? 0.965 : 0.972,
        gravity: style === "willow" ? 0.11 : 0.085,
        peak: 1,
        kind: "streak",
      });
    }

    for (let i = 0; i < dots; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed =
        (2.4 + Math.random() * 4.2) * scale * FW_SPEED_MUL * spreadMul;
      const pick = Math.random();
      const col = pick < 0.34 ? c0 : pick < 0.67 ? c1 : c2;
      fwPushParticle({
        x,
        y,
        px: x,
        py: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.4 * scale * spreadMul,
        life: 38 + Math.floor(Math.random() * 26),
        maxLife: 60,
        r: col.r,
        g: col.g,
        b: col.b,
        size:
          (1 + Math.random() * 1.55) *
          Math.min(1.3, 0.88 + scale * 0.2) *
          FW_PARTICLE_SIZE_MUL,
        drag: 0.976,
        gravity: 0.075,
        peak: 0.95,
        glow: 1.18,
        kind: "dot",
      });
    }
  }

  function playRealisticFirework(x, y, palette, opts) {
    const spreadScale = opts && opts.spreadScale != null ? opts.spreadScale : 1;
    const scale =
      (opts && opts.scale != null ? opts.scale : 1) *
      (opts && opts.bloomScale != null ? opts.bloomScale : 1) *
      spreadScale;
    const spreadMul =
      opts && opts.spreadMul != null ? opts.spreadMul : FW_SPREAD_MUL;
    fwEmitBurst(x, y, palette, {
      scale,
      spreadMul,
      style: (opts && opts.style) || "peony",
    });
  }

  function fireworkPaletteForPetard(num) {
    const profile = FIREWORK_PROFILES[num] || FIREWORK_PROFILES[1];
    return {
      palette: [profile.primary, profile.secondary, profile.accent],
      style: profile.style,
    };
  }

  function playPetardFirework(x, y, cubeImg) {
    const num = petardNumberFromImg(cubeImg) || 1;
    const { palette, style } = fireworkPaletteForPetard(num);
    const scaleMul = style === "sparkle" ? 1.08 : style === "willow" ? 1.02 : 1;
    playRealisticFirework(x, y, palette, {
      scale: FW_PETARD_BURST_SCALE * scaleMul,
      spreadScale: 1,
      style,
    });
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

    const count = 14;
    for (let i = 0; i < count; i++) {
      const sp = document.createElement("span");
      sp.className = "char-ambient-spark";
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.35;
      const radiusX = 28 + Math.random() * 38;
      const radiusY = 18 + Math.random() * 32;
      sp.style.setProperty("--orbit-x", Math.cos(angle) * radiusX + "px");
      sp.style.setProperty("--orbit-y", Math.sin(angle) * radiusY + "px");
      sp.style.setProperty("--tw-dur", 4.8 + Math.random() * 3.4 + "s");
      sp.style.setProperty("--tw-delay", Math.random() * -10 + "s");
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

  function playFlashGlitters(x, y) {
    const white = ["#ffffff", "#fffffe", "#f8f9ff", "#fffef5"];
    spawnSparkles(x, y, 20, 46, 520, white);
    spawnSparkles(x, y, 14, 30, 440, white);

    for (let i = 0; i < 18; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 8 + Math.random() * 36;
      const sp = document.createElement("div");
      sp.className = "vfx-spark vfx-spark-glitter";
      sp.style.left = x + Math.cos(angle) * dist + "px";
      sp.style.top = y + Math.sin(angle) * dist + "px";
      sp.style.setProperty("--tx", Math.cos(angle) * (14 + Math.random() * 22) + "px");
      sp.style.setProperty("--ty", Math.sin(angle) * (14 + Math.random() * 22) + "px");
      sp.style.setProperty("--dur", 360 + Math.floor(Math.random() * 220) + "ms");
      sp.style.setProperty("--sz", 4 + Math.random() * 7 + "px");
      sp.style.setProperty("--c", "#ffffff");
      vfxLayer.appendChild(sp);
      setTimeout(() => sp.remove(), 620);
    }
  }

  function playSlotFlash(x, y) {
    if (!vfxLayer) return;
    const flash = document.createElement("div");
    flash.className = "vfx-camera-flash";
    flash.setAttribute("aria-hidden", "true");
    flash.style.left = x + "px";
    flash.style.top = y + "px";
    vfxLayer.appendChild(flash);
    playFlashGlitters(x, y);
    setTimeout(() => flash.remove(), 540);
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
    return (
      canPick &&
      !anySlotOpening() &&
      energy > 0 &&
      slots.some((s) => !s.opened)
    );
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

      if (s.opened || s.opening) {
        s.el.classList.remove("pickable", "idle-hint");
        s.el.classList.add("disabled");
        return;
      }
      if (!canPick) {
        s.el.classList.remove("pickable", "idle-hint");
        s.el.classList.add("disabled");
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
    snapPetardsToLayout({ clearSettling: true });
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
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        beginPetardIdleMotion();
      });
    });
  }

  function disablePicking() {
    canPick = false;
    clearIdleHintTimers();
    slots.forEach((s) => {
      s.el.classList.remove("pickable", "idle-hint");
      if (!s.opened) s.el.classList.add("disabled");
    });
  }

  const REWARD_CLASS_BY_FILE = {
    "Sam.png": "reward-sam",
    "Mia.png": "reward-mia",
    "Hoppy.png": "reward-hoppy",
    "Oscar.png": "reward-oscar",
    "Peggy.png": "reward-peggy",
    "Carrie.png": "reward-carrie",
    "Mole.png": "reward-mole",
    "Sanny.png": "reward-sanny",
  };

  async function revealSlotCharacter(slot, specialReward) {
    if (!specialReward || !slot?.inner) return;

    const img = document.createElement("img");
    img.className = "done";
    img.alt = "";
    img.src = assetWithCacheBust(specialReward);
    slot.inner.appendChild(img);
    slot.doneImg = img;

    const file = (specialReward.split("/").pop() || "").split("?")[0];
    const rewardClass = REWARD_CLASS_BY_FILE[file];
    slot.el.classList.add("show-special-reward");
    if (rewardClass) slot.el.classList.add(rewardClass);

    try {
      if (img.decode) await img.decode();
    } catch (_) {
      /* decode optional */
    }

    attachCharacterAmbientSparkles(slot);
  }

  function afterPickResolved() {
    if (energy > 0 && slots.some((s) => !s.opened)) {
      updatePickableSlots();
      resetIdleHintSchedule();
      return;
    }
    if (energy === 0 && !anySlotOpening()) {
      disablePicking();
      hideHand();
      scheduleGameCompleteOverlay();
      return;
    }
    updatePickableSlots();
  }

  async function onCubeClick(index) {
    if (!canPick || energy <= 0) return;
    if (isHandHintActive() && index !== handTargetSlot) return;

    const slot = slots[index];
    if (!slot || slot.opened || slot.opening) return;

    slot.opening = true;
    showHandOnFirstPick = false;
    hideHand();
    clearIdleHintTimers();
    setEnergy(energy - 1);
    updatePickableSlots();

    const center = slotCenterOnStage(slot.el);
    const skuPoint = slotSkuRevealPoint(slot.el);
    const prize = PRIZES.find((p) => p.id === slot.prizeId);

    slot.el.classList.add("opening");
    slot.cubeImg.style.opacity = "0";
    slot.cubeImg.style.visibility = "hidden";
    playPetardFirework(center.x, center.y, slot.cubeImg);

    try {
      await wait(720);

      const fly = document.createElement("img");
      fly.className = "reveal-prize";
      fly.src = prize.src;
      fly.alt = "";
      fly.style.left = skuPoint.x + "px";
      fly.style.top = skuPoint.y + "px";
      vfxLayer.appendChild(fly);

      await wait(420);

      playSlotFlash(center.x, center.y);
      fly.remove();

      await wait(140);

      const specialReward = specialRewardForPetard(slot.cubeImg);
      await revealSlotCharacter(slot, specialReward);

      markPanelPrizeClaimed(prize);

      slot.opened = true;
    } finally {
      slot.opening = false;
      slot.el.classList.remove("pickable", "opening");
      slot.el.classList.add("disabled");
      afterPickResolved();
    }
  }

  async function finishIntroUi() {
    showPrizeAndInfoPanels();
    showIntroStep("header");
    await waitForStageLayout();
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
      introSwingTimer = setTimeout(() => {
        introSwingTimer = null;
        if (!wrap.classList.contains("dropped")) return;
        wrap.classList.add("info-intro-swing-done");
        if (!swingEl.classList.contains("info-user-swing")) {
          swingEl.style.animation = "none";
        }
      }, INTRO_SWING_TOTAL_MS);
    }

    scheduleInfoIntroSwingEnd = scheduleIntroSwingEnd;

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

  function closeGame() {
    try {
      window.parent.postMessage({ type: "pick-it-close", source: "pick-it" }, "*");
    } catch (_) {
      /* postMessage optional */
    }
    try {
      window.close();
    } catch (_) {
      /* close often blocked in tabs */
    }
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    const app = document.getElementById("app");
    const overlay = document.getElementById("rotateOverlay");
    if (app) app.hidden = true;
    if (overlay) overlay.hidden = true;
    document.body.classList.add("game-closed");
    document.body.style.background = "#000";
  }

  function initCloseButton() {
    const btn = document.querySelector(".btn-close");
    if (!btn) return;
    btn.addEventListener("click", closeGame);
  }

  function initLandscapeOnly() {
    const app = document.getElementById("app");
    if (!app) return;

    const touchUi = window.matchMedia("(hover: none) and (pointer: coarse)");
    let lockTried = false;

    function viewportSize() {
      const vv = window.visualViewport;
      const w = vv ? vv.width : window.innerWidth;
      const h = vv ? vv.height : window.innerHeight;
      return { w, h };
    }

    function tryLockLandscape() {
      if (lockTried) return;
      const { w, h } = viewportSize();
      if (h > w) return;
      const orient = screen.orientation;
      if (!orient || typeof orient.lock !== "function") return;
      lockTried = true;
      orient.lock("landscape").catch(() => {
        lockTried = false;
      });
    }

    function update() {
      const { w, h } = viewportSize();
      const portrait = h > w;
      document.body.classList.toggle("portrait-blocked", portrait);
      document.body.classList.remove("force-landscape");
      document.documentElement.classList.toggle("is-touch", touchUi.matches);
      document.documentElement.classList.toggle("game-landscape", !portrait);

      app.style.width = "";
      app.style.height = "";
      app.style.maxWidth = "";
      app.style.maxHeight = "";
      app.style.visibility = portrait ? "hidden" : "";

      if (!portrait) {
        tryLockLandscape();
      }

      requestAnimationFrame(() => {
        if (typeof reflowStageUi === "function") reflowStageUi();
      });
    }

    const onFirstGesture = () => {
      tryLockLandscape();
    };
    document.body.addEventListener("pointerdown", onFirstGesture, {
      once: true,
      passive: true,
    });

    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", () => setTimeout(update, 150));
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", update);
    }
    if (screen.orientation) {
      screen.orientation.addEventListener("change", update);
    }
    update();
  }

  initLandscapeOnly();
  initCloseButton();
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
