import { Color, ImageAsset, Label, Node, Sprite, SpriteFrame, Texture2D, UITransform, Vec2, Widget } from 'cc';
import type { SkillConfig, SkillLoadoutConfig } from '../core/types.ts';

interface CooldownMask { skill: SkillConfig; sprite: Sprite; }
interface CooldownState { duration: number; remaining: number; }

/**
 * Config-driven right-bottom skill UI. It owns only the action-control subtree;
 * gameplay is supplied through the activation callback.
 */
export class SkillActionPanel {
  private readonly cooldownStates = new Map<string, CooldownState>();
  private readonly cooldownMasks: CooldownMask[] = [];
  private readonly skillsByNetworkId = new Map<string, SkillConfig>();
  private readonly root: Node;
  private skills: SkillConfig[];

  public constructor(
    private readonly parent: Node,
    private readonly loadout: SkillLoadoutConfig,
    skills: SkillConfig[],
    private readonly images: Map<string, ImageAsset>,
    private readonly onActivate: (skill: SkillConfig) => boolean
  ) {
    this.skills = [...skills];
    const { layout } = this.loadout;
    this.root = this.createContainer(this.parent, layout.rootName, layout.width, layout.height);
    this.alignToBottomRight(this.root, layout.right, layout.bottom);
    this.validateAndRegisterSkills();
    this.renderButtons();
  }

  public replaceArcSkill(slotIndex: number, skill: SkillConfig): void {
    const index = this.skills.findIndex((current) => current.ui.slot === 'arc' && current.ui.slotIndex === slotIndex);
    if (index < 0) throw new Error(`skill arc slot does not exist: ${slotIndex}`);
    this.skills[index] = {
      ...skill,
      ui: { ...skill.ui, slot: 'arc', slotIndex, nodeName: `SkillSlot${slotIndex + 1}Button` }
    };
    this.validateAndRegisterSkills();
    this.renderButtons();
  }

  public getEquippedArcSkills(): SkillConfig[] {
    return this.skills
      .filter((skill) => skill.ui.slot === 'arc')
      .sort((left, right) => (left.ui.slotIndex ?? 0) - (right.ui.slotIndex ?? 0));
  }

  private validateAndRegisterSkills(): void {
    const nodeNames = new Set<string>();
    const slots = new Set<string>();
    let primaryCount = 0;
    this.skillsByNetworkId.clear();
    for (const skill of this.skills) {
      if (nodeNames.has(skill.ui.nodeName)) throw new Error(`duplicate skill UI node: ${skill.ui.nodeName}`);
      nodeNames.add(skill.ui.nodeName);
      const slot = skill.ui.slot === 'primary' ? 'primary' : `arc-${skill.ui.slotIndex}`;
      if (slots.has(slot)) throw new Error(`duplicate skill UI slot: ${slot}`);
      slots.add(slot);
      if (skill.ui.slot === 'primary') primaryCount += 1;
      if (!this.skillsByNetworkId.has(skill.networkSkillId)) this.skillsByNetworkId.set(skill.networkSkillId, skill);
      const current = this.cooldownStates.get(skill.ui.cooldownGroup);
      if (current && current.duration !== skill.cooldownSeconds) throw new Error(`cooldown group duration mismatch: ${skill.ui.cooldownGroup}`);
      if (!current) this.cooldownStates.set(skill.ui.cooldownGroup, { duration: skill.cooldownSeconds, remaining: 0 });
    }
    if (primaryCount !== 1) throw new Error('skill loadout must contain exactly one primary skill');
  }

  public update(deltaTime: number): void {
    for (const state of this.cooldownStates.values()) state.remaining = Math.max(0, state.remaining - deltaTime);
    this.updateCooldownMasks();
  }

  public cancelCooldownForNetworkSkill(networkSkillId: string): void {
    const skill = this.skillsByNetworkId.get(networkSkillId);
    if (!skill) return;
    const state = this.cooldownStates.get(skill.ui.cooldownGroup);
    if (state) state.remaining = 0;
    this.updateCooldownMasks();
  }

  private renderButtons(): void {
    for (const child of [...this.root.children]) child.destroy();
    this.cooldownMasks.length = 0;
    const { layout } = this.loadout;
    for (const skill of this.skills) {
      const position = this.resolvePosition(skill);
      const size = skill.ui.slot === 'primary' ? layout.primaryButtonSize : layout.arcButtonSize;
      const image = this.images.get(skill.id);
      if (!image) throw new Error(`missing UI image for skill: ${skill.id}`);
      const button = this.createSprite(this.root, skill.ui.nodeName, image, size, size, position.x, position.y);
      this.createCooldownMask(button, skill);
      this.createButtonLabel(button, skill.displayName);
      this.bindButton(button, skill);
    }
  }

