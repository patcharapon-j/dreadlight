/**
 * Generate original Dreadlight compendium item glyphs.
 * These are transparent, symbol-only SVGs: no backgrounds, no frames, no text.
 */

import { mkdirSync, readFileSync, writeFileSync } from "fs";

const ROOT = "assets/icons/compendium";
const SOURCE = "scripts/populate-compendiums.mjs";

const PACKS = {
  backgrounds: { start: "const BACKGROUNDS", end: "const DRIVES", type: "background" },
  drives: { start: "const DRIVES", end: "const TALENTS", type: "drive" },
  talents: { start: "const TALENTS", end: "const DREADLORE_ICONS", type: "talent" },
  dreadlore: { start: "const DREADLORE_TALENTS", end: "// ─── MELEE WEAPONS", type: "dreadlore" },
  weapons: { start: "const WEAPONS", end: "// ─── ARMOR", type: "weapon" },
  armor: { start: "const ARMOR", end: "// ─── EQUIPMENT", type: "armor" },
  equipment: { start: "const EQUIPMENT", end: "for (const item of BACKGROUNDS)", type: "equipment" },
};

const COLORS = {
  background: "#c9a96e",
  drive: "#e05555",
  talent: "#6b9df5",
  dreadlore: "#e05555",
  weapon: "#d7b878",
  armor: "#55b87a",
  equipment: "#c9a96e",
};

function section(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  if (startIndex === -1 || endIndex === -1) throw new Error(`Could not find section ${start}`);
  return source.slice(startIndex, endIndex);
}

