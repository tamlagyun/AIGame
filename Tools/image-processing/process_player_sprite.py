"""处理AI生成的玩家精灵图：去白底 + 缩放到游戏合理尺寸"""
from PIL import Image
import os
import sys

# 工作区根目录（Tools/image-processing/ → 上两级）
WORKSPACE_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 各游戏精灵图路径配置
GAME_SPRITES = {
    "HeroBattleBeasts": os.path.join(WORKSPACE_ROOT, "HeroBattleBeasts", "assets", "resources", "art", "characters", "player_hero.png"),
    # 后续新游戏在此添加
}

# 处理参数
TARGET_WIDTH = 80  # 游戏物理碰撞盒 32x48，精灵图视觉放大到 ~56x80


def remove_white_bg(img: Image.Image, threshold: int = 235) -> Image.Image:
    """将白色/近白色像素转为透明"""
    img = img.convert("RGBA")
    data = img.getdata()
    new_data = []
    for item in data:
        r, g, b, a = item
        if r > threshold and g > threshold and b > threshold:
            new_data.append((r, g, b, 0))
        else:
            new_data.append(item)
    img.putdata(new_data)
    return img


def process_sprite(src_path: str, target_width: int = TARGET_WIDTH) -> bool:
    """处理单个精灵图：去白底 + 缩放"""
    if not os.path.exists(src_path):
        print(f"[跳过] 文件不存在: {src_path}")
        return False

    img = Image.open(src_path)
    print(f"处理: {os.path.basename(src_path)}")
    print(f"  原始尺寸: {img.size[0]}x{img.size[1]}, 模式: {img.mode}")

    # 去掉白底
    img = remove_white_bg(img)

    # 等比例缩放
    ratio = target_width / img.width
    new_h = int(img.height * ratio)
    img = img.resize((target_width, new_h), Image.LANCZOS)
    print(f"  缩放后: {img.size[0]}x{img.size[1]}")

    img.save(src_path, "PNG")
    print(f"  已保存: {src_path}")
    return True


def main():
    game = sys.argv[1] if len(sys.argv) > 1 else "HeroBattleBeasts"

    if game not in GAME_SPRITES:
        print(f"未知游戏: {game}, 可用: {list(GAME_SPRITES.keys())}")
        return

    src = GAME_SPRITES[game]
    process_sprite(src)

    # 如果指定了 --all，处理所有
    if "--all" in sys.argv:
        for name, path in GAME_SPRITES.items():
            if name != game:
                process_sprite(path)


if __name__ == "__main__":
    main()
