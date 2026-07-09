#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
即梦AI图片生成客户端 - 通过火山引擎官方SDK调用即梦AI
用法: python jimeng_client.py text2image "提示词" [--size 512] [--count 1]
"""
import argparse, base64, json, sys, time, urllib.request
from pathlib import Path

try:
    from volcengine.visual.VisualService import VisualService
except ImportError:
    print("请安装火山引擎SDK: pip install volcengine", file=sys.stderr)
    sys.exit(1)

class JimengClient:
    DEFAULT_MODEL = "jimeng_t2i_v40"
    
    def __init__(self, ak, sk):
        self.visual_service = VisualService()
        self.visual_service.set_ak(ak)
        self.visual_service.set_sk(sk)
    
    def generate(self, prompt, output="./output", model=None, width=512, height=512, count=1, timeout=300, interval=5):
        Path(output).mkdir(parents=True, exist_ok=True)
        model = model or self.DEFAULT_MODEL
        
        # 提交异步任务
        body = {
            "req_key": model,
            "prompt": prompt,
            "width": width,
            "height": height,
        }
        
        print(f"提交任务: {prompt[:50]}...")
        try:
            resp = self.visual_service.cv_sync2async_submit_task(body)
        except Exception as e:
            print(f"提交失败: {e}", file=sys.stderr)
            return []
        
        if resp.get("code") != 10000:
            print(f"提交失败: code={resp.get('code')}, msg={resp.get('message')}", file=sys.stderr)
            return []
        
        task_id = resp["data"]["task_id"]
        print(f"任务ID: {task_id}")
        
        # 轮询获取结果
        t0 = time.time()
        while time.time() - t0 < timeout:
            time.sleep(interval)
            try:
                query_body = {"req_key": model, "task_id": task_id, "return_url": True}
                resp = self.visual_service.cv_sync2async_get_result(query_body)
            except Exception as e:
                print(f"查询异常: {e}", file=sys.stderr)
                continue
            
            if resp.get("code") != 10000:
                print(f"查询异常: code={resp.get('code')}", file=sys.stderr)
                continue
            
            data = resp.get("data", {})
            status = data.get("status", "")
            
            if status == "done":
                paths = []
                # 方式1: base64图片数据
                b64_list = data.get("binary_data_base64", []) or []
                if b64_list:
                    import base64 as b64mod
                    for i, b64_str in enumerate(b64_list):
                        try:
                            img_data = b64mod.b64decode(b64_str)
                            p = Path(output) / f"jimeng_{int(time.time())}_{i+1}.png"
                            p.write_bytes(img_data)
                            paths.append(str(p))
                            print(f"保存: {p}")
                        except Exception as e:
                            print(f"Base64解码失败: {e}", file=sys.stderr)
                # 方式2: URL下载
                image_urls = data.get("image_urls") or []
                if not image_urls:
                    resp_json = data.get("resp_json", "")
                    if resp_json:
                        try:
                            rj = json.loads(resp_json) if isinstance(resp_json, str) else resp_json
                            image_urls = rj.get("image_urls", [])
                        except:
                            pass
                for i, url in enumerate(image_urls):
                    try:
                        with urllib.request.urlopen(url, timeout=60) as r:
                            p = Path(output) / f"jimeng_{int(time.time())}_{i+1}.png"
                            p.write_bytes(r.read())
                            paths.append(str(p))
                            print(f"保存: {p}")
                    except Exception as e:
                        print(f"下载失败: {e}", file=sys.stderr)
                return paths
            elif status == "failed":
                print(f"任务失败: {data.get('message', 'unknown')}", file=sys.stderr)
                return []
            else:
                print(f"进行中... ({int(time.time()-t0)}s)")
        
        print("超时", file=sys.stderr)
        return []

def load_config(path=None):
    p = Path(path) if path else Path(__file__).parent.parent / "config" / "config.json"
    if not p.exists():
        print(f"配置不存在: {p}", file=sys.stderr)
        print('请创建: {"access_key":"...","secret_key":"..."}')
        sys.exit(1)
    return json.loads(p.read_text())

def main():
    ap = argparse.ArgumentParser(description="即梦AI图片生成")
    sub = ap.add_subparsers(dest="cmd")
    t2i = sub.add_parser("text2image", help="文生图")
    t2i.add_argument("prompt", help="图片描述")
    t2i.add_argument("--model", default=None, help="模型版本")
    t2i.add_argument("--width", type=int, default=1024, help="图片宽度")
    t2i.add_argument("--height", type=int, default=1024, help="图片高度")
    t2i.add_argument("--count", type=int, default=1, help="数量")
    t2i.add_argument("--output", default="./output", help="输出目录")
    t2i.add_argument("--config", default=None, help="配置文件路径")
    args = ap.parse_args()
    
    if args.cmd == "text2image":
        c = load_config(args.config)
        client = JimengClient(c["access_key"], c["secret_key"])
        client.generate(args.prompt, args.output, args.model, args.width, args.height, args.count)
    else:
        ap.print_help()

if __name__ == "__main__":
    main()
