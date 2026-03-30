"""
通用工具函数
"""
import os
import urllib.parse


def decode_filename(filename: str) -> str:
    """
    解码文件名，处理URL编码的中文文件名
    """
    if not filename:
        return filename
    try:
        # 尝试URL解码
        decoded = urllib.parse.unquote(filename)
        return decoded
    except:
        return filename


def get_unique_filename(output_dir: str, filename: str) -> str:
    """
    获取唯一的文件名，如果文件已存在则添加序号
    
    参数:
    - output_dir: 输出目录
    - filename: 原始文件名
    
    返回:
    - 唯一的文件名（不含路径）
    
    示例:
    - test.mp3 -> test.mp3 (如果不存在)
    - test.mp3 -> test(1).mp3 (如果已存在)
    - test.mp3 -> test(2).mp3 (如果 test.mp3 和 test(1).mp3 都存在)
    """
    base_name, ext = os.path.splitext(filename)
    output_path = os.path.join(output_dir, filename)
    
    if not os.path.exists(output_path):
        return filename
    
    # 文件已存在，添加序号
    counter = 1
    while True:
        new_filename = f"{base_name}({counter}){ext}"
        new_path = os.path.join(output_dir, new_filename)
        if not os.path.exists(new_path):
            return new_filename
        counter += 1


def get_unique_filepath(output_dir: str, filename: str) -> str:
    """
    获取唯一的完整文件路径
    
    参数:
    - output_dir: 输出目录
    - filename: 原始文件名
    
    返回:
    - 唯一的完整文件路径
    """
    unique_filename = get_unique_filename(output_dir, filename)
    return os.path.join(output_dir, unique_filename)


def prepare_output_directory(output_path: str, default_dir: str) -> tuple[str, bool]:
    """
    准备输出目录，确保目录存在且可写
    如果指定的目录无法使用，自动回退到系统临时目录
    
    参数:
    - output_path: 用户指定的输出路径（可能为空）
    - default_dir: 默认输出目录
    
    返回:
    - (实际使用的目录路径, 是否发生了回退)
    
    示例:
    >>> prepare_output_directory("C:/MyFolder", "C:/Default")
    ("C:/MyFolder", False)  # 成功使用用户指定的目录
    
    >>> prepare_output_directory("C:/NoPermission", "C:/Default")
    ("C:/Users/.../Temp/audio_converter_output", True)  # 回退到临时目录
    """
    import uuid
    import tempfile
    
    # 确定目标目录
    target_dir = output_path if output_path else default_dir
    
    # Windows 路径规范化
    if os.name == 'nt':
        try:
            target_dir = os.path.normpath(os.path.abspath(target_dir))
        except Exception as e:
            print(f"路径规范化失败: {e}")
    
    # 尝试创建并验证目录
    is_fallback = False
    try:
        # 创建目录
        os.makedirs(target_dir, exist_ok=True)
        print(f"目录已准备: {target_dir}")
        
        # 验证目录是否真的可写（通过创建测试文件）
        test_file = os.path.join(target_dir, f".write_test_{uuid.uuid4()}.tmp")
        try:
            with open(test_file, 'w', encoding='utf-8') as f:
                f.write("test")
            os.remove(test_file)
            print(f"目录写入权限验证成功: {target_dir}")
        except Exception as write_error:
            print(f"目录写入权限验证失败: {target_dir}, 错误: {write_error}")
            raise PermissionError(f"目录不可写: {write_error}")
            
    except Exception as e:
        print(f"创建或验证目录失败: {target_dir}, 错误: {e}")
        # 回退到系统临时目录
        temp_base = tempfile.gettempdir()
        target_dir = os.path.join(temp_base, "audio_converter_output")
        try:
            os.makedirs(target_dir, exist_ok=True)
            is_fallback = True
            print(f"已自动回退到系统临时目录: {target_dir}")
        except Exception as fallback_error:
            # 如果连临时目录都无法创建，使用临时目录本身
            print(f"创建临时子目录失败: {fallback_error}，使用系统临时目录")
            target_dir = temp_base
            is_fallback = True
    
    return target_dir, is_fallback
