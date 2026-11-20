(() => {
  "use strict";

  const stage = document.querySelector(".stage");
  const painting = document.querySelector("#painting");
  const burnCanvas = document.querySelector("#burn");
  const dusk = document.querySelector("#dusk");
  const toggle = document.querySelector("#motionToggle");
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const DAY = "day";
  const LOADING = "loading";
  const BURNING = "burning";
  const DUSK = "dusk";
  const DURATION = 1400;
  const SPARK = 0.016;
  const OPEN_AT = 0.78;
  const ASSET_WAIT = 1500;
  const SLOW_FRAME = 28;
  const SMALL_WIDTH = 900;
  const BURN_WIDTH = 1920;
  const DAY_WIDTH = 2560;

  let phase = DAY;
  let wantPlaying = !motion.matches;
  let generation = 0;
  let frame = 0;
  let waitEntry = null;
  let burnDraw = null;
  let burnFailed = false;
  let useSmallBuffer = false;
  let paintingSmall = false;
  let grainImage = null;
  let grainDecoded = false;
  let duskDecoded = false;
  let assetsPromise = null;
  let openSent = false;
  let duskSent = false;

  function setPhase(next) {
    phase = next;
    stage.dataset.phase = next;
  }

  function emit(name) {
    const origin = window.location.origin;
    try {
      window.parent.postMessage(
        { type: "journal-scene", event: name },
        origin === "null" ? "*" : origin
      );
    } catch {
      // The parent can disappear while the iframe is being disposed.
    }
  }

  function emitOpen() {
    if (openSent) return;
    openSent = true;
    emit("open");
  }

  function decodeImage(image) {
    return new Promise((resolve) => {
      let settled = false;

      function finish(ok) {
        if (settled) return;
        settled = true;
        resolve(ok);
      }

      function loaded() {
        if (typeof image.decode === "function") {
          try {
            image.decode().then(
              () => finish(true),
              () => finish(false)
            );
          } catch {
            finish(false);
          }
        } else {
          finish(image.naturalWidth > 0 || image.width > 0);
        }
      }

      image.addEventListener("load", loaded, { once: true });
      image.addEventListener("error", () => finish(false), { once: true });

      if (image.complete) {
        if (image.naturalWidth > 0) loaded();
        else finish(false);
      }
    });
  }

  function resizeBurn() {
    if (!burnCanvas) return;

    const viewportWidth = Math.max(1, window.innerWidth);
    const viewportHeight = Math.max(1, window.innerHeight);
    const widthLimit = useSmallBuffer ? SMALL_WIDTH : BURN_WIDTH;
    const dpr = window.devicePixelRatio || 1;
    const scale = Math.min(dpr, 1.5, widthLimit / viewportWidth);
    const width = Math.max(1, Math.round(viewportWidth * scale));
    const height = Math.max(1, Math.round(viewportHeight * scale));

    if (burnCanvas.width !== width || burnCanvas.height !== height) {
      burnCanvas.width = width;
      burnCanvas.height = height;
    }
  }

  function noteSlowPainting() {
    if (painting.dataset.slow === "true") useSmallBuffer = true;
  }

  function shrinkPainting() {
    if (paintingSmall) return;
    paintingSmall = true;
    painting.dispatchEvent(
      new CustomEvent("landscape-width", { detail: SMALL_WIDTH })
    );
  }

  function restorePainting() {
    if (!paintingSmall) return;
    paintingSmall = false;
    painting.dispatchEvent(
      new CustomEvent("landscape-width", { detail: DAY_WIDTH })
    );
  }

  function ensureBurn() {
    if (burnDraw) return true;
    if (burnFailed) return false;
    if (!duskDecoded || !grainDecoded) return false;
    if (typeof window.createPaperBurn !== "function") {
      burnFailed = true;
      return false;
    }

    try {
      resizeBurn();
      burnDraw = window.createPaperBurn(burnCanvas, dusk, grainImage);
      burnDraw(0.001);
      burnDraw(0);
      return true;
    } catch {
      burnDraw = null;
      burnFailed = true;
      return false;
    }
  }

  function paintingFailed() {
    return painting.hidden || painting.style.display === "none";
  }

  function showDuskIfReady() {
    if (duskDecoded) {
      dusk.dataset.loaded = "true";
      stage.setAttribute("data-show-dusk", "");
    } else {
      stage.removeAttribute("data-show-dusk");
    }
  }

  function cancelFrame() {
    if (frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  }

  function cancelWait() {
    if (!waitEntry) return;
    const entry = waitEntry;
    waitEntry = null;
    entry.resolve("cancelled");
  }

  function waitForAssets(limit) {
    return new Promise((resolve) => {
      let settled = false;
      const entry = {
        timer: 0,
        resolve: null
      };

      function settle(value) {
        if (settled) return;
        settled = true;
        clearTimeout(entry.timer);
        if (waitEntry === entry) waitEntry = null;
        resolve(value);
      }

      entry.resolve = settle;
      entry.timer = setTimeout(() => settle("timeout"), limit);
      waitEntry = entry;

      assetsPromise.then((ok) => {
        settle(ok ? "ready" : "failed");
      });
    });
  }

  function syncDay() {
    const shouldPlay =
      wantPlaying && !motion.matches && phase !== DUSK;
    const isPlaying = toggle.dataset.state === "playing";

    if (shouldPlay !== isPlaying) toggle.click();
  }

  function finalizeNow() {
    if (phase === DUSK) return;

    cancelFrame();
    cancelWait();
    showDuskIfReady();
    setPhase(DUSK);
    emitOpen();

    if (!duskSent) {
      duskSent = true;
      emit("dusk");
    }

    syncDay();
  }

  function interruptToFinal() {
    if (phase !== LOADING && phase !== BURNING) return;
    generation += 1;
    finalizeNow();
  }

  function startBurn(current) {
    if (current !== generation || phase !== LOADING) return;

    noteSlowPainting();
    if (useSmallBuffer) shrinkPainting();
    resizeBurn();
    setPhase(BURNING);

    try {
      burnDraw(SPARK);
    } catch {
      burnDraw = null;
      burnFailed = true;
      finalizeNow();
      return;
    }

    let start;
    let previous;
    let slowFrames = 0;

    function advance(now) {
      frame = 0;

      if (current !== generation || phase !== BURNING) return;

      if (start === undefined) start = now;
      const progress = Math.min(1, (now - start) / DURATION);

      if (!useSmallBuffer && previous !== undefined && progress < 0.7) {
        slowFrames = now - previous > SLOW_FRAME ? slowFrames + 1 : 0;
        if (slowFrames >= 2) {
          useSmallBuffer = true;
          shrinkPainting();
          resizeBurn();
        }
      }
      previous = now;

      try {
        burnDraw(SPARK + (1 - SPARK) * progress);
      } catch {
        if (current === generation) {
          burnDraw = null;
          burnFailed = true;
          finalizeNow();
        }
        return;
      }

      if (current !== generation) return;

      if (progress >= OPEN_AT) emitOpen();

      if (progress >= 1) {
        finalizeNow();
        return;
      }

      frame = requestAnimationFrame(advance);
    }

    frame = requestAnimationFrame(advance);
  }

  function ignite() {
    if (phase !== DAY) return;

    generation += 1;
    const current = generation;

    cancelFrame();
    cancelWait();
    openSent = false;
    duskSent = false;
    setPhase(LOADING);

    if (paintingFailed()) {
      finalizeNow();
      return;
    }

    if (motion.matches || !wantPlaying) {
      finalizeNow();
      return;
    }

    waitForAssets(ASSET_WAIT).then((outcome) => {
      if (current !== generation || phase !== LOADING) return;

      if (outcome !== "ready" || paintingFailed() || !ensureBurn()) {
        finalizeNow();
        return;
      }

      startBurn(current);
    });
  }

  function pauseScene() {
    wantPlaying = false;

    if (phase === LOADING || phase === BURNING) {
      interruptToFinal();
    } else {
      syncDay();
    }
  }

  function playScene() {
    wantPlaying = true;
    syncDay();
  }

  function resetScene() {
    generation += 1;
    cancelFrame();
    cancelWait();
    openSent = false;
    duskSent = false;

    stage.removeAttribute("data-show-dusk");
    setPhase(DAY);
    restorePainting();

    try {
      resizeBurn();
      if (burnDraw) burnDraw(0);
    } catch {
      burnDraw = null;
      burnFailed = true;
    }

    syncDay();
  }

  function onMotionChange() {
    if (!motion.matches) return;

    wantPlaying = false;

    if (phase === LOADING || phase === BURNING) {
      interruptToFinal();
    } else {
      syncDay();
    }
  }

  function onMessage(event) {
    if (event.source !== window.parent) return;
    if (event.origin !== window.location.origin) return;

    const data = event.data;
    if (!data || typeof data !== "object" || data.type !== "journal-scene") {
      return;
    }

    switch (data.event) {
      case "ignite":
        ignite();
        break;
      case "reset":
        resetScene();
        break;
      case "pause":
        pauseScene();
        break;
      case "play":
        playScene();
        break;
      default:
        break;
    }
  }

  setPhase(DAY);
  resizeBurn();

  window.addEventListener("message", onMessage);
  window.addEventListener("resize", resizeBurn);

  burnCanvas.addEventListener("webglcontextlost", () => {
    burnDraw = null;
    burnFailed = true;
    if (phase === LOADING || phase === BURNING) interruptToFinal();
  });

  painting.addEventListener("webglcontextlost", () => {
    if (phase === LOADING || phase === BURNING) interruptToFinal();
  });

  if (typeof window.MutationObserver === "function") {
    new MutationObserver(() => {
      noteSlowPainting();
      if (
        paintingFailed() &&
        (phase === LOADING || phase === BURNING)
      ) {
        interruptToFinal();
      }
    }).observe(painting, {
      attributes: true,
      attributeFilter: ["hidden", "style", "data-slow"]
    });
  }

  if (typeof motion.addEventListener === "function") {
    motion.addEventListener("change", onMotionChange);
  }

  grainImage = new Image();
  grainImage.src = "paper-grain.webp";
  const grainDecode = decodeImage(grainImage).then((ok) => {
    grainDecoded = ok;
    return ok;
  });

  const duskDecode = decodeImage(dusk).then((ok) => {
    duskDecoded = ok;
    if (ok) dusk.dataset.loaded = "true";
    if (phase === DUSK) showDuskIfReady();
    return ok;
  });

  assetsPromise = new Promise((resolve) => {
    let remaining = 2;
    let failed = false;

    function settle(ok) {
      if (!ok) {
        if (!failed) {
          failed = true;
          resolve(false);
        }
        return;
      }

      remaining -= 1;
      if (remaining === 0 && !failed) resolve(true);
    }

    duskDecode.then(settle, () => settle(false));
    grainDecode.then(settle, () => settle(false));
  });

  assetsPromise
    .then((ok) => {
      if (ok && phase === DAY) ensureBurn();
    })
    .catch(() => {});

  syncDay();
  emit("ready");
})();
