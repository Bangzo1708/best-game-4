// The screenshot scenes behind ?shot=start|play|upgrade|end. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by a
// scripted build: the warden placements a careful player would make, the waves
// started on time, upgrades bought when the gold is there. The frame is what a
// real game looks like, and the same seed always gives the same frame.

import { STEP } from './config.js';
import { EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

/** A strong opening: thorn on the first bend, frost above the long straight. */
const OPENING_BUILD = [
  ['thorn', 3, 2], ['thorn', 5, 2], ['frost', 6, 2], ['spark', 8, 2],
  ['thorn', 3, 4], ['frost', 10, 2], ['spark', 10, 4], ['thorn', 5, 4],
];

/** The full keep: the opening, plus the lower field and the lantern's guard. */
const FULL_BUILD = [
  ...OPENING_BUILD,
  ['spark', 2, 4], ['frost', 7, 4], ['thorn', 11, 4], ['spark', 11, 6],
  ['thorn', 2, 6], ['frost', 6, 6], ['thorn', 8, 6],
];

/** Run `steps` fixed steps of the world, starting waves whenever one is idle. */
function playForward(world, steps) {
  for (let i = 0; i < steps; i += 1) {
    const state = world.state;
    if (!state.waveActive && state.wave < 10 && state.hp > 0) world.startWave();
    const events = world.step(STEP, false);
    if (events & (EVENT_OVER | EVENT_WIN)) break;
  }
}

function buildAll(world, placements, gold) {
  world.state.gold = gold;
  for (const [kind, c, r] of placements) world.buildWarden(kind, c, r);
  // Spend what is left on upgrades, cheapest first, until the gold runs out.
  for (let round = 0; round < 3; round += 1) {
    for (const warden of world.state.wardens) {
      if (world.state.gold < 40) break;
      world.upgradeWarden(warden);
    }
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it, the
 * best score to show, and the warden the upgrade scene selects.
 */
export function stageShot(name, world) {
  world.reset();
  const state = world.state;
  if (name !== 'play' && name !== 'upgrade' && name !== 'end') {
    // Title: a lived-in keep behind the title — a few wardens, moths drifting
    // in attract mode, the lantern lit.
    buildAll(world, OPENING_BUILD.slice(0, 4), 400);
    // The HUD should read like a fresh game, not a spent demo save.
    state.gold = 180;
    world.startWave();
    for (let i = 0; i < 14 / STEP; i += 1) world.step(STEP, true);
    return { screen: SCREEN_TITLE, best: 0, selected: null };
  }
  if (name === 'upgrade') {
    buildAll(world, OPENING_BUILD, 900);
    playForward(world, 60 / STEP);
    const selected = world.state.wardens.find((w) => w.kind === 'spark') || world.state.wardens[0];
    return { screen: SCREEN_PLAY, best: state.score, selected };
  }
  if (name === 'end') {
    // Victory: the full keep, played through all ten waves with the real rules.
    buildAll(world, FULL_BUILD, 2400);
    playForward(world, 600 / STEP);
    const won = state.hp > 0 && state.wave >= 10;
    return { screen: won ? SCREEN_WIN : SCREEN_OVER, best: state.score, selected: null };
  }
  // Play: the opening keep, mid-fight in wave 4, moths thick on the trail.
  buildAll(world, OPENING_BUILD, 900);
  playForward(world, 60 / STEP);
  return { screen: SCREEN_PLAY, best: state.score, selected: null };
}

