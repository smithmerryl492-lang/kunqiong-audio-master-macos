"""
共享配置模块
统一管理上传和输出目录
"""
import os
import platform
import tempfile
from pathlib import Path

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")

# 默认输出文件夹名称
DEFAULT_FOLDER_NAME = "音频处理大师"


def get_desktop_path() -> str:
    """
    跨平台获取桌面路径
    """
    system = platform.system()
    
    if system == "Windows":
        # Windows: 尝试从注册表获取，否则使用默认路径
        try:
            import winreg
            key = winreg.OpenKey(
                winreg.HKEY_CURRENT_USER,
                r"Software\Microsoft\Windows\CurrentVersion\Explorer\Shell Folders"
            )
            desktop = winreg.QueryValueEx(key, "Desktop")[0]
            winreg.CloseKey(key)
            return desktop
        except:
            pass
        # 降级方案
        return os.path.join(os.path.expanduser("~"), "Desktop")
    
    elif system == "Darwin":  # macOS
        return os.path.join(os.path.expanduser("~"), "Desktop")
    
    else:  # Linux 和其他系统
        # 尝试使用 XDG 规范
        try:
            import subprocess
            result = subprocess.run(
                ["xdg-user-dir", "DESKTOP"],
                capture_output=True,
                text=True
            )
            if result.returncode == 0 and result.stdout.strip():
                return result.stdout.strip()
        except:
            pass
        return os.path.join(os.path.expanduser("~"), "Desktop")


# 默认输出到桌面的专用文件夹
_desktop = get_desktop_path()
OUTPUT_DIR = os.path.join(_desktop, DEFAULT_FOLDER_NAME)

# 确保目录存在
os.makedirs(UPLOAD_DIR, exist_ok=True)
try:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
except PermissionError:
    # 如果没有权限创建桌面文件夹，使用当前目录
    OUTPUT_DIR = os.path.join(os.getcwd(), DEFAULT_FOLDER_NAME)
    os.makedirs(OUTPUT_DIR, exist_ok=True)


def get_output_dir(output_path: str = "") -> str:
    """
    获取输出目录
    
    参数:
    - output_path: 自定义输出路径，如果为空则使用默认路径
    
    返回:
    - 有效的输出目录路径
    
    逻辑:
    1. 如果提供了自定义路径且是有效目录，使用自定义路径
    2. 如果自定义路径不存在但父目录存在，尝试创建
    3. 否则使用默认输出目录
    """
    if output_path:
        # 规范化路径
        output_path = os.path.normpath(output_path)
        
        # 如果目录已存在，直接使用
        if os.path.isdir(output_path):
            return output_path
        
        # 如果目录不存在，尝试创建
        try:
            os.makedirs(output_path, exist_ok=True)
            return output_path
        except (PermissionError, OSError):
            # 创建失败，使用默认目录
            pass
    
    return OUTPUT_DIR


def get_original_file_dir(file_path: str) -> str:
    """
    获取文件的原始目录
    
    参数:
    - file_path: 文件的完整路径
    
    返回:
    - 文件所在的目录路径
    """
    if not file_path:
        return OUTPUT_DIR
    
    dir_path = os.path.dirname(file_path)
    if dir_path and os.path.isdir(dir_path):
        return dir_path
    
    return OUTPUT_DIR
