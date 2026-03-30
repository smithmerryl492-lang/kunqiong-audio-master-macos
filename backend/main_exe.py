"""
打包用入口文件 - 用于 PyInstaller 打包
"""
import os
import sys
import logging

# 修复 Windows 下无控制台时的日志问题
if sys.platform == 'win32':
    # 当没有控制台时，重定向 stdout/stderr 到 devnull
    if sys.stdout is None:
        sys.stdout = open(os.devnull, 'w')
    if sys.stderr is None:
        sys.stderr = open(os.devnull, 'w')

# 设置工作目录为 exe 所在目录
if getattr(sys, 'frozen', False):
    # 打包后运行
    application_path = os.path.dirname(sys.executable)
    os.chdir(application_path)
    
    # 设置资源路径
    if hasattr(sys, '_MEIPASS'):
        os.environ['RESOURCE_PATH'] = sys._MEIPASS
    else:
        os.environ['RESOURCE_PATH'] = application_path
else:
    # 开发模式
    application_path = os.path.dirname(os.path.abspath(__file__))
    os.environ['RESOURCE_PATH'] = application_path

# 配置基本日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# 导入并启动服务
import uvicorn
import socket
from main import app  # 直接从 main.py 导入 FastAPI app

def find_free_port(start_port=8001, max_tries=100):
    """查找可用端口"""
    for port in range(start_port, start_port + max_tries):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except socket.error:
                continue
    return start_port

if __name__ == '__main__':
    # 获取命令行指定的端口或查找可用端口
    port = None
    for i, arg in enumerate(sys.argv):
        if arg == "--port" and i + 1 < len(sys.argv):
            try:
                port = int(sys.argv[i+1])
                print(f"使用命令行指定端口: {port}")
                break
            except ValueError:
                print(f"无效的端口参数: {sys.argv[i+1]}")
    
    if port is None:
        port = find_free_port(8001)
        print(f"未指定端口，使用自动查找的端口: {port}")

    print(f"后端服务启动中...")
    print(f"工作目录: {os.getcwd()}")
    print(f"资源路径: {os.environ.get('RESOURCE_PATH', 'N/A')}")
    print(f"端口: {port}")
    
    # 使用简化的日志配置，避免 isatty 问题
    uvicorn.run(
        app,
        host='127.0.0.1',
        port=port,
        log_level='info',
        access_log=False,  # 禁用访问日志避免问题
        log_config=None    # 使用默认日志配置
    )
