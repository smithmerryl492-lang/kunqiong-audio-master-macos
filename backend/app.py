"""
桌面应用入口
使用 PyWebView 加载前端页面，同时启动 FastAPI 后端
"""
import webview
import threading
import uvicorn
import os
import sys

# 获取应用根目录
if getattr(sys, 'frozen', False):
    # 打包后的路径
    BASE_DIR = os.path.dirname(sys.executable)
else:
    # 开发环境路径
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# 前端构建文件目录
FRONTEND_DIR = os.path.join(BASE_DIR, "dist")


import socket

def find_free_port(start_port=8001, max_tries=100):
    for port in range(start_port, start_port + max_tries):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except socket.error:
                continue
    return start_port

def start_server():
    """启动 FastAPI 服务器"""
    from main import app
    port = find_free_port(8001)
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")


def main():
    # 在后台线程启动 API 服务器
    # 注意：这里可能需要某种方式把端口传给前端，但 app.py 使用的是 PyWebView
    # 为了简单起见，这里暂不深入修改，因为主要使用 Electron
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()
    
    # 等待服务器启动
    import time
    time.sleep(1)
    
    # 创建窗口
    # 开发模式下连接 Vite 开发服务器，生产模式加载构建文件
    if os.path.exists(FRONTEND_DIR):
        # 生产模式：加载构建后的前端文件
        window = webview.create_window(
            title="鲲穹AI音频转换器",
            url=os.path.join(FRONTEND_DIR, "index.html"),
            width=1200,
            height=800,
            min_size=(1000, 600),
            resizable=True
        )
    else:
        # 开发模式：连接 Vite 开发服务器
        window = webview.create_window(
            title="鲲穹AI音频转换器",
            url="http://localhost:5173",
            width=1200,
            height=800,
            min_size=(1000, 600),
            resizable=True
        )
    
    webview.start()


if __name__ == "__main__":
    main()
