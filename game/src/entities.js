// entities.js — the player and every car in Coral City.
// Cars use a simple velocity-vector arcade model: throttle pushes along the
// heading, grip eats lateral velocity, and the handbrake lets the tail
// slide — which is where drift bonuses come from.
'use strict';

const Cars = [];
let _carSeq = 0;

function makeCar(clsName, x, y, angle, color) {
  const cls = CAR_CLASSES[clsName];
  const car = {
    id: ++_carSeq,
    clsName, cls,
    x, y, angle,
    vx: 0, vy: 0, speed: 0, slip: 0,
    hp: cls.hp, maxHp: cls.hp,
    color: color || pick(CAR_COLORS),
    driver: null,       // null | 'player' | 'traffic' | 'police' | 'target'
    parked: false,
    wrecked: false,
    dead: false,
    nearMissCd: 0,
    smokeT: 0
  };
  Cars.push(car);
  return car;
}

function carRadius(car) { return car.cls.w * 0.44; }

function nearestCar(x, y, maxD, usableOnly) {
  let best = null, bd = maxD;
  for (const car of Cars) {
    if (car.dead) continue;
    if (usableOnly && car.wrecked) continue;
    const d = dist(x, y, car.x, car.y);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}

const Player = {
  x: 0, y: 0, angle: -Math.PI / 2, r: 11,
  hp: 100, car: null, speedNow: 0, walkPhase: 0,

  reset(pos) {
    this.x = pos.x; this.y = pos.y;
    this.hp = 100;
    this.car = null;
    this.speedNow = 0;
  },

  update(dt) {
    if (this.car) {
      this.x = this.car.x;
      this.y = this.car.y;
      this.angle = this.car.angle;
      this.speedNow = Math.abs(this.car.speed);
      return;
    }
    let mx = Input.axisX(), my = Input.axisY();
    const m = Math.hypot(mx, my);
    const running = Input.down('ShiftLeft') || Input.down('ShiftRight');
    const sp = running ? 198 : 118;
    if (m > 0) {
      mx /= m; my /= m;
      this.x += mx * sp * dt;
      this.y += my * sp * dt;
      this.walkPhase += dt * (running ? 13 : 9);
      this.speedNow = sp;
    } else {
      this.speedNow = 0;
    }
    World.collideCircle(this, this.r, true);
    // face the mouse: the camera offset turns screen aim into world aim
    const wx = G.cam.x + Input.mouseX;
    const wy = G.cam.y + Input.mouseY;
    this.angle = Math.atan2(wy - this.y, wx - this.x);
  }
};

// ctrl: { throttle: -1..1, steer: -1..1, hand: bool }
function driveCar(car, dt, ctrl) {
  if (car.wrecked) ctrl = { throttle: 0, steer: 0, hand: true };
  const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
  const px = -fy, py = fx;
  let vf = car.vx * fx + car.vy * fy;
  let vl = car.vx * px + car.vy * py;

  if (ctrl.throttle > 0) {
    if (vf < car.cls.top) vf += car.cls.acc * ctrl.throttle * dt;
  } else if (ctrl.throttle < 0) {
    vf += (vf > 8 ? -300 : car.cls.acc * 0.55 * ctrl.throttle) * dt;
  }
  vf -= vf * 0.5 * dt;                       // drag
  if (!ctrl.throttle) vf -= vf * 1.5 * dt;   // rolling resistance
  vf = clamp(vf, -car.cls.top * 0.38, car.cls.top);

  const authority = clamp(Math.abs(vf) / 55, 0, 1);
  car.angle += ctrl.steer * 1.85 * authority * dt * (vf < 0 ? -1 : 1) * (ctrl.hand ? 1.3 : 1);

  const gripRate = ctrl.hand ? 2.0 : car.cls.grip * 11;
  vl -= vl * Math.min(1, gripRate * dt);

  const nfx = Math.cos(car.angle), nfy = Math.sin(car.angle);
  car.vx = nfx * vf + (-nfy) * vl;
  car.vy = nfy * vf + nfx * vl;
  car.speed = vf;
  car.slip = Math.abs(vl);

  const ix = car.x + car.vx * dt;
  const iy = car.y + car.vy * dt;
  car.x = ix; car.y = iy;
  World.collideCircle(car, carRadius(car), false);
  const push = dist(ix, iy, car.x, car.y);
  if (push > 2) {
    const impact = Math.hypot(car.vx, car.vy) * clamp(push / 8, 0.25, 1);
    if (impact > 95) damageCar(car, (impact - 95) * 0.14, 'wall');
    car.vx *= -0.22; car.vy *= -0.22;
    car.speed *= -0.22;
    if (impact > 130 && typeof G !== 'undefined' && G.onCarCrash) G.onCarCrash(car, impact);
  }
  if (car.nearMissCd > 0) car.nearMissCd -= dt;
}

function damageCar(car, amount, cause) {
  if (car.wrecked) return;
  car.hp -= amount;
  if (car.hp <= 0) {
    car.hp = 0;
    car.wrecked = true;
    if (car.driver === 'player' && typeof G !== 'undefined' && G.onPlayerWrecked) G.onPlayerWrecked(car);
    if (typeof Particles !== 'undefined') Particles.burst(car.x, car.y, 'smoke', 14);
  }
}

// Circle-vs-circle between every pair of live cars; parked cars are heavy.
function collideCars(dt) {
  for (let i = 0; i < Cars.length; i++) {
    const a = Cars[i];
    if (a.dead) continue;
    for (let j = i + 1; j < Cars.length; j++) {
      const b = Cars[j];
      if (b.dead) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const rr2 = (carRadius(a) + carRadius(b)) * 0.92;
      const d2 = dx * dx + dy * dy;
      if (d2 >= rr2 * rr2 || d2 < 0.01) continue;
      const d = Math.sqrt(d2);
      const nx = dx / d, ny = dy / d;
      const overlap = rr2 - d;
      const aMove = a.parked ? 0.15 : 0.5;
      const bMove = b.parked ? 0.15 : 0.5;
      a.x -= nx * overlap * aMove; a.y -= ny * overlap * aMove;
      b.x += nx * overlap * bMove; b.y += ny * overlap * bMove;
      const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rel < 0) {
        const impulse = -rel * 0.55;
        a.vx -= nx * impulse * aMove * 2; a.vy -= ny * impulse * aMove * 2;
        b.vx += nx * impulse * bMove * 2; b.vy += ny * impulse * bMove * 2;
        const severity = -rel;
        if (severity > 95) {
          damageCar(a, (severity - 95) * 0.1, 'car');
          damageCar(b, (severity - 95) * 0.1, 'car');
          if (typeof G !== 'undefined' && G.onCarHit) G.onCarHit(a, b, severity);
        }
      }
    }
  }
}

