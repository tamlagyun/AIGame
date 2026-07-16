import type { RemotePlayerState, SkillId } from './NetworkProtocol.ts';
export interface RemotePlayerView {
  setPosition(x: number, y: number): void;
  setRotation(angle: number): void;
  setHealth?(health: number, maxHealth: number): void;
  playSkill?(skillId: SkillId, effectDurationMs?: number): void;
  playWhaleTarget?(effectDurationMs?: number): void;
  playHurt?(skillId: string): void;
  playDeath?(): void;
  playRespawn?(): void;
  destroy(): void;
}
export class RemotePlayerRegistry {
  private readonly views = new Map<string, RemotePlayerView>();
  private readonly actionSequences = new Map<string, number>();
  private readonly pendingWhaleTargets = new Map<string, number>();
  private readonly create: (state: RemotePlayerState) => RemotePlayerView;
  constructor(create: (state: RemotePlayerState) => RemotePlayerView) { this.create = create; }
  upsert(state: RemotePlayerState) {
    const view = this.views.get(state.playerId) ?? this.create(state);
    this.views.set(state.playerId, view);
    view.setPosition(state.x, state.y);
    view.setRotation(state.rotation);
    view.setHealth?.(state.health, state.maxHealth);
    if (state.action && state.actionSequence !== undefined && state.actionSequence > (this.actionSequences.get(state.playerId) ?? 0)) {
      this.playSkill(state.playerId, state.action, state.actionSequence, state.actionTargetId, state.actionRemainingMs);
    }
    const pendingDuration = this.pendingWhaleTargets.get(state.playerId);
    if (pendingDuration !== undefined) {
      view.playWhaleTarget?.(pendingDuration);
      this.pendingWhaleTargets.delete(state.playerId);
    }
    if (state.dead) view.playDeath?.();
  }
  setTransform(playerId: string, x: number, y: number, rotation: number) {
    const view = this.views.get(playerId);
    view?.setPosition(x, y);
    view?.setRotation(rotation);
  }
  setHealth(playerId: string, health: number, maxHealth: number) { this.views.get(playerId)?.setHealth?.(health, maxHealth); }
  playSkill(playerId: string, skillId: SkillId, actionSequence?: number, targetId?: string, effectDurationMs = 3000) {
    if (actionSequence !== undefined && actionSequence <= (this.actionSequences.get(playerId) ?? 0)) return;
    if (actionSequence !== undefined) this.actionSequences.set(playerId, actionSequence);
    this.views.get(playerId)?.playSkill?.(skillId, effectDurationMs);
    if (skillId === 'skill-whale-swallow' && targetId) {
      const target = this.views.get(targetId);
      if (target) target.playWhaleTarget?.(effectDurationMs);
      else this.pendingWhaleTargets.set(targetId, effectDurationMs);
    }
  }
  playWhaleTarget(playerId: string, effectDurationMs = 3000) { this.views.get(playerId)?.playWhaleTarget?.(effectDurationMs); }
  playHurt(playerId: string, skillId: string) { this.views.get(playerId)?.playHurt?.(skillId); }
  playDeath(playerId: string) { this.views.get(playerId)?.playDeath?.(); }
  playRespawn(playerId: string) { this.views.get(playerId)?.playRespawn?.(); }
  remove(playerId: string) { this.views.get(playerId)?.destroy(); this.views.delete(playerId); this.actionSequences.delete(playerId); this.pendingWhaleTargets.delete(playerId); }
  ids(): string[] { return [...this.views.keys()]; }
  clear() { for (const view of this.views.values()) view.destroy(); this.views.clear(); this.actionSequences.clear(); this.pendingWhaleTargets.clear(); }
}
