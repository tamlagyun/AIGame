import { _decorator, Component } from 'cc';
import { getCocosLayerPlan } from './CocosNodeNames';
import { startCocosRuntimePreview } from './GameBootstrap';

const { ccclass } = _decorator;

@ccclass('GameAppComponent')
export class GameAppComponent extends Component {
  readonly componentName = 'GameAppComponent';
  readonly usesRuntimeViewModel = true;
  readonly ownsGameplayRules = false;

  get requiredLayerNames(): string[] {
    return getCocosLayerPlan().map((layer) => layer.nodeName);
  }

  createStartupPlan(): {
    componentName: string;
    requiredLayerNames: string[];
    runtimeEntry: string;
    binderEntry: string;
    ownsGameplayRules: boolean;
  } {
    return {
      componentName: this.componentName,
      requiredLayerNames: this.requiredLayerNames,
      runtimeEntry: 'GameRuntime',
      binderEntry: 'RuntimeNodeBinder',
      ownsGameplayRules: this.ownsGameplayRules
    };
  }

  start(): void {
    startCocosRuntimePreview();
  }
}
