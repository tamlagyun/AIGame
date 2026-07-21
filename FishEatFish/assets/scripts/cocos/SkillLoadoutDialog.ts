import { BlockInputEvents, Color, Graphics, ImageAsset, Label, Node, Sprite, SpriteFrame, Texture2D, UITransform, Widget } from 'cc';
import type { SkillConfig } from '../core/types.ts';

export interface SkillLoadoutDialogOptions {
  parent: Node;
  entryImage: ImageAsset;
  skillImages: Map<string, ImageAsset>;
  getEquippedSkills: () => SkillConfig[];
  getAvailableSkills: () => SkillConfig[];
  onReplace: (slotIndex: number, skillId: string) => boolean;
}

/** Fixed HUD entry and modal used to replace one of the four equipped skill slots. */
export class SkillLoadoutDialog {
  private static readonly PAGE_SIZE = 8;
  private readonly dialogRoot: Node;
  private readonly contentRoot: Node;
  private selectedSlotIndex = 0;
  private pageIndex = 0;

  public constructor(private readonly options: SkillLoadoutDialogOptions) {
    this.createEntry();
    this.dialogRoot = this.createDialog();
    this.contentRoot = this.createContainer(this.dialogRoot.getChildByName('SkillLoadoutPanel') as Node, 'SkillLoadoutContent', 840, 420);
    this.contentRoot.setPosition(0, -34, 0);
    this.dialogRoot.active = false;
  }

  public open(): void {
    this.pageIndex = 0;
    this.refresh();
    this.dialogRoot.active = true;
  }

  public close(): void {
    this.dialogRoot.active = false;
  }

  public refresh(): void {
    for (const child of [...this.contentRoot.children]) child.destroy();
    const equipped = this.options.getEquippedSkills();
    equipped.forEach((skill, slotIndex) => this.createEquippedSlot(skill, slotIndex));
    this.createLabel(this.contentRoot, 'AvailableTitle', '未装备技能', 28, -384, 66, 300, 40, Label.HorizontalAlign.LEFT);

    const available = this.options.getAvailableSkills();
    const pageCount = Math.max(1, Math.ceil(available.length / SkillLoadoutDialog.PAGE_SIZE));
    this.pageIndex = Math.min(this.pageIndex, pageCount - 1);
    const pageSkills = available.slice(this.pageIndex * SkillLoadoutDialog.PAGE_SIZE, (this.pageIndex + 1) * SkillLoadoutDialog.PAGE_SIZE);
    if (pageSkills.length === 0) {
      this.createLabel(this.contentRoot, 'EmptySkillLibraryHint', '当前没有未装备技能；后续加入技能库的技能会自动显示在这里', 22, 0, -62, 760, 50);
    } else {
      pageSkills.forEach((skill, index) => this.createAvailableSkill(skill, index));
    }
    this.createLabel(this.contentRoot, 'PageIndicator', `${this.pageIndex + 1}/${pageCount}`, 20, 0, -190, 120, 36);
    this.createTextButton(this.contentRoot, 'PreviousPageButton', '上一页', -100, -190, () => {
      if (this.pageIndex > 0) { this.pageIndex -= 1; this.refresh(); }
    });
    this.createTextButton(this.contentRoot, 'NextPageButton', '下一页', 100, -190, () => {
      if (this.pageIndex + 1 < pageCount) { this.pageIndex += 1; this.refresh(); }
    });
  }

  private createEntry(): void {
    const root = this.createContainer(this.options.parent, 'SkillLoadoutEntryRoot', 104, 116);
    root.getComponent(UITransform)?.setAnchorPoint(1, 1);
    const widget = root.addComponent(Widget);
    widget.isAlignRight = true;
    widget.isAlignTop = true;
    widget.right = 28;
    widget.top = 24;
    widget.updateAlignment();
    this.createSprite(root, 'SkillLoadoutEntryIcon', this.options.entryImage, 82, 82, -52, -43);
    this.createLabel(root, 'SkillLoadoutEntryLabel', '技能', 20, -52, -101, 104, 28);
    this.bindTouch(root, () => this.open());
  }

  private createDialog(): Node {
    const root = this.createContainer(this.options.parent, 'SkillLoadoutDialog', 1280, 720);
    root.setPosition(0, 0, 0);
    root.addComponent(BlockInputEvents);
    const shade = root.addComponent(Graphics);
    shade.fillColor = new Color(3, 19, 34, 205);
    shade.rect(-640, -360, 1280, 720);
    shade.fill();

    const panel = this.createContainer(root, 'SkillLoadoutPanel', 920, 590);
    const panelGraphics = panel.addComponent(Graphics);
    panelGraphics.fillColor = new Color(15, 73, 111, 252);
    panelGraphics.roundRect(-460, -295, 920, 590, 28);
    panelGraphics.fill();
    this.createLabel(panel, 'SkillLoadoutTitle', '技能配置', 36, 0, 246, 400, 52);
    this.createLabel(panel, 'SkillLoadoutDescription', '先选择 1—4 号槽位，再从未装备技能中选择替换', 22, 0, 206, 760, 38);
    this.createTextButton(panel, 'SkillLoadoutCloseButton', '关闭', 390, 250, () => this.close(), 100, 48);
    return root;
  }

