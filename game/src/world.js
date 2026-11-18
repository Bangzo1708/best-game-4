// The simulation: wardens, moths, waves, gold, and the lantern's health. It knows
// nothing about the canvas; the renderer reads its state and paints it. Every
// random choice comes from the world's own seeded generator, so the same seed
// replays the same game.

import {
  BOARD, LANTERN_CELL, LANTERN_HP, MOTH, PATH_CELLS, START_GOLD, TOTAL_WAVES,
  UPGRADE, WARDEN, WAVE, WAVE_BONUS,
} from './config.js';

export const EVENT_HIT = 1;
export const EVENT_OVER = 2;
export const EVENT_WIN = 4;
export const EVENT_WAVE_CLEAR = 8;
export const EVENT_KILL = 16;

function cellCentre(c, r) {
  return [BOARD.ox + c * BOARD.cell + BOARD.cell / 2, BOARD.oy + r * BOARD.cell + BOARD.cell / 2];
}

/** The trail as a list of pixel waypoints the moths walk, lantern last. */
export function trailPoints() {
  const points = [];
  for (let i = 0; i < PATH_CELLS.length - 1; i += 1) {
    const [x1, y1] = cellCentre(PATH_CELLS[i][0], PATH_CELLS[i][1]);
    const [x2, y2] = cellCentre(PATH_CELLS[i + 1][0], PATH_CELLS[i + 1][1]);
    const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) / 8;
    for (let s = 0; s < steps; s += 1) points.push([x1 + (x2 - x1) * s / steps, y1 + (y2 - y1) * s / steps]);
  }
  points.push(cellCentre(LANTERN_CELL[0], LANTERN_CELL[1]));
  return points;
}

/** Is the cell part of the moths' trail? Wardens may only be built off it. */
export function isTrailCell(c, r) {
  for (let i = 0; i < PATH_CELLS.length - 1; i += 1) {
    const [a, b] = PATH_CELLS[i];
    const [d, e] = PATH_CELLS[i + 1];
    if (a === d && c === a && r >= Math.min(b, e) && r <= Math.max(b, e)) return true;
    if (b === e && r === b && c >= Math.min(a, d) && c <= Math.max(a, d)) return true;
  }
  return false;
}

/** What wave `n` sends: a queue of moth kinds, the queen last on wave 10. */
export function waveComposition(n) {
  const total = 6 + n * 3;
  const kinds = [];
  for (let i = 0; i < total; i += 1) {
    if (n >= 3 && i % 7 === 6) kinds.push('brute');
    else if (n >= 2 && i % 4 === 3) kinds.push('swift');
    else kinds.push('flutter');
  }
  if (n === TOTAL_WAVES) kinds.push('queen');
  return kinds;
}

