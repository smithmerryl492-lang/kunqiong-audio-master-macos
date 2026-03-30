import os
import requests
import sys
from pathlib import Path
from tqdm import tqdm

def download_file(url: str, dest_path: Path):
    """带进度条的文件下载"""
    response = requests.get(url, stream=True)
    total_size = int(response.headers.get('content-length', 0))
    
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(dest_path, 'wb') as f, tqdm(
        desc=dest_path.name,
        total=total_size,
        unit='iB',
        unit_scale=True,
        unit_divisor=1024,
    ) as bar:
        for data in response.iter_content(chunk_size=1024):
            size = f.write(data)
            bar.update(size)

def main():
    # 模型下载地址 - 使用 sherpa-onnx 项目维护的 Spleeter ONNX 模型
    # 这些模型分为两个文件：vocals.onnx (人声) 和 accompaniment.onnx (伴奏)
    MODEL_URLS = {
        "vocals.onnx": "https://hf-mirror.com/csukuangfj/sherpa-onnx-spleeter-2stems/resolve/main/vocals.onnx",
        "accompaniment.onnx": "https://hf-mirror.com/csukuangfj/sherpa-onnx-spleeter-2stems/resolve/main/accompaniment.onnx"
    }
    
    # 备选 GitHub 代理 (如果 HF 镜像也失效，可以手动更换为以下任一)
    # https://gh-proxy.com/
    # https://ghproxy.cn/
    # https://github.moeyy.xyz/
    
    # 获取项目根目录下的 models 目录
    base_dir = Path(__file__).parent
    models_dir = base_dir / "models" / "audio_separation"
    
    print(f"正在准备下载模型到: {models_dir}")
    
    for name, url in MODEL_URLS.items():
        dest = models_dir / name
        if dest.exists():
            print(f"模型 {name} 已存在，跳过。")
            continue
            
        print(f"正在下载 {name}...")
        try:
            download_file(url, dest)
            print(f"\n{name} 下载完成！")
        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"\n下载 {name} 失败: {e}")

if __name__ == "__main__":
    main()
