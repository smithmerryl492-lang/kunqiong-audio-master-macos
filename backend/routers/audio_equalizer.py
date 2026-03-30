"""
均衡器路由
使用 FFmpeg equalizer 滤镜调整音频频率
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import JSONResponse
import subprocess
import os
import uuid
import json
from .utils import get_unique_filename, decode_filename, prepare_output_directory

router = APIRouter()

from .config import UPLOAD_DIR, OUTPUT_DIR

# 预设均衡器配置
PRESETS = {
    "flat": {},  # 平坦
    "bass_boost": {"60": 6, "170": 4, "310": 2},  # 低音增强
    "treble_boost": {"6000": 3, "12000": 5, "14000": 6},  # 高音增强
    "vocal": {"310": 3, "600": 2, "1000": 3, "3000": 4},  # 人声增强
    "rock": {"60": 5, "170": 4, "600": -2, "3000": 3, "6000": 4},  # 摇滚
    "pop": {"60": -1, "170": 2, "1000": 3, "3000": 4, "6000": 2},  # 流行
    "jazz": {"60": 3, "310": -2, "1000": 2, "3000": 3, "6000": 4},  # 爵士
    "classical": {"60": 4, "310": 2, "1000": -1, "3000": 3, "12000": 4},  # 古典
}

# 10段均衡器频率映射 (对应前端的 031, 062, 125, 250, 600, 1K, 2K, 4K, 8K, 16K)
BAND_FREQUENCIES = [31, 62, 125, 250, 600, 1000, 2000, 4000, 8000, 16000]


@router.post("/")
async def apply_equalizer(
    file: UploadFile = File(...),
    preset: str = Form("flat"),  # 预设名称
    bands: str = Form(""),  # JSON 数组格式的 10 段均衡器值
    selection_start: float = Form(0),  # 选择起点 (0-1)
    selection_end: float = Form(1),  # 选择终点 (0-1)
    # 自定义频段增益(dB) - 保留旧接口兼容
    band_60: float = Form(0),
    band_170: float = Form(0),
    band_310: float = Form(0),
    band_600: float = Form(0),
    band_1000: float = Form(0),
    band_3000: float = Form(0),
    band_6000: float = Form(0),
    band_12000: float = Form(0),
    band_14000: float = Form(0),
    output_format: str = Form(""),
    output_path: str = Form("")
):
    """
    应用均衡器效果
    
    参数:
    - file: 音频文件
    - preset: 预设名称 (flat, bass_boost, treble_boost, vocal, rock, pop, jazz, classical)
    - bands: JSON 数组格式的 10 段均衡器值 (优先使用)
    - selection_start: 选择起点 (0-1)
    - selection_end: 选择终点 (0-1)
    - band_*: 各频段增益(-12 到 12 dB)
    - output_format: 输出格式
    - output_path: 输出目录
    """
    ext = os.path.splitext(file.filename)[1].lower()
    file_id = str(uuid.uuid4())
    input_path = os.path.join(UPLOAD_DIR, f"{file_id}{ext}")
    
    try:
        content = await file.read()
        with open(input_path, "wb") as f:
            f.write(content)
        
        # 获取增益值
        gains = {}
        
        # 优先使用 bands 参数 (10段均衡器)
        if bands:
            try:
                band_values = json.loads(bands)
                if isinstance(band_values, list) and len(band_values) == 10:
                    for i, gain in enumerate(band_values):
                        if gain != 0:
                            gains[str(BAND_FREQUENCIES[i])] = float(gain)
            except json.JSONDecodeError:
                pass
        
        # 如果没有 bands 参数，使用预设或单独的 band_* 参数
        if not gains:
            if preset != "custom" and preset in PRESETS:
                gains = PRESETS[preset].copy()
            
            # 自定义值覆盖预设
            custom_bands = {
                "60": band_60, "170": band_170, "310": band_310,
                "600": band_600, "1000": band_1000, "3000": band_3000,
                "6000": band_6000, "12000": band_12000, "14000": band_14000
            }
            for freq, gain in custom_bands.items():
                if gain != 0:
                    gains[freq] = gain
        
        out_ext = f".{output_format.lower()}" if output_format else ext
        # 使用原文件名
        base_name = os.path.splitext(decode_filename(file.filename))[0]
        output_filename = f"{base_name}{out_ext}"
        
        # 准备输出目录

        
        save_dir, is_fallback = prepare_output_directory(output_path, OUTPUT_DIR)
        output_filename = get_unique_filename(save_dir, output_filename)
        final_output = os.path.join(save_dir, output_filename)
        
        os.makedirs(save_dir, exist_ok=True)
        
        # 构建滤镜
        filters = []
        
        # 如果有选择区域，需要先获取音频时长
        need_trim = selection_start > 0 or selection_end < 1
        if need_trim:
            # 获取音频时长
            probe_cmd = [
                'ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                '-of', 'default=noprint_wrappers=1:nokey=1', input_path
            ]
            probe_result = subprocess.run(probe_cmd, capture_output=True, text=True, encoding='utf-8')
            try:
                duration = float(probe_result.stdout.strip())
                start_time = selection_start * duration
                end_time = selection_end * duration
            except:
                need_trim = False
        
        # 构建均衡器滤镜
        if gains:
            eq_filters = []
            for freq, gain in gains.items():
                eq_filters.append(f"equalizer=f={freq}:t=h:w=200:g={gain}")
            filters.append(",".join(eq_filters))
        
        # 构建 FFmpeg 命令
        if need_trim:
            # 需要裁剪：只处理选中部分，然后拼接
            temp_before = os.path.join(UPLOAD_DIR, f"{file_id}_before{ext}")
            temp_selected = os.path.join(UPLOAD_DIR, f"{file_id}_selected{ext}")
            temp_after = os.path.join(UPLOAD_DIR, f"{file_id}_after{ext}")
            temp_files = []
            
            try:
                # 提取选中前的部分
                if start_time > 0.1:
                    cmd_before = ['ffmpeg', '-y', '-i', input_path, '-t', str(start_time), '-c', 'copy', temp_before]
                    subprocess.run(cmd_before, capture_output=True, encoding='utf-8')
                    temp_files.append(temp_before)
                
                # 提取并处理选中部分
                cmd_selected = ['ffmpeg', '-y', '-i', input_path, '-ss', str(start_time), '-t', str(end_time - start_time)]
                if filters:
                    cmd_selected.extend(['-af', filters[0]])
                cmd_selected.append(temp_selected)
                subprocess.run(cmd_selected, capture_output=True, encoding='utf-8')
                temp_files.append(temp_selected)
                
                # 提取选中后的部分
                if end_time < duration - 0.1:
                    cmd_after = ['ffmpeg', '-y', '-i', input_path, '-ss', str(end_time), '-c', 'copy', temp_after]
                    subprocess.run(cmd_after, capture_output=True, encoding='utf-8')
                    temp_files.append(temp_after)
                
                # 合并所有部分
                if len(temp_files) == 1:
                    import shutil
                    shutil.move(temp_files[0], final_output)
                else:
                    list_file = os.path.join(UPLOAD_DIR, f"{file_id}_list.txt")
                    with open(list_file, 'w', encoding='utf-8') as f:
                        for tf in temp_files:
                            f.write(f"file '{tf.replace(os.sep, '/')}'\n")
                    
                    cmd_concat = ['ffmpeg', '-y', '-f', 'concat', '-safe', '0', '-i', list_file, '-c', 'copy', final_output]
                    result = subprocess.run(cmd_concat, capture_output=True, text=True, encoding='utf-8')
                    
                    os.remove(list_file)
                    
                    if result.returncode != 0:
                        raise HTTPException(status_code=500, detail=f"合并失败: {result.stderr}")
                
            finally:
                # 清理临时文件
                for tf in [temp_before, temp_selected, temp_after]:
                    if os.path.exists(tf):
                        try:
                            os.remove(tf)
                        except:
                            pass
        else:
            # 不需要裁剪，直接处理整个文件
            if filters:
                cmd = ['ffmpeg', '-y', '-i', input_path, '-af', filters[0], final_output]
            else:
                cmd = ['ffmpeg', '-y', '-i', input_path, '-c:a', 'copy', final_output]
            
            result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
            
            if result.returncode != 0:
                raise HTTPException(status_code=500, detail=f"处理失败: {result.stderr}")
        
        output_size = os.path.getsize(final_output)
        
        return JSONResponse({
            "success": True,
            "message": "均衡器应用成功",
            "output_path": final_output,
            "filename": output_filename,
            "size": output_size,
            "preset": preset
        })
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}")
    finally:
        if os.path.exists(input_path):
            try:
                os.remove(input_path)
            except:
                pass


@router.get("/presets")
async def get_presets():
    """获取可用的均衡器预设"""
    return {
        "presets": [
            {"id": "flat", "name": "平坦", "description": "无调整"},
            {"id": "bass_boost", "name": "低音增强", "description": "增强低频"},
            {"id": "treble_boost", "name": "高音增强", "description": "增强高频"},
            {"id": "vocal", "name": "人声增强", "description": "突出人声"},
            {"id": "rock", "name": "摇滚", "description": "适合摇滚音乐"},
            {"id": "pop", "name": "流行", "description": "适合流行音乐"},
            {"id": "jazz", "name": "爵士", "description": "适合爵士音乐"},
            {"id": "classical", "name": "古典", "description": "适合古典音乐"},
            {"id": "custom", "name": "自定义", "description": "手动调整各频段"},
        ]
    }
