# 《鲫鱼吃鲤鱼》技能配置与技能栏组件

## 目标

技能的显示、冷却和本地表现不再散落在 `GameBootstrap.ts`。新增或替换一个技能时，应优先修改 JSON 配置；只有新增一种从未支持过的表现类型时，才扩展 `SkillEffectExecutor`。

## 文件职责

- `assets/resources/configs/skill-*.json`：单个技能的稳定 ID、显示名、网络技能 ID、数值、UI 槽位、图标路径、冷却组和本地表现参数。
- `assets/resources/configs/skill-loadout-player.json`：技能栏整体尺寸、右下安全区对齐、主按钮圆心、圆弧半径/角度、按钮尺寸、冷却起点，以及玩家当前装配的技能配置路径。
- `assets/scripts/data/SkillCatalog.ts`：按稳定技能 ID 或网络技能 ID 查询已经校验过的配置。
- `assets/scripts/cocos/SkillActionPanel.ts`：通用技能栏组件。传入技能栏配置、技能配置、图片资源和激活回调后，创建 `ActionControlsRoot`、按钮、标签、触摸区和独立冷却蒙板；不处理战斗结算。
- `assets/scripts/cocos/SkillEffectExecutor.ts`：根据 `clientEffect.kind` 执行本地预测表现并发出网络技能事件。命中、伤害、死亡仍以服务器为准。
- `assets/scripts/cocos/GameBootstrap.ts`：加载并校验配置，提供玩家节点、边界移动、动画、特效绘制、网络发送与提示回调；不得重新写入技能槽位、图标路径、冷却时长、伤害范围或特效色值。

## 新增技能流程

1. 新增 `skill-<id>.json` 和对应 `.meta`，填写 `schemaVersion: 2`、稳定 `id`、`networkSkillId`、`ui` 和 `clientEffect`。
2. 将配置路径加入 `skill-loadout-player.json`；圆弧技能必须使用已配置的唯一 `slotIndex`，主按钮使用 `slot: "primary"`。
3. 需要新图标时，先遵守 `AGENTS.md` 的美术提示词确认和资源登记流程；未有新图标时，只能引用已登记的资源路径。
4. 若 `clientEffect.kind` 已是 `bite`、`dashBite` 或 `whaleSwallow`，不改动 UI 代码即可显示并执行本地效果；否则新增明确的表现类型、测试与服务器协议设计。
5. 运行自动检查，并在 Cocos IDE 与 Web 浏览器分别验收显示、触摸、冷却、地图移动后的屏幕固定和联机同步。

## 冷却与权威性

- `cooldownGroup` 相同的技能共享一个本地冷却状态，组内 `cooldownSeconds` 必须一致。
- `SkillActionPanel` 只在激活回调成功时开始冷却；服务端返回鲸吞 `noTarget` 时，`GameBootstrap` 通过网络技能 ID 取消该组冷却。
- 客户端不提交目标、伤害、命中或生命值；`networkSkillId` 只用于发送技能意图。
