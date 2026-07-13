import { _decorator, Component, ResolutionPolicy, view } from 'cc';
import { createPlatformService } from '../platform/PlatformAdapters.ts';

const { ccclass } = _decorator;

@ccclass('GameBootstrap')
export class GameBootstrap extends Component {
  private removePauseListener?: () => void;
  private removeResumeListener?: () => void;

  protected async start(): Promise<void> {
    view.setDesignResolutionSize(1280, 720, ResolutionPolicy.SHOW_ALL);
    const platform = createPlatformService('editor');
    await platform.init();
    this.removePauseListener = platform.onPause(() => this.node.pauseSystemEvents(true));
    this.removeResumeListener = platform.onResume(() => this.node.resumeSystemEvents(true));
  }

  protected onDestroy(): void {
    this.removePauseListener?.();
    this.removeResumeListener?.();
  }
}

