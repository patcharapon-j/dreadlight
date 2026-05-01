const DREAD_RED = 0xd83d3d;
const DREAD_CORE = 0xff9f91;
const SCAR_DARK = 0x120305;
const SCAR_RIM = 0x4f1012;
const SOUL_BRUISE = 0x8d4cf5;

const DEFAULT_MAX_DREAD = 5;
const INSTANCE_KEY = "__dreadlightCorruptionVeins";

/**
 * Mount the animated corruption overlay on an investigator sheet.
 * Foundry v13 bundles PIXI, so this uses the existing WebGL/WebGPU renderer
 * without adding a package manager or external runtime dependency.
 */
export function mountDreadTendrils(sheetElement) {
  const host = sheetElement?.querySelector?.(".window-content") ?? sheetElement;
  const tracksBar = sheetElement?.querySelector?.(".tracks-bar");
  if (!host || !tracksBar) return;

  const existing = host[INSTANCE_KEY];
  if (existing) {
    existing.update(sheetElement, tracksBar);
    return;
  }

  const renderer = new DreadCorruptionVeins(sheetElement, host, tracksBar);
  host[INSTANCE_KEY] = renderer;
  renderer.init();
}

class DreadCorruptionVeins {
  constructor(sheetElement, host, tracksBar) {
    this.sheetElement = sheetElement;
    this.host = host;
    this.tracksBar = tracksBar;
    this.app = null;
    this.canvas = null;
    this.scars = null;
    this.glow = null;
    this.veins = null;
    this.highlights = null;
    this.resizeObserver = null;
    this.frame = 0;
    this.layoutKey = "";
    this.network = [];
    this.pits = [];
    this.reducedMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  }

  async init() {
    if (!globalThis.PIXI?.Application) {
      this.host.classList.add("dread-corruption-unavailable");
      return;
    }

    const { width, height } = this.hostSize();
    this.app = await createPixiApplication(width, height);
    if (!this.app) return;

    this.canvas = this.app.canvas ?? this.app.view;
    this.canvas.classList.add("dread-corruption-canvas");
    this.host.prepend(this.canvas);

    this.scars = new PIXI.Graphics();
    this.glow = new PIXI.Graphics();
    this.veins = new PIXI.Graphics();
    this.highlights = new PIXI.Graphics();

    this.glow.blendMode = getAddBlendMode();
    this.veins.blendMode = getNormalBlendMode();
    this.highlights.blendMode = getAddBlendMode();

    this.app.stage.addChild(this.scars, this.glow, this.veins, this.highlights);

    this.resizeObserver = new ResizeObserver(() => this.rebuild());
    this.resizeObserver.observe(this.host);
    this.resizeObserver.observe(this.tracksBar);

    this.rebuild();
    this.app.ticker.add(this.tick, this);
  }

  update(sheetElement, tracksBar) {
    this.sheetElement = sheetElement;
    this.tracksBar = tracksBar;
    this.rebuild();
  }

  destroy() {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.app?.ticker?.remove(this.tick, this);
    this.app?.destroy?.(true, { children: true, texture: true, baseTexture: true });
    if (this.host?.[INSTANCE_KEY] === this) delete this.host[INSTANCE_KEY];
  }

  tick(ticker) {
    if (!this.host?.isConnected) {
      this.destroy();
      return;
    }

    const delta = typeof ticker === "number" ? ticker : (ticker?.deltaTime ?? 1);
    if (!this.reducedMotion) this.frame += delta;
    this.draw();
  }

  rebuild() {
    if (!this.app || !this.host?.isConnected) return;

    const { width, height } = this.hostSize();
    this.app.renderer.resize(width, height);

    const layoutKey = this.makeLayoutKey(width, height);
    if (layoutKey === this.layoutKey) {
      this.draw();
      return;
    }

    this.layoutKey = layoutKey;
    const geometry = this.geometry();
    this.network = geometry ? this.buildNetwork(geometry) : [];
    this.pits = geometry ? this.buildBiteMarks(geometry) : [];
    this.draw();
  }

  hostSize() {
    const rect = this.host.getBoundingClientRect();
    return {
      width: Math.max(1, Math.round(rect.width)),
      height: Math.max(1, Math.round(rect.height)),
    };
  }

