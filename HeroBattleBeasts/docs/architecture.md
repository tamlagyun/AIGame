# HeroBattleBeasts 跨平台技术架构

## 1. 架构目标

`HeroBattleBeasts` 需要构建为可跨平台发布的 2D 卡通动作游戏，后续目标平台包括：

- Android
- iOS
- 微信小游戏
- 抖音小游戏
- 鸿蒙平台

架构目标是让核心玩法代码保持可移植，平台 API 隔离在独立层中，并在开始平台打包前，先保证第一版可玩内容可测试、可维护、可扩展。

## 2. 推荐引擎

正式工程采用 Cocos Creator 3.8.x + TypeScript。

选择原因：

- 支持 2D 玩法、动画、音频、UI、资源加载、碰撞和基础物理工作流。
- 对 Android、iOS、小游戏平台有成熟构建目标。
- 可以让玩法逻辑、UI 和资源流程尽量跨平台复用。
- 提供场景、预制体、图集、动画剪辑和资源管理的编辑器工作流。

早期纯 Web 原型不再作为主路线，因为最终交付目标包含多个原生平台和小游戏平台。

## 3. 分层架构

创建 Cocos 工程后建议采用以下目录结构：

```text
HeroBattleBeasts/
  assets/
    scenes/
    scripts/
      core/
      runtime/
      platform/
      data/
      ui/
      audio/
      shared/
    resources/
      configs/
      art/
      audio/
      fonts/
    prefabs/
    animations/
  docs/
  tests/
  package.json
  tsconfig.json
```

### 3.1 核心玩法层

路径：`assets/scripts/core`

职责：

- 保存纯玩法规则。
- 不导入 Cocos 模块。
- 不直接调用 Android、iOS、微信、抖音、鸿蒙 API。
- 尽量支持使用 Node 测试核心逻辑。

包含内容：

- 玩家状态和战斗规则。
- 武器行为。
- 敌人状态机。
- 伤害、生命、得分、金币、道具。
- 关卡目标判定。
- 可测试的碰撞和命中规则。

### 3.2 运行时层

路径：`assets/scripts/runtime`

职责：

- 把 Cocos 场景、节点、预制体、动画、碰撞组件和渲染表现连接到核心玩法层。

包含内容：

- 场景启动入口。
- 帧更新或固定更新循环。
- 玩家控制组件。
- 敌人控制组件。
- 子弹生成和对象池。
- 摄像机跟随。
- 运行时资源加载。
- 动画状态切换。
- Cocos 碰撞回调。

### 3.3 平台层

路径：`assets/scripts/platform`

职责：

- 将所有平台相关 API 封装到稳定接口后面。

核心接口示例：

```ts
interface PlatformService {
  readonly target: PlatformTarget;
  init(): Promise<void>;
  login(): Promise<LoginResult>;
  share(payload: SharePayload): Promise<ShareResult>;
  showRewardAd(placementId: string): Promise<RewardAdResult>;
  saveData(key: string, value: unknown): Promise<void>;
  loadData<T>(key: string): Promise<T | null>;
  vibrate(durationMs: number): void;
  getSafeArea(): SafeAreaInsets;
  onPause(callback: () => void): void;
  onResume(callback: () => void): void;
}
```

计划实现：

- `PlatformServiceEditor`：编辑器和浏览器预览。
- `PlatformServiceNative`：Android/iOS 共用原生封装。
- `PlatformServiceWechat`：微信小游戏 API。
- `PlatformServiceDouyin`：抖音小游戏 API。
- `PlatformServiceHarmony`：鸿蒙平台封装。

### 3.4 数据层

路径：`assets/scripts/data` 和 `assets/resources/configs`

职责：

- 将玩法调参从场景脚本中拆出来。

配置类型：

- 玩家配置。
- 武器配置。
- 敌人配置。
- 道具配置。
- 关卡配置。
- 难度配置。
- 奖励配置。

早期优先使用 JSON。后续可以增加 TypeScript 类型生成或配置校验。

### 3.5 UI 层

路径：`assets/scripts/ui`

职责：

- 管理 HUD、菜单、暂停、设置、胜负结算和平台提示。

建议模块：

- `HudView`
- `PauseView`
- `ResultView`
- `SettingsView`
- `LoadingView`
- `PlatformPromptView`

UI 应从游戏状态或视图模型读取显示数据，不直接修改底层玩法规则。

### 3.6 音频层

路径：`assets/scripts/audio`

职责：

- 集中管理音乐和音效。
- 处理平台暂停和恢复。
- 统一音量、静音和设置保存。

### 3.7 共享层

路径：`assets/scripts/shared`

职责：

- 共享类型、常量、数学工具、对象池、事件总线和通用工具函数。

共享层必须保持平台无关。

## 4. 运行流程

推荐启动流程：

1. `GameBootstrap` 从主场景启动。
2. 检测当前目标平台。
3. 创建匹配的 `PlatformService`。
4. 初始化存档、音频、资源加载器和 UI 根节点。
5. 加载关卡配置。
6. 创建玩法运行时控制器。
7. 运行时控制器把输入和 Cocos 事件转换为核心层命令。
8. 核心层更新玩法状态。
9. 运行时层通过节点、动画、特效和 UI 表现最新状态。

## 5. 平台发布设计

### 5.1 Android

关键要求：

- 使用 Cocos 原生 Android 构建。
- 适配屏幕比例和安全区域。
- 处理返回键。
- 处理应用暂停和恢复。
- 广告、统计、登录、支付等原生 SDK 预留封装。

