// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between five screens: title, play, paused,
// game over and victory.
//
// ?seed=N fixes the falling pattern. ?shot=start|play|upgrade|end (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, BOARD, CARD, STEP, WARDEN } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { createWorld, EVENT_HIT, EVENT_OVER, EVENT_WAVE_CLEAR, EVENT_WIN, isTrailCell } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, ACTION_SPEED, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  window.__shotScreen = scene.screen;
  window.__shotScore = world.state.score;
  window.__shotWave = world.state.wave;
  window.__shotHp = world.state.hp;
  const view = {
    screen: scene.screen,
    hover: null,
    selected: scene.selected || null,
    selKind: 'thorn',
    best: scene.best,
    muted: false,
    speed: 1,
    message: scene.screen === SCREEN_WIN
      ? 'Victory — every wave held. The lantern still burns.'
      : scene.screen === SCREEN_OVER
        ? 'The lantern has gone dark.'
        : 'Hold the lantern through 10 waves.',
    upgradeCost: scene.selected ? world.upgradeCost(scene.selected) : null,
  };
  let painted = 0;
  function paint() {
    renderer.draw(world, view);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let selKind = 'thorn';
  let selected = null;
  let speed = 1;
  let message = 'Build wardens on the grass, then start wave 1.';
  let hover = { x: -1, y: -1 };

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(text) {
    status.textContent = text;
  }

  function startGame() {
    world.reset();
    selected = null;
    selKind = 'thorn';
    message = 'Build wardens on the grass, then start wave 1.';
    screen = SCREEN_PLAY;
    announce('Playing. The lantern has 10 health.');
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    if (won) audio.win();
    else audio.lose();
    announce(won
      ? `Victory. Score ${world.state.score}. Best ${best}.`
      : `Game over. Score ${world.state.score}. Best ${best}.`);
  }

  /** Which warden card, if any, the point (x, y) falls on. */
  function cardAt(x, y) {
    const kinds = Object.keys(WARDEN);
    for (let i = 0; i < kinds.length; i += 1) {
      const cardY = CARD.firstY + i * (CARD.h + CARD.gap);
      if (x >= CARD.x && x <= CARD.x + CARD.w && y >= cardY && y <= cardY + CARD.h) return kinds[i];
    }
    return null;
  }

  function waveButtonAt(x, y) {
    return x >= CARD.x && x <= CARD.x + CARD.w && y >= 440 && y <= 492;
  }

  function upgradeButtonAt(x, y) {
    return selected !== null && x >= CARD.x && x <= CARD.x + 180 && y >= 542 && y <= 578;
  }

  function handleClicks() {
    for (const click of input.takeClicks()) {
      audio.unlock();
      if (screen === SCREEN_TITLE) { startGame(); continue; }
      if (screen === SCREEN_OVER || screen === SCREEN_WIN) { startGame(); continue; }
      if (screen !== SCREEN_PLAY) continue;
      const card = cardAt(click.x, click.y);
      if (card) {
        selKind = card;
        selected = null;
        message = `${WARDEN[card].name} chosen — click a grass cell to build it.`;
        continue;
      }
      if (waveButtonAt(click.x, click.y)) {
        if (world.startWave()) { audio.wave(); message = `Wave ${world.state.wave} — hold the lantern!`; }
        continue;
      }
      if (upgradeButtonAt(click.x, click.y)) {
        if (world.upgradeWarden(selected)) { audio.build(); message = `${WARDEN[selected.kind].name} rises to level ${selected.level}.`; }
        else { audio.denied(); message = 'Not enough gold to upgrade.'; }
        continue;
      }
      const c = Math.floor((click.x - BOARD.ox) / BOARD.cell);
      const r = Math.floor((click.y - BOARD.oy) / BOARD.cell);
      if (c >= 0 && c < BOARD.cols && r >= 0 && r < BOARD.rows) {
        const warden = world.state.wardens.find((w) => w.c === c && w.r === r);
        if (warden) { selected = warden; selKind = warden.kind; continue; }
        if (isTrailCell(c, r)) { message = 'Wardens cannot stand on the trail.'; continue; }
        const built = world.buildWarden(selKind, c, r);
        if (built) { audio.build(); selected = built; message = `${WARDEN[selKind].name} built — click it again to upgrade.`; }
        else { audio.denied(); message = world.state.gold < WARDEN[selKind].cost ? 'Not enough gold for that warden.' : 'Nothing can be built there.'; }
      } else {
        selected = null;
      }
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_RESTART) { startGame(); return; }
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      message = muted ? 'Sound off.' : 'Sound on.';
    }
    if (actions & ACTION_SPEED) {
      speed = speed === 1 ? 2 : 1;
      message = speed === 2 ? 'Double speed.' : 'Normal speed.';
    }
    if (actions & ACTION_CONFIRM) {
      if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN) startGame();
      else if (screen === SCREEN_PLAY && !world.state.waveActive) {
        if (world.startWave()) { audio.wave(); message = `Wave ${world.state.wave} — hold the lantern!`; }
      } else if (screen === SCREEN_PAUSED) screen = SCREEN_PLAY;
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; announce('Paused.'); }
      else if (screen === SCREEN_PAUSED) screen = SCREEN_PLAY;
    }
    for (const key of input.takeKeys()) {
      const kinds = Object.keys(WARDEN);
      const index = Number.parseInt(key, 10) - 1;
      if (index >= 0 && index < kinds.length) {
        selKind = kinds[index];
        selected = null;
        message = `${WARDEN[selKind].name} chosen — click a grass cell to build it.`;
      }
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      if (!world.state.waveActive) world.startWave();
      world.step(STEP, true);
      return;
    }
    const events = world.step(STEP, false);
    if (events & EVENT_WIN) endGame(true);
    else if (events & EVENT_OVER) endGame(false);
    else {
      if (events & EVENT_HIT) {
        audio.leak();
        announce(world.state.hp === 1 ? 'A moth reached the lantern. 1 health left.' : `A moth reached the lantern. ${world.state.hp} health left.`);
        message = 'A moth reached the lantern!';
      }
      if (events & EVENT_WAVE_CLEAR) {
        audio.coin();
        message = `Wave ${world.state.wave} cleared! Bonus gold banked.`;
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    handleClicks();
    hover = input.mouse;
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      let guard = 0;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY) && guard < 240) {
        step();
        accumulator -= STEP;
        guard += 1;
        if (speed === 2 && screen === SCREEN_PLAY) step();
      }
      if (guard >= 240) accumulator = 0;
    } else {
      accumulator = 0;
    }
    renderer.draw(world, {
      screen,
      hover,
      selected,
      selKind,
      best,
      muted: audio.muted,
      speed,
      message,
      upgradeCost: selected ? world.upgradeCost(selected) : null,
    });
  }

  // Leaving the tab pauses a running game rather than letting moths march unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Mothlight Keep. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();

