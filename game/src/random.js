// random.js — one seeded stream for the whole city, plus tiny math helpers.
// Coral City is built from a mulberry32 generator: the same seed always
// raises the same blocks, palms and parked cars, which is what makes the
// screenshot scenes reproducible.
'use strict';

let _seedState = 1;

function seedRng(n) {
  _seedState = (n >>> 0) || 1;
}

function rnd() {
  _seedState |= 0;
  _seedState = (_seedState + 0x6D2B79F5) | 0;
  let t = Math.imul(_seedState ^ (_seedState >>> 15), 1 | _seedState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function rr(a, b) { return a + rnd() * (b - a); }
function ri(a, b) { return a + Math.floor(rnd() * (b - a + 1)); }
function pick(arr) { return arr[Math.floor(rnd() * arr.length)]; }
function chance(p) { return rnd() < p; }

// -- math helpers shared by physics, AI and rendering ----------------------
const TAU = Math.PI * 2;

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function lerp(a, b, t) { return a + (b - a) * t; }

function dist(ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

function angNorm(a) {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}

// Turn `cur` toward `target` by at most `maxStep` radians.
function angTurn(cur, target, maxStep) {
  const d = angNorm(target - cur);
  return cur + clamp(d, -maxStep, maxStep);
}
