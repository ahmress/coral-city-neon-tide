// missions.js — the work that pays: a five-job story chain for Vex, the
// casino fixer, and Mara at the cold-storage warehouse, then endless
// delivery runs. Each job is a small state machine: offer, dialog, active
// objective, payout. Fail a timer and the job goes back on the board.
'use strict';

const Missions = {
  idx: 0,
  state: 'offer', // offer | dialog | active | free
  dialog: null,
  obj: null,
  endless: null,
  endlessN: 0,

  defs: [
    {
      name: 'First Run', giver: 'casino', pay: 450,
      lines: [
        { who: 'Vex', text: 'You are the new wheel? Good. I need a package moved, no questions.' },
        { who: 'Vex', text: 'It is around the back of the casino. Take it to the dock foreman in Marina Bay.' },
        { who: 'Vex', text: 'Clock is running once it is in your hands. Do not dent the merchandise.' }
      ]
    },
    {
      name: 'Neon Sprint', giver: 'casino', pay: 600,
      lines: [
        { who: 'Vex', text: 'A sponsor wants proof this city can be crossed fast. Four lights, one run.' },
        { who: 'Vex', text: 'Hit every marker on the Strip before the timer dies. Style is optional. Speed is not.' }
      ]
    },
    {
      name: 'Hot Cargo', giver: 'warehouse', pay: 900,
      lines: [
        { who: 'Mara', text: 'That crate was never here, and neither were you. Load it at my door.' },
        { who: 'Mara', text: 'The moment you roll, every badge in Coral City will smell it. Lose them, then deliver to the Azul hotel.' }
      ]
    },
    {
      name: 'The Rival', giver: 'casino', pay: 1200,
      lines: [
        { who: 'Vex', text: 'A yellow muscle car has been taking my fares and my parking spots. Both end tonight.' },
        { who: 'Vex', text: 'Find it. Introduce it to a wall. Repeat until it stops moving.' }
      ]
    },
    {
      name: 'Lighthouse Run', giver: 'casino', pay: 2000,
      lines: [
        { who: 'Vex', text: 'Last job, biggest envelope. The lighthouse keeper pays cash and asks nothing.' },
        { who: 'Vex', text: 'One catch: the whole department will be awake. Three stars, locked in, all the way to Palmetto Point.' }
      ]
    }
  ],

  init() {
    this.idx = 0;
    this.state = 'offer';
    this.dialog = null;
    this.obj = null;
    this.endless = null;
    this.endlessN = 0;
  },

  giverPos() {
    if (this.state === 'free' || this.endless) {
      return this.endless ? this.endless.giverAt : World.casinoPos;
    }
    const def = this.defs[this.idx];
    if (!def) return World.casinoPos;
    return def.giver === 'warehouse' ? World.warehousePos : World.casinoPos;
  },

  currentName() {
    if (this.endless) return this.endless.name;
    const def = this.defs[this.idx];
    return def ? def.name : 'Free Roam';
  },

  tryOpenDialog() {
    if (this.state !== 'offer' && this.state !== 'free') return false;
    const g = this.giverPos();
    if (dist(Player.x, Player.y, g.x, g.y) > 58) return false;
    let lines;
    if (this.endless) lines = this.endless.lines;
    else {
      const def = this.defs[this.idx];
      if (!def) return false;
      lines = def.lines;
    }
    this.dialog = { lines, i: 0 };
    this.state = 'dialog';
    return true;
  },

  advanceDialog() {
    if (!this.dialog) return;
    this.dialog.i++;
    Snd.tone(520, 0.05, 'square', 0.05);
    if (this.dialog.i >= this.dialog.lines.length) {
      this.dialog = null;
      this.accept();
    }
  },

  closeDialog() {
    this.dialog = null;
    if (this.state === 'dialog') this.state = this.endless ? 'free' : 'offer';
  },

  accept() {
    if (this.endless) {
      const e = this.endless;
      this.obj = { kind: 'deliver', stage: 'pickup', at: e.pickupAt, to: e.dropAt, pay: e.pay, t: e.time };
      this.state = 'active';
      G.banner('JOB STARTED — ' + e.name);
      return;
    }
    const i = this.idx;
    if (i === 0) {
      this.obj = { kind: 'deliver', stage: 'pickup', at: { x: 22.5 * TILE, y: 13.45 * TILE }, to: World.dockPos, pay: 450, t: 0, timerOnPickup: 150 };
    } else if (i === 1) {
      this.obj = {
        kind: 'checkpoints', i: 0, t: 110, pay: 600,
        cps: [
          { x: 18.5 * TILE, y: 9.5 * TILE }, { x: 27.5 * TILE, y: 9.5 * TILE },
          { x: 33.5 * TILE, y: 15.5 * TILE }, { x: 24.5 * TILE, y: 21.5 * TILE }
        ]
      };
    } else if (i === 2) {
      this.obj = { kind: 'hotcargo', stage: 'pickup', at: World.warehousePos, to: World.resortPos, pay: 900, t: 0 };
    } else if (i === 3) {
      const pt = World.randomRoadPoint(Player, 520);
      const target = makeCar('muscle', pt.x, pt.y, rr(0, TAU), TARGET_COLOR);
      target.driver = 'target';
      target.hp = 130; target.maxHp = 130;
      this.obj = { kind: 'ram', target, pay: 1200, t: 240 };
    } else if (i === 4) {
      Police.setLock(3);
      this.obj = { kind: 'reach', to: World.lighthousePos, pay: 2000, t: 180 };
    }
    this.state = 'active';
    G.banner('JOB STARTED — ' + this.currentName());
    Snd.chime('pickup');
  },

  complete() {
    const pay = this.obj ? this.obj.pay : 0;
    G.addCash(pay);
    G.banner('JOB DONE  +$' + pay);
    Snd.chime('stinger');
    if (this.obj && this.obj.kind === 'reach') Police.setLock(0);
    this.obj = null;
    if (this.endless) {
      this.endless = null;
      this.state = 'free';
      this.makeEndless();
    } else {
      this.idx++;
      if (this.idx >= this.defs.length) {
        this.state = 'free';
        G.cityCleared();
        this.makeEndless();
      } else {
        this.state = 'offer';
      }
    }
  },

  fail(why) {
    G.banner('JOB FAILED — ' + why);
    Snd.chime('fail');
    if (this.obj && this.obj.kind === 'reach') Police.setLock(0);
    if (this.obj && this.obj.kind === 'ram' && this.obj.target) {
      this.obj.target.driver = 'traffic';
      this.obj.target.trafficDir = { x: 1, y: 0 };
      Traffic.cars.push(this.obj.target);
    }
    this.obj = null;
    this.state = this.endless ? 'free' : 'offer';
    if (this.endless) { this.endless = null; this.makeEndless(); }
  },

  makeEndless() {
    const spots = [
      { name: 'the casino', at: World.casinoPos },
      { name: 'the warehouse', at: World.warehousePos },
      { name: 'the docks', at: World.dockPos },
      { name: 'the Azul hotel', at: World.resortPos }
    ];
    const from = pick(spots);
    let to = pick(spots);
    if (to === from) to = spots[(spots.indexOf(from) + 1) % spots.length];
    const d = dist(from.at.x, from.at.y, to.at.x, to.at.y);
    this.endlessN++;
    this.endless = {
      name: 'Delivery #' + this.endlessN,
      giverAt: from.at,
      pickupAt: from.at,
      dropAt: to.at,
      pay: Math.round(150 + d / 11),
      time: Math.round(70 + d / 16),
      lines: [{ who: 'Dispatcher', text: 'Package at ' + from.name + ', wanted at ' + to.name + '. Meter is running.' }]
    };
    if (this.state === 'free') this.state = 'offer';
  },

  markerPos() {
    if (this.state === 'offer' || this.state === 'dialog' || this.state === 'free') return this.giverPos();
    const o = this.obj;
    if (!o) return this.giverPos();
    if (o.kind === 'deliver' || o.kind === 'hotcargo') return o.stage === 'pickup' ? o.at : o.to;
    if (o.kind === 'checkpoints') return o.cps[o.i];
    if (o.kind === 'ram') return o.target ? { x: o.target.x, y: o.target.y } : this.giverPos();
    if (o.kind === 'reach') return o.to;
    return this.giverPos();
  },

  objectiveText() {
    if (this.state === 'offer') return 'Find the ! marker — work is waiting';
    if (this.state === 'dialog') return 'Talking… (E to continue)';
    if (this.state === 'free') return 'Free roam — find the ! marker for another run';
    const o = this.obj;
    if (!o) return '';
    const t = o.t > 0 ? '  ·  ' + Math.ceil(o.t) + 's' : '';
    if (o.kind === 'deliver') return (o.stage === 'pickup' ? 'Pick up the package' : 'Deliver to the marker') + t;
    if (o.kind === 'hotcargo') {
      if (o.stage === 'pickup') return 'Load the hot cargo at the warehouse';
      if (o.stage === 'loseheat') return 'Lose the heat — get to zero stars';
      return 'Deliver to the Azul hotel' + t;
    }
    if (o.kind === 'checkpoints') return 'Checkpoint ' + (o.i + 1) + ' of ' + o.cps.length + t;
    if (o.kind === 'ram') return 'Wreck the yellow muscle car' + t;
    if (o.kind === 'reach') return 'Reach the lighthouse — heat locked at 3 stars' + t;
    return '';
  },

  update(dt) {
    if (this.state === 'dialog') {
      const g = this.giverPos();
      if (dist(Player.x, Player.y, g.x, g.y) > 110) this.closeDialog();
      return;
    }
    if (this.state !== 'active' || !this.obj) return;
    const o = this.obj;
    if (o.t > 0) {
      o.t -= dt;
      if (o.t <= 0) { this.fail('out of time'); return; }
    }
    const near = (p, rad) => dist(Player.x, Player.y, p.x, p.y) < rad;

    if (o.kind === 'deliver') {
      if (o.stage === 'pickup' && near(o.at, 62)) {
        o.stage = 'deliver';
        if (o.timerOnPickup) o.t = o.timerOnPickup;
        Snd.chime('pickup');
        G.banner('PACKAGE ON BOARD');
      } else if (o.stage === 'deliver' && near(o.to, 66)) {
        this.complete();
      }
    } else if (o.kind === 'hotcargo') {
      if (o.stage === 'pickup' && near(o.at, 62)) {
        o.stage = 'loseheat';
        Police.heat = Math.max(Police.heat, 52);
        Police.stars = Police.starsFor(Police.heat);
        G.dangerAt(Player.x, Player.y);
        Snd.chime('pickup');
        G.banner('CARGO LOADED — YOU ARE HOT');
      } else if (o.stage === 'loseheat' && Police.stars === 0) {
        o.stage = 'deliver';
        o.t = 120;
        G.banner('CLEAN. DELIVER IT.');
      } else if (o.stage === 'deliver' && near(o.to, 66)) {
        this.complete();
      }
    } else if (o.kind === 'checkpoints') {
      if (near(o.cps[o.i], 74)) {
        o.i++;
        Snd.chime('pickup');
        if (o.i >= o.cps.length) this.complete();
        else G.banner('CHECKPOINT ' + o.i + ' / ' + o.cps.length);
      }
    } else if (o.kind === 'ram') {
      const t = o.target;
      if (!t || t.dead) { this.fail('target lost'); return; }
      if (t.wrecked) { this.complete(); return; }
      // the rival runs: steer away from the player, quick but not perfect
      const away = Math.atan2(t.y - Player.y, t.x - Player.x);
      const wob = Math.sin(G.time * 0.7 + t.id) * 0.35;
      const desired = away + wob;
      const steer = clamp(angNorm(desired - t.angle) * 2.2, -1, 1);
      const spd = Math.hypot(t.vx, t.vy);
      driveCar(t, dt, { throttle: spd < t.cls.top * 0.8 ? 0.95 : 0.2, steer, hand: false });
      World.collideCircle(t, carRadius(t), false);
    } else if (o.kind === 'reach') {
      if (near(o.to, 76)) this.complete();
    }
  }
};
