import type { RemotePlayerState } from './NetworkProtocol.ts';
export interface RemotePlayerView { setPosition(x: number, y: number): void; setRotation(angle: number): void; setHealth?(health: number, maxHealth: number): void; playSkill?(skillId: string): void; playHurt?(skillId: string): void; playDeath?(): void; playRespawn?(): void; destroy(): void; }
export class RemotePlayerRegistry {
  private readonly views = new Map<string, RemotePlayerView>();
  private readonly actionSequences = new Map<string, number>();
  constructor(private readonly create: (state: RemotePlayerState) => RemotePlayerView) {}
  upsert(state: RemotePlayerState) {
    const view = this.views.get(state.playerId) ?? this.create(state);
    this.views.set(state.playerId, view);
    view.setPosition(state.x, state.y);
    view.setRotation(state.rotation);
    view.setHealth?.(state.health, state.maxHealth);
    if (state.action && state.actionSequence !== undefined && state.actionSequence > (this.actionSequences.get(state.playerId) ?? 0)) {
      this.actionSequences.set(state.playerId, state.actionSequence);
      view.playSkill?.(state.action);
    }
    if (state.dead) view.playDeath?.();
  }
  setHealth(playerId: string, health: number, maxHealth: number) { this.views.get(playerId)?.setHealth?.(health, maxHealth); }
  playSkill(playerId: string, skillId: string, actionSequence?: number) {
    if (actionSequence !== undefined && actionSequence <= (this.actionSequences.get(playerId) ?? 0)) return;
    if (actionSequence !== undefined) this.actionSequences.set(playerId, actionSequence);
    this.views.get(playerId)?.playSkill?.(skillId);
  }
  playHurt(playerId: string, skillId: string) { this.views.get(playerId)?.playHurt?.(skillId); }
  playDeath(playerId: string) { this.views.get(playerId)?.playDeath?.(); }
  playRespawn(playerId: string) { this.views.get(playerId)?.playRespawn?.(); }
  remove(playerId: string) { this.views.get(playerId)?.destroy(); this.views.delete(playerId); this.actionSequences.delete(playerId); }
  ids(): string[] { return [...this.views.keys()]; }
  clear() { for (const view of this.views.values()) view.destroy(); this.views.clear(); this.actionSequences.clear(); }
}
