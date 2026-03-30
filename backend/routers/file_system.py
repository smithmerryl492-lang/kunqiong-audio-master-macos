from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os
import subprocess
import tkinter as tk
from tkinter import filedialog
import threading
import platform
import stat

router = APIRouter()

# 默认输出文件夹名称
DEFAULT_FOLDER_NAME = "音频处理大师"


class DirectoryRequest(BaseModel):
    path: str = ""


class ValidatePathRequest(BaseModel):
    path: str


# 存储选择的路径
selected_path_result = {"path": "", "done": False}


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
                text=True,
                encoding='utf-8',
                errors='replace'
            )
            if result.returncode == 0 and result.stdout.strip():
                return result.stdout.strip()
        except:
            pass
        return os.path.join(os.path.expanduser("~"), "Desktop")


def check_directory_writable(path: str) -> tuple[bool, str]:
    """
    检查目录是否可写
    返回: (是否可写, 错误信息)
    """
    try:
        # 如果目录不存在，检查父目录是否可写
        if not os.path.exists(path):
            parent = os.path.dirname(path)
            if not parent:
                parent = "."
            if not os.path.exists(parent):
                return False, "父目录不存在"
            if not os.access(parent, os.W_OK):
                return False, "没有权限在父目录创建文件夹"
            return True, ""
        
        # 目录存在，检查是否可写
        if not os.path.isdir(path):
            return False, "路径不是目录"
        
        if not os.access(path, os.W_OK):
            return False, "没有写入权限"
        
        # 尝试创建临时文件来验证
        test_file = os.path.join(path, ".write_test_" + str(os.getpid()))
        try:
            with open(test_file, 'w') as f:
                f.write("test")
            os.remove(test_file)
            return True, ""
        except PermissionError:
            return False, "没有写入权限"
        except Exception as e:
            return False, f"写入测试失败: {str(e)}"
            
    except Exception as e:
        return False, f"检查权限失败: {str(e)}"


def validate_path_characters(path: str) -> tuple[bool, str]:
    """
    验证路径是否包含非法字符
    """
    if not path:
        return False, "路径不能为空"
    
    # Windows 非法字符 (冒号在驱动器号后是允许的)
    if platform.system() == "Windows":
        # 检查驱动器号后的部分
        if len(path) > 2 and path[1] == ':':
            check_path = path[2:]
        else:
            check_path = path
        
        invalid_chars = '<>"|?*'
        for char in invalid_chars:
            if char in check_path:
                return False, f"路径包含非法字符: {char}"
    
    return True, ""


def validate_path_length(path: str) -> tuple[bool, str]:
    """
    验证路径长度是否超过系统限制
    """
    max_length = 260 if platform.system() == "Windows" else 4096
    
    if len(path) > max_length:
        return False, f"路径长度超过系统限制 ({max_length} 字符)"
    
    return True, ""


def run_folder_dialog(initial_dir: str = None):
    """在单独线程中运行文件夹选择对话框"""
    global selected_path_result
    try:
        root = tk.Tk()
        root.withdraw()  # 隐藏主窗口
        
        # 使用更强的方法确保对话框显示在最前面
        try:
            # 获取屏幕尺寸并居中显示
            screen_width = root.winfo_screenwidth()
            screen_height = root.winfo_screenheight()
            
            # 设置窗口位置在屏幕中央
            x = screen_width // 2 - 300
            y = screen_height // 2 - 200
            root.geometry(f"+{x}+{y}")
            
            # 使用 Windows API 强制置顶
            if platform.system() == "Windows":
                try:
                    import ctypes
                    # 获取窗口句柄
                    root.update()
                    hwnd = ctypes.windll.user32.GetParent(root.winfo_id())
                    if hwnd == 0:
                        hwnd = root.winfo_id()
                    
                    # 使用 SetWindowPos 强制置顶
                    # HWND_TOPMOST = -1
                    # SWP_NOMOVE | SWP_NOSIZE = 0x0003
                    ctypes.windll.user32.SetWindowPos(
                        hwnd, -1, 0, 0, 0, 0, 0x0003
                    )
                    
                    # 激活窗口
                    ctypes.windll.user32.SetForegroundWindow(hwnd)
                except Exception as e:
                    print(f"Windows API 设置失败: {e}")
                    # 回退到 tkinter 方法
                    root.attributes('-topmost', True)
            else:
                root.attributes('-topmost', True)
            
            root.update()
            root.lift()
            root.focus_force()
            
        except Exception as e:
            print(f"设置窗口位置失败: {e}")
            # 确保至少尝试置顶
            try:
                root.attributes('-topmost', True)
                root.update()
            except:
                pass
        
        # 使用提供的初始目录或默认用户目录
        init_dir = initial_dir if initial_dir and os.path.exists(initial_dir) else os.path.expanduser("~")
        
        # 打开对话框
        folder_path = filedialog.askdirectory(
            title="选择输出目录",
            initialdir=init_dir,
            parent=root
        )
        
        # 取消置顶并销毁窗口
        try:
            if platform.system() == "Windows":
                try:
                    import ctypes
                    hwnd = root.winfo_id()
                    # HWND_NOTOPMOST = -2
                    ctypes.windll.user32.SetWindowPos(
                        hwnd, -2, 0, 0, 0, 0, 0x0003
                    )
                except:
                    root.attributes('-topmost', False)
            else:
                root.attributes('-topmost', False)
        except:
            pass
        
        root.destroy()
        
        selected_path_result["path"] = folder_path if folder_path else ""
        selected_path_result["done"] = True
    except Exception as e:
        print(f"对话框错误: {e}")
        import traceback
        traceback.print_exc()
        selected_path_result["path"] = ""
        selected_path_result["done"] = True


