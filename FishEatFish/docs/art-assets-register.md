# 美术资源登记表

| 资源 ID | 名称 | 提示词版本 | 原图 | 加工步骤 | 正式路径 | 授权状态 | `.meta` 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ART-MAP-0001 | 首张海洋地图背景 | ART-PROMPT-0001 v2 | `art-output/ART-PROMPT-0001-v2/jimeng_1783935378_1.png` | 用户指定采用原始 2048×1152 PNG，覆盖 v1 正式资源 | `assets/resources/art/map/sea-background.png` | 工程内即梦 API 生成，待发布前复核平台授权条款 | 待 Cocos 导入 |
| ART-PLAYER-0001 | 玩家小鲫鱼游泳动画 | ART-PROMPT-0002 v2 | `art-output/ART-PROMPT-0002-v2/jimeng_1783934889_1.png` | 3×2 切分、绿幕去除、最大连通主体保留、去绿边、统一缩放为 256×256 透明 PNG | `assets/resources/art/characters/player/swim-0.png` 至 `swim-5.png` | 工程内即梦 API 生成，待发布前复核平台授权条款 | 待 Cocos 导入 |
| ART-PLAYER-0002 | 玩家小鲫鱼撕咬与甩头撕扯攻击动画 | ART-PROMPT-0003 v1 | `art-output/ART-PROMPT-0003-v1/jimeng_1784103485_1.png` | 4×2 切分、绿幕去除、保留全部非绿幕前景以保留分离的撕扯动作线条、统一缩放为 256×256 透明 PNG | `assets/resources/art/characters/player/bite-0.png` 至 `bite-7.png` | 工程内即梦 API 生成，待发布前复核平台授权条款 | 已建立 Cocos image `.meta`，待编辑器下次资源刷新复核 |
| ART-PLAYER-0003 | 玩家小鲫鱼无伤口翻肚受击动画 | ART-PROMPT-0004 v3 | `art-output/ART-PROMPT-0004-v3/jimeng_1784107349_1.png` | 4×2 切分、绿幕去除、仅保留最大鱼体主体、统一缩放为 256×256 透明 PNG；按原图索引 `0,3,1,2,4,5,6,7` 重排为正常、接触、翻肚、甩动、回弹、恢复 | `assets/resources/art/characters/player/hurt-0.png` 至 `hurt-7.png` | 工程内即梦 API 生成，待发布前复核平台授权条款 | 已建立独立 Cocos image `.meta`，待编辑器资源刷新复核 |

## 角色朝向归一记录

- `swim-0.png` 至 `swim-5.png` 实际原图朝右。
- `bite-0.png` 至 `bite-7.png` 虽然提示词要求朝右，但实际选定输出朝左；不覆盖历史提示词和原图，在 `fish-player.json` 中登记为 `animationArtFacingDirections.bite = "left"`。
- 玩家鱼运行时统一方向为 `artFacingDirection = "right"`；加载攻击帧时由 SpriteFrame UV 水平翻转归一，不修改原 PNG。
- `hurt-0.png` 至 `hurt-7.png` 按正常右向、翻肚、恢复动作组织，配置登记为 `animationArtFacingDirections.hurt = "right"`；翻肚帧是图片内部姿态，不通过旋转或移动节点实现。

## 未选定候选资源

- `ART-PROMPT-0004 v1`：`art-output/ART-PROMPT-0004-v1/jimeng_1784107077_1.png`。拒绝原因：含血液、伤口、身体断裂、大幅整体转向和网格线；禁止切分和导入正式资源目录。
# UI 资源（ART-PROMPT-UI）

| 资源 | 原图 | 处理结果 | 导入路径 | 授权/状态 |
|---|---|---|---|---|
| 虚拟摇杆底盘 | `art-output/ART-PROMPT-UI-0001-v1/jimeng_1783936955_1.png` | 色键去背、去溢色、按 Alpha 包围盒裁边并居中 | `assets/resources/art/ui/joystick-base.png` | 已确认并调用 |
| 摇杆中心操纵帽 | `art-output/ART-PROMPT-UI-0002-v1/jimeng_1783937010_1.png` | 色键去背、去溢色、按 Alpha 包围盒裁边并居中 | `assets/resources/art/ui/joystick-knob.png` | 已确认并调用 |
| 普通撕咬按钮 | `art-output/ART-PROMPT-UI-0003-v1/jimeng_1783937027_1.png` | 色键去背、去溢色、按 Alpha 包围盒裁边并居中 | `assets/resources/art/ui/basic-attack.png` | 已确认并调用 |
| 冲刺撕咬按钮 | `art-output/ART-PROMPT-UI-0004-v1/jimeng_1783937050_1.png` | 色键去背、去溢色、按 Alpha 包围盒裁边并居中 | `assets/resources/art/ui/skill-dash.png` | 已确认并调用 |
| 鱼儿生命条边框与空槽 | `art-output/ART-PROMPT-UI-0005-v1/jimeng_1784108681_1.png` | 绿色背景色键去背、柔化透明边缘、去溢色、裁取完整横向边框和空槽为 876×310 透明 PNG | `assets/resources/art/ui/health-bar-frame.png` | 用户已确认提示词；工程内即梦 API 生成；已建立独立 `.meta`，待编辑器刷新复核 |
| 鱼儿动态生命填充条 | `art-output/ART-PROMPT-UI-0006-v1/jimeng_1784108702_1.png` | 洋红背景色键去背、柔化透明边缘、去溢色、从生成图额外外框内裁取彩色胶囊主体为 820×190 透明 PNG | `assets/resources/art/ui/health-bar-fill.png` | 用户已确认提示词；工程内即梦 API 生成；已建立独立 `.meta`，待编辑器刷新复核 |
