"""
音量调整路由
使用 FFmpeg 调整音频音量
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import JSONResponse, FileResponse
import os
import uuid
import subprocess
from typing import Optional
from .utils import get_unique_filename, decode_filename, prepare_output_directory

router = APIRouter()

from .config import UPLOAD_DIR, OUTPUT_DIR


@router.post("/")
async def adjust_volume(
    file: UploadFile = File(...),
    volume: float = Form(...),  # 音量倍数，如 0.5 表示减半�?.0 表示加�?
    output_format: str = Form(""),  # 输出格式，留空则保持原格�?
    output_path: str = Form("")
):
    """
    调整音频音量
    
    参数:
    - file: 音频文件
    - volume: 音量倍数 (0.1-10.0)�?.0 为原始音�?
    - output_format: 输出格式，留空保持原格式
    - output_path: 输出目录
    """
    # 验证音量范围
    if volume < 0.1 or volume > 10.0:
        raise HTTPException(status_code=400, detail="音量倍数必须�?0.1 �?10.0 之间")
    
    # 获取文件扩展�?
    original_ext = os.path.splitext(file.filename)[1].lower()
    output_ext = f".{output_format.lower()}" if output_format else original_ext
    
    # 生成文件路径
    file_id = str(uuid.uuid4())
    input_path = os.path.join(UPLOAD_DIR, f"{file_id}{original_ext}")
    
    # 使用原文件名
    base_name = os.path.splitext(decode_filename(file.filename))[0]
    output_filename = f"{base_name}{output_ext}"
    
    # 准备输出目录
    save_dir, is_fallback = prepare_output_directory(output_path, OUTPUT_DIR)
    output_filename = get_unique_filename(save_dir, output_filename)
    final_output = os.path.join(save_dir, output_filename)
    
    try:
        # 保存上传文件
        content = await file.read()
        with open(input_path, "wb") as f:
            f.write(content)
        
        # 使用 FFmpeg 调整音量
        cmd = [
            "ffmpeg", "-y",
            "-i", input_path,
            "-af", f"volume={volume}",
            "-c:a", get_codec_for_format(output_ext),
            final_output
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')
        
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail=f"音量调整失败: {result.stderr}")
        
        # 获取输出文件大小
        file_size = os.path.getsize(final_output)
        
        return JSONResponse({
            "success": True,
            "message": "音量调整成功",
            "output_path": final_output,
            "filename": output_filename,
            "size": file_size
        })
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}")
    finally:
        # 清理上传的临时文�?
        if os.path.exists(input_path):
            try:
                os.remove(input_path)
            except:
                pass


@router.post("/batch")
async def batch_adjust_volume(
    files: list[UploadFile] = File(...),
    volume: float = Form(...),
    output_format: str = Form(""),
    output_path: str = Form("")
):
    """批量调整音频音量"""
    if volume < 0.1 or volume > 10.0:
        raise HTTPException(status_code=400, detail="音量倍数必须�?0.1 �?10.0 之间")
    
    results = []
    
    for file in files:
        original_ext = os.path.splitext(file.filename)[1].lower()
        output_ext = f".{output_format.lower()}" if output_format else original_ext
        
        file_id = str(uuid.uuid4())
        input_path = os.path.join(UPLOAD_DIR, f"{file_id}{original_ext}")
        
        # 使用原文件名
        output_filename = f"{os.path.splitext(decode_filename(file.filename))[0]}{output_ext}"
        # 准备输出目录

        save_dir, is_fallback = prepare_output_directory(output_path, OUTPUT_DIR)
        output_filename = get_unique_filename(save_dir, output_filename)
        final_output = os.path.join(save_dir, output_filename)
        
        try:
            content = await file.read()
            with open(input_path, "wb") as f:
                f.write(content)
            
            cmd = [
                "ffmpeg", "-y",
                "-i", input_path,
                "-af", f"volume={volume}",
                "-c:a", get_codec_for_format(output_ext),
                final_output
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')
            
            if result.returncode == 0:
                results.append({
                    "filename": file.filename,
                    "success": True,
                    "message": "音量调整成功",
                    "output_path": final_output,
                    "output_filename": output_filename,
                    "size": os.path.getsize(final_output)
                })
            else:
                results.append({
                    "filename": file.filename,
                    "success": False,
                    "message": f"调整失败: {result.stderr}"
                })
        except Exception as e:
            results.append({
                "filename": file.filename,
                "success": False,
                "message": str(e)
            })
        finally:
            if os.path.exists(input_path):
                try:
                    os.remove(input_path)
                except:
                    pass
    
    return JSONResponse({
        "success": all(r["success"] for r in results),
        "message": "批量处理完成",
        "results": results
    })


@router.post("/normalize")
async def normalize_volume(
    file: UploadFile = File(...),
    target_level: float = Form(-14.0),  # 目标响度 (LUFS)
    output_format: str = Form(""),
    output_path: str = Form("")
):
    """
    音量标准化（响度归一化）
    
    参数:
    - file: 音频文件
    - target_level: 目标响度级别 (LUFS)，默�?-14.0
    - output_format: 输出格式
    - output_path: 输出目录
    """
    original_ext = os.path.splitext(file.filename)[1].lower()
    output_ext = f".{output_format.lower()}" if output_format else original_ext
    
    file_id = str(uuid.uuid4())
    input_path = os.path.join(UPLOAD_DIR, f"{file_id}{original_ext}")
    
    # 使用原文件名
    output_filename = f"{os.path.splitext(decode_filename(file.filename))[0]}{output_ext}"
    # 准备输出目录

    save_dir, is_fallback = prepare_output_directory(output_path, OUTPUT_DIR)
    output_filename = get_unique_filename(save_dir, output_filename)
    final_output = os.path.join(save_dir, output_filename)
    
    try:
        content = await file.read()
        with open(input_path, "wb") as f:
            f.write(content)
        
        # 使用 loudnorm 滤镜进行响度归一�?
        cmd = [
            "ffmpeg", "-y",
            "-i", input_path,
            "-af", f"loudnorm=I={target_level}:TP=-1.5:LRA=11",
            "-c:a", get_codec_for_format(output_ext),
            final_output
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')
        
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail=f"标准化失败: {result.stderr}")
        
        return JSONResponse({
            "success": True,
            "message": "音量标准化成功",
            "output_path": final_output,
            "filename": output_filename,
            "size": os.path.getsize(final_output)
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
        ".wma": "wmav2",
    }
    return codec_map.get(ext.lower(), "copy")
