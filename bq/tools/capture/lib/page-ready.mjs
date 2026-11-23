/**
 * Wait until a page is loaded and layout has settled, then optionally scroll once
 * (bottom → top) to trigger lazy media / sticky chrome.
 *
 * Default waits are settle-based (short ceilings). Use `light: true` for viewport
 * changes / post-scroll settles so we never burn long image/networkidle timeouts.
 *
 * Scroll warm-up nudges muted autoplay videos; waitForMediaReady ensures frames
 * before screenshots. CSS animations stay live on section shots.
 */

function nowMs() {
  return Date.now();
}

function fmtMs(ms) {
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Wait until document, fonts, images, network, and layout height are stable.
 * Prefer this over fixed sleep timers before screenshots.
 *
 * @param {import('playwright').Page} page
 * @param {{
 *   timeoutMs?: number,
 *   networkIdleMs?: number,
 *   layoutStableMs?: number,
 *   layoutStableTimeoutMs?: number,
 *   imagesTimeoutMs?: number,
 *   skipImages?: boolean,
 *   skipNetworkIdle?: boolean,
 *   light?: boolean,
 *   label?: string,
 * }} [options]
 */
export async function waitUntilPageReady(page, options = {}) {
  const light = options.light === true;
  const timeoutMs = options.timeoutMs ?? (light ? 5000 : 30000);
  const layoutStableMs = options.layoutStableMs ?? 450;
  const layoutStableTimeoutMs =
    options.layoutStableTimeoutMs ?? Math.min(light ? 3000 : 5000, timeoutMs);
  const imagesTimeoutMs = options.imagesTimeoutMs ?? (light ? 2000 : 3000);
  const skipImages = options.skipImages === true;
  const skipNetworkIdle =
    options.skipNetworkIdle === true || light || (options.networkIdleMs ?? (light ? 0 : 2000)) <= 0;
  const networkIdleMs = skipNetworkIdle
    ? 0
    : Math.min(options.networkIdleMs ?? 2000, 2000);
  const label = options.label ? ` [${options.label}]` : '';
  const t0 = nowMs();
  const marks = [];

  const step = async (name, fn) => {
    const s = nowMs();
    await fn();
    marks.push(`${name}=${fmtMs(nowMs() - s)}`);
  };

  await step('readyState', () =>
    page
      .waitForFunction(() => document.readyState === 'complete', undefined, {
        timeout: Math.min(timeoutMs, light ? 5000 : 15000),
      })
      .catch(() => null),
  );

  await step('fonts', () =>
    page
      .evaluate(async () => {
        try {
          if (document.fonts?.ready) await document.fonts.ready;
        } catch {
          /* ignore */
        }
      })
      .catch(() => null),
  );

  // Layout height/width must stop changing (lazy sections, font swaps, hydration).
  await step('layoutStable', () =>
    page
      .waitForFunction(
        (stableMs) => {
          const h = Math.max(
            document.documentElement?.scrollHeight || 0,
            document.body?.scrollHeight || 0,
          );
          const w = document.documentElement?.clientWidth || 0;
          const key = `${h}x${w}`;
          const now = performance.now();
          const prev = window.__bqPageReadyLayout;
          if (!prev || prev.key !== key) {
            window.__bqPageReadyLayout = { key, since: now };
            return false;
          }
          return now - prev.since >= stableMs;
        },
        layoutStableMs,
        { timeout: layoutStableTimeoutMs, polling: 100 },
      )
      .catch(() => null),
  );

  // Brief image settle only — incomplete lazy/broken images are OK after scroll.
  if (!skipImages) {
    await step('images', () =>
      page
        .waitForFunction(
          () => {
            const imgs = [...document.images];
            if (imgs.length === 0) return true;
            const pending = imgs.filter((img) => !img.complete);
            // Allow unresolved lazy/broken images; never require near-100% complete.
            return pending.length <= Math.max(3, Math.floor(imgs.length * 0.15));
          },
          undefined,
          {
            timeout: Math.min(imagesTimeoutMs, timeoutMs),
            polling: 200,
          },
        )
        .catch(() => null),
    );
  } else {
    marks.push('images=skip');
  }

  // Best-effort network quiet — only useful once after first navigation.
  if (!skipNetworkIdle && networkIdleMs > 0) {
    await step('networkIdle', () =>
      page.waitForLoadState('networkidle', { timeout: networkIdleMs }).catch(() => null),
    );
  } else {
    marks.push('networkIdle=skip');
  }

  // Two animation frames so the browser has painted the settled layout.
  await step('raf', () =>
    page
      .evaluate(
        () =>
          new Promise((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(resolve));
          }),
      )
      .catch(() => null),
  );

  console.log(`    … ready${label} ${fmtMs(nowMs() - t0)} (${marks.join(', ')})`);
}