// E key: climb in or out. Taking a car that is not yours is a crime, and an
// occupied car's driver bails out and runs.
function playerToggleCar() {
  if (Player.car) {
    const car = Player.car;
    car.driver = null;
    car.parked = true;
    Player.car = null;
    Player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
    Player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
    World.collideCircle(Player, Player.r, true);
    return;
  }
  const car = nearestCar(Player.x, Player.y, 46, true);
  if (!car) return;
  if (car.driver === 'traffic') {
    car.driver = null;
    Traffic.spawnPedAt(car.x + rr(-24, 24), car.y + rr(-24, 24), true);
  }
  car.parked = false;
  car.driver = 'player';
  Player.car = car;
  if (typeof G !== 'undefined' && G.addCrime) G.addCrime('steal');
}

// A few parked cars wait along the avenues for their first "owner".
function seedParkedCars() {
  let placed = 0, guard = 0;
  while (placed < 14 && guard++ < 200) {
    const cell = pick(World.roadCells);
    if (cell.r >= BEACH_ROW) continue;
    const horizontal = AVENUE_ROWS.indexOf(cell.r) >= 0 || cell.r === BOARDWALK_ROW;
    const x = cell.c * TILE + TILE / 2 + rr(-14, 14);
    const y = cell.r * TILE + TILE / 2 + (chance(0.5) ? 30 : -30);
    const car = makeCar(pick(CLASS_NAMES), x, y, horizontal ? 0 : Math.PI / 2, pick(CAR_COLORS));
    car.parked = true;
    placed++;
  }
}
