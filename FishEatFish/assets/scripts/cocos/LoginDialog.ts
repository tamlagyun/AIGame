import { BlockInputEvents, Color, EditBox, Graphics, Label, Node, UITransform } from 'cc';

export type LoginDialogPresentation = 'dom' | 'cocos';

/** 调用方传入的登录对话框内容与行为，用于区分不同登录入口。 */
export interface LoginDialogOptions {
  variant: string;
  presentation: LoginDialogPresentation;
  parent?: Node;
  title: string;
  description: string;
  placeholder: string;
  submitText: string;
  initialUsername: string;
  maxLength?: number;
  onSubmit: (username: string) => void;
  onValidationError?: () => void;
}

/**
 * 可参数化的登录 UI 组件。
 * Cocos 形态固定挂在 InputLayer；Web 形态使用同一套文案和校验参数创建 DOM 输入框。
 */
export class LoginDialog {
  private rootNode?: Node;
  private domRoot?: HTMLElement;
  private closed = false;

  public static open(options: LoginDialogOptions): LoginDialog {
    return new LoginDialog(options);
  }

  private constructor(private readonly options: LoginDialogOptions) {
    if (options.presentation === 'dom') this.createDomDialog();
    else this.createCocosDialog();
  }

  public get isOpen(): boolean {
    return !this.closed;
  }

  public close(): void {
    if (this.closed) return;
    this.closed = true;
    this.rootNode?.destroy();
    this.rootNode = undefined;
    this.domRoot?.remove();
    this.domRoot = undefined;
  }

  private createDomDialog(): void {
    if (typeof document === 'undefined') return;
    const overlay = document.createElement('div');
    overlay.id = `fish-eat-fish-login-${this.options.variant}`;
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:rgba(0,20,45,.74);font-family:Arial,"Microsoft YaHei",sans-serif;';
    const panel = document.createElement('div');
    panel.style.cssText = 'width:420px;max-width:calc(100vw - 48px);padding:32px;border-radius:20px;background:#11456a;color:#fff;box-shadow:0 16px 48px rgba(0,0,0,.45);text-align:center;box-sizing:border-box;';
    const title = document.createElement('div');
    title.textContent = this.options.title;
    title.style.cssText = 'font-size:28px;font-weight:700;color:#fff5b4;margin-bottom:12px;';
    const description = document.createElement('div');
    description.textContent = this.options.description;
    description.style.cssText = 'font-size:18px;margin-bottom:22px;';
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = this.options.maxLength ?? 16;
    input.placeholder = this.options.placeholder;
    input.value = this.options.initialUsername;
    input.style.cssText = 'display:block;width:100%;height:52px;padding:0 16px;box-sizing:border-box;border:0;border-radius:10px;background:#fff;color:#124260;font-size:20px;outline:none;';
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = this.options.submitText;
    button.style.cssText = 'margin-top:22px;width:190px;height:56px;border:0;border-radius:14px;background:#2499c8;color:#fff;font-size:20px;cursor:pointer;';
    const submit = () => this.submit(input.value, () => input.focus());
    button.onclick = submit;
    input.onkeydown = (event) => { if (event.key === 'Enter') submit(); };
    panel.append(title, description, input, button);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    input.focus();
    this.domRoot = overlay;
  }

