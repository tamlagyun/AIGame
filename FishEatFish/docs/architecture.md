# 技术架构

## 分层

- `assets/scripts/core`：纯 TypeScript 规则、状态和存档契约，不导入 Cocos。
- `assets/scripts/data`：配置读取、默认值和校验。
- `assets/scripts/runtime`：连接核心状态与 Cocos 表现。
- `assets/scripts/cocos`：场景入口、节点和引擎生命周期。
- `assets/scripts/input`：将键盘、触摸和平台输入归一化为 `InputCommand`。
- `assets/scripts/platform`：平台 API 的唯一入口。
- `assets/scripts/ui`：HUD 和界面视图逻辑。
- `assets/scripts/audio`：音频、静音和生命周期处理。
- `assets/scripts/shared`：平台无关工具。

## 运行流程

场景入口创建平台服务并加载版本化配置，输入层产生统一命令，核心层推进纯玩法状态，运行时层再把状态映射到 Cocos 节点、动画、音效和 UI。

## 世界策略

首版世界边界为 8000 × 4500 逻辑单位，按 1000 × 900 逻辑单位分区。运行时只激活玩家附近分区；视野外鱼进入低频更新或休眠。具体阈值在真机性能阶段校准。

## 生命周期

进入后台时暂停玩法时钟和音频；恢复时从当前存档状态继续，不补算后台期间的战斗。存储失败时编辑器适配器使用内存降级，正式平台适配器必须返回可诊断错误。

