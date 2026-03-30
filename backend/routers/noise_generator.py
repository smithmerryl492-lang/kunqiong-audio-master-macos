"""
噪音生成器路由
使用 FFmpeg 在音频指定位置添加噪音
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


@router.post("/")
async def add_noise(
    file: UploadFile = File(...),
    start_time: float = Form(...),  # 噪音开始时间（秒）
    end_time: float = Form(...),    # 噪音结束时间（秒）
    noise_type: str = Form("white"),  # 噪音类型: white, pink, brown
    noise_volume: float = Form(0.5),  # 噪音音量 0-1
    replace_audio: bool = Form(True),  # 是否替换原音频（否则混合）
    output_format: str = Form(""),
    output_path: str = Form("")
):
    """
    在音频指定位置添加噪音
    
    参数:
    - file: 音频文件
    - start_time: 噪音开始时间（秒）
    - end_time: 噪音结束时间（秒）
    - noise_type: 噪音类型 (white/pink/brown)
    - noise_volume: 噪音音量 (0-1)
    - replace_audio: 是否替换原音频
    - output_format: 输出格式
    - output_path: 输出目录
    """
    if start_time >= end_time:
        raise HTTPException(status_code=400, detail="开始时间必须小于结束时间")
    
    if noise_volume < 0 or noise_volume > 1:
        raise HTTPException(status_code=400, detail="噪音音量必须在 0-1 之间")
    
    ext = os.path.splitext(file.filename)[1].lower()
    file_id = str(uuid.uuid4())
    input_path = os.path.join(UPLOAD_DIR, f"{file_id}{ext}")
    
    try:
        content = await file.read()
        with open(input_path, "wb") as f:
            f.write(content)
        
        # 获取音频信息
        duration = get_audio_duration(input_path)
        sample_rate = get_sample_rate(input_path)
        
        if end_time > duration:
            end_time = duration
        
        out_ext = f".{output_format.lower()}" if output_format else ext
        # 使用原文件名
        base_name = os.path.splitext(decode_filename(file.filename))[0]
        output_filename = f"{base_name}{out_ext}"
        
        # 准备输出目录

        
        save_dir, is_fallback = prepare_output_directory(output_path, OUTPUT_DIR)
        output_filename = get_unique_filename(save_dir, output_filename)
        final_output = os.path.join(save_dir, output_filename)
        
        os.makedirs(save_dir, exist_ok=True)
        
        noise_duration = end_time - start_time
        
        # 噪音颜色映射
        noise_colors = {
            "white": "white",
            "pink": "pink", 
            "brown": "brown"
        }
        noise_color = noise_colors.get(noise_type, "white")
        
        if replace_audio:
            # 替换指定区间的音频为噪音
            filter_complex = (
                f"[0:a]atrim=0:{start_time},asetpts=PTS-STARTPTS[before];"
                f"anoisesrc=c={noise_color}:r={sample_rate}:d={noise_duration},volume={noise_volume}[noise];"
                f"[0:a]atrim={end_time},asetpts=PTS-STARTPTS[after];"
                f"[before][noise][after]concat=n=3:v=0:a=1[out]"
            )
        else:
            # 在指定区间混合噪音
            filter_complex = (
                f"anoisesrc=c={noise_color}:r={sample_rate}:d={noise_duration},volume={noise_volume}[noise];"
                f"[noise]adelay={int(start_time*1000)}|{int(start_time*1000)}[delayed_noise];"
                f"[0:a][delayed_noise]amix=inputs=2:duration=first[out]"
            )
        
        cmd = [
            'ffmpeg', '-y',
            '-i', input_path,
            '-filter_complex', filter_complex,
            '-map', '[out]',
            final_output
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
        
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail=f"处理失败: {result.stderr}")
        
        output_size = os.path.getsize(final_output)
        
        return JSONResponse({
            "success": True,
            "message": "噪音添加成功",
            "output_path": final_output,
            "filename": output_filename,
            "size": output_size,
            "noise_start": start_time,
            "noise_end": end_time
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


def get_audio_duration(file_path: str) -> float:
    """获取音频时长"""
    cmd = ['ffprobe', '-v', 'quiet', '-print_format', 'json', '-show_format', file_path]
    result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
    try:
        info = json.loads(result.stdout)
        return float(info.get('format', {}).get('duration', 0))
    except:
        return 0


def get_sample_rate(file_path: str) -> int:
    """获取音频采样率"""
    cmd = ['ffprobe', '-v', 'quiet', '-print_format', 'json', '-show_streams', file_path]
    result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
    try:
        info = json.loads(result.stdout)
        for stream in info.get('streams', []):
            if stream.get('codec_type') == 'audio':
                return int(stream.get('sample_rate', 44100))
        return 44100
    except:
        return 44100
