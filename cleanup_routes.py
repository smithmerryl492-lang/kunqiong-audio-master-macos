"""
清理路由文件中的多余代码
"""
import os
import re

files_to_clean = [
    'backend/routers/audio_bgm.py',
    'backend/routers/audio_compress.py',
    'backend/routers/audio_cover.py',
    'backend/routers/audio_denoise.py',
    'backend/routers/audio_echo.py',
    'backend/routers/audio_equalizer.py',
    'backend/routers/audio_fade.py',
    'backend/routers/audio_reverse.py',
    'backend/routers/audio_silence.py',
    'backend/routers/audio_speed.py',
    'backend/routers/noise_generator.py',
    'backend/routers/sound_effect.py',
    'backend/routers/video_replace_audio.py',
    'backend/routers/vocal_enhance.py',
    'backend/routers/volume_adjust.py',
]

def clean_file(filepath):
    """清理单个文件"""
    if not os.path.exists(filepath):
        return False, "文件不存在"
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    changes = []
    
    # 1. 移除紧跟在 prepare_output_directory 后的 os.makedirs
    pattern1 = r'(save_dir, is_fallback = prepare_output_directory[^\n]+\n)(\s+)os\.makedirs\(save_dir,\s*exist_ok=True\)\s*\n'
    if re.search(pattern1, content):
        content = re.sub(pattern1, r'\1', content)
        changes.append("移除多余的makedirs")
    
    # 2. 替换剩余的旧模式（volume_adjust.py中的批处理函数）
    pattern2 = r'(\s+)save_dir = output_path if output_path else OUTPUT_DIR\s*\n'
    if re.search(pattern2, content):
        def replace_old_pattern(match):
            indent = match.group(1)
            return f'{indent}# 准备输出目录\n{indent}save_dir, is_fallback = prepare_output_directory(output_path, OUTPUT_DIR)\n'
        content = re.sub(pattern2, replace_old_pattern, content)
        changes.append("替换旧模式")
    
    if content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True, ", ".join(changes)
    else:
        return False, "无需更改"

def main():
    print("=" * 60)
    print("清理路由文件")
    print("=" * 60)
    print()
    
    cleaned_count = 0
    skipped_count = 0
    
    for filepath in files_to_clean:
        changed, message = clean_file(filepath)
        filename = os.path.basename(filepath)
        if changed:
            print(f"✅ {filename:30s} - {message}")
            cleaned_count += 1
        else:
            print(f"⏭️  {filename:30s} - {message}")
            skipped_count += 1
    
    print()
    print("=" * 60)
    print(f"清理完成:")
    print(f"  ✅ 已清理: {cleaned_count} 个文件")
    print(f"  ⏭️  跳过: {skipped_count} 个文件")
    print("=" * 60)

if __name__ == "__main__":
    main()
