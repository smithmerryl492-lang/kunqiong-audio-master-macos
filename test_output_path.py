"""
测试输出路径处理功能
验证C盘权限问题的修复
"""
import sys
import os

# 添加backend目录到路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from routers.utils import prepare_output_directory

def test_prepare_output_directory():
    """测试输出目录准备函数"""
    print("=" * 60)
    print("测试输出目录准备功能")
    print("=" * 60)
    
    # 测试1: 正常可写目录
    print("\n测试1: 使用临时目录（应该成功）")
    import tempfile
    temp_dir = tempfile.gettempdir()
    test_dir = os.path.join(temp_dir, "test_audio_output")
    result_dir, is_fallback = prepare_output_directory(test_dir, temp_dir)
    print(f"  输入目录: {test_dir}")
    print(f"  结果目录: {result_dir}")
    print(f"  是否回退: {is_fallback}")
    print(f"  ✓ 测试通过" if not is_fallback else "  ✗ 意外回退")
    
    # 测试2: C盘根目录（可能无权限）
    print("\n测试2: 使用C盘根目录（可能无权限）")
    c_root = "C:\\test_audio_output"
    result_dir, is_fallback = prepare_output_directory(c_root, temp_dir)
    print(f"  输入目录: {c_root}")
    print(f"  结果目录: {result_dir}")
    print(f"  是否回退: {is_fallback}")
    if is_fallback:
        print(f"  ✓ 正确回退到临时目录")
    else:
        print(f"  ✓ 成功使用C盘目录（有权限）")
    
    # 测试3: 空路径（使用默认）
    print("\n测试3: 空路径（应使用默认目录）")
    result_dir, is_fallback = prepare_output_directory("", temp_dir)
    print(f"  输入目录: (空)")
    print(f"  默认目录: {temp_dir}")
    print(f"  结果目录: {result_dir}")
    print(f"  是否回退: {is_fallback}")
    print(f"  ✓ 测试通过" if not is_fallback else "  ✗ 意外回退")
    
    # 测试4: 不存在的驱动器
    print("\n测试4: 不存在的驱动器（应该回退）")
    invalid_drive = "Z:\\nonexistent\\path"
    result_dir, is_fallback = prepare_output_directory(invalid_drive, temp_dir)
    print(f"  输入目录: {invalid_drive}")
    print(f"  结果目录: {result_dir}")
    print(f"  是否回退: {is_fallback}")
    print(f"  ✓ 正确回退" if is_fallback else "  ✗ 应该回退但没有")
    
    print("\n" + "=" * 60)
    print("测试完成")
    print("=" * 60)

if __name__ == "__main__":
    test_prepare_output_directory()
