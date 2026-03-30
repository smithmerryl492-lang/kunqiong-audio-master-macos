"""
验证所有路由文件是否正确导入和使用 prepare_output_directory
"""
import os
import re

def check_file(filepath):
    """检查单个文件"""
    if not os.path.exists(filepath):
        return None, "文件不存在"
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    issues = []
    
    # 检查是否有 output_path 参数
    has_output_path = 'output_path' in content
    
    if not has_output_path:
        return "✓", "无需处理（不使用output_path）"
    
    # 检查是否导入了 prepare_output_directory
    has_import = 'prepare_output_directory' in content
    
    # 检查是否使用了 prepare_output_directory
    has_usage = re.search(r'prepare_output_directory\s*\(', content)
    
    # 检查是否还有旧的模式
    old_pattern1 = re.search(r'save_dir\s*=\s*output_path\s+if\s+output_path\s+else\s+OUTPUT_DIR', content)
    old_pattern2 = re.search(r'if\s+output_path:\s*\n\s+final_output_dir\s*=\s*output_path', content)
    old_pattern3 = re.search(r'os\.makedirs\(save_dir,\s*exist_ok=True\)', content)
    
    status = "✓"
    details = []
    
    if not has_import:
        status = "⚠️"
        issues.append("缺少导入")
    
    if not has_usage:
        status = "⚠️"
        issues.append("未使用函数")
    
    if old_pattern1:
        status = "⚠️"
        issues.append("存在旧模式1")
    
    if old_pattern2:
        status = "⚠️"
        issues.append("存在旧模式2")
    
    if old_pattern3 and has_usage:
        # 如果使用了新函数但还有makedirs，可能是多余的
        status = "⚠️"
        issues.append("可能有多余的makedirs")
    
    if status == "✓":
        details.append("已正确更新")
    else:
        details.extend(issues)
    
    return status, ", ".join(details)

def main():
    # 所有需要检查的路由文件
    router_files = [
        'backend/routers/audio_bgm.py',
        'backend/routers/audio_compress.py',
        'backend/routers/audio_convert.py',
        'backend/routers/audio_cover.py',
        'backend/routers/audio_cut.py',
        'backend/routers/audio_denoise.py',
        'backend/routers/audio_echo.py',
        'backend/routers/audio_equalizer.py',
        'backend/routers/audio_fade.py',
        'backend/routers/audio_merge.py',
        'backend/routers/audio_record.py',
        'backend/routers/audio_reverse.py',
        'backend/routers/audio_silence.py',
        'backend/routers/audio_speed.py',
        'backend/routers/audio_to_text.py',
        'backend/routers/noise_generator.py',
        'backend/routers/sound_effect.py',
        'backend/routers/text_to_speech.py',
        'backend/routers/video_extract.py',
        'backend/routers/video_remove_vocal.py',
        'backend/routers/video_replace_audio.py',
        'backend/routers/vocal_enhance.py',
        'backend/routers/vocal_extract.py',
        'backend/routers/voice_change.py',
        'backend/routers/volume_adjust.py',
    ]
    
    print("=" * 80)
    print("验证路由文件更新状态")
    print("=" * 80)
    print()
    
    results = {}
    for filepath in router_files:
        status, details = check_file(filepath)
        results[filepath] = (status, details)
        filename = os.path.basename(filepath)
        print(f"{status} {filename:30s} - {details}")
    
    print()
    print("=" * 80)
    
    # 统计
    success_count = sum(1 for s, _ in results.values() if s == "✓")
    warning_count = sum(1 for s, _ in results.values() if s == "⚠️")
    error_count = sum(1 for s, _ in results.values() if s is None)
    
    print(f"总计: {len(router_files)} 个文件")
    print(f"  ✓ 正常: {success_count}")
    print(f"  ⚠️ 警告: {warning_count}")
    print(f"  ❌ 错误: {error_count}")
    print("=" * 80)
    
    if warning_count > 0:
        print()
        print("⚠️ 警告的文件需要手动检查:")
        for filepath, (status, details) in results.items():
            if status == "⚠️":
                print(f"  - {os.path.basename(filepath)}: {details}")

if __name__ == "__main__":
    main()