  makeLayoutKey(width, height) {
    const dreadRect = this.tracksBar.querySelector(".track-btn.dread")?.getBoundingClientRect();
    const soulRect = this.tracksBar.querySelector(".track-btn.soul")?.getBoundingClientRect();
    const hostRect = this.host.getBoundingClientRect();
    const dread = this.dread;
    if (!dreadRect || !soulRect) return `${width}:${height}:${dread}`;
    return [
      width,
      height,
      dread,
      Math.round(dreadRect.left - hostRect.left),
      Math.round(dreadRect.top - hostRect.top),
      Math.round(soulRect.left - hostRect.left),
      Math.round(soulRect.top - hostRect.top),
      Math.round(soulRect.width),
    ].join(":");
  }

  get dread() {
    return clamp(Number(this.tracksBar?.dataset?.dread) || 0, 0, this.maxDread);
  }

  get maxDread() {
    return Number(game.settings.get("dreadlight", "dreadMax")) || DEFAULT_MAX_DREAD;
  }

  get intensity() {
    return clamp(this.dread / Math.max(1, Math.min(this.maxDread, DEFAULT_MAX_DREAD)), 0, 1);
  }

  geometry() {
    const hostRect = this.host.getBoundingClientRect();
    const dreadBox = this.tracksBar.querySelector(".track-btn.dread");
    const soulBox = this.tracksBar.querySelector(".track-btn.soul");
    const header = this.sheetElement.querySelector(".sheet-header");
    const body = this.sheetElement.querySelector(".sheet-body");
    if (!dreadBox || !soulBox) return null;

    const { width, height } = this.hostSize();
    return {
      width,
      height,
      dread: relativeRect(dreadBox.getBoundingClientRect(), hostRect),
      soul: relativeRect(soulBox.getBoundingClientRect(), hostRect),
      tracks: relativeRect(this.tracksBar.getBoundingClientRect(), hostRect),
      header: header ? relativeRect(header.getBoundingClientRect(), hostRect) : null,
      body: body ? relativeRect(body.getBoundingClientRect(), hostRect) : null,
    };
  }

