# 鲫鱼吃鲤鱼

《鲫鱼吃鲤鱼》是面向多平台发布的横屏 2D 海洋单机 PvE 游戏。当前版本为工程初始化骨架，只建立需求、架构、平台、配置、测试和美术管理边界，不包含可玩战斗。

## 技术基线

- 引擎：Cocos Creator 3.8.8
- 语言：TypeScript
- 设计分辨率：1280 × 720 横屏
- 目标平台：微信小游戏、抖音小游戏、Android、iOS、HarmonyOS
- 应用版本：0.1.0
- 需求基线：REQ-0.1
- 配置格式：1
- 存档格式：1

## 打开项目

使用 Cocos Creator 3.8.8 打开：

```text
F:\AIworkspace\AIGameBundle\FishEatFish
```

主场景为 `assets/scenes/MainScene.scene`。场景仅包含世界、镜头、玩家、鱼群、特效、HUD、安全区和输入层骨架。

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

## 后续入口

下一阶段建议实现不依赖 Cocos 的最小玩法闭环：移动、普通撕咬、冲刺撕咬、受伤、击败、经验和升级回血，再连接 Cocos 场景表现。

## 初始化验证记录

- 2026-07-13：Cocos Creator 3.8.8 资源数据库导入成功并生成项目 `.meta`。
- 2026-07-13：Web Desktop 调试构建成功，启动场景为 `MainScene.scene`。
- 验证结束后删除 `build`、`library`、`temp` 和 `profiles`；这些目录不得提交版本控制。
