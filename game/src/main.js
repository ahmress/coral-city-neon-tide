// main.js — Coral City: Neon Tide, the conductor. Owns the run state
// (title, playing, paused, busted, wasted, cleared), the score and combo
// economy, the crime/stunt hooks every other system calls into, the
// camera, and the frame loop itself.
'use strict';

const G = {
  state: 'title',
  time: 0,
  phase: 0.58,
  phaseOverride: null,
  cam: { x: 0, y: 0 },
  cash: 0,
  score: 0,
  combo: 0,
  comboT: 0,
  bannerText: '',
  bannerT: 0,
  wantedFlashT: 0,
  danger: { x: 0, y: 0 },
  dangerT: 0,
  shotCruise: false,
  lastShotAt: -9,
  driftAcc: 0,
  topT: 0,
  topBonusAt: -99,
  _crimeCd: {},
  testClock: 0,
  fpsFrames: 0,
  testDone: false,

  // How dark the city is, 0 (bright dusk) to 1 (deep night), as a
  // piecewise glide over the day phase.
  darkness() {
    const stops = [[0, 0.9], [0.2, 0.85], [0.35, 0.45], [0.5, 0.27], [0.62, 0.3], [0.75, 0.8], [0.9, 0.92], [1, 0.9]];
    const p = this.phase;
    for (let i = 0; i < stops.length - 1; i++) {
      const [p0, v0] = stops[i];
      const [p1, v1] = stops[i + 1];
      if (p >= p0 && p <= p1) return lerp(v0, v1, (p - p0) / (p1 - p0));
    }
    return 0.85;
  },

  multiplier() { return 1 + Math.min(this.combo, 24) * 0.1; },

  addScore(base, useCombo) {
    const pts = Math.round(base * (useCombo ? this.multiplier() : 1));
    this.score += pts;
    if (useCombo) {
      this.combo++;
      this.comboT = 6;
    }
    return pts;
  },

  addCash(n) {
    this.cash += n;
    this.addScore(n, false);
  },

  banner(text) {
    this.bannerText = text;
    this.bannerT = 2.6;
  },

  flashWanted() { this.wantedFlashT = 0.9; },

  dangerAt(x, y) {
    this.danger.x = x;
    this.danger.y = y;
    this.dangerT = 2.2;
  },

  addCrime(kind) {
    if (this.state !== 'playing') return;
    const now = this.time;
    if (kind !== 'shoot' && this._crimeCd[kind] && now - this._crimeCd[kind] < 0.9) return;
    this._crimeCd[kind] = now;
    Police.addCrime(kind);
  },

  // -- hooks the physics and AI call back into -----------------------------
  onCarCrash(car, impact) {
    Particles.burst(car.x, car.y, 'spark', 8);
    if (car.driver === 'player') {
      Snd.chime('crash');
      this.combo = 0;
      this.comboT = 0;
      Player.hp -= (impact - 120) * 0.07;
      this.dangerAt(car.x, car.y);
      if (Player.hp <= 0) this.wasted();
    }
  },

  onCarHit(a, b, severity) {
    const playerCar = Player.car;
    if (!playerCar) return;
    if (a !== playerCar && b !== playerCar) return;
    const other = a === playerCar ? b : a;
    if (other.driver === 'police') this.addCrime('hitCop');
    else if (other.driver === 'target') { /* the job wants this */ }
    else this.addCrime('hitCar');
    if (severity > 150) Snd.chime('crash');
  },

  onPedHit(ped, car) {
    if (car === Player.car || car.driver === 'player') {
      this.addCrime('hitPed');
      this.dangerAt(ped.x, ped.y);
      Snd.chime('crash');
    }
  },

  onPlayerWrecked(car) {
    Player.car = null;
    Player.x = car.x + 30;
    Player.y = car.y + 10;
    World.collideCircle(Player, Player.r, true);
    Player.hp -= 8;
    this.banner('RIDE WRECKED');
    if (Player.hp <= 0) this.wasted();
  },

  busted() {
    if (this.state !== 'playing') return;
    this.state = 'busted';
    Save.submit(this.score);
    Snd.chime('fail');
  },

  wasted() {
    if (this.state !== 'playing') return;
    this.state = 'wasted';
    Save.submit(this.score);
    Snd.chime('fail');
  },

  cityCleared() {
    this.state = 'cleared';
    Save.submit(this.score);
    Snd.chime('stinger');
  }
};