function namesFromArraySection(text) {
  return [...text.matchAll(/^\s*\["([^"]+)"/gm)].map((match) => match[1]);
}

function namesFromObjectSection(text) {
  return [...text.matchAll(/^\s*name:\s*"([^"]+)"/gm)].map((match) => match[1]);
}

function slugify(name) {
  return name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function hash(text) {
  let value = 2166136261;
  for (const char of text) {
    value ^= char.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function n(value) {
  return Number(value.toFixed(2));
}

function has(lower, pattern) {
  return pattern.test(lower);
}

function symbolSvg(type, seed, symbol) {
  const color = COLORS[type] ?? COLORS.equipment;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
  ${symbol}
  ${detailMarks(seed, color)}
</svg>
`;
}

function detailMarks(seed, color) {
  const marks = [
    `<circle cx="4.6" cy="4.6" r="0.7" fill="${color}" stroke="none" opacity="0.72"/>`,
    `<circle cx="19.4" cy="4.6" r="0.7" fill="${color}" stroke="none" opacity="0.72"/>`,
    `<circle cx="4.6" cy="19.4" r="0.7" fill="${color}" stroke="none" opacity="0.72"/>`,
    `<circle cx="19.4" cy="19.4" r="0.7" fill="${color}" stroke="none" opacity="0.72"/>`,
    `<path d="M12 2.5v2" opacity="0.55"/>`,
    `<path d="M12 19.5v2" opacity="0.55"/>`,
    `<path d="M2.5 12h2" opacity="0.55"/>`,
    `<path d="M19.5 12h2" opacity="0.55"/>`,
  ];
  const chosen = [];
  const step = 1 + ((seed >>> 7) % (marks.length - 1));
  for (let i = 0; chosen.length < 3 && i < marks.length * 2; i++) {
    const cursor = (seed + i * step) % marks.length;
    if (!chosen.includes(cursor)) chosen.push(cursor);
  }
  for (let i = 0; chosen.length < 3; i++) {
    if (!chosen.includes(i)) chosen.push(i);
  }
  return chosen.map((index) => marks[index]).join("\n  ");
}

function abstractSigil(seed, color, arms = 5) {
  const radiusA = 7 + (seed % 3);
  const radiusB = 3.4 + ((seed >>> 4) % 3);
  const paths = [];
  for (let i = 0; i < arms; i++) {
    const angle = -Math.PI / 2 + (Math.PI * 2 * i) / arms;
    const x = n(12 + Math.cos(angle) * radiusA);
    const y = n(12 + Math.sin(angle) * radiusA);
    const mx = n(12 + Math.cos(angle + 0.24) * radiusB);
    const my = n(12 + Math.sin(angle + 0.24) * radiusB);
    paths.push(`<path d="M12 12Q${mx} ${my} ${x} ${y}"/>`);
  }
  return `${paths.join("\n  ")}
  <circle cx="12" cy="12" r="2" fill="${color}" stroke="none"/>`;
}

function eye(color) {
  return `<path d="M3 12c2.3-3.8 5.3-5.7 9-5.7s6.7 1.9 9 5.7c-2.3 3.8-5.3 5.7-9 5.7S5.3 15.8 3 12Z"/>
  <circle cx="12" cy="12" r="2.1" fill="${color}" stroke="none"/>`;
}

function lens() {
  return `<circle cx="10.2" cy="10.2" r="5.4"/>
  <path d="m14.2 14.2 5.3 5.3"/>`;
}

function book() {
  return `<path d="M5 4.5h5.2c1.1 0 1.8.7 1.8 1.8v13.2c0-1.1-.7-1.8-1.8-1.8H5z"/>
  <path d="M19 4.5h-5.2c-1.1 0-1.8.7-1.8 1.8v13.2c0-1.1.7-1.8 1.8-1.8H19z"/>
  <path d="M8 8h2M8 11h2M14 8h2"/>`;
}

function shield() {
  return `<path d="M12 3.2 19 6.5c-.5 6.7-2.6 10.8-7 14.3-4.4-3.5-6.5-7.6-7-14.3z"/>
  <path d="M12 6.5v10.4M8.4 10.6h7.2"/>`;
}

function heart(color) {
  return `<path d="M12 20c-4.8-3-8-5.8-8-9.3 0-2.1 1.4-3.7 3.4-3.7 1.6 0 2.9.9 4.6 2.9C13.7 7.9 15 7 16.6 7c2 0 3.4 1.6 3.4 3.7 0 3.5-3.2 6.3-8 9.3Z"/>
  <circle cx="12" cy="12.2" r="1.2" fill="${color}" stroke="none"/>`;
}

function cross() {
  return `<path d="M9.2 4.5h5.6v4.7h4.7v5.6h-4.7v4.7H9.2v-4.7H4.5V9.2h4.7z"/>`;
}

function flame() {
  return `<path d="M12.4 3.5c2.9 3 5 5.8 5 9.4 0 4-2.5 7.1-5.4 7.1s-5.4-3.1-5.4-7.1c0-2.3 1-4.1 2.7-5.8.1 2 1.1 3.1 2.1 3.6.8-2.5.8-4.6 1-7.2Z"/>
  <path d="M12.2 14.2c1.1 1 1.8 1.8 1.8 3 0 1.1-.8 2-2 2s-2-.9-2-2c0-1 .6-1.8 2.2-3Z"/>`;
}

function key() {
  return `<circle cx="7.5" cy="12.5" r="3.2"/>
  <path d="M10.7 12.5h9M16 12.5v2.6M18.7 12.5v2"/>`;
}

function lock() {
  return `<path d="M6.2 10.5h11.6v8.2H6.2z"/>
  <path d="M8.4 10.5V8a3.6 3.6 0 0 1 7.2 0v2.5"/>
  <path d="M12 14v2.2"/>`;
}

function gear() {
  return `<circle cx="12" cy="12" r="3.2"/>
  <path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M18.5 5.5l-2.1 2.1M7.6 16.4l-2.1 2.1"/>`;
}

function atom() {
  return `<ellipse cx="12" cy="12" rx="8.2" ry="3.2"/>
  <ellipse cx="12" cy="12" rx="8.2" ry="3.2" transform="rotate(60 12 12)"/>
  <ellipse cx="12" cy="12" rx="8.2" ry="3.2" transform="rotate(120 12 12)"/>
  <circle cx="12" cy="12" r="1"/>`;
}

function candle() {
  return `<path d="M10 10h4v9h-4z"/>
  <path d="M12 3.5c1.5 1.6 2.3 2.9 2.3 4 0 1.4-1 2.5-2.3 2.5s-2.3-1.1-2.3-2.5c0-1.1.8-2.4 2.3-4Z"/>
  <path d="M7 19h10"/>`;
}

function star(color) {
  return `<path d="M12 3.4 14.2 9l5.8.4-4.5 3.7 1.4 5.7L12 15.7l-4.9 3.1 1.4-5.7L4 9.4 9.8 9z"/>
  <circle cx="12" cy="12" r="1" fill="${color}" stroke="none"/>`;
}

function clock() {
  return `<circle cx="12" cy="12" r="8.2"/>
  <circle cx="12" cy="12" r="1"/>
  <path d="M12 5.5v2M12 16.5v2M5.5 12h2M16.5 12h2"/>`;
}

function door() {
  return `<path d="M7 20V4h10v16"/>
  <path d="M10 20V7h7M14.8 12h.1"/>`;
}

function wave() {
  return `<path d="M3 15c2.2-3.2 4.4-3.2 6.6 0s4.4 3.2 6.6 0 3.5-3.2 4.8-1"/>
  <path d="M4 19c2-1.8 4-1.8 6 0s4 1.8 6 0 3.2-1.8 4 0"/>`;
}

function footprint() {
  return `<path d="M8.5 5.2c1.3-.4 2.7.6 3.2 2.5.6 2.1-.1 4.2-1.6 4.7-1.3.4-2.7-.7-3.3-2.6-.6-2.1.1-4.1 1.7-4.6Z"/>
  <path d="M15 12c1.3-.4 2.8.7 3.4 2.6.6 2.1-.1 4.1-1.6 4.6-1.3.4-2.8-.7-3.4-2.6-.6-2.1.1-4.1 1.6-4.6Z"/>`;
}

function mask() {
  return `<path d="M4 8.5c2.4-1.2 5-1.8 8-1.8s5.6.6 8 1.8v3.2c0 3.5-2.2 5.8-5.3 5.8-1.2 0-2.1-.4-2.7-1.2-.6.8-1.5 1.2-2.7 1.2C6.2 17.5 4 15.2 4 11.7z"/>
  <path d="M7.5 11.2h3M13.5 11.2h3M9 14.7c1.9.7 4.1.7 6 0"/>`;
}

function hand() {
  return `<path d="M8 12V7.8a1.2 1.2 0 0 1 2.4 0V12"/>
  <path d="M10.4 12V6.4a1.2 1.2 0 0 1 2.4 0V12"/>
  <path d="M12.8 12V7.4a1.2 1.2 0 0 1 2.4 0V14"/>
  <path d="M8 12l-1.6-1.5a1.2 1.2 0 0 0-1.8 1.6l4.1 5.2c1 1.2 2.4 1.9 4 1.9h1.7c2 0 3.6-1.6 3.6-3.6V10"/>`;
}

function hammer() {
  return `<path d="M13.2 5.2 17 9l-2.2 2.2L11 7.4z"/>
  <path d="M10.2 8.2 4.5 13.9l2.6 2.6 5.7-5.7"/>
  <path d="M14.7 4.2c1.8-.5 3.4 0 4.8 1.4"/>`;
}

function mountain() {
  return `<path d="M3.5 19 9.5 7l4 6 2-3.2L21 19z"/>
  <path d="M9.5 7 11 12l2.5 1"/>`;
}

function scroll() {
  return `<path d="M7 5.2h9.5c1 0 1.8.8 1.8 1.8S17.5 8.8 16.5 8.8H15"/>
  <path d="M7 5.2c1 0 1.8.8 1.8 1.8v10c0 1-.8 1.8-1.8 1.8"/>
  <path d="M7 18.8h10c-1 0-1.8-.8-1.8-1.8V8.8"/>
  <path d="M11 10.5h2.4M11 13.2h2.2"/>`;
}

function circuit() {
  return `<path d="M5 12h5V5h9"/>
  <path d="M10 12v7h9"/>
  <path d="M10 12h9"/>
  <circle cx="5" cy="12" r="1.4"/><circle cx="19" cy="5" r="1.4"/><circle cx="19" cy="12" r="1.4"/><circle cx="19" cy="19" r="1.4"/>`;
}

function tree() {
  return `<path d="M12 20v-6"/>
  <path d="M6 14c2.2-5.8 3.8-8.8 6-11 2.2 2.2 3.8 5.2 6 11z"/>
  <path d="M8.5 10.5h7M9.5 14h5"/>`;
}

function anchor() {
  return `<circle cx="12" cy="5" r="2"/>
  <path d="M12 7v12M7 10h10M5 15c.6 3.2 2.8 5 7 5s6.4-1.8 7-5M5 15h3M19 15h-3"/>`;
}

function speech() {
  return `<path d="M5 5.5h14v9.5H10l-4.5 4v-4H5z"/>
  <path d="M8.5 9h7M8.5 12h4"/>`;
}

function explosion() {
  return `<path d="M12 3.5 14 9l5.5-2.3-2.3 5.5 3.3 4.3-5.6-.5-2.9 4.5L9.1 16l-5.6.5 3.3-4.3-2.3-5.5L10 9z"/>`;
}

function fist() {
  return `<path d="M7 10V7.4a1.3 1.3 0 0 1 2.6 0V10M9.6 10V6.6a1.3 1.3 0 0 1 2.6 0V10M12.2 10V7a1.3 1.3 0 0 1 2.6 0v3M14.8 10V8a1.3 1.3 0 0 1 2.6 0v5.8c0 3.4-2.3 5.4-5.4 5.4S6.6 17.2 6.6 14v-4z"/>`;
}

function crosshair(color) {
  return `<circle cx="12" cy="12" r="7"/>
  <circle cx="12" cy="12" r="1.4" fill="${color}" stroke="none"/>
  <path d="M12 2.8v4M12 17.2v4M2.8 12h4M17.2 12h4"/>`;
}

function running() {
  return `<circle cx="13" cy="4.5" r="1.8"/>
  <path d="M10 9.5 13 8l2.5 3.5 3 .6"/>
  <path d="M12.2 12.5 9.5 19M14.8 13.2l2.2 5.8M9.8 9.8 6 12.8"/>`;
}

function card() {
  return `<path d="M7.5 4.5h9l1.5 15h-9z"/>
  <path d="M5.5 6.8 8 19.5"/>
  <path d="M11 10.2c1.5-1.7 3.1-1.7 4.6 0-1.5 1.7-3.1 1.7-4.6 0Z"/>`;
}

function gun(short = true) {
  return short
    ? `<path d="M4 9h10.5c1.9 0 3.5 1.6 3.5 3.5V14h-4v-1c0-.6-.4-1-1-1H4z"/>
  <path d="M6.5 12v5l-2.5 1.5V12"/>
  <path d="M11 13.8c1.7 1 2.9 2.4 3.6 4.2"/>`
    : `<path d="M3 11h16c1.2 0 2 .8 2 2v1H3z"/>
  <path d="M7 14c2.8 1.4 5.5 1.4 8.3 0M18 10l2-2M6 11V8"/>`;
}

function blade() {
  return `<path d="M5 19 17.2 6.8 21 4c-.8 2.1-1.6 3.6-3.2 5.2L5.8 21z"/>
  <path d="M5.5 16.8 7.2 18.5M4 13l4 4"/>`;
}

function bow() {
  return `<path d="M17 4c-4 4.8-4 11.2 0 16"/>
  <path d="M17 4v16M5 12h11M5 12l3-2M5 12l3 2"/>`;
}

function grenade() {
  return `<path d="M9 9h6l2 2.3v5.2c0 2.2-1.8 4-4 4h-2c-2.2 0-4-1.8-4-4v-5.2z"/>
  <path d="M9.5 7h5M12 7V4.5M10 13.5h4M12 11.5v4"/>`;
}

function bag() {
  return `<path d="M5 9h14v10H5z"/>
  <path d="M8.5 9V7c0-1.7 1.5-3 3.5-3s3.5 1.3 3.5 3v2M5 13h14"/>`;
}

function camera(color) {
  return `<path d="M4 8.5h16v10H4z"/>
  <path d="M7 8.5 8.5 6h7L17 8.5"/>
  <circle cx="12" cy="13.5" r="3"/>
  <circle cx="12" cy="13.5" r="1" fill="${color}" stroke="none"/>`;
}

function vial() {
  return `<path d="M9 4.5h6M10 4.5v4.8l-4.2 7.4c-.8 1.4.2 3.1 1.8 3.1h8.8c1.6 0 2.6-1.7 1.8-3.1L14 9.3V4.5"/>
  <path d="M8.2 15h7.6"/>`;
}

function lantern() {
  return `<path d="M8 9h8l1 10H7z"/>
  <path d="M9 9V6.8c0-1.5 1.3-2.8 3-2.8s3 1.3 3 2.8V9M10 14c.6-1.4 1.2-2.4 2-3.2.8.8 1.4 1.8 2 3.2"/>`;
}

function compass(color) {
  return `<circle cx="12" cy="12" r="8"/>
  <path d="M15.8 8.2 13.6 14l-5.4 1.8 2.2-5.8z"/>
  <circle cx="12" cy="12" r="0.8" fill="${color}" stroke="none"/>`;
}

function tent() {
  return `<path d="M12 4.5 21 19H3z"/>
  <path d="M12 4.5v14.5M7.8 19 12 8.5 16.2 19"/>`;
}

function fingerprint() {
  return `<path d="M8 13.5c0-3.2 1.8-5.3 4-5.3s4 2.1 4 5.3"/>
  <path d="M6 12.5c0-4.4 2.5-7.2 6-7.2s6 2.8 6 7.2"/>
  <path d="M10 14.2c0-1.5.8-2.5 2-2.5s2 1 2 2.5c0 2.2-1.3 3.8-3.2 5.3"/>
  <path d="M7.5 17c1.6 2 3.8 2.8 6.5 2.2M16.5 17c.7-1.3 1-2.8 1-4.5"/>`;
}

function microphone() {
  return `<path d="M9 6.5a3 3 0 0 1 6 0v5a3 3 0 0 1-6 0z"/>
  <path d="M5.5 11.5c0 3.6 2.6 6 6.5 6s6.5-2.4 6.5-6M12 17.5V21M8.5 21h7"/>`;
}

function syringe() {
  return `<path d="M15.5 4.5 19.5 8.5M17.5 6.5 8 16l-3 1 1-3 9.5-9.5"/>
  <path d="M12.5 7.5 16.5 11.5M9.8 10.2l2.5 2.5M7.2 12.8l2.5 2.5"/>`;
}

function pill() {
  return `<path d="M8.1 15.9a4.2 4.2 0 0 1 0-5.9l3.9-3.9a4.2 4.2 0 1 1 5.9 5.9L14 15.9a4.2 4.2 0 0 1-5.9 0Z"/>
  <path d="M11 7.2 16.8 13"/>`;
}

function drop() {
  return `<path d="M12 3.5c3 3.4 5 6.2 5 9.3a5 5 0 0 1-10 0c0-3.1 2-5.9 5-9.3Z"/>
  <path d="M9.5 14.5c1.6 1.1 3.4 1.1 5 0"/>`;
}

function snowflake() {
  return `<path d="M12 3v18M5.2 6.8l13.6 10.4M18.8 6.8 5.2 17.2"/>
  <path d="M8.5 5.8 12 8l3.5-2.2M8.5 18.2 12 16l3.5 2.2"/>`;
}

function crown() {
  return `<path d="M5 17h14l1-9-4.5 3-3.5-6-3.5 6L4 8z"/>
  <path d="M6.5 20h11"/>`;
}

function brush() {
  return `<path d="M14 4.5 19.5 10 10 19.5 4.5 14z"/>
  <path d="M8 16c-2.2.5-3.5 1.8-4 4 2.2-.5 3.5-1.8 4-4ZM12 8l4 4"/>`;
}

function badge() {
  return `<path d="M12 3.5 18.5 6v5.2c0 4.5-2.6 7.5-6.5 9.3-3.9-1.8-6.5-4.8-6.5-9.3V6z"/>
  <path d="M12 7.5 13.3 11l3.7.2-2.9 2.3.9 3.5-3-1.9-3 1.9.9-3.5L7 11.2l3.7-.2z"/>`;
}

function crowbar() {
  return `<path d="M6 19 17 8c1.2-1.2 1.2-2.6 0-3.8"/>
  <path d="M14.8 4.2c2.6-.7 4.3.1 5.2 2.3M4 17l3 3"/>`;
}

function cuffs() {
  return `<circle cx="8" cy="13" r="4"/><circle cx="16" cy="13" r="4"/>
  <path d="M11.6 11.3h.8M5.5 9.5 4 7M18.5 9.5 20 7"/>`;
}

function box() {
  return `<path d="M5 8h14v11H5z"/>
  <path d="M5 8l3-3h8l3 3M12 8v11M8 5l4 3 4-3"/>`;
}

function chair() {
  return `<path d="M8 4.5h7v7H8z"/>
  <path d="M7 11.5h10M8.5 11.5V20M15.5 11.5V20M8.5 16h7"/>`;
}

function weaponGlyph(name, color) {
  const lower = name.toLowerCase();
  if (has(lower, /improvised/)) return `<path d="M6 20 15 8l3-4-1 5 2 2-5 1-6 9z"/><path d="M8 15l4 3M13 10l3 3"/>`;
  if (has(lower, /knife|dagger/)) return `<path d="M12 3.5 14.2 8 12 20.5 9.8 8z"/>
  <path d="M8 8h8M9 17c2 1.2 4 1.2 6 0"/>
  <circle cx="12" cy="6.8" r="1"/>`;
  if (has(lower, /sword|machete/)) return `<path d="M5 19 16.5 7.5 21 4l-3.5 4.5L6 20z"/><path d="M4 14l6 6M8 15.5 15.5 8"/>`;
  if (has(lower, /heavy melee/)) return `<path d="M6 19 17 8"/><path d="M14 5.5 18.5 10 20 8.5 15.5 4z"/><path d="M4.5 17.5 7.5 20.5"/>`;
  if (has(lower, /pistol.*light/)) return `<path d="M5 10h9c1.5 0 2.8 1.3 2.8 2.8V14H13v-1H5z"/><path d="M7 13v4l-2 1.2V13"/>`;
  if (has(lower, /pistol.*heavy/)) return `<path d="M3.5 8.6h12.2c2.5 0 4.5 2 4.5 4.5v1h-5.1v-1.2c0-.8-.6-1.4-1.4-1.4H3.5z"/>
  <circle cx="11.7" cy="12.8" r="1.8"/>
  <path d="M6.3 11.5v6.8L3.4 20v-8.5M14.4 15.1c.9 1.2 1.5 2.5 1.9 4M17.7 8.7l2.1-2.1"/>`;
  if (has(lower, /pistol/)) return `${gun(true)}\n  <circle cx="11.5" cy="12" r="1.2"/>`;
  if (has(lower, /shotgun/)) return `<path d="M3 10.5h17M3 13.5h17"/><path d="M5 14c2.8 1.4 5.7 1.4 8.6 0M17 9l2-2"/>`;
  if (has(lower, /sniper/)) return `<path d="M3 12h17M6 10h8M15 9l3 3-3 3"/><circle cx="10" cy="10" r="1.5"/><path d="M8 14c2.8 1.4 5.7 1.4 8.5 0"/>`;
  if (has(lower, /assault/)) return `<path d="M3 11h16c1.2 0 2 .8 2 2v1H3z"/><path d="M9 14l2 5h4l-1.5-5M6 11V8h5M17 10l2-2"/>`;
  if (has(lower, /semi-auto/)) return `<path d="M3 11h16c1.2 0 2 .8 2 2v1H3z"/><path d="M10 14l1.4 4.5M6 11V8h4M16 10l2-2"/>`;
  if (has(lower, /bolt|lever|rifle/)) return `<path d="M3 11h16c1.2 0 2 .8 2 2v1H3z"/><path d="M7 14c2.8 1.4 5.5 1.4 8.3 0M17 10l2-2M12 10l2-2"/>`;
  if (has(lower, /crossbow/)) return `<path d="M5 12h14M12 6v12M6 7c4 3.3 8 3.3 12 0M6 17c4-3.3 8-3.3 12 0"/>`;
  if (has(lower, /bow/)) return bow();
  if (has(lower, /shield/)) return shield();
  if (has(lower, /unarmed/)) return fist();
  if (has(lower, /thrown.*light/)) return `<path d="M5 18c4.5-5.5 9.2-9.2 14-11"/><path d="M14 6.5 19 7l-2 4.6M5 18l4-1"/>`;
  if (has(lower, /thrown|grenade/)) return `<path d="M5 18c4.5-5.5 9.2-9.2 14-11"/><path d="M12 8 19 7l-3 6M5 18l5-1"/>`;
  if (has(lower, /club|baton/)) return hammer();
  if (has(lower, /spear|polearm/)) return `<path d="M12 21V5"/><path d="M12 3 15 7h-6z"/><path d="M8 13h8"/>`;
  return color ? blade() : blade();
}

function armorGlyph(name) {
  const lower = name.toLowerCase();
  if (has(lower, /improvised/)) return `<path d="M6 8.5 12 5l6 3.5-1.1 9.5H7.1z"/>
  <path d="M8 10.5h8M7.6 14h8.8M9.2 7.2l-.8 11.2M14.8 7.2l.8 11.2"/>`;
  if (has(lower, /light/)) return `<path d="M8 4.5 12 7l4-2.5 2.2 3.2-1.8 11.8H7.6L5.8 7.7z"/>
  <path d="M12 7v12.5M8.2 11.5h7.6M9 15.5h6"/>`;
  if (has(lower, /medium/)) return `<path d="M7 6.2 12 4l5 2.2v12.4c-1.8.9-3.4 1.4-5 1.4s-3.2-.5-5-1.4z"/>
  <path d="M7.4 10h9.2M7.4 14h9.2M12 4v16M9 8l6 4M15 8l-6 4"/>`;
  if (has(lower, /heavy/)) return `<path d="M6 11a6 6 0 0 1 12 0v8H6z"/>
  <path d="M6 11h12M8 14h8M8.5 19v-5M12 19v-8M15.5 19v-5"/>`;
  if (has(lower, /helmet/)) return `<path d="M5 13a7 7 0 0 1 14 0v5H5z"/><path d="M5 13h14M9 18v-3M15 18v-3"/>`;
  if (has(lower, /coat|vest|jacket/)) return `<path d="M8 4.5 12 7l4-2.5 3 3.5-2 11.5H7L5 8z"/><path d="M12 7v12.5M8 11h8"/>`;
  return shield();
}

function talentGlyph(name, seed, color) {
  const lower = name.toLowerCase();
  if (has(lower, /investigator/)) return `${lens()}\n  ${eye(color)}`;
  if (has(lower, /interrogator/)) return `${speech()}\n  <path d="M8 18c2.7-1.4 5.3-1.4 8 0"/>`;
  if (has(lower, /researcher/)) return `${book()}\n  <circle cx="17" cy="16.5" r="2.4"/>`;
  if (has(lower, /deception/)) return mask();
  if (has(lower, /empath/)) return heart(color);
  if (has(lower, /intimidation/)) return `<path d="M5 6.5 12 3l7 3.5v5.2c0 4.4-2.8 7.2-7 9-4.2-1.8-7-4.6-7-9z"/><path d="M8.5 10h2M13.5 10h2M9 14.5c2-.8 4-.8 6 0"/>`;
  if (has(lower, /observation/)) return eye(color);
  if (has(lower, /persuasion/)) return `${speech()}\n  ${hand()}`;
  if (has(lower, /resources/)) return `<circle cx="8" cy="13" r="3"/><circle cx="14" cy="10" r="3"/><circle cx="16" cy="16" r="3"/>`;
  if (has(lower, /streetwise/)) return `<path d="M4 20V6l5-2 6 2 5-2v14l-5 2-6-2z"/><path d="M9 4v14M15 6v14"/>`;
  if (has(lower, /tracker/)) return footprint();
  if (has(lower, /close[- ]combat/)) return fist();
  if (has(lower, /command/)) return `<path d="M6 20V4"/><path d="M6 5h11l-2 4 2 4H6"/>`;
  if (has(lower, /evasion/)) return `<path d="M4 12c4-5 8-5 12 0"/><path d="M16 7l4 5-4 5"/><path d="M5 18c2.8-1.5 5.6-1.5 8.4 0"/>`;
  if (has(lower, /marksman/)) return crosshair(color);
  if (has(lower, /performance/)) return mask();
  if (has(lower, /protector/)) return shield();
  if (has(lower, /tactics/)) return `<path d="M4 5h16v14H4z"/><path d="M8 9h4v4H8zM14 7l3 2-3 2M10 16l-3-2 3-2"/>`;
  if (has(lower, /acrobatics/)) return `<circle cx="13" cy="5" r="1.8"/><path d="M7 14c2.8-5.2 6.2-6.4 10-3.5M9 18l3-5 4 5"/>`;
  if (has(lower, /athletics/)) return running();
  if (has(lower, /demolitions/)) return explosion();
  if (has(lower, /infiltration/)) return key();
  if (has(lower, /medicine|first[- ]aid/)) return cross();
  if (has(lower, /occult/)) return `${eye(color)}\n  ${star(color)}`;
  if (has(lower, /science/)) return atom();
  if (has(lower, /sleight/)) return card();
  if (has(lower, /stealth/)) return `<path d="M6 20c1-5.7 3-9.5 6-13 3 3.5 5 7.3 6 13"/><path d="M8.2 12.5c2.5 1.1 5.1 1.1 7.6 0"/>`;
  if (has(lower, /composure/)) return `<circle cx="12" cy="12" r="8"/><path d="M8.5 12h7M9.5 15.5c1.7 1 3.3 1 5 0"/>`;
  if (has(lower, /history/)) return scroll();
  if (has(lower, /resolve/)) return mountain();
  if (has(lower, /technology/)) return circuit();
  if (has(lower, /theology/)) return candle();
  if (has(lower, /craft/)) return hammer();
  if (has(lower, /endurance/)) return heart(color);
  if (has(lower, /grounded/)) return anchor();
  if (has(lower, /operate/)) return gear();
  if (has(lower, /survival/)) return tree();
  return abstractSigil(seed, color, 5);
}

function dreadloreGlyph(name, seed, color) {
  const lower = name.toLowerCase();
  if (has(lower, /autopsy/)) return `<path d="M5 19h14"/><path d="M7 15h10"/><path d="M12 5v10"/><path d="M9 8l6 4M15 8l-6 4"/>`;
  if (has(lower, /index/)) return `<path d="M6 4h10l2 2v14H6z"/><path d="M16 4v4h4M8.5 9h5M8.5 12h7M8.5 15h4"/>`;
  if (has(lower, /map/)) return `<path d="M4 19V6l5-2 6 2 5-2v13l-5 2-6-2z"/><path d="M9 4v13M15 6v13M6.5 10.5l3 2 5-3 3 2"/>`;
  if (has(lower, /name/)) return `<path d="M5 8h14v8H5z"/><path d="M8 12h8"/><path d="M11 5.5 12 4l1 1.5M11 18.5l1 1.5 1-1.5"/>`;
  if (has(lower, /witness|eye|reflection/)) return eye(color);
  if (has(lower, /door|room|house/)) return door();
  if (has(lower, /confession|mouth|choir/)) return `<path d="M5 12c4-3.2 10-3.2 14 0-4 3.2-10 3.2-14 0Z"/><path d="M8 12h8"/><path d="M12 8v8"/>`;
  if (has(lower, /candle/)) return candle();
  if (has(lower, /clock|hour/)) return clock();
  if (has(lower, /angle/)) return `<path d="M4 19 19 4M8 5h11v11M5 8l11 11"/>`;
  if (has(lower, /chair|debt/)) return chair();
  if (has(lower, /star|favor/)) return star(color);
  if (has(lower, /shadow/)) return `<path d="M8 20c3-2.2 5-5.1 5-8.7 0-2.8-1-5.2-3-7.3 4.8 1.7 8 5.7 8 10.5 0 2.2-.7 4-2.1 5.5z"/><path d="M6 18c2.7-1.4 5.3-1.4 8 0"/>`;
  if (has(lower, /grave/)) return `<path d="M7 20V9a5 5 0 0 1 10 0v11"/><path d="M5 20h14M9 12h6M10 15h4"/>`;
  if (has(lower, /wound|blood|nerve/)) return `<path d="M12 3.5c3 3.4 5.1 6.2 5.1 9.4a5.1 5.1 0 0 1-10.2 0c0-3.2 2.1-6 5.1-9.4Z"/><path d="M9.5 13c1.6 1.2 3.4 1.2 5 0"/>`;
  if (has(lower, /footstep/)) return footprint();
  if (has(lower, /shore|salt/)) return wave();
  if (has(lower, /lock|closed|uninvited/)) return lock();
  if (has(lower, /weather|skin/)) return `<path d="M6 16.5h10.5a3.5 3.5 0 0 0 .7-6.9A5 5 0 0 0 8 8a3.8 3.8 0 0 0-2 7"/><path d="M8 19l1-2M12 19l1-2M16 19l1-2"/>`;
  if (has(lower, /hunger/)) return `<path d="M5 8c3.5-2 10.5-2 14 0v8c-3.5 2-10.5 2-14 0z"/><path d="M7.5 9.2 9 13l1.5-3.8M13.5 9.2 15 13l1.5-3.8"/>`;
  if (has(lower, /breath/)) return `<path d="M10 4v7c0 2-1.4 3.5-3.2 3.5S3.5 13 3.5 11V8"/><path d="M14 4v7c0 2 1.4 3.5 3.2 3.5s3.3-1.5 3.3-3.5V8"/><path d="M8 18c2.6-1.4 5.4-1.4 8 0"/>`;
  return abstractSigil(seed, color, 6);
}

function equipmentGlyph(name, seed, color) {
  const lower = name.toLowerCase();
  if (has(lower, /forensics/)) return `${fingerprint()}\n  <circle cx="16.5" cy="16.5" r="2.2"/>`;
  if (has(lower, /research/)) return book();
  if (has(lower, /lockpick/)) return `${key()}\n  <path d="M16 7.5 20 3.5"/>`;
  if (has(lower, /surveillance/)) return `${camera(color)}\n  <path d="M7 5c3.5-1.8 6.5-1.8 10 0"/>`;
  if (has(lower, /recording/)) return microphone();
  if (has(lower, /flashlight|lantern/)) return `<path d="M5 9h7l4 4-5 5-6-6z"/><path d="M16 8c2.1 1.1 3.7 2.7 4.8 4.8-2.1-.5-3.7-1.6-4.8-3.5"/>`;
  if (has(lower, /^camera$/)) return camera(color);
  if (has(lower, /advanced medical/)) return `${cross()}\n  ${syringe()}`;
  if (has(lower, /basic medical/)) return `<path d="M6 8h12v11H6z"/><path d="M9 8V6h6v2M12 11v5M9.5 13.5h5"/>`;
  if (has(lower, /bandage/)) return `<path d="M7 16.5a4.5 4.5 0 0 1 0-9l10 0a4.5 4.5 0 0 1 0 9z"/><path d="M10 7.5v9M14 7.5v9M11.5 12h1"/>`;
  if (has(lower, /dose/)) return pill();
  if (has(lower, /antidote/)) return vial();
  if (has(lower, /sedative|syringe/)) return syringe();
  if (has(lower, /stimulant/)) return `<path d="M13 3.5 6 13h5l-1 7.5 7-10h-5z"/>`;
  if (has(lower, /medical/)) return cross();
  if (has(lower, /book|occult reference|text|journal|notebook/)) return book();
  if (has(lower, /camera/)) return camera(color);
  if (has(lower, /binocular/)) return `<path d="M5 9h5v7H5zM14 9h5v7h-5z"/><path d="M10 12h4M7 9l1.5-3M16 9l-1.5-3"/>`;
  if (has(lower, /radio|phone|signal/)) return `<path d="M7 8h10v11H7z"/><path d="M10 8 8 4M10 12h4M10 15h2M15 15h.1"/>`;
  if (has(lower, /handcuff|restraint/)) return cuffs();
  if (has(lower, /disguise/)) return mask();
  if (has(lower, /conceal/)) return card();
  if (has(lower, /lock/)) return lock();
  if (has(lower, /rope|climb/)) return `<path d="M8 5c3-2 5-2 8 0M8 9c3-2 5-2 8 0M8 13c3-2 5-2 8 0M8 17c3-2 5-2 8 0"/><path d="M12 4v16"/>`;
  if (has(lower, /tent/)) return tent();
  if (has(lower, /rations/)) return `<path d="M5 14c2-4.2 4.5-6.3 7.5-6.3S18 9.8 19 14z"/><path d="M5 14h14v3H5zM8 11h.1M12 10h.1M15 12h.1"/>`;
  if (has(lower, /water/)) return drop();
  if (has(lower, /fire|fuel|incendiary/)) return flame();
  if (has(lower, /compass|map/)) return compass(color);
  if (has(lower, /cold|weather/)) return snowflake();
  if (has(lower, /candle|ritual/)) return `${candle()}\n  ${star(color)}`;
  if (has(lower, /flare|glasses/)) return lantern();
  if (has(lower, /flashbang|firecracker/)) return explosion();
  if (has(lower, /smoke|gas/)) return `<path d="M6 16.5h10.5a3.2 3.2 0 0 0 .4-6.4A4.5 4.5 0 0 0 8.2 9 3.5 3.5 0 0 0 6 16.5Z"/><path d="M6 20c3-1.2 6-1.2 9 0"/>`;
  if (has(lower, /grenade|pipe bomb/)) return grenade();
  if (has(lower, /demolition charge/)) return `<path d="M7 9h10v9H7z"/><path d="M9 9V6h6v3M12 12v3M10.5 13.5h3M15 6c2-.6 3.4-.1 4 1.5"/>`;
  if (has(lower, /demolition kit/)) return `${bag()}\n  ${explosion()}`;
  if (has(lower, /explosive/)) return explosion();
  if (has(lower, /ward|charm/)) return `${shield()}\n  ${star(color)}`;
  if (has(lower, /containment|protective case/)) return `${box()}\n  ${lock()}`;
  if (has(lower, /forbidden text/)) return `${book()}\n  ${eye(color)}`;
  if (has(lower, /sensor|detector/)) return `${circuit()}\n  ${eye(color)}`;
  if (has(lower, /backpack/)) return `<path d="M7 8h10v12H7z"/><path d="M9 8V6c0-1.3 1.3-2.5 3-2.5s3 1.2 3 2.5v2M7 13h10M5 10v6M19 10v6"/>`;
  if (has(lower, /clothing/)) return `<path d="M8 5 12 7.5 16 5l3 4-2 11H7L5 9z"/><path d="M12 7.5V20"/>`;
  if (has(lower, /tool kit/)) return bag();
  if (has(lower, /crowbar/)) return crowbar();
  if (has(lower, /tool|kit|repair/)) return bag();
  return abstractSigil(seed, color, 4);
}

function backgroundGlyph(name, seed, color) {
  const lower = name.toLowerCase();
  if (has(lower, /academic/)) return `${book()}\n  ${lens()}`;
  if (has(lower, /student/)) return `${book()}\n  <path d="M6 7 12 4l6 3-6 3zM8 9v3c2.6 1.2 5.4 1.2 8 0V9"/>`;
  if (has(lower, /aristocrat|elite/)) return crown();
  if (has(lower, /artist/)) return brush();
  if (has(lower, /business/)) return `<circle cx="8" cy="13" r="3"/><circle cx="14" cy="10" r="3"/><circle cx="16" cy="16" r="3"/>`;
  if (has(lower, /clergy|spiritual/)) return candle();
  if (has(lower, /criminal/)) return `${key()}\n  ${mask()}`;
  if (has(lower, /drifter/)) return footprint();
  if (has(lower, /engineer/)) return gear();
  if (has(lower, /government|civil/)) return badge();
  if (has(lower, /journalist/)) return `${microphone()}\n  ${camera(color)}`;
  if (has(lower, /law enforcement/)) return badge();
  if (has(lower, /urban/)) return `<path d="M4 20V8h5v12M9 20V4h6v16M15 20v-9h5v9"/><path d="M6 11h1M6 14h1M11 7h1M11 10h1M17 14h1"/>`;
  if (has(lower, /rural/)) return tree();
  if (has(lower, /medical/)) return cross();
  if (has(lower, /military|veteran/)) return shield();
  if (has(lower, /occult/)) return eye(color);
  if (has(lower, /student/)) return book();
  if (has(lower, /sailor|traveler/)) return compass(color);
  if (has(lower, /trade|labor/)) return hammer();
  return abstractSigil(seed, color, 5);
}

function driveGlyph(name, seed, color) {
  const lower = name.toLowerCase();
  if (has(lower, /curiosity/)) return `${lens()}\n  ${key()}`;
  if (has(lower, /duty/)) return shield();
  if (has(lower, /guilt/)) return `<path d="M12 4v10"/><path d="M8 9c-2.2 2.4-2.2 5.7 0 8s5.8 2.3 8 0 2.2-5.6 0-8"/><path d="M9 19h6"/>`;
  if (has(lower, /compulsion/)) return `<path d="M12 4c4.5 0 8 3.5 8 8s-3.5 8-8 8c-3.4 0-6.3-2-7.4-5"/><path d="M12 8c2.2 0 4 1.8 4 4s-1.8 4-4 4c-1.7 0-3.1-1-3.7-2.5"/>`;
  if (has(lower, /greed/)) return crown();
  if (has(lower, /legacy/)) return scroll();
  if (has(lower, /truth|know|secret/)) return eye(color);
  if (has(lower, /protect|save|family/)) return shield();
  if (has(lower, /revenge|justice|vengeance/)) return blade();
  if (has(lower, /power|ambition|prove/)) return flame();
  if (has(lower, /faith|redemption/)) return candle();
  if (has(lower, /love|loyal/)) return heart(color);
  if (has(lower, /freedom|escape/)) return key();
  return abstractSigil(seed, color, 5);
}

function renderIcon(packName, name, type) {
  const seed = hash(`${packName}:${name}`);
  const color = COLORS[type] ?? COLORS.equipment;
  let symbol;
  if (type === "background") symbol = backgroundGlyph(name, seed, color);
  else if (type === "drive") symbol = driveGlyph(name, seed, color);
  else if (type === "talent") symbol = talentGlyph(name, seed, color);
  else if (type === "dreadlore") symbol = dreadloreGlyph(name, seed, color);
  else if (type === "weapon") symbol = weaponGlyph(name, color);
  else if (type === "armor") symbol = armorGlyph(name);
  else symbol = equipmentGlyph(name, seed, color);
  return symbolSvg(type, seed, symbol);
}

function main() {
  const source = readFileSync(SOURCE, "utf8");
  let total = 0;

  for (const [packName, config] of Object.entries(PACKS)) {
    const text = section(source, config.start, config.end);
    const names = ["backgrounds", "drives", "dreadlore"].includes(packName)
      ? namesFromArraySection(text)
      : namesFromObjectSection(text);

    const dir = `${ROOT}/${packName}`;
    mkdirSync(dir, { recursive: true });

    for (const name of names) {
      const file = `${dir}/${slugify(name)}.svg`;
      writeFileSync(file, renderIcon(packName, name, config.type));
      total++;
    }

    console.log(`Generated ${names.length} ${packName} icons.`);
  }

  console.log(`Generated ${total} compendium icons.`);
}

main();
