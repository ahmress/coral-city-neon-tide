// world.js — Coral City itself: a 48x36 coastal grid with three districts.
// Marina Bay works the west (docks, warehouses), the Neon Strip glows in the
// middle (casino, towers), and Palmetto Beach owns the east and the whole
// southern shore — sand, a wooden pier, and a lighthouse on the rocks.
'use strict';

const World = {
  roads: new Set(),
  roadCells: [],
  buildings: [],
  bmap: new Map(),
  palms: [],
  lamps: [],
  crates: [],
  rocks: new Set(),
  casinoPos: null,
  warehousePos: null,
  dockPos: null,
  resortPos: null,
  lighthousePos: null,
  playerStart: null,

  key(c, r) { return c + ',' + r; },

  isRoadCell(c, r) {
    if (r === BOARDWALK_ROW) return c >= 0 && c < COLS;
    if (r < 0 || r >= BEACH_ROW || c < 0 || c >= COLS) return false;
    return STREET_COLS.indexOf(c) >= 0 || AVENUE_ROWS.indexOf(r) >= 0;
  },

  isPierCell(c, r) { return c === PIER_COL && r >= BEACH_ROW && r < ROWS; },
  isWaterCell(c, r) { return r >= WATER_ROW && !this.isPierCell(c, r) && !this.rocks.has(this.key(c, r)); },
  isSandCell(c, r) { return r >= BEACH_ROW && r < WATER_ROW && !this.isPierCell(c, r); },

  build(seed) {
    seedRng(seed);
    this.roads.clear(); this.roadCells = [];
    this.buildings = []; this.bmap.clear();
    this.palms = []; this.lamps = []; this.crates = []; this.rocks.clear();

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (this.isRoadCell(c, r)) {
          this.roads.add(this.key(c, r));
          this.roadCells.push({ c, r });
        }
      }
    }
    // the rocky point that holds the lighthouse, south-east in the water
    [[45, 33], [46, 33], [47, 33], [45, 34], [46, 34], [47, 34], [46, 35]].forEach(([c, r]) => {
      this.rocks.add(this.key(c, r));
    });

    const signColors = ['#ff3ea5', '#22d8ff', '#ffd23e', '#7dff6a', '#ff7a3c'];
    for (let r = 0; r < BEACH_ROW; r++) {
      for (let c = 0; c < COLS; c++) {
        if (this.isRoadCell(c, r) || r === BOARDWALK_ROW) continue;
        if (!chance(0.84)) continue; // some blocks stay open lots
        const district = districtAt(c, r);
        const inset = district === 'Marina Bay' ? rr(6, 12) : rr(9, 16);
        const b = {
          c, r,
          x: c * TILE + inset, y: r * TILE + inset,
          w: TILE - inset * 2, h: TILE - inset * 2,
          style: district === 'Marina Bay' ? 'warehouse' : (district === 'Neon Strip' ? 'tower' : 'resort'),
          shade: rr(0.82, 1.12),
          sign: null, signColor: '#22d8ff'
        };
        if (b.style === 'tower' && chance(0.5)) {
          b.sign = pick(NEON_SIGNS);
          b.signColor = pick(signColors);
        }
        this.buildings.push(b);
        this.bmap.set(this.key(c, r), b);
      }
    }
    // landmarks: the casino, a cold-storage warehouse, the grand hotel
    this._landmark(22, 14, 'casino', 'CASINO', '#ffd23e');
    this._landmark(6, 20, 'warehouse', null, null);
    this._landmark(34, 14, 'resort', 'AZUL', '#22d8ff');

    // palms on the sand and along the boardwalk
    for (let c = 0; c < COLS; c++) {
      for (const r of [BEACH_ROW, BEACH_ROW + 1]) {
        if (this.isPierCell(c, r)) continue;
        if (chance(0.34)) this.palms.push({ x: c * TILE + rr(14, 82), y: r * TILE + rr(14, 82), s: rr(0.8, 1.25) });
      }
      if (chance(0.5)) this.palms.push({ x: c * TILE + rr(8, 88), y: BOARDWALK_ROW * TILE + rr(6, 20), s: rr(0.7, 1.05) });
    }
    // street lamps along every avenue
    for (const r of AVENUE_ROWS.concat([BOARDWALK_ROW])) {
      for (let c = 1; c < COLS; c += 3) {
        this.lamps.push({ x: c * TILE + 6, y: r * TILE + 6 });
        this.lamps.push({ x: c * TILE + TILE - 6, y: r * TILE + TILE - 6 });
      }
    }
    // dock crates in the marina yard
    for (let i = 0; i < 26; i++) {
      this.crates.push({ x: rr(8, 2 * TILE - 30), y: rr(19 * TILE + 8, 23 * TILE - 30), w: rr(18, 30), h: rr(18, 30), tone: pick(['#8a6f4d', '#5d7a8c', '#77685a']) });
    }

    this.casinoPos = { x: 22.5 * TILE, y: 15 * TILE + 18 };
    this.warehousePos = { x: 6.5 * TILE, y: 21 * TILE + 16 };
    this.dockPos = { x: 1.5 * TILE, y: 20.5 * TILE };
    this.resortPos = { x: 34.5 * TILE, y: 15 * TILE + 18 };
    this.lighthousePos = { x: 46.5 * TILE, y: 32.55 * TILE };
    this.playerStart = { x: 21.25 * TILE, y: 15.5 * TILE };
  },

  _landmark(c, r, style, sign, signColor) {
    const k = this.key(c, r);
    let b = this.bmap.get(k);
    if (!b) {
      b = { c, r, x: 0, y: 0, w: 0, h: 0, style, shade: 1, sign: null, signColor: '#fff' };
      this.buildings.push(b);
      this.bmap.set(k, b);
    }
    b.x = c * TILE + 5; b.y = r * TILE + 5;
    b.w = TILE - 10; b.h = TILE - 10;
    b.style = style;
    b.sign = sign;
    if (signColor) b.signColor = signColor;
  },

  cellOf(x, y) {
    return { c: Math.floor(x / TILE), r: Math.floor(y / TILE) };
  },

  streetNameAt(x, y) {
    const { c, r } = this.cellOf(x, y);
    if (STREET_NAMES[c] && this.isRoadCell(c, r)) return STREET_NAMES[c];
    if (AVENUE_NAMES[r] && this.isRoadCell(c, r)) return AVENUE_NAMES[r];
    if (r >= BEACH_ROW) return 'Palmetto Beach';
    return districtAt(c, r);
  },

  // Terrain a car may not enter (water, sand, rocks, the pier deck) and a
  // walker may not enter (water and rocks only).
  _terrainBlocked(c, r, onFoot) {
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return true;
    if (this.rocks.has(this.key(c, r))) return true;
    if (this.isWaterCell(c, r)) return true;
    if (!onFoot && (this.isSandCell(c, r) || this.isPierCell(c, r))) return true;
    return false;
  },

  // Push a circle out of every building and blocked-terrain cell nearby.
  // Mutates and returns the {x, y} object it is given.
  collideCircle(p, rad, onFoot) {
    p.x = clamp(p.x, rad, WORLD_W - rad);
    p.y = clamp(p.y, rad, WORLD_H - rad);
    const { c, r } = this.cellOf(p.x, p.y);
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const cc = c + dc, rrow = r + dr;
        let rect = null;
        const b = this.bmap.get(this.key(cc, rrow));
        if (b) rect = b;
        else if (this._terrainBlocked(cc, rrow, onFoot)) {
          rect = { x: cc * TILE, y: rrow * TILE, w: TILE, h: TILE };
        }
        if (!rect) continue;
        const nx = clamp(p.x, rect.x, rect.x + rect.w);
        const ny = clamp(p.y, rect.y, rect.y + rect.h);
        let dx = p.x - nx, dy = p.y - ny;
        let d2 = dx * dx + dy * dy;
        if (d2 >= rad * rad) continue;
        if (d2 < 0.0001) {
          // centre inside the rect: leave by the shallowest side
          const left = p.x - rect.x, right = rect.x + rect.w - p.x;
          const top = p.y - rect.y, bot = rect.y + rect.h - p.y;
          const m = Math.min(left, right, top, bot);
          if (m === left) p.x = rect.x - rad;
          else if (m === right) p.x = rect.x + rect.w + rad;
          else if (m === top) p.y = rect.y - rad;
          else p.y = rect.y + rect.h + rad;
        } else {
          const d = Math.sqrt(d2);
          p.x = nx + (dx / d) * rad;
          p.y = ny + (dy / d) * rad;
        }
      }
    }
    return p;
  },

  // True when the straight segment stays out of buildings (loose LOS).
  losClear(ax, ay, bx, by) {
    const steps = Math.ceil(dist(ax, ay, bx, by) / 40);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const { c, r } = this.cellOf(lerp(ax, bx, t), lerp(ay, by, t));
      if (this.bmap.has(this.key(c, r))) return false;
    }
    return true;
  },

  randomRoadPoint(minX, maxX) {
    for (let i = 0; i < 24; i++) {
      const cell = pick(this.roadCells);
      const x = cell.c * TILE + TILE / 2, y = cell.r * TILE + TILE / 2;
      if (minX !== undefined && dist(x, y, minX.x, minX.y) < maxX) continue;
      return { x, y, c: cell.c, r: cell.r };
    }
    const cell = pick(this.roadCells);
    return { x: cell.c * TILE + TILE / 2, y: cell.r * TILE + TILE / 2, c: cell.c, r: cell.r };
  },

  randomWalkPoint() {
    for (let i = 0; i < 24; i++) {
      const c = ri(0, COLS - 1), r = ri(0, ROWS - 2);
      if (this.bmap.has(this.key(c, r))) continue;
      if (this.isWaterCell(c, r) || this.rocks.has(this.key(c, r))) continue;
      return { x: c * TILE + rr(16, TILE - 16), y: r * TILE + rr(16, TILE - 16) };
    }
    return { x: this.playerStart.x, y: this.playerStart.y };
  }
};
