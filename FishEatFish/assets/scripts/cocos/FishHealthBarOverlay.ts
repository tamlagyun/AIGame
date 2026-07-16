import { Color, Label, Node, Sprite, SpriteFrame, UITransform } from 'cc';

/** 鱼儿头顶生命条的独立 HUD 组件。 */
export class FishHealthBarOverlay {
  private readonly node: Node;
  private readonly fill: Sprite;
  private readonly label: Label;

  public constructor(
    parent: Node,
    private readonly fish: Node,
    id: string,
    healthBarFrame: SpriteFrame,
    healthBarFill: SpriteFrame
  ) {
    this.node = new Node(`FishHealth-${id}`);
    this.node.layer = parent.layer;
    const transform = this.node.addComponent(UITransform);
    transform.setContentSize(176, 48);
    transform.setAnchorPoint(0.5, 0.5);
    parent.addChild(this.node);

    const frameNode = new Node('HealthBarFrame');
    frameNode.layer = this.node.layer;
    const frameTransform = frameNode.addComponent(UITransform);
    frameTransform.setContentSize(168, 44);
    frameTransform.setAnchorPoint(0.5, 0.5);
    const frame = frameNode.addComponent(Sprite);
    frame.sizeMode = Sprite.SizeMode.CUSTOM;
    frame.spriteFrame = healthBarFrame;
    this.node.addChild(frameNode);
    frameNode.setPosition(0, 0, 0);

    const fillNode = new Node('HealthBarFill');
    fillNode.layer = this.node.layer;
    const fillTransform = fillNode.addComponent(UITransform);
    fillTransform.setContentSize(144, 22);
    fillTransform.setAnchorPoint(0.5, 0.5);
    this.fill = fillNode.addComponent(Sprite);
    this.fill.sizeMode = Sprite.SizeMode.CUSTOM;
    this.fill.spriteFrame = healthBarFill;
    this.fill.type = Sprite.Type.FILLED;
    this.fill.fillType = Sprite.FillType.HORIZONTAL;
    this.fill.fillStart = 0;
    this.fill.fillRange = 1;
    this.node.addChild(fillNode);
    fillNode.setPosition(0, 0, 0);

    const labelNode = new Node('HealthValueLabel');
    labelNode.layer = this.node.layer;
    const labelTransform = labelNode.addComponent(UITransform);
    labelTransform.setContentSize(168, 32);
    labelTransform.setAnchorPoint(0.5, 0.5);
    this.label = labelNode.addComponent(Label);
    this.label.fontSize = 17;
    this.label.lineHeight = 22;
    this.label.horizontalAlign = Label.HorizontalAlign.CENTER;
    this.label.verticalAlign = Label.VerticalAlign.CENTER;
    this.label.color = new Color(255, 255, 255, 255);
    this.label.outlineColor = new Color(8, 35, 58, 255);
    this.label.outlineWidth = 2;
    this.node.addChild(labelNode);
    labelNode.setPosition(0, 0, 0);
  }

  public setHealth(health: number, maxHealth: number): void {
    const safeMaxHealth = Number.isFinite(maxHealth) && maxHealth > 0 ? maxHealth : 1;
    const safeHealth = Number.isFinite(health) ? Math.min(safeMaxHealth, Math.max(0, health)) : 0;
    this.fill.fillRange = safeHealth / safeMaxHealth;
    this.label.string = `${Math.ceil(safeHealth)}/${Math.ceil(safeMaxHealth)}`;
  }

  public updatePosition(overlayTransform: UITransform): void {
    const world = this.fish.worldPosition.clone();
    world.y += 120;
    const screen = overlayTransform.convertToNodeSpaceAR(world);
    this.node.setPosition(screen.x, screen.y, 0);
    this.node.angle = 0;
  }

  public destroy(): void {
    this.node.destroy();
  }
}