架构规则：

- 原生 SDK 调用必须经过 `PlatformServiceNative`。

### 5.2 iOS

关键要求：

- 使用 Cocos 原生 iOS 构建。
- 支持刘海屏和安全区域。
- 处理应用生命周期。
- 遵守 App Store 隐私和权限要求。
- 广告、统计、登录、支付等原生 SDK 预留封装。

架构规则：

- Objective-C / Swift 桥接细节不能泄漏到玩法代码中。

### 5.3 微信小游戏

关键要求：

- 使用 Cocos 微信小游戏构建目标。
- 控制包体大小。
- 规划资源压缩和远程资源包。
- 接入分享和激励视频。
- 如后续需要排行榜，预留开放数据域设计。

架构规则：

- 所有 `wx` API 使用必须限制在 `PlatformServiceWechat` 内。

### 5.4 抖音小游戏

关键要求：

- 使用 Cocos 抖音小游戏构建目标。
- 接入激励广告、分享和生命周期。
- 处理包体大小和资源加载限制。
- 微信与抖音 API 差异由平台实现层消化。

架构规则：

- 所有抖音 API 使用必须限制在 `PlatformServiceDouyin` 内。

### 5.5 鸿蒙平台

关键要求：

- 平台服务必须隔离，避免依赖 Android 专有行为。
- 准备独立的 `PlatformServiceHarmony`。
- 存储、生命周期、安全区域、支付和广告预留统一抽象。

架构规则：

- 鸿蒙 SDK 相关代码不能被共享玩法、UI 或运行时逻辑直接导入。

## 6. 资源策略

早期阶段：

- 使用卡通占位图和简单特效。
- 控制资源体积。
- 使用一个短森林关卡。
- 保持精灵尺寸和命名一致。

后续阶段：

- 为角色、敌人、子弹、道具和 UI 使用图集。
- 按场景或章节拆分资源。
- 当包体需要控制时使用 Cocos Asset Bundle。
- 按目标平台压缩纹理。

推荐资源目录：

```text
assets/resources/art/characters/
assets/resources/art/enemies/
assets/resources/art/weapons/
assets/resources/art/levels/
assets/resources/art/ui/
assets/resources/audio/bgm/
assets/resources/audio/sfx/
assets/resources/configs/
```

## 7. 玩法模块边界

第一版可玩内容建议通过以下模块实现：

- `PlayerModel`：生命、位置意图、移动状态、武器状态。
- `WeaponSystem`：射速、子弹伤害、临时强化。
- `EnemySystem`：敌人移动、生命、击败状态。
- `PickupSystem`：金币、宝石、生命恢复、武器强化收集。
- `ObjectiveSystem`：胜利和失败条件。
- `LevelSystem`：关卡配置加载和出生数据。
- `CombatSystem`：命中和伤害结算。

运行时组件应调用这些系统，不应把玩法规则直接写死在 Cocos 组件脚本中。

## 8. 输入设计

输入需要统一转换为平台无关命令：

```ts
type InputCommand = {
  moveX: -1 | 0 | 1;
  jumpPressed: boolean;
  shootPressed: boolean;
  pausePressed: boolean;
};
```

输入来源：

- 编辑器和桌面预览使用键盘输入。
- 移动端和小游戏使用触摸输入。
- 移动端可后续增加虚拟摇杆和按钮。

玩法代码只消费 `InputCommand`，不直接处理浏览器、原生或平台输入事件。

## 9. 测试策略

核心逻辑测试：

- 尽量脱离 Cocos 运行。
- 覆盖移动状态切换、武器射速、伤害、道具收集、目标完成和关卡配置解析。

运行时检查：

- Cocos 场景可以加载。
- 必需预制体和资源存在。
- 主场景挂载启动组件。

平台检查：

- 每个平台服务都有编辑器或模拟实现。
- 编辑器预览中不支持的平台 API 返回安全降级结果。

## 10. 构建和发布顺序

推荐顺序：

1. Cocos 编辑器预览。
2. Web 预览，用于快速调玩法。
3. Android 内部测试。
4. 微信小游戏测试包。
5. 抖音小游戏测试包。
6. iOS TestFlight。
7. 鸿蒙测试包。

原因：

- 编辑器和 Web 预览迭代最快。
- Android 可较早验证原生性能。
- 小游戏包能尽早暴露包体和平台 API 问题。
- iOS 和鸿蒙在核心玩法和平台抽象稳定后推进更合适。

## 11. 架构后的第一个工程里程碑

下一步实施应创建 Cocos 兼容工程骨架：

- `package.json`
- `tsconfig.json`
- Cocos 风格 `assets/` 目录。
- `assets/scripts/core`
- `assets/scripts/runtime`
- `assets/scripts/platform`
- `assets/scripts/data`
- `assets/scripts/ui`
- `assets/resources/configs`
- `tests/`
- 更新 README 中的构建和验证说明。

该步骤仍不实现完整玩法，只建立符合本架构的工程结构。

## 12. 硬性约束

- 不允许在玩法逻辑中直接调用平台 API。
- 不允许在 Cocos 组件中硬编码关卡调参。
- 不允许在共享代码中假设某一个小游戏平台一定存在。
- 不依赖 `PickMushRooms`。
- 第一版可玩范围必须足够小，便于完成和验证。
- 后续每个实施步骤都必须先列计划，等待用户确认后再修改文件。