@router.post("/select-directory")
async def select_directory(request: DirectoryRequest):
    """
    打开系统文件夹选择对话框
    """
    global selected_path_result
    selected_path_result = {"path": "", "done": False}
    
    try:
        # 使用请求中的路径作为初始目录
        initial_dir = request.path if request.path else None
        
        # 在新线程中运行对话框
        thread = threading.Thread(target=run_folder_dialog, args=(initial_dir,))
        thread.start()
        thread.join(timeout=120)  # 等待最多120秒
        
        if selected_path_result["done"] and selected_path_result["path"]:
            path = selected_path_result["path"]
            
            # 验证选择的路径
            valid, error = check_directory_writable(path)
            if not valid:
                return {
                    "success": False, 
                    "path": path, 
                    "message": f"目录不可写: {error}",
                    "writable": False
                }
            
            return {
                "success": True, 
                "path": path,
                "writable": True
            }
        else:
            return {"success": False, "path": "", "message": "未选择目录或超时"}
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/open-folder")
async def open_folder(request: DirectoryRequest):
    """
    在资源管理器中打开指定文件夹
    """
    try:
        path = request.path
        
        print(f"[open-folder] 收到请求，路径: {path}")
        
        # 如果路径为空，使用默认输出目录
        if not path:
            desktop = get_desktop_path()
            path = os.path.join(desktop, DEFAULT_FOLDER_NAME)
            print(f"[open-folder] 路径为空，使用默认路径: {path}")
        
        # 规范化路径
        path = os.path.normpath(path)
        print(f"[open-folder] 规范化后的路径: {path}")
        
        # 如果路径是文件，获取其父目录
        if os.path.isfile(path):
            path = os.path.dirname(path)
            print(f"[open-folder] 路径是文件，使用父目录: {path}")
        
        if not os.path.exists(path):
            # 如果路径不存在，尝试创建
            print(f"[open-folder] 路径不存在，尝试创建: {path}")
            try:
                os.makedirs(path, exist_ok=True)
                print(f"[open-folder] 目录创建成功: {path}")
            except PermissionError:
                error_msg = f"没有权限创建目录: {path}"
                print(f"[open-folder] 错误: {error_msg}")
                return {"success": False, "message": error_msg, "path": path}
            except Exception as e:
                error_msg = f"创建目录失败: {str(e)}"
                print(f"[open-folder] 错误: {error_msg}")
                return {"success": False, "message": error_msg, "path": path}
        
        # 跨平台打开文件夹
        system = platform.system()
        print(f"[open-folder] 操作系统: {system}")
        
        try:
            if system == "Windows":
                # 使用 explorer.exe 更可靠
                print(f"[open-folder] 使用 explorer.exe 打开: {path}")
                try:
                    # 方法1: 使用 /select,path 参数（选中目录并打开新窗口，通常会置顶）
                    # 注意：如果目录已经打开，这可能会只激活现有窗口
                    # 使用 /n, 强制打开新窗口
                    subprocess.Popen(f'explorer /n,"{path}"', shell=True)
                    print(f"[open-folder] explorer.exe 命令已执行（新窗口模式）")
                except Exception as e1:
                    print(f"[open-folder] 方法1失败: {e1}, 尝试方法2")
                    try:
                        # 方法2: 使用 os.startfile
                        os.startfile(path)
                        print(f"[open-folder] os.startfile 执行成功")
                    except Exception as e2:
                        print(f"[open-folder] 方法2失败: {e2}, 尝试方法3")
                        # 方法3: 使用 shell=True
                        subprocess.run(f'explorer "{path}"', shell=True, check=False)
                        print(f"[open-folder] shell命令执行成功")
            elif system == "Darwin":  # macOS
                print(f"[open-folder] 使用 open 命令打开: {path}")
                subprocess.Popen(["open", path])
            else:  # Linux
                print(f"[open-folder] 使用 xdg-open 命令打开: {path}")
                subprocess.Popen(["xdg-open", path])
            
            print(f"[open-folder] 成功打开文件夹: {path}")
            return {"success": True, "message": "已打开文件夹", "path": path}
        except Exception as e:
            error_msg = f"打开文件夹失败: {str(e)}"
            print(f"[open-folder] 错误: {error_msg}")
            import traceback
            traceback.print_exc()
            return {"success": False, "message": error_msg, "path": path}
        
    except Exception as e:
        error_msg = f"处理请求失败: {str(e)}"
        print(f"[open-folder] 异常: {error_msg}")
        import traceback
        traceback.print_exc()
        return {"success": False, "message": error_msg}


