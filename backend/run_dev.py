"""
开发模式启动脚本
同时启动后端 API 服务器
前端需要单独运行 npm run dev
"""
import uvicorn
import socket
import sys

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

if __name__ == "__main__":
    # 获取命令行指定的端口或查找可用端口
    port = 8001
    for i, arg in enumerate(sys.argv):
        if arg == "--port" and i + 1 < len(sys.argv):
            port = int(sys.argv[i+1])
            break
    else:
        port = find_free_port(8001)

    print("=" * 50)
    print("鲲穹AI音频转换器后端服务启动中...")
    print(f"API 地址: http://127.0.0.1:{port}")
    print(f"API 文档: http://127.0.0.1:{port}/docs")
    print("=" * 50)
    print("\n请确保前端已启动: cd 鲲穹AI音频转换器 && npm run dev\n")
    
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=port,
        reload=True,
        log_level="info"
    )
