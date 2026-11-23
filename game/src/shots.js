// shots.js — deterministic screenshot scenes and the self-test report.
// The screenshot harness loads the game with ?shot=<scene>&seed=1; each
// scene arranges the city, the player and the heat into one frozen moment
// of a run. With &test=1 the game also writes {fps, errors} as JSON into
// the #shot-report element after about five seconds.
'use strict';

const ShotCfg = (() => {
  const q = new URLSearchParams(location.search);
  return {
    seed: parseInt(q.get('seed') || '1', 10) || 1,
    name: q.get('shot') || '',
    test: q.get('test') === '1'
  };
})();

const Shots = {
  apply(name) {
    if (name === 'start') {
      // title screen over the pier at dusk
      G.state = 'title';
      G.phaseOverride = 0.58;
      Player.x = PIER_COL * TILE + TILE / 2;
      Player.y = 32.4 * TILE;
      Player.car = null;
      G.cam.x = clamp(Player.x - 640, 0, WORLD_W - 1280);
      G.cam.y = clamp(Player.y - 430, 0, WORLD_H - 800);
      return;
    }
    G.state = 'playing';
    if (name === 'drive') {
      // night on the Neon Strip, supercar rolling east with traffic
      G.phaseOverride = 0.8;
      const car = makeCar('supercar', 23.5 * TILE, 9.5 * TILE + 19, 0, '#d94f3d');
      car.driver = 'player';
      car.vx = 205;
      Player.car = car;
      Player.x = car.x; Player.y = car.y;
      G.shotCruise = true;
    } else if (name === 'mission') {
      // dusk, on foot at the casino door, the first job's dialog open
      G.phaseOverride = 0.6;
      Player.x = World.casinoPos.x;
      Player.y = World.casinoPos.y + 6;
      Player.car = null;
      Missions.state = 'dialog';
      Missions.dialog = { lines: Missions.defs[0].lines, i: 0 };
    } else if (name === 'chase') {
      // late dusk, four stars, a roadblock ahead and units behind
      G.phaseOverride = 0.76;
      const car = makeCar('muscle', 27.5 * TILE, 15.5 * TILE + 19, 0, '#57b25e');
      car.driver = 'player';
      car.vx = 165;
      Player.car = car;
      Player.x = car.x; Player.y = car.y; Player.angle = 0;
      G.shotCruise = true;
      Police.heat = 100;
      Police.stars = Police.starsFor(Police.heat);
      for (const [dx, dy] of [[-150, -52], [-215, 30], [-320, -8]]) {
        const cop = makeCar('muscle', car.x + dx, car.y + dy, 0, COP_COLOR);
        cop.driver = 'police';
        cop.vx = 150;
        cop.stuckT = 0; cop.reverseT = 0;
        Police.cars.push(cop);
      }
      Police.spawnBlock();
      Police.bustMeter = 0.3;
    }
    G.cam.x = clamp(Player.x - 640, 0, WORLD_W - 1280);
    G.cam.y = clamp(Player.y - 400, 0, WORLD_H - 800);
  },

  report(fps) {
    const el = document.getElementById('shot-report');
    if (el) {
      el.textContent = JSON.stringify({
        scene: ShotCfg.name || 'live',
        fps: Math.round(fps),
        errors: (window.__errs || []).length,
        detail: (window.__errs || []).slice(0, 4)
      });
    }
  }
};