  buildNetwork(g) {
    const d = g.dread;
    const s = g.soul;
    const tr = g.tracks;
    const bodyTop = g.body?.top ?? tr.bottom + 36;
    const origin = { x: d.left + 2, y: d.top + d.height * 0.5 };
    const originTop = { x: d.left + 3, y: d.top + 5 };
    const originBottom = { x: d.left + 3, y: d.bottom - 5 };
    const network = [];

    network.push(vein(1, 1.3, 0.46, [
      origin,
      { x: d.left - 20, y: origin.y - 2 },
      { x: d.left - 42, y: origin.y + 2 },
    ], 1, 0.22));

    network.push(vein(2, 1.9, 0.54, [
      origin,
      { x: lerp(d.left, s.right, 0.72), y: origin.y - 6 },
      { x: s.right + 3, y: s.top + s.height * 0.48 },
    ], 7, 0.28, [
      branch(0.62, 0.72, [{ x: s.right + 2, y: s.top + s.height * 0.3 }]),
      branch(0.78, 0.52, [{ x: s.right + 5, y: s.bottom - 9 }]),
    ]));

    network.push(vein(3, 2.45, 0.62, [
      originBottom,
      { x: lerp(d.left, s.right, 0.62), y: d.bottom + 6 },
      { x: s.right - 8, y: s.bottom + 1 },
      { x: s.left + s.width * 0.32, y: s.bottom - 4 },
    ], 17, 0.34, [
      branch(0.48, 0.78, [{ x: s.right - 4, y: s.top + 1 }]),
      branch(0.74, 0.62, [{ x: s.left + s.width * 0.64, y: s.top + 8 }]),
    ]));

    network.push(vein(3, 2.2, 0.56, [
      originTop,
      { x: lerp(d.left, s.right, 0.6), y: tr.top - 5 },
      { x: s.right - 12, y: s.top - 2 },
      { x: s.left + s.width * 0.24, y: s.top + 5 },
    ], 31, 0.32, [
      branch(0.52, 0.56, [{ x: s.left + s.width * 0.74, y: s.top + s.height * 0.45 }]),
    ]));

    network.push(vein(4, 2.7, 0.5, [
      { x: d.right - d.width * 0.25, y: d.bottom - 4 },
      { x: d.left - 8, y: tr.bottom + 10 },
      { x: s.right - 22, y: bodyTop + 10 },
      { x: s.left + s.width * 0.1, y: bodyTop + 28 },
    ], 43, 0.42, [
      branch(0.42, 0.72, [{ x: d.left - 42, y: bodyTop + 14 }]),
      branch(0.72, 0.52, [{ x: s.left + s.width * 0.42, y: bodyTop + 28 }]),
    ]));

    network.push(vein(4, 2.55, 0.48, [
      { x: d.left + d.width * 0.5, y: d.top + 3 },
      { x: d.left - 8, y: tr.top - 12 },
      { x: s.right - 20, y: Math.max(18, tr.top - 26) },
      { x: s.left + s.width * 0.42, y: Math.max(14, tr.top - 32) },
    ], 59, 0.38, [
      branch(0.55, 0.58, [{ x: s.right - 6, y: tr.top - 20 }]),
    ]));

    network.push(vein(5, 3.15, 0.58, [
      { x: d.right - 8, y: d.top + d.height * 0.34 },
      { x: d.left - 16, y: d.top - 12 },
      { x: s.left + s.width * 0.5, y: tr.top - 36 },
      { x: g.width * 0.42, y: tr.top - 42 },
    ], 79, 0.48, [
      branch(0.5, 0.78, [{ x: g.width * 0.5, y: tr.top - 32 }]),
      branch(0.8, 0.48, [{ x: g.width * 0.35, y: tr.top - 18 }]),
    ]));

    network.push(vein(5, 2.9, 0.52, [
      { x: d.left + d.width * 0.48, y: d.bottom - 3 },
      { x: d.left - 18, y: bodyTop + 10 },
      { x: g.width * 0.4, y: bodyTop + 38 },
      { x: g.width * 0.48, y: bodyTop + 54 },
    ], 97, 0.44, [
      branch(0.42, 0.7, [{ x: d.left - 52, y: bodyTop + 28 }]),
      branch(0.72, 0.54, [{ x: g.width * 0.5, y: bodyTop + 46 }]),
    ]));

    network.push(vein(5, 1.45, 0.38, [
      { x: s.right - s.width * 0.18, y: s.top + 2 },
      { x: s.right - s.width * 0.24, y: s.top + s.height * 0.42 },
      { x: s.right - s.width * 0.36, y: s.bottom - 3 },
    ], 113, 0.14, [
      branch(0.44, 0.42, [{ x: s.right - s.width * 0.08, y: s.top + s.height * 0.6 }]),
      branch(0.72, 0.34, [{ x: s.right - s.width * 0.58, y: s.bottom - 5 }]),
    ], true));

    return network.map((item) => ({
      ...item,
      anchors: item.anchors.map((point) => ({
        x: clamp(point.x, -24, g.width + 24),
        y: clamp(point.y, -24, g.height + 24),
      })),
    }));
  }

  buildBiteMarks(g) {
    const d = g.dread;
    const s = g.soul;
    const tr = g.tracks;
    const bodyTop = g.body?.top ?? tr.bottom + 36;
    return [
      { level: 2, x: d.left + 3, y: d.top + d.height * 0.5, r: 6, alpha: 0.22 },
      { level: 3, x: s.right - 5, y: s.top + s.height * 0.48, r: 5, alpha: 0.18 },
      { level: 4, x: s.left + s.width * 0.24, y: s.bottom + 2, r: 6, alpha: 0.16 },
      { level: 4, x: d.left - 30, y: bodyTop + 14, r: 7, alpha: 0.12 },
      { level: 5, x: g.width * 0.42, y: tr.top - 38, r: 9, alpha: 0.14 },
      { level: 5, x: g.width * 0.47, y: bodyTop + 48, r: 10, alpha: 0.1 },
    ];
  }

