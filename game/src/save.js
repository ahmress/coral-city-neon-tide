// save.js — the best score a player has ever banked in Coral City,
// kept in localStorage so the title screen can brag about it.
'use strict';

const Save = {
  KEY: 'coral-city-neon-tide-best',

  best() {
    try {
      return parseInt(localStorage.getItem(this.KEY) || '0', 10) || 0;
    } catch (e) {
      return 0;
    }
  },

  submit(score) {
    try {
      const s = Math.floor(score);
      if (s > this.best()) localStorage.setItem(this.KEY, String(s));
    } catch (e) {
      // private mode or a blocked store: the run still counts, it just
      // does not follow you home
    }
  },

  reset() {
    try { localStorage.removeItem(this.KEY); } catch (e) { /* nothing to clear */ }
  }
};
