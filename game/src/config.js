// config.js — the shape of Coral City: grid, streets, car classes, names.
// The world is a 48x36 grid of 96px cells. Streets and avenues cut it into
// blocks; the south edge falls away into sand, then water.
'use strict';

const TILE = 96;
const COLS = 48;
const ROWS = 36;
const WORLD_W = COLS * TILE;
const WORLD_H = ROWS * TILE;

const STREET_COLS = [2, 8, 14, 20, 26, 32, 38, 44];
const AVENUE_ROWS = [3, 9, 15, 21, 27];
const BOARDWALK_ROW = 30;
const BEACH_ROW = 31;
const WATER_ROW = 33;
const PIER_COL = 10;

const DAY_LEN = 300; // seconds per full dusk -> night -> dusk cycle

const CAR_CLASSES = {
  compact:  { top: 252, acc: 150, grip: 0.90, w: 34, h: 17, hp: 80,  label: 'Compact' },
  muscle:   { top: 322, acc: 205, grip: 0.83, w: 39, h: 19, hp: 115, label: 'Muscle' },
  supercar: { top: 428, acc: 275, grip: 0.87, w: 39, h: 18, hp: 95,  label: 'Supercar' }
};
const CLASS_NAMES = ['compact', 'muscle', 'supercar'];

const CAR_COLORS = ['#d94f3d', '#3d7bd9', '#e8b93c', '#57b25e', '#c9ccd4',
  '#7a4fd0', '#e2703a', '#3fbfae', '#888d99', '#f2f2f2'];
const COP_COLOR = '#22334f';
const TARGET_COLOR = '#ffcf3f';

const STREET_NAMES = {
  2: 'Dock Street', 8: 'Warehouse Way', 14: 'Palm Drive', 20: 'Casino Row',
  26: 'Flamingo Road', 32: 'Coral Avenue', 38: 'Beacon Street', 44: 'Harbor View'
};
const AVENUE_NAMES = {
  3: 'Marina Boulevard', 9: 'Neon Strip', 15: 'Vex Avenue',
  21: 'Palmetto Avenue', 27: 'Shoreline Drive', 30: 'The Boardwalk'
};

// District lookup by cell: the marina works the west, the strip glows in
// the middle, and Palmetto Beach owns the east plus the whole shoreline.
function districtAt(col, row) {
  if (row >= BEACH_ROW) return 'Palmetto Beach';
  if (col < 16) return 'Marina Bay';
  if (col < 32) return 'Neon Strip';
  return 'Palmetto Beach';
}

const NEON_SIGNS = ['PALMS', 'VEX', 'ORBIT', 'LUNA', 'HOTEL', 'TIDE',
  'AZUL', 'NOCHE', 'VELVET', 'MARLIN', 'SABLE', 'ONDA'];