  private createEquippedSlot(skill: SkillConfig, slotIndex: number): void {
    const x = -300 + slotIndex * 200;
    const root = this.createContainer(this.contentRoot, `EquippedSkillSlot${slotIndex + 1}`, 148, 142);
    root.setPosition(x, 132, 0);
    const selection = root.addComponent(Graphics);
    selection.lineWidth = this.selectedSlotIndex === slotIndex ? 6 : 2;
    selection.strokeColor = this.selectedSlotIndex === slotIndex ? new Color(255, 219, 88, 255) : new Color(99, 183, 222, 220);
    selection.roundRect(-72, -68, 144, 136, 18);
    selection.stroke();
    const image = this.options.skillImages.get(skill.id);
    if (image) this.createSprite(root, `EquippedSkillIcon${slotIndex + 1}`, image, 88, 88, 0, 8);
    this.createLabel(root, `EquippedSkillLabel${slotIndex + 1}`, `${slotIndex + 1}号 ${skill.displayName}`, 18, 0, -53, 140, 30);
    this.bindTouch(root, () => { this.selectedSlotIndex = slotIndex; this.refresh(); });
  }

  private createAvailableSkill(skill: SkillConfig, index: number): void {
    const column = index % 4;
    const row = Math.floor(index / 4);
    const root = this.createContainer(this.contentRoot, `AvailableSkill-${skill.id}`, 150, 114);
    root.setPosition(-300 + column * 200, 0 - row * 118, 0);
    const image = this.options.skillImages.get(skill.id);
    if (image) this.createSprite(root, `AvailableSkillIcon-${skill.id}`, image, 78, 78, 0, 14);
    this.createLabel(root, `AvailableSkillLabel-${skill.id}`, skill.displayName, 18, 0, -43, 148, 28);
    this.bindTouch(root, () => {
      if (this.options.onReplace(this.selectedSlotIndex, skill.id)) {
        this.pageIndex = 0;
        this.refresh();
      }
    });
  }

  private createContainer(parent: Node, name: string, width: number, height: number): Node {
    const node = new Node(name);
    node.layer = parent.layer;
    const transform = node.addComponent(UITransform);
    transform.setContentSize(width, height);
    transform.setAnchorPoint(0.5, 0.5);
    parent.addChild(node);
    return node;
  }

  private createSprite(parent: Node, name: string, image: ImageAsset, width: number, height: number, x: number, y: number): Node {
    const node = this.createContainer(parent, name, width, height);
    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.spriteFrame = this.createSpriteFrame(image);
    node.setPosition(x, y, 0);
    return node;
  }

  private createLabel(
    parent: Node,
    name: string,
    text: string,
    fontSize: number,
    x: number,
    y: number,
    width: number,
    height: number,
    horizontalAlign = Label.HorizontalAlign.CENTER
  ): Label {
    const node = this.createContainer(parent, name, width, height);
    const label = node.addComponent(Label);
    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = fontSize + 7;
    label.horizontalAlign = horizontalAlign;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.color = new Color(255, 255, 255, 255);
    label.useSystemFont = true;
    label.cacheMode = Label.CacheMode.NONE;
    label.enableOutline = true;
    label.outlineColor = new Color(4, 18, 34, 255);
    label.outlineWidth = 2;
    node.setPosition(x, y, 0);
    return label;
  }

  private createTextButton(parent: Node, name: string, text: string, x: number, y: number, action: () => void, width = 92, height = 40): Node {
    const node = this.createContainer(parent, name, width, height);
    const graphics = node.addComponent(Graphics);
    graphics.fillColor = new Color(30, 151, 204, 255);
    graphics.roundRect(-width / 2, -height / 2, width, height, 10);
    graphics.fill();
    this.createLabel(node, `${name}Label`, text, 18, 0, 0, width, height);
    node.setPosition(x, y, 0);
    this.bindTouch(node, action);
    return node;
  }

  private bindTouch(node: Node, action: () => void): void {
    node.on(Node.EventType.TOUCH_START, () => node.setScale(0.94, 0.94, 1));
    node.on(Node.EventType.TOUCH_END, () => { node.setScale(1, 1, 1); action(); });
    node.on(Node.EventType.TOUCH_CANCEL, () => node.setScale(1, 1, 1));
  }

  private createSpriteFrame(image: ImageAsset): SpriteFrame {
    const texture = new Texture2D();
    texture.image = image;
    const frame = new SpriteFrame();
    frame.texture = texture;
    return frame;
  }
}
