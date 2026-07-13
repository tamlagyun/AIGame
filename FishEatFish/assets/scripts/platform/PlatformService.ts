import type { SaveData } from '../core/types.ts';

export type PlatformTarget = 'editor' | 'web' | 'wechat' | 'douyin' | 'android' | 'ios' | 'harmonyos';

export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PlatformResult {
  ok: boolean;
  reason?: string;
}

export interface PlatformService {
  readonly target: PlatformTarget;
  init(): Promise<void>;
  login(): Promise<{ ok: boolean; userId?: string; reason?: string }>;
  save(data: SaveData): Promise<PlatformResult>;
  load(): Promise<SaveData | null>;
  share(payload: { title: string; imageUrl?: string }): Promise<PlatformResult>;
  showRewardAd(placementId: string): Promise<{ ok: boolean; rewarded: boolean; reason?: string }>;
  vibrate(durationMs: number): void;
  getSafeArea(): SafeAreaInsets;
  onPause(callback: () => void): () => void;
  onResume(callback: () => void): () => void;
}

