"""
资源路径工具 - 支持开发模式和打包后的路径
"""
import os
import sys
from pathlib import Path


def get_base_dir() -> Path:
    """获取应用基础目录"""
    if getattr(sys, 'frozen', False):
        # PyInstaller 打包后
        if hasattr(sys, '_MEIPASS'):
            return Path(sys._MEIPASS)
        return Path(os.path.dirname(sys.executable))
    else:
        # 开发模式
        return Path(__file__).parent.parent


def get_resource_path(relative_path: str) -> Path:
    """获取资源文件路径"""
    # 优先使用环境变量（Electron 设置）
    resource_path = os.environ.get('RESOURCE_PATH')
    if resource_path:
        return Path(resource_path) / relative_path
    
    return get_base_dir() / relative_path


def get_bgm_dir() -> Path:
    """获取 BGM 目录"""
    return get_resource_path('bgm')


def get_effects_dir() -> Path:
    """获取音效目录"""
    return get_resource_path('effects')


def get_models_dir() -> Path:
    """获取模型目录"""
    return get_resource_path('models')


def get_upload_dir() -> Path:
    """获取上传目录（可写）"""
    import tempfile
    upload_dir = Path(tempfile.gettempdir()) / 'audio_converter_uploads'
    upload_dir.mkdir(exist_ok=True)
    return upload_dir


def get_output_dir() -> Path:
    """获取输出目录（可写）"""
    from .config import OUTPUT_DIR
    output_dir = Path(OUTPUT_DIR)
    output_dir.mkdir(exist_ok=True)
    return output_dir
