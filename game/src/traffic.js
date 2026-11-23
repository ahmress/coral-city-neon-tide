// traffic.js — civilian Coral City: cars that follow the road grid and
// pedestrians who wander the sidewalks, then run when things get loud.
// Traffic drives right-hand lanes from cell centre to cell centre, turning
// at intersections; nobody here is in a hurry until you give them a reason.
'use strict';

const Traffic = {
  cars: [],
  peds: [],
  TARGET_CARS: 24,
  TARGET_PEDS: 26,

  init() {
    this.cars = [];
    this.peds = [];
    for (let i = 0; i < this.TARGET_CARS; i++) this.spawnCar(true);
    for (let i = 0; i < this.TARGET_PEDS; i++) this.spawnPed(true);
  },

  spawnCar(anywhere) {
    const pt = World.randomRoadPoint(anywhere ? undefined : Player, 560);
    const cell = World.cellOf(pt.x, pt.y);
    const horizontal = AVENUE_ROWS.indexOf(cell.r) >= 0 || cell.r === BOARDWALK_ROW;
    const dir = horizontal
      ? { x: chance(0.5) ? 1 : -1, y: 0 }
      : { x: 0, y: chance(0.5) ? 1 : -1 };
    const car = makeCar(pick(CLASS_NAMES), pt.x, pt.y, Math.atan2(dir.y, dir.x), pick(CAR_COLORS));
    car.driver = 'traffic';
    car.trafficDir = dir;
    car.cruise = rr(105, 165);
    this.cars.push(car);
    return car;
  },

  spawnPed(anywhere) {
    const pt = anywhere ? World.randomWalkPoint() : World.randomWalkPoint();
    const ped = {
      x: pt.x, y: pt.y, angle: rr(0, TAU),
      tx: pt.x, ty: pt.y,
      state: 'walk', fleeT: 0, downT: 0,
      speed: rr(38, 62),
      tone: pick(['#e8b93c', '#d94f3d', '#3fbfae', '#f2f2f2', '#7a4fd0', '#57b25e'])
    };
    this.peds.push(ped);
    return ped;
  },

  spawnPedAt(x, y, fleeing) {
    if (this.peds.length >= 30) return null;
    const ped = {
      x, y, angle: rr(0, TAU), tx: x, ty: y,
      state: fleeing ? 'flee' : 'walk', fleeT: fleeing ? 1.8 : 0, downT: 0,
      speed: rr(40, 62),
      tone: pick(['#e8b93c', '#d94f3d', '#3fbfae', '#f2f2f2'])
    };
    this.peds.push(ped);
    return ped;
  },

  _nextCell(car) {
    const { c, r } = World.cellOf(car.x, car.y);
    const d = car.trafficDir;
    return { c: c + d.x, r: r + d.y };
  },

  _waypoint(car) {
    const n = this._nextCell(car);
    const d = car.trafficDir;
    const rightX = -d.y, rightY = d.x;
    return {
      x: n.c * TILE + TILE / 2 + rightX * 19,
      y: n.r * TILE + TILE / 2 + rightY * 19
    };
  },

  _chooseDir(car) {
    const { c, r } = World.cellOf(car.x, car.y);
    const d = car.trafficDir;
    const options = [];
    const straight = { x: d.x, y: d.y };
    const left = { x: d.y, y: -d.x };
    const right = { x: -d.y, y: d.x };
    if (World.isRoadCell(c + straight.x, r + straight.y)) options.push(straight, straight);
    if (World.isRoadCell(c + left.x, r + left.y)) options.push(left);
    if (World.isRoadCell(c + right.x, r + right.y)) options.push(right);
    if (!options.length) return { x: -d.x, y: -d.y };
    return pick(options);
  },

  _blockedAhead(car) {
    const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
    for (const other of Cars) {
      if (other === car || other.dead) continue;
      const dx = other.x - car.x, dy = other.y - car.y;
      const ahead = dx * fx + dy * fy;
      if (ahead < 8 || ahead > 74) continue;
      if (Math.abs(dx * -fy + dy * fx) < 26) return true;
    }
    if (!Player.car) {
      const dx = Player.x - car.x, dy = Player.y - car.y;
      const ahead = dx * fx + dy * fy;
      if (ahead > 0 && ahead < 52 && Math.abs(dx * -fy + dy * fx) < 22) return true;
    }
    return false;
  },

  updateCars(dt) {
    // keep the streets populated, recycle cars that fell too far behind
    let live = 0;
    for (const car of this.cars) if (!car.dead && car.driver === 'traffic') live++;
    if (live < this.TARGET_CARS && chance(0.1)) this.spawnCar(false);

    for (const car of this.cars) {
      if (car.dead) continue;
      if (car.driver !== 'traffic') continue;
      if (car.wrecked) {
        car.driver = null;
        car.parked = true;
        this.spawnPedAt(car.x + rr(-20, 20), car.y + rr(-20, 20), true);
        continue;
      }
      const dPlayer = dist(car.x, car.y, Player.x, Player.y);
      if (dPlayer > 1750) {
        const pt = World.randomRoadPoint(Player, 620);
        car.x = pt.x; car.y = pt.y;
        car.vx = 0; car.vy = 0;
      }
      const wp = this._waypoint(car);
      if (dist(car.x, car.y, wp.x, wp.y) < 34) {
        car.trafficDir = this._chooseDir(car);
      }
      const desired = Math.atan2(wp.y - car.y, wp.x - car.x);
      const steer = clamp(angNorm(desired - car.angle) * 2.2, -1, 1);
      const blocked = this._blockedAhead(car);
      const spd = Math.hypot(car.vx, car.vy);
      let throttle = 0;
      if (blocked) throttle = spd > 12 ? -1 : 0;
      else if (spd < car.cruise) throttle = 0.75;
      driveCar(car, dt, { throttle, steer, hand: false });
    }
    // prune references to cars that left the world array's concern
    this.cars = this.cars.filter((car) => !car.dead);
  },

  updatePeds(dt) {
    const danger = (typeof G !== 'undefined' && G.dangerT > 0) ? G.danger : null;
    for (const ped of this.peds) {
      if (ped.state === 'down') {
        ped.downT -= dt;
        if (ped.downT <= 0) {
          const pt = World.randomWalkPoint();
          ped.x = pt.x; ped.y = pt.y;
          ped.state = 'walk';
          ped.tx = pt.x; ped.ty = pt.y;
        }
        continue;
      }
      // fear: a fresh scare nearby, or anything fast and close
      let fleeFrom = null;
      if (danger && dist(ped.x, ped.y, danger.x, danger.y) < 170) fleeFrom = danger;
      if (!fleeFrom) {
        for (const car of Cars) {
          if (car.dead || car.parked) continue;
          if (Math.hypot(car.vx, car.vy) > 165 && dist(ped.x, ped.y, car.x, car.y) < 92) {
            fleeFrom = car;
            break;
          }
        }
      }
      if (fleeFrom) { ped.state = 'flee'; ped.fleeT = 1.5; ped.fx = fleeFrom.x; ped.fy = fleeFrom.y; }
      if (ped.state === 'flee') {
        ped.fleeT -= dt;
        const a = Math.atan2(ped.y - ped.fy, ped.x - ped.fx);
        ped.x += Math.cos(a) * 196 * dt;
        ped.y += Math.sin(a) * 196 * dt;
        ped.angle = a;
        if (ped.fleeT <= 0) { ped.state = 'walk'; ped.tx = ped.x; ped.ty = ped.y; }
      } else {
        if (dist(ped.x, ped.y, ped.tx, ped.ty) < 10 || chance(0.002)) {
          const pt = World.randomWalkPoint();
          ped.tx = pt.x; ped.ty = pt.y;
        }
        const a = Math.atan2(ped.ty - ped.y, ped.tx - ped.x);
        ped.angle = angTurn(ped.angle, a, 6 * dt);
        ped.x += Math.cos(ped.angle) * ped.speed * dt;
        ped.y += Math.sin(ped.angle) * ped.speed * dt;
      }
      World.collideCircle(ped, 9, true);
      // traffic is dangerous: a fast car through a pedestrian ends both days
      for (const car of Cars) {
        if (car.dead || car.parked) continue;
        const spd = Math.hypot(car.vx, car.vy);
        if (spd < 55) continue;
        if (dist(ped.x, ped.y, car.x, car.y) < carRadius(car) + 9) {
          ped.state = 'down';
          ped.downT = 7;
          if (typeof G !== 'undefined' && G.onPedHit) G.onPedHit(ped, car);
          break;
        }
      }
    }
  },

  update(dt) {
    this.updateCars(dt);
    this.updatePeds(dt);
  }
};
