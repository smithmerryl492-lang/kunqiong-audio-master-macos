"""
音频压缩路由
使用 FFmpeg 压缩音频文件
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import JSONResponse
import subprocess
import os
import uuid
import json
from typing import Optional, List
from .utils import get_unique_filename, decode_filename, prepare_output_directory

router = APIRouter()

from .config import UPLOAD_DIR, OUTPUT_DIR


def get_audio_info(file_path: str) -> dict:
    """获取音频文件信息"""
    cmd = [
        'ffprobe', '-v', 'quiet', '-print_format', 'json',
        '-show_format', '-show_streams', file_path
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')
        info = json.loads(result.stdout)
        duration = float(info.get('format', {}).get('duration', 0))
        size = int(info.get('format', {}).get('size', 0))
        bitrate = int(info.get('format', {}).get('bit_rate', 0)) // 1000
        return {'duration': duration, 'size': size, 'bitrate': bitrate}
    except:
        return {'duration': 0, 'size': 0, 'bitrate': 0}


@router.post("/")
async def compress_audio(
    file: UploadFile = File(...),
    quality: str = Form("medium"),  # low, medium, high, custom
    bitrate: Optional[int] = Form(None),  # 自定义比特率 kbps
    ratio: Optional[int] = Form(None),  # 压缩比例 20-100
    output_format: str = Form(""),  # 输出格式，空则保持原格式
    output_path: str = Form("")
):
    """
    压缩音频文件
    
    参数:
    - file: 音频文件
    - quality: 压缩质量 (low=64kbps, medium=128kbps, high=192kbps, custom=使用ratio)
    - bitrate: 自定义比特率 (kbps)，优先于 quality 和 ratio
    - ratio: 压缩比例 20-100
      - 100% = 原始比特率（不压缩，保持原文件大小）
      - 50% = 原始比特率的一半
      - 比例越低，文件越小
    - output_format: 输出格式，空则保持原格式
    - output_path: 输出目录
    """
    allowed_extensions = {'.mp3', '.wav', '.m4a', '.flac', '.ogg', '.wma', '.aac', '.webm'}
    file_ext = os.path.splitext(file.filename)[1].lower()
    
    if file_ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"不支持的文件格式: {file_ext}")
    
    file_id = str(uuid.uuid4())
    input_path = os.path.join(UPLOAD_DIR, f"{file_id}{file_ext}")
    
    try:
        content = await file.read()
        with open(input_path, "wb") as f:
            f.write(content)
        
        # 获取原始文件信息
        original_info = get_audio_info(input_path)
        original_bitrate = original_info.get('bitrate', 320)  # 默认 320kbps
        if original_bitrate <= 0:
            original_bitrate = 320
        
        # 确定输出格式
        out_ext = f".{output_format.lower()}" if output_format else file_ext
        if out_ext == '.wav':
            out_ext = '.mp3'  # WAV 不支持压缩，转为 MP3
        
        # 确定目标比特率
        # 优先级：bitrate > ratio > quality
        if bitrate:
            # 直接使用指定的比特率
            target_bitrate = bitrate
        elif ratio:
            # 使用压缩比例：100% = 原始比特率，50% = 原始比特率的一半
            target_bitrate = int(original_bitrate * ratio / 100)
        else:
            quality_map = {'low': 64, 'medium': 128, 'high': 192}
            target_bitrate = quality_map.get(quality, 128)
        
        # 确保比特率在合理范围内
        target_bitrate = max(32, min(target_bitrate, 320))
        
        # 使用原文件名
        base_name = os.path.splitext(decode_filename(file.filename))[0]
        output_filename = f"{base_name}{out_ext}"
        
        # 准备输出目录
        save_dir, is_fallback = prepare_output_directory(output_path, OUTPUT_DIR)
        output_filename = get_unique_filename(save_dir, output_filename)
        final_output = os.path.join(save_dir, output_filename)
        
        # FFmpeg 压缩命令
        cmd = ['ffmpeg', '-y', '-i', input_path, '-b:a', f'{target_bitrate}k']
        
        # 根据格式添加编码器
        if out_ext in ['.mp3']:
            cmd.extend(['-codec:a', 'libmp3lame'])
        elif out_ext in ['.m4a', '.aac']:
            cmd.extend(['-codec:a', 'aac'])
        elif out_ext in ['.ogg']:
            cmd.extend(['-codec:a', 'libvorbis'])
        
        cmd.append(final_output)
        
        result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')
        
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail=f"压缩失败: {result.stderr}")
        
        # 获取压缩后文件信息
        compressed_info = get_audio_info(final_output)
        compressed_size = os.path.getsize(final_output)
        
        return JSONResponse({
            "success": True,
            "message": "压缩成功",
            "output_path": final_output,
            "filename": output_filename,
            "original_size": original_info['size'],
            "compressed_size": compressed_size,
            "compression_ratio": round((1 - compressed_size / original_info['size']) * 100, 1) if original_info['size'] > 0 else 0,
            "duration": original_info['duration'],
            "original_bitrate": original_bitrate,
            "target_bitrate": target_bitrate
        })
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"压缩失败: {str(e)}")
    finally:
        if os.path.exists(input_path):
            try:
                os.remove(input_path)
            except:
                pass


@router.post("/batch")
async def batch_compress_audio(
    files: List[UploadFile] = File(...),
    quality: str = Form("medium"),
    bitrate: Optional[int] = Form(None),
    output_format: str = Form(""),
    output_path: str = Form("")
):
    """批量压缩音频文件"""
    results = []
    
    for file in files:
        try:
            file_ext = os.path.splitext(file.filename)[1].lower()
            file_id = str(uuid.uuid4())
            input_path = os.path.join(UPLOAD_DIR, f"{file_id}{file_ext}")
            
            content = await file.read()
            with open(input_path, "wb") as f:
                f.write(content)
            
            original_info = get_audio_info(input_path)
            
            out_ext = f".{output_format.lower()}" if output_format else file_ext
            if out_ext == '.wav':
                out_ext = '.mp3'
            
            if bitrate:
                target_bitrate = bitrate
            else:
                quality_map = {'low': 64, 'medium': 128, 'high': 192}
                target_bitrate = quality_map.get(quality, 128)
            
            base_name = os.path.splitext(decode_filename(file.filename))[0]
            # 使用原文件名
            output_filename = f"{base_name}{out_ext}"
            
            # 准备输出目录

            
            save_dir, is_fallback = prepare_output_directory(output_path, OUTPUT_DIR)
            output_filename = get_unique_filename(save_dir, output_filename)
            final_output = os.path.join(save_dir, output_filename)
            
            os.makedirs(os.path.dirname(final_output) if os.path.dirname(final_output) else OUTPUT_DIR, exist_ok=True)
            
            cmd = ['ffmpeg', '-y', '-i', input_path, '-b:a', f'{target_bitrate}k']
            if out_ext in ['.mp3']:
                cmd.extend(['-codec:a', 'libmp3lame'])
            elif out_ext in ['.m4a', '.aac']:
                cmd.extend(['-codec:a', 'aac'])
            elif out_ext in ['.ogg']:
                cmd.extend(['-codec:a', 'libvorbis'])
            cmd.append(final_output)
            
            result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')
            
            if os.path.exists(input_path):
                os.remove(input_path)
            
            if result.returncode == 0:
                compressed_size = os.path.getsize(final_output)
                results.append({
                    "filename": file.filename,
                    "success": True,
                    "output_path": final_output,
                    "output_filename": output_filename,
                    "original_size": original_info['size'],
                    "compressed_size": compressed_size,
                    "compression_ratio": round((1 - compressed_size / original_info['size']) * 100, 1) if original_info['size'] > 0 else 0
                })
            else:
                results.append({"filename": file.filename, "success": False, "message": result.stderr})
        except Exception as e:
            results.append({"filename": file.filename, "success": False, "message": str(e)})
    
    return JSONResponse({
        "success": all(r.get('success') for r in results),
        "message": f"处理完成: {sum(1 for r in results if r.get('success'))}/{len(results)} 成功",
        "results": results
    })