/**
 * Single full-page scroll: top → bottom → top.
 * Used once to force lazy media and scroll-reveal chrome; callers should
 * waitUntilPageReady before and after.
 *
 * By default dwells briefly at each step and nudges muted autoplay so
 * IntersectionObserver-mounted videos can start (Renault etc. unmount <video>
 * when off-screen — a too-fast scroll never sees them). Pass warmMedia: false
 * to skip that nudge.
 *
 * @param {import('playwright').Page} page
 * @param {{ label?: string, dwellMs?: number, warmMedia?: boolean }} [options]
 */
export async function scrollPageOnceDownThenUp(page, options = {}) {
  const label = options.label ? ` [${options.label}]` : '';
  const warmMedia = options.warmMedia !== false;
  const dwellMs = options.dwellMs ?? (warmMedia ? 120 : 0);
  const t0 = nowMs();
  const metrics = await page.evaluate(
    async ({ dwellMs: dwell, warmMedia: warm }) => {
      const downStep = Math.max(480, Math.floor(window.innerHeight * 0.9));
      const upStep = Math.max(280, Math.floor(window.innerHeight * 0.55));
      const pageHeight = () =>
        Math.max(document.body?.scrollHeight || 0, document.documentElement.scrollHeight || 0);
      const frame = () => new Promise((r) => requestAnimationFrame(r));
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

      const nudgeVideos = async () => {
        if (!warm) return { seen: 0, playing: 0 };
        const videos = [...document.querySelectorAll('video')];
        let playing = 0;
        for (const video of videos) {
          try {
            video.muted = true;
            video.playsInline = true;
            const p = video.play();
            if (p && typeof p.catch === 'function') await p.catch(() => null);
            if (!video.paused || video.readyState >= 2) playing += 1;
          } catch {
            /* ignore */
          }
        }
        return { seen: videos.length, playing };
      };

      let maxY = pageHeight();
      let downSteps = 0;
      let mediaSeen = 0;
      let mediaPlaying = 0;
      for (let y = 0; y < maxY; y += downStep) {
        window.scrollTo(0, y);
        await frame();
        if (dwell > 0) await sleep(dwell);
        const m = await nudgeVideos();
        mediaSeen = Math.max(mediaSeen, m.seen);
        mediaPlaying = Math.max(mediaPlaying, m.playing);
        // Brief extra wait when videos just appeared so a frame can decode.
        if (warm && m.seen > 0) {
          const deadline = performance.now() + 350;
          while (performance.now() < deadline) {
            const ready = [...document.querySelectorAll('video')].some(
              (v) => v.readyState >= 2 || v.currentTime > 0.05,
            );
            if (ready) break;
            await sleep(50);
          }
        }
        maxY = Math.max(maxY, pageHeight());
        downSteps += 1;
      }
      window.scrollTo(0, maxY);
      await frame();
      if (dwell > 0) await sleep(dwell);
      await nudgeVideos();

      let y = maxY;
      let upSteps = 0;
      while (y > 0) {
        y = Math.max(0, y - upStep);
        window.scrollTo(0, y);
        await frame();
        if (dwell > 0) await sleep(Math.min(dwell, 60));
        upSteps += 1;
      }
      window.scrollTo(0, 0);
      await frame();
      return { height: maxY, downSteps, upSteps, mediaSeen, mediaPlaying };
    },
    { dwellMs, warmMedia },
  );
  console.log(
    `    … scroll${label} ${fmtMs(nowMs() - t0)} (h≈${Math.round(metrics.height)}px, ↓${metrics.downSteps}/↑${metrics.upSteps} steps` +
      (warmMedia ? `, mediaSeen=${metrics.mediaSeen}, mediaPlaying=${metrics.mediaPlaying}` : '') +
      `)`,
  );
}

