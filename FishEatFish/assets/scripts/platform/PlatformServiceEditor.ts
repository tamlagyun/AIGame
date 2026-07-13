import type { SaveData } from '../core/types.ts';
import type { PlatformResult, PlatformService, SafeAreaInsets } from './PlatformService.ts';

export class PlatformServiceEditor implements PlatformService {
  readonly target = 'editor' as const;
  private memorySave: SaveData | null = null;
  private readonly pauseCallbacks = new Set<() => void>();
  private readonly resumeCallbacks = new Set<() => void>();

  async init(): Promise<void> {}

  async login() {
    return { ok: true, userId: 'editor-local-user' };
  }

  async save(data: SaveData): Promise<PlatformResult> {
    this.memorySave = structuredClone(data);
    return { ok: true };
  }

  async load(): Promise<SaveData | null> {
    return this.memorySave ? structuredClone(this.memorySave) : null;
  }

  async share(): Promise<PlatformResult> {
    return { ok: false, reason: 'Share is unavailable in the editor adapter.' };
  }

  async showRewardAd() {
    return { ok: false, rewarded: false, reason: 'Reward ads are unavailable in the editor adapter.' };
  }

  vibrate(_durationMs: number): void {}

  getSafeArea(): SafeAreaInsets {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }

  onPause(callback: () => void): () => void {
    this.pauseCallbacks.add(callback);
    return () => this.pauseCallbacks.delete(callback);
  }

  onResume(callback: () => void): () => void {
    this.resumeCallbacks.add(callback);
    return () => this.resumeCallbacks.delete(callback);
  }
}

