// police.js — the Coral City PD: a heat-based wanted system (1-5 stars),
// pursuit cars that hunt the player, roadblocks at four stars and up, and
// the busted meter that fills when a cop has you cornered and slow.
'use strict';

const Police = {
  cars: [],
  blocks: [],
  heat: 0,
  stars: 0,
  lockMin: 0,       // mission-imposed heat floor (the lighthouse run)
  lastCrimeAt: -99,
  spawnCd: 0,
  blockT: 10,
  bustMeter: 0,

  CRIME_HEAT: { steal: 20, shoot: 9, hitCar: 8, hitPed: 32, hitCop: 26, brandish: 5 },

  init() {
    this.cars = [];
    this.blocks = [];
    this.heat = 0;
    this.stars = 0;
    this.lockMin = 0;
    this.bustMeter = 0;
    this.blockT = 10;
  },

  starsFor(heat) {
    if (heat <= 0) return 0;
    if (heat < 22) return 1;
    if (heat < 48) return 2;
    if (heat < 82) return 3;
    if (heat < 122) return 4;
    return 5;
  },

  addCrime(kind) {
    const add = this.CRIME_HEAT[kind] || 6;
    this.heat = clamp(this.heat + add, 0, 165);
    this.lastCrimeAt = G.time;
    this.stars = this.starsFor(this.heat);
    Snd.chime('crime');
    G.flashWanted();
  },

  setLock(stars) {
    // heat floor that keeps at least `stars` lit while a job demands it
    this.lockMin = stars <= 0 ? 0 : [0, 1, 23, 49, 83, 123][stars];
    if (this.heat < this.lockMin) this.heat = this.lockMin;
    this.stars = this.starsFor(this.heat);
  },

  targetCount() {
    const base = [0, 2, 3, 5, 6, 8][this.stars] || 0;
    return Math.max(0, Math.min(base, 8 - this.blocks.length * 2));
  },

  spawnCop() {
    const pt = World.randomRoadPoint(Player, 640);
    if (dist(pt.x, pt.y, Player.x, Player.y) > 1150) return;
    const car = makeCar(chance(0.6) ? 'muscle' : 'compact', pt.x, pt.y, rr(0, TAU), COP_COLOR);
    car.driver = 'police';
    car.stuckT = 0;
    car.reverseT = 0;
    this.cars.push(car);
  },

  spawnBlock() {
    // two units parked across the road ahead of the player's nose
    const ahead = {
      x: Player.x + Math.cos(Player.angle) * 430,
      y: Player.y + Math.sin(Player.angle) * 430
    };
    const pt = World.randomRoadPoint(ahead, 0);
    const near = World.roadCells.reduce((best, cell) => {
      const x = cell.c * TILE + TILE / 2, y = cell.r * TILE + TILE / 2;
      const d = dist(x, y, ahead.x, ahead.y);
      return d < best.d ? { x, y, d, c: cell.c, r: cell.r } : best;
    }, { x: pt.x, y: pt.y, d: 1e9, c: 0, r: 0 });
    const horizontal = AVENUE_ROWS.indexOf(near.r) >= 0 || near.r === BOARDWALK_ROW;
    const blockAngle = (horizontal ? Math.PI / 2 : 0) + rr(-0.14, 0.14);
    for (const off of [-26, 26]) {
      const car = makeCar('muscle',
        near.x + (horizontal ? off : 0),
        near.y + (horizontal ? 0 : off),
        blockAngle, COP_COLOR);
      car.driver = 'police';
      car.parked = true;
      car.isBlock = true;
      this.blocks.push(car);
      this.cars.push(car);
    }
  },

  nearestCopDist() {
    let best = 1e9;
    for (const car of this.cars) {
      if (car.dead || car.isBlock) continue;
      best = Math.min(best, dist(car.x, car.y, Player.x, Player.y));
    }
    return best;
  },

  update(dt) {
    // heat cools when the streets have not seen a crime for a while and no
    // unit is close enough to keep eyes on the player
    const quiet = G.time - this.lastCrimeAt > 4;
    const watched = this.nearestCopDist() < 300;
    if (quiet && !watched && this.stars > 0) {
      this.heat = Math.max(this.lockMin, this.heat - 7 * dt);
      this.stars = this.starsFor(this.heat);
    }
    if (this.heat < this.lockMin) this.heat = this.lockMin;

    // staffing: roll units in or out to match the star count
    this.spawnCd -= dt;
    let chasing = 0;
    for (const car of this.cars) if (!car.dead && !car.isBlock) chasing++;
    if (chasing < this.targetCount() && this.spawnCd <= 0) {
      this.spawnCop();
      this.spawnCd = 0.7;
    }
    for (const car of this.cars) {
      if (car.dead || car.isBlock) continue;
      if (chasing > this.targetCount() && dist(car.x, car.y, Player.x, Player.y) > 620) {
        car.dead = true; // the unit peels off and leaves the city
        chasing--;
      }
    }
    // roadblocks while the heat is high
    this.blockT -= dt;
    if (this.stars >= 4 && this.blocks.length === 0 && this.blockT <= 0) {
      this.spawnBlock();
      this.blockT = 13;
    }
    for (const b of this.blocks) {
      if (dist(b.x, b.y, Player.x, Player.y) > 780) b.dead = true;
    }
    this.blocks = this.blocks.filter((b) => !b.dead);

    // pursuit driving
    for (const car of this.cars) {
      if (car.dead || car.isBlock || car.parked) continue;
      if (car.wrecked) { car.driver = null; continue; }
      const lead = Player.car ? 0.35 : 0.1;
      const tx = Player.x + (Player.car ? Player.car.vx * lead : 0);
      const ty = Player.y + (Player.car ? Player.car.vy * lead : 0);
      const desired = Math.atan2(ty - car.y, tx - car.x);
      let steer = clamp(angNorm(desired - car.angle) * 2.4, -1, 1);
      const spd = Math.hypot(car.vx, car.vy);
      let throttle = 1;
      const dTarget = dist(car.x, car.y, Player.x, Player.y);
      if (!Player.car && dTarget < 54) throttle = spd > 8 ? -1 : 0; // pull up beside a runner
      if (car.reverseT > 0) {
        car.reverseT -= dt;
        throttle = -1;
        steer = -steer;
      } else if (spd < 10 && dTarget > 60) {
        car.stuckT += dt;
        if (car.stuckT > 1.1) { car.reverseT = 0.55; car.stuckT = 0; }
      } else {
        car.stuckT = 0;
      }
      driveCar(car, dt, { throttle, steer, hand: false });
    }
    this.cars = this.cars.filter((car) => !car.dead);

    // busted: a unit on top of a slow player ends the run
    const pSpeed = Player.car ? Math.abs(Player.car.speed) : Player.speedNow;
    if (this.stars > 0 && this.nearestCopDist() < 58 && pSpeed < 34) {
      this.bustMeter += dt / 2.4;
      if (this.bustMeter >= 1 && typeof G !== 'undefined' && G.busted) G.busted();
    } else {
      this.bustMeter = Math.max(0, this.bustMeter - dt * 2.4);
    }
  },

  reset() {
    for (const car of this.cars) car.dead = true;
    this.init();
  }
};