/**
 * After scroll, do one more slow pass that pauses on video hosts so full-page
 * screenshots (and CDN decode) get real frames. Ends scrolled to top.
 * Light mode only nudges above-fold videos.
 *
 * @param {import('playwright').Page} page
 * @param {{ label?: string, light?: boolean }} [options]
 */
export async function waitForMediaReady(page, options = {}) {
  const light = options.light === true;
  const label = options.label ? ` [${options.label}]` : '';
  const t0 = nowMs();

  const stats = await page.evaluate(async (lightMode) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const nudge = async (videos) => {
      for (const video of videos) {
        try {
          video.muted = true;
          video.playsInline = true;
          const p = video.play();
          if (p && typeof p.catch === 'function') await p.catch(() => null);
        } catch {
          /* ignore */
        }
      }
    };

    let peakSeen = 0;
    let peakReady = 0;
    let peakPlaying = 0;

    if (!lightMode) {
      const step = Math.max(360, Math.floor(window.innerHeight * 0.7));
      const maxY = Math.max(
        document.body?.scrollHeight || 0,
        document.documentElement.scrollHeight || 0,
      );
      for (let y = 0; y <= maxY; y += step) {
        window.scrollTo(0, y);
        await sleep(100);
        const videos = [...document.querySelectorAll('video')];
        peakSeen = Math.max(peakSeen, videos.length);
        await nudge(videos);
        const deadline = performance.now() + 400;
        while (performance.now() < deadline) {
          const list = [...document.querySelectorAll('video')];
          const ready = list.filter((v) => v.readyState >= 2 || v.currentTime > 0.05).length;
          const playing = list.filter((v) => !v.paused && v.readyState >= 1).length;
          peakReady = Math.max(peakReady, ready);
          peakPlaying = Math.max(peakPlaying, playing);
          if (list.length === 0 || ready >= Math.ceil(list.length * 0.5)) break;
          await sleep(50);
        }
      }
      window.scrollTo(0, 0);
      await sleep(80);
    }

    const topVideos = [...document.querySelectorAll('video')];
    peakSeen = Math.max(peakSeen, topVideos.length);
    await nudge(topVideos);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const ready = topVideos.filter((v) => v.readyState >= 2 || v.currentTime > 0.05).length;
    const playing = topVideos.filter((v) => !v.paused && v.readyState >= 1).length;
    peakReady = Math.max(peakReady, ready);
    peakPlaying = Math.max(peakPlaying, playing);

    return { total: peakSeen, ready: peakReady, playing: peakPlaying };
  }, light);

  console.log(
    `    … media ready${label} ${fmtMs(nowMs() - t0)} (playing=${stats.playing}/${stats.total}, ready=${stats.ready})`,
  );
}

/**
 * Ready → one scroll pass → light settle (lazy loads triggered by scrolling).
 *
 * @param {import('playwright').Page} page
 * @param {{
 *   timeoutMs?: number,
 *   networkIdleMs?: number,
 *   label?: string,
 *   skipScroll?: boolean,
 *   light?: boolean,
 *   skipMediaReady?: boolean,
 * }} [options]
 */
export async function preparePageForScreenshot(page, options = {}) {
  const label = options.label || 'prepare';
  const light = options.light === true;
  const t0 = nowMs();
  console.log(`    ▸ prepare start [${label}]${light ? ' (light)' : ''}`);

  // First pass: full settle on initial load; light settle on viewport re-prepares.
  await waitUntilPageReady(page, {
    ...options,
    light,
    skipImages: light ? true : options.skipImages,
    skipNetworkIdle: light ? true : options.skipNetworkIdle,
    label: `${label}/before-scroll`,
  });

  if (!options.skipScroll) {
    await scrollPageOnceDownThenUp(page, { label });
    // After scroll: always light — do not burn another image/networkidle timeout.
    await waitUntilPageReady(page, {
      ...options,
      light: true,
      skipImages: true,
      skipNetworkIdle: true,
      label: `${label}/after-scroll`,
    });
  }

  if (!options.skipMediaReady) {
    await waitForMediaReady(page, {
      light,
      label: `${label}/media`,
    });
  }

  console.log(`    ▸ prepare done  [${label}] ${fmtMs(nowMs() - t0)}`);
}
