# 鲫鱼吃鲤鱼

《鲫鱼吃鲤鱼》是面向多平台发布的横屏 2D 海洋单机 PvE 游戏。当前版本已显示首张海洋地图和玩家小鲫鱼，并支持基础游动与镜头跟随；战斗尚未实现。

## 技术基线

- 引擎：Cocos Creator 3.8.8
- 语言：TypeScript
- 设计分辨率：1280 × 720 横屏
- 目标平台：微信小游戏、抖音小游戏、Android、iOS、HarmonyOS
- 应用版本：0.1.0
- 需求基线：REQ-0.1
- 配置格式：2
- 存档格式：1

## 打开项目

使用 Cocos Creator 3.8.8 打开：

```text
F:\AIworkspace\AIGameBundle\FishEatFish
```

主场景为 `assets/scenes/MainScene.scene`。运行后使用 WASD、方向键，或在屏幕左侧按下并拖动来控制小鲫鱼游动。

## 验证命令

```bash
npm test
npm run check
npm run hygiene
```

构建入口示例：

```bash
npm run build:target -- web-desktop --dry-run
npm run build:target -- wechatgame --dry-run
```

正式平台构建需要相应 SDK、应用标识、签名和开发者工具。iOS 原生工程必须在 macOS 工具链生成。

## 美术规则

本项目禁止使用 SVG 或程序化矢量图拼凑正式 UI、美术。调用工作区即梦 AI 接口前，必须将完整提示词与生成参数写入提示词档案并获得用户确认。详见 `docs/art-direction.md` 和 `docs/art-prompts.md`。

AI 美术的通用 PNG 处理工具位于工作区 `Tools/image-processing`，不包含本项目路径或资源名称。项目导入时须显式指定输入、输出和尺寸；示例见 `Tools/image-processing/README.md`。

## 后续入口

下一阶段建议实现不依赖 Cocos 的最小玩法闭环：移动、普通撕咬、冲刺撕咬、受伤、击败、经验和升级回血，再连接 Cocos 场景表现。

## 初始化验证记录

- 2026-07-13：Cocos Creator 3.8.8 资源数据库导入成功并生成项目 `.meta`。
- 2026-07-13：Web Desktop 调试构建成功，启动场景为 `MainScene.scene`。
- 验证结束后删除 `build`、`library`、`temp` 和 `profiles`；这些目录不得提交版本控制。
## 当前 UI 入口

打开 `MainScene` 后运行即可查看海底地图、动画小鲫鱼、左下虚拟摇杆、普通撕咬按钮和右侧冲刺撕咬按钮。UI 资源位于 `assets/resources/art/ui`，提示词和生成记录位于 `docs/art-prompts.md`。

验证命令：

```powershell
npm.cmd test
npm.cmd run check
npm.cmd run hygiene
```

## 服务端

```powershell
cd server
npm.cmd install
npm.cmd run dev
```

服务端健康检查：`http://localhost:3000/health`。多人协议和目录说明见 `docs/server-architecture.md`、`docs/server-directory.md` 与 `docs/realtime-protocol.md`。