// -- run setup --------------------------------------------------------------
function resetWorld() {
  Cars.length = 0;
  Player.reset(World.playerStart);
  Traffic.init();
  Police.init();
  Missions.init();
  seedParkedCars();
  const starter = makeCar('compact', World.playerStart.x + 76, World.playerStart.y + 2, 0, '#3d7bd9');
  starter.parked = true;
  G.combo = 0;
  G.comboT = 0;
  G.dangerT = 0;
  G.driftAcc = 0;
  G.topT = 0;
}

function startRun() {
  G.state = 'playing';
  Snd.init();
  G.banner('FIND THE ! MARKER');
}

function restart() {
  G.cash = 0;
  G.score = 0;
  resetWorld();
  G.state = 'playing';
  G.banner('BACK ON THE STREET');
}

// -- shooting (on foot, toward the mouse) ------------------------------------
function pointLineDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = clamp(t, 0, 1);
  return dist(px, py, ax + dx * t, ay + dy * t);
}

function shoot() {
  G.lastShotAt = G.time;
  Snd.chime('shot');
  G.dangerAt(Player.x, Player.y);
  const range = 430;
  const ax = Player.x + Math.cos(Player.angle) * 18;
  const ay = Player.y + Math.sin(Player.angle) * 18;
  const bx = Player.x + Math.cos(Player.angle) * range;
  const by = Player.y + Math.sin(Player.angle) * range;
  for (let i = 0; i < 7; i++) {
    const t = i / 7;
    Particles.spawn(lerp(ax, bx, t), lerp(ay, by, t), 0, 0, 0.09 + i * 0.012, 'rgba(255,220,130,0.9)', 2.2, 'dot');
  }
  for (const ped of Traffic.peds) {
    if (ped.state === 'down') continue;
    if (pointLineDist(ped.x, ped.y, ax, ay, bx, by) < 13 && dist(Player.x, Player.y, ped.x, ped.y) < range) {
      ped.state = 'down';
      ped.downT = 7;
    }
  }
  for (const car of Cars) {
    if (car.dead) continue;
    if (pointLineDist(car.x, car.y, ax, ay, bx, by) < carRadius(car) + 5 && dist(Player.x, Player.y, car.x, car.y) < range) {
      damageCar(car, 9, 'shot');
      Particles.burst(car.x, car.y, 'spark', 5);
    }
  }
  G.addCrime('shoot');
}

// -- stunt scoring ------------------------------------------------------------
function stunts(dt, car) {
  // near miss: thread past a moving car at speed, once per car per pass
  if (Math.abs(car.speed) > 185) {
    for (const other of Cars) {
      if (other === car || other.dead || other.parked || other.nearMissCd > 0) continue;
      const d = dist(car.x, car.y, other.x, other.y);
      if (d > 30 && d < 52) {
        other.nearMissCd = 2.5;
        G.addScore(25, true);
      }
    }
  }
  // drift: real lateral slide at real speed, paid by the half-second
  if (car.slip > 46 && Math.abs(car.speed) > 105) {
    G.driftAcc += dt;
    if (G.driftAcc >= 0.5) {
      G.driftAcc = 0;
      G.addScore(15, true);
    }
    if (Math.random() < 0.55) {
      Particles.spawn(car.x - Math.cos(car.angle) * 16, car.y - Math.sin(car.angle) * 16,
        rr(-8, 8), rr(-8, 8), rr(0.3, 0.6), 'rgba(200,200,205,0.4)', rr(3, 6), 'smoke');
    }
  } else {
    G.driftAcc = 0;
  }
  // top speed: hold the needle past 370 for two seconds
  if (Math.abs(car.speed) > 372) {
    G.topT += dt;
    if (G.topT >= 2 && G.time - G.topBonusAt > 10) {
      G.topBonusAt = G.time;
      G.addScore(50, true);
    }
  } else {
    G.topT = 0;
  }
}

