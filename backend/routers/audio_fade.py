"""
音频淡入淡出路由
使用 FFmpeg afade 滤镜
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import JSONResponse
import subprocess
import os
import uuid
from typing import List, Optional
from .utils import get_unique_filename, decode_filename, prepare_output_directory

router = APIRouter()

from .config import UPLOAD_DIR, OUTPUT_DIR


@router.post("/")
async def fade_audio(
    file: UploadFile = File(...),
    fade_in: float = Form(0),  # 淡入时长（秒）
    fade_out: float = Form(0),  # 淡出时长（秒）
    output_format: str = Form(""),
    output_path: str = Form("")
):
    """
    音频淡入淡出效果
    
    参数:
    - file: 音频文件
    - fade_in: 淡入时长（秒），0表示不淡入
    - fade_out: 淡出时长（秒），0表示不淡出
    - output_format: 输出格式
    - output_path: 输出目录
    """
    if fade_in < 0 or fade_out < 0:
        raise HTTPException(status_code=400, detail="淡入淡出时长不能为负数")
    
    if fade_in == 0 and fade_out == 0:
        raise HTTPException(status_code=400, detail="请设置淡入或淡出时长")
    
    file_ext = os.path.splitext(file.filename)[1].lower()
    file_id = str(uuid.uuid4())
    input_path = os.path.join(UPLOAD_DIR, f"{file_id}{file_ext}")
    
    try:
        content = await file.read()
        with open(input_path, "wb") as f:
            f.write(content)
        
        # 获取音频时长
        duration = get_audio_duration(input_path)
        
        out_ext = f".{output_format.lower()}" if output_format else file_ext
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
        if fade_in > 0:
            filters.append(f"afade=t=in:st=0:d={fade_in}")
        if fade_out > 0:
            fade_out_start = max(0, duration - fade_out)
            filters.append(f"afade=t=out:st={fade_out_start}:d={fade_out}")
        
        filter_str = ",".join(filters)
        
        cmd = ['ffmpeg', '-y', '-i', input_path, '-af', filter_str, final_output]
        result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
        
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail=f"处理失败: {result.stderr}")
        
        output_size = os.path.getsize(final_output)
        
        return JSONResponse({
            "success": True,
            "message": "淡入淡出处理成功",
            "output_path": final_output,
            "filename": output_filename,
            "size": output_size,
            "fade_in": fade_in,
            "fade_out": fade_out
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
    import json
    cmd = ['ffprobe', '-v', 'quiet', '-print_format', 'json', '-show_format', file_path]
    result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
    try:
        info = json.loads(result.stdout)
        return float(info.get('format', {}).get('duration', 0))
    except:
        return 0


@router.post("/batch")
async def batch_fade_audio(
    files: List[UploadFile] = File(...),
    fade_in: float = Form(0),
    fade_out: float = Form(0),
    output_format: str = Form(""),
    output_path: str = Form("")
):
    """批量淡入淡出处理"""
    results = []
    
    for file in files:
        try:
            file_ext = os.path.splitext(file.filename)[1].lower()
            file_id = str(uuid.uuid4())
            input_path = os.path.join(UPLOAD_DIR, f"{file_id}{file_ext}")
            
            content = await file.read()
            with open(input_path, "wb") as f:
                f.write(content)
            
            duration = get_audio_duration(input_path)
            
            out_ext = f".{output_format.lower()}" if output_format else file_ext
            # 使用原文件名
            base_name = os.path.splitext(decode_filename(file.filename))[0]
            output_filename = f"{base_name}{out_ext}"
            
            # 准备输出目录

            
            save_dir, is_fallback = prepare_output_directory(output_path, OUTPUT_DIR)
            output_filename = get_unique_filename(save_dir, output_filename)
            final_output = os.path.join(save_dir, output_filename)
            
            os.makedirs(os.path.dirname(final_output) if os.path.dirname(final_output) else OUTPUT_DIR, exist_ok=True)
            
            filters = []
            if fade_in > 0:
                filters.append(f"afade=t=in:st=0:d={fade_in}")
            if fade_out > 0:
                fade_out_start = max(0, duration - fade_out)
                filters.append(f"afade=t=out:st={fade_out_start}:d={fade_out}")
            
            filter_str = ",".join(filters) if filters else "anull"
            
            cmd = ['ffmpeg', '-y', '-i', input_path, '-af', filter_str, final_output]
            result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
            
            if os.path.exists(input_path):
                os.remove(input_path)
            
            if result.returncode == 0:
                results.append({
                    "filename": file.filename,
                    "success": True,
                    "output_path": final_output,
                    "output_filename": output_filename,
                    "size": os.path.getsize(final_output)
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
