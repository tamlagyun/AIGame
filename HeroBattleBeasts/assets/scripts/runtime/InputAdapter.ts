import type { InputCommand } from '../shared/types';

export type KeyboardCodeSet = {
  has(code: string): boolean;
};

export const KEY_BINDINGS = {
  LEFT: ['KeyA', 'ArrowLeft'],
  RIGHT: ['KeyD', 'ArrowRight'],
  UP: ['KeyW', 'ArrowUp'],
  DOWN: ['KeyS', 'ArrowDown'],
  JUMP: ['Space'],
  SHOOT: ['KeyJ', 'KeyZ'],
  PAUSE: ['Escape'],
  RESTART: ['KeyR']
};

export function normalizeKeyboardInput(activeCodes: KeyboardCodeSet): InputCommand {
  const left = KEY_BINDINGS.LEFT.some(code => activeCodes.has(code));
  const right = KEY_BINDINGS.RIGHT.some(code => activeCodes.has(code));
  const up = KEY_BINDINGS.UP.some(code => activeCodes.has(code));
  const down = KEY_BINDINGS.DOWN.some(code => activeCodes.has(code));

  return {
    moveX: left === right ? 0 : right ? 1 : -1,
    aimX: left === right ? 0 : right ? 1 : -1,
    aimY: up === down ? 0 : up ? -1 : 1,
    jumpPressed: up || KEY_BINDINGS.JUMP.some(code => activeCodes.has(code)),
    shootPressed: KEY_BINDINGS.SHOOT.some(code => activeCodes.has(code)),
    pausePressed: KEY_BINDINGS.PAUSE.some(code => activeCodes.has(code)),
    restartPressed: KEY_BINDINGS.RESTART.some(code => activeCodes.has(code))
  };
}

export function cocosKeyCodeToWebCode(keyCode: number): string | null {
  const mapping: Record<number, string> = {
    65: 'KeyA',
    68: 'KeyD',
    87: 'KeyW',
    83: 'KeyS',
    74: 'KeyJ',
    90: 'KeyZ',
    82: 'KeyR',
    32: 'Space',
    27: 'Escape',
    37: 'ArrowLeft',
    38: 'ArrowUp',
    39: 'ArrowRight',
    40: 'ArrowDown'
  };
  return mapping[keyCode] ?? null;
}
