// Everything the player sees: the board, the wardens, the moths, the side panel
// and every screen. It only reads the world's state and the view the main loop
// hands it; it never changes the game.

import {
  BOARD, CARD, FIELD, FONT, LANTERN_CELL, MOTH, PALETTE, PANEL, TOTAL_WAVES, WARDEN,
} from './config.js';
import { createRandom } from './random.js';
import { isTrailCell, waveComposition } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

/** Grass tufts and night flowers, placed once from a fixed seed: always the same. */
const decorRandom = createRandom(20261118);
const DECOR = [];
for (let r = 0; r < BOARD.rows; r += 1) {
  for (let c = 0; c < BOARD.cols; c += 1) {
    if (isTrailCell(c, r)) continue;
    if (decorRandom() < 0.55) {
      DECOR.push({
        x: BOARD.ox + c * BOARD.cell + 10 + decorRandom() * 44,
        y: BOARD.oy + r * BOARD.cell + 10 + decorRandom() * 44,
        kind: decorRandom() < 0.7 ? 'tuft' : 'bloom',
        color: ['#3f6b4f', '#4a7a5c', '#6b5a8a', '#7a6a9a'][Math.floor(decorRandom() * 4)],
      });
    }
  }
}

function cellCentre(c, r) {
  return [BOARD.ox + c * BOARD.cell + BOARD.cell / 2, BOARD.oy + r * BOARD.cell + BOARD.cell / 2];
}