  draw() {
    if (!this.app) return;
    this.clear();

    const dread = this.dread;
    if (this.canvas) this.canvas.dataset.dread = String(dread);
    if (dread <= 0) return;

    const intensity = this.intensity;
    const breath = this.reducedMotion ? 1 : 0.86 + Math.sin(this.frame * 0.035) * 0.14;
    const highDreadSurge = dread >= 5 && !this.reducedMotion
      ? 0.9 + Math.sin(this.frame * 0.082) * 0.18
      : 1;

    for (const pit of this.pits) {
      if (dread < pit.level) continue;
      const alpha = pit.alpha * intensity * breath;
      drawCircle(this.scars, pit.x, pit.y, pit.r * 1.5, SCAR_DARK, alpha * 0.28);
      drawCircle(this.scars, pit.x, pit.y, pit.r, SCAR_RIM, alpha * 0.18);
      drawCircle(this.glow, pit.x, pit.y, pit.r * 1.12, DREAD_RED, alpha * 0.09);
    }

    for (const item of this.network) {
      if (dread < item.level) continue;
      const shown = clamp((dread - item.level) + 1, 0, 1);
      this.drawVein(item, shown, breath, highDreadSurge);
    }
  }

  clear() {
    this.scars?.clear();
    this.glow?.clear();
    this.veins?.clear();
    this.highlights?.clear();
  }

  drawVein(item, shown, breath, surge) {
    const center = this.animatedPath(item);
    const samples = sampleCatmullRom(center, item.cracked ? 7 : 10);
    const alpha = item.alpha * shown * breath;
    const baseWidth = item.width * (0.56 + this.intensity * 0.24);

    this.drawTaperedRibbon(this.scars, samples, baseWidth * 2.1, 0.1, SCAR_DARK, alpha * 0.38);
    this.drawTaperedRibbon(this.scars, samples, baseWidth * 1.35, 0.07, SCAR_RIM, alpha * 0.18);
    this.drawTaperedRibbon(this.glow, samples, baseWidth * 2.6, 0.05, DREAD_RED, alpha * 0.09 * surge);
    this.drawTaperedRibbon(this.veins, samples, baseWidth, 0.1, DREAD_RED, alpha * 0.72);
    this.drawTaperedRibbon(this.highlights, samples, baseWidth * 0.2, 0.03, item.cracked ? SOUL_BRUISE : DREAD_CORE, alpha * 0.34 * surge);

    if (item.cracked) this.drawCrackSplinters(samples, alpha);

    for (const branchData of item.branches) {
      const startIndex = clamp(Math.floor(samples.length * branchData.t), 0, samples.length - 1);
      const start = samples[startIndex];
      const branchPath = [start, ...branchData.points];
      const branchSamples = sampleCatmullRom(this.animateBranch(branchPath, item.seed + startIndex), 7);
      const branchWidth = baseWidth * branchData.scale;
      this.drawTaperedRibbon(this.scars, branchSamples, branchWidth * 1.7, 0.05, SCAR_DARK, alpha * 0.24);
      this.drawTaperedRibbon(this.glow, branchSamples, branchWidth * 1.9, 0.03, DREAD_RED, alpha * 0.05 * surge);
      this.drawTaperedRibbon(this.veins, branchSamples, branchWidth * 0.48, 0.025, DREAD_RED, alpha * 0.46);
      this.drawTaperedRibbon(this.highlights, branchSamples, branchWidth * 0.12, 0.015, DREAD_CORE, alpha * 0.2 * surge);
    }
  }

  animatedPath(item) {
    const amount = this.reducedMotion ? 0 : this.intensity * item.motion;
    return item.anchors.map((point, index) => {
      if (index === 0) return point;
      const phase = this.frame * 0.014 + item.seed * 0.31 + index * 1.7;
      return {
        x: point.x + Math.sin(phase) * amount,
        y: point.y + Math.cos(phase * 1.23) * amount * 0.58,
      };
    });
  }

  animateBranch(points, seed) {
    const amount = this.reducedMotion ? 0 : this.intensity * 0.8;
    return points.map((point, index) => {
      if (index === 0) return point;
      const phase = this.frame * 0.018 + seed + index * 2.4;
      return {
        x: point.x + Math.sin(phase) * amount,
        y: point.y + Math.cos(phase * 1.1) * amount * 0.7,
      };
    });
  }