  private resolvePosition(skill: SkillConfig): Vec2 {
    const { layout } = this.loadout;
    if (skill.ui.slot === 'primary') return new Vec2(layout.primaryCenter.x, layout.primaryCenter.y);
    const index = skill.ui.slotIndex ?? -1;
    const angle = layout.arcAngles[index];
    if (angle === undefined) throw new Error(`arc slot ${index} is not configured for ${skill.id}`);
    const radians = angle * Math.PI / 180;
    return new Vec2(layout.primaryCenter.x + Math.cos(radians) * layout.arcRadius, layout.primaryCenter.y + Math.sin(radians) * layout.arcRadius);
  }

  private createCooldownMask(parent: Node, skill: SkillConfig): void {
    const parentTransform = parent.getComponent(UITransform);
    const parentSprite = parent.getComponent(Sprite);
    if (!parentTransform || !parentSprite?.spriteFrame) return;
    const node = new Node(`${parent.name}CooldownMask`);
    node.layer = parent.layer;
    const transform = node.addComponent(UITransform);
    transform.setContentSize(parentTransform.width, parentTransform.height);
    transform.setAnchorPoint(0.5, 0.5);
    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.spriteFrame = parentSprite.spriteFrame;
    sprite.type = Sprite.Type.FILLED;
    sprite.fillType = Sprite.FillType.RADIAL;
    sprite.fillCenter = new Vec2(0.5, 0.5);
    sprite.fillStart = this.loadout.layout.cooldownStart;
    sprite.fillRange = 0;
    sprite.color = new Color(0, 0, 0, 160);
    parent.addChild(node);
    node.setPosition(0, 0, 0);
    node.active = false;
    this.cooldownMasks.push({ skill, sprite });
  }

  private updateCooldownMasks(): void {
    for (const { skill, sprite } of this.cooldownMasks) {
      const state = this.cooldownStates.get(skill.ui.cooldownGroup);
      if (!state) continue;
      const remainingRatio = state.duration <= 0 ? 0 : Math.min(1, Math.max(0, state.remaining / state.duration));
      const elapsedRatio = 1 - remainingRatio;
      const active = remainingRatio > 0;
      sprite.node.active = active;
      sprite.fillStart = active ? (this.loadout.layout.cooldownStart - elapsedRatio + 1) % 1 : this.loadout.layout.cooldownStart;
      sprite.fillRange = active ? -remainingRatio : 0;
    }
  }

  private bindButton(button: Node, skill: SkillConfig): void {
    button.on(Node.EventType.TOUCH_START, () => button.setScale(0.92, 0.92, 1));
    button.on(Node.EventType.TOUCH_END, () => {
      button.setScale(1, 1, 1);
      const cooldown = this.cooldownStates.get(skill.ui.cooldownGroup);
      if (!cooldown || cooldown.remaining > 0 || !this.onActivate(skill)) return;
      cooldown.remaining = cooldown.duration;
      this.updateCooldownMasks();
    });
    button.on(Node.EventType.TOUCH_CANCEL, () => button.setScale(1, 1, 1));
  }

  private createContainer(parent: Node, name: string, width: number, height: number): Node {
    const node = new Node(name);
    node.layer = parent.layer;
    const transform = node.addComponent(UITransform);
    transform.setContentSize(width, height);
    transform.setAnchorPoint(0, 0);
    parent.addChild(node);
    node.setPosition(0, 0, 0);
    return node;
  }

  private alignToBottomRight(node: Node, right: number, bottom: number): void {
    const widget = node.addComponent(Widget);
    widget.isAlignRight = true;
    widget.isAlignBottom = true;
    widget.right = right;
    widget.bottom = bottom;
    widget.updateAlignment();
  }

  private createSprite(parent: Node, name: string, image: ImageAsset, width: number, height: number, x: number, y: number): Node {
    const node = new Node(name);
    node.layer = parent.layer;
    const transform = node.addComponent(UITransform);
    transform.setContentSize(width, height);
    transform.setAnchorPoint(0.5, 0.5);
    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.spriteFrame = this.createSpriteFrame(image);
    parent.addChild(node);
    node.setPosition(x, y, 0);
    return node;
  }

  private createButtonLabel(parent: Node, text: string): void {
    const parentTransform = parent.getComponent(UITransform);
    if (!parentTransform) return;
    const node = new Node(`${parent.name}Label`);
    node.layer = parent.layer;
    const transform = node.addComponent(UITransform);
    transform.setContentSize(Math.max(72, parentTransform.width - 12), 28);
    transform.setAnchorPoint(0.5, 0);
    const label = node.addComponent(Label);
    label.string = text;
    label.fontSize = 17;
    label.lineHeight = 22;
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.BOTTOM;
    label.color = new Color(255, 255, 255, 255);
    // 技能图标下侧文字必须在不同海底背景和冷却蒙板上保持可读。
    label.useSystemFont = true;
    label.cacheMode = Label.CacheMode.NONE;
    label.enableOutline = true;
    label.outlineColor = new Color(4, 18, 34, 255);
    label.outlineWidth = 2;
    parent.addChild(node);
    node.setPosition(0, -parentTransform.height / 2, 0);
  }

  private createSpriteFrame(image: ImageAsset): SpriteFrame {
    const texture = new Texture2D();
    texture.image = image;
    const frame = new SpriteFrame();
    frame.texture = texture;
    return frame;
  }
}