export function createRenderer(canvas) {
  canvas.width = FIELD.width;
  canvas.height = FIELD.height;
  const ctx = canvas.getContext('2d');

  function text(str, x, y, font, color, align) {
    ctx.fillStyle = color;
    ctx.font = font;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(str, x, y);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawHud(state, view) {
    ctx.fillStyle = PALETTE.hud;
    ctx.fillRect(0, 0, FIELD.width, 56);
    text('🕯  MOTHLIGHT KEEP', 16, 36, `bold 22px ${FONT}`, PALETTE.gold);
    text(`Gold ${state.gold}`, 320, 35, `18px ${FONT}`, PALETTE.text);
    text(`Lantern ♥ ${Math.max(0, state.hp)}`, 440, 35, `18px ${FONT}`, state.hp <= 3 ? PALETTE.danger : PALETTE.text);
    text(`Wave ${state.wave}/${TOTAL_WAVES}`, 600, 35, `18px ${FONT}`, PALETTE.text);
    text(`Score ${state.score}`, 740, 35, `18px ${FONT}`, PALETTE.text);
    text(`Best ${view.best}`, 900, 35, `18px ${FONT}`, PALETTE.muted);
    text(state.waveActive ? 'Moths incoming…' : (state.wave >= TOTAL_WAVES ? 'Dawn!' : 'Press SPACE for the next wave'), 1040, 35, `16px ${FONT}`, PALETTE.muted);
  }

  function drawBoard(state, view, trail) {
    for (let r = 0; r < BOARD.rows; r += 1) {
      for (let c = 0; c < BOARD.cols; c += 1) {
        const x = BOARD.ox + c * BOARD.cell;
        const y = BOARD.oy + r * BOARD.cell;
        ctx.fillStyle = isTrailCell(c, r) ? PALETTE.trail : PALETTE.grass;
        ctx.fillRect(x + 1, y + 1, BOARD.cell - 2, BOARD.cell - 2);
      }
    }
    for (const d of DECOR) {
      ctx.fillStyle = d.color;
      if (d.kind === 'tuft') {
        ctx.fillRect(d.x, d.y, 2, 8);
        ctx.fillRect(d.x + 4, d.y - 2, 2, 10);
        ctx.fillRect(d.x + 8, d.y, 2, 8);
      } else {
        ctx.beginPath();
        ctx.arc(d.x, d.y, 3, 0, 7);
        ctx.fill();
      }
    }
    // The trail, with marching chevrons that drift with the game clock.
    ctx.strokeStyle = PALETTE.trailLine;
    ctx.lineWidth = 3;
    ctx.beginPath();
    trail.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    ctx.fillStyle = 'rgba(143, 211, 255, 0.5)';
    for (let i = 0; i < trail.length - 1; i += 24) {
      const [x, y] = trail[(i + Math.floor(state.time * 20)) % (trail.length - 1)];
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, 7);
      ctx.fill();
    }
  }

  function drawLantern(state) {
    const [x, y] = cellCentre(LANTERN_CELL[0], LANTERN_CELL[1]);
    const flicker = 26 + Math.sin(state.time * 6) * 3;
    const glow = ctx.createRadialGradient(x, y, 4, x, y, 90);
    glow.addColorStop(0, 'rgba(255, 209, 102, 0.5)');
    glow.addColorStop(1, 'rgba(255, 209, 102, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, 90, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#3a2a10';
    ctx.fillRect(x - 16, y - 6, 32, 26);
    ctx.fillStyle = PALETTE.lantern;
    ctx.beginPath();
    ctx.ellipse(x, y - 12, 9, flicker / 2, 0, 0, 7);
    ctx.fill();
    text('🕯', x, y + 16, `bold 20px ${FONT}`, '#7a4a00', 'center');
  }

  function drawWarden(warden, ghost) {
    const def = WARDEN[warden.kind];
    ctx.globalAlpha = ghost ? 0.55 : 1;
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.arc(warden.x, warden.y, 20, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#0d1020';
    ctx.beginPath();
    ctx.arc(warden.x, warden.y, 14, 0, 7);
    ctx.fill();
    text(def.glyph, warden.x, warden.y + 7, `16px ${FONT}`, def.color, 'center');
    for (let i = 0; i < warden.level; i += 1) {
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath();
      ctx.arc(warden.x - 10 + i * 10, warden.y + 24, 3, 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawMoth(moth) {
    const def = MOTH[moth.kind];
    const flap = Math.sin(moth.wing) * 0.7;
    ctx.save();
    ctx.translate(moth.x, moth.y);
    ctx.fillStyle = def.color;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.ellipse(-6, -flap * 6, 8, 5, -0.5 - flap * 0.3, 0, 7);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(6, -flap * 6, 8, 5, 0.5 + flap * 0.3, 0, 7);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.ellipse(0, 0, def.radius, def.radius * 0.7, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#1b2340';
    ctx.beginPath();
    ctx.arc(2, -2, 2, 0, 7);
    ctx.fill();
    ctx.restore();
    if (moth.hp < moth.maxhp) {
      ctx.fillStyle = '#111';
      ctx.fillRect(moth.x - 12, moth.y - def.radius - 10, 24, 4);
      ctx.fillStyle = PALETTE.danger;
      ctx.fillRect(moth.x - 12, moth.y - def.radius - 10, 24 * Math.max(0, moth.hp / moth.maxhp), 4);
    }
    if (moth.kind === 'queen') {
      text('♛', moth.x, moth.y - def.radius - 14, `bold 16px ${FONT}`, PALETTE.lantern, 'center');
    }
  }

  function drawPanel(state, view) {
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(PANEL.x - 16, PANEL.y - 16, PANEL.w + 32, PANEL.h + 32);
    text('WARDENS', PANEL.x, PANEL.y + 4, `bold 15px ${FONT}`, PALETTE.muted);
    text('click a card, then a grass cell', PANEL.x, PANEL.y + 24, `13px ${FONT}`, PALETTE.muted);
    Object.keys(WARDEN).forEach((kind, i) => {
      const def = WARDEN[kind];
      const y = CARD.firstY + i * (CARD.h + CARD.gap);
      const selected = view.selKind === kind;
      ctx.fillStyle = selected ? PALETTE.cardSel : PALETTE.card;
      roundRect(CARD.x, y, CARD.w, CARD.h, 8);
      ctx.fill();
      if (selected) {
        ctx.strokeStyle = def.color;
        ctx.lineWidth = 2;
        roundRect(CARD.x, y, CARD.w, CARD.h, 8);
        ctx.stroke();
      }
      text(def.glyph, CARD.x + 16, y + 42, `30px ${FONT}`, def.color, 'center');
      text(`${i + 1}  ${def.name}  —  ${def.cost}g`, CARD.x + 40, y + 28, `bold 17px ${FONT}`, PALETTE.text);
      text(def.blurb, CARD.x + 40, y + 50, `14px ${FONT}`, PALETTE.muted);
      text(`DMG ${def.damage} · ${def.rate.toFixed(1)}/s · RNG ${def.range}`, CARD.x + 40, y + 72, `13px ${FONT}`, PALETTE.muted);
      if (state.gold < def.cost) text('not enough gold', CARD.x + 40, y + 88, `13px ${FONT}`, PALETTE.danger);
    });

    // The next-wave button, with a preview of what it sends.
    const waveY = 440;
    const nextWave = state.wave + 1;
    const canStart = !state.waveActive && state.wave < TOTAL_WAVES;
    ctx.fillStyle = canStart ? '#2f6b3a' : '#2a3040';
    roundRect(CARD.x, waveY, CARD.w, 52, 8);
    ctx.fill();
    if (canStart) {
      const kinds = waveComposition(nextWave);
      const counts = {};
      kinds.forEach((k) => { counts[k] = (counts[k] || 0) + 1; });
      const preview = Object.keys(counts).map((k) => `${counts[k]} ${k}`).join(' · ');
      text(`▶  START WAVE ${nextWave}`, CARD.x + 16, waveY + 22, `bold 17px ${FONT}`, '#ffffff');
      text(preview, CARD.x + 16, waveY + 42, `13px ${FONT}`, '#cfe8d4');
    } else if (state.waveActive) {
      text('Wave in progress…', CARD.x + 16, waveY + 30, `bold 16px ${FONT}`, PALETTE.muted);
    } else {
      text('All waves faced — dawn!', CARD.x + 16, waveY + 30, `bold 16px ${FONT}`, PALETTE.gold);
    }

    // The selected warden: its stats and its upgrade.
    const selY = 508;
    if (view.selected) {
      const w = view.selected;
      const def = WARDEN[w.kind];
      const cost = view.upgradeCost;
      text(`${def.glyph} ${def.name} — level ${w.level}`, CARD.x, selY, `bold 16px ${FONT}`, PALETTE.text);
      text(`DMG ${w.damage} · ${w.rate.toFixed(1)}/s · RNG ${Math.round(w.range)} · ${w.kills} kills`, CARD.x, selY + 22, `14px ${FONT}`, PALETTE.muted);
      if (cost !== null) {
        ctx.fillStyle = state.gold >= cost ? '#6b4a00' : '#2a3040';
        roundRect(CARD.x, selY + 34, 180, 36, 8);
        ctx.fill();
        text(`⬆ Upgrade — ${cost}g`, CARD.x + 12, selY + 58, `bold 15px ${FONT}`, state.gold >= cost ? PALETTE.gold : PALETTE.muted);
      } else {
        text('Max level — a true warden.', CARD.x, selY + 58, `15px ${FONT}`, PALETTE.gold);
      }
    } else {
      text('Click one of your wardens', CARD.x, selY, `15px ${FONT}`, PALETTE.muted);
      text('to see it here and upgrade it.', CARD.x, selY + 22, `15px ${FONT}`, PALETTE.muted);
    }

    // Speed and sound, bottom of the panel.
    text(`Speed ${view.speed}x  [F]`, CARD.x, 640, `14px ${FONT}`, PALETTE.muted);
    text(view.muted ? 'Sound off  [M]' : 'Sound on  [M]', CARD.x + 180, 640, `14px ${FONT}`, PALETTE.muted);
  }

  function drawFooter(view) {
    ctx.fillStyle = PALETTE.hud;
    ctx.fillRect(0, 600, FIELD.width, 120);
    text(view.message, 64, 628, `16px ${FONT}`, PALETTE.gold);
    text('1/2/3 choose warden · Click grass to build · Click a warden to upgrade · SPACE next wave · P pause · R restart', 64, 660, `15px ${FONT}`, PALETTE.muted);
    text('Hold the lantern through 10 waves. The moth queen comes with the last one.', 64, 688, `15px ${FONT}`, PALETTE.muted);
  }

  function drawOverlay(title, line1, line2, line3, accent) {
    ctx.fillStyle = 'rgba(8, 10, 24, 0.78)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    text(title, FIELD.width / 2, 250, `bold 46px ${FONT}`, accent || PALETTE.gold, 'center');
    text(line1, FIELD.width / 2, 300, `20px ${FONT}`, PALETTE.text, 'center');
    text(line2, FIELD.width / 2, 332, `20px ${FONT}`, PALETTE.text, 'center');
    text(line3, FIELD.width / 2, 384, `18px ${FONT}`, '#8fd3ff', 'center');
    ctx.textAlign = 'left';
  }

  // `world` is the object createWorld returns: its `.state` holds the numbers,
  // its `.trail` the waypoints the moths walk.
  function draw(world, view) {
    const state = world.state;
    ctx.save();
    if (state.shake > 0) {
      ctx.translate((Math.sin(state.time * 47) * state.shake * 5), (Math.cos(state.time * 39) * state.shake * 5));
    }
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(-20, -20, FIELD.width + 40, FIELD.height + 40);
    drawHud(state, view);
    drawBoard(state, view, world.trail);
    drawLantern(state);

    // The build ghost: where the chosen warden would stand, and its reach.
    if (view.screen === SCREEN_PLAY && view.hover && view.selKind) {
      const c = Math.floor((view.hover.x - BOARD.ox) / BOARD.cell);
      const r = Math.floor((view.hover.y - BOARD.oy) / BOARD.cell);
      if (c >= 0 && c < BOARD.cols && r >= 0 && r < BOARD.rows && !isTrailCell(c, r)
        && !state.wardens.some((w) => w.c === c && w.r === r)) {
        const [x, y] = cellCentre(c, r);
        const def = WARDEN[view.selKind];
        ctx.strokeStyle = def.color;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(x, y, def.range, 0, 7);
        ctx.stroke();
        ctx.globalAlpha = 1;
        drawWarden({ x, y, kind: view.selKind, level: 1 }, true);
      }
    }
    if (view.selected) {
      ctx.strokeStyle = WARDEN[view.selected.kind].color;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(view.selected.x, view.selected.y, view.selected.range, 0, 7);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    for (const warden of state.wardens) drawWarden(warden, false);
    for (const moth of state.moths) drawMoth(moth);
    for (const shot of state.shots) {
      ctx.strokeStyle = shot.kind === 'frost' ? '#8fd3ff' : shot.kind === 'spark' ? '#ffd166' : '#b8f5c0';
      ctx.lineWidth = shot.kind === 'spark' ? 4 : 2;
      ctx.beginPath();
      ctx.moveTo(shot.x, shot.y);
      ctx.lineTo(shot.tx, shot.ty);
      ctx.stroke();
    }
    for (const part of state.parts) {
      ctx.fillStyle = part.color;
      ctx.fillRect(part.x - part.size / 2, part.y - part.size / 2, part.size, part.size);
    }
    for (const f of state.floats) {
      ctx.globalAlpha = Math.max(0, f.life);
      text(f.text, f.x, f.y, `bold 15px ${FONT}`, f.color, 'center');
      ctx.globalAlpha = 1;
    }
    if (state.flash > 0) {
      ctx.fillStyle = `rgba(255, 60, 60, ${state.flash * 0.25})`;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }
    drawFooter(view);
    drawPanel(state, view);
    ctx.restore();

    if (view.screen === SCREEN_TITLE) {
      drawOverlay(
        'MOTHLIGHT KEEP',
        'The last lantern burns, and the moths hunger for its light.',
        'Build wardens on the grass — thorn, frost, spark — and hold the trail through 10 waves.',
        'Click or press SPACE to begin  ·  1/2/3 choose a warden  ·  the moth queen comes last',
      );
    } else if (view.screen === SCREEN_PAUSED) {
      drawOverlay('PAUSED', 'The moths wait in the dark.', '', 'Press P or SPACE to keep playing.');
    } else if (view.screen === SCREEN_OVER) {
      drawOverlay(
        'THE LANTERN DIES',
        `The valley goes dark on wave ${state.wave}.  Score ${state.score} — best ${view.best}.`,
        `${state.kills} moths turned to dust · ${state.leaked} reached the lantern · ${state.earned} gold earned.`,
        'Press R to light the lantern again.',
        PALETTE.danger,
      );
    } else if (view.screen === SCREEN_WIN) {
      drawOverlay(
        '☀  DAWN BREAKS',
        `Every wave held. The lantern still burns.  Score ${state.score} — best ${view.best}.`,
        `${state.kills} moths turned to dust · ${state.leaked} reached the lantern · ${state.earned} gold earned.`,
        'Press R to play again.',
      );
    }
  }

  return { draw };
}
