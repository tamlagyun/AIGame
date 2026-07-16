# 通用图片处理工具

这些脚本不包含任何游戏项目名称、资源目录或固定文件名。运行前需安装 Pillow：`python -m pip install Pillow`。

## UI 透明边距归一化

```powershell
python Tools/image-processing/normalize_ui_art.py source/button.png --output-dir output/ui --size 1024 --padding 0.08
```

默认不覆盖原图；仅在确认需要原地修改时使用 `--overwrite`。

## AI 地图与绿幕精灵图处理

```powershell
python Tools/image-processing/process_generated_art.py `
  --background source/map.png --background-output output/map.png --background-size 2048 1152 `
  --sprite-sheet source/fish-sheet.png --frames-output-dir output/fish `
  --columns 3 --rows 2 --frame-size 256 --frame-prefix swim-
```

地图与精灵图参数可以单独使用。精灵图按行优先输出；默认文件名为 `frame-0.png` 到 `frame-N.png`，可用 `--frame-prefix` 修改。

默认只保留最大连通主体，适合单一角色。攻击动作等包含分离的水花、甩动线或能量效果时，增加 `--keep-all-foreground` 以保留全部非绿幕前景。
