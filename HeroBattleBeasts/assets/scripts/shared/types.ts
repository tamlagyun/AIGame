export type PlatformTarget = 'editor' | 'native' | 'wechat' | 'douyin' | 'harmony';

export type SafeAreaInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type InputCommand = {
  moveX: -1 | 0 | 1;
  aimX?: -1 | 0 | 1;
  aimY?: -1 | 0 | 1;
  jumpPressed: boolean;
  shootPressed: boolean;
  pausePressed: boolean;
  restartPressed?: boolean;
};

export type Vector2 = {
  x: number;
  y: number;
};