  private createCocosDialog(): void {
    const parent = this.options.parent;
    if (!parent) throw new Error('Cocos 登录对话框必须提供 InputLayer 父节点。');
    const dialog = new Node(`LoginDialog-${this.options.variant}`);
    dialog.layer = parent.layer;
    const dialogTransform = dialog.addComponent(UITransform);
    dialogTransform.setContentSize(1280, 720);
    dialogTransform.setAnchorPoint(0.5, 0.5);
    dialog.addComponent(BlockInputEvents);
    parent.addChild(dialog);
    dialog.setPosition(0, 0, 0);
    const shade = dialog.addComponent(Graphics);
    shade.fillColor = new Color(0, 20, 45, 190);
    shade.rect(-640, -360, 1280, 720);
    shade.fill();

    const panel = new Node('LoginDialogPanel');
    panel.layer = dialog.layer;
    const panelTransform = panel.addComponent(UITransform);
    panelTransform.setContentSize(520, 300);
    panelTransform.setAnchorPoint(0.5, 0.5);
    const panelGraphics = panel.addComponent(Graphics);
    panelGraphics.fillColor = new Color(17, 69, 106, 248);
    panelGraphics.roundRect(-260, -150, 520, 300, 24);
    panelGraphics.fill();
    dialog.addChild(panel);
    panel.setPosition(0, 0, 0);

    this.createLabel(panel, 'LoginDialogTitle', this.options.title, 30, new Color(255, 245, 180, 255), 0, 88);
    this.createLabel(panel, 'LoginDialogDescription', this.options.description, 20, new Color(230, 245, 255, 255), 0, 42);
    const background = new Node('LoginDialogInputBackground');
    background.layer = panel.layer;
    const backgroundTransform = background.addComponent(UITransform);
    backgroundTransform.setContentSize(360, 56);
    backgroundTransform.setAnchorPoint(0.5, 0.5);
    const backgroundGraphics = background.addComponent(Graphics);
    backgroundGraphics.fillColor = new Color(255, 255, 255, 245);
    backgroundGraphics.roundRect(-180, -28, 360, 56, 12);
    backgroundGraphics.fill();
    panel.addChild(background);
    background.setPosition(0, -12, 0);

    const inputNode = new Node('LoginDialogUsernameInput');
    inputNode.layer = panel.layer;
    const inputTransform = inputNode.addComponent(UITransform);
    inputTransform.setContentSize(340, 46);
    inputTransform.setAnchorPoint(0.5, 0.5);
    const usernameInput = inputNode.addComponent(EditBox);
    usernameInput.inputMode = EditBox.InputMode.SINGLE_LINE;
    usernameInput.placeholder = this.options.placeholder;
    usernameInput.maxLength = this.options.maxLength ?? 16;
    usernameInput.fontSize = 22;
    usernameInput.fontColor = new Color(18, 66, 96, 255);
    usernameInput.placeholderFontSize = 20;
    usernameInput.placeholderFontColor = new Color(100, 132, 152, 255);
    usernameInput.string = this.options.initialUsername;
    background.addChild(inputNode);
    inputNode.setPosition(0, 0, 0);
    inputNode.on(EditBox.EventType.EDITING_DID_BEGAN, () => this.alignNativeInput(usernameInput));

    const button = this.createButton(panel, this.options.submitText, () => this.submit(usernameInput.string));
    button.name = `LoginDialogSubmit-${this.options.variant}`;
    button.setPosition(0, -96, 0);
    this.rootNode = dialog;
  }

  private submit(value: string, focus?: () => void): void {
    const username = value.trim();
    if (!username) {
      this.options.onValidationError?.();
      focus?.();
      return;
    }
    this.close();
    this.options.onSubmit(username);
  }

  private createLabel(parent: Node, name: string, text: string, fontSize: number, color: Color, x: number, y: number): Node {
    const node = new Node(name);
    node.layer = parent.layer;
    const transform = node.addComponent(UITransform);
    transform.setContentSize(460, 42);
    transform.setAnchorPoint(0.5, 0.5);
    const label = node.addComponent(Label);
    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = fontSize + 8;
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.color = color;
    parent.addChild(node);
    node.setPosition(x, y, 0);
    return node;
  }

  private createButton(parent: Node, text: string, action: () => void): Node {
    const node = new Node('LoginDialogSubmitButton');
    node.layer = parent.layer;
    const transform = node.addComponent(UITransform);
    transform.setContentSize(190, 64);
    transform.setAnchorPoint(0.5, 0.5);
    const graphics = node.addComponent(Graphics);
    graphics.fillColor = new Color(36, 153, 200, 255);
    graphics.roundRect(-95, -32, 190, 64, 16);
    graphics.fill();
    parent.addChild(node);
    this.createLabel(node, 'LoginDialogSubmitLabel', text, 20, new Color(255, 255, 255, 255), 0, 0);
    node.on(Node.EventType.TOUCH_START, () => node.setScale(0.92, 0.92, 1));
    node.on(Node.EventType.TOUCH_CANCEL, () => node.setScale(1, 1, 1));
    node.on(Node.EventType.TOUCH_END, () => { node.setScale(1, 1, 1); action(); });
    return node;
  }

  private alignNativeInput(editBox: EditBox): void {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    const apply = () => {
      const impl = editBox._impl as unknown as { _edTxt?: HTMLInputElement | HTMLTextAreaElement } | null;
      const element = impl?._edTxt;
      const canvas = (document.getElementById('GameCanvas') ?? document.querySelector('canvas')) as HTMLCanvasElement | null;
      if (!element || !canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = rect.width / 1280;
      const scaleY = rect.height / 720;
      const width = 340 * scaleX;
      const height = 46 * scaleY;
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2 + 12 * scaleY;
      element.style.position = 'fixed';
      element.style.left = `${centerX - width / 2}px`;
      element.style.top = `${centerY - height / 2}px`;
      element.style.bottom = 'auto';
      element.style.width = `${width}px`;
      element.style.height = `${height}px`;
      element.style.transform = 'none';
      element.style.setProperty('-webkit-transform', 'none');
      element.style.transformOrigin = 'center center';
      element.style.boxSizing = 'border-box';
      element.style.padding = `0 ${Math.max(6, 10 * scaleX)}px`;
      element.style.overflow = 'hidden';
      element.style.fontSize = `${Math.max(14, 22 * scaleY)}px`;
      element.style.lineHeight = `${height}px`;
      element.style.color = '#124260';
      element.style.background = 'transparent';
      element.style.zIndex = '2147483647';
    };
    window.requestAnimationFrame(() => window.requestAnimationFrame(apply));
  }
}