export function createWorld(random) {
  const trail = trailPoints();
  const state = {
    gold: START_GOLD,
    hp: LANTERN_HP,
    wave: 0,
    score: 0,
    kills: 0,
    leaked: 0,
    earned: 0,
    wardens: [],
    moths: [],
    shots: [],
    parts: [],
    floats: [],
    spawnQueue: [],
    spawnT: 0,
    waveActive: false,
    waveClearT: 0,
    time: 0,
    flash: 0,
    shake: 0,
    random,
  };

  function reset() {
    state.gold = START_GOLD;
    state.hp = LANTERN_HP;
    state.wave = 0;
    state.score = 0;
    state.kills = 0;
    state.leaked = 0;
    state.earned = 0;
    state.wardens = [];
    state.moths = [];
    state.shots = [];
    state.parts = [];
    state.floats = [];
    state.spawnQueue = [];
    state.spawnT = 0;
    state.waveActive = false;
    state.waveClearT = 0;
    state.time = 0;
    state.flash = 0;
    state.shake = 0;
  }

  function burst(x, y, color, count) {
    for (let i = 0; i < count; i += 1) {
      state.parts.push({
        x, y,
        vx: (state.random() - 0.5) * 220,
        vy: (state.random() - 0.5) * 220,
        life: 0.4 + state.random() * 0.3,
        color,
        size: 2 + state.random() * 3,
      });
    }
  }

  function floatText(x, y, text, color) {
    state.floats.push({ x, y, text, color, life: 1.1 });
  }

  function startWave() {
    if (state.waveActive || state.wave >= TOTAL_WAVES) return false;
    state.wave += 1;
    const kinds = waveComposition(state.wave);
    const hpBase = WAVE.hpBase + state.wave * WAVE.hpPerWave;
    const speedBase = WAVE.speedBase + state.wave * WAVE.speedPerWave;
    state.spawnQueue = kinds.map((kind) => ({
      kind,
      hp: hpBase * MOTH[kind].hp,
      speed: speedBase * MOTH[kind].speed * (0.9 + state.random() * 0.2),
    }));
    state.spawnT = 0.4;
    state.waveActive = true;
    return true;
  }

  /** Build a warden of `kind` on cell (c, r). Returns the warden, or null. */
  function buildWarden(kind, c, r) {
    const def = WARDEN[kind];
    if (!def) return null;
    if (c < 0 || c >= BOARD.cols || r < 0 || r >= BOARD.rows) return null;
    if (isTrailCell(c, r)) return null;
    if (state.wardens.some((w) => w.c === c && w.r === r)) return null;
    if (state.gold < def.cost) return null;
    state.gold -= def.cost;
    const [x, y] = cellCentre(c, r);
    const warden = { c, r, x, y, kind, level: 1, cd: 0, kills: 0, ...def };
    state.wardens.push(warden);
    burst(x, y, def.color, 12);
    return warden;
  }

  function upgradeCost(warden) {
    if (warden.level >= UPGRADE.maxLevel) return null;
    return Math.round(WARDEN[warden.kind].cost * (warden.level === 1 ? 0.6 : 1.0));
  }

  /** Raise a warden one level. Returns true when the gold was there. */
  function upgradeWarden(warden) {
    const cost = upgradeCost(warden);
    if (cost === null || state.gold < cost) return false;
    state.gold -= cost;
    warden.level += 1;
    warden.damage = Math.round(warden.damage * UPGRADE.damage);
    warden.range = Math.round(warden.range * UPGRADE.range);
    warden.rate = warden.rate * UPGRADE.rate;
    burst(warden.x, warden.y, '#ffffff', 14);
    return true;
  }

  function step(dt, attract) {
    state.time += dt;
    state.flash = Math.max(0, state.flash - dt * 2);
    state.shake = Math.max(0, state.shake - dt * 3);
    let events = 0;

    if (state.waveActive) {
      state.spawnT -= dt;
      if (state.spawnQueue.length > 0 && state.spawnT <= 0) {
        const next = state.spawnQueue.shift();
        state.moths.push({
          ...next,
          x: trail[0][0],
          y: trail[0][1],
          i: 0,
          maxhp: next.hp,
          slow: 0,
          wing: state.random() * 6,
        });
        state.spawnT = WAVE.spawnInterval;
      }
      if (!attract && state.spawnQueue.length === 0 && state.moths.length === 0) {
        state.waveActive = false;
        state.waveClearT = 2.2;
        const bonus = WAVE_BONUS.base + state.wave * WAVE_BONUS.perWave;
        state.gold += bonus;
        state.earned += bonus;
        state.score += 100 * state.wave;
        events |= EVENT_WAVE_CLEAR;
        if (state.wave >= TOTAL_WAVES) events |= EVENT_WIN;
      }
    }
    state.waveClearT = Math.max(0, state.waveClearT - dt);

    // Wardens fire at the moth nearest the lantern within range.
    // In attract mode (the title screen) they hold their fire.
    for (const warden of state.wardens) {
      if (attract) break;
      warden.cd -= dt;
      if (warden.cd > 0) continue;
      let target = null;
      let bestProgress = -1;
      for (const moth of state.moths) {
        const d = Math.hypot(moth.x - warden.x, moth.y - warden.y);
        if (d <= warden.range && moth.i > bestProgress) { bestProgress = moth.i; target = moth; }
      }
      if (!target) continue;
      warden.cd = 1 / warden.rate;
      state.shots.push({ x: warden.x, y: warden.y, tx: target.x, ty: target.y, life: 0.12, kind: warden.kind });
      target.hp -= warden.damage;
      if (warden.kind === 'frost') target.slow = 1.2;
      if (warden.kind === 'spark') {
        burst(target.x, target.y, '#ffd166', 6);
        for (const moth of state.moths) {
          if (moth !== target && Math.hypot(moth.x - target.x, moth.y - target.y) < 55) moth.hp -= warden.damage * 0.6;
        }
      }
    }

    // Deaths pay gold; arrivals hurt the lantern.
    for (let i = state.moths.length - 1; i >= 0; i -= 1) {
      const moth = state.moths[i];
      if (attract) {
        // Drift along the trail and loop back to the gate: a living backdrop.
        const speed = moth.speed;
        moth.wing += dt * 18;
        let remaining = speed * dt;
        while (remaining > 0 && moth.i < trail.length - 1) {
          const [nx, ny] = trail[moth.i + 1];
          const d = Math.hypot(nx - moth.x, ny - moth.y);
          const move = Math.min(remaining, d);
          moth.x += (nx - moth.x) / d * move;
          moth.y += (ny - moth.y) / d * move;
          remaining -= move;
          if (move === d) moth.i += 1;
        }
        if (moth.i >= trail.length - 1) {
          moth.i = 0;
          moth.x = trail[0][0];
          moth.y = trail[0][1];
        }
        continue;
      }
      if (moth.hp <= 0) {
        state.moths.splice(i, 1);
        const pay = MOTH[moth.kind].gold;
        state.gold += pay;
        state.earned += pay;
        state.score += 10;
        state.kills += 1;
        burst(moth.x, moth.y, '#ffd166', 10);
        floatText(moth.x, moth.y - 14, `+${pay}g`, '#ffe9a8');
        events |= EVENT_KILL;
        continue;
      }
      const speed = moth.speed * (moth.slow > 0 ? 0.45 : 1);
      moth.slow -= dt;
      moth.wing += dt * 18;
      let remaining = speed * dt;
      while (remaining > 0 && moth.i < trail.length - 1) {
        const [nx, ny] = trail[moth.i + 1];
        const d = Math.hypot(nx - moth.x, ny - moth.y);
        const move = Math.min(remaining, d);
        moth.x += (nx - moth.x) / d * move;
        moth.y += (ny - moth.y) / d * move;
        remaining -= move;
        if (move === d) moth.i += 1;
      }
      if (moth.i >= trail.length - 1) {
        state.moths.splice(i, 1);
        state.hp -= MOTH[moth.kind].harm;
        state.leaked += 1;
        state.flash = 1;
        state.shake = 1;
        burst(moth.x, moth.y, '#ff5d5d', 14);
        events |= EVENT_HIT;
        if (state.hp <= 0) events |= EVENT_OVER;
      }
    }

    state.shots = state.shots.filter((s) => (s.life -= dt) > 0);
    state.parts = state.parts.filter((p) => (p.life -= dt) > 0);
    for (const part of state.parts) { part.x += part.vx * dt; part.y += part.vy * dt; }
    state.floats = state.floats.filter((f) => (f.life -= dt) > 0);
    for (const f of state.floats) f.y -= 24 * dt;
    return events;
  }

  return {
    state, trail, reset, startWave, buildWarden, upgradeWarden, upgradeCost, step,
    isTrailCell, cellCentre,
  };
}