@router.get("/default-output-path")
async def get_default_output_path():
    """
    获取默认输出路径（桌面上的音频处理大师文件夹）
    自动检测并创建目录
    """
    try:
        desktop = get_desktop_path()
        output_dir = os.path.join(desktop, DEFAULT_FOLDER_NAME)
        
        # 检查目录是否存在
        exists = os.path.exists(output_dir)
        
        # 如果不存在，尝试创建
        if not exists:
            try:
                os.makedirs(output_dir, exist_ok=True)
                exists = True
            except PermissionError:
                return {
                    "path": output_dir,
                    "exists": False,
                    "writable": False,
                    "error": "没有权限创建目录"
                }
            except Exception as e:
                return {
                    "path": output_dir,
                    "exists": False,
                    "writable": False,
                    "error": str(e)
                }
        
        # 检查是否可写
        writable, error = check_directory_writable(output_dir)
        
        return {
            "path": output_dir,
            "exists": exists,
            "writable": writable,
            "error": error if not writable else None
        }
        
    except Exception as e:
        # 降级方案：使用当前工作目录
        fallback = os.getcwd()
        return {
            "path": fallback,
            "exists": True,
            "writable": True,
            "error": f"获取桌面路径失败，使用当前目录: {str(e)}"
        }


@router.post("/validate-path")
async def validate_path(request: ValidatePathRequest):
    """
    验证路径的有效性
    检查：路径字符、路径长度、目录是否存在、是否可写
    """
    path = request.path
    
    if not path:
        return {
            "valid": False,
            "exists": False,
            "writable": False,
            "error": "路径不能为空"
        }
    
    # 规范化路径
    path = os.path.normpath(path)
    
    # 验证路径字符
    valid, error = validate_path_characters(path)
    if not valid:
        return {
            "valid": False,
            "exists": False,
            "writable": False,
            "error": error
        }
    
    # 验证路径长度
    valid, error = validate_path_length(path)
    if not valid:
        return {
            "valid": False,
            "exists": False,
            "writable": False,
            "error": error
        }
    
    # 检查目录是否存在
    exists = os.path.exists(path) and os.path.isdir(path)
    
    # 检查是否可写
    writable, write_error = check_directory_writable(path)
    
    return {
        "valid": True,
        "exists": exists,
        "writable": writable,
        "error": write_error if not writable else None,
        "normalized_path": path
    }


@router.post("/ensure-directory")
async def ensure_directory(request: DirectoryRequest):
    """
    确保目录存在，如果不存在则创建
    """
    path = request.path
    
    if not path:
        raise HTTPException(status_code=400, detail="路径不能为空")
    
    # 规范化路径
    path = os.path.normpath(path)
    
    # 验证路径
    valid, error = validate_path_characters(path)
    if not valid:
        raise HTTPException(status_code=400, detail=error)
    
    valid, error = validate_path_length(path)
    if not valid:
        raise HTTPException(status_code=400, detail=error)
    
    try:
        if not os.path.exists(path):
            os.makedirs(path, exist_ok=True)
        
        # 验证创建后是否可写
        writable, error = check_directory_writable(path)
        
        return {
            "success": True,
            "path": path,
            "created": not os.path.exists(path),
            "writable": writable,
            "error": error if not writable else None
        }
        
    except PermissionError:
        raise HTTPException(status_code=403, detail="没有权限创建目录")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"创建目录失败: {str(e)}")


@router.get("/file")
async def get_file(path: str):
    """获取文件内容（用于预览）"""
    from fastapi.responses import FileResponse
    
    if not path:
        raise HTTPException(status_code=400, detail="路径为空")
    
    path = os.path.normpath(path)
    
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="文件不存在")
    
    if not os.path.isfile(path):
        raise HTTPException(status_code=400, detail="不是文件")
    
    return FileResponse(path)
