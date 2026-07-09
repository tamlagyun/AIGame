# 即梦AI图片生成 Skill

## 描述
通过火山引擎API调用即梦AI（Jimeng AI）进行图片生成，支持文生图、图生图等功能。适用于游戏美术资源生成、UI设计、概念图等场景。

## 触发条件
当用户需要以下操作时触发此Skill：
- 生成游戏角色/场景概念图
- 创建2D游戏美术资源
- 设计UI元素或图标
- 文生图（Text to Image）
- 图生图（Image to Image）

## 前置要求

### 1. 火山引擎账号
- 注册火山引擎账号：https://www.volcengine.com/
- 开通即梦AI图片生成服务
- 获取 Access Key (AK) 和 Secret Key (SK)

### 2. 配置凭证
创建配置文件 `config/config.json`：
```json
{
  "access_key": "your_access_key_here",
  "secret_key": "your_secret_key_here",
  "region": "cn-north-1",
  "producer_id": "your_producer_id",
  "propagate_id": "your_propagate_id"
}
```

## 使用方法

### 文生图（Text to Image）
```bash
# 基础用法
python scripts/jimeng_client.py text2image "一只可爱的卡通猫咪，游戏角色风格"

# 指定参数
python scripts/jimeng_client.py text2image "森林场景，阳光透过树叶，奇幻风格" --aspect-ratio 16:9 --count 2
```

### 参数说明
| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--width` | 图片宽度 | 1024 |
| `--height` | 图片高度 | 1024 |
| `--count` | 生成数量 | 1 |
| `--model` | 模型版本 | jimeng_text2image_v4_pro |
| `--output` | 输出目录 | ./output |

### 可用模型
| 模型Key | 说明 |
|---------|------|
| `jimeng_t2i_v40` | 文生图4.0（最新） |
| `jimeng_t2i_v31` | 文生图3.1 |
| `jimeng_t2i_v30` | 文生图3.0 |

## 输出
- 生成的图片保存在 `output/` 目录
- 文件名格式：`jimeng_{timestamp}_{index}.png`
- 图片URL有效期7天，请及时下载

## 注意事项
1. **合规标识**：必须正确配置 `producer_id` 和 `propagate_id`
2. **内容审核**：生成内容需通过安全审核，违规内容会返回错误
3. **异步处理**：图片生成是异步任务，需要轮询获取结果
4. **免费额度**：新用户有免费试用额度，超出后按量计费

## 错误处理
| 错误码 | 说明 | 解决方案 |
|--------|------|----------|
| Post Text Risk Not Pass | 内容审核未通过 | 修改提示词，避免敏感内容 |
| InvalidAuth | 认证失败 | 检查AK/SK配置 |
| QuotaExceeded | 额度不足 | 充值或等待额度恢复 |

## 示例提示词（游戏美术）
```
# 角色设计
"2D横版游戏角色，卡通风格，红色铠甲战士，手持能量剑，正面站立姿势，白色背景"

# 场景设计
"奇幻森林场景，阳光明媚，树木茂盛，远处有城堡，游戏背景美术风格"

# UI元素
"游戏按钮图标，金色边框，宝石装饰，卡通风格，透明背景"
```
