"""
Windows目录权限测试
直观展示不同目录的写入权限情况
"""
import os
import tempfile
import uuid

def test_write_permission(path, description):
    """测试目录写入权限"""
    print(f"\n测试: {description}")
    print(f"路径: {path}")
    
    # 检查目录是否存在
    if not os.path.exists(path):
        print(f"结果: ❌ 目录不存在")
        return False
    
    # 尝试创建测试文件
    test_file = os.path.join(path, f".write_test_{uuid.uuid4()}.tmp")
    
    try:
        with open(test_file, 'w', encoding='utf-8') as f:
            f.write("权限测试")
        
        # 成功创建，尝试删除
        try:
            os.remove(test_file)
            print(f"结果: ✅ 有写入权限")
            return True
        except Exception as e:
            print(f"结果: ⚠️  可以创建但无法删除: {e}")
            return True
            
    except PermissionError as e:
        print(f"结果: ❌ 权限被拒绝")
        print(f"错误: {e}")
        return False
    except Exception as e:
        print(f"结果: ❌ 其他错误")
        print(f"错误: {e}")
        return False

def main():
    print("=" * 70)
    print("Windows 目录权限测试")
    print("=" * 70)
    
    # 获取当前用户名
    username = os.environ.get('USERNAME', 'admin')
    user_home = os.path.expanduser('~')
    
    print(f"\n当前用户: {username}")
    print(f"用户主目录: {user_home}")
    
    # 测试用例
    test_cases = [
        # 系统目录（通常无权限）
        ("C:\\", "C盘根目录（通常需要管理员权限）"),
        ("C:\\Windows", "Windows系统目录（需要管理员权限）"),
        ("C:\\Program Files", "Program Files目录（需要管理员权限）"),
        
        # 用户目录（通常有权限）
        (os.path.join(user_home, "Desktop"), "用户桌面（应该有权限）"),
        (os.path.join(user_home, "Documents"), "用户文档（应该有权限）"),
        (os.path.join(user_home, "Downloads"), "用户下载（应该有权限）"),
        (os.path.join(user_home, "Music"), "用户音乐（应该有权限）"),
        
        # 临时目录（通常有权限）
        (tempfile.gettempdir(), "系统临时目录（应该有权限）"),
        (os.path.join(user_home, "AppData", "Local", "Temp"), "用户临时目录（应该有权限）"),
    ]
    
    # 执行测试
    results = []
    for path, description in test_cases:
        has_permission = test_write_permission(path, description)
        results.append((path, description, has_permission))
    
    # 统计结果
    print("\n" + "=" * 70)
    print("测试结果汇总")
    print("=" * 70)
    
    success_count = sum(1 for _, _, result in results if result)
    fail_count = len(results) - success_count
    
    print(f"\n总测试数: {len(results)}")
    print(f"✅ 有权限: {success_count}")
    print(f"❌ 无权限: {fail_count}")
    
    # 推荐目录
    print("\n" + "=" * 70)
    print("推荐使用的输出目录")
    print("=" * 70)
    
    recommended = [
        (os.path.join(user_home, "Desktop", "音频处理大师"), "桌面子文件夹"),
        (os.path.join(user_home, "Documents", "音频处理大师"), "文档子文件夹"),
        (os.path.join(user_home, "Music", "音频处理大师"), "音乐子文件夹"),
    ]
    
    for path, desc in recommended:
        print(f"\n✅ {desc}")
        print(f"   路径: {path}")
    
    # 不推荐的目录
    print("\n" + "=" * 70)
    print("不推荐使用的目录（可能无权限）")
    print("=" * 70)
    
    not_recommended = [
        ("C:\\", "C盘根目录"),
        ("C:\\AudioOutput", "C盘根目录下的子文件夹"),
        ("C:\\Windows\\...", "Windows系统目录"),
        ("C:\\Program Files\\...", "程序安装目录"),
    ]
    
    for path, desc in not_recommended:
        print(f"\n❌ {desc}")
        print(f"   路径: {path}")
        print(f"   原因: 需要管理员权限")
    
    # 解决方案说明
    print("\n" + "=" * 70)
    print("我们的解决方案")
    print("=" * 70)
    
    print("""
1. 自动检测权限
   - 在写入前先验证目录是否可写
   - 通过创建测试文件来确认权限

2. 智能回退机制
   - 如果用户选择的目录无权限
   - 自动回退到临时目录
   - 确保操作能够完成

3. 明确提示
   - 告知用户实际保存位置
   - 如果发生回退，显示警告信息
   - 提供打开文件夹的选项

4. 回退目录
   - Windows: C:\\Users\\[用户名]\\AppData\\Local\\Temp\\audio_converter_output
   - 用户有完全控制权
   - 确保文件能够保存成功
    """)
    
    print("=" * 70)
    print("测试完成")
    print("=" * 70)

if __name__ == "__main__":
    main()
