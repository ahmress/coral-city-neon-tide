// input.js — keyboard and mouse state, polled once per frame by the loop.
// `keys` is the held state, `pressedSet` is the edge (went down this frame),
// and mouse coordinates are stored in canvas pixels, not CSS pixels.
'use strict';

const Input = {
  keys: {},
  pressedSet: new Set(),
  mouseX: 640,
  mouseY: 400,
  mouseDown: false,
  clicked: false,
  canvas: null,

  init(canvas) {
    this.canvas = canvas;
    window.addEventListener('keydown', (e) => {
      if (e.code === 'ArrowUp' || e.code === 'ArrowDown' ||
          e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'Space') {
        e.preventDefault();
      }
      if (!e.repeat) this.pressedSet.add(e.code);
      this.keys[e.code] = true;
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = {}; this.mouseDown = false; });
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouseX = (e.clientX - r.left) * (canvas.width / r.width);
      this.mouseY = (e.clientY - r.top) * (canvas.height / r.height);
    });
    canvas.addEventListener('mousedown', () => {
      this.mouseDown = true;
      this.clicked = true;
    });
    window.addEventListener('mouseup', () => { this.mouseDown = false; });
  },

  down(code) { return !!this.keys[code]; },
  pressed(code) { return this.pressedSet.has(code); },

  // Movement axes: WASD or arrows, -1..1 on each axis.
  axisX() {
    return (this.down('KeyD') || this.down('ArrowRight') ? 1 : 0) -
           (this.down('KeyA') || this.down('ArrowLeft') ? 1 : 0);
  },
  axisY() {
    return (this.down('KeyS') || this.down('ArrowDown') ? 1 : 0) -
           (this.down('KeyW') || this.down('ArrowUp') ? 1 : 0);
  },
  interact() { return this.pressed('KeyE'); },
  postFrame() {
    this.pressedSet.clear();
    this.clicked = false;
  }
};
