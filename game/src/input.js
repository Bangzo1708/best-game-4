// Mouse and keyboard, read once a frame: clicks queue up, keys become actions,
// and the mouse position is always there for the build ghost and hover states.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_SPEED = 4;
export const ACTION_MUTE = 8;
export const ACTION_RESTART = 16;

export function createInput(canvas) {
  const keys = new Set();
  const clicks = [];
  const mouse = { x: -1, y: -1 };
  let actions = 0;

  function toGameCoords(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  canvas.addEventListener('click', (event) => {
    clicks.push(toGameCoords(event));
  });
  canvas.addEventListener('mousemove', (event) => {
    const point = toGameCoords(event);
    mouse.x = point.x;
    mouse.y = point.y;
  });
  canvas.addEventListener('mouseleave', () => {
    mouse.x = -1;
    mouse.y = -1;
  });

  document.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (key === ' ' || key === 'enter') { actions |= ACTION_CONFIRM; event.preventDefault(); }
    else if (key === 'p' || key === 'escape') actions |= ACTION_PAUSE;
    else if (key === 'f') actions |= ACTION_SPEED;
    else if (key === 'm') actions |= ACTION_MUTE;
    else if (key === 'r') actions |= ACTION_RESTART;
    else keys.add(key);
  });
  document.addEventListener('keyup', (event) => {
    keys.delete(event.key.toLowerCase());
  });

  return {
    /** The actions pressed since the last call, then cleared. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Number-key presses (1, 2, 3…) since the last call, then cleared. */
    takeKeys() {
      const taken = [...keys];
      keys.clear();
      return taken;
    },
    /** Clicks since the last call, then cleared. */
    takeClicks() {
      return clicks.splice(0, clicks.length);
    },
    mouse,
  };
}
