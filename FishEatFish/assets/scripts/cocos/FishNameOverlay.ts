import { Color, Label, Node, UITransform } from 'cc';

/** 鱼儿头顶用户名的独立 HUD 组件。 */
export class FishNameOverlay {
  private readonly node: Node;
  private readonly label: Label;

  public constructor(parent: Node, private readonly fish: Node, id: string, name: string) {
    this.node = new Node(`FishName-${id}`);
    this.node.layer = parent.layer;
    const transform = this.node.addComponent(UITransform);
    transform.setContentSize(180, 30);
    transform.setAnchorPoint(0.5, 0.5);
    this.label = this.node.addComponent(Label);
    this.label.fontSize = 20;
    this.label.lineHeight = 24;
    this.label.horizontalAlign = Label.HorizontalAlign.CENTER;
    this.label.color = new Color(255, 255, 255, 255);
    parent.addChild(this.node);
    this.setName(name);
  }

  public setName(name: string): void {
    this.label.string = name;
  }

  public updatePosition(overlayTransform: UITransform): void {
    const world = this.fish.worldPosition.clone();
    world.y += 160;
    const screen = overlayTransform.convertToNodeSpaceAR(world);
    this.node.setPosition(screen.x, screen.y, 0);
    this.node.angle = 0;
  }

  public destroy(): void {
    this.node.destroy();
  }
}
