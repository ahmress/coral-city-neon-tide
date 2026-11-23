// render.js — everything the player sees: the city from above, its cars and
// crowds, the HUD, the minimap, dialogs and the title/end screens. Static
// minimap geography is pre-rendered once; the world itself is drawn culled
// to the camera every frame so 60 FPS holds on a big map.
'use strict';

const Particles = {
  list: [],
  spawn(x, y, vx, vy, life, color, size, kind) {
    if (this.list.length > 260) return;
    this.list.push({ x, y, vx, vy, life, maxLife: life, color, size, kind: kind || 'dot' });
  },
  burst(x, y, kind, n) {
    for (let i = 0; i < n; i++) {
      const a = rr(0, TAU), sp = rr(12, 60);
      if (kind === 'smoke') this.spawn(x + rr(-6, 6), y + rr(-6, 6), Math.cos(a) * sp * 0.4, -rr(14, 40), rr(0.7, 1.5), 'rgba(90,90,100,0.5)', rr(5, 11), 'smoke');
      else if (kind === 'spark') this.spawn(x, y, Math.cos(a) * rr(60, 220), Math.sin(a) * rr(60, 220), rr(0.15, 0.4), '#ffb84d', rr(1.5, 3), 'dot');
      else if (kind === 'sand') this.spawn(x, y, Math.cos(a) * sp, Math.sin(a) * sp, rr(0.3, 0.7), 'rgba(220,190,130,0.7)', rr(2, 4), 'dot');
    }
  },
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) { this.list.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'smoke') { p.size += 9 * dt; p.vy -= 6 * dt; }
    }
  },
  draw(ctx) {
    for (const p of this.list) {
      const a = clamp(p.life / p.maxLife, 0, 1);
      ctx.globalAlpha = p.kind === 'smoke' ? a * 0.55 : a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
};

const Render = {
  canvas: null,
  ctx: null,
  minimapBase: null,

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  },

  buildMinimap() {
    const w = 184, h = 138;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const m = cv.getContext('2d');
    const sx = w / WORLD_W, sy = h / WORLD_H;
    m.fillStyle = '#2c3038';
    m.fillRect(0, 0, w, h);
    m.fillStyle = '#c9b183';
    m.fillRect(0, BEACH_ROW * TILE * sy, w, (WATER_ROW - BEACH_ROW) * TILE * sy);
    m.fillStyle = '#14486b';
    m.fillRect(0, WATER_ROW * TILE * sy, w, h - WATER_ROW * TILE * sy);
    m.fillStyle = '#4a4f58';
    for (const cell of World.roadCells) m.fillRect(cell.c * TILE * sx, cell.r * TILE * sy, TILE * sx + 1, TILE * sy + 1);
    m.fillStyle = '#6e5636';
    m.fillRect(PIER_COL * TILE * sx, BEACH_ROW * TILE * sy, TILE * sx, (ROWS - BEACH_ROW) * TILE * sy);
    this.minimapBase = cv;
  },

  drawWorld(ctx, dark) {
    const cam = G.cam;
    const c0 = Math.max(0, Math.floor(cam.x / TILE) - 1);
    const c1 = Math.min(COLS - 1, Math.ceil((cam.x + 1280) / TILE) + 1);
    const r0 = Math.max(0, Math.floor(cam.y / TILE) - 1);
    const r1 = Math.min(ROWS - 1, Math.ceil((cam.y + 800) / TILE) + 1);

    // ground pass: pavement, sand, water, roads
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const x = c * TILE, y = r * TILE;
        if (World.isWaterCell(c, r)) {
          ctx.fillStyle = '#12507c';
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = 'rgba(140,210,255,0.20)';
          const off = Math.sin(G.time * 1.3 + (c + r) * 1.7) * 7;
          ctx.fillRect(x + 12 + off, y + TILE * 0.32, 34, 3);
          ctx.fillRect(x + 44 - off, y + TILE * 0.68, 28, 3);
        } else if (World.rocks.has(World.key(c, r))) {
          ctx.fillStyle = '#12507c';
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = '#5d6068';
          ctx.beginPath(); ctx.arc(x + TILE / 2, y + TILE / 2, TILE * 0.44, 0, TAU); ctx.fill();
          ctx.fillStyle = '#74777f';
          ctx.beginPath(); ctx.arc(x + TILE * 0.4, y + TILE * 0.42, TILE * 0.26, 0, TAU); ctx.fill();
        } else if (World.isSandCell(c, r)) {
          ctx.fillStyle = '#d9bc85';
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = 'rgba(160,128,74,0.35)';
          ctx.fillRect(x + (c * 37 % 50), y + (r * 53 % 70), 12, 3);
        } else if (World.isPierCell(c, r)) {
          ctx.fillStyle = '#7a5c38';
          ctx.fillRect(x, y, TILE, TILE);
          ctx.strokeStyle = 'rgba(60,42,20,0.6)';
          ctx.lineWidth = 2;
          for (let i = 1; i < 4; i++) {
            ctx.beginPath(); ctx.moveTo(x, y + i * TILE / 4); ctx.lineTo(x + TILE, y + i * TILE / 4); ctx.stroke();
          }
        } else if (World.isRoadCell(c, r)) {
          ctx.fillStyle = '#33363d';
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = '#3d4048';
          ctx.fillRect(x, y, TILE, 5);
        } else {
          ctx.fillStyle = '#585d66'; // sidewalk ring around each block
          ctx.fillRect(x, y, TILE, TILE);
        }
      }
    }
    // lane dashes down the middle of avenues and streets
    ctx.fillStyle = 'rgba(240,220,120,0.5)';
    for (const r of AVENUE_ROWS.concat([BOARDWALK_ROW])) {
      if (r < r0 || r > r1) continue;
      for (let x = Math.floor(cam.x / 48) * 48; x < cam.x + 1280; x += 48) {
        ctx.fillRect(x, r * TILE + TILE / 2 - 2, 26, 4);
      }
    }
    for (const c of STREET_COLS) {
      if (c < c0 || c > c1) continue;
      for (let y = Math.floor(cam.y / 48) * 48; y < cam.y + 800; y += 48) {
        ctx.fillRect(c * TILE + TILE / 2 - 2, y, 4, 26);
      }
    }
    // dock crates
    for (const cr of World.crates) {
      if (cr.x < cam.x - 60 || cr.y < cam.y - 60 || cr.x > cam.x + 1340 || cr.y > cam.y + 860) continue;
      ctx.fillStyle = cr.tone;
      ctx.fillRect(cr.x, cr.y, cr.w, cr.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(cr.x + 0.5, cr.y + 0.5, cr.w - 1, cr.h - 1);
    }
    // buildings
    for (const b of World.buildings) {
      if (b.x + b.w < cam.x || b.y + b.h < cam.y || b.x > cam.x + 1280 || b.y > cam.y + 800) continue;
      const base = b.style === 'warehouse' ? [104, 116, 128] : b.style === 'tower' ? [52, 56, 78] : b.style === 'casino' ? [88, 40, 92] : [196, 164, 132];
      const s = b.shade;
      ctx.fillStyle = `rgb(${Math.round(base[0] * s)},${Math.round(base[1] * s)},${Math.round(base[2] * s)})`;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
      // window grid; lit windows come alive after dark
      const cols = Math.max(2, Math.floor(b.w / 22));
      const rows = Math.max(2, Math.floor(b.h / 22));
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const lit = ((i * 7 + j * 13 + b.c * 3 + b.r) % 5 === 0);
          ctx.fillStyle = lit && dark > 0.35 ? 'rgba(255,205,110,0.85)' : 'rgba(16,20,32,0.5)';
          ctx.fillRect(b.x + 8 + i * ((b.w - 14) / cols), b.y + 8 + j * ((b.h - 14) / rows), 8, 6);
        }
      }
      if (b.sign) {
        ctx.fillStyle = b.signColor;
        ctx.globalAlpha = 0.25 + dark * 0.75;
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(b.sign, b.x + b.w / 2, b.y + b.h / 2 + 4);
        ctx.globalAlpha = 1;
      }
    }
    // palms: a bent trunk and five fronds
    ctx.strokeStyle = '#6d5133';
    for (const p of World.palms) {
      if (p.x < cam.x - 50 || p.y < cam.y - 50 || p.x > cam.x + 1330 || p.y > cam.y + 850) continue;
      ctx.lineWidth = 3 * p.s;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.quadraticCurveTo(p.x + 4 * p.s, p.y - 12 * p.s, p.x + 8 * p.s, p.y - 20 * p.s);
      ctx.stroke();
      ctx.strokeStyle = '#3f9e4d';
      ctx.lineWidth = 2.4 * p.s;
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI * 0.9 + i * (Math.PI * 0.45);
        ctx.beginPath();
        ctx.moveTo(p.x + 8 * p.s, p.y - 20 * p.s);
        ctx.quadraticCurveTo(
          p.x + 8 * p.s + Math.cos(a) * 11 * p.s, p.y - 20 * p.s + Math.sin(a) * 8 * p.s - 3,
          p.x + 8 * p.s + Math.cos(a) * 19 * p.s, p.y - 20 * p.s + Math.sin(a) * 13 * p.s + 5);
        ctx.stroke();
      }
      ctx.strokeStyle = '#6d5133';
    }
    this.drawLighthouse(ctx, dark);
  },

  drawLighthouse(ctx, dark) {
    const x = 46.5 * TILE, y = 34.35 * TILE;
    const cam = G.cam;
    if (x < cam.x - 120 || y < cam.y - 160 || x > cam.x + 1400 || y > cam.y + 920) return;
    ctx.fillStyle = '#e8e4da';
    ctx.beginPath();
    ctx.moveTo(x - 13, y + 26); ctx.lineTo(x - 8, y - 34); ctx.lineTo(x + 8, y - 34); ctx.lineTo(x + 13, y + 26); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#d94f3d';
    ctx.fillRect(x - 10.5, y - 8, 21, 9);
    ctx.fillRect(x - 12, y + 10, 24, 9);
    ctx.fillStyle = '#20242e';
    ctx.fillRect(x - 9, y - 46, 18, 12);
    if (dark > 0.3) {
      const a = G.time * 0.7;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const dirA of [a, a + Math.PI]) {
        const grad = ctx.createLinearGradient(x, y - 40, x + Math.cos(dirA) * 300, y - 40 + Math.sin(dirA) * 300);
        grad.addColorStop(0, 'rgba(255,240,180,0.30)');
        grad.addColorStop(1, 'rgba(255,240,180,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(x, y - 40);
        ctx.lineTo(x + Math.cos(dirA - 0.16) * 300, y - 40 + Math.sin(dirA - 0.16) * 300);
        ctx.lineTo(x + Math.cos(dirA + 0.16) * 300, y - 40 + Math.sin(dirA + 0.16) * 300);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  },

  drawMarker(ctx) {
    if (G.state !== 'playing') return;
    const m = Missions.markerPos();
    const bob = Math.sin(G.time * 3.2) * 6;
    ctx.strokeStyle = Missions.state === 'active' ? 'rgba(64,255,170,0.9)' : 'rgba(255,210,62,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(m.x, m.y, 26 + Math.sin(G.time * 3.2) * 4, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = Missions.state === 'active' ? '#40ffaa' : '#ffd23e';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(Missions.state === 'active' ? '◆' : '!', m.x, m.y - 38 + bob);
  },

  drawPeds(ctx) {
    for (const ped of Traffic.peds) {
      const cam = G.cam;
      if (ped.x < cam.x - 30 || ped.y < cam.y - 30 || ped.x > cam.x + 1310 || ped.y > cam.y + 830) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(ped.x, ped.y + 7, 8, 3.5, 0, 0, TAU); ctx.fill();
      if (ped.state === 'down') {
        ctx.fillStyle = ped.tone;
        ctx.beginPath(); ctx.ellipse(ped.x, ped.y, 13, 5.5, ped.angle, 0, TAU); ctx.fill();
        ctx.fillStyle = '#e8b98d';
        ctx.beginPath(); ctx.arc(ped.x + Math.cos(ped.angle) * 15, ped.y + Math.sin(ped.angle) * 15, 4.5, 0, TAU); ctx.fill();
        continue;
      }
      const step = Math.sin(G.time * 9 + ped.x * 0.1) * (ped.state === 'flee' ? 5 : 3);
      ctx.strokeStyle = '#2b2e38';
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.moveTo(ped.x, ped.y + 2);
      ctx.lineTo(ped.x + Math.cos(ped.angle + 0.6) * step, ped.y + 6 + Math.abs(step) * 0.4);
      ctx.moveTo(ped.x, ped.y + 2);
      ctx.lineTo(ped.x - Math.cos(ped.angle + 0.6) * step, ped.y + 6 + Math.abs(step) * 0.4);
      ctx.stroke();
      ctx.fillStyle = ped.tone;
      ctx.beginPath(); ctx.arc(ped.x, ped.y, 7.5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#e8b98d';
      ctx.beginPath(); ctx.arc(ped.x + Math.cos(ped.angle) * 2.5, ped.y + Math.sin(ped.angle) * 2.5, 4.6, 0, TAU); ctx.fill();
    }
  },

  rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },

  drawCars(ctx) {
    for (const car of Cars) {
      if (car.dead) continue;
      const cam = G.cam;
      if (car.x < cam.x - 70 || car.y < cam.y - 70 || car.x > cam.x + 1350 || car.y > cam.y + 870) continue;
      const w = car.cls.w + 14, h = car.cls.h + 11;
      ctx.save();
      ctx.translate(car.x, car.y);
      ctx.rotate(car.angle);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      this.rrect(ctx, -w / 2 + 3, -h / 2 + 5, w, h, 7); ctx.fill();
      ctx.fillStyle = car.wrecked ? '#3a3a40' : car.color;
      this.rrect(ctx, -w / 2, -h / 2, w, h, 7); ctx.fill();
      // cabin and glass
      ctx.fillStyle = car.wrecked ? '#22242a' : 'rgba(18,24,38,0.9)';
      this.rrect(ctx, -w * 0.16, -h / 2 + 3.5, w * 0.34, h - 7, 3.5); ctx.fill();
      ctx.fillStyle = 'rgba(150,210,255,0.35)';
      this.rrect(ctx, w * 0.2, -h / 2 + 4.5, w * 0.1, h - 9, 2); ctx.fill();
      // wheels
      ctx.fillStyle = '#101114';
      const ww = 8, wh = 4.6;
      ctx.fillRect(-w / 2 + 3, -h / 2 - 2, ww, wh);
      ctx.fillRect(w / 2 - ww - 3, -h / 2 - 2, ww, wh);
      ctx.fillRect(-w / 2 + 3, h / 2 - wh + 2, ww, wh);
      ctx.fillRect(w / 2 - ww - 3, h / 2 - wh + 2, ww, wh);
      // lights
      ctx.fillStyle = '#ffeeb8';
      ctx.fillRect(w / 2 - 2.5, -h / 2 + 2.5, 2.6, 4.4);
      ctx.fillRect(w / 2 - 2.5, h / 2 - 6.9, 2.6, 4.4);
      ctx.fillStyle = '#ff4040';
      ctx.fillRect(-w / 2 - 0.2, -h / 2 + 2.5, 2.4, 4.2);
      ctx.fillRect(-w / 2 - 0.2, h / 2 - 6.7, 2.4, 4.2);
      if (car.driver === 'police') {
        const phase = Math.floor(G.time * 5.5) % 2;
        ctx.fillStyle = phase ? '#ff3b30' : '#3b82ff';
        this.rrect(ctx, -7, -h / 2 + 4, 14, h - 8, 3); ctx.fill();
        ctx.fillStyle = '#f4f6fb';
        ctx.fillRect(-w * 0.3, -2.4, w * 0.6, 4.8);
      }
      if (car.driver === 'player') {
        ctx.fillStyle = '#e8b98d';
        ctx.beginPath(); ctx.arc(-1, 0, 4.6, 0, TAU); ctx.fill();
      }
      ctx.restore();
      if (car.wrecked && Math.random() < 0.25) Particles.spawn(car.x + rr(-8, 8), car.y - 6, rr(-4, 4), -rr(16, 34), rr(0.6, 1.2), 'rgba(70,70,78,0.5)', rr(4, 8), 'smoke');
    }
  },

  drawPlayer(ctx) {
    const p = Player;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 8, 9, 4, 0, 0, TAU); ctx.fill();
    // gun arm toward the mouse
    ctx.strokeStyle = '#22242c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(p.angle) * 17, p.y + Math.sin(p.angle) * 17);
    ctx.stroke();
    ctx.fillStyle = '#14424e';
    ctx.beginPath(); ctx.arc(p.x, p.y, 8.6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#19b8a6';
    ctx.beginPath(); ctx.arc(p.x, p.y, 6.4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e8b98d';
    ctx.beginPath(); ctx.arc(p.x + Math.cos(p.angle) * 2, p.y + Math.sin(p.angle) * 2, 4.8, 0, TAU); ctx.fill();
  },

  drawGlows(ctx, dark) {
    if (dark < 0.25) return;
    const cam = G.cam;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // street lamps bloom
    for (const l of World.lamps) {
      if (l.x < cam.x - 60 || l.y < cam.y - 60 || l.x > cam.x + 1340 || l.y > cam.y + 860) continue;
      const g = ctx.createRadialGradient(l.x, l.y, 2, l.x, l.y, 42);
      g.addColorStop(0, 'rgba(255,190,90,0.20)');
      g.addColorStop(1, 'rgba(255,190,90,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(l.x, l.y, 42, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,220,150,0.9)';
      ctx.beginPath(); ctx.arc(l.x, l.y, 2.6, 0, TAU); ctx.fill();
    }
    // player headlights cut the dark
    if (Player.car && !Player.car.wrecked) {
      const car = Player.car;
      const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
      const grad = ctx.createLinearGradient(car.x, car.y, car.x + fx * 190, car.y + fy * 190);
      grad.addColorStop(0, 'rgba(255,240,190,0.16)');
      grad.addColorStop(1, 'rgba(255,240,190,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(car.x + fx * 20, car.y + fy * 20);
      ctx.lineTo(car.x + fx * 190 + (-fy) * 52, car.y + fy * 190 + fx * 52);
      ctx.lineTo(car.x + fx * 190 - (-fy) * 52, car.y + fy * 190 - fx * 52);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  },

  draw() {
    const ctx = this.ctx;
    const dark = G.darkness();
    ctx.fillStyle = '#0d1020';
    ctx.fillRect(0, 0, 1280, 800);
    ctx.save();
    ctx.translate(-G.cam.x, -G.cam.y);
    this.drawWorld(ctx, dark);
    this.drawMarker(ctx);
    this.drawPeds(ctx);
    this.drawCars(ctx);
    if (!Player.car && G.state !== 'title') this.drawPlayer(ctx);
    Particles.draw(ctx);
    ctx.restore();
    if (dark > 0.02) {
      ctx.fillStyle = `rgba(9,11,40,${(dark * 0.4).toFixed(3)})`;
      ctx.fillRect(0, 0, 1280, 800);
    }
    ctx.save();
    ctx.translate(-G.cam.x, -G.cam.y);
    this.drawGlows(ctx, dark);
    ctx.restore();
    if (G.state !== 'title') this.drawHUD(ctx);
    this.drawScreens(ctx);
  },

  star(ctx, cx, cy, r, filled) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? r : r * 0.45;
      const a = -Math.PI / 2 + i * Math.PI / 5;
      const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    if (filled) { ctx.fillStyle = '#ffd23e'; ctx.fill(); }
    ctx.strokeStyle = 'rgba(255,210,62,0.65)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
  },

  drawHUD(ctx) {
    // cash and score, top-left
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(8,10,20,0.55)';
    this.rrect(ctx, 14, 14, 252, 76, 9); ctx.fill();
    ctx.fillStyle = '#5ee86e';
    ctx.font = 'bold 27px system-ui, sans-serif';
    ctx.fillText('$ ' + G.cash.toLocaleString('en-US'), 26, 50);
    ctx.fillStyle = '#f2f4f8';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText('SCORE ' + G.score.toLocaleString('en-US'), 26, 76);
    if (G.comboT > 0) {
      ctx.fillStyle = '#ff9f3c';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.fillText('COMBO x' + G.multiplier().toFixed(1), 150, 76);
      ctx.fillStyle = 'rgba(255,159,60,0.85)';
      ctx.fillRect(150, 81, clamp(G.comboT / 6, 0, 1) * 100, 3.4);
    }
    // wanted stars, top-right, above the minimap
    const flash = G.wantedFlashT > 0 ? 1 + Math.sin(G.time * 26) * 0.16 : 1;
    for (let i = 0; i < 5; i++) {
      this.star(ctx, 1280 - 34 - (4 - i) * 31, 33, 12.5 * flash, i < Police.stars);
    }
    // minimap
    const mx = 1280 - 196, my = 52;
    if (this.minimapBase) ctx.drawImage(this.minimapBase, mx, my);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.4;
    ctx.strokeRect(mx, my, 184, 138);
    const sx = 184 / WORLD_W, sy = 138 / WORLD_H;
    const dot = (x, y, color, r) => {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(mx + x * sx, my + y * sy, r, 0, TAU); ctx.fill();
    };
    if (G.state === 'playing') {
      const m = Missions.markerPos();
      if (Math.sin(G.time * 5) > -0.4) dot(m.x, m.y, '#ffd23e', 3.6);
    }
    for (const car of Police.cars) if (!car.dead) dot(car.x, car.y, '#5ea2ff', 2.4);
    if (Missions.obj && Missions.obj.kind === 'ram' && Missions.obj.target) {
      dot(Missions.obj.target.x, Missions.obj.target.y, '#ff5040', 3);
    }
    dot(Player.x, Player.y, '#ffffff', 3.2);
    // speed and condition, bottom-left
    ctx.fillStyle = 'rgba(8,10,20,0.55)';
    this.rrect(ctx, 14, 800 - 86, 216, 72, 9); ctx.fill();
    ctx.fillStyle = '#f2f4f8';
    if (Player.car) {
      const kmh = Math.round(Math.abs(Player.car.speed) * 0.36);
      ctx.font = 'bold 30px system-ui, sans-serif';
      ctx.fillText(kmh + '', 26, 800 - 44);
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillStyle = '#aeb6c4';
      ctx.fillText('km/h · ' + Player.car.cls.label, 92, 800 - 44);
      ctx.fillStyle = '#39404e';
      ctx.fillRect(26, 800 - 34, 150, 6);
      ctx.fillStyle = Player.car.hp / Player.car.maxHp > 0.35 ? '#5ee86e' : '#ff5040';
      ctx.fillRect(26, 800 - 34, 150 * clamp(Player.car.hp / Player.car.maxHp, 0, 1), 6);
    } else {
      ctx.font = 'bold 17px system-ui, sans-serif';
      ctx.fillText('ON FOOT', 26, 800 - 52);
      ctx.fillStyle = '#39404e';
      ctx.fillRect(26, 800 - 40, 150, 6);
      ctx.fillStyle = Player.hp > 35 ? '#5ee86e' : '#ff5040';
      ctx.fillRect(26, 800 - 40, 150 * clamp(Player.hp / 100, 0, 1), 6);
    }
    // objective + street, bottom-centre
    ctx.textAlign = 'center';
    const obj = Missions.objectiveText();
    if (obj && G.state === 'playing') {
      ctx.font = 'bold 16.5px system-ui, sans-serif';
      const w = ctx.measureText(obj).width + 34;
      ctx.fillStyle = 'rgba(8,10,20,0.6)';
      this.rrect(ctx, 640 - w / 2, 800 - 78, w, 32, 16); ctx.fill();
      ctx.fillStyle = '#ffe9a8';
      ctx.fillText(obj, 640, 800 - 57);
    }
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(230,236,245,0.75)';
    ctx.fillText(World.streetNameAt(Player.x, Player.y) + ' · ' + districtAt(Math.floor(Player.x / TILE), Math.floor(Player.y / TILE)), 640, 800 - 18);
    // busted meter
    if (Police.bustMeter > 0.02 && G.state === 'playing') {
      ctx.fillStyle = 'rgba(8,10,20,0.6)';
      this.rrect(ctx, 490, 96, 300, 26, 13); ctx.fill();
      ctx.fillStyle = '#ff4040';
      this.rrect(ctx, 494, 100, 292 * clamp(Police.bustMeter, 0, 1), 18, 9); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillText('BUSTED?', 640, 113);
    }
    // banner announcements
    if (G.bannerT > 0) {
      ctx.globalAlpha = clamp(G.bannerT / 0.6, 0, 1);
      ctx.font = 'bold 30px system-ui, sans-serif';
      ctx.fillStyle = '#ffd23e';
      ctx.strokeStyle = 'rgba(0,0,0,0.65)';
      ctx.lineWidth = 5;
      ctx.strokeText(G.bannerText, 640, 150);
      ctx.fillText(G.bannerText, 640, 150);
      ctx.globalAlpha = 1;
    }
    // dialog box
    if (Missions.dialog) {
      const d = Missions.dialog;
      const line = d.lines[d.i];
      ctx.fillStyle = 'rgba(6,8,18,0.88)';
      this.rrect(ctx, 240, 800 - 196, 800, 104, 12); ctx.fill();
      ctx.strokeStyle = 'rgba(255,210,62,0.5)';
      ctx.lineWidth = 1.4;
      this.rrect(ctx, 240, 800 - 196, 800, 104, 12); ctx.stroke();
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffd23e';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.fillText(line.who, 264, 800 - 168);
      ctx.fillStyle = '#f2f4f8';
      ctx.font = '17.5px system-ui, sans-serif';
      const words = line.text.split(' ');
      let row = '', rows = [];
      for (const word of words) {
        if (ctx.measureText(row + ' ' + word).width > 752 && row) { rows.push(row); row = word; }
        else row = row ? row + ' ' + word : word;
      }
      if (row) rows.push(row);
      rows.slice(0, 3).forEach((r2, i) => ctx.fillText(r2, 264, 800 - 140 + i * 23));
      if (Math.sin(G.time * 5) > 0) {
        ctx.fillStyle = '#ffd23e';
        ctx.font = 'bold 14px system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('E ▸', 1016, 800 - 104);
      }
      ctx.textAlign = 'center';
    }
    // controls reminder
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(220,228,240,0.5)';
    ctx.textAlign = 'right';
    ctx.fillText('WASD drive · E enter/exit · SPACE handbrake · P pause · M mute', 1266, 800 - 16);
    ctx.textAlign = 'left';
  },

  drawScreens(ctx) {
    if (G.state === 'title') {
      const grad = ctx.createLinearGradient(0, 60, 0, 800);
      grad.addColorStop(0, 'rgba(10,6,28,0.30)');
      grad.addColorStop(0.55, 'rgba(10,6,28,0.62)');
      grad.addColorStop(1, 'rgba(10,6,28,0.85)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1280, 800);
      ctx.textAlign = 'center';
      const tg = ctx.createLinearGradient(340, 0, 940, 0);
      tg.addColorStop(0, '#ffd23e');
      tg.addColorStop(0.5, '#ff3ea5');
      tg.addColorStop(1, '#22d8ff');
      ctx.fillStyle = tg;
      ctx.font = '900 104px system-ui, sans-serif';
      ctx.fillText('CORAL CITY', 640, 268);
      ctx.fillStyle = '#aef4ff';
      ctx.font = 'bold 37px system-ui, sans-serif';
      ctx.fillText('· N E O N   T I D E ·', 640, 326);
      ctx.fillStyle = 'rgba(240,244,250,0.92)';
      ctx.font = '19px system-ui, sans-serif';
      ctx.fillText('Five jobs for a casino fixer. One city that never quite sleeps.', 640, 386);
      ctx.fillText('Steal rides, run packages, lose the heat — and try to see the lighthouse.', 640, 414);
      if (Math.sin(G.time * 4) > -0.25) {
        ctx.fillStyle = '#ffd23e';
        ctx.font = 'bold 23px system-ui, sans-serif';
        ctx.fillText('PRESS ENTER OR CLICK TO PLAY', 640, 486);
      }
      ctx.fillStyle = 'rgba(220,228,240,0.85)';
      ctx.font = '16.5px system-ui, sans-serif';
      ctx.fillText('WASD / arrows — move & drive      E — enter / exit car, talk      Mouse — aim, click — shoot (on foot)', 640, 548);
      ctx.fillText('SHIFT — run      SPACE — handbrake      P — pause      M — mute', 640, 578);
      const best = Save.best();
      if (best > 0) {
        ctx.fillStyle = '#ffe9a8';
        ctx.font = 'bold 17px system-ui, sans-serif';
        ctx.fillText('BEST SCORE  ' + best.toLocaleString('en-US'), 640, 640);
      }
      ctx.textAlign = 'left';
      return;
    }
    if (G.state === 'paused') {
      ctx.fillStyle = 'rgba(5,6,16,0.6)';
      ctx.fillRect(0, 0, 1280, 800);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f2f4f8';
      ctx.font = '900 64px system-ui, sans-serif';
      ctx.fillText('PAUSED', 640, 400);
      ctx.font = '18px system-ui, sans-serif';
      ctx.fillText('P to resume', 640, 442);
      ctx.textAlign = 'left';
      return;
    }
    if (G.state === 'busted' || G.state === 'wasted') {
      ctx.fillStyle = G.state === 'busted' ? 'rgba(16,26,80,0.55)' : 'rgba(80,10,10,0.55)';
      ctx.fillRect(0, 0, 1280, 800);
      ctx.textAlign = 'center';
      ctx.fillStyle = G.state === 'busted' ? '#9db9ff' : '#ff8f7a';
      ctx.font = '900 96px system-ui, sans-serif';
      ctx.fillText(G.state === 'busted' ? 'BUSTED' : 'WASTED', 640, 356);
      ctx.fillStyle = '#f2f4f8';
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.fillText('Score ' + G.score.toLocaleString('en-US') + '  ·  Cash earned $' + G.cash.toLocaleString('en-US'), 640, 420);
      if (Math.sin(G.time * 4) > -0.25) {
        ctx.font = 'bold 19px system-ui, sans-serif';
        ctx.fillStyle = '#ffd23e';
        ctx.fillText('PRESS ENTER TO RUN IT BACK', 640, 486);
      }
      ctx.textAlign = 'left';
      return;
    }
    if (G.state === 'cleared') {
      ctx.fillStyle = 'rgba(8,30,26,0.6)';
      ctx.fillRect(0, 0, 1280, 800);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#7dffc8';
      ctx.font = '900 72px system-ui, sans-serif';
      ctx.fillText('CITY CLEARED', 640, 340);
      ctx.fillStyle = '#f2f4f8';
      ctx.font = 'bold 21px system-ui, sans-serif';
      ctx.fillText('All five jobs done. Score ' + G.score.toLocaleString('en-US'), 640, 402);
      ctx.font = '18px system-ui, sans-serif';
      ctx.fillText('The city is yours — delivery work keeps coming at the ! markers.', 640, 438);
      if (Math.sin(G.time * 4) > -0.25) {
        ctx.fillStyle = '#ffd23e';
        ctx.font = 'bold 19px system-ui, sans-serif';
        ctx.fillText('PRESS ENTER TO KEEP ROAMING', 640, 500);
      }
      ctx.textAlign = 'left';
    }
  }
};
