# 实时协议

所有消息使用 `{ protocolVersion, type, requestId?, payload }`。客户端消息为 `joinRoom`、`input`、`skill`、`ping`、`leaveRoom`；服务器消息包括 `roomSnapshot`、`playerJoined`、`playerRemoved`、`stateSnapshot`、`stateCorrection`、`skillEffect`、`skillResolved`、战斗事件、`pong` 和 `error`。

`input` 包含 `clientTick`、`moveX`、`moveY` 和 `rotation`。服务器拒绝越界输入、错误协议版本和不属于房间的玩家输入。

`skill` 当前支持 `skill-basic-bite`、`skill-dash-bite`、`skill-whale-swallow`、`skill-death-roll`、`skill-ink-splash` 和 `skill-orca-charge`。客户端提交的 `x`、`y` 和目标不参与权威命中或选目标。

鲸吞成功时，`skillEffect` 附带：

```ts
{
  playerId: string;
  skillId: "skill-whale-swallow";
  targetId: string;
  x: number;
  y: number;
  effectDurationMs: 3000;
  actionSequence: number;
}
```

其中 `x/y` 是服务器将施法者瞬移后的权威位置。状态快照在效果有效期内同步 `actionTargetId` 与 `actionRemainingMs`，用于动作和透明度补偿；没有有效目标时 `skillResolved.reason` 为 `noTarget`，且不消耗服务端冷却。

## 虎鲸冲刺同步

- 客户端仍只发送统一 `skill` 消息，`skillId` 为 `skill-orca-charge`，不发送目标、伤害或顶飞终点。
- 服务器选择目标、限制冲刺与顶飞坐标并结算 60 点伤害。
- `skillEffect` 对虎鲸冲刺额外携带 `targetId`、`targetX`、`targetY` 和 `effectDurationMs`；`x/y` 是施法者权威冲刺终点，`targetX/targetY` 是目标权威顶飞终点。
- 没有前方目标时 `skillResolved.reason` 为 `noTarget`，客户端取消本次预测冷却。
