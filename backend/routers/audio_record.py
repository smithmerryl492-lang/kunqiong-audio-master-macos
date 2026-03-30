"""
音频录制路由
保存前端录制的音频文件，支持格式转换
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import JSONResponse
import os
import uuid
import subprocess
from datetime import datetime
from .utils import get_unique_filename, prepare_output_directory

router = APIRouter()

from .config import UPLOAD_DIR, OUTPUT_DIR


@router.post("/save")
async def save_recording(
    file: UploadFile = File(...),
    output_format: str = Form("mp3"),
    output_path: str = Form(""),
    filename: str = Form("")
):
    """
    保存录制的音频文�?
    
    参数:
    - file: 录制的音频文�?(通常�?webm �?wav 格式)
    - output_format: 输出格式 (mp3, wav, flac, aac, ogg)
    - output_path: 输出目录
    - filename: 自定义文件名（不含扩展名�?
    """
    # 生成文件�?
    file_id = str(uuid.uuid4())
    original_ext = os.path.splitext(file.filename)[1].lower() if file.filename else ".webm"
    input_path = os.path.join(UPLOAD_DIR, f"{file_id}{original_ext}")
    
    # 生成输出文件�?
    if not filename:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"录音_{timestamp}"
    
    output_ext = f".{output_format.lower()}"
    output_filename = f"{filename}{output_ext}"
    
    # 准备输出目录
    save_dir, is_fallback = prepare_output_directory(output_path, OUTPUT_DIR)
    output_filename = get_unique_filename(save_dir, output_filename)
    final_output = os.path.join(save_dir, output_filename)
    
    try:
        # 保存上传的文�?
        content = await file.read()
        with open(input_path, "wb") as f:
            f.write(content)
        
        # 使用 FFmpeg 转换格式
        cmd = [
            "ffmpeg", "-y",
            "-i", input_path,
            "-c:a", get_codec_for_format(output_ext),
        ]
        
        # 添加格式特定参数
        if output_format.lower() == "mp3":
            cmd.extend(["-b:a", "192k"])
        elif output_format.lower() == "aac":
            cmd.extend(["-b:a", "192k"])
        
        cmd.append(final_output)
        
        result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')
        
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail=f"转换失败: {result.stderr}")
        
        # 获取文件信息
        file_size = os.path.getsize(final_output)
        duration = get_audio_duration(final_output)
        
        return JSONResponse({
            "success": True,
            "message": "录音保存成功" if not is_fallback else "由于目录权限限制，文件已保存到临时目录",
            "output_path": final_output,
            "filename": output_filename,
            "size": file_size,
            "duration": duration,
            "is_fallback": is_fallback
        })
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"保存失败: {str(e)}")
    finally:
        # 清理临时文件
        if os.path.exists(input_path):
            try:
                os.remove(input_path)
            except:
                pass


@router.post("/convert")
async def convert_recording(
    file: UploadFile = File(...),
    output_format: str = Form("mp3"),
    bitrate: int = Form(192),
    output_path: str = Form("")
):
    """
    转换录音文件格式
    """
    file_id = str(uuid.uuid4())
    original_ext = os.path.splitext(file.filename)[1].lower()
    input_path = os.path.join(UPLOAD_DIR, f"{file_id}{original_ext}")
    
    output_ext = f".{output_format.lower()}"
    output_filename = f"{os.path.splitext(file.filename)[0]}{output_ext}"
    
    if output_path:
        final_output = os.path.join(output_path, output_filename)
    else:
        final_output = os.path.join(OUTPUT_DIR, f"{file_id}{output_ext}")
    
    try:
        content = await file.read()
        with open(input_path, "wb") as f:
            f.write(content)
        
        cmd = [
            "ffmpeg", "-y",
            "-i", input_path,
            "-c:a", get_codec_for_format(output_ext),
            "-b:a", f"{bitrate}k",
            final_output
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')
        
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail=f"转换失败: {result.stderr}")
        
        return JSONResponse({
            "success": True,
            "message": "转换成功",
            "output_path": final_output,
            "filename": output_filename,
            "size": os.path.getsize(final_output)
        })
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"转换失败: {str(e)}")
    finally:
        if os.path.exists(input_path):
            try:
                os.remove(input_path)
            except:
                pass


@router.delete("/delete")
async def delete_recording(file_path: str):
    """删除录音文件"""
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
            return JSONResponse({
                "success": True,
                "message": "文件已删除"
            })
        else:
            raise HTTPException(status_code=404, detail="文件不存在")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除失败: {str(e)}")


def get_codec_for_format(ext: str) -> str:
    """根据格式返回对应的编码器"""
    codec_map = {
        ".mp3": "libmp3lame",
        ".aac": "aac",
        ".m4a": "aac",
        ".ogg": "libvorbis",
        ".opus": "libopus",
        ".flac": "flac",
        ".wav": "pcm_s16le",
    }
    return codec_map.get(ext.lower(), "libmp3lame")


def get_audio_duration(file_path: str) -> float:
    """获取音频时长（秒）"""
    try:
        cmd = [
            "ffprobe",
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            file_path
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')
        if result.returncode == 0:
            return float(result.stdout.strip())
    except:
        pass
    return 0.0
