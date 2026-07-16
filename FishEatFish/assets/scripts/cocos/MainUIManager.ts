import { Color, EventTouch, ImageAsset, Label, Node, Sprite, SpriteFrame, Texture2D, UITransform, Widget } from 'cc';
import type { SkillConfig, SkillLoadoutConfig } from '../core/types.ts';
import { SkillActionPanel } from './SkillActionPanel.ts';

export interface MainUIManagerOptions {
  hudRoot: Node;
  joystickBase: ImageAsset;
  joystickKnob: ImageAsset;
  skillLoadout: SkillLoadoutConfig;
  skills: SkillConfig[];
  skillImages: Map<string, ImageAsset>;
  onSkillActivate: (skill: SkillConfig) => boolean;
  onJoystickStart: (event: EventTouch) => void;
  onJoystickMove: (event: EventTouch) => void;
  onJoystickEnd: (event: EventTouch) => void;
}

/** Owns the fixed-screen HUD subtree created while the ocean world starts. */
export class MainUIManager {
  public readonly inputLayer: Node;
  public readonly fishHealthOverlay: Node;
  public readonly actionHint: Label;
  public readonly healthLabel: Label;
  public readonly joystickRoot: Node;
  public readonly joystickKnob: Node;
  public readonly skillPanel: SkillActionPanel;

  public constructor(options: MainUIManagerOptions) {
    this.inputLayer = this.resolveInputLayer(options.hudRoot);
    this.fishHealthOverlay = this.createContainer(this.inputLayer, 'FishHealthOverlay', 1280, 720, 0.5, 0.5);
    this.actionHint = this.createControlHint(options.hudRoot);
    this.healthLabel = this.createHealthLabel(options.hudRoot);
    this.joystickRoot = this.createSprite(this.inputLayer, 'JoystickControlRoot', options.joystickBase, 220, 220, 0, 0);
    this.joystickRoot.getComponent(UITransform)?.setAnchorPoint(0, 0);
    this.alignToBottomLeft(this.joystickRoot, 60, 35);
    this.joystickKnob = this.createSprite(this.joystickRoot, 'JoystickKnob', options.joystickKnob, 120, 120, 110, 110);
    this.joystickRoot.on(Node.EventType.TOUCH_START, options.onJoystickStart);
    this.joystickRoot.on(Node.EventType.TOUCH_MOVE, options.onJoystickMove);
    this.joystickRoot.on(Node.EventType.TOUCH_END, options.onJoystickEnd);
    this.joystickRoot.on(Node.EventType.TOUCH_CANCEL, options.onJoystickEnd);
    this.skillPanel = new SkillActionPanel(this.inputLayer, options.skillLoadout, options.skills, options.skillImages, options.onSkillActivate);
  }

  private resolveInputLayer(hudRoot: Node): Node {
    const inputLayer = hudRoot.getChildByName('SafeAreaRoot')?.getChildByName('InputLayer');
    if (!inputLayer) throw new Error('HudRoot 缺少 SafeAreaRoot/InputLayer');
    const transform = inputLayer.getComponent(UITransform) ?? inputLayer.addComponent(UITransform);
    transform.setAnchorPoint(0.5, 0.5);
    transform.setContentSize(1280, 720);
    inputLayer.setPosition(0, 0, 0);
    return inputLayer;
  }

  private createControlHint(parent: Node): Label {
    const node = new Node('ControlHint');
    node.layer = parent.layer;
    const transform = node.addComponent(UITransform);
    transform.setContentSize(720, 48);
    transform.setAnchorPoint(0, 1);
    const label = node.addComponent(Label);
    label.string = 'WASD / 方向键，或在屏幕左侧拖动游泳';
    label.fontSize = 25;
    label.lineHeight = 32;
    label.color = new Color(255, 255, 255, 230);
    parent.addChild(node);
    node.setPosition(28, 690, 0);
    return label;
  }

  private createHealthLabel(parent: Node): Label {
    const node = new Node('HealthLabel');
    node.layer = parent.layer;
    const transform = node.addComponent(UITransform);
    transform.setContentSize(260, 36);
    const label = node.addComponent(Label);
    label.fontSize = 22;
    label.color = new Color(255, 245, 180, 245);
    parent.addChild(node);
    node.setPosition(28, 648, 0);
    return label;
  }

  private createContainer(parent: Node, name: string, width: number, height: number, anchorX: number, anchorY: number): Node {
    const node = new Node(name);
    node.layer = parent.layer;
    const transform = node.addComponent(UITransform);
    transform.setContentSize(width, height);
    transform.setAnchorPoint(anchorX, anchorY);
    parent.addChild(node);
    node.setPosition(0, 0, 0);
    return node;
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

  private alignToBottomLeft(node: Node, left: number, bottom: number): void {
    const widget = node.addComponent(Widget);
    widget.isAlignLeft = true;
    widget.isAlignBottom = true;
    widget.left = left;
    widget.bottom = bottom;
    widget.updateAlignment();
  }

  private createSpriteFrame(image: ImageAsset): SpriteFrame {
    const texture = new Texture2D();
    texture.image = image;
    const frame = new SpriteFrame();
    frame.texture = texture;
    return frame;
  }
}
