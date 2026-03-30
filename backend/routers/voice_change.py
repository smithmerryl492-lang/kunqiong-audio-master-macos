"""
音频变声处理
使用 praat-parselmouth 实现专业变声效果（共振峰调整）
FFmpeg 作为后备方案
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pathlib import Path
import subprocess
import tempfile
import os
import uuid
import numpy as np
from .utils import prepare_output_directory
from .config import UPLOAD_DIR, OUTPUT_DIR

# 尝试导入 parselmouth
try:
    import parselmouth
    from parselmouth.praat import call
    HAS_PARSELMOUTH = True
except ImportError:
    HAS_PARSELMOUTH = False
    print("Warning: parselmouth not installed, using FFmpeg fallback")

router = APIRouter()

# 预设变声效果
# pitch_factor: 音调倍数, formant_shift: 共振峰偏移
VOICE_PRESETS = {
    "low": {"name": "低音", "pitch_factor": 0.7, "formant_shift": 0.85, "effect": "low"},  # 低沉声音
    "high": {"name": "高音", "pitch_factor": 1.5, "formant_shift": 1.15, "effect": "high"},  # 尖锐声音
    "old": {"name": "老人", "pitch_factor": 0.85, "formant_shift": 0.9, "effect": "tremolo"},  # 颤抖效果
    "robot": {"name": "机器人", "pitch_factor": 1.0, "formant_shift": 1.0, "effect": "robot"},  # 机器人特效
    "minion": {"name": "小黄人", "pitch_factor": 2.0, "formant_shift": 1.4, "effect": "chipmunk"},  # 花栗鼠效果
    "cartoon": {"name": "卡通", "pitch_factor": 1.4, "formant_shift": 1.2, "effect": "cartoon"},  # 卡通效果
    "echo": {"name": "回声", "pitch_factor": 1.0, "formant_shift": 1.0, "effect": "echo"},  # 回声效果
    "underwater": {"name": "水下", "pitch_factor": 0.9, "formant_shift": 0.95, "effect": "underwater"},  # 水下效果
    "telephone": {"name": "电话", "pitch_factor": 1.0, "formant_shift": 1.0, "effect": "telephone"},  # 电话效果
}

SUPPORTED_FORMATS = [".mp3", ".wav", ".flac", ".aac", ".ogg", ".m4a", ".wma"]
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB


def get_output_dir(output_path: str = "") -> str:
    """获取输出目录"""
    if output_path and os.path.isdir(output_path):
        return output_path
    # 默认输出到桌面的专用文件夹
    desktop = os.path.join(os.path.expanduser("~"), "Desktop")
    default_dir = os.path.join(desktop, "鲲穹AI音频转换器输出")
    os.makedirs(default_dir, exist_ok=True)
    return default_dir


def change_voice_with_parselmouth(input_path: str, output_path: str, pitch_factor: float = 1.0, formant_shift: float = 1.0, effect: str = "") -> bool:
    """
    使用 parselmouth 进行专业变声
    使用 Change Gender 功能实现更自然的性别转换
    """
    if not HAS_PARSELMOUTH:
        return False
    
    try:
        # 读取音频
        sound = parselmouth.Sound(input_path)
        
        # 使用 Praat 的 Change Gender 功能
        # 这是专门为性别转换设计的，效果比简单的音调变换好得多
        # 参数说明：
        # - minimum_pitch: 最低音调检测 (75 Hz)
        # - maximum_pitch: 最高音调检测 (600 Hz)  
        # - formant_shift_ratio: 共振峰偏移比例 (>1 女性化, <1 男性化)
        # - new_pitch_median: 新的音调中值 (0 = 保持原始比例)
        # - pitch_range_factor: 音调范围因子
        # - duration_factor: 时长因子 (1.0 = 不变)
        
        # 根据效果类型设置参数
        if effect in ["female", "loli", "chipmunk", "cartoon"]:
            # 女性化：提高共振峰 + 提高音调
            min_pitch = 75
            max_pitch = 600
            # 新音调中值：0表示按比例缩放，正数表示目标Hz
            new_pitch_median = 0  # 按比例
            pitch_range = 1.0
            duration = 1.0
            
            sound_changed = call(sound, "Change gender", 
                               min_pitch, max_pitch,
                               formant_shift,  # 共振峰偏移
                               pitch_factor,   # 音调中值因子
                               pitch_range,    # 音调范围
                               duration)       # 时长
        else:
            # 男性化或其他：降低共振峰 + 降低音调
            min_pitch = 75
            max_pitch = 600
            new_pitch_median = 0
            pitch_range = 1.0
            duration = 1.0
            
            sound_changed = call(sound, "Change gender",
                               min_pitch, max_pitch,
                               formant_shift,
                               pitch_factor,
                               pitch_range,
                               duration)
        
        # 保存为 WAV
        sound_changed.save(output_path, parselmouth.SoundFileFormat.WAV)
        return True
        
    except Exception as e:
        print(f"Parselmouth error: {e}")
        import traceback
        traceback.print_exc()
        return False


def build_voice_filter(pitch: float, tempo: float, effect: str = "") -> str:
    """构建FFmpeg音频滤镜链（后备方案）"""
    filters = []
    
    # 基础音调变换
    sample_rate_factor = pitch
    tempo_compensation = 1.0 / pitch * tempo
    
    # atempo 只支持 0.5-2.0 范围，需要链式处理
    atempo_filters = []
    remaining_tempo = tempo_compensation
    while remaining_tempo > 2.0:
        atempo_filters.append("atempo=2.0")
        remaining_tempo /= 2.0
    while remaining_tempo < 0.5:
        atempo_filters.append("atempo=0.5")
        remaining_tempo /= 0.5
    atempo_filters.append(f"atempo={remaining_tempo:.4f}")
    
    # 基础变调
    filters.append(f"asetrate=44100*{sample_rate_factor:.4f}")
    filters.append("aresample=44100")
    filters.extend(atempo_filters)
    
    # 根据效果类型添加额外滤镜
    if effect == "lowpass":
        # 男声：低通滤波，让声音更低沉
        filters.append("lowpass=f=3000")
        filters.append("bass=g=3")
    elif effect == "highpass":
        # 女声：高通滤波，让声音更清亮
        filters.append("highpass=f=200")
        filters.append("treble=g=2")
    elif effect == "bright":
        # 萝莉：明亮效果
        filters.append("highpass=f=300")
        filters.append("treble=g=4")
        filters.append("acompressor=threshold=0.5:ratio=2")
    elif effect == "tremolo":
        # 老人：颤抖效果
        filters.append("vibrato=f=6:d=0.3")
        filters.append("lowpass=f=4000")
    elif effect == "robot":
        # 机器人：环形调制 + 失真
        filters.append("afftfilt=real='hypot(re,im)*cos((random(0)*2-1)*2*3.14)':imag='hypot(re,im)*sin((random(1)*2-1)*2*3.14)':win_size=512:overlap=0.75")
        filters.append("aecho=0.8:0.88:6:0.4")
    elif effect == "chipmunk":
        # 花栗鼠/小黄人：高音调
        filters.append("highpass=f=400")
        filters.append("treble=g=5")
    elif effect == "cartoon":
        # 卡通：夸张效果
        filters.append("acompressor=threshold=0.3:ratio=4:attack=5:release=50")
        filters.append("treble=g=3")
    elif effect == "echo":
        # 回声效果
        filters.append("aecho=0.8:0.9:500|1000:0.5|0.3")
    elif effect == "underwater":
        # 水下效果
        filters.append("lowpass=f=600")
        filters.append("aecho=0.8:0.7:100:0.5")
        filters.append("flanger=delay=3:depth=3:speed=0.5")
    elif effect == "telephone":
        # 电话效果
        filters.append("highpass=f=300")
        filters.append("lowpass=f=3400")
        filters.append("acompressor=threshold=0.5:ratio=3")
    
    return ",".join(filters)


@router.get("/presets")
async def get_presets():
    """获取变声预设列表"""
    presets = [
        {"id": k, "name": v["name"], "description": f"音调: {v['pitch_factor']}, 共振峰: {v['formant_shift']}"}
        for k, v in VOICE_PRESETS.items()
    ]
    return {"presets": presets}


@router.post("/")
async def change_voice(
    file: UploadFile = File(...),
    preset: str = Form(""),
    pitch: float = Form(1.0),
    tempo: float = Form(1.0),
    output_format: str = Form(""),
    output_path: str = Form("")
):
    """
    音频变声处理
    
    参数:
    - file: 音频文件
    - preset: 预设名称 (male, female, loli, old, robot, minion, cartoon)
    - pitch: 音调倍数 (0.5-2.0)，preset为空时使用
    - tempo: 速度倍数 (0.5-2.0)，preset为空时使用
    - output_format: 输出格式，留空保持原格式
    - output_path: 输出目录
    """
    filename = file.filename or "audio"
    ext = Path(filename).suffix.lower()
    
    if ext not in SUPPORTED_FORMATS:
        raise HTTPException(status_code=400, detail=f"不支持的格式，支持: {', '.join(SUPPORTED_FORMATS)}")
    
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="文件大小不能超过100MB")
    
    # 使用预设或自定义参数
    effect = ""
    if preset and preset in VOICE_PRESETS:
        pitch = VOICE_PRESETS[preset]["pitch_factor"]
        tempo = 1.0  # 预设不改变速度
        effect = VOICE_PRESETS[preset].get("effect", "")
    
    # 限制参数范围
    pitch = max(0.5, min(2.0, pitch))
    tempo = max(0.5, min(2.0, tempo))
    
    # 确定输出格式
    out_ext = f".{output_format.lower()}" if output_format else ext
    if out_ext not in SUPPORTED_FORMATS:
        out_ext = ext
    
    # 准备输出目录
    output_dir, is_fallback = prepare_output_directory(
        output_path if (output_path and os.path.isdir(output_path)) else "",
        OUTPUT_DIR
    )
    output_filename = f"{Path(filename).stem}_voice_{uuid.uuid4().hex[:8]}{out_ext}"
    output_file = os.path.join(output_dir, output_filename)
    
    # 保存临时文件
    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        tmp.write(content)
        tmp_path = tmp.name
    
    try:
        # 构建滤镜链
        filter_complex = build_voice_filter(pitch, tempo, effect)
        
        # 根据输出格式选择编码器
        if out_ext == ".mp3":
            codec = "libmp3lame"
        elif out_ext in [".m4a", ".aac"]:
            codec = "aac"
        elif out_ext == ".ogg":
            codec = "libvorbis"
        elif out_ext == ".flac":
            codec = "flac"
        else:
            codec = "pcm_s16le"  # wav 默认
        
        cmd = [
            "ffmpeg", "-y",
            "-i", tmp_path,
            "-af", filter_complex,
            "-acodec", codec,
            output_file
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')
        
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail=f"变声处理失败: {result.stderr}")
        
        file_size = os.path.getsize(output_file)
        
        return {
            "success": True,
            "message": "变声处理完成",
            "output_path": output_file,
            "filename": output_filename,
            "size": file_size,
            "preset": preset or "custom",
            "pitch": pitch,
            "tempo": tempo
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"变声处理失败: {str(e)}")
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


@router.post("/preview")
async def preview_voice_change(
    file: UploadFile = File(...),
    preset: str = Form(""),
    pitch: float = Form(1.0),
    tempo: float = Form(1.0),
):
    """
    预览变声效果（返回音频数据）
    
    参数:
    - file: 音频文件
    - preset: 预设名称
    - pitch: 音调倍数 (0.5-2.0)
    - tempo: 速度倍数 (0.5-2.0)
    """
    from fastapi.responses import Response
    
    filename = file.filename or "audio"
    ext = Path(filename).suffix.lower()
    
    if ext not in SUPPORTED_FORMATS:
        raise HTTPException(status_code=400, detail=f"不支持的格式")
    
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="文件大小不能超过100MB")
    
    # 使用预设或自定义参数
    effect = ""
    pitch_factor = pitch
    formant_shift = 1.0
    
    if preset and preset in VOICE_PRESETS:
        preset_config = VOICE_PRESETS[preset]
        pitch_factor = preset_config.get("pitch_factor", 1.0)
        formant_shift = preset_config.get("formant_shift", 1.0)
        effect = preset_config.get("effect", "")
    
    pitch_factor = max(0.5, min(2.0, pitch_factor))
    formant_shift = max(0.7, min(1.4, formant_shift))
    
    # 保存临时文件（转为WAV以便parselmouth处理）
    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        tmp.write(content)
        tmp_path = tmp.name
    
    # 转换为WAV（parselmouth需要）
    wav_tmp_path = tmp_path.replace(ext, ".wav") if ext != ".wav" else tmp_path + "_converted.wav"
    
    # 输出临时文件
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as out_tmp:
        wav_out_path = out_tmp.name
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as mp3_tmp:
        out_path = mp3_tmp.name
    
    try:
        # 先转换为WAV
        if ext != ".wav":
            convert_cmd = ["ffmpeg", "-y", "-i", tmp_path, "-ar", "44100", "-ac", "1", wav_tmp_path]
            subprocess.run(convert_cmd, capture_output=True)
        else:
            wav_tmp_path = tmp_path
        
        # 尝试使用 parselmouth（对于人声变换效果更好）
        use_parselmouth = HAS_PARSELMOUTH and effect in ["male", "female", "loli", "chipmunk", "cartoon"]
        
        if use_parselmouth:
            success = change_voice_with_parselmouth(wav_tmp_path, wav_out_path, pitch_factor, formant_shift, effect)
            if success:
                # 转换为MP3
                cmd = ["ffmpeg", "-y", "-i", wav_out_path, "-acodec", "libmp3lame", "-b:a", "128k", out_path]
                subprocess.run(cmd, capture_output=True)
            else:
                use_parselmouth = False
        
        if not use_parselmouth:
            # 使用FFmpeg后备方案
            filter_complex = build_voice_filter(pitch_factor, 1.0, effect)
            
            cmd = [
                "ffmpeg", "-y",
                "-i", tmp_path,
                "-af", filter_complex,
                "-acodec", "libmp3lame",
                "-b:a", "128k",
                out_path
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')
            
            if result.returncode != 0:
                raise HTTPException(status_code=500, detail=f"变声处理失败")
        
        with open(out_path, "rb") as f:
            audio_data = f.read()
        
        return Response(content=audio_data, media_type="audio/mpeg")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"变声处理失败: {str(e)}")
    finally:
        for path in [tmp_path, out_path, wav_tmp_path, wav_out_path]:
            try:
                if path and os.path.exists(path):
                    os.unlink(path)
            except:
                pass


@router.post("/batch")
async def batch_change_voice(
    files: list[UploadFile] = File(...),
    preset: str = Form(""),
    pitch: float = Form(1.0),
    tempo: float = Form(1.0),
    output_format: str = Form(""),
    output_path: str = Form("")
):
    """批量变声处理"""
    results = []
    
    for file in files:
        try:
            # 重置文件指针
            await file.seek(0)
            result = await change_voice(
                file=file,
                preset=preset,
                pitch=pitch,
                tempo=tempo,
                output_format=output_format,
                output_path=output_path
            )
            results.append({
                "filename": file.filename,
                "success": True,
                "output_path": result["output_path"],
                "output_filename": result["filename"],
                "size": result["size"]
            })
        except Exception as e:
            results.append({
                "filename": file.filename,
                "success": False,
                "message": str(e)
            })
    
    return {
        "success": all(r["success"] for r in results),
        "message": f"处理完成 {sum(1 for r in results if r['success'])}/{len(results)}",
        "results": results
    }