  drawTaperedRibbon(graphics, samples, startWidth, endWidth, color, alpha) {
    if (samples.length < 2 || alpha <= 0) return;

    const left = [];
    const right = [];
    const last = samples.length - 1;
    for (let i = 0; i < samples.length; i++) {
      const t = i / last;
      const p = samples[i];
      const before = samples[Math.max(0, i - 1)];
      const after = samples[Math.min(last, i + 1)];
      const dx = after.x - before.x;
      const dy = after.y - before.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const width = taperedWidth(startWidth, endWidth, t);
      left.push(p.x + nx * width, p.y + ny * width);
      right.unshift(p.y - ny * width);
      right.unshift(p.x - nx * width);
    }

    fillPolygon(graphics, left.concat(right), color, alpha);
  }

  drawCrackSplinters(samples, alpha) {
    if (samples.length < 8) return;
    for (let i = 4; i < samples.length - 4; i += 8) {
      const p = samples[i];
      const prev = samples[i - 1];
      const next = samples[i + 1];
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const side = i % 16 === 0 ? 1 : -1;
      strokeLine(this.scars, p.x, p.y, p.x + nx * side * 8, p.y + ny * side * 8, 0.8, SCAR_DARK, alpha * 0.45);
      strokeLine(this.highlights, p.x, p.y, p.x + nx * side * 5, p.y + ny * side * 5, 0.35, DREAD_CORE, alpha * 0.22);
    }
  }
}

function vein(level, width, alpha, anchors, seed, motion, branches = [], cracked = false) {
  return { level, width, alpha, anchors, seed, motion, branches, cracked };
}

function branch(t, scale, points) {
  return { t, scale, points };
}

async function createPixiApplication(width, height) {
  const options = {
    width,
    height,
    backgroundAlpha: 0,
    antialias: true,
    autoDensity: true,
    resolution: Math.min(globalThis.devicePixelRatio || 1, 2),
    powerPreference: "low-power",
  };

  try {
    const app = new PIXI.Application();
    if (typeof app.init === "function") {
      await app.init(options);
      return app;
    }
    app.destroy?.(true);
  } catch (error) {
    console.warn("Dreadlight | PIXI v8 corruption overlay init failed; trying legacy PIXI.", error);
  }

  try {
    return new PIXI.Application(options);
  } catch (error) {
    console.warn("Dreadlight | Unable to initialize dread corruption overlay.", error);
    return null;
  }
}

function sampleCatmullRom(points, steps = 8) {
  if (points.length <= 2) return points.map((p) => ({ ...p }));

  const samples = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    for (let step = 0; step < steps; step++) {
      const t = step / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      samples.push({
        x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  samples.push({ ...points.at(-1) });
  return samples;
}

function taperedWidth(startWidth, endWidth, t) {
  const rootBulge = Math.sin(Math.PI * clamp(t * 1.2, 0, 1)) * startWidth * 0.14;
  const taper = Math.pow(1 - t, 1.72);
  return endWidth + startWidth * taper + rootBulge;
}

function fillPolygon(graphics, coords, color, alpha) {
  if (coords.length < 6) return;
  if (typeof graphics.beginFill === "function") {
    graphics.beginFill(color, alpha);
    graphics.drawPolygon(coords);
    graphics.endFill();
    return;
  }
  graphics.poly(coords).fill({ color, alpha });
}

function drawCircle(graphics, x, y, radius, color, alpha) {
  if (typeof graphics.beginFill === "function") {
    graphics.beginFill(color, alpha);
    graphics.drawCircle(x, y, radius);
    graphics.endFill();
    return;
  }
  graphics.circle(x, y, radius).fill({ color, alpha });
}

function strokeLine(graphics, x1, y1, x2, y2, width, color, alpha) {
  if (typeof graphics.lineStyle === "function") {
    graphics.lineStyle(width, color, alpha);
    graphics.moveTo(x1, y1);
    graphics.lineTo(x2, y2);
    return;
  }
  graphics.moveTo(x1, y1);
  graphics.lineTo(x2, y2);
  graphics.stroke({ width, color, alpha, cap: "round" });
}

function relativeRect(rect, parent) {
  const left = rect.left - parent.left;
  const top = rect.top - parent.top;
  const width = rect.width;
  const height = rect.height;
  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
  };
}

function getAddBlendMode() {
  return PIXI.BLEND_MODES?.ADD ?? "add";
}

function getNormalBlendMode() {
  return PIXI.BLEND_MODES?.NORMAL ?? "normal";
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
