import { Node, Sprite, SpriteFrame, UITransform } from 'cc';
import type { ArtFacingDirection } from '../core/types.ts';
import { LocalPlayer } from './LocalPlayer.ts';
import { Player } from './Player.ts';

/**
 * 统一管理海域中玩家鱼儿节点的创建、查询和销毁。
 * 网络状态、战斗状态与动画播放仍由上层协调；本类只拥有 Cocos 角色对象生命周期。
 */
export class RoleManager {
  private readonly roles = new Map<string, Player>();

  public constructor(
    private readonly playerLayer: Node,
    private readonly initialFrame: SpriteFrame | undefined,
    private readonly artFacingDirection: ArtFacingDirection
  ) {}

  public createLocalPlayer(id = 'local-player'): LocalPlayer {
    const existing = this.roles.get(id);
    if (existing instanceof LocalPlayer) return existing;
    const role = this.createNode('PlayerFish');
    const player = new LocalPlayer(id, role.node, role.sprite, this.artFacingDirection);
    this.roles.set(id, player);
    return player;
  }

  public createRemotePlayer(id: string): Player {
    const existing = this.roles.get(id);
    if (existing) return existing;
    const role = this.createNode(`RemotePlayer-${id}`);
    const player = new Player(id, role.node, role.sprite, this.artFacingDirection);
    this.roles.set(id, player);
    return player;
  }

  public get(id: string): Player | undefined {
    return this.roles.get(id);
  }

  public remove(id: string): void {
    const role = this.roles.get(id);
    if (!role) return;
    this.roles.delete(id);
    role.node.destroy();
  }

  public clear(): void {
    for (const id of [...this.roles.keys()]) this.remove(id);
  }

  private createNode(nodeName: string): { node: Node; sprite: Sprite } {
    const node = new Node(nodeName);
    node.layer = this.playerLayer.layer;
    const transform = node.addComponent(UITransform);
    transform.setContentSize(196, 196);
    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.spriteFrame = this.initialFrame ?? null;
    this.playerLayer.addChild(node);
    return { node, sprite };
  }
}
