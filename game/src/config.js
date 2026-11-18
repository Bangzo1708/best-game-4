// Every tuning number, colour and layout constant in one place. The playfield is
// a fixed 1280x720 logical area; the renderer scales it to the window, so no rule
// below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The board: 13 by 8 cells of 64 px, with the side panel to its right. */
export const BOARD = { ox: 64, oy: 72, cell: 64, cols: 13, rows: 8 };

/** The moths' winding trail, in board cells, from the west gate to the lantern. */
export const PATH_CELLS = [
  [0, 3], [4, 3], [4, 1], [9, 1], [9, 5], [12, 5], [12, 3],
];

/** The lantern's cell: the last cell of the trail, where moths strike. */
export const LANTERN_CELL = [12, 3];

export const LANTERN_HP = 10;
export const START_GOLD = 180;
export const TOTAL_WAVES = 10;

/** Warden kinds: what a tower costs, hits for, and how it behaves. */
export const WARDEN = {
  thorn: { name: 'Thorn', cost: 40, damage: 9, rate: 2.2, range: 118, color: '#7ee081', glyph: '🌵', blurb: 'Fast thorns, cheap' },
  frost: { name: 'Frost', cost: 70, damage: 4, rate: 1.1, range: 138, color: '#8fd3ff', glyph: '❄', blurb: 'Chills moths slow' },
  spark: { name: 'Spark', cost: 120, damage: 26, rate: 0.7, range: 148, color: '#ffd166', glyph: '✦', blurb: 'Splash burst' },
};

/** An upgrade multiplies damage and range and quickens the rate. */
export const UPGRADE = { damage: 1.45, range: 1.08, rate: 1.1, maxLevel: 3 };

/** Moth kinds: hit points and speed are multipliers on the wave's base. */
export const MOTH = {
  flutter: { hp: 1.0, speed: 1.0, gold: 4, harm: 1, radius: 9, color: '#e5e7eb' },
  swift: { hp: 0.55, speed: 1.5, gold: 5, harm: 1, radius: 8, color: '#f0abfc' },
  brute: { hp: 3.2, speed: 0.65, gold: 10, harm: 2, radius: 13, color: '#c084fc' },
  queen: { hp: 22.0, speed: 0.5, gold: 80, harm: 5, radius: 20, color: '#fbbf24' },
};

/** A wave's base hit points and speed, before the moth kind's multiplier. */
export const WAVE = { hpBase: 26, hpPerWave: 18, speedBase: 30, speedPerWave: 1.5, spawnInterval: 0.55 };

/** Gold for clearing a wave, before the wave number's bonus. */
export const WAVE_BONUS = { base: 15, perWave: 2 };

/** The side panel: warden cards, wave button, and the selected warden's panel. */
export const PANEL = { x: 944, y: 72, w: 320, h: 512 };
export const CARD = { x: 944, w: 320, h: 96, gap: 10, firstY: 108 };

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'mothlight-keep.best';

export const PALETTE = {
  backdrop: '#0d1020',
  board: '#141a33',
  grass: '#1b2340',
  trail: '#2c355e',
  trailLine: '#4a5a94',
  hud: '#1d2447',
  panel: '#1a2142',
  card: '#232b4d',
  cardSel: '#3b4a7d',
  text: '#eef1f5',
  muted: '#8b93a3',
  gold: '#ffe9a8',
  danger: '#ff5d5d',
  lantern: '#ffd166',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