// -- the per-frame update while a run is live ---------------------------------
function update(dt) {
  if (Input.pressed('KeyP')) { G.state = 'paused'; return; }
  if (Input.pressed('KeyM')) Snd.setMuted(!Snd.muted);
  if (Input.clicked || Input.pressed('Enter')) Snd.init();
  if (Input.interact()) {
    if (Missions.dialog) Missions.advanceDialog();
    else if (!Missions.tryOpenDialog()) playerToggleCar();
  }

  if (Player.car) {
    const car = Player.car;
    let ctrl;
    if (G.shotCruise) {
      ctrl = { throttle: 0.75, steer: 0, hand: false };
    } else {
      ctrl = {
        throttle: (Input.down('KeyW') || Input.down('ArrowUp') ? 1 : 0) + (Input.down('KeyS') || Input.down('ArrowDown') ? -1 : 0),
        steer: (Input.down('KeyD') || Input.down('ArrowRight') ? 1 : 0) + (Input.down('KeyA') || Input.down('ArrowLeft') ? -1 : 0),
        hand: Input.down('Space')
      };
    }
    driveCar(car, dt, ctrl);
    Player.update(dt);
    stunts(dt, car);
    if (car.hp < car.maxHp * 0.4 && Math.random() < 0.3) {
      Particles.spawn(car.x + rr(-6, 6), car.y - 8, rr(-3, 3), -rr(14, 30), rr(0.5, 1), 'rgba(80,80,88,0.5)', rr(4, 7), 'smoke');
    }
  } else {
    Player.update(dt);
    if (Input.clicked && G.time - G.lastShotAt > 0.22) shoot();
  }

  Traffic.update(dt);
  Police.update(dt);
  Missions.update(dt);
  collideCars(dt);
  for (let i = Cars.length - 1; i >= 0; i--) if (Cars[i].dead) Cars.splice(i, 1);

  if (G.comboT > 0) {
    G.comboT -= dt;
    if (G.comboT <= 0) G.combo = 0;
  }
  if (G.dangerT > 0) G.dangerT -= dt;

  Snd.update(dt, {
    engineOn: !!Player.car && !Player.car.wrecked,
    engineNorm: Player.car ? Math.abs(Player.car.speed) / Player.car.cls.top : 0,
    sirenDist: Police.stars > 0 ? Police.nearestCopDist() : 1e9,
    drifting: !!(Player.car && Player.car.slip > 42 && Math.abs(Player.car.speed) > 110)
  });
}

// -- boot and the frame loop ---------------------------------------------------
let _lastTs = 0;

function frame(ts) {
  requestAnimationFrame(frame);
  const now = ts / 1000;
  const rawDt = _lastTs ? now - _lastTs : 0.016;
  const dt = Math.min(0.05, rawDt);
  _lastTs = now;
  G.time += dt;
  G.phase = G.phaseOverride !== null ? G.phaseOverride : (0.56 + G.time / DAY_LEN) % 1;

  if (G.state === 'playing') {
    update(dt);
  } else if (G.state === 'title') {
    Traffic.update(dt);
    if (Input.pressed('Enter') || Input.clicked) startRun();
  } else if (G.state === 'paused') {
    if (Input.pressed('KeyP') || Input.pressed('Enter')) G.state = 'playing';
  } else if (G.state === 'busted' || G.state === 'wasted') {
    Traffic.update(dt);
    if (Input.pressed('Enter')) restart();
  } else if (G.state === 'cleared') {
    Traffic.update(dt);
    if (Input.pressed('Enter')) G.state = 'playing';
  }

  // camera: a soft chase of the player, clamped to the world
  const tx = clamp(Player.x - 640, 0, WORLD_W - 1280);
  const ty = clamp(Player.y - 400, 0, WORLD_H - 800);
  const k = Math.min(1, dt * 5.5);
  G.cam.x += (tx - G.cam.x) * k;
  G.cam.y += (ty - G.cam.y) * k;

  Particles.update(dt);
  if (G.bannerT > 0) G.bannerT -= dt;
  if (G.wantedFlashT > 0) G.wantedFlashT -= dt;
  Render.draw();

  if (ShotCfg.test && !G.testDone) {
    // the test clock runs on unclamped frame time: it measures the frame
    // cadence itself, not the physics step
    G.testClock += rawDt;
    if (G.testClock > 2.5 && G.testClock <= 5.05) G.fpsFrames++;
    if (G.testClock >= 5) {
      G.testDone = true;
      Shots.report(G.fpsFrames / 2.5);
    }
  }
  Input.postFrame();
}

function boot() {
  const canvas = document.getElementById('game');
  Render.init(canvas);
  Input.init(canvas);
  World.build(ShotCfg.seed);
  Render.buildMinimap();
  resetWorld();
  G.cam.x = clamp(Player.x - 640, 0, WORLD_W - 1280);
  G.cam.y = clamp(Player.y - 400, 0, WORLD_H - 800);
  if (ShotCfg.name) Shots.apply(ShotCfg.name);
  requestAnimationFrame(frame);
}

window.addEventListener('load', boot);
